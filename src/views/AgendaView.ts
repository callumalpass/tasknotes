import {
	AGENDA_VIEW_TYPE,
	EVENT_DATA_CHANGED,
	EVENT_DATE_CHANGED,
	EVENT_DATE_SELECTED,
	EVENT_TASK_UPDATED,
	FilterQuery,
	NoteInfo,
	SavedView,
	TaskInfo,
} from "../types";
import {
	EventRef,
	ItemView,
	Notice,
	Setting,
	TFile,
	WorkspaceLeaf,
	setIcon,
	ButtonComponent,
} from "obsidian";
import { addDays, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import {
	convertUTCToLocalCalendarDate,
	createUTCDateFromLocalCalendarDate,
	formatDateForStorage,
	getTodayLocal,
	isTodayUTC,
} from "../utils/dateUtils";
import { createICSEventCard, updateICSEventCard } from "../ui/ICSCard";
import { createTaskCard, refreshParentTaskSubtasks, updateTaskCard } from "../ui/TaskCard";
import {
	initializeViewPerformance,
	cleanupViewPerformance,
	shouldRefreshForDateBasedView,
	OptimizedView,
} from "../utils/viewOptimizations";

import { FilterBar } from "../ui/FilterBar";
import { FilterHeading } from "../ui/FilterHeading";
import { FilterService } from "../services/FilterService";
import { GroupCountUtils } from "../utils/GroupCountUtils";
import { GroupingUtils } from "../utils/GroupingUtils";
import { HierarchicalGroupingService } from "../services/HierarchicalGroupingService";
import TaskNotesPlugin from "../main";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";

import { createNoteCard } from "../ui/NoteCard";
import { TranslationKey } from "../i18n";

// No helper functions needed from helpers

export class AgendaView extends ItemView implements OptimizedView {
	plugin: TaskNotesPlugin;

	// Performance optimization properties
	viewPerformanceService?: import("../services/ViewPerformanceService").ViewPerformanceService;
	performanceConfig?: import("../services/ViewPerformanceService").ViewPerformanceConfig;
	private taskElements = new Map<string, HTMLElement>();

	// View settings
	private daysToShow = 7;
	private groupByDate = true;
	private startDate: Date;
	private showOverdueOnToday = true;
	private showNotes = true;
	private showICSEvents = true;

	// Filter system
	private filterBar: FilterBar | null = null;
	private filterHeading: FilterHeading | null = null;
	private currentQuery: FilterQuery;

	// Event listeners
	private listeners: EventRef[] = [];
	private functionListeners: (() => void)[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.startDate = new Date(plugin.selectedDate);

		// Initialize with default query - will be properly set when plugin services are ready
		this.currentQuery = {
			type: "group",
			id: "temp",
			conjunction: "and",
			children: [],
			sortKey: "scheduled",
			sortDirection: "asc",
			groupKey: "none", // Agenda groups by date internally
		};

		// Register event listeners
		this.registerEvents();
	}

	private translate(key: TranslationKey, vars?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, vars);
	}

	private getLocale(): string {
		const locale = this.plugin.i18n.getCurrentLocale();
		if (!locale || locale === "") {
			return "en";
		}
		if (locale === "en") {
			return "en-US";
		}
		return locale;
	}

	private formatDateLocalized(date: Date, options: Intl.DateTimeFormatOptions): string {
		return new Intl.DateTimeFormat(this.getLocale(), options).format(date);
	}

	private formatWeekday(date: Date): string {
		const weekdayKeys: TranslationKey[] = [
			"common.weekdays.sunday",
			"common.weekdays.monday",
			"common.weekdays.tuesday",
			"common.weekdays.wednesday",
			"common.weekdays.thursday",
			"common.weekdays.friday",
			"common.weekdays.saturday",
		];
		return this.translate(weekdayKeys[date.getDay()]);
	}
	registerEvents(): void {
		// Clean up any existing listeners
		this.listeners.forEach((listener) => this.plugin.emitter.offref(listener));
		this.listeners = [];
		this.functionListeners.forEach((unsubscribe) => unsubscribe());
		this.functionListeners = [];

		// Listen for data changes
		const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, async () => {
			this.refresh();
			// Update FilterBar options when data changes (new properties, contexts, etc.)
			if (this.filterBar) {
				const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
				this.filterBar.updateFilterOptions(updatedFilterOptions);
			}
		});
		this.listeners.push(dataListener);

		// Listen for date changes to refresh recurring task states
		const dateChangeListener = this.plugin.emitter.on(EVENT_DATE_CHANGED, async () => {
			this.refresh();
		});
		this.listeners.push(dateChangeListener);

		// Listen for date selection changes
		const dateListener = this.plugin.emitter.on(EVENT_DATE_SELECTED, (date: Date) => {
			this.startDate = new Date(date);
			this.updatePeriodDisplay();
			this.refresh();
		});
		this.listeners.push(dateListener);

		// Performance optimization: Use ViewPerformanceService instead of direct task listeners
		// The service will handle debouncing and selective updates

		// Listen for filter service data changes
		const filterDataListener = this.plugin.filterService.on("data-changed", () => {
			this.refresh();
		});
		this.functionListeners.push(filterDataListener);

		// Listen for ICS subscription updates
		if (this.plugin.icsSubscriptionService) {
			const icsListener = this.plugin.icsSubscriptionService.on("data-changed", () => {
				this.refresh();
			});
			this.functionListeners.push(icsListener);
		}
	}

	getViewType(): string {
		return AGENDA_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.plugin.i18n.translate("views.agenda.title");
	}

	getIcon(): string {
		return "calendar-clock";
	}

	async onOpen() {
		// Wait for the plugin to be fully initialized before proceeding
		await this.plugin.onReady();

		// Wait for migration to complete before initializing UI
		await this.plugin.waitForMigration();

		// Load saved filter state
		const savedQuery = this.plugin.viewStateManager.getFilterState(AGENDA_VIEW_TYPE);
		if (savedQuery) {
			this.currentQuery = savedQuery;
		}

		const contentEl = this.contentEl;
		contentEl.empty();

		// Add container
		const container = contentEl.createDiv({ cls: "tasknotes-plugin agenda-view" });

		// Show loading indicator
		this.showLoadingIndicator();

		// Render the view
		await this.renderView(container);

		// Hide loading indicator
		this.hideLoadingIndicator();

		// Initialize performance optimizations
		initializeViewPerformance(this, {
			viewId: AGENDA_VIEW_TYPE,
			debounceDelay: 150, // Slightly longer delay for agenda since it's more complex
			maxBatchSize: 3, // Lower batch size since agenda items can move between days
			changeDetectionEnabled: true,
		});

		// Register keyboard navigation
	}

	async onClose() {
		// Clean up performance optimizations
		cleanupViewPerformance(this);

		// Remove event listeners
		this.listeners.forEach((listener) => this.plugin.emitter.offref(listener));
		this.functionListeners.forEach((unsubscribe) => unsubscribe());

		// Clean up FilterBar
		if (this.filterBar) {
			this.filterBar.destroy();
			this.filterBar = null;
		}

		// Clean up FilterHeading
		if (this.filterHeading) {
			this.filterHeading.destroy();
			this.filterHeading = null;
		}

		// Clean up task elements tracking
		this.taskElements.clear();

		// Clean up
		this.contentEl.empty();
	}

	private async renderView(container: HTMLElement) {
		// Clear existing content
		container.empty();

		// Create controls
		await this.createAgendaControls(container);

		// Create agenda content
		await this.renderAgendaContent(container);
	}

	private async createAgendaControls(container: HTMLElement) {
		const controlsContainer = container.createDiv({ cls: "agenda-view__controls" });

		// Header section with date range and navigation (like tasks view)
		const headerSection = controlsContainer.createDiv({ cls: "agenda-view__header" });

		const headerContent = headerSection.createDiv({ cls: "agenda-view__header-content" });

		// Left section: Navigation controls
		const navSection = headerContent.createDiv({ cls: "agenda-view__nav-section" });

		const prevButton = navSection.createEl("button", {
			cls: "agenda-view__nav-button agenda-view__nav-button--prev",
			text: "‹",
			attr: {
				"aria-label": this.translate("views.agenda.actions.previousPeriod"),
				title: this.translate("views.agenda.actions.previousPeriod"),
			},
		});
		prevButton.addClass("clickable-icon");

		const nextButton = navSection.createEl("button", {
			cls: "agenda-view__nav-button agenda-view__nav-button--next",
			text: "›",
			attr: {
				"aria-label": this.translate("views.agenda.actions.nextPeriod"),
				title: this.translate("views.agenda.actions.nextPeriod"),
			},
		});
		nextButton.addClass("clickable-icon");

		// Center section: Current period display
		const titleSection = headerContent.createDiv({ cls: "agenda-view__title-section" });
		titleSection.createDiv({
			cls: "agenda-view__period-title",
			text: this.getCurrentPeriodText(),
		});

		// Right section: Today button
		const actionsSection = headerContent.createDiv({ cls: "agenda-view__actions-section" });

		prevButton.addEventListener("click", () => {
			this.navigateToPreviousPeriod();
		});

		nextButton.addEventListener("click", () => {
			this.navigateToNextPeriod();
		});

		// Today button
		const todayButton = actionsSection.createEl("button", {
			text: this.translate("views.agenda.today"),
			cls: "agenda-view__today-button",
			attr: {
				"aria-label": this.translate("views.agenda.actions.goToToday"),
				title: this.translate("views.agenda.actions.goToToday"),
			},
		});
		todayButton.addClass("clickable-icon");

		todayButton.addEventListener("click", () => {
			const today = getTodayLocal();
			this.startDate = today;
			this.plugin.setSelectedDate(today);
			this.updatePeriodDisplay();
			this.refresh();
		});

		// Refresh ICS button (always show; handle availability on click)
		const refreshBtn = actionsSection.createEl("button", {
			text: this.translate("views.agenda.refreshCalendars"),
			cls: "agenda-view__today-button",
			attr: {
				"aria-label": this.translate("views.agenda.actions.refreshCalendars"),
				title: this.translate("views.agenda.actions.refreshCalendars"),
			},
		});
		refreshBtn.addClass("clickable-icon");
		refreshBtn.addEventListener("click", async () => {
			if (!this.plugin.icsSubscriptionService) {
				new Notice(this.plugin.i18n.translate("views.agenda.notices.calendarNotReady"));
				return;
			}
			try {
				await this.plugin.icsSubscriptionService.refreshAllSubscriptions();
				new Notice(this.plugin.i18n.translate("views.agenda.notices.calendarRefreshed"));
				this.refresh();
			} catch (e) {
				console.error("Failed to refresh ICS subscriptions", e);
				new Notice(this.plugin.i18n.translate("views.agenda.notices.refreshFailed"));
			}
		});

		// FilterBar section (like tasks view)
		const filterBarContainer = controlsContainer.createDiv({
			cls: "agenda-view__filter-container",
		});

		// Wait for cache to be initialized with actual data
		await this.waitForCacheReady();

		// Initialize with default query from FilterService
		this.currentQuery = this.plugin.filterService.createDefaultQuery();
		this.currentQuery.sortKey = "scheduled";
		this.currentQuery.sortDirection = "asc";
		this.currentQuery.groupKey = "none";

		// Load saved filter state if it exists
		const savedQuery = this.plugin.viewStateManager.getFilterState(AGENDA_VIEW_TYPE);
		if (savedQuery) {
			this.currentQuery = savedQuery;
		}

		// Get filter options from FilterService
		const filterOptions = await this.plugin.filterService.getFilterOptions();

		// Create new FilterBar
		this.filterBar = new FilterBar(
			this.app,
			this.plugin,
			filterBarContainer,
			this.currentQuery,
			filterOptions,
			this.plugin.settings.viewsButtonAlignment || "right",
			{ enableGroupExpandCollapse: false, forceShowExpandCollapse: false, viewType: "agenda" }
		);

		// Get saved views for the FilterBar
		const savedViews = this.plugin.viewStateManager.getSavedViews();
		this.filterBar.updateSavedViews(savedViews);

		// Listen for saved view events
		this.filterBar.on("saveView", ({ name, query, viewOptions, visibleProperties }) => {
			const savedView = this.plugin.viewStateManager.saveView(
				name,
				query,
				viewOptions,
				visibleProperties
			);
			// Set the newly saved view as active to prevent incorrect view matching
			this.filterBar!.setActiveSavedView(savedView);
		});

		this.filterBar.on("deleteView", (viewId: string) => {
			this.plugin.viewStateManager.deleteView(viewId);
			// Don't update here - the ViewStateManager event will handle it
		});

		// Listen for view options load events
		this.filterBar.on("loadViewOptions", (viewOptions: { [key: string]: boolean }) => {
			this.applyViewOptions(viewOptions);
		});

		// Listen for global saved views changes
		this.plugin.viewStateManager.on(
			"saved-views-changed",
			(updatedViews: readonly SavedView[]) => {
				this.filterBar?.updateSavedViews(updatedViews);
			}
		);

		this.filterBar.on("reorderViews", (fromIndex: number, toIndex: number) => {
			this.plugin.viewStateManager.reorderSavedViews(fromIndex, toIndex);
		});

		this.filterBar.on("manageViews", () => {
			console.log("Manage views requested");
		});

		// Listen for filter changes
		this.filterBar.on("queryChange", async (newQuery: FilterQuery) => {
			this.currentQuery = newQuery;
			// Save the filter state (but always update date range based on current view)
			const queryToSave = newQuery;
			this.plugin.viewStateManager.setFilterState(AGENDA_VIEW_TYPE, queryToSave);
			this.refresh();
		});

		// Update heading immediately when a saved view is selected
		this.filterBar.on("activeSavedViewChanged", () => {
			this.updateFilterHeading();
		});

		// Listen for properties changes
		this.filterBar.on("propertiesChanged", (properties: string[]) => {
			// Refresh the task display with new properties
			this.refresh();
		});

		// Wire expand/collapse all to day sections to match TaskListView behavior
		this.filterBar.on("expandAllGroups", () => {
			// Expand all visible day sections
			const sections = this.contentEl.querySelectorAll(
				".agenda-view__day-section.task-group"
			);
			sections.forEach((section) => {
				const el = section as HTMLElement;
				el.classList.remove("is-collapsed");
				const items = el.querySelector(".agenda-view__day-items") as HTMLElement | null;
				if (items) items.style.display = "";
				const toggle = el.querySelector(".task-group-toggle") as HTMLElement | null;
				if (toggle) toggle.setAttr("aria-expanded", "true");
			});
			// Persist: clear collapsedDays
			const prefs =
				this.plugin.viewStateManager.getViewPreferences<any>(AGENDA_VIEW_TYPE) || {};
			const next = { ...prefs, collapsedDays: {} };
			this.plugin.viewStateManager.setViewPreferences(AGENDA_VIEW_TYPE, next);
		});
		this.filterBar.on("collapseAllGroups", () => {
			// Collapse all visible day sections
			const collapsed: Record<string, boolean> = {};
			const sections = this.contentEl.querySelectorAll(
				".agenda-view__day-section.task-group"
			);
			sections.forEach((section) => {
				const el = section as HTMLElement;
				const dayKey = el.dataset.day;
				if (dayKey) collapsed[dayKey] = true;
				el.classList.add("is-collapsed");
				const items = el.querySelector(".agenda-view__day-items") as HTMLElement | null;
				if (items) items.style.display = "none";
				const toggle = el.querySelector(".task-group-toggle") as HTMLElement | null;
				if (toggle) toggle.setAttr("aria-expanded", "false");
			});
			// Persist: set all days collapsed
			const prefs =
				this.plugin.viewStateManager.getViewPreferences<any>(AGENDA_VIEW_TYPE) || {};
			const next = { ...prefs, collapsedDays: collapsed };
			this.plugin.viewStateManager.setViewPreferences(AGENDA_VIEW_TYPE, next);
		});

		// Create filter heading with integrated controls
		this.filterHeading = new FilterHeading(container, this.plugin);

		// Add expand/collapse controls to the heading container
		const headingContainer = container.querySelector(".filter-heading") as HTMLElement;
		if (headingContainer) {
			const headingContent = headingContainer.querySelector(
				".filter-heading__content"
			) as HTMLElement;
			if (headingContent) {
				// Add controls to the right side of the heading
				const controlsContainer = headingContent.createDiv({
					cls: "filter-heading__controls",
				});
				this.createExpandCollapseButtons(controlsContainer);
			}
		}

		// Initialize heading immediately
		this.updateFilterHeading();

		// Set up view-specific options
		this.setupViewOptions();
	}

	/**
	 * Create expand/collapse buttons for day sections
	 */
	private createExpandCollapseButtons(container: HTMLElement): void {
		// Always show controls for agenda view (unlike task list which is conditional)
		container.style.display = "flex";
		container.empty();

		// Expand all button
		const expandAllBtn = new ButtonComponent(container)
			.setIcon("list-tree")
			.setTooltip(this.plugin.i18n.translate("views.agenda.expandAllDays"))
			.setClass("agenda-view-control-button")
			.onClick(() => {
				// Expand all visible day sections
				const sections = this.contentEl.querySelectorAll(
					".agenda-view__day-section.task-group"
				);
				sections.forEach((section) => {
					const el = section as HTMLElement;
					el.classList.remove("is-collapsed");
					const items = el.querySelector(".agenda-view__day-items") as HTMLElement | null;
					if (items) items.style.display = "";
					const toggle = el.querySelector(".task-group-toggle") as HTMLElement | null;
					if (toggle) toggle.setAttr("aria-expanded", "true");
				});
				// Persist: clear collapsedDays
				const prefs =
					this.plugin.viewStateManager.getViewPreferences<any>(AGENDA_VIEW_TYPE) || {};
				const next = { ...prefs, collapsedDays: {} };
				this.plugin.viewStateManager.setViewPreferences(AGENDA_VIEW_TYPE, next);
			});
		expandAllBtn.buttonEl.addClass("clickable-icon");

		// Collapse all button
		const collapseAllBtn = new ButtonComponent(container)
			.setIcon("list-collapse")
			.setTooltip(this.plugin.i18n.translate("views.agenda.collapseAllDays"))
			.setClass("agenda-view-control-button")
			.onClick(() => {
				// Collapse all visible day sections
				const collapsed: Record<string, boolean> = {};
				const sections = this.contentEl.querySelectorAll(
					".agenda-view__day-section.task-group"
				);
				sections.forEach((section) => {
					const el = section as HTMLElement;
					const dayKey = el.dataset.day;
					if (dayKey) collapsed[dayKey] = true;
					el.classList.add("is-collapsed");
					const items = el.querySelector(".agenda-view__day-items") as HTMLElement | null;
					if (items) items.style.display = "none";
					const toggle = el.querySelector(".task-group-toggle") as HTMLElement | null;
					if (toggle) toggle.setAttr("aria-expanded", "false");
				});
				// Persist: set all days collapsed
				const prefs =
					this.plugin.viewStateManager.getViewPreferences<any>(AGENDA_VIEW_TYPE) || {};
				const next = { ...prefs, collapsedDays: collapsed };
				this.plugin.viewStateManager.setViewPreferences(AGENDA_VIEW_TYPE, next);
			});
		collapseAllBtn.buttonEl.addClass("clickable-icon");
	}

	/**
	 * Set up view-specific options for the FilterBar
	 */
	private setupViewOptions(): void {
		if (!this.filterBar) return;

		const options = [
			{
				id: "showOverdueOnToday",
				label: "Show overdue section",
				value: this.showOverdueOnToday,
				onChange: (value: boolean) => {
					this.showOverdueOnToday = value;
					this.refresh();
				},
			},
			{
				id: "showNotes",
				label: "Show notes",
				value: this.showNotes,
				onChange: (value: boolean) => {
					this.showNotes = value;
					this.refresh();
				},
			},
			{
				id: "icsEvents",
				label: "Calendar subscriptions",
				value: this.showICSEvents,
				onChange: (value: boolean) => {
					this.showICSEvents = value;
					this.refresh();
				},
			},
		];

		this.filterBar.setViewOptions(options);
	}

	/**
	 * Apply view options from a loaded saved view
	 */
	private applyViewOptions(viewOptions: { [key: string]: boolean }): void {
		// Apply the loaded view options to the internal state
		if (viewOptions.hasOwnProperty("showOverdueOnToday")) {
			this.showOverdueOnToday = viewOptions.showOverdueOnToday;
		}
		if (viewOptions.hasOwnProperty("showNotes")) {
			this.showNotes = viewOptions.showNotes;
		}
		// Be robust to both key styles
		if (viewOptions.hasOwnProperty("icsEvents")) {
			this.showICSEvents = (viewOptions as any).icsEvents;
		}
		if (viewOptions.hasOwnProperty("showICSEvents")) {
			this.showICSEvents = (viewOptions as any).showICSEvents;
		}

		// Update the view options in the FilterBar to reflect the loaded state
		this.setupViewOptions();

		// Refresh the view to apply the changes
		this.refresh();
	}

	/**
	 * Render period selector as custom button in FilterBar
	 */
	private renderPeriodSelector(container: HTMLElement): void {
		const periodSelect = container.createEl("select", { cls: "agenda-view__period-select" });
		const periods = [
			{ value: "7", text: "7 days" },
			{ value: "14", text: "14 days" },
			{ value: "30", text: "30 days" },
			{ value: "week", text: "This week" },
		];

		periods.forEach((period) => {
			const option = periodSelect.createEl("option", {
				value: period.value,
				text: period.text,
			});
			if (
				(period.value === "7" && this.daysToShow === 7) ||
				(period.value === "week" && this.daysToShow === -1)
			) {
				option.selected = true;
			}
		});

		periodSelect.addEventListener("change", () => {
			const value = periodSelect.value;
			if (value === "week") {
				this.daysToShow = -1; // Special value for week view
			} else {
				this.daysToShow = parseInt(value);
			}

			// Date range is handled internally by getAgendaDates()

			this.refresh();
		});
	}

	/**
	 * Get date range for FilterService query
	 */
	private getDateRange(): { start: string; end: string } {
		const dates = this.getAgendaDates();
		return FilterService.createDateRangeFromDates(dates);
	}

	/**
	 * Add notes to agenda data by fetching notes for each specific date
	 */
	private async addNotesToAgendaData(
		agendaData: Array<{ date: Date; tasks: TaskInfo[] }>
	): Promise<Array<{ date: Date; tasks: TaskInfo[]; notes: NoteInfo[] }>> {
		if (this.plugin.settings.disableNoteIndexing || !this.showNotes) {
			return agendaData.map((dayData) => ({ ...dayData, notes: [] }));
		}

		// Use Promise.all to fetch notes for all dates in parallel for optimal performance
		const notesPromises = agendaData.map(async (dayData) => {
			const notesForDate = await this.plugin.cacheManager.getNotesForDate(dayData.date);
			return { ...dayData, notes: notesForDate };
		});

		return Promise.all(notesPromises);
	}

	private async renderAgendaContent(container: HTMLElement) {
		// Find existing content container or create new one
		let contentContainer = container.querySelector(".agenda-view__content") as HTMLElement;
		if (!contentContainer) {
			contentContainer = container.createDiv({ cls: "agenda-view__content" });
		}

		try {
			const dates = this.getAgendaDates();

			// Use the new enhanced agenda data method
			const { dailyData, overdueTasks } = await this.plugin.filterService.getAgendaDataWithOverdue(
				dates,
				this.currentQuery,
				this.showOverdueOnToday
			);

			// Process daily data and add ICS events
			const agendaData: Array<{
				date: Date;
				tasks: TaskInfo[];
				ics: import("../types").ICSEvent[];
			}> = [];

			for (const dayData of dailyData) {
				// Collect ICS events for this date
				let icsForDate: import("../types").ICSEvent[] = [];
				if (this.showICSEvents && this.plugin.icsSubscriptionService) {
					const allIcs = this.plugin.icsSubscriptionService.getAllEvents();
					icsForDate = this.filterICSEventsForDate(allIcs, dayData.date);
				}

				agendaData.push({
					date: dayData.date,
					tasks: dayData.tasks,
					ics: icsForDate
				});
			}

			// Get notes separately and add them to the agenda data
			const agendaDataWithNotes = await this.addNotesToAgendaData(
				agendaData.map((d) => ({ date: d.date, tasks: d.tasks }))
			);
			// Merge ICS back into enriched data
			const merged = agendaDataWithNotes.map((d, i) => ({ ...d, ics: agendaData[i].ics }));

			// Use DOMReconciler-based rendering
			if (this.groupByDate) {
				this.renderGroupedAgendaWithReconciler(contentContainer, merged, overdueTasks);
			} else {
				this.renderFlatAgendaWithReconciler(contentContainer, merged, overdueTasks);
			}
		} catch (error) {
			console.error("Error rendering agenda content:", error);
			contentContainer.empty();
			const errorEl = contentContainer.createDiv({ cls: "agenda-view__error" });
			errorEl.createSpan({ text: "Error loading agenda. Please try refreshing." });
		}
	}

	private filterICSEventsForDate(
		events: import("../types").ICSEvent[],
		utcAnchoredDate: Date
	): import("../types").ICSEvent[] {
		try {
			// Convert UTC-anchored date to local calendar date, then compute start/end of that day
			const localDate = convertUTCToLocalCalendarDate(utcAnchoredDate);
			const dayStart = new Date(
				localDate.getFullYear(),
				localDate.getMonth(),
				localDate.getDate(),
				0,
				0,
				0,
				0
			);
			const dayEnd = new Date(
				localDate.getFullYear(),
				localDate.getMonth(),
				localDate.getDate(),
				23,
				59,
				59,
				999
			);
			return events.filter((ev) => {
				const evStart = new Date(ev.start);
				const evEnd = ev.end ? new Date(ev.end) : null;
				if (evEnd) {
					// All-day events use exclusive DTEND; subtract a millisecond so the
					// final day is inclusive without spilling into the next one.
					const effectiveEnd = ev.allDay ? new Date(evEnd.getTime() - 1) : evEnd;
					// Overlaps if start <= dayEnd and effective end >= dayStart
					return evStart <= dayEnd && effectiveEnd >= dayStart;
				}
				// No end: occurs on day if start between start and end of day
				return evStart >= dayStart && evStart <= dayEnd;
			});
		} catch {
			return [];
		}
	}

	/**
	 * Render grouped agenda using DOMReconciler for efficient updates
	 */
	private renderGroupedAgendaWithReconciler(
		container: HTMLElement,
		agendaData: Array<{
			date: Date;
			tasks: TaskInfo[];
			notes: NoteInfo[];
			ics: import("../types").ICSEvent[];
		}>,
		overdueTasks: TaskInfo[] = []
	) {
		// Clear container and task elements tracking
		container.empty();
		this.taskElements.clear();

		let hasAnyItems = false;

		// Render overdue section if there are overdue tasks
		if (overdueTasks.length > 0) {
			hasAnyItems = true;
			const overdueKey = "overdue";
			const collapsedInitially = this.isDayCollapsed(overdueKey);

			// Create overdue section (like task groups)
			const overdueSection = container.createDiv({
				cls: "agenda-view__day-section task-group agenda-view__overdue-section",
			});
			overdueSection.setAttribute("data-day", overdueKey);

			// Create overdue header
			const overdueHeader = this.createOverdueHeader(overdueTasks, overdueKey);
			overdueSection.appendChild(overdueHeader);

			// Create items container
			const itemsContainer = overdueSection.createDiv({ cls: "agenda-view__day-items" });

			// Apply initial collapsed state
			if (collapsedInitially) {
				overdueSection.addClass("is-collapsed");
				itemsContainer.style.display = "none";
			}

			// Add click handlers for collapse/expand
			this.addDayHeaderClickHandlers(overdueHeader, overdueSection, itemsContainer, overdueKey);

			// Render overdue tasks
			const overdueItems: Array<{ type: "task"; item: TaskInfo; date: Date }> = [];
			overdueTasks.forEach((task) => {
				// Use a placeholder date for overdue tasks (they don't have a specific agenda date)
				overdueItems.push({ type: "task", item: task, date: new Date() });
			});

			// Use DOMReconciler for overdue tasks
			this.plugin.domReconciler.updateList(
				itemsContainer,
				overdueItems,
				(item) => `task-${item.item.path}`,
				(item) => this.createTaskItemElement(item.item, undefined),
				(element, item) => this.updateDayItemElement(element, item)
			);
		}
		agendaData.forEach((dayData) => {
			const dateStr = formatDateForStorage(dayData.date);

			// Tasks are already filtered by FilterService, no need to re-filter
			const hasItems =
				dayData.tasks.length > 0 ||
				dayData.notes.length > 0 ||
				(this.showICSEvents && dayData.ics.length > 0);

			if (hasItems) {
				hasAnyItems = true;
				const dayKey = dateStr;
				const collapsedInitially = this.isDayCollapsed(dayKey);

				// Create day section (like task groups)
				const daySection = container.createDiv({
					cls: "agenda-view__day-section task-group",
				});
				daySection.setAttribute("data-day", dayKey);

				// Create day header
				const dayHeader = this.createDayHeader(dayData, dayKey);
				daySection.appendChild(dayHeader);

				// Create items container
				const itemsContainer = daySection.createDiv({ cls: "agenda-view__day-items" });

				// Apply initial collapsed state
				if (collapsedInitially) {
					daySection.addClass("is-collapsed");
					itemsContainer.style.display = "none";
				}

				// Add click handlers for collapse/expand
				this.addDayHeaderClickHandlers(dayHeader, daySection, itemsContainer, dayKey);

				// Determine subgrouping state for this day
				const subgroupKey = (this.currentQuery as any)?.subgroupKey;
				const hasSubgroups =
					subgroupKey && subgroupKey !== "none" && dayData.tasks.length > 0;

				// Collect items for this day (tasks go here only when no subgroups)
				const dayItems: Array<{ type: "task" | "note" | "ics"; item: any; date: Date }> =
					[];

				if (!hasSubgroups) {
					// Flat tasks list when no subgroups are active
					dayData.tasks.forEach((task) => {
						dayItems.push({ type: "task", item: task, date: dayData.date });
					});
				} else {
					// Render task subgroups (like TaskListView)
					const subgroupsContainer = itemsContainer.createDiv({
						cls: "task-subgroups-container",
					});
					const subgroups = this.computeSubgroupsForDay(dayData.tasks, subgroupKey);
					const visibleProperties = this.getCurrentVisibleProperties();

					for (const [subgroupName, subgroupTasks] of subgroups) {
						const subgroupSection = subgroupsContainer.createDiv({
							cls: "task-subgroup",
						});
						subgroupSection.setAttribute("data-subgroup", subgroupName);

						const header = subgroupSection.createDiv({ cls: "task-subgroup-header" });
						const toggleBtn = header.createEl("button", {
							cls: "task-subgroup-toggle",
							attr: { "aria-label": "Toggle subgroup" },
						});
						try {
							setIcon(toggleBtn, "chevron-right");
						} catch {
							/* ignore */
						}
						const svg = toggleBtn.querySelector("svg");
						if (svg) {
							svg.classList.add("chevron");
							svg.setAttr("width", "16");
							svg.setAttr("height", "16");
						} else {
							toggleBtn.textContent = "▸";
						}

						// Format subgroup name to match TaskListView exactly
						const formattedSubgroupName = this.formatSubgroupName(subgroupName);

						header.createSpan({
							cls: "task-subgroup-name",
							text: formattedSubgroupName,
						});

						// Count badge for tasks in subgroup
						const stats = GroupCountUtils.calculateGroupStats(
							subgroupTasks,
							this.plugin
						);
						const countText = GroupCountUtils.formatGroupCount(
							stats.completed,
							stats.total
						).text;
						header.createDiv({ cls: "agenda-view__item-count", text: countText });

						// Content list
						const listEl = subgroupSection.createDiv({ cls: "task-cards" });

						// Initial collapsed state from preferences
						const collapsedSubInitially = GroupingUtils.isSubgroupCollapsed(
							AGENDA_VIEW_TYPE,
							subgroupKey,
							dayKey,
							subgroupName,
							this.plugin
						);
						if (collapsedSubInitially) {
							subgroupSection.addClass("is-collapsed");
							listEl.style.display = "none";
						}
						toggleBtn.setAttr("aria-expanded", String(!collapsedSubInitially));

						// Click handlers to toggle subgroup
						this.registerDomEvent(header, "click", (e: MouseEvent) => {
							const target = e.target as HTMLElement;
							if (target.closest("a")) return;
							const willCollapse = !subgroupSection.hasClass("is-collapsed");
							GroupingUtils.setSubgroupCollapsed(
								AGENDA_VIEW_TYPE,
								subgroupKey,
								dayKey,
								subgroupName,
								willCollapse,
								this.plugin
							);
							subgroupSection.toggleClass("is-collapsed", willCollapse);
							listEl.style.display = willCollapse ? "none" : "";
							toggleBtn.setAttr("aria-expanded", String(!willCollapse));
						});
						this.registerDomEvent(toggleBtn, "click", (e: MouseEvent) => {
							e.preventDefault();
							e.stopPropagation();
							const willCollapse = !subgroupSection.hasClass("is-collapsed");
							GroupingUtils.setSubgroupCollapsed(
								AGENDA_VIEW_TYPE,
								subgroupKey,
								dayKey,
								subgroupName,
								willCollapse,
								this.plugin
							);
							subgroupSection.toggleClass("is-collapsed", willCollapse);
							listEl.style.display = willCollapse ? "none" : "";
							toggleBtn.setAttr("aria-expanded", String(!willCollapse));
						});

						// Render tasks in subgroup
						this.plugin.domReconciler.updateList(
							listEl,
							subgroupTasks,
							(t) => `task-${t.path}`,
							(t) => this.createTaskItemElement(t, dayData.date),
							(el, t) =>
								updateTaskCard(el, t, this.plugin, visibleProperties, {
									showDueDate: !this.groupByDate,
									showCheckbox: false,
									showTimeTracking: true,
									showRecurringControls: true,
									groupByDate: this.groupByDate,
									targetDate: dayData.date,
								})
						);
					}
				}

				// Notes and ICS (always below tasks/subgroups)
				dayData.notes.forEach((note) => {
					dayItems.push({ type: "note", item: note, date: dayData.date });
				});

				// Add ICS events (sorted chronologically)
				if (this.showICSEvents) {
					// Sort ICS events by start time before adding them
					const sortedIcsEvents = [...dayData.ics].sort((a, b) => {
						try {
							const timeA = new Date(a.start).getTime();
							const timeB = new Date(b.start).getTime();
							return timeA - timeB;
						} catch {
							return 0;
						}
					});

					sortedIcsEvents.forEach((ics) => {
						dayItems.push({ type: "ics", item: ics, date: dayData.date });
					});
				}

				// Use DOMReconciler for this day's items
				// prevents the reconciler from wiping out the subgroup DOM
				const listTarget = hasSubgroups
					? itemsContainer.createDiv({ cls: "agenda-view__misc-items" })
					: itemsContainer;
				this.plugin.domReconciler.updateList(
					listTarget,
					dayItems,
					(item) =>
						`${item.type}-${(item.item as any).path || (item.item as any).id || "unknown"}`,
					(item) => this.createDayItemElement(item),
					(element, item) => this.updateDayItemElement(element, item)
				);
			}
		});

		if (!hasAnyItems) {
			container.empty();
			const emptyMessage = container.createDiv({ cls: "agenda-view__empty" });
			new Setting(emptyMessage)
				.setName(this.plugin.i18n.translate("views.agenda.empty.noItemsScheduled"))
				.setHeading();
			emptyMessage.createEl("p", {
				text: "No items scheduled for this period.",
				cls: "agenda-view__empty-description",
			});
			const tipMessage = emptyMessage.createEl("p", { cls: "agenda-view__empty-tip" });
			tipMessage.createEl("span", { text: "Tip: " });
			tipMessage.appendChild(
				document.createTextNode(
					"Create tasks with due or scheduled dates, or add notes to see them here."
				)
			);
			return;
		}
	}

	/**
	 * Render flat agenda using DOMReconciler for efficient updates
	 */
	private renderFlatAgendaWithReconciler(
		container: HTMLElement,
		agendaData: Array<{
			date: Date;
			tasks: TaskInfo[];
			notes: NoteInfo[];
			ics: import("../types").ICSEvent[];
		}>,
		overdueTasks: TaskInfo[] = []
	) {
		// Clear task elements tracking
		this.taskElements.clear();

		// Collect all items with their dates
		const allItems: Array<{
			type: "task" | "note" | "ics";
			item: TaskInfo | NoteInfo | import("../types").ICSEvent;
			date: Date;
		}> = [];

		// Add overdue tasks first (they will appear at the top)
		overdueTasks.forEach((task) => {
			// Use a very early date for overdue tasks so they appear first when sorted
			allItems.push({ type: "task", item: task, date: new Date(0) });
		});

		agendaData.forEach((dayData) => {
			// Tasks are already filtered by FilterService, no need to re-filter
			dayData.tasks.forEach((task) => {
				allItems.push({ type: "task", item: task, date: dayData.date });
			});

			dayData.notes.forEach((note) => {
				allItems.push({ type: "note", item: note, date: dayData.date });
			});

			// ICS events (sorted chronologically)
			if (this.showICSEvents) {
				// Sort ICS events by start time before adding them
				const sortedIcsEvents = [...dayData.ics].sort((a, b) => {
					try {
						const timeA = new Date(a.start).getTime();
						const timeB = new Date(b.start).getTime();
						return timeA - timeB;
					} catch {
						return 0;
					}
				});

				sortedIcsEvents.forEach((ics) => {
					allItems.push({ type: "ics", item: ics, date: dayData.date });
				});
			}
		});

		if (allItems.length === 0) {
			container.empty();
			const emptyMessage = container.createDiv({ cls: "agenda-view__empty" });
			new Setting(emptyMessage)
				.setName(this.plugin.i18n.translate("views.agenda.empty.noItemsFound"))
				.setHeading();
			emptyMessage.createEl("p", {
				text: "No items found for the selected period.",
				cls: "agenda-view__empty-description",
			});
			return;
		}

		// Sort by date
		allItems.sort((a, b) => a.date.getTime() - b.date.getTime());

		// Use DOMReconciler to update the list
		this.plugin.domReconciler.updateList(
			container,
			allItems,
			(item) =>
				`${item.type}-${(item.item as any).path || (item.item as any).id || "unknown"}`,
			(item) => this.createFlatAgendaItemElement(item),
			(element, item) => this.updateFlatAgendaItemElement(element, item)
		);
	}

	/**
	 * Create agenda item element for reconciler
	 */
	private createAgendaItemElement(item: {
		type: "day-header" | "task" | "note" | "ics";
		item: any;
		date: Date;
		dayKey: string;
	}): HTMLElement {
		if (item.type === "day-header") {
			const dayHeader = document.createElement("div");
			dayHeader.className = "agenda-view__day-header task-group-header";
			dayHeader.setAttribute("data-day", item.dayKey);

			// Create toggle button first (consistent with TaskList view)
			const toggleBtn = dayHeader.createEl("button", {
				cls: "task-group-toggle",
				attr: { "aria-label": "Toggle day" },
			});
			try {
				setIcon(toggleBtn, "chevron-right");
			} catch (_) {
				// Ignore icon loading errors
			}
			const svg = toggleBtn.querySelector("svg");
			if (svg) {
				svg.classList.add("chevron");
				svg.setAttr("width", "16");
				svg.setAttr("height", "16");
			} else {
				toggleBtn.textContent = "▸";
				toggleBtn.addClass("chevron-text");
			}

			const headerText = dayHeader.createDiv({ cls: "agenda-view__day-header-text" });
			// FIX: Convert UTC-anchored date to local calendar date for proper display formatting
			const displayDate = convertUTCToLocalCalendarDate(item.date);
			const dayName = format(displayDate, "EEEE");
			const dateFormatted = format(displayDate, "MMMM d");

			if (isTodayUTC(item.date)) {
				headerText.createSpan({
					cls: "agenda-view__day-name agenda-view__day-name--today",
					text: this.plugin.i18n.translate("views.agenda.today"),
				});
				headerText.createSpan({
					cls: "agenda-view__day-date",
					text: ` • ${dateFormatted}`,
				});
			} else {
				headerText.createSpan({ cls: "agenda-view__day-name", text: dayName });
				headerText.createSpan({
					cls: "agenda-view__day-date",
					text: ` • ${dateFormatted}`,
				});
			}

			// Item count badge - show completion count for tasks only
			const tasks = item.item.tasks || [];
			let countText: string;

			if (tasks.length > 0) {
				// Show completion count for tasks
				const taskStats = GroupCountUtils.calculateGroupStats(tasks, this.plugin);
				countText = GroupCountUtils.formatGroupCount(
					taskStats.completed,
					taskStats.total
				).text;
			} else {
				// Show total count for other items (notes + ICS events)
				const itemCount = (item.item.notes?.length || 0) + (item.item.ics?.length || 0);
				countText = `${itemCount}`;
			}

			dayHeader.createDiv({ cls: "agenda-view__item-count", text: countText });

			return dayHeader;
		} else if (item.type === "task") {
			return this.createTaskItemElement(item.item as TaskInfo, item.date);
		} else {
			if (item.type === "note") {
				return this.createNoteItemElement(item.item as NoteInfo, item.date);
			}
			return this.createICSEventItemElement(item.item as import("../types").ICSEvent);
		}
	}

	/**
	 * Update agenda item element for reconciler
	 */
	private updateAgendaItemElement(
		element: HTMLElement,
		item: {
			type: "day-header" | "task" | "note" | "ics";
			item: any;
			date: Date;
			dayKey: string;
		}
	): void {
		if (item.type === "day-header") {
			// Update item count badge - show completion count for tasks only
			const countBadge = element.querySelector(".agenda-view__item-count");
			if (countBadge) {
				const tasks = item.item.tasks || [];
				let countText: string;

				if (tasks.length > 0) {
					// Show completion count for tasks
					const taskStats = GroupCountUtils.calculateGroupStats(tasks, this.plugin);
					countText = GroupCountUtils.formatGroupCount(
						taskStats.completed,
						taskStats.total
					).text;
				} else {
					// Show total count for other items (notes + ICS events)
					const itemCount = (item.item.notes?.length || 0) + (item.item.ics?.length || 0);
					countText = `${itemCount}`;
				}

				countBadge.textContent = countText;
			}
		} else if (item.type === "task") {
			const visibleProperties = this.getCurrentVisibleProperties();
			updateTaskCard(element, item.item as TaskInfo, this.plugin, visibleProperties, {
				showDueDate: !this.groupByDate,
				showCheckbox: false,
				showTimeTracking: true,
				showRecurringControls: true,
				groupByDate: this.groupByDate,
				targetDate: item.date,
			});
		} else if (item.type === "ics") {
			updateICSEventCard(element, item.item as import("../types").ICSEvent, this.plugin);
		}
		// Note updates are handled automatically by the note card structure
	}

	/**
	 * Create flat agenda item element for reconciler
	 */
	private createFlatAgendaItemElement(item: {
		type: "task" | "note" | "ics";
		item: TaskInfo | NoteInfo | import("../types").ICSEvent;
		date: Date;
	}): HTMLElement {
		if (item.type === "task")
			return this.createTaskItemElement(item.item as TaskInfo, item.date);
		if (item.type === "note")
			return this.createNoteItemElement(item.item as NoteInfo, item.date);
		return this.createICSEventItemElement(item.item as import("../types").ICSEvent);
	}

	/**
	 * Update flat agenda item element for reconciler
	 */
	private updateFlatAgendaItemElement(
		element: HTMLElement,
		item: {
			type: "task" | "note" | "ics";
			item: TaskInfo | NoteInfo | import("../types").ICSEvent;
			date: Date;
		}
	): void {
		if (item.type === "task") {
			const visibleProperties = this.getCurrentVisibleProperties();
			updateTaskCard(element, item.item as TaskInfo, this.plugin, visibleProperties, {
				showDueDate: !this.groupByDate,
				showCheckbox: false,
				showTimeTracking: true,
				showRecurringControls: true,
				groupByDate: this.groupByDate,
				targetDate: item.date,
			});
		} else if (item.type === "ics") {
			updateICSEventCard(element, item.item as import("../types").ICSEvent, this.plugin);
		}
		// Note updates are handled automatically by the note card structure
	}

	/**
	 * Get current visible properties for task cards
	 */
	private getCurrentVisibleProperties(): string[] | undefined {
		// Use the FilterBar's method which handles temporary state
		return this.filterBar?.getCurrentVisibleProperties();
	}

	/**
	 * Create task item element
	 */
	private createTaskItemElement(task: TaskInfo, date?: Date): HTMLElement {
		const visibleProperties = this.getCurrentVisibleProperties();

		const taskCard = createTaskCard(task, this.plugin, visibleProperties, {
			showDueDate: !this.groupByDate,
			showCheckbox: false,
			showTimeTracking: true,
			showRecurringControls: true,
			groupByDate: this.groupByDate,
			targetDate: date,
		});

		// Track task element for selective updates
		if (task.path) {
			// For recurring tasks, include the date in the key to avoid conflicts between instances
			const elementKey =
				task.recurrence && date ? `${task.path}:${formatDateForStorage(date)}` : task.path;
			this.taskElements.set(elementKey, taskCard);
		}

		// TaskCard handles its own completion styling with proper effective status

		// Add drag functionality
		this.addDragHandlers(taskCard, task);

		return taskCard;
	}

	/**
	 * Create note item element
	 */
	private createNoteItemElement(note: NoteInfo, date?: Date): HTMLElement {
		const noteCard = createNoteCard(note, this.plugin, {
			showCreatedDate: false,
			showTags: true,
			showPath: false,
			maxTags: 3,
			showDailyNoteBadge: false,
		});

		// Add date if not grouping by date
		if (!this.groupByDate && date) {
			// FIX: Convert UTC-anchored date to local calendar date for proper display formatting
			const displayDate = convertUTCToLocalCalendarDate(date);
			noteCard.createSpan({
				cls: "agenda-view__note-date",
				text: format(displayDate, "MMM d"),
			});
		}

		return noteCard;
	}

	/**
	 * Create ICS event item element
	 */
	private createICSEventItemElement(icsEvent: import("../types").ICSEvent): HTMLElement {
		const icsCard = createICSEventCard(icsEvent, this.plugin, {});
		return icsCard;
	}

	/**
	 * Add drag handlers to task cards for dragging to calendar
	 */
	private addDragHandlers(card: HTMLElement, task: TaskInfo): void {
		// Use the centralized drag drop manager for FullCalendar compatibility
		this.plugin.dragDropManager.makeTaskCardDraggable(card, task.path);
	}

	private addHoverPreview(element: HTMLElement, filePath: string) {
		element.addEventListener("mouseover", (event) => {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file) {
				this.app.workspace.trigger("hover-link", {
					event,
					source: "tasknotes-agenda",
					hoverParent: this,
					targetEl: element,
					linktext: filePath,
					sourcePath: filePath,
				});
			}
		});
	}

	private openFile(path: string) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	private getAgendaDates(): Date[] {
		const dates: Date[] = [];

		if (this.daysToShow === -1) {
			// Week view - show current week based on startDate
			const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
			const weekStartOptions = { weekStartsOn: firstDaySetting as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
			const weekStart = startOfWeek(this.startDate, weekStartOptions);
			const weekEnd = endOfWeek(this.startDate, weekStartOptions);

			let currentDate = weekStart;
			while (currentDate <= weekEnd) {
				// Create UTC date that represents this calendar date
				const normalizedDate = createUTCDateFromLocalCalendarDate(currentDate);
				dates.push(normalizedDate);
				currentDate = addDays(currentDate, 1);
			}
		} else {
			// Fixed number of days starting from startDate
			for (let i = 0; i < this.daysToShow; i++) {
				const targetDate = addDays(this.startDate, i);
				// Create UTC date that represents this calendar date
				const normalizedDate = createUTCDateFromLocalCalendarDate(targetDate);
				dates.push(normalizedDate);
			}
		}

		return dates;
	}

	private navigateToPreviousPeriod() {
		if (this.daysToShow === -1) {
			// Week view - go to previous week
			this.startDate = addDays(this.startDate, -7);
		} else {
			// Fixed days - go back by the number of days shown
			this.startDate = addDays(this.startDate, -this.daysToShow);
		}

		// Date range is handled internally by getAgendaDates()

		this.updatePeriodDisplay();
		this.refresh();
	}

	private navigateToNextPeriod() {
		if (this.daysToShow === -1) {
			// Week view - go to next week
			this.startDate = addDays(this.startDate, 7);
		} else {
			// Fixed days - go forward by the number of days shown
			this.startDate = addDays(this.startDate, this.daysToShow);
		}

		// Date range is handled internally by getAgendaDates()

		this.updatePeriodDisplay();
		this.refresh();
	}

	private updatePeriodDisplay(): void {
		const currentPeriodDisplay = this.contentEl.querySelector(".agenda-view__period-title");
		if (currentPeriodDisplay) {
			currentPeriodDisplay.textContent = this.getCurrentPeriodText();
		}
	}

	private getCurrentPeriodText(): string {
		const dates = this.getAgendaDates();
		if (dates.length === 0) return "";

		// FIX: Convert UTC-anchored dates to local calendar dates for proper display formatting
		const start = convertUTCToLocalCalendarDate(dates[0]);
		const end = convertUTCToLocalCalendarDate(dates[dates.length - 1]);

		// Use original UTC dates for isSameDay comparison since it's UTC-aware
		if (isSameDay(dates[0], dates[dates.length - 1])) {
			return this.formatDateLocalized(start, {
				weekday: "long",
				month: "long",
				day: "numeric",
				year: "numeric",
			});
		} else {
			const sameYear = start.getFullYear() === end.getFullYear();
			const startLabel = this.formatDateLocalized(
				start,
				sameYear
					? { month: "short", day: "numeric" }
					: { month: "short", day: "numeric", year: "numeric" }
			);
			const endLabel = this.formatDateLocalized(end, {
				month: "short",
				day: "numeric",
				year: "numeric",
			});
			return `${startLabel} - ${endLabel}`;
		}
	}

	private showLoadingIndicator() {
		const container = this.contentEl.querySelector(".agenda-view");
		if (!container || container.querySelector(".agenda-view__loading")) return;

		const indicator = document.createElement("div");
		indicator.className = "agenda-view__loading";
		indicator.textContent = this.translate("views.agenda.loading");
		container.prepend(indicator);
	}

	private hideLoadingIndicator() {
		const indicator = this.contentEl.querySelector(".agenda-view__loading");
		if (indicator) {
			indicator.remove();
		}
	}

	/**
	 * Update the filter heading with current saved view and completion count
	 */
	private async updateFilterHeading(): Promise<void> {
		if (!this.filterHeading || !this.filterBar) return;

		try {
			// Get all agenda data to calculate completion stats using the new method
			const dates = this.getAgendaDates();
			const { dailyData, overdueTasks } = await this.plugin.filterService.getAgendaDataWithOverdue(
				dates,
				this.currentQuery,
				this.showOverdueOnToday
			);

			// Collect all tasks from daily data and overdue tasks
			const allTasks: TaskInfo[] = [];
			dailyData.forEach((dayData) => {
				allTasks.push(...dayData.tasks);
			});
			allTasks.push(...overdueTasks);

			// Calculate completion stats
			const stats = GroupCountUtils.calculateGroupStats(allTasks, this.plugin);

			// Get current saved view from FilterBar
			const activeSavedView = (this.filterBar as any).activeSavedView || null;

			// Update the filter heading
			this.filterHeading.update(activeSavedView, stats.completed, stats.total);
		} catch (error) {
			console.error("Error updating filter heading in AgendaView:", error);
		}
	}

	async refresh() {
		const container = this.contentEl.querySelector(".agenda-view") as HTMLElement;
		if (container) {
			// Re-apply view options to ensure they persist through refreshes
			this.setupViewOptions();
			// Use DOMReconciler for efficient updates
			await this.renderAgendaContent(container);
			// Update filter heading with current data
			this.updateFilterHeading();
		}
	}

	// OptimizedView interface implementation
	shouldRefreshForTask(originalTask: TaskInfo | undefined, updatedTask: TaskInfo): boolean {
		return shouldRefreshForDateBasedView(originalTask, updatedTask);
	}

	async updateForTask(
		taskPath: string,
		operation: "update" | "delete" | "create"
	): Promise<void> {
		// For AgendaView, selective updates are complex due to date-based grouping
		// Tasks can move between days, so we use a simplified approach:
		// For recurring tasks, always do full refresh since they can appear on multiple dates
		// For regular tasks, try selective update if the task is currently visible

		// Check if this is a recurring task by looking at the task info
		const taskInfo = await this.plugin.cacheManager.getTaskInfo(taskPath);
		if (taskInfo?.recurrence) {
			// Recurring tasks: always do full refresh to avoid date-instance conflicts
			await this.refresh();
			return;
		}

		const taskElement = this.taskElements.get(taskPath);

		switch (operation) {
			case "update":
				if (taskElement) {
					const updatedTask = await this.plugin.cacheManager.getTaskInfo(taskPath);
					if (updatedTask) {
						try {
							// Get current visible properties
							const visibleProperties = this.plugin.settings
								.defaultVisibleProperties || ["due", "scheduled"];

							updateTaskCard(
								taskElement,
								updatedTask,
								this.plugin,
								visibleProperties,
								{
									showDueDate: true,
									showCheckbox: false,
									showArchiveButton: true,
									showTimeTracking: true,
								}
							);

							// Update animation
							taskElement.classList.add("task-card--updated");
							window.setTimeout(() => {
								taskElement.classList.remove("task-card--updated");
							}, 1000);

							console.log(`[AgendaView] Selectively updated task: ${taskPath}`);
						} catch (error) {
							console.error("[AgendaView] Error in selective update:", error);
							// Fall back to full refresh
							await this.refresh();
						}
					} else {
						// Task was deleted, remove from tracking and DOM
						taskElement.remove();
						this.taskElements.delete(taskPath);
					}
				} else {
					// Task not currently visible - might need to be added, refresh to be safe
					await this.refresh();
				}
				break;

			case "delete":
				if (taskElement) {
					taskElement.remove();
					this.taskElements.delete(taskPath);
				}
				break;

			case "create":
				// New tasks might appear in any date section, refresh to be safe
				await this.refresh();
				break;
		}
	}

	/**
	 * Create day header element with chevron and click handlers
	 */
	private createDayHeader(
		dayData: {
			date: Date;
			tasks: TaskInfo[];
			notes: NoteInfo[];
			ics: import("../types").ICSEvent[];
		},
		dayKey: string
	): HTMLElement {
		const dayHeader = document.createElement("div");
		dayHeader.className = "agenda-view__day-header task-group-header";
		dayHeader.setAttribute("data-day", dayKey);

		// Create toggle button first (consistent with TaskList view)
		const toggleBtn = dayHeader.createEl("button", {
			cls: "task-group-toggle",
			attr: { "aria-label": this.translate("views.agenda.dayToggle") },
		});
		try {
			setIcon(toggleBtn, "chevron-right");
		} catch (_) {
			// Ignore icon loading errors
		}
		const svg = toggleBtn.querySelector("svg");
		if (svg) {
			svg.classList.add("chevron");
			svg.setAttr("width", "16");
			svg.setAttr("height", "16");
		} else {
			toggleBtn.textContent = "▸";
			toggleBtn.addClass("chevron-text");
		}

		const headerText = dayHeader.createDiv({ cls: "agenda-view__day-header-text" });
		// FIX: Convert UTC-anchored date to local calendar date for proper display formatting
		const displayDate = convertUTCToLocalCalendarDate(dayData.date);
		const dayName = this.formatWeekday(displayDate);
		const dateFormatted = this.formatDateLocalized(displayDate, {
			month: "long",
			day: "numeric",
		});

		if (isTodayUTC(dayData.date)) {
			headerText.createSpan({
				cls: "agenda-view__day-name agenda-view__day-name--today",
				text: this.translate("views.agenda.today"),
			});
			headerText.createSpan({ cls: "agenda-view__day-date", text: ` • ${dateFormatted}` });
		} else {
			headerText.createSpan({ cls: "agenda-view__day-name", text: dayName });
			headerText.createSpan({ cls: "agenda-view__day-date", text: ` • ${dateFormatted}` });
		}

		// Item count badge - show completion count for tasks only
		const tasks = dayData.tasks || [];
		let countText: string;

		if (tasks.length > 0) {
			// Show completion count for tasks
			const taskStats = GroupCountUtils.calculateGroupStats(tasks, this.plugin);
			countText = GroupCountUtils.formatGroupCount(taskStats.completed, taskStats.total).text;
		} else {
			// Show total count for other items (notes + ICS events)
			const itemCount = (dayData.notes?.length || 0) + (dayData.ics?.length || 0);
			countText = `${itemCount}`;
		}

		// Right side container (holds subgroup actions and count, like TaskList)
		const right = dayHeader.createDiv({ cls: "task-group-right" });

		// Right side: subgroup actions (only when a subgroup is active)
		const subgroupKey = (this.currentQuery as any)?.subgroupKey;
		if (subgroupKey && subgroupKey !== "none") {
			const actions = right.createDiv({ cls: "task-subgroup-actions" });

			const expandBtn = actions.createEl("button", {
				cls: "task-subgroup-action",
				attr: { "aria-label": "Expand all subgroups" },
			});
			try {
				setIcon(expandBtn, "list-tree");
			} catch {
				/* ignore */
			}
			this.registerDomEvent(expandBtn, "click", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();
				GroupingUtils.expandAllSubgroups(
					AGENDA_VIEW_TYPE,
					dayKey,
					subgroupKey,
					this.plugin
				);
				const section = dayHeader.parentElement as HTMLElement;
				section?.querySelectorAll(".task-subgroup").forEach((sub: Element) => {
					const el = sub as HTMLElement;
					el.classList.remove("is-collapsed");
					const btn = el.querySelector(".task-subgroup-toggle") as HTMLElement;
					if (btn) btn.setAttr("aria-expanded", "true");
					const content = el.querySelector(".task-cards") as HTMLElement;
					if (content) content.style.display = "";
				});
			});

			const collapseBtn = actions.createEl("button", {
				cls: "task-subgroup-action",
				attr: { "aria-label": "Collapse all subgroups" },
			});
			try {
				setIcon(collapseBtn, "list-collapse");
			} catch {
				/* ignore */
			}
			this.registerDomEvent(collapseBtn, "click", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();
				// Collect subgroup names under this day
				const section = dayHeader.parentElement as HTMLElement;
				const names: string[] = [];
				section?.querySelectorAll(".task-subgroup").forEach((sub: Element) => {
					const name = (sub as HTMLElement).getAttribute("data-subgroup");
					if (name) names.push(name);
				});
				GroupingUtils.collapseAllSubgroups(
					AGENDA_VIEW_TYPE,
					dayKey,
					subgroupKey,
					names,
					this.plugin
				);
				section?.querySelectorAll(".task-subgroup").forEach((sub: Element) => {
					const el = sub as HTMLElement;
					el.classList.add("is-collapsed");
					const btn = el.querySelector(".task-subgroup-toggle") as HTMLElement;
					if (btn) btn.setAttr("aria-expanded", "false");
					const content = el.querySelector(".task-cards") as HTMLElement;
					if (content) content.style.display = "none";
				});
			});
		}

		// Item count badge (keep at the far right, inside right container like TaskList)
		right.createSpan({ cls: "agenda-view__item-count", text: countText });

		// Set initial ARIA state
		const collapsedInitially = this.isDayCollapsed(dayKey);
		toggleBtn.setAttr("aria-expanded", String(!collapsedInitially));

		return dayHeader;
	}

	/**
	 * Create overdue header element with chevron and click handlers
	 */
	private createOverdueHeader(overdueTasks: TaskInfo[], overdueKey: string): HTMLElement {
		const overdueHeader = document.createElement("div");
		overdueHeader.className = "agenda-view__day-header task-group-header";
		overdueHeader.setAttribute("data-day", overdueKey);

		// Create toggle button first (consistent with day headers)
		const toggleBtn = overdueHeader.createEl("button", {
			cls: "task-group-toggle",
			attr: { "aria-label": this.translate("views.agenda.overdueToggle") },
		});
		try {
			setIcon(toggleBtn, "chevron-right");
		} catch (_) {
			// Ignore icon loading errors
		}
		const svg = toggleBtn.querySelector("svg");
		if (svg) {
			svg.classList.add("chevron");
			svg.setAttr("width", "16");
			svg.setAttr("height", "16");
		} else {
			toggleBtn.textContent = "▸";
			toggleBtn.addClass("chevron-text");
		}

		const headerText = overdueHeader.createDiv({ cls: "agenda-view__day-header-text" });
		headerText.createSpan({
			cls: "agenda-view__day-name agenda-view__day-name--overdue",
			text: this.translate("views.agenda.overdue"),
		});

		// Right side container (holds count)
		const right = overdueHeader.createDiv({ cls: "task-group-right" });

		// Task completion count for overdue tasks
		const taskStats = GroupCountUtils.calculateGroupStats(overdueTasks, this.plugin);
		const countText = GroupCountUtils.formatGroupCount(taskStats.completed, taskStats.total).text;

		// Item count badge
		right.createSpan({ cls: "agenda-view__item-count", text: countText });

		// Set initial ARIA state
		const collapsedInitially = this.isDayCollapsed(overdueKey);
		toggleBtn.setAttr("aria-expanded", String(!collapsedInitially));

		return overdueHeader;
	}

	/**
	 * Add click handlers for day header collapse/expand
	 */
	private addDayHeaderClickHandlers(
		dayHeader: HTMLElement,
		daySection: HTMLElement,
		itemsContainer: HTMLElement,
		dayKey: string
	): void {
		const toggleBtn = dayHeader.querySelector(".task-group-toggle") as HTMLElement;

		// Header click handler
		this.registerDomEvent(dayHeader, "click", (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.closest("a")) return; // Ignore link clicks

			const willCollapse = !daySection.hasClass("is-collapsed");
			this.setDayCollapsed(dayKey, willCollapse);
			daySection.toggleClass("is-collapsed", willCollapse);
			itemsContainer.style.display = willCollapse ? "none" : "";
			if (toggleBtn) toggleBtn.setAttr("aria-expanded", String(!willCollapse));
		});

		// Toggle button click handler
		if (toggleBtn) {
			this.registerDomEvent(toggleBtn, "click", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();

				const willCollapse = !daySection.hasClass("is-collapsed");
				this.setDayCollapsed(dayKey, willCollapse);
				daySection.toggleClass("is-collapsed", willCollapse);
				itemsContainer.style.display = willCollapse ? "none" : "";
				toggleBtn.setAttr("aria-expanded", String(!willCollapse));
			});
		}
	}

	/**
	 * Create day item element (task, note, or ICS event)
	 */
	private createDayItemElement(item: {
		type: "task" | "note" | "ics";
		item: any;
		date: Date;
	}): HTMLElement {
		if (item.type === "task") {
			return this.createTaskItemElement(item.item as TaskInfo, item.date);
		} else if (item.type === "note") {
			return this.createNoteItemElement(item.item as NoteInfo, item.date);
		} else {
			return this.createICSEventItemElement(item.item as import("../types").ICSEvent);
		}
	}

	/**
	 * Update day item element
	 */
	private updateDayItemElement(
		element: HTMLElement,
		item: { type: "task" | "note" | "ics"; item: any; date: Date }
	): void {
		if (item.type === "task") {
			const visibleProperties = this.getCurrentVisibleProperties();
			updateTaskCard(element, item.item as TaskInfo, this.plugin, visibleProperties, {
				showDueDate: !this.groupByDate,
				showCheckbox: false,
				showTimeTracking: true,
				showRecurringControls: true,
				groupByDate: this.groupByDate,
				targetDate: item.date,
			});
		} else if (item.type === "ics") {
			updateICSEventCard(element, item.item as import("../types").ICSEvent, this.plugin);
		}
		// Note updates are handled automatically by the note card structure
	}

	/**
	 * Format subgroup name to match TaskListView exactly
	 */
	private formatSubgroupName(groupName: string): string {
		// Use the same formatting logic as TaskListView
		return GroupingUtils.formatGroupName(groupName, this.plugin);
	}

	/**
	 * Compute subgroups for a given day using the same value resolution as HierarchicalGroupingService
	 */
	private computeSubgroupsForDay(
		tasks: TaskInfo[],
		subgroupKey: string
	): Map<string, TaskInfo[]> {
		// Resolver for user fields mirrors FilterService
		const resolver = (task: TaskInfo, fieldIdOrKey: string): string[] => {
			const userFields = this.plugin?.settings?.userFields || [];
			const field = userFields.find(
				(f: any) => (f.id || f.key) === fieldIdOrKey || f.key === fieldIdOrKey
			);
			const missingLabel = `No ${field?.displayName || field?.key || fieldIdOrKey}`;
			if (!field) return [missingLabel];
			try {
				const app = this.plugin.cacheManager.getApp();
				const file = app.vault.getAbstractFileByPath(task.path);
				if (!file) return [missingLabel];
				const fm = app.metadataCache.getFileCache(file as any)?.frontmatter;
				const raw = fm ? fm[field.key] : undefined;
				switch (field.type) {
					case "boolean": {
						if (typeof raw === "boolean") return [raw ? "true" : "false"];
						if (raw == null) return [missingLabel];
						const s = String(raw).trim().toLowerCase();
						if (s === "true" || s === "false") return [s];
						return [missingLabel];
					}
					case "number": {
						if (typeof raw === "number") return [String(raw)];
						if (typeof raw === "string") {
							const match = raw.match(/^(\d+(?:\.\d+)?)/);
							return match ? [match[1]] : [missingLabel];
						}
						return [missingLabel];
					}
					case "date": {
						return raw ? [String(raw)] : [missingLabel];
					}
					case "list": {
						// Mirror FilterService: normalize list values and exclude raw wikilink tokens
						const normalizeUserListValue = (rawVal: any): string[] => {
							const tokens: string[] = [];
							const pushToken = (s: string) => {
								if (!s) return;
								const trimmed = String(s).trim();
								if (!trimmed) return;
								const m = trimmed.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
								if (m) {
									const target = m[1] || "";
									const alias = m[2];
									const base =
										alias || target.split("#")[0].split("/").pop() || target;
									if (base) tokens.push(base);
									tokens.push(trimmed); // keep raw as fallback
									return;
								}
								tokens.push(trimmed);
							};
							if (Array.isArray(rawVal)) {
								for (const v of rawVal) pushToken(String(v));
							} else if (typeof rawVal === "string") {
								const parts = splitListPreservingLinksAndQuotes(rawVal);
								for (const p of parts) pushToken(p);
							} else if (rawVal != null) {
								pushToken(String(rawVal));
							}
							// Deduplicate while preserving order
							const seen = new Set<string>();
							const out: string[] = [];
							for (const t of tokens) {
								if (!seen.has(t)) {
									seen.add(t);
									out.push(t);
								}
							}
							return out;
						};
						const tokens = normalizeUserListValue(raw).filter((t) => !/^\[\[/.test(t));
						return tokens.length > 0 ? tokens : [missingLabel];
					}
					case "text":
					default: {
						const s = String(raw ?? "").trim();
						return s ? [s] : [missingLabel];
					}
				}
			} catch {
				return [missingLabel];
			}
		};

		// Use HierarchicalGroupingService value resolution to ensure parity
		const svc = new HierarchicalGroupingService(resolver);
		// We call group() using the subgroupKey as "primary" and a benign secondary key.
		// Then flatten per primary with de-duplication.
		const hierarchical = svc.group(tasks, subgroupKey as any, "tags" as any);
		const result = new Map<string, TaskInfo[]>();
		for (const [primary, subMap] of hierarchical) {
			const arr: TaskInfo[] = [];
			const seen = new Set<string>();
			for (const tasksArr of subMap.values()) {
				for (const t of tasksArr) {
					if (!seen.has(t.path)) {
						seen.add(t.path);
						arr.push(t);
					}
				}
			}
			result.set(primary, arr);
		}

		// Sort subgroup keys consistently to mirror TaskList behavior
		const sorted = new Map<string, TaskInfo[]>();
		const dir = ((this.currentQuery as any)?.sortDirection as "asc" | "desc") || "asc";

		const sortKeys = (keys: string[], subgroupKeyInner: string): string[] => {
			// Handle dynamic user fields with type-aware sorting
			if (typeof subgroupKeyInner === "string" && subgroupKeyInner.startsWith("user:")) {
				const fieldId = subgroupKeyInner.slice(5);
				const userFields = this.plugin?.settings?.userFields || [];
				const field = userFields.find((f: any) => (f.id || f.key) === fieldId);
				const isMissing = (k: string) => /^No\s/i.test(k);

				const ascCompare = (a: string, b: string) => {
					if (isMissing(a) && !isMissing(b)) return -1;
					if (!isMissing(a) && isMissing(b)) return 1;
					if (field?.type === "number") {
						const na = parseFloat(a),
							nb = parseFloat(b);
						const va = isNaN(na) ? Number.POSITIVE_INFINITY : na;
						const vb = isNaN(nb) ? Number.POSITIVE_INFINITY : nb;
						if (va !== vb) return va - vb;
					} else if (field?.type === "boolean") {
						const va = a === "true" ? 0 : a === "false" ? 1 : 2;
						const vb = b === "true" ? 0 : b === "false" ? 1 : 2;
						if (va !== vb) return va - vb;
					} else if (field?.type === "date") {
						const ta = Date.parse(a);
						const tb = Date.parse(b);
						const va = isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
						const vb = isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
						if (va !== vb) return va - vb;
					}
					return a.localeCompare(b);
				};

				const sortedUser = keys.slice().sort(ascCompare);
				return dir === "desc" ? sortedUser.reverse() : sortedUser;
			}

			// Default alphabetical with missing-first for asc
			const isMissing = (k: string) => /^No\s/i.test(k);
			const asc = keys.slice().sort((a, b) => {
				if (isMissing(a) && !isMissing(b)) return -1;
				if (!isMissing(a) && isMissing(b)) return 1;
				return a.localeCompare(b);
			});
			return dir === "desc" ? asc.reverse() : asc;
		};

		const orderedKeys = sortKeys(Array.from(result.keys()), subgroupKey);
		for (const k of orderedKeys) sorted.set(k, result.get(k)!);
		return sorted;
	}

	/**
	 * Check if a day is collapsed
	 */
	private isDayCollapsed(dayKey: string): boolean {
		try {
			const prefs =
				this.plugin.viewStateManager.getViewPreferences<any>(AGENDA_VIEW_TYPE) || {};
			const collapsed = prefs.collapsedDays || {};
			return !!collapsed[dayKey];
		} catch {
			return false;
		}
	}

	/**
	 * Set day collapsed state
	 */
	private setDayCollapsed(dayKey: string, collapsed: boolean): void {
		const prefs = this.plugin.viewStateManager.getViewPreferences<any>(AGENDA_VIEW_TYPE) || {};
		const next = { ...prefs };
		if (!next.collapsedDays) next.collapsedDays = {};
		next.collapsedDays[dayKey] = collapsed;
		this.plugin.viewStateManager.setViewPreferences(AGENDA_VIEW_TYPE, next);
	}

	/**
	 * Wait for cache to be ready with actual data
	 */
	private async waitForCacheReady(): Promise<void> {
		// First check if cache is already initialized
		if (this.plugin.cacheManager.isInitialized()) {
			return;
		}

		// If not initialized, wait for the cache-initialized event
		return new Promise((resolve) => {
			const unsubscribe = this.plugin.cacheManager.subscribe("cache-initialized", () => {
				unsubscribe();
				resolve();
			});
		});
	}
}
