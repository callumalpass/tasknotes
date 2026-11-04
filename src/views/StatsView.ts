import { uiDuration, formatUIDate } from "../i18n/formatters";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { ItemView, WorkspaceLeaf, Setting, EventRef, parseLinktext } from "obsidian";
import {
	format,
	startOfWeek,
	endOfWeek,
	startOfMonth,
	endOfMonth,
	startOfDay,
	endOfDay,
	subDays,
} from "date-fns";
import type { Day } from "date-fns";
import TaskNotesPlugin from "../main";
import { STATS_VIEW_TYPE, TaskInfo, EVENT_TASK_UPDATED } from "../types";
import { calculateTotalTimeSpent } from "../utils/helpers";
import { getTodayLocal } from "../utils/dateUtils";
import { renderDrilldownContent } from "./stats/drilldown";
import { getProjectDisplayName, parseLinkToPath } from "../utils/linkUtils";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

import { createDefaultStatsFilters, normalizeStatsFilters, filterStatsVisibleTasks, getVisibleStatsProjectNames, STATS_FILTERS_STORAGE_KEY } from "./stats/model";
import type { StatsFilters, ProjectStats, OverallStats, TimeRangeStats, ProjectDrilldownData, TimeByDay, TrendDataPoint } from "./stats/model";
import { renderProgressCircle, renderSparkline } from "./stats/charts";
import { renderOverviewStats, renderTimeRangeStats } from "./stats/summary";
export { normalizeStatsFilters, filterStatsVisibleTasks, getVisibleStatsProjectNames } from "./stats/model";
export type { StatsFilters, VisibleStatsProjectNamesOptions } from "./stats/model";

const tasknotesLogger = createTaskNotesLogger({ tag: "Views/StatsView" });

function isDay(value: number): value is Day {
	return Number.isInteger(value) && value >= 0 && value <= 6;
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
	private currentFilters: StatsFilters = createDefaultStatsFilters();
	private drilldownModal: HTMLElement | null = null;
	private currentDrilldownData: ProjectDrilldownData | null = null;
	private listeners: EventRef[] = [];

	// Performance optimizations
	private statsCache = new Map<string, TaskInfo[]>();
	private lastCacheTime = 0;
	private readonly CACHE_DURATION = 60000; // 1 minute
	private debounceTimeout: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return STATS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.plugin.i18n.translate(msg({ message: "Statistics", context: "views.stats.title" }));
	}

	getIcon(): string {
		return "bar-chart-4";
	}

	async onOpen() {
		await this.plugin.onReady();
		this.currentFilters = this.loadPersistedFilters();

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

	private loadPersistedFilters(): StatsFilters {
		try {
			const stored = this.plugin.app.loadLocalStorage(STATS_FILTERS_STORAGE_KEY);
			if (typeof stored !== "string" || stored.length === 0) {
				return createDefaultStatsFilters();
			}
			return normalizeStatsFilters(JSON.parse(stored));
		} catch (error) {
			tasknotesLogger.warn("[TaskNotes] Failed to load Stats view filters:", {
				category: "persistence",
				operation: "load-stats-view-filters",
				error: error,
			});
			return createDefaultStatsFilters();
		}
	}

	private savePersistedFilters(): void {
		try {
			this.plugin.app.saveLocalStorage(
				STATS_FILTERS_STORAGE_KEY,
				JSON.stringify(this.currentFilters)
			);
		} catch (error) {
			tasknotesLogger.warn("[TaskNotes] Failed to save Stats view filters:", {
				category: "persistence",
				operation: "save-stats-view-filters",
				error: error,
			});
		}
	}

	async render() {
		const container = this.contentEl.createDiv({
			cls: "tasknotes-plugin tasknotes-container stats-container stats-view",
		});

		// Header
		const header = container.createDiv({ cls: "stats-header stats-view__header" });
		new Setting(header)
			.setName(this.plugin.i18n.translate(msg({ message: "Task & project statistics", context: "views.stats.taskProjectStats" })))
			.setHeading();

		// Refresh button
		const refreshButton = header.createEl("button", {
			cls: "stats-refresh-button stats-view__refresh-button",
			text: this.plugin.i18n.translate(msg({ message: "Refresh", context: "views.stats.refreshButton" })),
		});
		this.registerDomEvent(refreshButton, "click", () => {
			void this.refreshStats();
		});

		// Filters section
		const filtersSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(filtersSection)
			.setName(this.plugin.i18n.translate(msg({ message: "Filters", context: "views.stats.sections.filters" })))
			.setHeading();
		this.filtersEl = filtersSection.createDiv({ cls: "stats-filters stats-view__filters" });
		this.renderFilters();

		// Overview section
		const overviewSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(overviewSection)
			.setName(this.plugin.i18n.translate(msg({ message: "Overview", context: "views.stats.sections.overview" })))
			.setHeading();
		this.overviewStatsEl = overviewSection.createDiv({
			cls: "stats-overview-grid stats-view__overview-grid",
		});

		// Today's stats
		const todaySection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(todaySection)
			.setName(this.plugin.i18n.translate(msg({ message: "Today", context: "views.stats.sections.today" })))
			.setHeading();
		this.todayStatsEl = todaySection.createDiv({ cls: "stats-grid stats-view__stats-grid" });

		// This week's stats
		const weekSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(weekSection)
			.setName(this.plugin.i18n.translate(msg({ message: "This week", context: "views.stats.sections.thisWeek" })))
			.setHeading();
		this.weekStatsEl = weekSection.createDiv({ cls: "stats-grid stats-view__stats-grid" });

		// This month's stats
		const monthSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(monthSection)
			.setName(this.plugin.i18n.translate(msg({ message: "This month", context: "views.stats.sections.thisMonth" })))
			.setHeading();
		this.monthStatsEl = monthSection.createDiv({ cls: "stats-grid stats-view__stats-grid" });

		// Project breakdown
		const projectsSection = container.createDiv({ cls: "stats-section stats-view__section" });
		new Setting(projectsSection)
			.setName(this.plugin.i18n.translate(msg({ message: "Project breakdown", context: "views.stats.sections.projectBreakdown" })))
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
						tasknotesLogger.warn(`Failed to update ${sections[index]} stats:`, {
							category: "validation",
							operation: "update",
							details: { value: result.reason },
						});
					}
				});
			}
		} catch {
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
			} catch {
				// Failed to get task info - continue silently
			}
		}

		tasks = filterStatsVisibleTasks(tasks);

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

		renderOverviewStats(this.plugin, this.overviewStatsEl, overallStats);
	}

	private async updateTodayStats() {
		if (!this.todayStatsEl) return;

		const todayLocal = getTodayLocal();
		const stats = await this.calculateStatsForRange(
			startOfDay(todayLocal),
			endOfDay(todayLocal)
		);

		renderTimeRangeStats(this.plugin, this.todayStatsEl, stats);
	}

	private async updateWeekStats() {
		if (!this.weekStatsEl) return;

		const todayLocal = getTodayLocal();
		const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
		const weekStartsOn = isDay(firstDaySetting) ? firstDaySetting : 0;
		const weekStartOptions: { weekStartsOn: Day } = { weekStartsOn };
		const weekStart = startOfWeek(todayLocal, weekStartOptions);
		const weekEnd = endOfWeek(todayLocal, weekStartOptions);

		const stats = await this.calculateStatsForRange(weekStart, weekEnd);
		renderTimeRangeStats(this.plugin, this.weekStatsEl, stats);
	}

	private async updateMonthStats() {
		if (!this.monthStatsEl) return;

		const todayLocal = getTodayLocal();
		const monthStart = startOfMonth(todayLocal);
		const monthEnd = endOfMonth(todayLocal);

		const stats = await this.calculateStatsForRange(monthStart, monthEnd);
		renderTimeRangeStats(this.plugin, this.monthStatsEl, stats);
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
	private consolidateProjectName(projectValue: string, sourcePath = ""): string {
		if (!projectValue || typeof projectValue !== "string") {
			return projectValue;
		}

		const displayName = getProjectDisplayName(projectValue, this.plugin?.app, sourcePath);
		if (displayName && displayName !== projectValue) {
			return displayName;
		}

		// For wikilink format, try to resolve to actual file
		if (projectValue.startsWith("[[") && projectValue.endsWith("]]")) {
			const linkPath = this.extractWikilinkPath(projectValue);
			if (linkPath && this.plugin?.app) {
				const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
					linkPath,
					sourcePath
				);
				if (resolvedFile) {
					// Return the file basename as the canonical name
					return resolvedFile.basename;
				}

				// If file doesn't exist, extract clean name from path
				const cleanName = this.extractProjectName(projectValue, sourcePath);
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
	private extractProjectName(projectValue: string, sourcePath = ""): string | null {
		if (!projectValue) return null;
		const displayName = getProjectDisplayName(projectValue, this.plugin?.app, sourcePath);
		return displayName || null;
	}

	private isArchivedProjectReference(projectValue: string, sourcePath = ""): boolean {
		return this.getProjectReferenceTask(projectValue, sourcePath)?.archived === true;
	}

	private getProjectReferenceTask(projectValue: string, sourcePath = ""): TaskInfo | null {
		const trimmedProject = projectValue.trim();
		if (!this.isProjectNoteReference(trimmedProject)) {
			return null;
		}

		const parsedPath = parseLinkToPath(trimmedProject);
		if (!parsedPath) {
			return null;
		}

		const pathWithoutExtension = parsedPath.replace(/\.md$/i, "");
		const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
			pathWithoutExtension,
			sourcePath
		);
		if (resolvedFile) {
			const resolvedTask = this.plugin.cacheManager.getCachedTaskInfoSync(resolvedFile.path);
			if (resolvedTask) {
				return resolvedTask;
			}
		}

		const candidatePaths = /\.md$/i.test(parsedPath)
			? [parsedPath]
			: [parsedPath, `${parsedPath}.md`];
		for (const candidatePath of candidatePaths) {
			const task = this.plugin.cacheManager.getCachedTaskInfoSync(candidatePath);
			if (task) {
				return task;
			}
		}

		return null;
	}

	private isProjectNoteReference(projectValue: string): boolean {
		return (
			(projectValue.startsWith("[[") && projectValue.endsWith("]]")) ||
			/^\[[^\]]*\]\(.+\)$/.test(projectValue) ||
			(projectValue.startsWith("<") && projectValue.endsWith(">")) ||
			projectValue.includes("/") ||
			/\.md$/i.test(projectValue)
		);
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
		const noProjectLabel = this.plugin.i18n.translate(msg({ message: "No project", context: "views.stats.noProject" }));
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
		dateRangeLabel.textContent = this.plugin.i18n.translate(msg({ message: "Date range", context: "views.stats.sections.dateRange" }));

		const dateRangeSelect = dateRangeContainer.createEl("select", {
			cls: "stats-view__filter-select",
		});
		const dateOptions = [
			{ value: "all", text: this.plugin.i18n.translate(msg({ message: "All time", context: "views.stats.timeRanges.allTime" })) },
			{
				value: "7days",
				text: this.plugin.i18n.translate(msg({ message: "Last 7 days", context: "views.stats.timeRanges.last7Days" })),
			},
			{
				value: "30days",
				text: this.plugin.i18n.translate(msg({ message: "Last 30 days", context: "views.stats.timeRanges.last30Days" })),
			},
			{
				value: "90days",
				text: this.plugin.i18n.translate(msg({ message: "Last 90 days", context: "views.stats.timeRanges.last90Days" })),
			},
			{
				value: "custom",
				text: this.plugin.i18n.translate(msg({ message: "Custom range", context: "views.stats.timeRanges.customRange" })),
			},
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
			void this.applyFilters();
		});

		// Custom date inputs container
		const customDatesContainer = filterGrid.createDiv({ cls: "stats-view__custom-dates" });
		if (this.currentFilters.dateRange === "custom") {
			this.renderCustomDateInputs(customDatesContainer);
		}

		// Minimum time filter
		const minTimeContainer = filterGrid.createDiv({ cls: "stats-view__filter-item" });
		const minTimeLabel = minTimeContainer.createDiv({ cls: "stats-view__filter-label" });
		minTimeLabel.textContent = this.plugin.i18n.translate(msg({ message: "Min time (minutes)", context: "views.stats.filters.minTime" }));

		const minTimeInput = minTimeContainer.createEl("input", {
			cls: "stats-view__filter-input",
			type: "number",
			value: this.currentFilters.minTimeSpent.toString(),
			placeholder: "0",
		});

		this.registerDomEvent(minTimeInput, "input", () => {
			this.currentFilters.minTimeSpent = parseInt(minTimeInput.value) || 0;
			void this.applyFilters();
		});

		// Apply/Reset buttons
		const buttonsContainer = filterGrid.createDiv({ cls: "stats-view__filter-buttons" });

		const resetButton = buttonsContainer.createEl("button", {
			cls: "stats-view__filter-button stats-view__filter-button--reset",
			text: this.plugin.i18n.translate(msg({ message: "Reset filters", context: "views.stats.resetFiltersButton" })),
		});

		this.registerDomEvent(resetButton, "click", () => {
			this.currentFilters = createDefaultStatsFilters();
			this.renderFilters();
			void this.applyFilters();
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
			startDateContainer.createDiv({
				cls: "stats-view__date-label",
				text: this.plugin.i18n.translate(msg({ message: "From", context: "views.stats.dateRangeFrom" })),
			});
			const startInput = startDateContainer.createEl("input", {
				cls: "stats-view__date-input",
				type: "date",
				value: this.currentFilters.customStartDate || "",
			});

			const endDateContainer = customDatesContainer.createDiv({
				cls: "stats-view__date-input-container",
			});
			endDateContainer.createDiv({
				cls: "stats-view__date-label",
				text: this.plugin.i18n.translate(msg({ message: "To", context: "views.stats.dateRangeTo" })),
			});
			const endInput = endDateContainer.createEl("input", {
				cls: "stats-view__date-input",
				type: "date",
				value: this.currentFilters.customEndDate || "",
			});

			this.registerDomEvent(startInput, "change", () => {
				this.currentFilters.customStartDate = startInput.value;
				void this.applyFilters();
			});

			this.registerDomEvent(endInput, "change", () => {
				this.currentFilters.customEndDate = endInput.value;
				void this.applyFilters();
			});
		}
	}

	/**
	 * Apply current filters and refresh statistics with debouncing
	 */
	private async applyFilters() {
		this.savePersistedFilters();

		if (this.debounceTimeout) {
			window.clearTimeout(this.debounceTimeout);
		}

		this.debounceTimeout = window.setTimeout(() => {
			void (async () => {
				await this.refreshStats();
				this.debounceTimeout = null;
			})();
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
			return getVisibleStatsProjectNames(task.projects, {
				noProjectLabel: this.plugin.i18n.translate(msg({ message: "No project", context: "views.stats.noProject" })),
				consolidateProjectName: (project) => this.consolidateProjectName(project, task.path),
				isArchivedProjectReference: (project) =>
					this.isArchivedProjectReference(project, task.path),
			});
		} catch {
			return [this.plugin.i18n.translate(msg({ message: "No project", context: "views.stats.noProject" }))];
		}
	}

	/**
	 * Get date range based on current filters
	 */
	private getFilterDateRange(): { start?: Date; end?: Date } {
		const todayLocal = getTodayLocal();

		switch (this.currentFilters.dateRange) {
			case "7days":
				return {
					start: startOfDay(subDays(todayLocal, 7)),
					end: endOfDay(todayLocal),
				};
			case "30days":
				return {
					start: startOfDay(subDays(todayLocal, 30)),
					end: endOfDay(todayLocal),
				};
			case "90days":
				return {
					start: startOfDay(subDays(todayLocal, 90)),
					end: endOfDay(todayLocal),
				};
			case "custom":
				return {
					start: this.currentFilters.customStartDate
						? new Date(`${this.currentFilters.customStartDate}T00:00:00`)
						: undefined,
					end: this.currentFilters.customEndDate
						? new Date(`${this.currentFilters.customEndDate}T23:59:59.999`)
						: undefined,
				};
			case "all":
			default:
				return {};
		}
	}

	private async renderProjectStats(container: HTMLElement, projects: ProjectStats[]) {
		container.empty();

		if (projects.length === 0) {
			container.createDiv({
				cls: "stats-no-data stats-view__no-data",
				text: this.plugin.i18n.translate(msg({ message: "No project data available", context: "views.stats.noProjectData" })),
			});
			return;
		}

		const formatTime = (minutes: number): string => uiDuration(Math.round(minutes));

		const formatDate = (dateString?: string): string => {
			if (!dateString) return this.plugin.i18n.translate(msg({ message: "N/A", context: "views.stats.notAvailable" }));
			try {
				const date = new Date(dateString);
				return formatUIDate(date, "MMM d, yyyy");
			} catch {
				return this.plugin.i18n.translate(msg({ message: "N/A", context: "views.stats.notAvailable" }));
			}
		};

		for (const project of projects) {
			const projectClasses = [
				"stats-project-item",
				"stats-view__project-item",
				"stats-view__project-item--clickable",
			];

			// Add special class for "No Project" items
			if (project.projectName === this.plugin.i18n.translate(msg({ message: "No project", context: "views.stats.noProject" }))) {
				projectClasses.push("stats-view__project-item--no-project");
			}

			const projectEl = container.createDiv({
				cls: projectClasses.join(" "),
			});

			// Make project clickable for drill-down
			this.registerDomEvent(projectEl, "click", () => {
				void this.openProjectDrilldown(project.projectName);
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
			renderProgressCircle(
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
					timeBarFill.classList.remove(
						"tn-static-background-color-var-background-mo-94b219f0",
						"tn-static-background-color-var-background-se-9087a23e",
						"tn-static-background-color-var-color-red-134bc721",
						"tn-static-background-color-var-text-accent-a954c70f"
					);
					timeBarFill.classList.add(
						"tn-static-background-color-var-color-base-40-ef5f175e"
					);
					// Use a neutral color
				}

				timeBarFill.style.width = `${Math.min(timePercentage, 100)}%`;
				if (timePercentage > 100) {
					timeBarFill.classList.remove(
						"tn-static-background-color-var-background-mo-94b219f0",
						"tn-static-background-color-var-background-se-9087a23e",
						"tn-static-background-color-var-color-base-40-ef5f175e",
						"tn-static-background-color-var-text-accent-a954c70f"
					);
					timeBarFill.classList.add("tn-static-background-color-var-color-red-134bc721");
					// Over budget
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
				activityEl.textContent = uiText(msg({ message: "Last activity: {value1}", context: "views/StatsView: StatsView.renderProjectStats display" }), { value1: formatDate(project.lastActivity) });
			}

			if (project.avgTimePerTask > 0) {
				const avgEl = statsEl.createDiv({ cls: "project-stat stats-view__project-stat" });
				avgEl.textContent = uiText(msg({ message: "Avg: {value1}/task", context: "views/StatsView: StatsView.renderProjectStats display" }), { value1: formatTime(project.avgTimePerTask) });
			}

			// Add sparkline trend (load asynchronously)
			const trendContainer = statsContainer.createDiv({ cls: "stats-view__trend-container" });
			const sparklineEl = trendContainer.createDiv({ cls: "stats-view__sparkline" });

			// Load trend data synchronously for now - we can optimize later
			try {
				const trendData = await this.calculateProjectTrend(project.projectName);
				if (trendData.length > 0 && trendData.some((d) => d.value > 0)) {
					renderSparkline(sparklineEl, trendData);
				} else {
					trendContainer.remove();
				}
			} catch {
				// Error loading trend data - remove container
				trendContainer.remove();
			}
		}
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
					if (task && !task.archived) {
						const taskProjects = this.getTaskProjects(task);
						if (taskProjects.includes(projectName)) {
							projectTasks.push(task);
						}
					}
				} catch {
					// Failed to get task info - continue silently
				}
			}

			// Calculate daily time spent over last 30 days
			const trendData: TrendDataPoint[] = [];
			const todayLocal = getTodayLocal();

			for (let i = 29; i >= 0; i--) {
				const date = subDays(todayLocal, i);
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
		} catch {
			// Error calculating project trend
			return [];
		}
	}

	/**
	 * Render SVG sparkline
	 */

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
		title.textContent = uiText(msg({ message: "{projectName} - Detailed View", context: "views/StatsView: StatsView.openProjectDrilldown display" }), { projectName: projectName });

		const closeBtn = header.createEl("button", {
			cls: "stats-view__modal-close",
			text: "×",
		});

		// Modal content
		const content = modal.createDiv({ cls: "stats-view__modal-content" });
		content.textContent = this.plugin.i18n.translate(msg({ message: "Loading...", context: "views.stats.loading" }));

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
			renderDrilldownContent(this, this.plugin, content, drilldownData);
		} catch (error) {
			tasknotesLogger.error("Error loading drill-down data:", {
				category: "persistence",
				operation: "loading-drill-down-data",
				error: error,
			});
			content.textContent = this.plugin.i18n.translate(msg({ message: "Error loading project details.", context: "notices.statsLoadingFailed" }));
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
			renderDrilldownContent(this, this.plugin, modalContent as HTMLElement, updatedData);
		} catch (error) {
			tasknotesLogger.error("Error refreshing drill-down modal:", {
				category: "stale-data",
				operation: "refreshing-drill-down-modal",
				error: error,
			});
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
				if (task && !task.archived) {
					const taskProjects = this.getTaskProjects(task);
					if (taskProjects.includes(projectName)) {
						projectTasks.push(task);
					}
				}
			} catch (error) {
				tasknotesLogger.error(`Failed to get task for drill-down: ${path}`, {
					category: "persistence",
					operation: "get-task-drill-down",
					error: error,
				});
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
		const todayLocal = getTodayLocal();

		for (let i = 29; i >= 0; i--) {
			const date = subDays(todayLocal, i);
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

	/**
	 * Render activity chart using simple bars
	 */
}
