import { displayError } from "../i18n/runtime";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import TaskNotesPlugin from "../main";
import { createElementInDocument } from "../utils/documentDom";
import type { BasesEntry, BasesView, BasesViewFactory } from "obsidian";
import { BasesViewBase } from "./BasesViewBase";
import type { TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData } from "./helpers";
import type { TimeblockCreationResult } from "../modals/TimeblockCreationModal";
import {
	Calendar,
	basesLayoutOptions,
	viewToBases,
	type CalendarOptions,
	type ItemArg,
	type ItemPointerArg,
	type SelectArg,
	type ViewInfo,
} from "@tasknotes/calendar";
import {
	generateCalendarEvents,
	handleRecurringTaskDrop,
	handleTimeblockDrop,
	handleTimeblockResize,
	handleTimeblockCreation,
	handleTimeEntryCreation,
	handleDateTitleClick,
	getTargetDateForEvent,
	getOccurrenceDateForEvent,
	calculateTaskCreationValues,
	generateTaskTooltip,
	applyRecurringTaskStyling,
	applyTimeblockStyling,
	generateTimeblockTooltip,
	isTimeblockCopyModifierPressed,
	addTaskHoverPreview,
	showTimeblockInfoModal,
} from "./calendar-core";
import {
	buildProviderEventDateUpdate,
	getCalendarFrontmatterPropertyName,
	planPropertyEventDrop,
	planPropertyEventResize,
	planTaskCalendarDrop,
	planTaskCalendarResize,
	planTimeEntryDrop,
	planTimeEntryResize,
} from "./calendarMutationPlanning";
import { handleCalendarTaskClick } from "../utils/clickHandlers";
import { TaskCreationModal } from "../modals/TaskCreationModal";
import { CalendarEventCreationModal } from "../modals/CalendarEventCreationModal";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";
import { Menu, Platform, TFile, setIcon, setTooltip } from "obsidian";
import type { EventRef } from "obsidian";
import { format } from "date-fns";
import { TaskContextMenu } from "../components/TaskContextMenu";
import { ICSEventContextMenu } from "../components/ICSEventContextMenu";
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
import { buildExternalCalendarEvents, setProviderCalendarToggle } from "./calendarExternalEvents";
import {
	decorateCalendarIcsEventElement,
	getCalendarRelatedNoteTooltip,
	createCalendarListEventCard,
	normalizeCalendarRelatedNoteCount,
	type BasesEntryWithGetValue,
} from "./calendarEventMount";
import {
	eventApiFromItem,
	eventChangeFromArg,
	toCalendarItems,
	type CalendarEventChange,
	type CalendarEventInput,
	type CalendarEventProps,
} from "./calendarEngine";
import { CALENDAR_END_TIME_MAX_HOUR, normalizeCalendarTimeValue } from "../utils/calendarTime";
import { filterEmptyProjects, sanitizeForCssClass } from "../utils/helpers";
import { processVaultFrontMatter } from "../services/VaultMutationService";
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

export function suppressCalendarContextMenuOnMobile(element: HTMLElement): void {
	if (!Platform.isMobile) return;

	element.classList.add("tn-calendar-event-touch-target");
	element.addEventListener(
		"contextmenu",
		(event) => {
			event.preventDefault();
			event.stopImmediatePropagation();
		},
		{ capture: true }
	);
}

const CALENDAR_DATA_UPDATE_DEBOUNCE_MS = 5000;
const CALENDAR_DATA_SIGNATURE_CHECK_INTERVAL_MS = 250;
const CALENDAR_DATA_SIGNATURE_CHECK_MAX_MS = 2000;
const DEFAULT_CALENDAR_EVENT_ORDER = "start,-duration,allDay,title";
export const TASKNOTES_CALENDAR_SORT_INDEX = "tasknotesSortIndex";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function hasBasesCalendarSortConfig(sortConfig: unknown): boolean {
	return Array.isArray(sortConfig) ? sortConfig.length > 0 : Boolean(sortConfig);
}

export function getTaskNotesCalendarEventOrder(sortConfig: unknown): string {
	if (!hasBasesCalendarSortConfig(sortConfig)) {
		return DEFAULT_CALENDAR_EVENT_ORDER;
	}
	// Bases ranks break ties at the same placement. They must not put a timed
	// task ahead of an earlier appointment that has no Bases result index.
	return `start,allDay,${TASKNOTES_CALENDAR_SORT_INDEX},-duration,title`;
}

function getCalendarEventSortPath(event: CalendarEventInput): string | null {
	const extendedProps: unknown = event.extendedProps;
	if (!isRecord(extendedProps)) {
		return null;
	}

	const taskInfo = extendedProps.taskInfo;
	if (isRecord(taskInfo) && typeof taskInfo.path === "string") {
		return taskInfo.path;
	}

	return typeof extendedProps.filePath === "string" ? extendedProps.filePath : null;
}

export function applyBasesSortIndexesToCalendarEvents(
	events: CalendarEventInput[],
	sortIndexByPath: Map<string, number>
): void {
	if (sortIndexByPath.size === 0) {
		return;
	}

	for (const event of events) {
		const path = getCalendarEventSortPath(event);
		if (!path) {
			continue;
		}

		const sortIndex = sortIndexByPath.get(path);
		if (sortIndex === undefined) {
			continue;
		}

		event.extendedProps = Object.assign({}, event.extendedProps, {
			[TASKNOTES_CALENDAR_SORT_INDEX]: sortIndex,
		});
	}
}

export function shouldFilterAllDayEventsForCalendarView(
	viewType: string | undefined,
	showAllDaySlot: boolean
): boolean {
	return !showAllDaySlot && Boolean(viewType?.startsWith("list"));
}

export function filterAllDayEventsForCalendarView<T extends { allDay?: boolean }>(
	events: T[],
	viewType: string | undefined,
	showAllDaySlot: boolean
): T[] {
	if (!shouldFilterAllDayEventsForCalendarView(viewType, showAllDaySlot)) {
		return events;
	}

	return events.filter((event) => event.allDay !== true);
}

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

export function isTimeGridCalendarView(viewType: string): boolean {
	return (
		viewType === "timeGridWeek" || viewType === "timeGridCustom" || viewType === "timeGridDay"
	);
}

export function shouldHideCalendarTimeGrid(showTimeGrid: boolean, viewType: string): boolean {
	return !showTimeGrid && isTimeGridCalendarView(viewType);
}

export type CalendarHeightMode = "fill" | "auto";

export function normalizeCalendarHeightMode(value: unknown): CalendarHeightMode {
	return typeof value === "string" && value.trim().toLowerCase() === "auto" ? "auto" : "fill";
}

export function resolveEffectiveCalendarHeightMode(
	heightMode: CalendarHeightMode,
	calendarView: string,
	containerEl?: HTMLElement | null
): CalendarHeightMode {
	if (heightMode === "auto") {
		return "auto";
	}

	const isEmbedded = !!containerEl?.closest(".internal-embed, .markdown-embed");
	return isEmbedded ? "auto" : "fill";
}

/** The pointer or key event behind a calendar action, as a mouse event for Obsidian menus and click handlers. */
function toMouseEvent(ev: MouseEvent | KeyboardEvent | PointerEvent | null, anchor: HTMLElement): MouseEvent {
	if (ev && "button" in ev) return ev;
	const win = anchor.ownerDocument.defaultView ?? window;
	const rect = anchor.getBoundingClientRect();
	return new win.MouseEvent("click", {
		clientX: rect.left + Math.min(rect.width / 2, 24),
		clientY: rect.top + Math.min(rect.height / 2, 12),
		ctrlKey: ev?.ctrlKey,
		metaKey: ev?.metaKey,
		shiftKey: ev?.shiftKey,
		altKey: ev?.altKey,
	});
}

export class CalendarView extends BasesViewBase {
	type = "tasknotesCalendar";
	calendar: TaskCalendar | null = null; // Made public for factory access
	private calendarEl: HTMLElement | null = null;
	/** Range the current items were built for. */
	private visibleView: ViewInfo | null = null;
	private refetchSeq = 0;
	private currentTasks: TaskInfo[] = [];
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
	}

	/**
	 * Lifecycle: Handle view resize.
	 * The calendar observes its own size; this covers hosts that resize without layout changes.
	 */
	onResize(): void {
		this.calendar?.updateSize();
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
			this.viewOptions.calendarView = this.getConfigOption(
				"calendarView",
				this.viewOptions.calendarView
			);
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
					this.calendar.setOptions(this.buildCalendarOptions());
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

	private async initializeCalendar(taskNotes: TaskInfo[]): Promise<void> {
		if (!this.calendarEl) return;

		const initialDate = this.determineInitialDate(taskNotes);
		this.calendarEl.replaceChildren();
		this.calendar = new Calendar<CalendarEventProps>(this.calendarEl, {
			...this.buildCalendarOptions(),
			...(initialDate ? { date: initialDate } : {}),
		});
		this.applyLayoutClasses();
		await this.refetchEvents();
	}

	/** Layout, text and callbacks for the calendar, from the Bases view settings. */
	private buildCalendarOptions(): Partial<CalendarOptions<CalendarEventProps>> {
		const t = (key: string, fallback: string) => this.plugin.i18n.translate(key) || fallback;
		const options = this.viewOptions;
		const refreshLabel = t(
			"views.basesCalendar.hints.refresh",
			t("views.basesCalendar.buttonText.refresh", "Refresh calendar subscriptions")
		);
		return {
			...basesLayoutOptions<CalendarEventProps>(options, {
				embedded: this.getEffectiveHeightMode() === "auto",
			}),
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
						id: "refreshCalendars",
						text: t("views.basesCalendar.buttonText.refresh", "Refresh"),
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
				today: t("views.basesCalendar.today", "Today"),
				prev: t("views.basesCalendar.hints.prev", "Previous"),
				next: t("views.basesCalendar.hints.next", "Next"),
				views: {
					month: t("views.basesCalendar.buttonText.month", "Month"),
					week: t("views.basesCalendar.buttonText.week", "Week"),
					day: t("views.basesCalendar.buttonText.day", "Day"),
					year: t("views.basesCalendar.buttonText.year", "Year"),
					list: t("views.basesCalendar.buttonText.list", "List"),
					days: this.plugin.i18n.translate("views.basesCalendar.buttonText.customDays", {
						count: options.customDayCount.toString(),
					}),
				},
				viewHints: {
					month: t("views.basesCalendar.hints.month", "Month view"),
					week: t("views.basesCalendar.hints.week", "Week view"),
					day: t("views.basesCalendar.hints.day", "Day view"),
					year: t("views.basesCalendar.hints.year", "Year view"),
					list: t("views.basesCalendar.hints.list", "List view"),
				},
			},
			onRangeChange: (view) => {
				if (this.visibleView && sameRange(this.visibleView, view)) return;
				this.visibleView = view;
				void this.refetchEvents();
			},
			onViewChange: (view) => this.handleViewChange(view),
			onNavLink: (arg) => {
				if (arg.target === "month") {
					this.calendar?.changeView("month", arg.dateStr);
					return;
				}
				this.openDailyNoteFromDateLink(arg.date);
			},
			onItemClick: (arg) => {
				void this.handleEventClick(arg);
			},
			onItemContextMenu: (arg) => this.handleEventContextMenu(arg),
			onItemDrop: (arg) => this.handleEventDrop(eventChangeFromArg(arg, "drop")),
			onItemResize: (arg) => this.handleEventResize(eventChangeFromArg(arg, "resize")),
			onSelect: (arg) => this.handleDateSelect(arg),
			itemDidMount: (arg) => this.handleEventDidMount(arg),
			listItemContent: (arg) => this.renderListItem(arg),
		};
	}

	private handleViewChange(view: ViewInfo): void {
		const viewType = viewToBases(view.type);
		if (viewType && viewType !== this.viewOptions.calendarView) {
			this.viewOptions.calendarView = viewType;
			this.debouncedSaveViewType(viewType);
		}
		this.applyLayoutClasses();
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
			this.rootElement.classList.toggle("tn-static-min-height-800px-997b4c8c", !isAutoHeight);
		}

		this.calendarEl?.classList.toggle(
			"advanced-calendar-view__calendar--auto-height",
			isAutoHeight
		);
	}

	private applyTimeGridVisibilityClass(): void {
		const hideTimeGrid = shouldHideCalendarTimeGrid(
			this.viewOptions.showTimeGrid,
			this.viewOptions.calendarView
		);

		this.rootElement?.classList.toggle("advanced-calendar-view--hide-time-grid", hideTimeGrid);
		this.calendarEl?.classList.toggle(
			"advanced-calendar-view__calendar--hide-time-grid",
			hideTimeGrid
		);
	}

	private applyCalendarModeClass(): void {
		const isListView = this.viewOptions.calendarView.startsWith("list");
		this.rootElement?.classList.toggle("advanced-calendar-view--list", isListView);
		this.calendarEl?.classList.toggle("advanced-calendar-view__calendar--list", isListView);
	}

	private applyLayoutClasses(): void {
		this.applyHeightModeClass();
		this.applyTimeGridVisibilityClass();
		this.applyCalendarModeClass();
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
			this._saveViewTypeTimer = null;
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
			calendar.setItems(toCalendarItems(events));
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

		const eventConfig = {
			showScheduled: this.viewOptions.showScheduled,
			showDue: this.viewOptions.showDue,
			showScheduledToDueSpan: this.viewOptions.showScheduledToDueSpan,
			showRecurring: this.viewOptions.showRecurring,
			showCompletedRecurringInstances: this.viewOptions.showCompletedRecurringInstances,
			showSkippedRecurringInstances: this.viewOptions.showSkippedRecurringInstances,
			showTimeEntries: this.viewOptions.showTimeEntries,
			showTimeblocks: this.viewOptions.showTimeblocks,
			showICSEvents: false, // ICS handled separately
			showOverdueOnToday: this.viewOptions.showOverdueOnToday,
			visibleStart: range.start,
			visibleEnd: range.end,
			visibleStartDate: format(range.start, "yyyy-MM-dd"),
			visibleEndDate: format(range.end, "yyyy-MM-dd"),
		};

		// Use existing calendar-core helper to generate task events
		const taskEvents = await generateCalendarEvents(
			this.currentTasks,
			this.plugin,
			eventConfig
		);
		applyBasesSortIndexesToCalendarEvents(taskEvents, this.basesSortIndexByPath);
		allEvents.push(...taskEvents);

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

		return filterAllDayEventsForCalendarView(
			allEvents,
			viewToBases(view.type) ?? this.viewOptions.calendarView,
			this.viewOptions.showAllDaySlot
		);
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
			// Refresh each task from Obsidian's metadata cache (bypasses Bases' stale cache)
			const refreshedTasks: TaskInfo[] = [];
			let updatedTaskIncluded = false;
			for (const task of this.currentTasks) {
				const freshTask =
					updatedTask?.path === task.path
						? updatedTask
						: this.plugin.cacheManager.getCachedTaskInfoSync(task.path);
				if (freshTask) {
					if (freshTask.archived) {
						continue;
					}
					// Preserve basesData reference for formula access
					const taskWithBasesData = { ...freshTask, basesData: task.basesData };
					if (updatedTask?.path === freshTask.path) {
						updatedTaskIncluded = true;
					}
					refreshedTasks.push(taskWithBasesData);
				}
			}
			if (updatedTask?.path && !updatedTaskIncluded && !updatedTask.archived) {
				refreshedTasks.push(
					this.plugin.cacheManager.getCachedTaskInfoSync(updatedTask.path) ?? updatedTask
				);
			}
			this.currentTasks = refreshedTasks;
			await this.refetchEvents();
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error refreshing calendar:", {
				category: "provider",
				operation: "refreshing-calendar",
				error: error,
			});
		}
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
		const event = eventApiFromItem(arg.item);
		const { taskInfo, timeblock, eventType, filePath, icsEvent, subscriptionName } =
			event.extendedProps;
		const jsEvent = toMouseEvent(arg.jsEvent, arg.el);

		// Handle timeblock click
		if (eventType === "timeblock" && timeblock) {
			const eventStart = event.start;
			if (!eventStart) return;
			const originalDate = format(eventStart, "yyyy-MM-dd");
			void showTimeblockInfoModal(timeblock, eventStart, originalDate, this.plugin, () =>
				this.expectImmediateUpdate()
			);
			return;
		}

		// Handle time entry click - left click opens time entry modal
		if (eventType === "timeEntry" && taskInfo && jsEvent.button === 0) {
			this.plugin.openTimeEntryEditor(taskInfo, () => this.expectImmediateUpdate());
			return;
		}

		// Handle ICS event click - show info modal
		if (eventType === "ics" && icsEvent) {
			const modal = new ICSEventInfoModal(
				this.plugin.app,
				this.plugin,
				icsEvent,
				subscriptionName
			);
			modal.open();
			return;
		}

		// Handle property-based event click - open file directly
		if (eventType === "property-based" && filePath) {
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				const isModKey = jsEvent.ctrlKey || jsEvent.metaKey;
				const newLeaf = isModKey || jsEvent.button === 1; // Ctrl/Cmd+click or middle click
				void this.plugin.app.workspace.getLeaf(newLeaf).openFile(file);
			}
			return;
		}

		// Handle task click with single/double click detection based on user settings
		if (taskInfo?.path && jsEvent.button === 0) {
			void handleCalendarTaskClick(taskInfo, this.plugin, jsEvent, event.id, () =>
				this.expectImmediateUpdate()
			);
		}
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

	private async handleEventDrop(info: CalendarEventChange): Promise<void> {
		if (!info.event.extendedProps) {
			tasknotesLogger.warn("[TaskNotes][CalendarView] Event dropped without extendedProps", {
				category: "provider",
				operation: "event-dropped-without-extendedprops",
			});
			return;
		}

		const {
			taskInfo,
			timeblock,
			eventType,
			isRecurringInstance,
			isNextScheduledOccurrence,
			isPatternInstance,
			filePath,
			icsEvent,
		} = info.event.extendedProps;

		// Handle timeblock drops
		if (eventType === "timeblock") {
			if (!info.oldEvent.start || !timeblock) {
				info.revert();
				return;
			}
			const originalDate = format(info.oldEvent.start, "yyyy-MM-dd");
			await handleTimeblockDrop(
				info,
				timeblock,
				originalDate,
				this.plugin,
				info.isPointer && isTimeblockCopyModifierPressed(info.jsEvent ?? undefined)
			);
			return;
		}

		// Handle property-based event drops
		if (eventType === "property-based" && filePath) {
			try {
				const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
				if (!file || !(file instanceof TFile)) {
					info.revert();
					return;
				}

				// Get property IDs
				const startDateProperty = this.viewOptions.startDateProperty;
				const endDateProperty = this.viewOptions.endDateProperty;

				const startProp = getCalendarFrontmatterPropertyName(startDateProperty);
				const endProp = getCalendarFrontmatterPropertyName(endDateProperty);
				if (!startProp) {
					info.revert();
					return;
				}

				const oldStart = info.oldEvent.start;
				const newStart = info.event.start;
				if (!oldStart || !newStart) {
					info.revert();
					return;
				}

				// Update frontmatter
				await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
					const plan = planPropertyEventDrop({
						frontmatter,
						startProperty: startProp,
						endProperty: endProp,
						oldStart,
						newStart,
						allDay: info.event.allDay,
					});
					if (plan.kind === "update-frontmatter") {
						for (const [property, value] of Object.entries(plan.updates)) {
							frontmatter[property] = value;
						}
					}
				});
			} catch (error) {
				tasknotesLogger.error(
					"[TaskNotes][CalendarView] Error updating property-based event:",
					{
						category: "provider",
						operation: "updating-property-based-event",
						error: error,
					}
				);
				info.revert();
			}
			return;
		}

		// Handle calendar provider event drops (Google, Microsoft, etc.)
		if (eventType === "ics" && icsEvent) {
			const provider = this.plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
			if (provider) {
				try {
					const { calendarId, eventId } = provider.extractEventIds(icsEvent);
					const providerUpdate = buildProviderEventDateUpdate({
						start: info.event.start,
						end: info.event.end,
						allDay: info.event.allDay,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
					});
					if (providerUpdate.kind === "revert") {
						info.revert();
						return;
					}

					await provider.updateEvent(calendarId, eventId, providerUpdate.updates);
				} catch (error) {
					tasknotesLogger.error(
						`[TaskNotes][CalendarView] Error updating ${provider.providerName} event:`,
						{ category: "provider", operation: "updating", error: error }
					);
					info.revert();
				}
				return;
			} else {
				// ICS event without provider, block move
				info.revert();
				return;
			}
		}

		// Handle time entry drops
		if (eventType === "timeEntry") {
			if (!taskInfo) {
				info.revert();
				return;
			}
			const plan = planTimeEntryDrop({
				timeEntries: taskInfo.timeEntries,
				timeEntryIndex: info.event.extendedProps.timeEntryIndex,
				oldStart: info.oldEvent.start,
				newStart: info.event.start,
				newEnd: info.event.end,
			});
			if (plan.kind === "revert") {
				info.revert();
				return;
			}
			if (plan.kind === "update-time-entries") {
				try {
					const updatedTask = await this.plugin.taskService.updateTask(taskInfo, {
						timeEntries: plan.timeEntries,
					});
					await this.refreshAfterDirectCalendarTaskWrite(updatedTask);
				} catch (error) {
					tasknotesLogger.error("Error updating time entry:", {
						category: "provider",
						operation: "updating-time-entry",
						error: error,
					});
					info.revert();
				}
			}
			return;
		}

		// Handle recurring task drops
		const isMaterializedOccurrenceTaskEvent = Boolean(
			taskInfo?.recurrence_parent && taskInfo?.occurrence_date
		);
		if (
			taskInfo &&
			!isMaterializedOccurrenceTaskEvent &&
			(isRecurringInstance || isNextScheduledOccurrence || isPatternInstance)
		) {
			await handleRecurringTaskDrop(info, taskInfo, this.plugin);
			return;
		}

		// Handle normal task drops (scheduled and due dates)
		if (taskInfo) {
			try {
				const plan = planTaskCalendarDrop({
					eventType,
					taskInfo,
					newStart: info.event.start,
					oldStart: info.oldEvent.start,
					allDay: info.event.allDay,
				});
				if (plan.kind === "revert") {
					info.revert();
					return;
				}
				if (plan.kind === "update-date-property") {
					const updatedTask = await this.plugin.taskService.updateProperty(
						taskInfo,
						plan.property,
						plan.value
					);
					await this.refreshAfterDirectCalendarTaskWrite(updatedTask);
				} else if (plan.kind === "update-scheduled-due-span") {
					const spanFile = this.plugin.app.vault.getAbstractFileByPath(taskInfo.path);
					if (spanFile instanceof TFile) {
						const scheduledField = this.plugin.fieldMapper.toUserField("scheduled");
						const dueField = this.plugin.fieldMapper.toUserField("due");

						await processVaultFrontMatter(this.plugin.app, spanFile, (frontmatter) => {
							if (plan.scheduled) frontmatter[scheduledField] = plan.scheduled;
							if (plan.due) frontmatter[dueField] = plan.due;
						});
						await this.refreshAfterDirectCalendarTaskWrite({
							...taskInfo,
							scheduled: plan.scheduled ?? taskInfo.scheduled,
							due: plan.due ?? taskInfo.due,
						});
					}
				}
			} catch (error) {
				tasknotesLogger.error("[TaskNotes][CalendarView] Error updating task date:", {
					category: "provider",
					operation: "updating-task-date",
					error: error,
				});
				info.revert();
			}
		}
	}

	private async handleEventResize(info: CalendarEventChange): Promise<void> {
		if (!info.event.extendedProps) {
			tasknotesLogger.warn("[TaskNotes][CalendarView] Event resized without extendedProps", {
				category: "provider",
				operation: "event-resized-without-extendedprops",
			});
			return;
		}

		const { taskInfo, timeblock, eventType, filePath, timeEntryIndex, icsEvent } =
			info.event.extendedProps;

		// Handle time entry resize
		if (eventType === "timeEntry") {
			if (!taskInfo) {
				info.revert();
				return;
			}
			const plan = planTimeEntryResize({
				timeEntries: taskInfo.timeEntries,
				timeEntryIndex,
				newStart: info.event.start,
				newEnd: info.event.end,
			});
			if (plan.kind === "revert") {
				info.revert();
				return;
			}
			if (plan.kind === "update-time-entries") {
				try {
					const updatedTask = await this.plugin.taskService.updateTask(taskInfo, {
						timeEntries: plan.timeEntries,
					});
					await this.refreshAfterDirectCalendarTaskWrite(updatedTask);
				} catch (error) {
					tasknotesLogger.error("Error resizing time entry:", {
						category: "provider",
						operation: "resizing-time-entry",
						error: error,
					});
					info.revert();
				}
			}
			return;
		}

		// Handle timeblock resize
		if (eventType === "timeblock") {
			if (!info.event.start || !timeblock) {
				info.revert();
				return;
			}
			const originalDate = format(info.event.start, "yyyy-MM-dd");
			await handleTimeblockResize(info, timeblock, originalDate, this.plugin);
			return;
		}

		// Handle property-based event resize
		if (eventType === "property-based" && filePath) {
			try {
				const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
				if (!file || !(file instanceof TFile)) {
					info.revert();
					return;
				}

				const endDateProperty = this.viewOptions.endDateProperty;
				const endProp = getCalendarFrontmatterPropertyName(endDateProperty);
				const plan = planPropertyEventResize({
					endProperty: endProp,
					newEnd: info.event.end,
					allDay: info.event.allDay,
				});
				if (plan.kind === "revert") {
					info.revert();
					return;
				}
				if (plan.kind === "ignore") {
					return;
				}

				// Update frontmatter
				await processVaultFrontMatter(this.plugin.app, file, (frontmatter) => {
					for (const [property, value] of Object.entries(plan.updates)) {
						frontmatter[property] = value;
					}
				});
			} catch (error) {
				tasknotesLogger.error(
					"[TaskNotes][CalendarView] Error resizing property-based event:",
					{
						category: "provider",
						operation: "resizing-property-based-event",
						error: error,
					}
				);
				info.revert();
			}
			return;
		}

		// Handle calendar provider event resize (Google, Microsoft, etc.)
		if (eventType === "ics" && icsEvent) {
			const provider = this.plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
			if (provider) {
				try {
					const { calendarId, eventId } = provider.extractEventIds(icsEvent);
					const providerUpdate = buildProviderEventDateUpdate({
						start: info.event.start,
						end: info.event.end,
						allDay: info.event.allDay,
						timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
						requireEnd: true,
					});
					if (providerUpdate.kind === "revert") {
						info.revert();
						return;
					}

					await provider.updateEvent(calendarId, eventId, providerUpdate.updates);
				} catch (error) {
					tasknotesLogger.error(
						`[TaskNotes][CalendarView] Error resizing ${provider.providerName} event:`,
						{ category: "provider", operation: "resizing", error: error }
					);
					info.revert();
				}
				return;
			}
		}

		const plan = planTaskCalendarResize({
			eventType,
			start: info.event.start,
			end: info.event.end,
			allDay: info.event.allDay,
		});
		if (plan.kind === "revert") {
			info.revert();
			return;
		}
		if (plan.kind === "ignore") {
			return;
		}
		if (!taskInfo) {
			info.revert();
			return;
		}

		// Handle task resize (update time estimate)
		try {
			const updatedTask = await this.plugin.taskService.updateProperty(
				taskInfo,
				"timeEstimate",
				plan.value
			);
			await this.refreshAfterDirectCalendarTaskWrite(updatedTask);
		} catch (error) {
			tasknotesLogger.error("[TaskNotes][CalendarView] Error updating task duration:", {
				category: "provider",
				operation: "updating-task-duration",
				error: error,
			});
			info.revert();
		}
	}

	private handleDateSelect(info: SelectArg): void {
		// Determine what type of event to create based on view
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle(this.plugin.i18n.translate(msg({ message: "Create task", context: "modals.taskCreation.title" })))
				.setIcon("check-square")
				.onClick(async () => {
					// Parse slot duration to get minutes (default to 30 if not set)
					const slotDurationParts = this.viewOptions.slotDuration.split(":");
					const slotDurationMinutes =
						parseInt(slotDurationParts[0]) * 60 + parseInt(slotDurationParts[1] || "0");

					const values = calculateTaskCreationValues(
						info.start,
						info.end,
						info.allDay,
						slotDurationMinutes
					);

					const modal = new TaskCreationModal(this.plugin.app, this.plugin, {
						prePopulatedValues: values,
						onTaskCreated: (task) => {
							void this.refreshAfterDirectCalendarTaskWrite(task);
						},
					});
					modal.open();
				});
		});

		// Only show timeblock option if timeblocking is enabled
		if (this.plugin.settings.calendarViewSettings.enableTimeblocking) {
			menu.addItem((item) => {
				item.setTitle(this.plugin.i18n.translate(msg({ message: "Create timeblock", context: "modals.timeblockCreation.heading" })))
					.setIcon("clock")
					.onClick(async () => {
						await handleTimeblockCreation(
							info.start,
							info.end,
							info.allDay,
							this.plugin,
							(result) => this.refetchWhenCreatedTimeblockIsIndexed(result)
						);
					});
			});
		}

		menu.addItem((item) => {
			item.setTitle(this.plugin.i18n.translate(msg({ message: "Create time entry", context: "ui.audit.createEntry" })))
				.setIcon("play")
				.onClick(async () => {
					this.expectImmediateUpdate();
					await handleTimeEntryCreation(info.start, info.end, info.allDay, this.plugin);
				});
		});

		// Show "Create calendar event" if any external calendars are connected
		const registry = this.plugin.calendarProviderRegistry;
		if (registry) {
			const hasWritableCalendars = registry
				.getAllProviders()
				.some((p) => p.getAvailableCalendars().length > 0);
			if (hasWritableCalendars) {
				menu.addSeparator();
				menu.addItem((item) => {
					item.setTitle(this.plugin.i18n.translate(msg({ message: "Create external calendar event", context: "ui.audit.createExternal" })))
						.setIcon("calendar-plus")
						.onClick(() => {
							const modal = new CalendarEventCreationModal(
								this.plugin.app,
								this.plugin,
								{
									start: info.start,
									end: info.end,
									allDay: info.allDay,
									onEventCreated: () => {
										this.expectImmediateUpdate();
										// Refresh provider data to show the new event
										void registry.refreshAll();
									},
								}
							);
							modal.open();
						});
				});
			}
		}

		menu.onHide(() => {
			this.calendar?.unselect();
		});

		const anchor = this.calendarEl ?? this.containerEl;
		menu.showAtMouseEvent(toMouseEvent(info.jsEvent, anchor));
	}

	private handleEventDidMount(arg: ItemArg<CalendarEventProps>): void {
		const extendedProps = arg.item.data;
		if (!extendedProps) return;
		const el = arg.el;
		const { taskInfo, timeblock, icsEvent, eventType, relatedNoteCount } = extendedProps;
		suppressCalendarContextMenuOnMobile(el);

		const relatedNoteTotal = normalizeCalendarRelatedNoteCount(relatedNoteCount);
		const viewType = viewToBases(arg.view.type) ?? arg.view.type;
		decorateCalendarIcsEventElement({
			element: el,
			viewType,
			icsEvent,
			relatedNoteCount: relatedNoteTotal,
			plugin: this.plugin,
		});

		// Set event type attribute
		el.setAttribute("data-event-type", eventType || "unknown");
		if (taskInfo?.path) {
			el.setAttribute("data-task-path", taskInfo.path);
			el.classList.add("fc-task-event");
		}

		// List rows are task cards with their own tooltips, previews and menus.
		if (arg.view.type === "list") return;

		// Handle timeblock events
		if (eventType === "timeblock" && timeblock) {
			applyTimeblockStyling(el, timeblock);
			setTooltip(el, generateTimeblockTooltip(timeblock), { placement: "top" });
			return;
		}

		// Add data attributes and classes for tasks
		if (taskInfo && taskInfo.path) {
			this.attachTaskEventHoverLink(el, taskInfo.path);

			// Add tag classes to tasks
			if (taskInfo.tags && taskInfo.tags.length > 0) {
				taskInfo.tags.forEach((tag: string) => {
					const sanitizedTag = tag.replace(/[^a-zA-Z0-9-_]/g, "");
					if (sanitizedTag) {
						el.classList.add(`fc-tag-${sanitizedTag}`);
					}
				});
			}

			filterEmptyProjects(taskInfo.projects || []).forEach((project) => {
				const sanitizedProject = sanitizeForCssClass(project);
				if (sanitizedProject) {
					el.classList.add(`fc-project-${sanitizedProject}`);
				}
			});

			// Apply recurring task styling (handles completion styling as well)
			applyRecurringTaskStyling(el, extendedProps);
		}

		// Add hover tooltip for tasks and ICS events
		if (taskInfo) {
			setTooltip(el, generateTaskTooltip(taskInfo, this.plugin));
		} else if (icsEvent) {
			const relatedNotesText =
				relatedNoteTotal > 0
					? `\n\n${getCalendarRelatedNoteTooltip(this.plugin, relatedNoteTotal)}`
					: "";
			const tooltipText = icsEvent.description
				? `${icsEvent.title}\n\n${icsEvent.description}${relatedNotesText}`
				: `${icsEvent.title}${relatedNotesText}`;
			setTooltip(el, tooltipText);
		}

		// Add hover preview for tasks (Ctrl+hover to preview daily note)
		if (taskInfo && eventType !== "ics") {
			addTaskHoverPreview(el, taskInfo, this.plugin, "tasknotes-bases-calendar");
		}

		// Add hover preview for property-based events (Ctrl+hover to preview note)
		const filePath = extendedProps.filePath;
		if (eventType === "property-based" && filePath) {
			el.addEventListener("mouseover", (event: MouseEvent) => {
				const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
				if (file) {
					this.plugin.app.workspace.trigger("hover-link", {
						event,
						source: "tasknotes-bases-calendar",
						hoverParent: el,
						targetEl: el,
						linktext: filePath,
						sourcePath: filePath,
					});
				}
			});
		}
	}

	/** Right-click, the context-menu key or Shift+F10 on an event. */
	private handleEventContextMenu(arg: ItemPointerArg<CalendarEventProps>): void {
		const extendedProps = arg.item.data;
		if (!extendedProps) return;
		const { taskInfo, icsEvent, eventType, filePath, subscriptionName } = extendedProps;
		const jsEvent = toMouseEvent(arg.jsEvent, arg.el);
		const event = eventApiFromItem(arg.item);

		if (taskInfo) {
			const contextMenu = new TaskContextMenu({
				task: taskInfo,
				plugin: this.plugin,
				targetDate: getTargetDateForEvent({ event }),
				occurrenceDate: getOccurrenceDateForEvent(taskInfo, { event }),
				promoteOccurrenceControls: Boolean(
					taskInfo.recurrence || (taskInfo.recurrence_parent && taskInfo.occurrence_date)
				),
				onUpdate: () => {
					void this.refreshCalendarWithFreshData();
				},
			});
			contextMenu.show(jsEvent);
			return;
		}

		if (icsEvent && eventType === "ics") {
			const contextMenu = new ICSEventContextMenu({
				icsEvent,
				plugin: this.plugin,
				subscriptionName,
				onUpdate: () => {
					void this.refreshCalendarWithFreshData();
				},
			});
			contextMenu.show(jsEvent);
			return;
		}

		if (eventType === "property-based" && filePath) {
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				const menu = new Menu();
				this.plugin.app.workspace.trigger("file-menu", menu, file, "tasknotes-bases-calendar");
				menu.showAtPosition({ x: jsEvent.clientX, y: jsEvent.clientY });
			}
		}
	}

	/** List view rows render as the same cards the other TaskNotes views use. */
	private renderListItem(arg: ItemArg<CalendarEventProps>): Node | null {
		const card = createCalendarListEventCard({
			event: eventApiFromItem(arg.item),
			plugin: this.plugin,
			config: this.config,
			visibleProperties: this.getVisibleProperties(),
			basesEntryByPath: this.basesEntryByPath,
			buildTaskCardOptions: (options) => this.buildTaskCardOptions(options),
			logDebug: (message, ...data) =>
				tasknotesLogger.debug(message, {
					category: "provider",
					operation: "mount-calendar-list-event-card",
					details: data.length > 0 ? { values: data } : undefined,
				}),
		});
		arg.el.classList.toggle("tn-calendar-list-card", card !== null);
		return card;
	}

	private attachTaskEventHoverLink(element: HTMLElement, taskPath: string): void {
		const setRelatedState = (active: boolean) => {
			const selector = `.fc-task-event[data-task-path="${CSS.escape(taskPath)}"]`;
			const relatedEvents = this.rootElement?.querySelectorAll<HTMLElement>(selector) ?? [];

			relatedEvents.forEach((relatedEvent) => {
				if (relatedEvent === element) {
					relatedEvent.classList.toggle("fc-task-event--hover-source", active);
				} else {
					relatedEvent.classList.toggle("fc-task-event--related-hover", active);
				}
			});
		};

		element.addEventListener("mouseenter", () => setRelatedState(true));
		element.addEventListener("mouseleave", () => setRelatedState(false));
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
		source?: BasesTaskUpdateSource
	): Promise<void> {
		if (this._expectingImmediateUpdate) {
			await this.refreshAfterExpectedCalendarTaskWrite(task);
			return;
		}

		if (source === "tasknotes-service") {
			await this.refreshCalendarWithFreshData(task);
			return;
		}

		this.debouncedRefresh();
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
					this.calendar.gotoDate(new Date(state.calendarDate));
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
