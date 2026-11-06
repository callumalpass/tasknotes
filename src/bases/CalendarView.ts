import { captureTaskUndo } from "../ui/taskMutationUndo";
import { showTaskUndo } from "../ui/taskPropertyPickers";
import { displayError } from "../i18n/runtime";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import TaskNotesPlugin from "../main";
import { createElementInDocument } from "../utils/documentDom";
import type { BasesEntry, BasesView, BasesViewFactory } from "obsidian";
import { BasesViewBase } from "./BasesViewBase";
import { installCalendarKeyboard } from "./calendarKeyboard";
import { format } from "date-fns";
import { EVENT_TASK_UPDATED, EVENT_TASK_DELETED, type TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData } from "./helpers";
import type { TimeblockCreationResult } from "../modals/TimeblockCreationModal";
import { openListPicker } from "../ui/kit/listPicker";
import {
	Calendar,
	basesLayoutOptions,
	viewToBases,
	type CalendarOptions,
	type ExternalDropArg,
	type ItemArg,
	type ItemPointerArg,
	type SelectArg,
	type ViewInfo,
} from "@tasknotes/calendar";
import {
	generateTimeblockEvents,
	getEventTextColor,
	handleDateTitleClick,
} from "./calendar-core";
import { handleCalendarEventDrop, handleCalendarEventResize, type CalendarMutationContext } from "./calendarMutations";
import { calendarTaskId } from "@tasknotes/model/calendar";
import { buildCalendarBatchPreview, isCalendarBatchTarget, planCalendarBatchMove, type CalendarBatchMove } from "./calendarBatchMove";
import { CalendarBatchPreview } from "./calendarBatchPreview";
import { DEFAULT_TASK_CLICK_EXCLUDE_SELECTOR } from "../utils/clickHandlers";
import { CalendarTaskProjection, calendarEntryToEvent, calendarMaterializedOccurrences } from "./calendarModelEvents";
import { handleCalendarEventClick, handleCalendarEventContextMenu, toMouseEvent, type CalendarMenuContext } from "./calendarMenus";
import { Notice, Platform, TFile, setIcon } from "obsidian";
import type { EventRef } from "obsidian";
import {
	CalendarRecreateNavigationState,
	shouldPreserveVisibleDateOnCalendarRecreate,
} from "./calendarRecreateUtils";
import type { BasesTaskUpdateSource } from "./basesUpdateEvents";
import {
	determineCalendarInitialDate,
	getCalendarRecreateNavigationState,
} from "./calendarInitialDate";
import {
	buildCalendarDataSignature,
	buildCalendarDataSignaturePropertyIds,
	buildCalendarFallbackDataSignature,
} from "./calendarDataSignature";
import {
	buildCalendarConfigSnapshot,
	getCalendarConfigValue as getCalendarConfigValueFromSnapshot,
} from "./calendarConfigSnapshot";
import { buildCalendarPropertyEvent } from "./calendarPropertyEvents";
import { buildExternalCalendarEvents, buildLinkedGoogleEventPredicate, setProviderCalendarToggle } from "./calendarExternalEvents";
import { acceptsExternalTaskDrop, getExternalTaskDropPath } from "./calendarExternalTaskDrop";
import {
	createCalendarListEventCard,
	type BasesEntryWithGetValue,
} from "./calendarEventMount";
import {
	eventApiFromItem,
	eventChangeFromArg,
	toCalendarItems,
	type CalendarEventItem,
	type CalendarEventChange,
	type CalendarEventInput,
	type CalendarEventProps,
} from "./calendarEngine";
import { installCalendarTooltipGuard } from "./calendarTooltipGuard";
import { CALENDAR_END_TIME_MAX_HOUR, normalizeCalendarTimeValue } from "../utils/calendarTime";
import { showCalendarCreationMenu } from "./calendarCreationMenu";
import { decorateCalendarEvent } from "./calendarEventPresentation";
export { suppressCalendarContextMenuOnMobile } from "./calendarEventPresentation";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/CalendarView" });

type Nullable<T> = T | null;

export {
	getCalendarConfigValue,
	readCalendarConfigValue,
	type CalendarViewConfigReader,
} from "./calendarConfigSnapshot";

type CalendarDataAdapterWithView = {
	basesView: CalendarView;
};

type CalendarEphemeralState = {
	calendarDate?: unknown;
	/** Legacy workspace state may contain this; view type is now config-owned. */
	calendarView?: unknown;
	calendarScroll?: unknown;
};

type TaskCalendar = Calendar<CalendarEventProps>;


const CALENDAR_DATA_UPDATE_DEBOUNCE_MS = 5000;
const CALENDAR_DATA_SIGNATURE_CHECK_INTERVAL_MS = 250;
const CALENDAR_DATA_SIGNATURE_CHECK_MAX_MS = 2000;
import { applyBasesSortIndexesToCalendarEvents, filterAllDayEventsForCalendarView, getTaskNotesCalendarEventOrder, hasBasesCalendarSortConfig, isRecord, isTimeGridCalendarView, normalizeCalendarHeightMode, resolveEffectiveCalendarHeightMode, shouldHideCalendarTimeGrid, type CalendarHeightMode } from "./calendarViewLayout";
export { applyBasesSortIndexesToCalendarEvents, filterAllDayEventsForCalendarView, getTaskNotesCalendarEventOrder, hasBasesCalendarSortConfig, isTimeGridCalendarView, normalizeCalendarHeightMode, resolveEffectiveCalendarHeightMode, shouldFilterAllDayEventsForCalendarView, shouldHideCalendarTimeGrid, TASKNOTES_CALENDAR_SORT_INDEX, type CalendarHeightMode } from "./calendarViewLayout";

function sameRange(a: ViewInfo, b: ViewInfo): boolean {
	return (
		a.type === b.type && a.range.startDay === b.range.startDay && a.range.endDay === b.range.endDay
	);
}

function isCalendarEphemeralState(value: unknown): value is CalendarEphemeralState {
	return isRecord(value);
}

function isCalendarScrollPosition(value: unknown): value is { top: number; left: number } {
	return isRecord(value) && typeof value.top === "number" && typeof value.left === "number";
}


export class CalendarView extends BasesViewBase {
	type = "tasknotesCalendar";
	calendar: TaskCalendar | null = null; // Made public for factory access
	private keyboard?: ReturnType<typeof installCalendarKeyboard>;
	private calendarEl: HTMLElement | null = null;
	private dayPanel: TaskCalendar | null = null;
	private dayPanelEl: HTMLElement | null = null;
	private selectedMonthDay: string | null = null;
	/** Range the current items were built for. */
	private visibleView: ViewInfo | null = null;
	private automaticViewChange = false;
	private explicitlyChosenView = false;
	private refetchSeq = 0;
	private currentTasks: TaskInfo[] = [];
	private identityTasks: TaskInfo[] = [];
	private nonTaskEvents: CalendarEventInput[] = [];
	private readonly calendarTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
	private readonly taskProjection = new CalendarTaskProjection({
		timezone: this.calendarTimezone, now: new Date().toISOString(),
	}, (task, error) => tasknotesLogger.warn("Invalid calendar task", {
		category: "validation", operation: "project-calendar-task", details: { path: task.path }, error,
	}));
	private basesEntryByPath: Map<string, BasesEntryWithGetValue> = new Map(); // Map task path to Bases entry for enrichment
	private basesSortIndexByPath = new Map<string, number>();

	// Render lock to prevent duplicate renders
	private _isRendering = false;
	private _pendingRender = false;

	// Flag to skip debounce for user-initiated actions (timeblock creation, drag/drop, etc.)
	private _expectingImmediateUpdate = false;

	// Track if this is the first data update after load (should be immediate)
	private _isFirstDataUpdate = true;

	// Track previous config values to detect user-initiated toggle changes
	private _previousConfigSnapshot: string | null = null;

	// Debounce timer for saving view type to config
	private _saveViewTypeTimer: number | null = null;

	// Flag to indicate config changed and calendar needs recreation
	private _configChangedNeedsRecreate = false;
	// Settings changed the initial-date configuration: jump to the new initial date.
	private _navigateToInitialDate = false;
	// Track Bases view/filter transitions so user-initiated view switches render immediately.
	private _previousDataSignature: string | null = null;
	private _previousControllerViewName: string | null = null;
	private readonly basesController: unknown;

	private viewOptions: {
		// Events
		showScheduled: boolean;
		showDue: boolean;
		showScheduledToDueSpan: boolean;
		showRecurring: boolean;
		showCompletedRecurringInstances: boolean;
		showSkippedRecurringInstances: boolean;
		showTimeEntries: boolean;
		showTimeblocks: boolean;
		showPropertyBasedEvents: boolean;
		showOverdueOnToday: boolean;

		// Date navigation
		initialDate: string;
		initialDateProperty: string | null;
		initialDateStrategy: "first" | "earliest" | "latest";
		createDailyNotesFromDateLinks: boolean;

		// Layout
		calendarView: string;
		heightMode: CalendarHeightMode;
		customDayCount: number;
		listDayCount: number;
		showAgendaStrip: boolean;
		showMonthDayPanel: boolean;
		slotMinTime: string;
		slotMaxTime: string;
		slotDuration: string;
		snapDuration: string;
		firstDay: number;
		weekNumbers: boolean;
		nowIndicator: boolean;
		showWeekends: boolean;
		showAllDaySlot: boolean;
		showTimeGrid: boolean;
		showTodayHighlight: boolean;
		todayColumnWidthMultiplier: number;
		selectMirror: boolean;
		timeFormat: string;
		scrollTime: string;
		eventMinHeight: number;
		slotEventOverlap: boolean;
		eventMaxStack: number | null;
		dayMaxEvents: number | boolean;
		dayMaxEventRows: number | boolean;
		// Locale (non-configurable per view)
		locale: string;

		// Property-based events
		startDateProperty: string | null;
		endDateProperty: string | null;
		titleProperty: string | null;
	};

	// ICS/Google/Microsoft calendar toggles (dynamic)
	private icsCalendarToggles = new Map<string, boolean>();
	private googleCalendarToggles = new Map<string, boolean>();
	private microsoftCalendarToggles = new Map<string, boolean>();
	private configLoaded = false; // Track if we've successfully loaded config

	constructor(controller: unknown, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super(controller, containerEl, plugin);
		this.basesController = controller;
		// BasesView now provides this.data, this.config, and this.app directly
		(this.dataAdapter as unknown as CalendarDataAdapterWithView).basesView = this;
		// Note: Don't read config here - this.config is not set until after construction
		// readViewOptions() will be called in onload()
		// View options (read from config)
		const calendarSettings = this.plugin.settings.calendarViewSettings;
		this.viewOptions = {
			// Events
			showScheduled: calendarSettings.defaultShowScheduled,
			showDue: calendarSettings.defaultShowDue,
			showScheduledToDueSpan: calendarSettings.defaultShowScheduledToDueSpan,
			showRecurring: calendarSettings.defaultShowRecurring,
			showCompletedRecurringInstances: true,
			showSkippedRecurringInstances: true,
			showTimeEntries: calendarSettings.defaultShowTimeEntries,
			showTimeblocks: calendarSettings.defaultShowTimeblocks,
			showPropertyBasedEvents: true,
			showOverdueOnToday: false,

			// Date navigation
			initialDate: "",
			initialDateProperty: null as string | null,
			initialDateStrategy: "first",
			createDailyNotesFromDateLinks: true,

			// Layout
			calendarView: calendarSettings.defaultView,
			heightMode: "fill",
			customDayCount: calendarSettings.customDayCount,
			listDayCount: 7,
			showAgendaStrip: true,
			showMonthDayPanel: true,
			slotMinTime: this.validateTimeValue(calendarSettings.slotMinTime, "00:00:00"),
			slotMaxTime: this.validateTimeValue(
				calendarSettings.slotMaxTime,
				"24:00:00",
				CALENDAR_END_TIME_MAX_HOUR,
				true
			),
			slotDuration: this.validateTimeValue(calendarSettings.slotDuration, "00:30:00"),
			snapDuration: this.validateTimeValue(calendarSettings.slotDuration, "00:30:00"),
			scrollTime: this.validateTimeValue(calendarSettings.scrollTime, "08:00:00"),
			firstDay: calendarSettings.firstDay,
			weekNumbers: calendarSettings.weekNumbers,
			nowIndicator: calendarSettings.nowIndicator,
			showWeekends: calendarSettings.showWeekends,
			showAllDaySlot: true,
			showTimeGrid: true,
			showTodayHighlight: calendarSettings.showTodayHighlight,
			todayColumnWidthMultiplier: 1,
			selectMirror: calendarSettings.selectMirror,
			timeFormat: calendarSettings.timeFormat,
			eventMinHeight: calendarSettings.eventMinHeight,
			slotEventOverlap: calendarSettings.slotEventOverlap,
			eventMaxStack: calendarSettings.eventMaxStack,
			dayMaxEvents: calendarSettings.dayMaxEvents,
			dayMaxEventRows: calendarSettings.dayMaxEventRows,
			locale: calendarSettings.locale,

			// Property-based events
			startDateProperty: null as string | null,
			endDateProperty: null as string | null,
			titleProperty: null as string | null,
		};
	}

	/**
	 * Component lifecycle: Called when view is first loaded.
	 * Override from Component base class.
	 */
	onload(): void {
		// Read view options now that config is available
		this.readViewOptions();
		// Initialize config snapshot for change detection
		this._previousConfigSnapshot = this.getConfigSnapshot();
		this._previousDataSignature = this.getDataSignature();
		this._previousControllerViewName = this.getControllerViewName();
		// Call parent onload which sets up container and listeners
		super.onload();
		if (this.rootElement) {
			this.keyboard = installCalendarKeyboard({
				plugin: this.plugin,
				root: this.rootElement,
				calendar: () => this.calendar,
				create: (date) => { void this.createFileForView(undefined, (frontmatter) => {
					frontmatter[this.plugin.fieldMapper.toUserField("scheduled")] = format(date, "yyyy-MM-dd");
				}); },
				search: () => {
					this.enableSearch = true;
					if (this.rootElement) this.setupSearch(this.rootElement);
					this.searchContainerEl?.querySelector("input")?.focus();
				},
				open: (arg) => handleCalendarEventClick(this.getMenuContext(), arg),
			});
			this.register(() => this.keyboard?.destroy());
		}
		if (this.plugin.icsSubscriptionService) {
			this.register(this.plugin.icsSubscriptionService.on("data-changed", () => {
				if (this.rootElement?.isConnected) void this.refetchEvents();
			}));
		}
		this.registerEvent(this.plugin.app.metadataCache.on("changed", (file, _data, cache) => {
			if (!this.rootElement?.isConnected || !this.viewOptions.showTimeblocks) return;
			if (Array.isArray(cache.frontmatter?.timeblocks) || this.nonTaskEvents.some(event =>
				event.extendedProps?.eventType === "timeblock" && event.extendedProps.filePath === file.path)) {
				void this.refetchEvents();
			}
		}));
		if (this.rootElement) {
			this.register(installCalendarTooltipGuard(this.rootElement));
			const observer = new ResizeObserver(() => this.onResize());
			observer.observe(this.rootElement);
			this.register(() => observer.disconnect());
			this.registerDomEvent(this.rootElement, "click", (event: MouseEvent) => {
				if ((event.target as HTMLElement).closest(".tnc-btn-view")) this.explicitlyChosenView = true;
			}, { capture: true });
			const preview = new CalendarBatchPreview({
				root: this.rootElement,
				getItems: () => this.calendarItems,
				getRevision: () => this.calendarItems,
				isValidTarget: (clientX, clientY) => Boolean(this.calendar?.hitTest(clientX, clientY)),
				build: proposal => buildCalendarBatchPreview(this.getBatchCalendarItems(),
					this.plugin.taskSelectionService?.getSelectedPaths() ?? [], proposal,
					this.calendarTimezone, this.plugin.fieldMapper.getMapping(), new Date().toISOString()),
				upsert: items => this.calendar?.upsertItems(items),
				remove: ids => this.calendar?.removeItems(ids),
				onInvalidDrop: () => this.showUnsupportedCalendarBatchMove(),
			});
			this.batchPreview = preview;
			this.register(() => { preview.dispose(); this.batchPreview = null; });
		}
		// Bases ignores metadata-only updates and deletions outside its query. Such
		// children still own occurrence dates in the model's materialization context.
		const updateRef = this.plugin.emitter.on(EVENT_TASK_UPDATED, (eventData: unknown) => {
			if (!this.rootElement?.isConnected || !isRecord(eventData)) return;
			const data = eventData as { updatedTask?: TaskInfo; task?: TaskInfo; taskInfo?: TaskInfo };
			const task = data.updatedTask ?? data.task ?? data.taskInfo;
			if (!task?.path || this.currentTasks.some(row => row.path === task.path)) return;
			if (task.recurrence_parent || this.identityTasks.some(row => row.path === task.path && row.recurrence_parent)) {
				void this.refreshCalendarWithFreshData(task);
			}
		});
		const onDeleted = (eventData: unknown): void => {
			if (!this.rootElement?.isConnected || !isRecord(eventData)) return;
			const data = eventData as { path?: string; deletedTask?: { path?: string } };
			const path = data.path ?? data.deletedTask?.path;
			if (!this.identityTasks.some(task => task.path === path && task.recurrence_parent)) return;
			this.identityTasks = this.identityTasks.filter(task => task.path !== path);
			for (const task of this.currentTasks) {
				if (task.path === path) this.taskProjection.remove(calendarTaskId(task));
			}
			this.currentTasks = this.currentTasks.filter(task => task.path !== path);
			this.refreshMaterializationContext();
			this.refreshTaskItems();
		};
		const deleteRefs = [EVENT_TASK_DELETED, "file-deleted"].map(event => this.plugin.emitter.on(event, onDeleted));
		this.register(() => {
			for (const ref of [updateRef, ...deleteRefs]) this.plugin.emitter.offref(ref);
		});
	}

	/**
	 * Lifecycle: Handle view resize.
	 * The calendar observes its own size; this covers hosts that resize without layout changes.
	 */
	onResize(): void {
		if (this.calendar) {
			const monthDisplay = this.getMonthDisplay();
			if (this.calendar.getOptions().monthDisplay !== monthDisplay) {
				this.calendar.setOptions({ monthDisplay });
			}
		}
		if (this.calendar && !this.explicitlyChosenView) {
			const preferred = basesLayoutOptions<CalendarEventProps>(this.viewOptions).view;
			const view = this.isNarrowCalendar() && preferred === "week" ? "list" : preferred;
			if (view && this.calendar.view.type !== view) {
				this.automaticViewChange = true;
				try {
					this.calendar.changeView(view);
				} finally {
					this.automaticViewChange = false;
				}
			}
		}
		this.calendar?.updateSize();
		if (this.calendar) this.syncDayPanel();
	}

	private isNarrowCalendar(): boolean {
		return Boolean(this.rootElement && this.rootElement.clientWidth > 0 && this.rootElement.clientWidth < 640);
	}

	private getMonthDisplay(): CalendarOptions<CalendarEventProps>["monthDisplay"] {
		return this.viewOptions.showMonthDayPanel && this.isNarrowCalendar()
			? "dots"
			: basesLayoutOptions<CalendarEventProps>(this.viewOptions).monthDisplay ?? "full";
	}

	/**
	 * Override onDataUpdated for calendar-specific behavior.
	 * Uses a longer debounce to prevent flickering during rapid data updates (e.g., typing),
	 * but responds immediately for first load or when expecting an update from user actions.
	 */
	onDataUpdated(): void {
		// Skip if view is not visible
		if (!this.rootElement?.isConnected) {
			return;
		}

		// Clear any existing debounce timer
		if (this.dataUpdateDebounceTimer) {
			window.clearTimeout(this.dataUpdateDebounceTimer);
			this.dataUpdateDebounceTimer = null;
		}

		// First data update after load should be immediate (initial data population)
		if (this._isFirstDataUpdate) {
			this._isFirstDataUpdate = false;
			void this.render();
			return;
		}

		// If expecting an immediate update from user action, render now
		if (this._expectingImmediateUpdate) {
			this._expectingImmediateUpdate = false;
			this.renderPreservingEphemeralState();
			return;
		}

		const configChanged = this.hasConfigChanged();
		const controllerViewChanged = this.hasControllerViewChanged();
		const dataSignatureChanged = this.hasDataSignatureChanged();

		// If config changed, mark for recreation and render immediately
		if (configChanged) {
			this._configChangedNeedsRecreate = true;
			this.renderPreservingEphemeralState();
			return;
		}

		if (dataSignatureChanged) {
			this.renderPreservingEphemeralState();
			return;
		}

		this.scheduleDeferredDataUpdate(Date.now(), controllerViewChanged);
	}

	/**
	 * The calendar moves its own today marks. Its date stays put, and so do items
	 * placed relative to now, so a view following today has to be moved here.
	 */
	protected handleDateRollover(previousDay: string): void {
		const calendar = this.calendar;
		if (!calendar) return;

		const rangeBefore = this.visibleView;
		const hasConfiguredDate = this.viewOptions.initialDate || this.viewOptions.initialDateProperty;
		if (!hasConfiguredDate && calendar.getDate().toDateString() === previousDay) {
			const scroll = calendar.getScroll();
			calendar.gotoDate(new Date());
			calendar.setScroll(scroll);
		}
		// A move into a new range has already refetched through onRangeChange.
		if (this.visibleView === rangeBefore) void this.refetchEvents();
	}

	/**
	 * Signal that we're expecting an immediate update from a user-initiated action.
	 * Call this before performing calendar actions that will trigger file changes.
	 */
	expectImmediateUpdate(): void {
		this._expectingImmediateUpdate = true;
		// Auto-reset after a short delay in case the update never comes
		window.setTimeout(() => {
			this._expectingImmediateUpdate = false;
		}, 2000);
	}

	/**
	 * Get a snapshot of config values that affect rendering.
	 * Used to detect user-initiated config changes.
	 */
	private getConfigSnapshot(): string {
		return buildCalendarConfigSnapshot({
			config: this.config,
			icsCalendarIds:
				this.plugin.icsSubscriptionService?.getSubscriptions().map((sub) => sub.id) ?? [],
			googleCalendarIds:
				this.plugin.googleCalendarService
					?.getAvailableCalendars()
					.map((calendar) => calendar.id) ?? [],
			microsoftCalendarIds:
				this.plugin.microsoftCalendarService
					?.getAvailableCalendars()
					.map((calendar) => calendar.id) ?? [],
		});
	}

	/**
	 * Check if config has changed since last snapshot.
	 * Returns true if this is likely a user-initiated config change.
	 */
	private hasConfigChanged(): boolean {
		const currentSnapshot = this.getConfigSnapshot();
		if (this._previousConfigSnapshot === null) {
			// First time - just store the snapshot
			this._previousConfigSnapshot = currentSnapshot;
			return false;
		}
		if (currentSnapshot !== this._previousConfigSnapshot) {
			this._previousConfigSnapshot = currentSnapshot;
			return true;
		}
		return false;
	}

	private getDataSignature(): string {
		if (!this.data?.data) {
			return "";
		}

		const propertyIds = this.getDataSignaturePropertyIds();

		try {
			return buildCalendarDataSignature(this.dataAdapter.extractDataItems(), propertyIds);
		} catch {
			return buildCalendarFallbackDataSignature(this.data.data);
		}
	}

	private getDataSignaturePropertyIds(): string[] {
		let visiblePropertyIds: readonly unknown[] = [];
		try {
			visiblePropertyIds = this.dataAdapter.getVisiblePropertyIds();
		} catch {
			// Visible-property config is not always available during early view setup.
		}

		return buildCalendarDataSignaturePropertyIds({
			mapField: (field) => this.plugin?.fieldMapper?.toUserField(field),
			visiblePropertyIds,
			showPropertyBasedEvents: Boolean(this.viewOptions?.showPropertyBasedEvents),
			startDateProperty: this.viewOptions?.startDateProperty,
			endDateProperty: this.viewOptions?.endDateProperty,
			titleProperty: this.viewOptions?.titleProperty,
		});
	}

	private hasDataSignatureChanged(): boolean {
		const currentSignature = this.getDataSignature();
		if (this._previousDataSignature === null) {
			this._previousDataSignature = currentSignature;
			return false;
		}
		if (currentSignature !== this._previousDataSignature) {
			this._previousDataSignature = currentSignature;
			return true;
		}
		return false;
	}

	private getControllerViewName(): string | null {
		if (!isRecord(this.basesController)) {
			return null;
		}

		const viewName = this.basesController.viewName;
		return typeof viewName === "string" ? viewName : null;
	}

	private hasControllerViewChanged(): boolean {
		const currentViewName = this.getControllerViewName();
		if (this._previousControllerViewName === null) {
			this._previousControllerViewName = currentViewName;
			return currentViewName !== null;
		}
		if (currentViewName !== this._previousControllerViewName) {
			this._previousControllerViewName = currentViewName;
			return true;
		}
		return false;
	}

	private scheduleDeferredDataUpdate(startedAt = Date.now(), renderAtMaxCheck = false): void {
		const win = this.containerEl.ownerDocument.defaultView || window;
		const elapsed = Date.now() - startedAt;
		let delay: number;

		if (elapsed < CALENDAR_DATA_SIGNATURE_CHECK_MAX_MS) {
			delay = CALENDAR_DATA_SIGNATURE_CHECK_INTERVAL_MS;
		} else if (renderAtMaxCheck) {
			delay = 0;
		} else {
			delay = Math.max(0, CALENDAR_DATA_UPDATE_DEBOUNCE_MS - elapsed);
		}

		this.dataUpdateDebounceTimer = win.setTimeout(() => {
			this.dataUpdateDebounceTimer = null;
			const nextElapsed = Date.now() - startedAt;

			if (this.hasDataSignatureChanged()) {
				this.renderPreservingEphemeralState();
				return;
			}

			if (nextElapsed < CALENDAR_DATA_SIGNATURE_CHECK_MAX_MS) {
				this.scheduleDeferredDataUpdate(startedAt, renderAtMaxCheck);
				return;
			}

			if (!renderAtMaxCheck && nextElapsed < CALENDAR_DATA_UPDATE_DEBOUNCE_MS) {
				this.scheduleDeferredDataUpdate(startedAt, false);
				return;
			}

			if (renderAtMaxCheck) {
				this.renderPreservingEphemeralState();
			}
		}, delay);
	}

	/**
	 * Validate and format time string (HH:MM or HH:MM:SS format).
	 * Returns the validated time in HH:MM:SS format, or the default value if invalid.
	 */
	private validateTimeValue(
		value: string | undefined,
		defaultValue: string,
		maxHour = 23,
		allowMaxHourOnlyAtZero = false
	): string {
		const result = normalizeCalendarTimeValue(value, defaultValue, {
			maxHour,
			allowMaxHourOnlyAtZero,
		});
		if (!result.isValid) {
			tasknotesLogger.warn(
				`[TaskNotes][CalendarView] Invalid time value: ${value}, using default: ${defaultValue}`,
				{ category: "provider", operation: "invalid-time-value" }
			);
		}
		return result.value;
	}

	private getConfigOption<T>(key: string, fallback: T): T {
		return getCalendarConfigValueFromSnapshot(this.config, key, fallback);
	}

	/**
	 * Read event toggle options from config.
	 * These should be re-read on every render to respond to toggle changes.
	 */
	private readEventToggles(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== "function") {
			return;
		}

		try {
			this.viewOptions.showScheduled = this.getConfigOption(
				"showScheduled",
				this.viewOptions.showScheduled
			);
			this.viewOptions.showDue = this.getConfigOption("showDue", this.viewOptions.showDue);
			this.viewOptions.showScheduledToDueSpan = this.getConfigOption(
				"showScheduledToDueSpan",
				this.viewOptions.showScheduledToDueSpan
			);
			this.viewOptions.showRecurring = this.getConfigOption(
				"showRecurring",
				this.viewOptions.showRecurring
			);
			this.viewOptions.showCompletedRecurringInstances = this.getConfigOption(
				"showCompletedRecurringInstances",
				this.viewOptions.showCompletedRecurringInstances
			);
			this.viewOptions.showSkippedRecurringInstances = this.getConfigOption(
				"showSkippedRecurringInstances",
				this.viewOptions.showSkippedRecurringInstances
			);
			this.viewOptions.showTimeEntries = this.getConfigOption(
				"showTimeEntries",
				this.viewOptions.showTimeEntries
			);
			this.viewOptions.showTimeblocks = this.getConfigOption(
				"showTimeblocks",
				this.viewOptions.showTimeblocks
			);
			this.viewOptions.showPropertyBasedEvents = this.getConfigOption(
				"showPropertyBasedEvents",
				this.viewOptions.showPropertyBasedEvents
			);
			this.viewOptions.showOverdueOnToday = this.getConfigOption(
				"showOverdueOnToday",
				this.viewOptions.showOverdueOnToday
			);

			// ICS calendar toggles
			if (this.plugin.icsSubscriptionService) {
				const subscriptions = this.plugin.icsSubscriptionService.getSubscriptions();
				for (const sub of subscriptions) {
					const key = `showICS_${sub.id}`;
					this.icsCalendarToggles.set(sub.id, this.getConfigOption(key, true));
				}
			}

			// Google calendar toggles
			if (this.plugin.googleCalendarService) {
				const calendars = this.plugin.googleCalendarService.getAvailableCalendars();
				for (const cal of calendars) {
					const key = `showGoogleCalendar_${cal.id}`;
					setProviderCalendarToggle(
						this.googleCalendarToggles,
						cal,
						this.getConfigOption(key, true)
					);
				}
			}

			// Microsoft calendar toggles
			if (this.plugin.microsoftCalendarService) {
				const calendars = this.plugin.microsoftCalendarService.getAvailableCalendars();
				for (const cal of calendars) {
					const key = `showMicrosoftCalendar_${cal.id}`;
					this.microsoftCalendarToggles.set(cal.id, this.getConfigOption(key, true));
				}
			}
		} catch (e) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error reading event toggles:", {
				category: "provider",
				operation: "reading-event-toggles",
				error: e,
			});
		}
	}

	/**
	 * Read view configuration options from BasesViewConfig.
	 * Layout options are only read once to avoid resetting the view on toggle changes.
	 */
	private readViewOptions(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== "function") {
			return;
		}

		try {
			// Always read event toggles
			this.readEventToggles();

			// Date navigation
			this.viewOptions.initialDate = this.getConfigOption(
				"initialDate",
				this.viewOptions.initialDate
			);
			this.viewOptions.initialDateProperty = this.getConfigOption(
				"initialDateProperty",
				this.viewOptions.initialDateProperty
			);
			this.viewOptions.initialDateStrategy = this.getConfigOption(
				"initialDateStrategy",
				this.viewOptions.initialDateStrategy
			);
			this.viewOptions.createDailyNotesFromDateLinks = this.getConfigOption(
				"createDailyNotesFromDateLinks",
				this.viewOptions.createDailyNotesFromDateLinks
			);

			// Layout
			if (!this._saveViewTypeTimer) {
				this.viewOptions.calendarView = this.getConfigOption(
					"calendarView",
					this.viewOptions.calendarView
				);
			}
			this.viewOptions.heightMode = normalizeCalendarHeightMode(
				this.getConfigOption("heightMode", this.viewOptions.heightMode)
			);
			this.applyHeightModeClass();
			this.viewOptions.customDayCount = this.getConfigOption(
				"customDayCount",
				this.viewOptions.customDayCount
			);
			this.viewOptions.listDayCount = this.getConfigOption(
				"listDayCount",
				this.viewOptions.listDayCount
			);
			this.viewOptions.showAgendaStrip = this.getConfigOption("showAgendaStrip", true);
			this.viewOptions.showMonthDayPanel = this.getConfigOption("showMonthDayPanel", true);

			// Validate time values to prevent crashes from invalid input
			this.viewOptions.slotMinTime = this.validateTimeValue(
				this.getConfigOption<string | undefined>("slotMinTime", undefined),
				this.viewOptions.slotMinTime
			);
			this.viewOptions.slotMaxTime = this.validateTimeValue(
				this.getConfigOption<string | undefined>("slotMaxTime", undefined),
				this.viewOptions.slotMaxTime,
				CALENDAR_END_TIME_MAX_HOUR,
				true
			);
			this.viewOptions.slotDuration = this.validateTimeValue(
				this.getConfigOption<string | undefined>("slotDuration", undefined),
				this.viewOptions.slotDuration
			);
			this.viewOptions.snapDuration = this.validateTimeValue(
				this.getConfigOption<string | undefined>("snapDuration", undefined),
				this.viewOptions.slotDuration
			);
			this.viewOptions.scrollTime = this.validateTimeValue(
				this.getConfigOption<string | undefined>("scrollTime", undefined),
				this.viewOptions.scrollTime
			);

			this.viewOptions.firstDay = Number(
				this.getConfigOption("firstDay", this.viewOptions.firstDay)
			);
			this.viewOptions.weekNumbers = this.getConfigOption(
				"weekNumbers",
				this.viewOptions.weekNumbers
			);
			this.viewOptions.nowIndicator = this.getConfigOption(
				"nowIndicator",
				this.viewOptions.nowIndicator
			);
			this.viewOptions.showWeekends = this.getConfigOption(
				"showWeekends",
				this.viewOptions.showWeekends
			);
			this.viewOptions.showAllDaySlot = this.getConfigOption(
				"showAllDaySlot",
				this.viewOptions.showAllDaySlot
			);
			this.viewOptions.showTimeGrid = this.getConfigOption(
				"showTimeGrid",
				this.viewOptions.showTimeGrid
			);
			this.viewOptions.showTodayHighlight = this.getConfigOption(
				"showTodayHighlight",
				this.viewOptions.showTodayHighlight
			);
			const todayColumnWidthMultiplier = Number(
				this.getConfigOption("todayColumnWidthMultiplier", 1)
			);
			this.viewOptions.todayColumnWidthMultiplier =
				todayColumnWidthMultiplier >= 1 && todayColumnWidthMultiplier <= 5
					? Math.round(todayColumnWidthMultiplier * 2) / 2
					: 1;
			this.viewOptions.selectMirror = this.getConfigOption(
				"selectMirror",
				this.viewOptions.selectMirror
			);
			this.viewOptions.timeFormat = this.getConfigOption(
				"timeFormat",
				this.viewOptions.timeFormat
			);
			this.viewOptions.eventMinHeight = this.getConfigOption(
				"eventMinHeight",
				this.viewOptions.eventMinHeight
			);
			this.viewOptions.slotEventOverlap = this.getConfigOption(
				"slotEventOverlap",
				this.viewOptions.slotEventOverlap
			);

			// Convert slider values: 0 means special behavior (null/true/false)
			const eventMaxStackValue = this.getConfigOption<number | undefined>(
				"eventMaxStack",
				undefined
			);
			if (eventMaxStackValue !== undefined) {
				this.viewOptions.eventMaxStack =
					eventMaxStackValue === 0 ? null : eventMaxStackValue;
			}

			const dayMaxEventsValue = this.getConfigOption<number | undefined>(
				"dayMaxEvents",
				undefined
			);
			if (dayMaxEventsValue !== undefined) {
				// 0 = auto (true), positive number = limit
				this.viewOptions.dayMaxEvents = dayMaxEventsValue === 0 ? true : dayMaxEventsValue;
			}

			const dayMaxEventRowsValue = this.getConfigOption<number | undefined>(
				"dayMaxEventRows",
				undefined
			);
			if (dayMaxEventRowsValue !== undefined) {
				// 0 = unlimited (false), positive number = limit
				this.viewOptions.dayMaxEventRows =
					dayMaxEventRowsValue === 0 ? false : dayMaxEventRowsValue;
			}

			// Property-based events
			this.viewOptions.startDateProperty = this.getConfigOption(
				"startDateProperty",
				this.viewOptions.startDateProperty
			);
			this.viewOptions.endDateProperty = this.getConfigOption(
				"endDateProperty",
				this.viewOptions.endDateProperty
			);
			this.viewOptions.titleProperty = this.getConfigOption(
				"titleProperty",
				this.viewOptions.titleProperty
			);

			// Read enableSearch toggle (default: false for backward compatibility)
			this.enableSearch = this.getConfigOption("enableSearch", false);

			// Mark config as successfully loaded
			this.configLoaded = true;
			this.applyLayoutClasses();

		} catch (e) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error reading view options:", {
				category: "provider",
				operation: "reading-view-options",
				error: e,
			});
		}
	}

	async render(): Promise<void> {
		// Prevent duplicate concurrent renders
		if (this._isRendering) {
			this._pendingRender = true;
			return;
		}

		this._isRendering = true;
		this._pendingRender = false;

		if (!this.calendarEl || !this.rootElement) {
			this._isRendering = false;
			return;
		}
		if (!this.data?.data) {
			this._isRendering = false;
			return;
		}

		// Ensure view options are read (in case config wasn't available in onload)
		if (!this.configLoaded && this.config) {
			this.readViewOptions();
		} else if (this.config) {
			// If config changed, re-read ALL options and destroy calendar for recreation
			if (this._configChangedNeedsRecreate) {
				this._configChangedNeedsRecreate = false;
				const previousNavigationState = this.getNavigationConfigState();
				this.readViewOptions();
				if (this.calendar) {
					const nextNavigationState = this.getNavigationConfigState();
					this._navigateToInitialDate = !shouldPreserveVisibleDateOnCalendarRecreate(
						previousNavigationState,
						nextNavigationState
					);
					this.automaticViewChange = true;
					try {
						this.calendar.setOptions(this.buildCalendarOptions());
					} finally {
						this.automaticViewChange = false;
					}
					this.syncSelectionModeAfterCalendarRender();
					this.destroyDayPanel();
					this.syncDayPanel();
				}
			} else {
				// Normal render - just re-read event toggles
				this.readEventToggles();
			}
		}

		// Now that config is loaded, setup search (idempotent: will only create once)
		if (this.rootElement) {
			this.setupSearch(this.rootElement);
		}

		try {
			// Extract tasks from Bases
			const dataItems = this.dataAdapter.extractDataItems();
			const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);

			// Apply search filter
			const filteredTasks = this.applySearchFilter(taskNotes);
			this.currentTasks = filteredTasks;
			this.identityTasks = await this.plugin.cacheManager.getAllTasks();
			this.updateBasesSortIndexes(filteredTasks);

			// Build Bases entry mapping for task enrichment
			this.basesEntryByPath.clear();
			if (this.data?.data) {
				for (const entry of this.data.data) {
					if (entry.file?.path) {
						this.basesEntryByPath.set(entry.file.path, entry as BasesEntryWithGetValue);
					}
				}
			}

			// Initialize or update calendar
			if (!this.calendar) {
				await this.initializeCalendar(filteredTasks);
			} else {
				if (this._navigateToInitialDate) {
					this._navigateToInitialDate = false;
					const initialDate = this.determineInitialDate(filteredTasks);
					if (initialDate) this.calendar.gotoDate(initialDate);
				}
				await this.updateCalendarEvents(filteredTasks);
			}
		} catch (error: unknown) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error rendering:", {
				category: "provider",
				operation: "rendering",
				error: error,
			});
			this.renderError(error instanceof Error ? error : new Error(String(error)));
		} finally {
			this._isRendering = false;
		}

		// If a render was requested while we were rendering, do it now
		if (this._pendingRender) {
			this._pendingRender = false;
			// Use setTimeout to avoid deep call stack
			window.setTimeout(() => void this.render(), 0);
		}
	}

	private calendarItems: CalendarEventItem[] = [];
	private batchMoveInProgress = false;
	private batchPreview: CalendarBatchPreview | null = null;

	private getBatchCalendarItems(): CalendarEventItem[] {
		const view = this.calendar?.getView();
		const timeGrid = view && isTimeGridCalendarView(viewToBases(view.type) ?? view.type);
		return (this.calendarItems ?? []).filter(item => !timeGrid ||
			(item.allDay ? this.viewOptions.showAllDaySlot : this.viewOptions.showTimeGrid));
	}

	protected getVisibleTaskPaths(): string[] {
		return [...new Set(this.getBatchCalendarItems()
			.filter(item => isCalendarBatchTarget(item.data))
			.sort((a, b) => String(a.start).localeCompare(String(b.start)))
			.flatMap(item => item.data?.taskInfo ? [item.data.taskInfo.path] : []))];
	}

	private syncSelectionModeAfterCalendarRender(): void {
		if (!this.rootElement) return;
		(this.containerEl.ownerDocument.defaultView ?? window).requestAnimationFrame(() => {
			if (this.rootElement?.isConnected) {
				this.updateSelectionModeUI(Boolean(this.plugin.taskSelectionService?.isSelectionModeActive()));
			}
		});
	}

	protected updateSelectionModeUI(active: boolean): void {
		super.updateSelectionModeUI(active);
		this.rootElement?.querySelector(".tnc-btn-selectTasks")?.setAttribute("aria-pressed", String(active));
	}

	protected updateSelectionIndicator(count: number): void {
		super.updateSelectionIndicator(count);
		this.selectionIndicatorEl?.classList.toggle("tn-calendar-selection-indicator-visible", count > 0);
	}

	protected updateSelectionVisuals(): void {
		this.batchPreview?.clear();
		super.updateSelectionVisuals();
		if (!this.rootElement) return;
		const selection = this.plugin.taskSelectionService;
		this.rootElement.classList.toggle("tn-calendar-has-selection", Boolean(selection?.getSelectedPaths().length));
		this.calendar?.setOptions({ selected: (this.calendarItems ?? [])
			.filter(item => isCalendarBatchTarget(item.data) && selection?.isSelected(item.data.taskInfo.path))
			.map(item => item.id) });
		for (const el of this.rootElement.querySelectorAll<HTMLElement>(".tnc-item[data-task-path]")) {
			const selected = Boolean(el.dataset.taskPath && selection?.isSelected(el.dataset.taskPath)) && el.dataset.batchSelectable === "true";
			el.classList.toggle("tn-calendar-item-selected", selected);
			el.setAttribute("aria-pressed", String(selected));
			const count = selected ? selection?.getSelectedPaths().length ?? 0 : 0;
			if (count > 1) el.dataset.dragCount = String(count);
			else delete el.dataset.dragCount;
		}
	}

	private setCalendarItems(items: CalendarEventItem[]): void {
		this.batchPreview?.clear(false);
		this.calendarItems = items;
		this.calendar?.setItems(items);
		this.dayPanel?.setItems(items);
		this.updateSelectionModeUI(Boolean(this.plugin.taskSelectionService?.isSelectionModeActive()));
		this.updateSelectionVisuals();
	}

	private async initializeCalendar(taskNotes: TaskInfo[]): Promise<void> {
		if (!this.calendarEl) return;

		const initialDate = this.determineInitialDate(taskNotes);
		this.destroyDayPanel();
		this.calendarEl.replaceChildren();
		this.automaticViewChange = true;
		try {
			this.calendar = new Calendar<CalendarEventProps>(this.calendarEl, {
				...this.buildCalendarOptions(),
				...(initialDate ? { date: initialDate } : {}),
			});
		} finally {
			this.automaticViewChange = false;
		}
		this.applyLayoutClasses();
		this.syncDayPanel();
		await this.refetchEvents();
	}

	/** Layout, text and callbacks for the calendar, from the Bases view settings. */
	private buildCalendarOptions(): Partial<CalendarOptions<CalendarEventProps>> {
		const t = (message: MessageDescriptor, fallback: string) => this.plugin.i18n.translate(message) || fallback;
		const options = this.viewOptions;
		const layout = basesLayoutOptions<CalendarEventProps>(options, {
			embedded: this.getEffectiveHeightMode() === "auto",
		});
		const refreshLabel = t(
			msg({ message: "Refresh calendar subscriptions", context: "views.basesCalendar.hints.refresh" }),
			t(msg({ message: "Refresh", context: "views.basesCalendar.buttonText.refresh" }), "Refresh calendar subscriptions")
		);
		return {
			...layout,
			monthDisplay: this.getMonthDisplay(),
			listAgenda: options.showAgendaStrip,
			listAddText: t(msg({ message: "Add task", context: "modals.task.dependencies.addTaskButton" }), "Add task"),
			onListAdd: ({ dateStr }) => this.addTaskOnDay(dateStr),
			dayClassNames: ({ dateStr }) => dateStr === this.selectedMonthDay ? ["tn-calendar-day-selected"] : [],
			dayHeaderContent: arg => {
				if (arg.view.type !== "list") return null;
				const locale = options.locale || this.plugin.settings.uiLanguage || navigator.language || "en";
				const heading = createElementInDocument(this.containerEl.ownerDocument, "span");
				heading.className = "tn-calendar-day-heading";
				heading.setAttribute("aria-label", new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(arg.date));
				heading.createSpan({ cls: "tn-calendar-day-number", text: new Intl.DateTimeFormat(locale, { day: "numeric" }).format(arg.date) });
				const label = heading.createSpan({ cls: "tn-calendar-day-label" });
				label.createSpan({ cls: "tn-calendar-day-weekday", text: new Intl.DateTimeFormat(locale, { weekday: "long" }).format(arg.date) });
				label.createSpan({ cls: "tn-calendar-day-month", text: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(arg.date) });
				return heading;
			},
			view: !this.explicitlyChosenView && this.isNarrowCalendar() && layout.view === "week" ? "list" : layout.view,
			timeZone: this.calendarTimezone,
			locale: options.locale || this.plugin.settings.uiLanguage || navigator.language || "en",
			editable: true,
			selectable: true,
			navLinks: true,
			longPressDelay: Platform.isMobile ? 350 : 500,
			eventOrder: getTaskNotesCalendarEventOrder(this.dataAdapter.getSortConfig()),
			toolbar: {
				views: ["year", "month", "week", "days", "day", "list"],
				extraPlacement: "start",
				extraButtons: [
					{
						id: "overflow",
						text: t(msg({ message: "Task options", context: "ui.taskCard.taskOptions" }), "Task options"),
						icon: () => {
							const icon = createElementInDocument(this.containerEl.ownerDocument, "span");
							setIcon(icon, "ellipsis");
							return icon;
						},
						onClick: event => {
							const anchor = event.currentTarget as HTMLElement;
							const select = t(msg({ message: "Select tasks", context: "views.basesCalendar.selectTasks" }), "Select tasks");
							const selected = t(msg({ message: "Task options", context: "ui.taskCard.taskOptions" }), "Task options");
							openListPicker({
								anchor, app: this.plugin.app,
								placeholder: selected, emptyText: selected,
								items: [
									{ id: "select", label: select },
									...(this.plugin.taskSelectionService?.getSelectedPaths().length ? [{ id: "selected", label: selected }] : []),
									{ id: "refresh", label: refreshLabel },
								],
								onChoose: item => {
									if (item.id === "refresh") void this.refreshExternalCalendars();
									else if (item.id === "selected") this.showBatchContextMenu(toMouseEvent(null, anchor));
									else this.plugin.taskSelectionService?.toggleSelectionMode();
								},
							});
						},
					},
					{
						id: "selectTasks",
						text: t(msg({ message: "Select tasks", context: "views.basesCalendar.selectTasks" }), "Select tasks"),
						hint: t(msg({ message: "Select tasks", context: "views.basesCalendar.selectTasks" }), "Select tasks"),
						onClick: () => {
							this.plugin.taskSelectionService?.toggleSelectionMode();
							this.rootElement?.focus({ preventScroll: true });
						},
					},
					{
						id: "selectedTasks",
						text: t(msg({ message: "Task options", context: "ui.taskCard.taskOptions" }), "Task options"),
						icon: () => {
							const icon = createElementInDocument(this.containerEl.ownerDocument, "span");
							setIcon(icon, "ellipsis");
							return icon;
						},
						onClick: event => {
							const anchor = this.rootElement?.querySelector<HTMLElement>(".tnc-btn-selectedTasks");
							if (anchor) this.showBatchContextMenu(toMouseEvent(event.detail ? event : null, anchor));
						},
					},
					{
						id: "refreshCalendars",
						text: t(msg({ message: "Refresh", context: "views.basesCalendar.buttonText.refresh" }), "Refresh"),
						hint: refreshLabel,
						icon: () => {
							const icon = createElementInDocument(this.containerEl.ownerDocument, "span");
							setIcon(icon, "refresh-cw");
							return icon;
						},
						onClick: () => {
							void this.refreshExternalCalendars();
						},
					},
				],
			},
			text: {
				appointments: count => this.plugin.i18n.translate(msg({ message: "{count} appointments", context: "calendar collision count" }), { count }),
				today: t(msg({ message: "Today", context: "views.basesCalendar.today" }), "Today"),
				prev: t(msg({ message: "Previous", context: "views.basesCalendar.hints.prev" }), "Previous"),
				next: t(msg({ message: "Next", context: "views.basesCalendar.hints.next" }), "Next"),
				views: {
					month: t(msg({ message: "Month", context: "calendar view name" }), "Month"),
					week: t(msg({ message: "Week", context: "calendar view name" }), "Week"),
					day: t(msg({ message: "Day", context: "calendar view name" }), "Day"),
					year: t(msg({ message: "Year", context: "calendar view name" }), "Year"),
					list: t(msg({ message: "List", context: "calendar view name" }), "List"),
					days: this.plugin.i18n.translate(msg({ message: "{count} days", context: "calendar view name" }), {
						count: options.customDayCount.toString(),
					}),
				},
				viewHints: {
					days: this.plugin.i18n.translate(msg({ message: "{count}-day view", context: "calendar view hint" }), { count: options.customDayCount.toString() }),
					month: t(msg({ message: "Month view", context: "views.basesCalendar.hints.month" }), "Month view"),
					week: t(msg({ message: "Week view", context: "views.basesCalendar.hints.week" }), "Week view"),
					day: t(msg({ message: "Day view", context: "views.basesCalendar.hints.day" }), "Day view"),
					year: t(msg({ message: "Year view", context: "views.basesCalendar.hints.year" }), "Year view"),
					list: t(msg({ message: "List view", context: "views.basesCalendar.hints.list" }), "List view"),
				},
			},
			onRangeChange: (view) => {
				if (this.visibleView && sameRange(this.visibleView, view)) return;
				if (this.visibleView) {
					this.plugin.taskSelectionService?.clearSelection();
					this.plugin.taskSelectionService?.exitSelectionMode();
				}
				this.visibleView = view;
				void this.refetchEvents();
			},
			onViewChange: (view) => this.handleViewChange(view),
			onNavLink: (arg) => {
				if (arg.target === "month") {
					this.calendar?.changeView("month", arg.dateStr);
					return;
				}
				if (arg.view.type === "month" && this.viewOptions.showMonthDayPanel) {
					this.selectMonthDay(arg.dateStr);
					return;
				}
				this.openDailyNoteFromDateLink(arg.date);
			},
			onItemClick: (arg) => {
				void this.handleEventClick(arg);
			},
			onDateClick: arg => {
				if (arg.view.type === "month" && this.viewOptions.showMonthDayPanel) this.selectMonthDay(arg.dateStr);
			},
			onItemContextMenu: (arg) => this.handleEventContextMenu(arg),
			canDrop: proposal => this.batchPreview?.allow(proposal) ?? true,
			onItemDrop: (arg) => this.handleEventDrop(eventChangeFromArg(arg, "drop")),
			onItemResize: (arg) => this.handleEventResize(eventChangeFromArg(arg, "resize")),
			onSelect: (arg) => this.handleDateSelect(arg),
			acceptNativeDrop: acceptsExternalTaskDrop,
			onExternalDrop: (arg) => void this.handleExternalTaskDrop(arg),
			itemDidMount: (arg) => this.handleEventDidMount(arg),
			listItemContent: (arg) => this.renderListItem(arg),
			...{
				listEmptyContent: () => {
					const container = createElementInDocument(this.containerEl.ownerDocument, "div");
					this.renderTaskEmptyState(container);
					return container;
				},
			},
		};
	}

	private handleViewChange(view: ViewInfo): void {
		this.batchPreview?.clear();
		this.syncSelectionModeAfterCalendarRender();
		const viewType = viewToBases(view.type);
		if (!this.automaticViewChange && viewType && viewType !== this.viewOptions.calendarView) {
			this.explicitlyChosenView = true;
			this.viewOptions.calendarView = viewType;
			this.debouncedSaveViewType(viewType);
		}
		this.applyLayoutClasses();
		this.syncDayPanel();
	}

	private addTaskOnDay(dateStr: string): void {
		void this.createFileForView(undefined, frontmatter => {
			frontmatter[this.plugin.fieldMapper.toUserField("scheduled")] = dateStr;
		});
	}

	private selectMonthDay(dateStr: string): void {
		this.selectedMonthDay = dateStr;
		this.calendar?.unselect();
		if (this.calendar && !dateStr.startsWith(format(this.calendar.getDate(), "yyyy-MM"))) {
			this.calendar.gotoDate(dateStr);
		}
		this.syncDayPanel();
	}

	private syncDayPanel(): void {
		this.calendarEl?.classList.toggle("tn-calendar-agenda-strip", this.viewOptions.showAgendaStrip && this.visibleView?.type === "list");
		const enabled = this.viewOptions.showMonthDayPanel && this.visibleView?.type === "month";
		this.calendarEl?.classList.toggle("tn-calendar-composition", enabled);
		if (!enabled) {
			this.destroyDayPanel();
			return;
		}
		if (!this.calendarEl || !this.calendar) return;
		const month = format(this.calendar.getDate(), "yyyy-MM");
		if (!this.selectedMonthDay?.startsWith(month)) {
			const today = format(new Date(), "yyyy-MM-dd");
			this.selectedMonthDay = today.startsWith(month) ? today : `${month}-01`;
		}
		for (const cell of this.calendarEl.querySelectorAll<HTMLElement>(".tnc-dg-day[data-date]")) {
			const selected = cell.dataset.date === this.selectedMonthDay;
			cell.classList.toggle("tn-calendar-day-selected", selected);
			cell.setAttribute("aria-selected", String(selected));
		}
		const panelRoot = this.dayPanelEl?.querySelector<HTMLElement>(":scope > .tnc");
		if (this.dayPanel && this.dayPanelEl && this.dayPanelEl.clientWidth > 0 &&
			(!panelRoot || panelRoot.getClientRects().length === 0)) {
			this.destroyDayPanel();
		}
		if (this.dayPanel) {
			if (format(this.dayPanel.getDate(), "yyyy-MM-dd") !== this.selectedMonthDay) {
				this.dayPanel.gotoDate(this.selectedMonthDay);
			}
			this.dayPanel.setItems(this.calendarItems);
			this.dayPanel.updateSize();
			return;
		}
		this.dayPanelEl = this.calendarEl.createDiv({ cls: "tn-calendar-day-panel" });
		this.dayPanel = new Calendar<CalendarEventProps>(this.dayPanelEl, {
			...this.buildCalendarOptions(),
			view: "list", date: this.selectedMonthDay, listDayCount: 1,
			listAgenda: false, toolbar: false, height: "auto",
			onRangeChange: undefined, onViewChange: undefined,
			onNavLink: arg => this.openDailyNoteFromDateLink(arg.date),
			listEmptyContent: undefined,
		});
		this.dayPanel.setItems(this.calendarItems);
		const add = this.dayPanelEl.createEl("button", {
			cls: "tn-calendar-day-panel-add",
			text: this.plugin.i18n.translate(msg({ message: "Add task", context: "modals.task.dependencies.addTaskButton" })),
		});
		const addIcon = createElementInDocument(this.containerEl.ownerDocument, "span");
		addIcon.setAttribute("aria-hidden", "true");
		setIcon(addIcon, "plus");
		add.prepend(addIcon);
		add.addEventListener("click", () => {
			if (this.selectedMonthDay) this.addTaskOnDay(this.selectedMonthDay);
		});
	}

	private destroyDayPanel(): void {
		this.dayPanel?.destroy();
		this.dayPanel = null;
		this.dayPanelEl?.remove();
		this.dayPanelEl = null;
	}

	private updateBasesSortIndexes(taskNotes: TaskInfo[]): void {
		this.basesSortIndexByPath.clear();
		if (!hasBasesCalendarSortConfig(this.dataAdapter.getSortConfig())) {
			return;
		}

		taskNotes.forEach((task, index) => {
			this.basesSortIndexByPath.set(task.path, index);
		});

		this.data?.data?.forEach((entry, index) => {
			const path = entry.file?.path;
			if (path && !this.basesSortIndexByPath.has(path)) {
				this.basesSortIndexByPath.set(path, index);
			}
		});
	}

	private openDailyNoteFromDateLink(date: Date): void {
		void handleDateTitleClick(date, this.plugin, {
			createIfMissing: this.viewOptions.createDailyNotesFromDateLinks,
		});
	}

	private async refreshExternalCalendars(): Promise<void> {
		try {
			if (this.plugin.icsSubscriptionService) {
				await this.plugin.icsSubscriptionService.refreshAllSubscriptions();
			}

			if (this.plugin.googleCalendarService) {
				await this.plugin.googleCalendarService.refreshAllCalendars();
			}

			if (this.plugin.microsoftCalendarService) {
				await this.plugin.microsoftCalendarService.refreshAllCalendars();
			}

			void this.refetchEvents();
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error refreshing calendars:", {
				category: "provider",
				operation: "refreshing-calendars",
				error: error,
			});
		}
	}

	private applyHeightModeClass(): void {
		const isAutoHeight = this.getEffectiveHeightMode() === "auto";

		if (this.rootElement) {
			this.rootElement.classList.toggle("advanced-calendar-view--auto-height", isAutoHeight);
			this.rootElement.classList.remove("tn-static-min-height-800px-997b4c8c");
		}

		this.calendarEl?.classList.toggle(
			"advanced-calendar-view__calendar--auto-height",
			isAutoHeight
		);
	}

	private applyTimeGridVisibilityClass(): void {
		const hideTimeGrid = shouldHideCalendarTimeGrid(
			this.viewOptions.showTimeGrid,
			(this.visibleView ? viewToBases(this.visibleView.type) : null) ?? this.viewOptions.calendarView
		);

		this.rootElement?.classList.toggle("advanced-calendar-view--hide-time-grid", hideTimeGrid);
		this.calendarEl?.classList.toggle(
			"advanced-calendar-view__calendar--hide-time-grid",
			hideTimeGrid
		);
	}

	private applyCalendarModeClass(): void {
		const isListView = this.visibleView ? this.visibleView.type === "list" : this.viewOptions.calendarView.startsWith("list");
		this.rootElement?.classList.toggle("advanced-calendar-view--list", isListView);
		this.calendarEl?.classList.toggle("advanced-calendar-view__calendar--list", isListView);
	}

	private applyLayoutClasses(): void {
		this.applyHeightModeClass();
		this.applyTimeGridVisibilityClass();
		this.applyCalendarModeClass();
		// Lets bases-calendar.css offset the month event layer past the week-number column.
		this.calendarEl?.classList.toggle(
			"advanced-calendar-view__calendar--week-numbers",
			this.viewOptions.weekNumbers === true
		);
	}

	private getEffectiveHeightMode(): CalendarHeightMode {
		return resolveEffectiveCalendarHeightMode(
			this.viewOptions.heightMode,
			this.viewOptions.calendarView,
			this.containerEl
		);
	}

	/**
	 * Save view type to config with debouncing.
	 * Uses a 1 second debounce to avoid rapid view recreation when clicking through views.
	 * Unlike saving on unload (which caused #1397), saving during active use is safe
	 * because the config object is still valid.
	 */
	private debouncedSaveViewType(viewType: string): void {
		// Clear any pending save
		if (this._saveViewTypeTimer) {
			window.clearTimeout(this._saveViewTypeTimer);
		}

		// Debounce the save to avoid rapid recreation
		this._saveViewTypeTimer = window.setTimeout(() => {
			try {
				if (this.config && typeof this.config.set === "function") {
					this.config.set("calendarView", viewType);
					tasknotesLogger.debug("[TaskNotes][CalendarView] View type saved to config:", {
						category: "provider",
						operation: "view-type-saved-config",
						details: { value: viewType },
					});
				}
			} catch (error) {
				tasknotesLogger.error("[TaskNotes][CalendarView] Failed to save view type:", {
					category: "provider",
					operation: "save-view-type",
					error: error,
				});
			} finally {
				this._saveViewTypeTimer = null;
			}
		}, 1000);
	}

	private determineInitialDate(taskNotes: TaskInfo[]): Date | string | undefined {
		return determineCalendarInitialDate({
			viewOptions: this.viewOptions,
			taskNotes,
			entries: this.data?.data,
			getEntryPropertyValue: (entry, propertyId) =>
				this.dataAdapter.getPropertyValue(entry as BasesEntry, propertyId),
			getContextPropertyValue: (propertyId) =>
				this.getEmbeddedMarkdownDateNavigationPropertyValue(propertyId),
			mapPropertyToTaskField: (propertyId) =>
				this.propertyMapper.basesToTaskCardProperty(propertyId),
		});
	}

	private getEmbeddedMarkdownDateNavigationPropertyValue(propertyId: string): unknown {
		if (!this.containerEl.closest(".internal-embed, .markdown-embed")) {
			return null;
		}

		const hostFile = this.getContainingMarkdownFile();
		if (!hostFile) {
			return null;
		}

		const frontmatter = this.plugin.app.metadataCache.getFileCache(hostFile)?.frontmatter;
		if (!frontmatter) {
			return null;
		}

		const propertyNames = [
			propertyId,
			this.propertyMapper.basesToTaskCardProperty(propertyId),
			propertyId.replace(/^(note\.|task\.)/, ""),
		];

		for (const propertyName of new Set(propertyNames)) {
			if (Object.prototype.hasOwnProperty.call(frontmatter, propertyName)) {
				return frontmatter[propertyName];
			}
		}

		return null;
	}

	private getContainingMarkdownFile(): Nullable<TFile> {
		const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");
		for (const leaf of leaves) {
			const view = leaf.view as { containerEl?: HTMLElement; file?: unknown };
			if (!view.containerEl?.contains(this.containerEl)) {
				continue;
			}

			if (view.file instanceof TFile && view.file.extension === "md") {
				return view.file;
			}
		}

		return null;
	}

	private getNavigationConfigState(): CalendarRecreateNavigationState {
		return getCalendarRecreateNavigationState(this.viewOptions);
	}

	/** Rebuilds the items for the visible range. Later calls supersede earlier ones still building. */
	private async refetchEvents(): Promise<void> {
		const calendar = this.calendar;
		if (!calendar) return;
		const seq = ++this.refetchSeq;
		const view = calendar.getView();
		this.visibleView = view;
		try {
			const events = await this.buildAllEvents(view);
			if (seq !== this.refetchSeq || this.calendar !== calendar) return;
			this.setCalendarItems(toCalendarItems(events));
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error fetching events:", {
				category: "provider",
				operation: "fetching-events",
				error: error,
			});
		}
	}

	private async buildAllEvents(view: ViewInfo): Promise<CalendarEventInput[]> {
		const allEvents: CalendarEventInput[] = [];
		const { range } = view;

		this.taskProjection.setContext({
			timezone: this.calendarTimezone,
			now: new Date().toISOString(),
			settings: {
				...this.viewOptions,
				calendarView: viewToBases(view.type) ?? this.viewOptions.calendarView,
				completedStatuses: this.plugin.statusManager.getCompletedStatuses(),
				hideCompletedFromOverdue: this.plugin.settings.hideCompletedFromOverdue,
			},
			materializedOccurrences: this.getMaterializedOccurrences(),
		});
		this.taskProjection.setTasks(this.currentTasks);

		if (this.viewOptions.showTimeblocks) {
			allEvents.push(...await generateTimeblockEvents(this.plugin, range.start, range.end));
		}

		// Add property-based events from non-TaskNotes items
		if (this.viewOptions.showPropertyBasedEvents && this.viewOptions.startDateProperty) {
			const propertyEvents = await this.buildPropertyBasedEvents();
			applyBasesSortIndexesToCalendarEvents(propertyEvents, this.basesSortIndexByPath);
			allEvents.push(...propertyEvents);
		}

		const hasExternalCalendarEvents = Boolean(
			this.plugin.icsSubscriptionService?.getAllEvents().length ||
				this.plugin.googleCalendarService?.getAllEvents().length ||
				this.plugin.microsoftCalendarService?.getAllEvents().length
		);
		const relatedNoteCountsByEventId = hasExternalCalendarEvents
			? await this.plugin.icsNoteService.getRelatedNoteCountsByEventId()
			: new Map<string, number>();

		// Add ICS calendar events
		if (this.plugin.icsSubscriptionService) {
			allEvents.push(
				...buildExternalCalendarEvents({
					events: this.plugin.icsSubscriptionService.getAllEvents(),
					provider: "ics",
					plugin: this.plugin,
					toggles: this.icsCalendarToggles,
					relatedNoteCountsByEventId,
				})
			);
		}

		// Add Google Calendar events
		if (this.plugin.googleCalendarService) {
			allEvents.push(
				...buildExternalCalendarEvents({
					events: this.plugin.googleCalendarService.getAllEvents(),
					provider: "google",
					plugin: this.plugin,
					toggles: this.googleCalendarToggles,
					relatedNoteCountsByEventId,
				})
			);
		}

		// Add Microsoft Calendar events
		if (this.plugin.microsoftCalendarService) {
			allEvents.push(
				...buildExternalCalendarEvents({
					events: this.plugin.microsoftCalendarService.getAllEvents(),
					provider: "microsoft",
					plugin: this.plugin,
					toggles: this.microsoftCalendarToggles,
					relatedNoteCountsByEventId,
				})
			);
		}

		this.nonTaskEvents = filterAllDayEventsForCalendarView(
			allEvents,
			viewToBases(view.type) ?? this.viewOptions.calendarView,
			this.viewOptions.showAllDaySlot
		);
		return this.buildVisibleEvents(view);
	}

	private buildVisibleEvents(view: ViewInfo): CalendarEventInput[] {
		const taskEvents = this.buildTaskEvents(view);
		const isLinked = buildLinkedGoogleEventPredicate(
			taskEvents.flatMap(event => {
				const props = event.extendedProps;
				const task = props && "taskInfo" in props ? props.taskInfo : undefined;
				return task && ["scheduled", "due", "scheduledToDueSpan", "recurring"].includes(event.extendedProps?.eventType ?? "")
					? [{ task, date: String(event.start) }]
					: [];
			}),
			this.plugin
		);
		return [...taskEvents, ...this.nonTaskEvents.filter(event => {
			const props = event.extendedProps;
			return !props || !("icsEvent" in props) || !props.icsEvent || !isLinked(props.icsEvent);
		})];
	}

	private getMaterializedOccurrences(): Record<string, string[]> {
		return calendarMaterializedOccurrences(this.identityTasks, (link, source) =>
			this.plugin.app.metadataCache.getFirstLinkpathDest(link, source)?.path);
	}

	private buildTaskEvents(view: ViewInfo): CalendarEventInput[] {
		const tasks = new Map(this.currentTasks.map(task => [calendarTaskId(task), task]));
		const events = this.taskProjection.entriesInRange({
			start: view.range.start.toISOString(), end: view.range.end.toISOString(),
		}).flatMap(entry => {
			const task = tasks.get(entry.taskId);
			return task ? [calendarEntryToEvent(entry, task, {
				getPriorityColor: priority => this.plugin.priorityManager.getPriorityConfig(priority)?.color,
				getThemeTextColor: () => getEventTextColor(true),
			})] : [];
		});
		applyBasesSortIndexesToCalendarEvents(events, this.basesSortIndexByPath);
		return events;
	}

	private async buildPropertyBasedEvents(): Promise<CalendarEventInput[]> {
		if (!this.data?.data) return [];
		if (!this.viewOptions.startDateProperty) return [];

		const events: CalendarEventInput[] = [];

		for (const entry of this.data.data) {
			try {
				const file = entry.file;

				// Skip if no file
				if (!file) continue;

				const event = buildCalendarPropertyEvent({
					entry,
					file,
					startDateProperty: this.viewOptions.startDateProperty,
					endDateProperty: this.viewOptions.endDateProperty,
					titleProperty: this.viewOptions.titleProperty,
					getPropertyValue: (entry, propertyId) =>
						this.dataAdapter.getPropertyValue(entry, propertyId),
				});
				if (event) {
					events.push(event);
				}
			} catch (error) {
				tasknotesLogger.warn(
					`[TaskNotes][CalendarView] Error processing property-based entry:`,
					{
						category: "provider",
						operation: "processing-property-based-entry",
						error: error,
					}
				);
			}
		}

		return events;
	}

	private async updateCalendarEvents(_taskNotes: TaskInfo[]): Promise<void> {
		if (!this.calendar) return;

		this.calendar.setOptions({
			eventOrder: getTaskNotesCalendarEventOrder(this.dataAdapter.getSortConfig()),
		});
		await this.refetchEvents();
	}

	/**
	 * Refresh calendar with fresh data from Obsidian's metadata cache.
	 * Use this when task data has changed and calendar needs to reflect updates immediately.
	 * Bases' cache may be stale, so we read directly from metadataCache.
	 */
	private async refreshCalendarWithFreshData(updatedTask?: TaskInfo): Promise<void> {
		if (!this.calendar) return;

		try {
			if (!updatedTask) {
				// Query membership/order and unknown external edits go through Bases.
				await this.render();
				return;
			}
			const previous = this.currentTasks.find(task => task.path === updatedTask.path);
			const identityPrevious = this.identityTasks.find(task => task.path === updatedTask.path);
			this.identityTasks = this.identityTasks.filter(task => task.path !== updatedTask.path);
			this.identityTasks.push(updatedTask);
			if (identityPrevious?.recurrence_parent || updatedTask.recurrence_parent) {
				// Excluded children still affect the parent projection's materialization context.
				this.refreshMaterializationContext();
			}
			if (previous) {
				if (updatedTask.archived) {
					this.currentTasks = this.currentTasks.filter(task => task !== previous);
					this.taskProjection.remove(calendarTaskId(previous));
				} else {
					const next = { ...updatedTask, basesData: previous.basesData };
					this.currentTasks = this.currentTasks.map(task => task === previous ? next : task);
					if (calendarTaskId(previous) !== calendarTaskId(next)) this.taskProjection.remove(calendarTaskId(previous));
					this.taskProjection.upsert(next);
				}
			}
			// Do not refetch providers, timeblocks or every task's metadata on a single write.
			this.refreshTaskItems();
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error refreshing calendar:", {
				category: "provider",
				operation: "refreshing-calendar",
				error: error,
			});
		}
	}

	private refreshMaterializationContext(): void {
		this.taskProjection.setContext({
			...this.taskProjection.getContext(),
			materializedOccurrences: this.getMaterializedOccurrences(),
		});
	}

	private refreshTaskItems(): void {
		if (!this.calendar) return;
		++this.refetchSeq;
		const view = this.calendar.getView();
		this.setCalendarItems(toCalendarItems(this.buildVisibleEvents(view)));
	}

	private async refreshAfterExpectedCalendarTaskWrite(updatedTask: TaskInfo): Promise<void> {
		if (!this._expectingImmediateUpdate) return;

		this._expectingImmediateUpdate = false;
		await this.refreshCalendarWithFreshData(updatedTask);
	}

	private clearPendingCalendarRefreshTimers(): void {
		if (this.updateDebounceTimer) {
			window.clearTimeout(this.updateDebounceTimer);
			this.updateDebounceTimer = null;
		}
		if (this.dataUpdateDebounceTimer) {
			window.clearTimeout(this.dataUpdateDebounceTimer);
			this.dataUpdateDebounceTimer = null;
		}
	}

	private async refreshAfterDirectCalendarTaskWrite(updatedTask: TaskInfo): Promise<void> {
		this.clearPendingCalendarRefreshTimers();
		await this.refreshCalendarWithFreshData(updatedTask);
		this.clearPendingCalendarRefreshTimers();
	}

	private async handleEventClick(arg: ItemPointerArg<CalendarEventProps>): Promise<void> {
		if (isCalendarBatchTarget(arg.item.data) &&
			this.handleSelectionClick(toMouseEvent(arg.jsEvent, arg.el), arg.item.data.taskInfo.path)) return;
		await handleCalendarEventClick(this.getMenuContext(), arg);
	}

	private refetchWhenCreatedTimeblockIsIndexed(result: TimeblockCreationResult): void {
		const hasCreatedTimeblock = (): boolean => {
			const timeblocks = this.plugin.app.metadataCache.getFileCache(result.dailyNote)
				?.frontmatter?.timeblocks;
			return (
				Array.isArray(timeblocks) &&
				timeblocks.some((timeblock) => {
					if (!timeblock || typeof timeblock !== "object") {
						return false;
					}
					return (timeblock as { id?: unknown }).id === result.timeblock.id;
				})
			);
		};

		if (hasCreatedTimeblock()) {
			void this.refetchEvents();
			return;
		}

		const win = this.containerEl.ownerDocument.defaultView || window;
		let timeoutId: number | null = null;
		let changedRef: Nullable<EventRef> = null;
		let cleanedUp = false;

		const cleanup = () => {
			if (cleanedUp) {
				return;
			}
			cleanedUp = true;
			if (timeoutId !== null) {
				win.clearTimeout(timeoutId);
				timeoutId = null;
			}
			if (changedRef) {
				this.plugin.app.metadataCache.offref(changedRef);
				changedRef = null;
			}
		};

		changedRef = this.plugin.app.metadataCache.on("changed", (file) => {
			if (file.path !== result.dailyNote.path || !hasCreatedTimeblock()) {
				return;
			}
			cleanup();
			void this.refetchEvents();
		});

		timeoutId = win.setTimeout(() => {
			cleanup();
			void this.refetchEvents();
		}, CALENDAR_DATA_SIGNATURE_CHECK_MAX_MS);

		this.register(cleanup);
	}

	/** Schedules a task dragged in from outside the calendar, such as an inline task widget. */
	private async handleExternalTaskDrop(arg: ExternalDropArg<CalendarEventProps>): Promise<void> {
		const taskPath = getExternalTaskDropPath(arg.dataTransfer);
		if (!taskPath) return;

		try {
			const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
			if (!task) {
				tasknotesLogger.warn("[TaskNotes][CalendarView] Dropped task not found", {
					category: "persistence",
					operation: "external-task-drop",
				});
				return;
			}
			this.expectImmediateUpdate();
			const receipt = await captureTaskUndo(this.plugin, task, () => this.plugin.taskService.updateProperty(task, "scheduled", arg.startStr));
			if (receipt.task) await this.refreshAfterDirectCalendarTaskWrite(receipt.task);
			showTaskUndo(receipt.undo ? [receipt.undo] : [], false, 1, this.plugin.app.vault, task.title);
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error scheduling dropped task", {
				category: "persistence",
				operation: "external-task-drop",
				error,
			});
		}
	}

	private async handleEventDrop(info: CalendarEventChange): Promise<void> {
		this.batchPreview?.clear();
		if (this.batchMoveInProgress) {
			info.revert();
			return;
		}
		const selection = this.plugin.taskSelectionService;
		const path = info.oldEvent.extendedProps.taskInfo?.path;
		if (path && isCalendarBatchTarget(info.oldEvent.extendedProps) && selection?.isSelected(path) && selection.getSelectedPaths().length > 1) {
			await this.moveSelectedCalendarTasks(info, selection.getSelectedPaths());
			return;
		}
		await handleCalendarEventDrop(this.getMutationContext(), info);
	}

	private async moveSelectedCalendarTasks(info: CalendarEventChange, paths: string[]): Promise<void> {
		if (this.batchMoveInProgress) {
			info.revert();
			return;
		}
		this.batchMoveInProgress = true;
		const completed: CalendarBatchMove[] = [];
		const undo: Array<() => Promise<unknown>> = [];
		let planned = false;
		let failedTitle = "";
		try {
			const tasks = await Promise.all(paths.map(async path => {
				const task = await this.plugin.cacheManager.getTaskInfo(path);
				if (!task) throw new Error(`Task no longer exists: ${path}`);
				return task;
			}));
			// Validate the entire selection before the first write. Never silently skip hidden tasks.
			const moves = planCalendarBatchMove(this.getBatchCalendarItems(), tasks, info, this.calendarTimezone,
				this.plugin.fieldMapper.getMapping(), new Date().toISOString());
			planned = true;
			for (const move of moves) {
				failedTitle = move.task.title;
				const fresh = await this.plugin.cacheManager.getTaskInfo(move.task.path);
				if (!fresh || fresh.recurrence || fresh.scheduled !== move.before.scheduled || fresh.due !== move.before.due) {
					throw new Error("Task dates changed during batch move");
				}
				const receipt = await captureTaskUndo(this.plugin, fresh, () => this.plugin.taskService.applyCalendarEdit(fresh, move.entry, move.change, this.calendarTimezone));
				const updated = receipt.task;
				if (!updated) throw new Error("Calendar move was cancelled");
				if (receipt.undo) undo.push(receipt.undo);
				completed.push(move);
				await this.refreshAfterDirectCalendarTaskWrite(updated);
			}
		} catch (error) {
			info.revert();
			// The engine's revert restores the dragged item, not already-written
			// notes. Reproject successful writes so partial failure cannot show stale dates.
			if (completed.length) this.refreshTaskItems();
			tasknotesLogger.warn("Calendar batch move stopped", { category: "persistence", operation: "calendar-batch-move", error });
			if (!planned) {
				this.showUnsupportedCalendarBatchMove();
			}
		} finally {
			this.batchMoveInProgress = false;
			if (planned) showTaskUndo(undo, paths.length !== completed.length, completed.length, this.plugin.app.vault, paths.length !== completed.length ? failedTitle : undefined, undefined, completed.map(move => move.task.title));
		}
	}

	private showUnsupportedCalendarBatchMove(): void {
		new Notice(this.plugin.i18n.translate(msg({
			message: "Group moves require visible, non-recurring tasks with matching date markers. Keep the dragged task in the same all-day or timed area.",
			context: "views.basesCalendar.batchMoveUnsupported",
		})));
	}


	private async handleEventResize(info: CalendarEventChange): Promise<void> {
		if (this.batchMoveInProgress) {
			info.revert();
			return;
		}
		await handleCalendarEventResize(this.getMutationContext(), info);
	}

	private getMutationContext(): CalendarMutationContext {
		return {
			plugin: this.plugin, options: this.viewOptions, timezone: this.calendarTimezone,
			refreshTask: task => this.refreshAfterDirectCalendarTaskWrite(task),
			refreshEvent: event => {
				this.nonTaskEvents = this.nonTaskEvents.map(previous => previous.id === event.id ? {
					...previous,
					start: event.start?.toISOString() ?? previous.start,
					end: event.end?.toISOString(),
					allDay: event.allDay,
					extendedProps: event.extendedProps,
				} : previous);
				this.refreshTaskItems();
			},
		};
	}

	private handleDateSelect(info: SelectArg): void {
		if (info.view?.type === "month" && this.viewOptions.showMonthDayPanel && info.allDay &&
			info.end.getTime() - info.start.getTime() <= 25 * 60 * 60 * 1000) {
			this.selectMonthDay(info.startStr);
			return;
		}
		showCalendarCreationMenu({
			plugin: this.plugin,
			slotDuration: this.viewOptions.slotDuration,
			anchor: this.calendarEl ?? this.containerEl,
			unselect: () => this.calendar?.unselect(),
			onTaskCreated: (task) => this.refreshAfterDirectCalendarTaskWrite(task),
			onTimeblockCreated: (result) => this.refetchWhenCreatedTimeblockIsIndexed(result),
			expectImmediateUpdate: () => this.expectImmediateUpdate(),
		}, info);
	}

	private handleEventDidMount(arg: ItemArg<CalendarEventProps>): void {
		this.keyboard?.mount(arg);
		this.updateSelectionModeUI(Boolean(this.plugin.taskSelectionService?.isSelectionModeActive()));
		decorateCalendarEvent({ plugin: this.plugin, rootElement: this.rootElement, timeFormat: this.viewOptions.timeFormat === "12" ? "12" : "24" }, arg);
	}

	/** Right-click, the context-menu key or Shift+F10 on an event. */
	private handleEventContextMenu(arg: ItemPointerArg<CalendarEventProps>): void {
		const path = arg.item.data?.taskInfo?.path;
		if (path && isCalendarBatchTarget(arg.item.data) && this.plugin.taskSelectionService?.isSelected(path)) {
			this.showBatchContextMenu(toMouseEvent(arg.jsEvent, arg.el));
			return;
		}
		handleCalendarEventContextMenu(this.getMenuContext(), arg);
	}

	private getMenuContext(): CalendarMenuContext {
		return {
			plugin: this.plugin,
			expectImmediateUpdate: () => this.expectImmediateUpdate(),
			refresh: () => this.refreshCalendarWithFreshData(),
		};
	}

	/** List view rows render as the same cards the other TaskNotes views use. */
	private renderListItem(arg: ItemArg<CalendarEventProps>): Node | null {
		const card = createCalendarListEventCard({
			event: eventApiFromItem(arg.item),
			plugin: this.plugin,
			config: this.config,
			visibleProperties: this.getVisibleProperties(),
			basesEntryByPath: this.basesEntryByPath,
			buildTaskCardOptions: (options) => this.buildTaskCardOptions({ ...options, layout: "default" }),
			logDebug: (message, ...data) =>
				tasknotesLogger.debug(message, {
					category: "provider",
					operation: "mount-calendar-list-event-card",
					details: data.length > 0 ? { values: data } : undefined,
				}),
		});
		const task = arg.item.data?.taskInfo;
		if (card && task) {
			card.addEventListener("click", event => {
				const control = (event.target as Element).closest(DEFAULT_TASK_CLICK_EXCLUDE_SELECTOR);
				if (control && card.contains(control)) return;
				const selectable = isCalendarBatchTarget(arg.item.data);
				// TaskCard has its own Shift-click selection. Do not let it select a
				// recurrence preview or tracked-time row through this alternate route.
				if ((!selectable && event.shiftKey) || (selectable && this.handleSelectionClick(event, task.path))) {
					event.preventDefault();
					event.stopImmediatePropagation();
				}
			}, { capture: true });
		}
		arg.el.classList.toggle("tn-calendar-list-card", card !== null);
		if (card && task) {
			const entry = createElementInDocument(arg.el.ownerDocument, "div");
			entry.className = "tn-calendar-list-entry";
			const stamp = entry.createDiv({ cls: "tn-calendar-list-stamp" });
			if (arg.item.data?.eventType === "due") {
				const deadline = this.plugin.i18n.translate(msg({ message: "Deadline", context: "calendar event marker" }));
				const marker = stamp.createSpan({ cls: "tn-calendar-list-deadline" });
				setIcon(marker.createSpan(), "flag-triangle-right");
				marker.createSpan({ text: deadline });
				stamp.setAttribute("aria-label", `${deadline}: ${arg.timeText}`);
			} else if (arg.item.data?.eventType === "timeEntry" && arg.item.end) {
				const tracked = stamp.createSpan({ cls: "tn-calendar-list-tracked" });
				setIcon(tracked.createSpan(), "timer");
				const duration = (new Date(arg.item.end).getTime() - new Date(arg.item.start).getTime()) / 60000;
				tracked.createSpan({ text: uiText(msg({ message: "{value1} tracked", context: "ui/taskCardProperties: totalTrackedTime display" }), { value1: this.plugin.formatTime(duration) }) });
			}
			if (arg.timeText) {
				const time = stamp.createSpan({ cls: "tn-calendar-list-time" });
				const [start, end] = arg.timeText.split(" – ");
				time.createSpan({ text: start });
				if (end) time.createSpan({ text: `– ${end}` });
			}
			entry.append(card);
			return entry;
		}
		return card;
	}


	protected setupContainer(): void {
		super.setupContainer();

		// Add calendar-specific classes and styles to root
		if (this.rootElement) {
			// Remove base classes that interfere with calendar layout, keep only what we need
			this.rootElement.className =
				"tn-bases-integration tasknotes-plugin advanced-calendar-view";
			this.rootElement.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-display-none-6b99de8b",
				"tn-static-flex-1-14e3b769",
				"tn-static-flex-direction-column-06c8b5ed",
				"tn-static-height-0-7a31cef0",
				"tn-static-height-100-62264068",
				"tn-static-height-12px-06c0747e",
				"tn-static-height-16px-30de4aee",
				"tn-static-height-24px-29a11d37"
			);
			this.rootElement.classList.add("tn-static-min-height-800px-997b4c8c");

			// Use correct document for pop-out window support
			const doc = this.containerEl.ownerDocument;

			// Calendar element for the calendar to render into
			const calendarEl = createElementInDocument(doc, "div");
			calendarEl.id = "bases-calendar";
			calendarEl.classList.remove(
				"tn-static-flex-1-97445a8d",
				"tn-static-margin-top-12px-91e0f558",
				"tn-static-min-height-800px-997b4c8c",
				"tn-static-overflow-hidden-69824400"
			);
			calendarEl.classList.add("tn-static-flex-1-14e3b769");
			this.rootElement.appendChild(calendarEl);
			this.calendarEl = calendarEl;
			this.applyLayoutClasses();
		}
	}

	protected async handleTaskUpdate(
		task: TaskInfo,
		_source?: BasesTaskUpdateSource
	): Promise<void> {
		if (this._expectingImmediateUpdate) {
			await this.refreshAfterExpectedCalendarTaskWrite(task);
			return;
		}

		await this.refreshCalendarWithFreshData(task);
	}

	protected debouncedRefresh(): void {
		if (this.updateDebounceTimer) {
			window.clearTimeout(this.updateDebounceTimer);
		}

		const win = this.containerEl.ownerDocument.defaultView || window;
		this.updateDebounceTimer = win.setTimeout(() => {
			this.updateDebounceTimer = null;
			this.renderPreservingEphemeralState();
		}, 300);
	}

	private renderPreservingEphemeralState(): void {
		const savedState = this.getEphemeralState();
		void this.render()
			.catch((error: unknown) => {
				tasknotesLogger.error("[TaskNotes][CalendarView] Render error:", {
					category: "provider",
					operation: "render",
					error: error,
				});
				this.renderError(error instanceof Error ? error : new Error(String(error)));
			})
			.finally(() => this.setEphemeralState(savedState));
	}

	renderError(error: Error): void {
		if (!this.calendarEl) return;

		// Use correct document for pop-out window support
		const doc = this.calendarEl.ownerDocument;
		const errorEl = createElementInDocument(doc, "div");
		errorEl.className = "tn-bases-error";
		errorEl.classList.remove(
			"tn-static-border-radius-4px-c290c56e",
			"tn-static-border-radius-6px-0dc8408c",
			"tn-static-color-var-color-accent-d2cad743",
			"tn-static-color-var-text-accent-65b47ee3",
			"tn-static-color-var-text-muted-5872de20",
			"tn-static-color-var-text-on-accent-f3e1679d",
			"tn-static-color-var-text-warning-783d5f03",
			"tn-static-color-var-tn-text-muted-a90fb6f3",
			"tn-static-color-white-0a43e56a",
			"tn-static-cursor-pointer-2723efcc",
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-0-11696618",
			"tn-static-margin-0-auto-266e9b04",
			"tn-static-margin-0-db0d5f36",
			"tn-static-margin-0-var-size-4-2-77f7dc08",
			"tn-static-margin-2px-0-edce9b14",
			"tn-static-margin-8px-0-0-0-a2eb8382",
			"tn-static-padding-0-16px-16px-16px-f1aa998c",
			"tn-static-padding-0-41d7d7e2",
			"tn-static-padding-12px-43bef435",
			"tn-static-padding-16px-287f770e",
			"tn-static-padding-20px-769fed37",
			"tn-static-padding-20px-7a035d95",
			"tn-static-padding-2px-8px-c8eea84a",
			"tn-static-padding-2rem-42aa6d9c"
		);
		errorEl.classList.add("tn-static-padding-20px-ebe8e48c");
		errorEl.textContent = uiText(msg({ message: "Error loading calendar: {message}", context: "bases/CalendarView: CalendarView.renderError display" }), { message: displayError(error.message || "Unknown error") });
		this.calendarEl.appendChild(errorEl);
	}

	onunload(): void {
		this.destroyDayPanel();
		// Note: We intentionally do NOT call config.set() here (issue #1397)
		// The Bases API has a bug where config objects can point to wrong files,
		// causing view corruption when config.set() writes to unrelated .base files.
		// View type is saved during active use via debouncedSaveViewType() instead.

		// Clean up any pending view type save timer
		if (this._saveViewTypeTimer) {
			window.clearTimeout(this._saveViewTypeTimer);
			this._saveViewTypeTimer = null;
		}

		// Component.register() calls will be automatically cleaned up

		if (this.calendar) {
			this.calendar.destroy();
			this.calendar = null;
		}

		this.visibleView = null;
		this.calendarEl = null;
		this.currentTasks = [];
		this.identityTasks = [];
		this.nonTaskEvents = [];
		this.taskProjection.clear();
	}

	/**
	 * Get ephemeral state to preserve across view reloads.
	 * Saves current calendar date and scroll position.
	 * The view type is intentionally omitted because it is owned by the Bases
	 * view config. Restoring it from workspace state can override configured
	 * defaults after Workspace switches.
	 */
	getEphemeralState(): unknown {
		const baseState = super.getEphemeralState();
		const baseStateObject = isRecord(baseState) ? baseState : {};

		if (this.calendar) {
			const currentDate = this.calendar.getDate();

			return {
				...baseStateObject,
				calendarDate: currentDate ? currentDate.toISOString() : null,
				calendarScroll: this.calendar.getScroll(),
			};
		}

		return baseState;
	}

	/**
	 * Restore ephemeral state after view reload.
	 * Restores calendar date and scroll position.
	 */
	setEphemeralState(state: unknown): void {
		super.setEphemeralState(state);

		if (!isCalendarEphemeralState(state)) return;

		// Restore calendar date and view after calendar is initialized
		if (this.calendar) {
			if (typeof state.calendarDate === "string") {
				try {
					const restoredDate = new Date(state.calendarDate);
					if (restoredDate.getTime() !== this.calendar.getDate().getTime()) {
						this.calendar.gotoDate(restoredDate);
					}
				} catch (e) {
					tasknotesLogger.debug("[CalendarView] Failed to restore calendar date:", {
						category: "provider",
						operation: "restore-calendar-date",
						error: e,
					});
				}
			}

			// Intentionally ignore legacy `calendarView` ephemeral state. The view
			// type is controlled by the Bases view config and is persisted there
			// when the user changes Calendar view modes.
		}

		const scroll = state.calendarScroll;
		if (this.calendar && isCalendarScrollPosition(scroll)) {
			this.calendar.flush();
			this.calendar.setScroll(scroll);
		}
	}
}

// Factory function
/**
 * Factory function for Bases registration.
 * Returns an actual CalendarView instance adapted to the BasesView factory type.
 */
export function buildCalendarViewFactory(plugin: TaskNotesPlugin): BasesViewFactory {
	return function (controller: unknown, containerEl: HTMLElement): BasesView {
		if (!containerEl) {
			tasknotesLogger.error("[TaskNotes][CalendarView] No containerEl provided", {
				category: "provider",
				operation: "no-containerel-provided",
			});
			throw new Error("CalendarView requires a containerEl");
		}

		// Create and return the view instance directly; Bases assigns runtime view fields.
		return new CalendarView(controller, containerEl, plugin) as unknown as BasesView;
	};
}
