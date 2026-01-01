import { ItemView, WorkspaceLeaf, Setting, EventRef, parseLinktext } from "obsidian";
import {
	format,
	startOfWeek,
	endOfWeek,
	startOfMonth,
	endOfMonth,
	startOfDay,
	subDays,
} from "date-fns";
import TaskNotesPlugin from "../main";
import { STATS_VIEW_TYPE, TaskInfo, EVENT_TASK_UPDATED } from "../types";
import { calculateTotalTimeSpent, filterEmptyProjects } from "../utils/helpers";
import { getTodayLocal, createUTCDateFromLocalCalendarDate } from "../utils/dateUtils";
import { createTaskCard } from "../ui/TaskCard";
import { convertInternalToUserProperties } from "../utils/propertyMapping";

interface ProjectStats {
	projectName: string;
	totalTimeSpent: number;
	totalTimeEstimate: number;
	taskCount: number;
	completedTaskCount: number;
	avgTimePerTask: number;
	lastActivity?: string;
}

interface OverallStats {
	totalTimeSpent: number;

	totalTimeEstimate: number;
	totalTasks: number;
	completedTasks: number;
	activeProjects: number;
	completionRate: number;
	avgTimePerTask: number;
	totalTasksThisWeek?: number;
	completedTasksThisWeek?: number;
	timeSpentThisWeek?: number;
}

interface TimeRangeStats {
	overall: OverallStats;
	projects: ProjectStats[];
}

interface StatsFilters {
	dateRange: "all" | "7days" | "30days" | "90days" | "custom";
	customStartDate?: string;
	customEndDate?: string;
	selectedProjects: string[];
	minTimeSpent: number; // in minutes
}

interface ProjectDrilldownData {
	projectName: string;
	tasks: TaskInfo[];
	totalTimeSpent: number;
	totalTimeEstimate: number;
	completionRate: number;
	timeByDay: TimeByDay[];
	recentActivity: TaskInfo[];
}

interface TimeByDay {
	date: string; // YYYY-MM-DD
	timeSpent: number; // minutes
	taskCount: number;
	completedTasks: number;
}

interface TrendDataPoint {
	date: string;
	value: number;
}

export class StatsView extends ItemView {
	plugin: TaskNotesPlugin;

	// UI elements
	private overviewStatsEl: HTMLElement | null = null;
	private todayStatsEl: HTMLElement | null = null;
	private weekStatsEl: HTMLElement | null = null;
	private monthStatsEl: HTMLElement | null = null;
	private projectsStatsEl: HTMLElement | null = null;
	private filtersEl: HTMLElement | null = null;

	// State
	private currentFilters: StatsFilters = {
		dateRange: "all",
		selectedProjects: [],
		minTimeSpent: 0,
	};
	private drilldownModal: HTMLElement | null = null;
	private currentDrilldownData: ProjectDrilldownData | null = null;
	private listeners: EventRef[] = [];

	// Performance optimizations
	private statsCache = new Map<string, TaskInfo[]>();
	private lastCacheTime = 0;
	private readonly CACHE_DURATION = 60000; // 1 minute
	private debounceTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return STATS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.plugin.i18n.translate("views.stats.title");
	}

	getIcon(): string {
		return "bar-chart-4";
	}

	async onOpen() {
		await this.plugin.onReady();

		// Listen for task updates to refresh the drill-down modal if it's open
		const taskUpdateListener = this.plugin.emitter.on(
			EVENT_TASK_UPDATED,
			async ({ path, originalTask, updatedTask }) => {
				if (!path || !updatedTask || !this.drilldownModal || !this.currentDrilldownData)
					return;

				// Check if the updated task is part of the current drill-down data
				const taskExists = this.currentDrilldownData.tasks.some(
					(task) =>
						task.path === path || (originalTask && task.path === originalTask.path)
				);

				if (taskExists) {
					// Refresh the drill-down modal with updated task data
					await this.refreshDrilldownModal();
				}
			}
		);
		this.listeners.push(taskUpdateListener);

		await this.render();
	}

	async onClose() {
		this.contentEl.empty();

		// Clean up listeners
		this.listeners.forEach((listener) => this.plugin.emitter.offref(listener));
		this.listeners = [];
	}

	async render() {
		const container = this.contentEl.createDiv({
			cls: "tasknotes-plugin tasknotes-container stats-container stats-view",
		});

		// Header
		const header = container.createDiv({ cls: "stats-header stats-view__header" });
		new Setting(header)
			.setName(this.plugin.i18n.translate("views.stats.taskProjectStats"))
			.setHeading();

		// Refresh button
		const refreshButton = header.createEl("button", {
			cls: "stats-refresh-button stats-view__refresh-button",
			text: this.plugin.i18n.translate("views.stats.refreshButton"),
		});
		this.registerDomEvent(refreshButton, "click", () => {
			this.refreshStats();
		});

		// Filters section
		const filtersSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(filtersSection)
			.setName(this.plugin.i18n.translate("views.stats.sections.filters"))
			.setHeading();
		this.filtersEl = filtersSection.createDiv({ cls: "stats-filters stats-view__filters" });
		this.renderFilters();

		// Overview section
		const overviewSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(overviewSection)
			.setName(this.plugin.i18n.translate("views.stats.sections.overview"))
			.setHeading();
		this.overviewStatsEl = overviewSection.createDiv({
			cls: "stats-overview-grid stats-view__overview-grid",
		});

		// Today's stats
		const todaySection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(todaySection)
			.setName(this.plugin.i18n.translate("views.stats.sections.today"))
			.setHeading();
		this.todayStatsEl = todaySection.createDiv({ cls: "stats-grid stats-view__stats-grid" });

		// This week's stats
		const weekSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(weekSection)
			.setName(this.plugin.i18n.translate("views.stats.sections.thisWeek"))
			.setHeading();
		this.weekStatsEl = weekSection.createDiv({ cls: "stats-grid stats-view__stats-grid" });

		// This month's stats
		const monthSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(monthSection)
			.setName(this.plugin.i18n.translate("views.stats.sections.thisMonth"))
			.setHeading();
		this.monthStatsEl = monthSection.createDiv({ cls: "stats-grid stats-view__stats-grid" });

		// Project breakdown
		const projectsSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(projectsSection)
			.setName(this.plugin.i18n.translate("views.stats.sections.projectBreakdown"))
			.setHeading();
		this.projectsStatsEl = projectsSection.createDiv({
			cls: "stats-projects stats-view__projects",
		});

		// Initial load
		await this.refreshStats();
	}

	private async refreshStats() {
		try {
			// Clear cache to ensure fresh data
			this.clearCache();

			const results = await Promise.allSettled([
				this.updateOverviewStats(),
				this.updateTodayStats(),
				this.updateWeekStats(),
				this.updateMonthStats(),
				this.updateProjectStats(),
			]);

			// Log any failures in development
			if (process.env.NODE_ENV === "development") {
				results.forEach((result, index) => {
					if (result.status === "rejected") {
						const sections = ["overview", "today", "week", "month", "projects"];
						console.warn(`Failed to update ${sections[index]} stats:`, result.reason);
					}
				});
			}
		} catch (error) {
			// Failed to refresh stats - continue silently
		}
	}

	private async getAllTasks(): Promise<TaskInfo[]> {
		const cacheKey = `all-tasks-${JSON.stringify(this.currentFilters)}`;

		// Check cache first
		if (this.isCacheValid() && this.statsCache.has(cacheKey)) {
			const cached = this.statsCache.get(cacheKey);
			if (cached) {
				return cached;
			}
		}

		// Get all tasks from the cache
		const allTaskPaths = this.plugin.cacheManager.getAllTaskPaths();
		let tasks: TaskInfo[] = [];

		for (const path of allTaskPaths) {
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(path);
				if (task) {
					tasks.push(task);
				}
			} catch (error) {
				// Failed to get task info - continue silently
			}
		}

		// Apply filters
		tasks = this.applyTaskFilters(tasks);

		// Cache the results
		this.statsCache.set(cacheKey, tasks);
		this.lastCacheTime = Date.now();

		return tasks;
	}

	/**
	 * Apply current filters to task list
	 */
	private applyTaskFilters(tasks: TaskInfo[]): TaskInfo[] {
		let filteredTasks = tasks;

		// Apply date range filter
		const dateRange = this.getFilterDateRange();
		if (dateRange.start || dateRange.end) {
			filteredTasks = filteredTasks.filter((task) => {
				// Check if task has activity in the range based on time entries
				if (task.timeEntries && task.timeEntries.length > 0) {
					return task.timeEntries.some((entry) => {
						if (!entry.startTime) return false;
						const entryDate = new Date(entry.startTime);

						if (dateRange.start && entryDate < dateRange.start) return false;
						if (dateRange.end && entryDate > dateRange.end) return false;

						return true;
					});
				}

				// Also check completion date
				if (task.completedDate) {
					const completedDate = new Date(task.completedDate);
					if (dateRange.start && completedDate < dateRange.start) return false;
					if (dateRange.end && completedDate > dateRange.end) return false;
					return true;
				}

				// Check creation date as fallback
				if (task.dateCreated) {
					const createdDate = new Date(task.dateCreated);
					if (dateRange.start && createdDate < dateRange.start) return false;
					if (dateRange.end && createdDate > dateRange.end) return false;
					return true;
				}

				// If no date information and we have date filters, exclude
				return !(dateRange.start || dateRange.end);
			});
		}

		// Apply minimum time filter
		if (this.currentFilters.minTimeSpent > 0) {
			filteredTasks = filteredTasks.filter((task) => {
				const totalTime = calculateTotalTimeSpent(task.timeEntries || []);
				return totalTime >= this.currentFilters.minTimeSpent;
			});
		}

		return filteredTasks;
	}

	private async updateOverviewStats() {
		if (!this.overviewStatsEl) return;

		const allTasks = await this.getAllTasks();
		const overallStats = this.calculateOverallStats(allTasks);

		this.renderOverviewStats(this.overviewStatsEl, overallStats);
	}

	private async updateTodayStats() {
		if (!this.todayStatsEl) return;

		// Use UTC-anchored today for consistent timezone handling
		const todayLocal = getTodayLocal();
		const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);
		const startOfToday = startOfDay(todayUTCAnchor);
		const stats = await this.calculateStatsForRange(startOfToday, todayUTCAnchor);

		this.renderTimeRangeStats(this.todayStatsEl, stats);
	}

	private async updateWeekStats() {
		if (!this.weekStatsEl) return;

		// Use UTC-anchored today for consistent timezone handling
		const todayLocal = getTodayLocal();
		const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);
		const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
		const weekStartOptions = { weekStartsOn: firstDaySetting as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
		const weekStart = startOfWeek(todayUTCAnchor, weekStartOptions);
		const weekEnd = endOfWeek(todayUTCAnchor, weekStartOptions);

		const stats = await this.calculateStatsForRange(weekStart, weekEnd);
		this.renderTimeRangeStats(this.weekStatsEl, stats);
	}

	private async updateMonthStats() {
		if (!this.monthStatsEl) return;

		// Use UTC-anchored today for consistent timezone handling
		const todayLocal = getTodayLocal();
		const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);
		const monthStart = startOfMonth(todayUTCAnchor);
		const monthEnd = endOfMonth(todayUTCAnchor);

		const stats = await this.calculateStatsForRange(monthStart, monthEnd);
		this.renderTimeRangeStats(this.monthStatsEl, stats);
	}

	private async updateProjectStats() {
		if (!this.projectsStatsEl) return;

		const allTasks = await this.getAllTasks();
		const projectStats = this.calculateProjectStats(allTasks);

		await this.renderProjectStats(this.projectsStatsEl, projectStats);
	}

	/**
	 * Consolidate project names that point to the same file.
	 * Returns a canonical project name that represents all variations.
	 * Based on the implementation from PR #486
	 */
	private consolidateProjectName(projectValue: string): string {
		if (!projectValue || typeof projectValue !== "string") {
			return projectValue;
		}

		// For wikilink format, try to resolve to actual file
		if (projectValue.startsWith("[[") && projectValue.endsWith("]]")) {
			const linkPath = this.extractWikilinkPath(projectValue);
			if (linkPath && this.plugin?.app) {
				const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
					linkPath,
					""
				);
				if (resolvedFile) {
					// Return the file basename as the canonical name
					return resolvedFile.basename;
				}

				// If file doesn't exist, extract clean name from path
				const cleanName = this.extractProjectName(projectValue);
				if (cleanName) {
					return cleanName;
				}
			}
		}

		// Handle pipe syntax like "../projects/Genealogy|Genealogy"
		if (projectValue.includes("|")) {
			const parts = projectValue.split("|");
			// Return the display name (after the pipe)
			return parts[parts.length - 1] || projectValue;
		}

		// Handle path-like strings (extract final segment)
		if (projectValue.includes("/")) {
			const parts = projectValue.split("/");
			return parts[parts.length - 1] || projectValue;
		}

		// For plain text projects, return as-is
		return projectValue;
	}

	/**
	 * Extract wikilink path from [[...]] format, handling alias syntax
	 */
	private extractWikilinkPath(projectValue: string): string | null {
		if (
			!projectValue ||
			typeof projectValue !== "string" ||
			!projectValue.startsWith("[[") ||
			!projectValue.endsWith("]]")
		) {
			return null;
		}

		const linkContent = projectValue.slice(2, -2);

		// Use Obsidian's parseLinktext to handle aliases properly
		return parseLinktext(linkContent).path;
	}

	/**
	 * Extract clean project name from various formats
	 */
	private extractProjectName(projectValue: string): string | null {
		if (!projectValue) return null;

		// For wikilinks, extract the link content
		if (projectValue.startsWith("[[") && projectValue.endsWith("]]")) {
			const linkPath = this.extractWikilinkPath(projectValue);
			if (!linkPath) return null;

			// Extract basename from path
			const parts = linkPath.split("/");
			return parts[parts.length - 1] || linkPath;
		}

		// For pipe syntax, get the display name
		if (projectValue.includes("|")) {
			const parts = projectValue.split("|");
			return parts[parts.length - 1] || projectValue;
		}

		// For paths, get the final segment
		if (projectValue.includes("/")) {
			const parts = projectValue.split("/");
			return parts[parts.length - 1] || projectValue;
		}

		return projectValue;
	}

	private calculateOverallStats(tasks: TaskInfo[]): OverallStats {
		let totalTimeSpent = 0;
		let totalTimeEstimate = 0;
		let completedTasks = 0;
		const uniqueProjects = new Set<string>();

		for (const task of tasks) {
			totalTimeSpent += calculateTotalTimeSpent(task.timeEntries || []);
			totalTimeEstimate += task.timeEstimate || 0;

			if (this.plugin.statusManager.isCompletedStatus(task.status)) {
				completedTasks++;
			}

			// Add projects to the set
			const taskProjects = this.getTaskProjects(task);
			for (const project of taskProjects) {
				uniqueProjects.add(project);
			}
		}

		return {
			totalTimeSpent,
			totalTimeEstimate,
			totalTasks: tasks.length,
			completedTasks,
			activeProjects: uniqueProjects.size,
			completionRate: tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0,
			avgTimePerTask: tasks.length > 0 ? totalTimeSpent / tasks.length : 0,
		};
	}

	private async calculateStatsForRange(startDate: Date, endDate: Date): Promise<TimeRangeStats> {
		const allTasks = await this.getAllTasks();

		// Filter tasks that have activity in the range
		const tasksInRange = allTasks.filter((task) => {
			// Check if task has time entries in the range
			if (task.timeEntries && task.timeEntries.length > 0) {
				return task.timeEntries.some((entry) => {
					if (!entry.startTime) return false;
					const entryDate = new Date(entry.startTime);
					return entryDate >= startDate && entryDate <= endDate;
				});
			}

			// Also include tasks completed in this range
			if (task.completedDate) {
				const completedDate = new Date(task.completedDate);
				return completedDate >= startDate && completedDate <= endDate;
			}

			// Include tasks created in this range
			if (task.dateCreated) {
				const createdDate = new Date(task.dateCreated);
				return createdDate >= startDate && createdDate <= endDate;
			}

			return false;
		});

		const overall = this.calculateOverallStats(tasksInRange);
		const projects = this.calculateProjectStats(tasksInRange);

		return { overall, projects };
	}

	private calculateProjectStats(tasks: TaskInfo[]): ProjectStats[] {
		const projectMap = new Map<
			string,
			{
				tasks: TaskInfo[];
				totalTime: number;
				totalTimeEstimate: number; // Add this
				completedCount: number;
				lastActivity: string | undefined;
			}
		>();

		// Group tasks by project - follow FilterService pattern exactly
		for (const task of tasks) {
			const timeSpent = calculateTotalTimeSpent(task.timeEntries || []);
			const timeEstimate = task.timeEstimate || 0;
			const isCompleted = this.plugin.statusManager.isCompletedStatus(task.status);

			// Get last activity date
			let lastActivity: string | undefined;
			if (task.timeEntries && task.timeEntries.length > 0) {
				const sortedEntries = [...task.timeEntries].sort(
					(a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
				);
				lastActivity = sortedEntries[0].startTime;
			} else if (task.completedDate) {
				lastActivity = task.completedDate;
			} else if (task.dateModified) {
				lastActivity = task.dateModified;
			}

			// Handle projects
			const taskProjects = this.getTaskProjects(task);

			for (const consolidatedProject of taskProjects) {
				if (!projectMap.has(consolidatedProject)) {
					projectMap.set(consolidatedProject, {
						tasks: [],
						totalTime: 0,
						totalTimeEstimate: 0, // Add this
						completedCount: 0,
						lastActivity: undefined,
					});
				}

				const projectData = projectMap.get(consolidatedProject);
				if (!projectData) continue;

				projectData.tasks.push(task);
				projectData.totalTime += timeSpent;
				projectData.totalTimeEstimate += timeEstimate; // Add this
				if (isCompleted) projectData.completedCount++;

				// Update last activity if this is more recent
				if (
					lastActivity &&
					(!projectData.lastActivity ||
						new Date(lastActivity) > new Date(projectData.lastActivity))
				) {
					projectData.lastActivity = lastActivity;
				}
			}
		}

		// Convert to ProjectStats array
		const projectStats: ProjectStats[] = [];
		for (const [consolidatedProjectName, data] of projectMap.entries()) {
			projectStats.push({
				projectName: consolidatedProjectName,
				totalTimeSpent: data.totalTime,
				totalTimeEstimate: data.totalTimeEstimate, // Add this
				taskCount: data.tasks.length,
				completedTaskCount: data.completedCount,
				avgTimePerTask: data.tasks.length > 0 ? data.totalTime / data.tasks.length : 0,
				lastActivity: data.lastActivity,
			});
		}

		// Sort by total time spent descending, with "No Project" at the end (like FilterService)
		const noProjectLabel = this.plugin.i18n.translate("views.stats.noProject");
		projectStats.sort((a, b) => {
			if (a.projectName === noProjectLabel) return 1;
			if (b.projectName === noProjectLabel) return -1;
			return b.totalTimeSpent - a.totalTimeSpent;
		});

		return projectStats;
	}

	/**
	 * Render filter controls
	 */
	private renderFilters() {
		if (!this.filtersEl) return;

		this.filtersEl.empty();

		// Create filter container with grid layout
		const filterGrid = this.filtersEl.createDiv({ cls: "stats-view__filter-grid" });

		// Date range filter
		const dateRangeContainer = filterGrid.createDiv({ cls: "stats-view__filter-item" });
		const dateRangeLabel = dateRangeContainer.createDiv({ cls: "stats-view__filter-label" });
		dateRangeLabel.textContent = this.plugin.i18n.translate("views.stats.sections.dateRange");

		const dateRangeSelect = dateRangeContainer.createEl("select", {
			cls: "stats-view__filter-select",
		});
		const dateOptions = [
			{ value: "all", text: this.plugin.i18n.translate("views.stats.timeRanges.allTime") },
			{ value: "7days", text: this.plugin.i18n.translate("views.stats.timeRanges.last7Days") },
			{ value: "30days", text: this.plugin.i18n.translate("views.stats.timeRanges.last30Days") },
			{ value: "90days", text: this.plugin.i18n.translate("views.stats.timeRanges.last90Days") },
			{ value: "custom", text: this.plugin.i18n.translate("views.stats.timeRanges.customRange") },
		];

		for (const option of dateOptions) {
			const optionEl = dateRangeSelect.createEl("option", {
				value: option.value,
				text: option.text,
			});
			if (option.value === this.currentFilters.dateRange) {
				optionEl.selected = true;
			}
		}

		this.registerDomEvent(dateRangeSelect, "change", () => {
			this.currentFilters.dateRange = dateRangeSelect.value as StatsFilters["dateRange"];
			this.renderCustomDateInputs();
			this.applyFilters();
		});

		// Custom date inputs container
		const customDatesContainer = filterGrid.createDiv({ cls: "stats-view__custom-dates" });
		if (this.currentFilters.dateRange === "custom") {
			this.renderCustomDateInputs(customDatesContainer);
		}

		// Minimum time filter
		const minTimeContainer = filterGrid.createDiv({ cls: "stats-view__filter-item" });
		const minTimeLabel = minTimeContainer.createDiv({ cls: "stats-view__filter-label" });
		minTimeLabel.textContent = this.plugin.i18n.translate("views.stats.filters.minTime");

		const minTimeInput = minTimeContainer.createEl("input", {
			cls: "stats-view__filter-input",
			type: "number",
			value: this.currentFilters.minTimeSpent.toString(),
			placeholder: "0",
		});

		this.registerDomEvent(minTimeInput, "input", () => {
			this.currentFilters.minTimeSpent = parseInt(minTimeInput.value) || 0;
			this.applyFilters();
		});

		// Apply/Reset buttons
		const buttonsContainer = filterGrid.createDiv({ cls: "stats-view__filter-buttons" });

		const resetButton = buttonsContainer.createEl("button", {
			cls: "stats-view__filter-button stats-view__filter-button--reset",
			text: this.plugin.i18n.translate("views.stats.resetFiltersButton"),
		});

		this.registerDomEvent(resetButton, "click", () => {
			this.currentFilters = {
				dateRange: "all",
				selectedProjects: [],
				minTimeSpent: 0,
			};
			this.renderFilters();
			this.applyFilters();
		});
	}

	/**
	 * Render custom date inputs when needed
	 */
	private renderCustomDateInputs(container?: HTMLElement) {
		const customDatesContainer =
			container ||
			(this.filtersEl?.querySelector(".stats-view__custom-dates") as HTMLElement);
		if (!customDatesContainer) return;

		customDatesContainer.empty();

		if (this.currentFilters.dateRange === "custom") {
			const startDateContainer = customDatesContainer.createDiv({
				cls: "stats-view__date-input-container",
			});
			startDateContainer.createDiv({ cls: "stats-view__date-label", text: this.plugin.i18n.translate("views.stats.dateRangeFrom") });
			const startInput = startDateContainer.createEl("input", {
				cls: "stats-view__date-input",
				type: "date",
				value: this.currentFilters.customStartDate || "",
			});

			const endDateContainer = customDatesContainer.createDiv({
				cls: "stats-view__date-input-container",
			});
			endDateContainer.createDiv({ cls: "stats-view__date-label", text: this.plugin.i18n.translate("views.stats.dateRangeTo") });
			const endInput = endDateContainer.createEl("input", {
				cls: "stats-view__date-input",
				type: "date",
				value: this.currentFilters.customEndDate || "",
			});

			this.registerDomEvent(startInput, "change", () => {
				this.currentFilters.customStartDate = startInput.value;
				this.applyFilters();
			});

			this.registerDomEvent(endInput, "change", () => {
				this.currentFilters.customEndDate = endInput.value;
				this.applyFilters();
			});
		}
	}

	/**
	 * Apply current filters and refresh statistics with debouncing
	 */
	private async applyFilters() {
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
		}

		this.debounceTimeout = setTimeout(async () => {
			await this.refreshStats();
			this.debounceTimeout = null;
		}, 300);
	}

	/**
	 * Check if stats cache is valid
	 */
	private isCacheValid(): boolean {
		const now = Date.now();
		return now - this.lastCacheTime < this.CACHE_DURATION;
	}

	/**
	 * Clear stats cache
	 */
	private clearCache() {
		this.statsCache.clear();
		this.lastCacheTime = 0;
	}

	/**
	 * Get consolidated project names for a task
	 */
	private getTaskProjects(task: TaskInfo): string[] {
		try {
			if (!task || !Array.isArray(task.projects)) {
				return [this.plugin.i18n.translate("views.stats.noProject")];
			}

			const filteredProjects = filterEmptyProjects(task.projects);
			if (filteredProjects.length > 0) {
				return filteredProjects
					.map((project) => this.consolidateProjectName(project))
					.filter((project) => typeof project === "string" && project.length > 0);
			}
			return [this.plugin.i18n.translate("views.stats.noProject")];
		} catch (error) {
			return [this.plugin.i18n.translate("views.stats.noProject")];
		}
	}

	/**
	 * Get date range based on current filters
	 */
	private getFilterDateRange(): { start?: Date; end?: Date } {
		// Use UTC-anchored today for consistent timezone handling
		const todayLocal = getTodayLocal();
		const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);

		switch (this.currentFilters.dateRange) {
			case "7days":
				return {
					start: subDays(todayUTCAnchor, 7),
					end: todayUTCAnchor,
				};
			case "30days":
				return {
					start: subDays(todayUTCAnchor, 30),
					end: todayUTCAnchor,
				};
			case "90days":
				return {
					start: subDays(todayUTCAnchor, 90),
					end: todayUTCAnchor,
				};
			case "custom":
				return {
					start: this.currentFilters.customStartDate
						? new Date(this.currentFilters.customStartDate)
						: undefined,
					end: this.currentFilters.customEndDate
						? new Date(this.currentFilters.customEndDate)
						: undefined,
				};
			case "all":
			default:
				return {};
		}
	}

	private renderOverviewStats(container: HTMLElement, stats: OverallStats) {
		container.empty();

		// Format time duration in hours and minutes
		const formatTime = (minutes: number): string => {
			if (minutes < 60) return `${Math.round(minutes)}m`;
			const hours = Math.floor(minutes / 60);
			const mins = Math.round(minutes % 60);
			return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
		};

		// Total Time
		const totalTimeCard = container.createDiv({
			cls: "stats-overview-card stats-view__overview-card",
		});
		const totalTimeValue = totalTimeCard.createDiv({
			cls: "overview-value stats-view__overview-value",
		});
		totalTimeValue.textContent = `${formatTime(stats.totalTimeSpent)} / ${formatTime(stats.totalTimeEstimate)}`;
		totalTimeCard.createDiv({
			cls: "overview-label stats-view__overview-label",
			text: this.plugin.i18n.translate("views.stats.cards.timeTrackedEstimated"),
		});

		// Total Tasks
		const totalTasksCard = container.createDiv({
			cls: "stats-overview-card stats-view__overview-card",
		});
		const totalTasksValue = totalTasksCard.createDiv({
			cls: "overview-value stats-view__overview-value",
		});
		totalTasksValue.textContent = stats.totalTasks.toString();
		totalTasksCard.createDiv({
			cls: "overview-label stats-view__overview-label",
			text: this.plugin.i18n.translate("views.stats.cards.totalTasks"),
		});

		// Completion Rate
		const completionCard = container.createDiv({
			cls: "stats-overview-card stats-view__overview-card",
		});
		const completionValue = completionCard.createDiv({
			cls: "overview-value stats-view__overview-value",
		});
		completionValue.textContent = `${Math.round(stats.completionRate)}%`;
		completionCard.createDiv({
			cls: "overview-label stats-view__overview-label",
			text: this.plugin.i18n.translate("views.stats.cards.completionRate"),
		});

		// Active Projects
		const projectsCard = container.createDiv({
			cls: "stats-overview-card stats-view__overview-card",
		});
		const projectsValue = projectsCard.createDiv({
			cls: "overview-value stats-view__overview-value",
		});
		projectsValue.textContent = stats.activeProjects.toString();
		projectsCard.createDiv({
			cls: "overview-label stats-view__overview-label",
			text: this.plugin.i18n.translate("views.stats.cards.activeProjects"),
		});

		// Average Time per Task
		const avgTimeCard = container.createDiv({
			cls: "stats-overview-card stats-view__overview-card",
		});
		const avgTimeValue = avgTimeCard.createDiv({
			cls: "overview-value stats-view__overview-value",
		});
		avgTimeValue.textContent = formatTime(stats.avgTimePerTask);
		avgTimeCard.createDiv({
			cls: "overview-label stats-view__overview-label",
			text: this.plugin.i18n.translate("views.stats.cards.avgTimePerTask"),
		});
	}

	private renderTimeRangeStats(container: HTMLElement, stats: TimeRangeStats) {
		container.empty();

		const formatTime = (minutes: number): string => {
			if (minutes < 60) return `${Math.round(minutes)}m`;
			const hours = Math.floor(minutes / 60);
			const mins = Math.round(minutes % 60);
			return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
		};

		// Time Tracked
		const timeCard = container.createDiv({ cls: "stats-stat-card stats-view__stat-card" });
		timeCard.createDiv({
			cls: "stat-value stats-view__stat-value",
			text: `${formatTime(stats.overall.totalTimeSpent)} / ${formatTime(stats.overall.totalTimeEstimate)}`,
		});
		timeCard.createDiv({
			cls: "stat-label stats-view__stat-label",
			text: this.plugin.i18n.translate("views.stats.cards.timeTrackedEstimated"),
		});

		// Tasks
		const tasksCard = container.createDiv({ cls: "stats-stat-card stats-view__stat-card" });
		tasksCard.createDiv({
			cls: "stat-value stats-view__stat-value",
			text: stats.overall.totalTasks.toString(),
		});
		tasksCard.createDiv({ cls: "stat-label stats-view__stat-label", text: this.plugin.i18n.translate("views.stats.labels.tasks") });

		// Completed
		const completedCard = container.createDiv({ cls: "stats-stat-card stats-view__stat-card" });
		completedCard.createDiv({
			cls: "stat-value stats-view__stat-value",
			text: stats.overall.completedTasks.toString(),
		});
		completedCard.createDiv({ cls: "stat-label stats-view__stat-label", text: this.plugin.i18n.translate("views.stats.labels.completed") });

		// Projects
		const projectsCard = container.createDiv({ cls: "stats-stat-card stats-view__stat-card" });
		projectsCard.createDiv({
			cls: "stat-value stats-view__stat-value",
			text: stats.overall.activeProjects.toString(),
		});
		projectsCard.createDiv({ cls: "stat-label stats-view__stat-label", text: this.plugin.i18n.translate("views.stats.labels.projects") });
	}

	private async renderProjectStats(container: HTMLElement, projects: ProjectStats[]) {
		container.empty();

		if (projects.length === 0) {
			container.createDiv({
				cls: "stats-no-data stats-view__no-data",
				text: this.plugin.i18n.translate("views.stats.noProjectData"),
			});
			return;
		}

		const formatTime = (minutes: number): string => {
			if (minutes < 60) return `${Math.round(minutes)}m`;
			const hours = Math.floor(minutes / 60);
			const mins = Math.round(minutes % 60);
			return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
		};

		const formatDate = (dateString?: string): string => {
			if (!dateString) return this.plugin.i18n.translate("views.stats.notAvailable");
			try {
				const date = new Date(dateString);
				return format(date, "MMM d, yyyy");
			} catch {
				return this.plugin.i18n.translate("views.stats.notAvailable");
			}
		};

		for (const project of projects) {
			const projectClasses = [
				"stats-project-item",
				"stats-view__project-item",
				"stats-view__project-item--clickable",
			];

			// Add special class for "No Project" items
			if (project.projectName === this.plugin.i18n.translate("views.stats.noProject")) {
				projectClasses.push("stats-view__project-item--no-project");
			}

			const projectEl = container.createDiv({
				cls: projectClasses.join(" "),
			});

			// Make project clickable for drill-down
			this.registerDomEvent(projectEl, "click", () => {
				this.openProjectDrilldown(project.projectName);
			});

			// Project header with name and completion rate
			const headerEl = projectEl.createDiv({ cls: "stats-view__project-header" });

			const nameEl = headerEl.createDiv({ cls: "project-name stats-view__project-name" });
			nameEl.textContent = project.projectName;

			// Add click indicator
			headerEl.createDiv({
				cls: "stats-view__click-indicator",
				text: "→",
			});

			const completionRate =
				project.taskCount > 0 ? (project.completedTaskCount / project.taskCount) * 100 : 0;

			// Main content grid
			const contentGrid = projectEl.createDiv({ cls: "stats-view__project-content-grid" });

			// Left side: Progress circle and details
			const progressContainer = contentGrid.createDiv({
				cls: "stats-view__progress-container",
			});
			this.renderProgressCircle(
				progressContainer,
				completionRate,
				project.completedTaskCount,
				project.taskCount
			);

			// Right side: Stats and trend
			const statsContainer = contentGrid.createDiv({ cls: "stats-view__stats-container" });

			// Time visualization bar
			if (project.totalTimeSpent > 0 || project.totalTimeEstimate > 0) {
				const timeBar = statsContainer.createDiv({ cls: "stats-view__time-bar" });
				const timeBarVisual = timeBar.createDiv({ cls: "stats-view__time-bar-visual" });
				const timeBarFill = timeBarVisual.createDiv({ cls: "stats-view__time-bar-fill" });

				let timePercentage = 0;
				if (project.totalTimeEstimate > 0) {
					timePercentage = (project.totalTimeSpent / project.totalTimeEstimate) * 100;
				} else if (project.totalTimeSpent > 0) {
					timePercentage = 100; // No estimate, but time spent
					timeBarFill.style.backgroundColor = "var(--color-base-40)"; // Use a neutral color
				}

				timeBarFill.style.width = `${Math.min(timePercentage, 100)}%`;
				if (timePercentage > 100) {
					timeBarFill.style.backgroundColor = "var(--color-red)"; // Over budget
				}

				const timeLabel = timeBar.createDiv({ cls: "stats-view__time-bar-label" });
				timeLabel.textContent = `${formatTime(project.totalTimeSpent)} / ${formatTime(project.totalTimeEstimate)}`;
			}

			// Additional stats
			const statsEl = statsContainer.createDiv({
				cls: "project-stats stats-view__project-stats",
			});

			if (project.lastActivity) {
				const activityEl = statsEl.createDiv({
					cls: "project-stat stats-view__project-stat",
				});
				activityEl.textContent = `Last activity: ${formatDate(project.lastActivity)}`;
			}

			if (project.avgTimePerTask > 0) {
				const avgEl = statsEl.createDiv({ cls: "project-stat stats-view__project-stat" });
				avgEl.textContent = `Avg: ${formatTime(project.avgTimePerTask)}/task`;
			}

			// Add sparkline trend (load asynchronously)
			const trendContainer = statsContainer.createDiv({ cls: "stats-view__trend-container" });
			const sparklineEl = trendContainer.createDiv({ cls: "stats-view__sparkline" });

			// Load trend data synchronously for now - we can optimize later
			try {
				const trendData = await this.calculateProjectTrend(project.projectName);
				if (trendData.length > 0 && trendData.some((d) => d.value > 0)) {
					this.renderSparkline(sparklineEl, trendData);
				} else {
					trendContainer.remove();
				}
			} catch (error) {
				// Error loading trend data - remove container
				trendContainer.remove();
			}
		}
	}

	private renderProgressCircle(
		container: HTMLElement,
		percentage: number,
		completed: number,
		total: number
	) {
		const size = 60;
		const strokeWidth = 5;
		const radius = (size - strokeWidth) / 2;
		const circumference = 2 * Math.PI * radius;
		const offset = circumference - (percentage / 100) * circumference;

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", size.toString());
		svg.setAttribute("height", size.toString());
		svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
		svg.classList.add("stats-view__progress-circle-svg");

		const backgroundCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		backgroundCircle.setAttribute("cx", (size / 2).toString());
		backgroundCircle.setAttribute("cy", (size / 2).toString());
		backgroundCircle.setAttribute("r", radius.toString());
		backgroundCircle.classList.add("stats-view__progress-circle-bg");

		const foregroundCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		foregroundCircle.setAttribute("cx", (size / 2).toString());
		foregroundCircle.setAttribute("cy", (size / 2).toString());
		foregroundCircle.setAttribute("r", radius.toString());
		foregroundCircle.setAttribute("stroke-dasharray", `${circumference} ${circumference}`);
		foregroundCircle.setAttribute("stroke-dashoffset", offset.toString());
		foregroundCircle.classList.add("stats-view__progress-circle-fg");

		const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
		text.setAttribute("x", "50%");
		text.setAttribute("y", "50%");
		text.setAttribute("dy", "0.3em");
		text.setAttribute("text-anchor", "middle");
		text.classList.add("stats-view__progress-circle-text");
		text.textContent = `${Math.round(percentage)}%`;

		svg.appendChild(backgroundCircle);
		svg.appendChild(foregroundCircle);
		svg.appendChild(text);

		container.appendChild(svg);

		const label = container.createDiv({ cls: "stats-view__progress-label" });
		label.textContent = `${completed}/${total} tasks`;
	}

	/**
	 * Calculate trend data for a project over the last 30 days
	 */
	private async calculateProjectTrend(projectName: string): Promise<TrendDataPoint[]> {
		try {
			const allTasks = this.plugin.cacheManager.getAllTaskPaths();
			const projectTasks: TaskInfo[] = [];

			// Get all tasks for this project
			for (const path of allTasks) {
				try {
					const task = await this.plugin.cacheManager.getTaskInfo(path);
					if (task) {
						const taskProjects = this.getTaskProjects(task);
						if (taskProjects.includes(projectName)) {
							projectTasks.push(task);
						}
					}
				} catch (error) {
					// Failed to get task info - continue silently
				}
			}

			// Calculate daily time spent over last 30 days
			const trendData: TrendDataPoint[] = [];
			// Use UTC-anchored today for consistent timezone handling
			const todayLocal = getTodayLocal();
			const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);

			for (let i = 29; i >= 0; i--) {
				const date = subDays(todayUTCAnchor, i);
				const dateStr = format(date, "yyyy-MM-dd");
				let dailyTime = 0;

				for (const task of projectTasks) {
					if (task.timeEntries) {
						for (const entry of task.timeEntries) {
							if (entry.startTime) {
								const entryDate = format(new Date(entry.startTime), "yyyy-MM-dd");
								if (entryDate === dateStr) {
									dailyTime += calculateTotalTimeSpent([entry]);
								}
							}
						}
					}
				}

				trendData.push({
					date: dateStr,
					value: dailyTime,
				});
			}

			return trendData;
		} catch (error) {
			// Error calculating project trend
			return [];
		}
	}

	/**
	 * Render SVG sparkline
	 */
	private renderSparkline(container: HTMLElement, data: TrendDataPoint[]) {
		container.empty();

		if (data.length === 0) {
			return;
		}

		const width = 100;
		const height = 20;
		const maxValue = Math.max(...data.map((d) => d.value));

		if (maxValue === 0) {
			return;
		}

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", width.toString());
		svg.setAttribute("height", height.toString());
		svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
		svg.classList.add("stats-view__sparkline-svg");

		// Create path
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

		let pathD = "";
		data.forEach((point, index) => {
			const x = (index / (data.length - 1)) * width;
			const y = height - (point.value / maxValue) * height;

			if (index === 0) {
				pathD += `M ${x} ${y}`;
			} else {
				pathD += ` L ${x} ${y}`;
			}
		});

		path.setAttribute("d", pathD);
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", "currentColor");
		path.setAttribute("stroke-width", "1.5");
		path.setAttribute("opacity", "0.7");

		svg.appendChild(path);
		container.appendChild(svg);
	}

	/**
	 * Open project drill-down modal
	 */
	private async openProjectDrilldown(projectName: string) {
		// Remove any existing modal
		this.closeDrilldownModal();

		// Use contentEl.ownerDocument to support pop-out windows
		const doc = this.contentEl.ownerDocument;

		// Create modal backdrop
		const backdrop = doc.body.createDiv({ cls: "stats-view__modal-backdrop" });
		this.drilldownModal = backdrop;

		// Create modal content with proper CSS scope for TaskCard components
		const modal = backdrop.createDiv({ cls: "stats-view__modal tasknotes-plugin" });

		// Modal header
		const header = modal.createDiv({ cls: "stats-view__modal-header" });
		const title = header.createDiv({ cls: "stats-view__modal-title" });
		title.textContent = `${projectName} - Detailed View`;

		const closeBtn = header.createEl("button", {
			cls: "stats-view__modal-close",
			text: "×",
		});

		// Modal content
		const content = modal.createDiv({ cls: "stats-view__modal-content" });
		content.textContent = this.plugin.i18n.translate("views.stats.loading");

		// Event handlers
		this.registerDomEvent(closeBtn, "click", () => this.closeDrilldownModal());
		this.registerDomEvent(backdrop, "click", (e) => {
			if (e.target === backdrop) this.closeDrilldownModal();
		});

		// ESC key handler
		const escHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				this.closeDrilldownModal();
				doc.removeEventListener("keydown", escHandler);
			}
		};
		doc.addEventListener("keydown", escHandler);

		// Load and render drill-down data
		try {
			const drilldownData = await this.getProjectDrilldownData(projectName);
			this.currentDrilldownData = drilldownData;
			this.renderDrilldownContent(content, drilldownData);
		} catch (error) {
			console.error("Error loading drill-down data:", error);
			content.textContent = this.plugin.i18n.translate("notices.statsLoadingFailed");
		}
	}

	/**
	 * Close drill-down modal
	 */
	private closeDrilldownModal() {
		if (this.drilldownModal) {
			this.drilldownModal.remove();
			this.drilldownModal = null;
			this.currentDrilldownData = null;
		}
	}

	/**
	 * Refresh drill-down modal with updated task data
	 */
	private async refreshDrilldownModal() {
		if (!this.drilldownModal || !this.currentDrilldownData) return;

		// Find the modal content div
		const modalContent = this.drilldownModal.querySelector(".stats-view__modal-content");
		if (!modalContent) return;

		try {
			// Re-fetch the drill-down data for the current project
			const updatedData = await this.getProjectDrilldownData(
				this.currentDrilldownData.projectName
			);
			this.currentDrilldownData = updatedData;
			this.renderDrilldownContent(modalContent as HTMLElement, updatedData);
		} catch (error) {
			console.error("Error refreshing drill-down modal:", error);
		}
	}

	/**
	 * Get detailed data for project drill-down
	 */
	private async getProjectDrilldownData(projectName: string): Promise<ProjectDrilldownData> {
		const allTasks = this.plugin.cacheManager.getAllTaskPaths();
		const projectTasks: TaskInfo[] = [];

		// Get all tasks for this project
		for (const path of allTasks) {
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(path);
				if (task) {
					const taskProjects = this.getTaskProjects(task);
					if (taskProjects.includes(projectName)) {
						projectTasks.push(task);
					}
				}
			} catch (error) {
				console.error(`Failed to get task for drill-down: ${path}`, error);
			}
		}

		// Calculate stats
		const totalTimeSpent = projectTasks.reduce(
			(sum, task) => sum + calculateTotalTimeSpent(task.timeEntries || []),
			0
		);

		const totalTimeEstimate = projectTasks.reduce(
			(sum, task) => sum + (task.timeEstimate || 0),
			0
		);

		const completedTasks = projectTasks.filter((task) =>
			this.plugin.statusManager.isCompletedStatus(task.status)
		).length;

		const completionRate =
			projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;

		// Get recent activity (last 10 tasks with time entries or recent completion)
		const recentActivity = projectTasks
			.filter((task) => task.timeEntries?.length || task.completedDate)
			.sort((a, b) => {
				const aTime = a.timeEntries?.length
					? Math.max(...a.timeEntries.map((e) => new Date(e.startTime).getTime()))
					: a.completedDate
						? new Date(a.completedDate).getTime()
						: 0;
				const bTime = b.timeEntries?.length
					? Math.max(...b.timeEntries.map((e) => new Date(e.startTime).getTime()))
					: b.completedDate
						? new Date(b.completedDate).getTime()
						: 0;
				return bTime - aTime;
			})
			.slice(0, 10);

		// Calculate time by day for the last 30 days
		const timeByDay: TimeByDay[] = [];
		// Use UTC-anchored today for consistent timezone handling
		const todayLocal = getTodayLocal();
		const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);

		for (let i = 29; i >= 0; i--) {
			const date = subDays(todayUTCAnchor, i);
			const dateStr = format(date, "yyyy-MM-dd");
			let dayTime = 0;
			let dayTasks = 0;
			let dayCompleted = 0;

			for (const task of projectTasks) {
				// Check time entries
				if (task.timeEntries) {
					const dayEntries = task.timeEntries.filter(
						(entry) => format(new Date(entry.startTime), "yyyy-MM-dd") === dateStr
					);
					if (dayEntries.length > 0) {
						dayTime += calculateTotalTimeSpent(dayEntries);
						dayTasks++;
					}
				}

				// Check completion date
				if (
					task.completedDate &&
					format(new Date(task.completedDate), "yyyy-MM-dd") === dateStr
				) {
					dayCompleted++;
					if (
						!task.timeEntries?.some(
							(entry) => format(new Date(entry.startTime), "yyyy-MM-dd") === dateStr
						)
					) {
						dayTasks++;
					}
				}
			}

			timeByDay.push({
				date: dateStr,
				timeSpent: dayTime,
				taskCount: dayTasks,
				completedTasks: dayCompleted,
			});
		}

		return {
			projectName,
			tasks: projectTasks,
			totalTimeSpent,
			totalTimeEstimate,
			completionRate,
			timeByDay,
			recentActivity,
		};
	}

	/**
	 * Render drill-down modal content
	 */
	private renderDrilldownContent(container: HTMLElement, data: ProjectDrilldownData) {
		container.empty();

		const formatTime = (minutes: number): string => {
			if (minutes < 60) return `${Math.round(minutes)}m`;
			const hours = Math.floor(minutes / 60);
			const mins = Math.round(minutes % 60);
			return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
		};

		// Overview stats with enhanced metrics
		const overviewEl = container.createDiv({ cls: "stats-view__drilldown-overview" });

		const statsGrid = overviewEl.createDiv({ cls: "stats-view__drilldown-stats" });

		const totalTimeCard = statsGrid.createDiv({ cls: "stats-view__drilldown-card" });
		totalTimeCard.createDiv({
			cls: "stats-view__drilldown-value",
			text: `${formatTime(data.totalTimeSpent)} / ${formatTime(data.totalTimeEstimate)}`,
		});
		totalTimeCard.createDiv({ cls: "stats-view__drilldown-label", text: "Total Time" });

		const tasksCard = statsGrid.createDiv({ cls: "stats-view__drilldown-card" });
		tasksCard.createDiv({
			cls: "stats-view__drilldown-value",
			text: data.tasks.length.toString(),
		});
		tasksCard.createDiv({ cls: "stats-view__drilldown-label", text: "Total Tasks" });

		const completionCard = statsGrid.createDiv({ cls: "stats-view__drilldown-card" });
		completionCard.createDiv({
			cls: "stats-view__drilldown-value",
			text: `${Math.round(data.completionRate)}%`,
		});
		completionCard.createDiv({ cls: "stats-view__drilldown-label", text: "Completed" });

		// Add average time per task
		const avgTimeCard = statsGrid.createDiv({ cls: "stats-view__drilldown-card" });
		const avgTimeSpent = data.tasks.length > 0 ? data.totalTimeSpent / data.tasks.length : 0;
		const avgTimeEstimate =
			data.tasks.length > 0 ? data.totalTimeEstimate / data.tasks.length : 0;
		avgTimeCard.createDiv({
			cls: "stats-view__drilldown-value",
			text: `${formatTime(avgTimeSpent)} / ${formatTime(avgTimeEstimate)}`,
		});
		avgTimeCard.createDiv({ cls: "stats-view__drilldown-label", text: "Avg per Task" });

		// Activity chart
		const chartSection = container.createDiv({ cls: "stats-view__drilldown-section" });
		chartSection.createDiv({
			cls: "stats-view__drilldown-heading",
			text: "Activity Over Time (Last 30 Days)",
		});
		const chartEl = chartSection.createDiv({ cls: "stats-view__activity-chart" });
		this.renderActivityChart(chartEl, data.timeByDay);

		// All project tasks section (improved from just recent activity)
		const tasksSection = container.createDiv({ cls: "stats-view__drilldown-section" });
		const tasksHeaderContainer = tasksSection.createDiv({ cls: "stats-view__section-header" });
		tasksHeaderContainer.createDiv({
			cls: "stats-view__drilldown-heading",
			text: "All Project Tasks",
		});

		// Add filter controls for tasks
		const taskFilters = tasksHeaderContainer.createDiv({ cls: "stats-view__task-filters" });
		const statusFilter = taskFilters.createEl("select", { cls: "stats-view__filter-select" });
		statusFilter.createEl("option", { value: "all", text: this.plugin.i18n.translate("views.stats.filters.allTasks") });
		statusFilter.createEl("option", { value: "active", text: this.plugin.i18n.translate("views.stats.filters.activeOnly") });
		statusFilter.createEl("option", { value: "completed", text: this.plugin.i18n.translate("views.stats.filters.completedOnly") });

		const taskList = tasksSection.createDiv({ cls: "stats-view__task-list" });

		// Function to render filtered tasks
		const renderTasks = (filterStatus = "all") => {
			taskList.empty();

			let filteredTasks = data.tasks;
			if (filterStatus === "active") {
				filteredTasks = data.tasks.filter(
					(task) => !this.plugin.statusManager.isCompletedStatus(task.status)
				);
			} else if (filterStatus === "completed") {
				filteredTasks = data.tasks.filter((task) =>
					this.plugin.statusManager.isCompletedStatus(task.status)
				);
			}

			// Sort tasks: incomplete first, then by last activity
			filteredTasks.sort((a, b) => {
				const aCompleted = this.plugin.statusManager.isCompletedStatus(a.status);
				const bCompleted = this.plugin.statusManager.isCompletedStatus(b.status);

				if (aCompleted !== bCompleted) {
					return aCompleted ? 1 : -1; // Incomplete tasks first
				}

				// Sort by last activity (time entries or modification date)
				const getLastActivity = (task: TaskInfo): number => {
					if (task.timeEntries?.length) {
						return Math.max(
							...task.timeEntries.map((e) => new Date(e.startTime).getTime())
						);
					}
					return task.dateModified ? new Date(task.dateModified).getTime() : 0;
				};

				return getLastActivity(b) - getLastActivity(a);
			});

			if (filteredTasks.length === 0) {
				taskList.createDiv({ cls: "stats-view__no-data", text: this.plugin.i18n.translate("views.stats.noTasks") });
				return;
			}

			// Show task count
			const countEl = taskList.createDiv({ cls: "stats-view__task-count" });
			countEl.textContent = `Showing ${filteredTasks.length} task${filteredTasks.length !== 1 ? "s" : ""}`;

			for (const task of filteredTasks) {
				// Create TaskCard with checkbox disabled as requested
				const visibleProperties = this.plugin.settings.defaultVisibleProperties
					? convertInternalToUserProperties(this.plugin.settings.defaultVisibleProperties, this.plugin)
					: undefined;
				const taskCard = createTaskCard(
					task,
					this.plugin,
					visibleProperties
				);

				taskList.appendChild(taskCard);
			}
		};

		// Initial render
		renderTasks("all");

		// Add filter event listener
		this.registerDomEvent(statusFilter, "change", () => {
			renderTasks(statusFilter.value);
		});
	}

	/**
	 * Render activity chart using simple bars
	 */
	private renderActivityChart(container: HTMLElement, timeByDay: TimeByDay[]) {
		container.empty();

		if (timeByDay.length === 0) return;

		const maxTime = Math.max(...timeByDay.map((d) => d.timeSpent));
		if (maxTime === 0) {
			container.createDiv({ cls: "stats-view__no-data", text: "No time tracking data" });
			return;
		}

		const chartContainer = container.createDiv({ cls: "stats-view__bar-chart" });

		for (const day of timeByDay) {
			const barContainer = chartContainer.createDiv({ cls: "stats-view__bar-container" });

			const bar = barContainer.createDiv({ cls: "stats-view__bar" });
			const height = (day.timeSpent / maxTime) * 40; // Max 40px height
			bar.style.height = `${height}px`;

			// Tooltip
			const tooltip = `${format(new Date(day.date), "MMM d")}: ${Math.round(day.timeSpent)}m`;
			bar.setAttribute("title", tooltip);
		}
	}
}
