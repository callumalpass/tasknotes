import TaskNotesPlugin from "../main";
import type { BasesView, BasesViewFactory } from "obsidian";
import { BasesViewBase } from "./BasesViewBase";
import type { FieldMappingKey, TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData } from "./helpers";
import {
	Calendar as FullCalendar,
	CalendarOptions,
	type DateSelectArg,
	type EventClickArg,
	type EventDropArg,
	type EventInput,
	type EventMountArg,
	type EventSourceFuncArg,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, {
	type DropArg,
	type EventReceiveArg,
	type EventResizeDoneArg,
} from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";
import {
	generateCalendarEvents,
	handleRecurringTaskDrop,
	handleTimeblockDrop,
	handleTimeblockResize,
	handleTimeblockCreation,
	handleTimeEntryCreation,
	handleDateTitleClick,
	getTargetDateForEvent,
	calculateTaskCreationValues,
	generateTaskTooltip,
	applyRecurringTaskStyling,
	applyTimeblockStyling,
	generateTimeblockTooltip,
	isTimeblockCopyModifierPressed,
	addTaskHoverPreview,
	createICSEvent,
	showTimeblockInfoModal,
	attachDailyNoteHeaderLink,
	shiftTaskDatePreservingTime,
} from "./calendar-core";
import { handleCalendarTaskClick } from "../utils/clickHandlers";
import { TaskCreationModal } from "../modals/TaskCreationModal";
import { CalendarEventCreationModal } from "../modals/CalendarEventCreationModal";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";
import { Menu, Notice, Platform, TFile, setIcon, setTooltip } from "obsidian";
import { format } from "date-fns";
import { createTaskCard } from "../ui/TaskCard";
import { createICSEventCard } from "../ui/ICSCard";
import { createPropertyEventCard } from "../ui/PropertyEventCard";
import { createTimeBlockCard } from "../ui/TimeBlockCard";
import { TaskContextMenu } from "../components/TaskContextMenu";
import { ICSEventContextMenu } from "../components/ICSEventContextMenu";
import {
	formatDateForStorage,
	hasTimeComponent,
	parseDateToLocal,
	parseDateToUTC,
} from "../utils/dateUtils";
import {
	CalendarRecreateNavigationState,
	shouldPreserveVisibleDateOnCalendarRecreate,
} from "./calendarRecreateUtils";
import {
	getDisplayedTaskLinkedGoogleEventIds,
	isDisplayedTaskLinkedGoogleEvent,
} from "./calendarEventDeduplication";
import { CALENDAR_END_TIME_MAX_HOUR, normalizeCalendarTimeValue } from "../utils/calendarTime";
import type { CalendarEventData } from "../services/CalendarProvider";

type CalendarDataAdapterWithView = {
	basesView: CalendarView;
};

function getRelatedNoteTooltip(plugin: TaskNotesPlugin, relatedNoteCount: number): string {
	const label = plugin.i18n.translate("modals.icsEventInfo.relatedNotesHeading");
	return `${label}: ${relatedNoteCount}`;
}

function appendRelatedNoteIndicator(
	container: Element,
	plugin: TaskNotesPlugin,
	relatedNoteCount: number
): void {
	if (relatedNoteCount <= 0 || container.querySelector(".ics-related-note-indicator")) {
		return;
	}

	const doc = container.ownerDocument;
	const iconContainer = doc.createElement("span");
	iconContainer.classList.add("ics-related-note-indicator");
	iconContainer.setAttribute("aria-label", getRelatedNoteTooltip(plugin, relatedNoteCount));
	iconContainer.dataset.relatedNoteCount = String(relatedNoteCount);
	setIcon(iconContainer, "file-text");
	setTooltip(iconContainer, getRelatedNoteTooltip(plugin, relatedNoteCount), {
		placement: "top",
	});
	container.appendChild(iconContainer);
}

type BasesEntryValue = {
	data?: unknown;
};

type BasesEntryWithGetValue = {
	getValue?: (propertyId: string) => BasesEntryValue | undefined;
};

type CalendarEphemeralState = {
	calendarDate?: unknown;
	/** Legacy workspace state may contain this; view type is now config-owned. */
	calendarView?: unknown;
	calendarScroll?: unknown;
};

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

export type CalendarScrollPosition = {
	scrollTop: number;
	scrollLeft: number;
};

export type CalendarViewConfigReader = {
	get(key: string): unknown;
};

const CALENDAR_DATA_UPDATE_DEBOUNCE_MS = 5000;
const CALENDAR_DATA_SIGNATURE_CHECK_INTERVAL_MS = 250;
const CALENDAR_DATA_SIGNATURE_CHECK_MAX_MS = 2000;
const DEFAULT_CALENDAR_EVENT_ORDER = "start,-duration,allDay,title";
export const TASKNOTES_CALENDAR_SORT_INDEX = "tasknotesSortIndex";
const CALENDAR_DATA_SIGNATURE_FIELDS: FieldMappingKey[] = [
	"title",
	"status",
	"priority",
	"due",
	"scheduled",
	"contexts",
	"projects",
	"timeEstimate",
	"completedDate",
	"recurrence",
	"recurrenceAnchor",
	"timeEntries",
	"completeInstances",
	"skippedInstances",
	"blockedBy",
	"icsEventId",
	"googleCalendarEventId",
	"reminders",
	"sortOrder",
];
const CALENDAR_DATA_SIGNATURE_DEFAULT_FIELDS: Partial<Record<FieldMappingKey, string>> = {
	completeInstances: "complete_instances",
	recurrenceAnchor: "recurrence_anchor",
	skippedInstances: "skipped_instances",
};

const Calendar = FullCalendar;

type Calendar = {
	updateSize(): void;
	getDate(): Date;
	destroy(): void;
	render(): void;
	refetchEvents(): void;
	unselect(): void;
	changeView(viewType: string): void;
	gotoDate(date: Date): void;
	setOption(name: string, value: unknown): void;
	view?: {
		type?: string;
	};
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stripBasesPropertyPrefix(propertyId: string): string {
	const parts = propertyId.split(".");
	if (parts.length > 1 && ["note", "file", "formula"].includes(parts[0])) {
		return parts.slice(1).join(".");
	}
	return propertyId;
}

function getSignaturePropertyValue(
	properties: Record<string, unknown>,
	propertyId: string
): unknown {
	if (Object.prototype.hasOwnProperty.call(properties, propertyId)) {
		return properties[propertyId];
	}

	const strippedPropertyId = stripBasesPropertyPrefix(propertyId);
	if (
		strippedPropertyId !== propertyId &&
		Object.prototype.hasOwnProperty.call(properties, strippedPropertyId)
	) {
		return properties[strippedPropertyId];
	}

	return null;
}

function normalizeSignatureValue(value: unknown, seen = new WeakSet<object>()): unknown {
	if (value === undefined || typeof value === "function" || typeof value === "symbol") {
		return null;
	}

	if (typeof value === "bigint") {
		return value.toString();
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeSignatureValue(item, seen));
	}

	if (isRecord(value)) {
		if (seen.has(value)) {
			return "[Circular]";
		}
		seen.add(value);

		return Object.keys(value)
			.sort()
			.reduce<Record<string, unknown>>((normalized, key) => {
				normalized[key] = normalizeSignatureValue(value[key], seen);
				return normalized;
			}, {});
	}

	return value;
}

export function hasBasesCalendarSortConfig(sortConfig: unknown): boolean {
	return Array.isArray(sortConfig) ? sortConfig.length > 0 : Boolean(sortConfig);
}

export function getTaskNotesCalendarEventOrder(sortConfig: unknown): string {
	if (!hasBasesCalendarSortConfig(sortConfig)) {
		return DEFAULT_CALENDAR_EVENT_ORDER;
	}
	return `${TASKNOTES_CALENDAR_SORT_INDEX},${DEFAULT_CALENDAR_EVENT_ORDER}`;
}

function getCalendarEventSortPath(event: EventInput): string | null {
	const extendedProps = event.extendedProps;
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
	events: EventInput[],
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

		event.extendedProps = {
			...(isRecord(event.extendedProps) ? event.extendedProps : {}),
			[TASKNOTES_CALENDAR_SORT_INDEX]: sortIndex,
		};
	}
}

function isCalendarEphemeralState(value: unknown): value is CalendarEphemeralState {
	return isRecord(value);
}

function isCalendarScrollPosition(value: unknown): value is CalendarScrollPosition {
	return (
		isRecord(value) &&
		typeof value.scrollTop === "number" &&
		typeof value.scrollLeft === "number"
	);
}

export function readCalendarConfigValue(
	config: CalendarViewConfigReader | undefined,
	key: string
): unknown {
	if (!config || typeof config.get !== "function") {
		return undefined;
	}

	const directValue = config.get(key);
	if (directValue !== null && directValue !== undefined) {
		return directValue;
	}

	const options = config.get("options");
	if (!isRecord(options)) {
		return undefined;
	}

	return options[key];
}

export function getCalendarConfigValue<T>(
	config: CalendarViewConfigReader | undefined,
	key: string,
	fallback: T
): T {
	const value = readCalendarConfigValue(config, key);
	return value === null || value === undefined ? fallback : (value as T);
}

/**
 * Normalize date-like inputs to UTC-anchored strings for all-day values, or
 * to localized datetime strings for time-aware values.
 * Exported for testing.
 */
export function normalizeDateValueForCalendar(
	value: unknown
): { value: string | Date; isAllDay: boolean } | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;

		if (hasTimeComponent(trimmed)) {
			const parsed = parseDateToLocal(trimmed);
			if (isNaN(parsed.getTime())) return null;
			return { value: format(parsed, "yyyy-MM-dd'T'HH:mm"), isAllDay: false };
		}

		try {
			const anchored = parseDateToUTC(trimmed);
			return { value: formatDateForStorage(anchored), isAllDay: true };
		} catch {
			return null;
		}
	}

	if (typeof value === "number") {
		const date = new Date(value);
		if (isNaN(date.getTime())) return null;
		return { value: formatDateForStorage(date), isAllDay: true };
	}

	if (value instanceof Date) {
		if (isNaN(value.getTime())) return null;
		const hasTime =
			value.getHours() !== 0 ||
			value.getMinutes() !== 0 ||
			value.getSeconds() !== 0 ||
			value.getMilliseconds() !== 0;
		if (hasTime) {
			return { value: format(value, "yyyy-MM-dd'T'HH:mm"), isAllDay: false };
		}
		return { value: formatDateForStorage(value), isAllDay: true };
	}

	return null;
}

export interface CalendarDateValue {
	value: string | Date;
	isAllDay: boolean;
	sourceIndex?: number;
	fromList: boolean;
}

export interface PropertyEventDateSpan {
	start: CalendarDateValue;
	end?: CalendarDateValue;
	index: number;
	fromList: boolean;
}

function normalizeSingleCalendarDateValue(
	value: unknown,
	sourceIndex: number | undefined,
	fromList: boolean
): CalendarDateValue | null {
	const normalized = normalizeDateValueForCalendar(value);
	if (!normalized) return null;
	return {
		...normalized,
		sourceIndex,
		fromList,
	};
}

export function normalizeDateValuesForCalendar(value: unknown): CalendarDateValue[] {
	if (Array.isArray(value)) {
		return value
			.map((item, index) => normalizeSingleCalendarDateValue(item, index, true))
			.filter((item): item is CalendarDateValue => item !== null);
	}

	const normalized = normalizeSingleCalendarDateValue(value, undefined, false);
	return normalized ? [normalized] : [];
}

export function buildPropertyEventDateSpans(
	startValue: unknown,
	endValue?: unknown
): PropertyEventDateSpan[] {
	const starts = normalizeDateValuesForCalendar(startValue);
	if (starts.length === 0) return [];

	const ends = normalizeDateValuesForCalendar(endValue);
	const endValueIsList = Array.isArray(endValue);

	return starts.map((start, ordinal) => {
		const end = endValueIsList
			? ends.find((candidate) => candidate.sourceIndex === start.sourceIndex)
			: starts.length === 1
				? ends[0]
				: undefined;

		return {
			start,
			end,
			index: start.sourceIndex ?? ordinal,
			fromList: start.fromList || (end?.fromList ?? false),
		};
	});
}

function formatCalendarDateValue(dateValue: CalendarDateValue): string {
	return typeof dateValue.value === "string"
		? dateValue.value
		: format(dateValue.value, "yyyy-MM-dd'T'HH:mm");
}

export function shouldWidenTodayColumn(
	viewType: string,
	todayColumnWidthMultiplier: number
): boolean {
	if (todayColumnWidthMultiplier <= 1) return false;
	return viewType === "timeGridWeek" || viewType === "timeGridCustom";
}

export function isTimeGridCalendarView(viewType: string): boolean {
	return (
		viewType === "timeGridWeek" ||
		viewType === "timeGridCustom" ||
		viewType === "timeGridDay"
	);
}

export function shouldHideCalendarTimeGrid(showTimeGrid: boolean, viewType: string): boolean {
	return !showTimeGrid && isTimeGridCalendarView(viewType);
}

export type CalendarHeightMode = "fill" | "auto";

export type CalendarSizingOptions = {
	height: CalendarOptions["height"];
	contentHeight?: CalendarOptions["contentHeight"];
	expandRows: boolean;
};

export function normalizeCalendarHeightMode(value: unknown): CalendarHeightMode {
	return typeof value === "string" && value.trim().toLowerCase() === "auto"
		? "auto"
		: "fill";
}

export function getCalendarSizingOptions(
	heightMode: CalendarHeightMode
): CalendarSizingOptions {
	if (heightMode === "auto") {
		return {
			height: "auto",
			contentHeight: "auto",
			expandRows: false,
		};
	}

	return {
		height: "100%",
		expandRows: true,
	};
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
	return isEmbedded && calendarView === "listWeek" ? "auto" : "fill";
}

/**
 * Find the colgroup col element corresponding to a dated FullCalendar table cell.
 *
 * Cross-references the cell's position via cellIndex against its own table's
 * colgroup. This guarantees we never touch the time-axis col, which is at a
 * different cellIndex (typically 0 in timeGrid views) and has no [data-date]
 * attribute. Position-based slice math on colgroup cols is unsafe here because
 * the col indices can shift mid-render during view transitions, causing the
 * axis col to receive a width and the time labels to render in the middle of
 * the grid (issue #1742).
 *
 * Returns null if the cell is not in a table, the table has no direct-child
 * colgroup, or no col exists at the cell's cellIndex. The colgroup lookup is
 * restricted to the table's own children to avoid descending into nested
 * tables (e.g., user content rendered inside a calendar cell).
 */
export function findColForCell(cell: HTMLTableCellElement): HTMLTableColElement | null {
	const table = cell.closest("table");
	if (!table) return null;
	const colgroup = Array.from(table.children).find(
		(child) => child.tagName === "COLGROUP"
	);
	if (!colgroup) return null;
	const col = colgroup.children[cell.cellIndex];
	return col?.tagName === "COL" ? (col as HTMLTableColElement) : null;
}

export function isCalendarElementReadyForSizing(
	calendarEl: HTMLElement | null,
	containerEl: HTMLElement
): boolean {
	if (!calendarEl || !calendarEl.isConnected || !containerEl.isConnected) {
		return false;
	}

	if (calendarEl.ownerDocument !== containerEl.ownerDocument) {
		return false;
	}

	return calendarEl.clientWidth > 0 && calendarEl.clientHeight > 0;
}

type ExternalDropTaskPathSource = {
	dataTransfer?: DataTransfer | null;
	draggedEl?: HTMLElement | null;
	jsEvent?: MouseEvent | DragEvent | null;
};

function normalizeDroppedTaskPath(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

export function extractTaskPathFromExternalDrop(
	info: ExternalDropTaskPathSource
): string | undefined {
	const eventDataTransfer =
		info.jsEvent && "dataTransfer" in info.jsEvent
			? info.jsEvent.dataTransfer
			: null;
	const dataTransfer = info.dataTransfer || eventDataTransfer;
	const transferredTaskPath =
		normalizeDroppedTaskPath(dataTransfer?.getData("application/x-task-path")) ||
		normalizeDroppedTaskPath(dataTransfer?.getData("text/plain"));

	if (transferredTaskPath) {
		return transferredTaskPath;
	}

	const draggedEl = info.draggedEl;
	return (
		normalizeDroppedTaskPath(draggedEl?.dataset.taskPath) ||
		normalizeDroppedTaskPath(
			draggedEl?.closest<HTMLElement>("[data-task-path]")?.dataset.taskPath
		)
	);
}

function getCalendarScrollElements(calendarEl: HTMLElement | null): HTMLElement[] {
	if (!calendarEl) return [];

	return [
		calendarEl,
		...Array.from(calendarEl.querySelectorAll<HTMLElement>(".fc-scroller")),
	];
}

export function captureCalendarScrollState(
	calendarEl: HTMLElement | null
): CalendarScrollPosition[] {
	return getCalendarScrollElements(calendarEl).map((element) => ({
		scrollTop: element.scrollTop,
		scrollLeft: element.scrollLeft,
	}));
}

export function restoreCalendarScrollState(
	calendarEl: HTMLElement | null,
	scrollState: unknown
): void {
	if (!Array.isArray(scrollState)) return;

	const scrollElements = getCalendarScrollElements(calendarEl);
	scrollState.forEach((position, index) => {
		if (!isCalendarScrollPosition(position)) return;
		const element = scrollElements[index];
		if (!element) return;
		element.scrollTop = position.scrollTop;
		element.scrollLeft = position.scrollLeft;
	});
}

export function getTodayColumnWidths(
	dateKeys: string[],
	todayDate: string,
	todayColumnWidthMultiplier: number
): Map<string, string> | null {
	if (todayColumnWidthMultiplier <= 1 || dateKeys.length <= 1) return null;

	const uniqueDates = Array.from(new Set(dateKeys));
	if (!uniqueDates.includes(todayDate)) return null;

	const baseWidth = 100 / (uniqueDates.length - 1 + todayColumnWidthMultiplier);
	const todayWidth = baseWidth * todayColumnWidthMultiplier;

	return new Map(
		uniqueDates.map((dateKey) => [
			dateKey,
			`${dateKey === todayDate ? todayWidth : baseWidth}%`,
		])
	);
}

export class CalendarView extends BasesViewBase {
	type = "tasknotesCalendar";
	calendar: Calendar | null = null; // Made public for factory access
	private calendarEl: HTMLElement | null = null;
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
	// Preserve visible date when calendar is re-created.
	private _recreateTargetDate: Date | null = null;
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
	 * Override to update FullCalendar size when container resizes.
	 */
	onResize(): void {
		if (!this.calendar || !this.canUpdateCalendarSize()) return;

		this.calendar.updateSize();
		this.scheduleTodayColumnWidthUpdate();
		this.scheduleDailyNoteHeaderLinkUpdate();
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
			void this.render();
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
		if (!this.config || typeof this.config.get !== "function") {
			return "";
		}
		// Include all config values that affect the calendar
		const read = (key: string) => readCalendarConfigValue(this.config, key);
		const values: unknown[] = [
			// Event toggles
			read("showScheduled"),
			read("showDue"),
			read("showScheduledToDueSpan"),
			read("showRecurring"),
			read("showCompletedRecurringInstances"),
			read("showSkippedRecurringInstances"),
			read("showTimeEntries"),
			read("showTimeblocks"),
			read("showPropertyBasedEvents"),
			// Layout options
			read("calendarView"),
			read("heightMode"),
			read("customDayCount"),
			read("listDayCount"),
			read("slotMinTime"),
			read("slotMaxTime"),
			read("slotDuration"),
			read("firstDay"),
			read("weekNumbers"),
			read("nowIndicator"),
			read("showWeekends"),
			read("showAllDaySlot"),
			read("showTimeGrid"),
			read("showTodayHighlight"),
			read("todayColumnWidthMultiplier"),
			read("selectMirror"),
			read("timeFormat"),
			read("scrollTime"),
			read("eventMinHeight"),
			read("slotEventOverlap"),
			read("eventMaxStack"),
			read("dayMaxEvents"),
			read("dayMaxEventRows"),
			// Property-based events
			read("startDateProperty"),
			read("endDateProperty"),
			read("titleProperty"),
			// Date navigation
			read("initialDate"),
			read("initialDateProperty"),
			read("initialDateStrategy"),
			read("createDailyNotesFromDateLinks"),
		];

		// Include ICS calendar toggles
		if (this.plugin.icsSubscriptionService) {
			for (const sub of this.plugin.icsSubscriptionService.getSubscriptions()) {
				values.push(read(`showICS_${sub.id}`));
			}
		}

		// Include Google calendar toggles
		if (this.plugin.googleCalendarService) {
			for (const cal of this.plugin.googleCalendarService.getAvailableCalendars()) {
				values.push(read(`showGoogleCalendar_${cal.id}`));
			}
		}

		// Include Microsoft calendar toggles
		if (this.plugin.microsoftCalendarService) {
			for (const cal of this.plugin.microsoftCalendarService.getAvailableCalendars()) {
				values.push(read(`showMicrosoftCalendar_${cal.id}`));
			}
		}

		return JSON.stringify(values);
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
			const rows = this.dataAdapter.extractDataItems().map((item) => {
				const properties = item.properties || item.frontmatter || {};
				const values = propertyIds.map((propertyId) => [
					propertyId,
					normalizeSignatureValue(getSignaturePropertyValue(properties, propertyId)),
				]);

				return {
					path: item.path || "",
					values,
				};
			});

			return JSON.stringify({ propertyIds, rows });
		} catch {
			return this.data.data.map((entry) => entry.file?.path ?? "").join("\u0000");
		}
	}

	private getDataSignaturePropertyIds(): string[] {
		const propertyIds = new Set<string>();
		const addPropertyId = (propertyId: unknown) => {
			if (typeof propertyId !== "string") return;
			const trimmed = propertyId.trim();
			if (trimmed) propertyIds.add(trimmed);
		};

		for (const field of CALENDAR_DATA_SIGNATURE_FIELDS) {
			const mappedField =
				this.plugin?.fieldMapper?.toUserField(field) ??
				CALENDAR_DATA_SIGNATURE_DEFAULT_FIELDS[field] ??
				field;
			addPropertyId(mappedField);
		}
		addPropertyId("tags");
		addPropertyId("archived");

		try {
			for (const propertyId of this.dataAdapter.getVisiblePropertyIds()) {
				addPropertyId(propertyId);
			}
		} catch {
			// Visible-property config is not always available during early view setup.
		}

		if (this.viewOptions?.showPropertyBasedEvents) {
			addPropertyId(this.viewOptions.startDateProperty);
			addPropertyId(this.viewOptions.endDateProperty);
			addPropertyId(this.viewOptions.titleProperty);
		}

		return Array.from(propertyIds);
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
			console.warn(
				`[TaskNotes][CalendarView] Invalid time value: ${value}, using default: ${defaultValue}`
			);
		}
		return result.value;
	}

	private getConfigOption<T>(key: string, fallback: T): T {
		return getCalendarConfigValue(this.config, key, fallback);
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
					this.googleCalendarToggles.set(cal.id, this.getConfigOption(key, true));
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
			console.error("[TaskNotes][CalendarView] Error reading event toggles:", e);
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

			// Apply today highlight styling if calendar is already initialized
			if (this.calendar) {
				this.applyTodayHighlightStyling();
				this.scheduleTodayColumnWidthUpdate();
				this.scheduleDailyNoteHeaderLinkUpdate();
			}
		} catch (e) {
			console.error("[TaskNotes][CalendarView] Error reading view options:", e);
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
					this._recreateTargetDate = shouldPreserveVisibleDateOnCalendarRecreate(
						previousNavigationState,
						nextNavigationState
					)
						? this.calendar.getDate()
						: null;
					this.calendar.destroy();
					this.calendar = null;
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
				await this.updateCalendarEvents(filteredTasks);
			}
		} catch (error: unknown) {
			console.error("[TaskNotes][CalendarView] Error rendering:", error);
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

		// Determine initial date
		const initialDate = this._recreateTargetDate ?? this.determineInitialDate(taskNotes);

		// Build calendar options
		const calendarOptions: CalendarOptions = {
			plugins: [
				dayGridPlugin,
				timeGridPlugin,
				listPlugin,
				interactionPlugin,
				multiMonthPlugin,
			],
			initialView: this.viewOptions.calendarView,
			initialDate: initialDate,
			headerToolbar: {
				left: "prev,next today refreshCalendars",
				center: "title",
				right: "multiMonthYear,dayGridMonth,timeGridWeek,timeGridCustom,timeGridDay,listWeek",
			},
			buttonText: {
				today: this.plugin.i18n.translate("views.basesCalendar.today"),
				month: this.plugin.i18n.translate("views.basesCalendar.buttonText.month"),
				week: this.plugin.i18n.translate("views.basesCalendar.buttonText.week"),
				day: this.plugin.i18n.translate("views.basesCalendar.buttonText.day"),
				year: this.plugin.i18n.translate("views.basesCalendar.buttonText.year"),
				list: this.plugin.i18n.translate("views.basesCalendar.buttonText.list"),
			},
			buttonHints: {
				today:
					this.plugin.i18n.translate("views.basesCalendar.hints.today") || "Go to today",
				prev: this.plugin.i18n.translate("views.basesCalendar.hints.prev") || "Previous",
				next: this.plugin.i18n.translate("views.basesCalendar.hints.next") || "Next",
				month:
					this.plugin.i18n.translate("views.basesCalendar.hints.month") || "Month view",
				week: this.plugin.i18n.translate("views.basesCalendar.hints.week") || "Week view",
				day: this.plugin.i18n.translate("views.basesCalendar.hints.day") || "Day view",
				year: this.plugin.i18n.translate("views.basesCalendar.hints.year") || "Year view",
				list: this.plugin.i18n.translate("views.basesCalendar.hints.list") || "List view",
			},
			customButtons: {
				refreshCalendars: {
					text:
						this.plugin.i18n.translate("views.basesCalendar.buttonText.refresh") ||
						"Refresh",
					hint:
						this.plugin.i18n.translate("views.basesCalendar.hints.refresh") ||
						"Refresh calendar subscriptions",
					click: () => {
						void this.refreshExternalCalendars();
					},
				},
			},
			views: {
				timeGridCustom: {
					type: "timeGrid",
					duration: { days: this.viewOptions.customDayCount },
					buttonText: this.plugin.i18n.translate(
						"views.basesCalendar.buttonText.customDays",
						{
							count: this.viewOptions.customDayCount.toString(),
						}
					),
					titleFormat: { year: "numeric", month: "short", day: "numeric" },
				},
				listWeek: {
					type: "list",
					duration: { days: this.viewOptions.listDayCount },
					buttonText: this.plugin.i18n.translate("views.basesCalendar.buttonText.list"),
				},
			},
			...getCalendarSizingOptions(this.getEffectiveHeightMode()),
			handleWindowResize: true,
			stickyHeaderDates: false,
			locale:
				this.viewOptions.locale ||
				this.plugin.settings.uiLanguage ||
				navigator.language ||
				"en",
			slotMinTime: this.viewOptions.slotMinTime,
			slotMaxTime: this.viewOptions.slotMaxTime,
			slotDuration: this.viewOptions.slotDuration,
			firstDay: this.viewOptions.firstDay,
			weekNumbers: this.viewOptions.weekNumbers,
			nowIndicator: this.viewOptions.nowIndicator,
			weekends: this.viewOptions.showWeekends,
			allDaySlot: this.viewOptions.showAllDaySlot,
			dayMaxEvents: this.viewOptions.dayMaxEvents,
			dayMaxEventRows: this.viewOptions.dayMaxEventRows,
			eventMaxStack: this.viewOptions.eventMaxStack ?? undefined,
			navLinks: true,
			navLinkDayClick: (date: Date) => {
				this.openDailyNoteFromDateLink(date);
			},
			dayHeaderDidMount: (arg) => {
				attachDailyNoteHeaderLink(arg.el, arg.date, arg.view.type, this.plugin, (date) =>
					this.openDailyNoteFromDateLink(date)
				);
			},
			editable: true,
			droppable: true,
			selectable: true,
			...(Platform.isMobile
				? {
						longPressDelay: 350,
						eventLongPressDelay: 350,
						selectLongPressDelay: 350,
					}
				: {}),
			selectMirror: this.viewOptions.selectMirror,
			eventTimeFormat:
				this.viewOptions.timeFormat === "12"
					? {
							hour: "numeric",
							minute: "2-digit",
							omitZeroMinute: true,
							meridiem: "short",
							hour12: true,
						}
					: {
							hour: "2-digit",
							minute: "2-digit",
							hour12: false,
						},
			slotLabelFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: this.viewOptions.timeFormat === "12",
			},
			scrollTime: this.viewOptions.scrollTime,
			eventMinHeight: this.viewOptions.eventMinHeight,
			slotEventOverlap: this.viewOptions.slotEventOverlap,
			eventAllow: () => true, // Allow all drops to proceed visually
			eventOrder: getTaskNotesCalendarEventOrder(this.dataAdapter.getSortConfig()),
			events: (fetchInfo, successCallback, failureCallback) => {
				void this.fetchEvents(fetchInfo, successCallback, failureCallback);
			},
			eventDidMount: (arg) => this.handleEventDidMount(arg),
			eventClick: (info) => {
				void this.handleEventClick(info);
			},
			eventDrop: (info) => {
				void this.handleEventDrop(info);
			},
			drop: (info) => {
				void this.handleExternalDrop(info);
			},
			eventReceive: (info) => {
				this.handleEventReceive(info);
			},
			eventResize: (info) => {
				void this.handleEventResize(info);
			},
			select: (info) => {
				void this.handleDateSelect(info);
			},
			viewDidMount: (arg) => {
				// Track view type changes and save to config with debounce
				// Debouncing prevents rapid view recreation when clicking through views quickly
				const newViewType = arg.view.type;
				if (newViewType && newViewType !== this.viewOptions.calendarView) {
					this.viewOptions.calendarView = newViewType;
					this.debouncedSaveViewType(newViewType);
				}
				this.applyLayoutClasses();
				this.scheduleTodayColumnWidthUpdate();
				this.scheduleDailyNoteHeaderLinkUpdate();
			},
			datesSet: () => {
				this.applyLayoutClasses();
				this.scheduleTodayColumnWidthUpdate();
				this.scheduleDailyNoteHeaderLinkUpdate();
			},
		};

		// Create calendar
		this.calendar = new Calendar(this.calendarEl, calendarOptions);
		this.calendar.render();
		this._recreateTargetDate = null;
		this.applyLayoutClasses();

		// Apply showTodayHighlight option via CSS
		this.applyTodayHighlightStyling();
		this.scheduleTodayColumnWidthUpdate();
		this.scheduleDailyNoteHeaderLinkUpdate();
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

	private scheduleDailyNoteHeaderLinkUpdate(): void {
		const win = this.containerEl.ownerDocument.defaultView || window;
		win.setTimeout(() => this.attachDailyNoteHeaderLinks(), 0);
		win.setTimeout(() => this.attachDailyNoteHeaderLinks(), 50);
	}

	private attachDailyNoteHeaderLinks(): void {
		if (!this.calendar || !this.calendarEl) {
			return;
		}

		const viewType = this.calendar.view?.type;
		const isDayView =
			viewType === "timeGridDay" ||
			Boolean(this.calendarEl.querySelector(".fc-timeGridDay-view"));
		if (!isDayView) {
			return;
		}

		const fallbackDate = this.calendar.getDate();
		const headerCells =
			this.calendarEl.querySelectorAll<HTMLElement>(".fc-col-header-cell");
		headerCells.forEach((headerCell) => {
			const date = headerCell.dataset.date
				? parseDateToLocal(headerCell.dataset.date)
				: fallbackDate;
			attachDailyNoteHeaderLink(headerCell, date, "timeGridDay", this.plugin, (date) =>
				this.openDailyNoteFromDateLink(date)
			);
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

			this.calendar?.refetchEvents();
		} catch (error) {
			console.error("[TaskNotes][CalendarView] Error refreshing calendars:", error);
		}
	}

	/**
	 * Apply or remove today's date highlighting based on showTodayHighlight option.
	 * FullCalendar doesn't have a built-in option for this, so we control it via CSS.
	 */
	private applyTodayHighlightStyling(): void {
		if (!this.calendarEl) return;

		if (this.viewOptions.showTodayHighlight) {
			// Remove the class that hides today highlighting
			this.calendarEl.classList.remove("hide-today-highlight");
		} else {
			// Add the existing CSS class to hide today highlighting
			this.calendarEl.classList.add("hide-today-highlight");
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

	private applyLayoutClasses(): void {
		this.applyHeightModeClass();
		this.applyTimeGridVisibilityClass();
	}

	private getEffectiveHeightMode(): CalendarHeightMode {
		if (
			shouldHideCalendarTimeGrid(this.viewOptions.showTimeGrid, this.viewOptions.calendarView)
		) {
			return "auto";
		}

		return resolveEffectiveCalendarHeightMode(
			this.viewOptions.heightMode,
			this.viewOptions.calendarView,
			this.containerEl
		);
	}

	private scheduleTodayColumnWidthUpdate(): void {
		if (!this.canUpdateCalendarSize()) return;

		const win = this.containerEl.ownerDocument.defaultView || window;
		win.setTimeout(() => {
			if (this.canUpdateCalendarSize()) {
				this.applyTodayColumnWidth();
			}
		}, 0);
	}

	private applyTodayColumnWidth(): void {
		const calendar = this.calendar;
		if (!this.calendarEl || !calendar || !this.canUpdateCalendarSize()) return;
		const viewType = calendar.view?.type;
		if (!viewType) return;

		const headerCells = Array.from(
			this.calendarEl.querySelectorAll<HTMLElement>(".fc-col-header-cell[data-date]")
		);
		const dateKeys = headerCells
			.map((cell) => cell.dataset.date)
			.filter((date): date is string => Boolean(date));
		this.resetTodayColumnWidths();

		if (
			!shouldWidenTodayColumn(
				viewType,
				this.viewOptions.todayColumnWidthMultiplier
			)
		) {
			return;
		}

		const todayCell = headerCells.find((cell) => cell.classList.contains("fc-day-today"));
		const todayDate = todayCell?.dataset.date;
		if (!todayDate) return;

		const widths = getTodayColumnWidths(
			dateKeys,
			todayDate,
			this.viewOptions.todayColumnWidthMultiplier
		);
		if (!widths) return;

		const dayElements = this.calendarEl.querySelectorAll<HTMLTableCellElement>(
			".fc-col-header-cell[data-date], .fc-timegrid-col[data-date], .fc-daygrid-day[data-date]"
		);
		dayElements.forEach((element) => {
			const dateKey = element.dataset.date;
			if (!dateKey) return;
			const width = widths.get(dateKey);
			if (!width) return;
			element.style.width = width;
			element.style.minWidth = width;
			element.style.maxWidth = width;

			const col = findColForCell(element);
			if (col) {
				col.style.width = width;
			} else {
				console.warn(
					`[TaskNotes][CalendarView] No <col> found for dated cell (date=${dateKey}). ` +
						`FullCalendar DOM may have changed; today-column width skipped.`
				);
			}
		});
	}

	private canUpdateCalendarSize(): boolean {
		return isCalendarElementReadyForSizing(this.calendarEl, this.containerEl);
	}

	private resetTodayColumnWidths(): void {
		if (!this.calendarEl) return;

		const dayElements = this.calendarEl.querySelectorAll<HTMLTableCellElement>(
			".fc-col-header-cell[data-date], .fc-timegrid-col[data-date], .fc-daygrid-day[data-date]"
		);
		dayElements.forEach((element) => {
			element.style.removeProperty("width");
			element.style.removeProperty("min-width");
			element.style.removeProperty("max-width");

			const col = findColForCell(element);
			if (col) {
				col.style.removeProperty("width");
			}
		});
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
					console.debug("[TaskNotes][CalendarView] View type saved to config:", viewType);
				}
			} catch (error) {
				console.error("[TaskNotes][CalendarView] Failed to save view type:", error);
			}
		}, 1000);
	}

	private determineInitialDate(taskNotes: TaskInfo[]): Date | string | undefined {
		// Check for explicit initial date option
		if (this.viewOptions.initialDate) {
			const normalized = normalizeDateValueForCalendar(this.viewOptions.initialDate);
			return normalized?.value ?? this.viewOptions.initialDate;
		}

		// Check for property-based navigation
		if (this.viewOptions.initialDateProperty) {
			const propertyId = this.viewOptions.initialDateProperty;
			const dates = this.collectInitialDateCandidates(propertyId, taskNotes);

			if (dates.length > 0) {
				// Apply strategy
				if (this.viewOptions.initialDateStrategy === "earliest") {
					const earliest = dates.reduce((prev, curr) =>
						curr.compare.getTime() < prev.compare.getTime() ? curr : prev
					);
					return earliest.value;
				} else if (this.viewOptions.initialDateStrategy === "latest") {
					const latest = dates.reduce((prev, curr) =>
						curr.compare.getTime() > prev.compare.getTime() ? curr : prev
					);
					return latest.value;
				} else {
					// "first" - return first date
					return dates[0].value;
				}
			}
		}

		// Default to today
		return undefined;
	}

	private collectInitialDateCandidates(
		propertyId: string,
		taskNotes: TaskInfo[]
	): { compare: Date; value: string | Date }[] {
		const dates: { compare: Date; value: string | Date }[] = [];

		if (this.data?.data) {
			for (const entry of this.data.data) {
				const value = this.dataAdapter.getPropertyValue(entry, propertyId);
				const candidate = this.toInitialDateCandidate(value);
				if (candidate) {
					dates.push(candidate);
				}
			}
		}

		if (dates.length > 0) {
			return dates;
		}

		const internalFieldName = this.propertyMapper.basesToTaskCardProperty(propertyId);
		for (const task of taskNotes) {
			const taskRecord = task as unknown as Record<string, unknown>;
			const customProperties = task.customProperties;
			const value =
				taskRecord[internalFieldName] ??
				customProperties?.[internalFieldName] ??
				customProperties?.[propertyId];
			const candidate = this.toInitialDateCandidate(value);
			if (candidate) {
				dates.push(candidate);
			}
		}

		return dates;
	}

	private toInitialDateCandidate(
		value: unknown
	): { compare: Date; value: string | Date } | null {
		const normalized = normalizeDateValueForCalendar(value);
		if (!normalized) return null;

		const compareDate = normalized.isAllDay
			? parseDateToUTC(normalized.value as string)
			: new Date(normalized.value);
		if (isNaN(compareDate.getTime())) return null;

		return { compare: compareDate, value: normalized.value };
	}

	private getNavigationConfigState(): CalendarRecreateNavigationState {
		return {
			initialDate: this.viewOptions.initialDate,
			initialDateProperty: this.viewOptions.initialDateProperty,
			initialDateStrategy: this.viewOptions.initialDateStrategy,
		};
	}

	private async fetchEvents(
		fetchInfo: EventSourceFuncArg,
		successCallback: (eventInputs: EventInput[]) => void,
		failureCallback: (error: Error) => void
	): Promise<void> {
		try {
			const events = await this.buildAllEvents(fetchInfo);
			successCallback(events);
		} catch (error) {
			console.error("[TaskNotes][CalendarView] Error fetching events:", error);
			failureCallback(error instanceof Error ? error : new Error(String(error)));
		}
	}

	private async buildAllEvents(fetchInfo: EventSourceFuncArg): Promise<EventInput[]> {
		const allEvents: EventInput[] = [];

		// Build event configuration for generateCalendarEvents
		// Let FullCalendar handle date filtering - it's optimized for this
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
			visibleStart: fetchInfo.start,
			visibleEnd: fetchInfo.end,
		};

		// Use existing calendar-core helper to generate task events
		const taskEvents = await generateCalendarEvents(
			this.currentTasks,
			this.plugin,
			eventConfig
		);
		applyBasesSortIndexesToCalendarEvents(taskEvents, this.basesSortIndexByPath);
		const displayedTaskGoogleEventIds = getDisplayedTaskLinkedGoogleEventIds(taskEvents);
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
			const icsEvents = await this.buildICSEvents(relatedNoteCountsByEventId);
			allEvents.push(...icsEvents);
		}

		// Add Google Calendar events
		if (this.plugin.googleCalendarService) {
			const googleEvents = await this.buildGoogleCalendarEvents(
				relatedNoteCountsByEventId,
				displayedTaskGoogleEventIds
			);
			allEvents.push(...googleEvents);
		}

		// Add Microsoft Calendar events
		if (this.plugin.microsoftCalendarService) {
			const microsoftEvents =
				await this.buildMicrosoftCalendarEvents(relatedNoteCountsByEventId);
			allEvents.push(...microsoftEvents);
		}

		return allEvents;
	}

	private async buildPropertyBasedEvents(): Promise<EventInput[]> {
		if (!this.data?.data) return [];
		if (!this.viewOptions.startDateProperty) return [];

		const events: EventInput[] = [];

		for (const entry of this.data.data) {
			try {
				const file = entry.file;

				// Skip if no file
				if (!file) continue;

				// Use BasesDataAdapter to get the property value (handles all Bases Value types)
				const startValue = this.dataAdapter.getPropertyValue(
					entry,
					this.viewOptions.startDateProperty
				);

				let endValue: unknown;
				if (this.viewOptions.endDateProperty) {
					endValue = this.dataAdapter.getPropertyValue(
						entry,
						this.viewOptions.endDateProperty
					);
				}

				const dateSpans = buildPropertyEventDateSpans(startValue, endValue);
				if (dateSpans.length === 0) continue;

				// Try to get title from configured property
				let eventTitle: string | undefined;
				if (this.viewOptions.titleProperty) {
					const titleValue = this.dataAdapter.getPropertyValue(
						entry,
						this.viewOptions.titleProperty
					);
					if (titleValue && typeof titleValue === "string" && titleValue.trim()) {
						eventTitle = titleValue.trim();
					}
				}

				dateSpans.forEach((dateSpan) => {
					const startDateStr = formatCalendarDateValue(dateSpan.start);
					const endDateStr = dateSpan.end
						? formatCalendarDateValue(dateSpan.end)
						: undefined;
					const isAllDay =
						dateSpan.start.isAllDay && (dateSpan.end ? dateSpan.end.isAllDay : true);
					const eventIdSuffix = dateSpan.fromList ? `-${dateSpan.index}` : "";

					// Create event - let FullCalendar handle date filtering
					events.push({
						id: `property-${file.path}${eventIdSuffix}`,
						title: eventTitle || file.basename || file.name,
						start: startDateStr,
						end: endDateStr,
						allDay: isAllDay,
						backgroundColor: "var(--color-accent)",
						borderColor: "var(--color-accent)",
						textColor: "var(--text-on-accent)",
						editable: !dateSpan.fromList,
						extendedProps: {
							eventType: "property-based",
							filePath: file.path,
							file: file,
							basesEntry: entry,
							propertyEventIndex: dateSpan.fromList ? dateSpan.index : undefined,
							propertyEventFromList: dateSpan.fromList,
						},
					});
				});
			} catch (error) {
				console.warn(
					`[TaskNotes][CalendarView] Error processing property-based entry:`,
					error
				);
			}
		}

		return events;
	}

	private async buildICSEvents(
		relatedNoteCountsByEventId: Map<string, number>
	): Promise<EventInput[]> {
		if (!this.plugin.icsSubscriptionService) return [];

		const events: EventInput[] = [];
		const allICSEvents = this.plugin.icsSubscriptionService.getAllEvents();

		for (const icsEvent of allICSEvents) {
			// Check if this calendar is enabled
			if (this.icsCalendarToggles.get(icsEvent.subscriptionId) === false) continue;

			// Let FullCalendar handle date filtering
			const calendarEvent = createICSEvent(icsEvent, this.plugin, {
				relatedNoteCount: relatedNoteCountsByEventId.get(icsEvent.id),
			});
			if (calendarEvent) {
				events.push(calendarEvent);
			}
		}

		return events;
	}

	private async buildGoogleCalendarEvents(
		relatedNoteCountsByEventId: Map<string, number>,
		displayedTaskGoogleEventIds: Set<string>
	): Promise<EventInput[]> {
		if (!this.plugin.googleCalendarService) return [];

		const events: EventInput[] = [];
		const allGoogleEvents = this.plugin.googleCalendarService.getAllEvents();

		for (const icsEvent of allGoogleEvents) {
			// Check if this calendar is enabled
			const calendarId = icsEvent.subscriptionId.replace("google-", "");
			if (this.googleCalendarToggles.get(calendarId) === false) continue;
			if (isDisplayedTaskLinkedGoogleEvent(icsEvent, displayedTaskGoogleEventIds)) continue;

			// Let FullCalendar handle date filtering
			const calendarEvent = createICSEvent(icsEvent, this.plugin, {
				relatedNoteCount: relatedNoteCountsByEventId.get(icsEvent.id),
			});
			if (calendarEvent) {
				events.push(calendarEvent);
			}
		}

		return events;
	}

	private async buildMicrosoftCalendarEvents(
		relatedNoteCountsByEventId: Map<string, number>
	): Promise<EventInput[]> {
		if (!this.plugin.microsoftCalendarService) return [];

		const events: EventInput[] = [];
		const allMicrosoftEvents = this.plugin.microsoftCalendarService.getAllEvents();

		for (const icsEvent of allMicrosoftEvents) {
			// Check if this calendar is enabled
			const calendarId = icsEvent.subscriptionId.replace("microsoft-", "");
			if (this.microsoftCalendarToggles.get(calendarId) === false) continue;

			// Let FullCalendar handle date filtering
			const calendarEvent = createICSEvent(icsEvent, this.plugin, {
				relatedNoteCount: relatedNoteCountsByEventId.get(icsEvent.id),
			});
			if (calendarEvent) {
				events.push(calendarEvent);
			}
		}

		return events;
	}

	private async updateCalendarEvents(taskNotes: TaskInfo[]): Promise<void> {
		if (!this.calendar) return;

		// Refetch events from all sources
		this.calendar.setOption(
			"eventOrder",
			getTaskNotesCalendarEventOrder(this.dataAdapter.getSortConfig())
		);
		this.calendar.refetchEvents();
	}

	/**
	 * Refresh calendar with fresh data from Obsidian's metadata cache.
	 * Use this when task data has changed and calendar needs to reflect updates immediately.
	 * Bases' cache may be stale, so we read directly from metadataCache.
	 */
	private async refreshCalendarWithFreshData(): Promise<void> {
		if (!this.calendar) return;

		try {
			// Refresh each task from Obsidian's metadata cache (bypasses Bases' stale cache)
			const refreshedTasks: TaskInfo[] = [];
			for (const task of this.currentTasks) {
				const freshTask = this.plugin.cacheManager.getCachedTaskInfoSync(task.path);
				if (freshTask) {
					// Preserve basesData reference for formula access
					freshTask.basesData = task.basesData;
					refreshedTasks.push(freshTask);
				}
			}
			this.currentTasks = refreshedTasks;
			this.calendar.refetchEvents();
		} catch (error) {
			console.error("[TaskNotes][CalendarView] Error refreshing calendar:", error);
		}
	}

	private async handleEventClick(info: EventClickArg): Promise<void> {
		const { taskInfo, timeblock, eventType, filePath, icsEvent, subscriptionName } =
			info.event.extendedProps || {};
		const jsEvent = info.jsEvent;

		// Handle timeblock click
		if (eventType === "timeblock" && timeblock) {
			const eventStart = info.event.start;
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
			void handleCalendarTaskClick(taskInfo, this.plugin, jsEvent, info.event.id, () =>
				this.expectImmediateUpdate()
			);
		}
	}

	private async handleExternalDrop(info: DropArg): Promise<void> {
		this.expectImmediateUpdate();

		const taskPath = extractTaskPathFromExternalDrop(info);
		if (!taskPath) {
			console.warn("[TaskNotes][CalendarView] External drop did not include a task path");
			return;
		}

		try {
			const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
			if (!task) {
				console.warn("[TaskNotes][CalendarView] Dropped task not found:", taskPath);
				return;
			}

			const scheduledDate = info.allDay
				? format(info.date, "yyyy-MM-dd")
				: format(info.date, "yyyy-MM-dd'T'HH:mm");

			await this.plugin.taskService.updateProperty(task, "scheduled", scheduledDate);

			new Notice(
				`Task "${task.title}" scheduled for ${format(
					info.date,
					info.allDay ? "MMM d, yyyy" : "MMM d, yyyy h:mm a"
				)}`
			);

			this.calendar?.refetchEvents();
		} catch (error) {
			console.error("[TaskNotes][CalendarView] Error handling external task drop:", error);
			new Notice("Failed to schedule task");
		}
	}

	private handleEventReceive(info: EventReceiveArg): void {
		info.event.remove();
	}

	private async handleEventDrop(info: EventDropArg): Promise<void> {
		// Expect immediate update since user is interacting with calendar
		this.expectImmediateUpdate();

		if (!info?.event?.extendedProps) {
			console.warn("[TaskNotes][CalendarView] Event dropped without extendedProps");
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
			if (!info.oldEvent.start) {
				info.revert();
				return;
			}
			const originalDate = format(info.oldEvent.start, "yyyy-MM-dd");
			await handleTimeblockDrop(
				info,
				timeblock,
				originalDate,
				this.plugin,
				isTimeblockCopyModifierPressed(info.jsEvent)
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

				if (!startDateProperty) {
					info.revert();
					return;
				}

				// Strip property prefix if present
				const startProp = startDateProperty.includes(".")
					? startDateProperty.split(".").pop()
					: startDateProperty;
				const endProp =
					endDateProperty && endDateProperty.includes(".")
						? endDateProperty.split(".").pop()
						: endDateProperty;

				if (!startProp) {
					info.revert();
					return;
				}

				// Calculate time shift (in milliseconds)
				const oldStart = info.oldEvent.start;
				const newStart = info.event.start;
				if (!oldStart || !newStart) {
					info.revert();
					return;
				}
				const timeDiffMs = newStart.getTime() - oldStart.getTime();

				// Update frontmatter
				await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
					// Update start date
					const oldStartValue = frontmatter[startProp];
					if (oldStartValue) {
						const oldStartDate = new Date(oldStartValue);
						if (isNaN(oldStartDate.getTime())) return;
						const newStartDate = new Date(oldStartDate.getTime() + timeDiffMs);
						if (isNaN(newStartDate.getTime())) return;
						frontmatter[startProp] = format(
							newStartDate,
							info.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm"
						);
					}

					// Update end date if configured
					if (endProp) {
						const oldEndValue = frontmatter[endProp];
						if (oldEndValue) {
							const oldEndDate = new Date(oldEndValue);
							if (isNaN(oldEndDate.getTime())) return;
							const newEndDate = new Date(oldEndDate.getTime() + timeDiffMs);
							if (isNaN(newEndDate.getTime())) return;
							frontmatter[endProp] = format(
								newEndDate,
								info.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm"
							);
						}
					}
				});
			} catch (error) {
				console.error(
					"[TaskNotes][CalendarView] Error updating property-based event:",
					error
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
					const newStart = info.event.start;
					if (!newStart) {
						info.revert();
						return;
					}
					const newAllDay = info.event.allDay;
					let newEnd = info.event.end;
					if (!newEnd) {
						newEnd = new Date(newStart);
						if (newAllDay) {
							newEnd.setDate(newEnd.getDate() + 1);
						} else {
							newEnd.setHours(newEnd.getHours() + 1);
						}
					}

					// Build update payload
					const updates: Partial<CalendarEventData> = {};
					if (newAllDay) {
						updates.start = { date: format(newStart, "yyyy-MM-dd") };
						updates.end = { date: format(newEnd, "yyyy-MM-dd") };
					} else {
						const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
						updates.start = {
							dateTime: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
							timeZone: timezone,
						};
						updates.end = {
							dateTime: format(newEnd, "yyyy-MM-dd'T'HH:mm:ss"),
							timeZone: timezone,
						};
					}

					await provider.updateEvent(calendarId, eventId, updates);
				} catch (error) {
					console.error(
						`[TaskNotes][CalendarView] Error updating ${provider.providerName} event:`,
						error
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
			const timeEntryIndex = info.event.extendedProps.timeEntryIndex;
			if (typeof timeEntryIndex !== "number") {
				info.revert();
				return;
			}

			try {
				const newStart = info.event.start;
				const newEnd = info.event.end;

				if (!newStart || !newEnd) {
					info.revert();
					return;
				}

				// Calculate time shift
				const oldStart = info.oldEvent.start;
				if (!oldStart) {
					info.revert();
					return;
				}
				const timeDiffMs = newStart.getTime() - oldStart.getTime();

				// Update the time entry
				const updatedEntries = [...(taskInfo.timeEntries || [])];
				const entry = updatedEntries[timeEntryIndex];

				if (entry) {
					// Shift both start and end time by the same amount
					const oldStartDate = new Date(entry.startTime);
					if (!entry.endTime) {
						info.revert();
						return;
					}
					const oldEndDate = new Date(entry.endTime);

					entry.startTime = new Date(oldStartDate.getTime() + timeDiffMs).toISOString();
					entry.endTime = new Date(oldEndDate.getTime() + timeDiffMs).toISOString();
					delete entry.duration;

					const sanitizedEntries = updatedEntries.map((timeEntry) => {
						const sanitizedEntry = { ...timeEntry };
						delete sanitizedEntry.duration;
						return sanitizedEntry;
					});

					await this.plugin.taskService.updateTask(taskInfo, {
						timeEntries: sanitizedEntries,
					});
				}
			} catch (error) {
				console.error("Error updating time entry:", error);
				info.revert();
			}
			return;
		}

		// Handle recurring task drops
		if (taskInfo && (isRecurringInstance || isNextScheduledOccurrence || isPatternInstance)) {
			await handleRecurringTaskDrop(info, taskInfo, this.plugin);
			return;
		}

		// Handle normal task drops (scheduled and due dates)
		if (taskInfo) {
			try {
				if (eventType === "scheduled" || eventType === "due") {
					const newStart = info.event.start;
					if (!newStart) {
						info.revert();
						return;
					}
					const allDay = info.event.allDay;
					const newDateString = allDay
						? format(newStart, "yyyy-MM-dd")
						: format(newStart, "yyyy-MM-dd'T'HH:mm");

					const property = eventType === "scheduled" ? "scheduled" : "due";
					await this.plugin.taskService.updateProperty(taskInfo, property, newDateString);
				} else if (eventType === "scheduledToDueSpan") {
					// Handle span event drag - shift both scheduled and due by the same amount
					const oldStart = info.oldEvent.start;
					const newStart = info.event.start;

					if (!oldStart || !newStart) {
						info.revert();
						return;
					}

					// Calculate the time shift in milliseconds
					const timeDiffMs = newStart.getTime() - oldStart.getTime();

					// Compute new date strings
					let scheduledString: string | undefined;
					let dueString: string | undefined;

					if (taskInfo.scheduled) {
						scheduledString = shiftTaskDatePreservingTime(
							taskInfo.scheduled,
							timeDiffMs
						);
					}

					if (taskInfo.due) {
						dueString = shiftTaskDatePreservingTime(taskInfo.due, timeDiffMs);
					}

					// Update both dates atomically in a single frontmatter write
					const spanFile = this.plugin.app.vault.getAbstractFileByPath(taskInfo.path);
					if (spanFile instanceof TFile) {
						const scheduledField = this.plugin.fieldMapper.toUserField("scheduled");
						const dueField = this.plugin.fieldMapper.toUserField("due");

						await this.plugin.app.fileManager.processFrontMatter(
							spanFile,
							(frontmatter) => {
								if (scheduledString) frontmatter[scheduledField] = scheduledString;
								if (dueString) frontmatter[dueField] = dueString;
							}
						);
					}
				}
			} catch (error) {
				console.error("[TaskNotes][CalendarView] Error updating task date:", error);
				info.revert();
			}
		}
	}

	private async handleEventResize(info: EventResizeDoneArg): Promise<void> {
		// Expect immediate update since user is interacting with calendar
		this.expectImmediateUpdate();

		if (!info?.event?.extendedProps) {
			console.warn("[TaskNotes][CalendarView] Event resized without extendedProps");
			return;
		}

		const { taskInfo, timeblock, eventType, filePath, timeEntryIndex, icsEvent } =
			info.event.extendedProps;

		// Handle time entry resize
		if (eventType === "timeEntry") {
			if (typeof timeEntryIndex !== "number") {
				info.revert();
				return;
			}

			try {
				const newStart = info.event.start;
				const newEnd = info.event.end;

				if (!newStart || !newEnd) {
					info.revert();
					return;
				}

				// Update the time entry
				const updatedEntries = [...(taskInfo.timeEntries || [])];
				const entry = updatedEntries[timeEntryIndex];

				if (entry) {
					// Update start and end times
					entry.startTime = newStart.toISOString();
					entry.endTime = newEnd.toISOString();
					delete entry.duration;

					const sanitizedEntries = updatedEntries.map((timeEntry) => {
						const sanitizedEntry = { ...timeEntry };
						delete sanitizedEntry.duration;
						return sanitizedEntry;
					});

					await this.plugin.taskService.updateTask(taskInfo, {
						timeEntries: sanitizedEntries,
					});
				}
			} catch (error) {
				console.error("Error resizing time entry:", error);
				info.revert();
			}
			return;
		}

		// Handle timeblock resize
		if (eventType === "timeblock") {
			if (!info.event.start) {
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

				if (!endDateProperty) {
					// No end date property configured, can't resize
					info.revert();
					return;
				}

				// Strip property prefix
				const endProp = endDateProperty.includes(".")
					? endDateProperty.split(".").pop()
					: endDateProperty;

				if (!endProp) {
					info.revert();
					return;
				}

				const newEnd = info.event.end;
				if (!newEnd) {
					info.revert();
					return;
				}

				// Update frontmatter
				await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
					if (isNaN(newEnd.getTime())) return;
					frontmatter[endProp] = format(
						newEnd,
						info.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm"
					);
				});
			} catch (error) {
				console.error(
					"[TaskNotes][CalendarView] Error resizing property-based event:",
					error
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
					const newStart = info.event.start;
					const newEnd = info.event.end;

					if (!newStart || !newEnd) {
						info.revert();
						return;
					}

					const newAllDay = info.event.allDay;

					// Build update payload
					const updates: Partial<CalendarEventData> = {};
					if (newAllDay) {
						updates.start = { date: format(newStart, "yyyy-MM-dd") };
						updates.end = { date: format(newEnd, "yyyy-MM-dd") };
					} else {
						const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
						updates.start = {
							dateTime: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
							timeZone: timezone,
						};
						updates.end = {
							dateTime: format(newEnd, "yyyy-MM-dd'T'HH:mm:ss"),
							timeZone: timezone,
						};
					}

					await provider.updateEvent(calendarId, eventId, updates);
				} catch (error) {
					console.error(
						`[TaskNotes][CalendarView] Error resizing ${provider.providerName} event:`,
						error
					);
					info.revert();
				}
				return;
			}
		}

		// Only scheduled and recurring events can be resized (block ICS subscriptions without provider)
		if (eventType !== "scheduled" && eventType !== "recurring") {
			info.revert();
			return;
		}

		// Handle task resize (update time estimate)
		try {
			const start = info.event.start;
			const end = info.event.end;

			if (start && end) {
				let durationMinutes: number;

				if (info.event.allDay) {
					// For all-day events, FullCalendar's end date is exclusive (next day at midnight)
					const dayDurationMillis = 24 * 60 * 60 * 1000;
					const daysDuration = Math.round(
						(end.getTime() - start.getTime()) / dayDurationMillis
					);
					const minutesPerDay = 60 * 24;
					durationMinutes = daysDuration * minutesPerDay;
				} else {
					// For timed events, calculate duration directly
					durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
				}

				await this.plugin.taskService.updateProperty(
					taskInfo,
					"timeEstimate",
					durationMinutes
				);
			}
		} catch (error) {
			console.error("[TaskNotes][CalendarView] Error updating task duration:", error);
			info.revert();
		}
	}

	private async handleDateSelect(info: DateSelectArg): Promise<void> {
		// Determine what type of event to create based on view
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Create task")
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
						onTaskCreated: () => this.expectImmediateUpdate(),
					});
					modal.open();
				});
		});

		// Only show timeblock option if timeblocking is enabled
		if (this.plugin.settings.calendarViewSettings.enableTimeblocking) {
			menu.addItem((item) => {
				item.setTitle("Create timeblock")
					.setIcon("clock")
					.onClick(async () => {
						this.expectImmediateUpdate();
						await handleTimeblockCreation(
							info.start,
							info.end,
							info.allDay,
							this.plugin
						);
					});
			});
		}

		menu.addItem((item) => {
			item.setTitle("Create time entry")
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
					item.setTitle("Create external calendar event")
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

		if (info.jsEvent) {
			menu.showAtMouseEvent(info.jsEvent);
		} else {
			menu.showAtPosition({ x: 0, y: 0 });
		}
	}

	private handleEventDidMount(arg: EventMountArg): void {
		if (!arg?.event?.extendedProps) return;

		const { taskInfo, timeblock, icsEvent, eventType, basesEntry, relatedNoteCount } =
			arg.event.extendedProps;
		suppressCalendarContextMenuOnMobile(arg.el);

		const relatedNoteTotal =
			typeof relatedNoteCount === "number" && relatedNoteCount > 0 ? relatedNoteCount : 0;

		if (icsEvent) {
			arg.el.setAttribute("data-ics-event", "true");
			arg.el.classList.add("fc-ics-event");
			if (relatedNoteTotal > 0) {
				arg.el.classList.add("has-related-note", "fc-event--has-related-note");
				arg.el.dataset.relatedNoteCount = String(relatedNoteTotal);
			}
		}

		// Add calendar icon to provider-managed calendar events in grid views
		if (icsEvent && arg.view.type !== "listWeek") {
			const provider = this.plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
			if (provider) {
				const titleEl = arg.el.querySelector(".fc-event-title");
				if (titleEl) {
					// Use correct document for pop-out window support
					const doc = arg.el.ownerDocument;
					const iconContainer = doc.createElement("span");
					iconContainer.classList.remove("tn-static-margin-right-8px-539fa9a0");
					iconContainer.classList.add("tn-static-margin-right-4px-c6b76b85");
					iconContainer.classList.remove(
						"tn-static-display-block-2a1b75c9",
						"tn-static-display-flex-4d51fc62",
						"tn-static-display-flex-75816cae",
						"tn-static-display-flex-8bb39979",
						"tn-static-display-inline-block-60e32dcb",
						"tn-static-display-inline-cccfa456",
						"tn-static-display-none-6b99de8b",
						"tn-static-min-height-800px-997b4c8c"
					);
					iconContainer.classList.add("tn-static-display-inline-flex-f984c520");
					iconContainer.classList.remove(
						"tn-static-align-items-baseline-4b95b5c7",
						"tn-static-align-items-flex-start-0486f781"
					);
					iconContainer.classList.add("tn-static-align-items-center-7c619740");

					const iconEl = doc.createElement("span");
					iconEl.classList.remove(
						"tn-static-width-100-0466783d",
						"tn-static-width-16px-7375d50b",
						"tn-static-width-1px-aa77e27e",
						"tn-static-width-200px-2acaf3b5",
						"tn-static-width-60px-bd09c419",
						"tn-static-width-80px-8573bae3"
					);
					iconEl.classList.add("tn-static-width-12px-fbf353fb");
					iconEl.classList.remove(
						"tn-static-display-flex-4d51fc62",
						"tn-static-height-0-7a31cef0",
						"tn-static-height-100-62264068",
						"tn-static-height-16px-30de4aee",
						"tn-static-height-24px-29a11d37",
						"tn-static-min-height-800px-997b4c8c"
					);
					iconEl.classList.add("tn-static-height-12px-06c0747e");
					iconEl.classList.remove(
						"tn-static-display-block-2a1b75c9",
						"tn-static-display-flex-4d51fc62",
						"tn-static-display-flex-75816cae",
						"tn-static-display-flex-8bb39979",
						"tn-static-display-inline-block-60e32dcb",
						"tn-static-display-inline-cccfa456",
						"tn-static-display-none-6b99de8b",
						"tn-static-min-height-800px-997b4c8c"
					);
					iconEl.classList.add("tn-static-display-inline-flex-f984c520");
					iconEl.classList.add("tn-static-flex-shrink-0-6ee0661e");
					setIcon(iconEl, "calendar");

					iconContainer.appendChild(iconEl);
					titleEl.insertBefore(iconContainer, titleEl.firstChild);
				}
			}

			const titleEl = arg.el.querySelector(".fc-event-title");
			if (titleEl && relatedNoteTotal > 0) {
				appendRelatedNoteIndicator(titleEl, this.plugin, relatedNoteTotal);
			}
		}

		// Custom rendering for list view - replace with card components
		if (arg.view.type === "listWeek") {
			// Clear the default content
			arg.el.innerHTML = "";

			let cardElement: HTMLElement | null = null;

			// Get visible properties from Bases view configuration
			const visibleProperties = this.getVisibleProperties();

			// Render task events with TaskCard
			if (taskInfo && eventType !== "ics" && eventType !== "property-based") {
				// Enrich TaskInfo with Bases data for formula and file property access
				const enrichedTask = { ...taskInfo };
				const basesEntry = this.basesEntryByPath.get(taskInfo.path);

				if (basesEntry) {
					// Store the full basesEntry for lazy file property access (e.g., file.backlinks)
					// This allows TaskCard.getPropertyValue to call getValue() on demand
					enrichedTask.basesData = basesEntry;

					// Pre-populate formula results for performance (formulas are accessed frequently)
					if (visibleProperties) {
						for (const propId of visibleProperties) {
							if (propId.startsWith("formula.")) {
								try {
									// Just trigger the getValue to ensure it's cached by Bases
									basesEntry.getValue?.(propId);
								} catch (error) {
									console.debug(
										"[TaskNotes][CalendarView] Error getting formula:",
										propId,
										error
									);
								}
							}
						}
					}

					// Add file properties if not already present
					if (!enrichedTask.dateCreated) {
						try {
							const ctimeValue = basesEntry.getValue?.("file.ctime");
							if (ctimeValue?.data) enrichedTask.dateCreated = ctimeValue.data;
						} catch (error) {
							console.debug(
								"[TaskNotes][CalendarView] Error getting file.ctime:",
								error
							);
						}
					}
					if (!enrichedTask.dateModified) {
						try {
							const mtimeValue = basesEntry.getValue?.("file.mtime");
							if (mtimeValue?.data) enrichedTask.dateModified = mtimeValue.data;
						} catch (error) {
							console.debug(
								"[TaskNotes][CalendarView] Error getting file.mtime:",
								error
							);
						}
					}
				}

				// Use shared UTC-anchored target date logic
				const targetDate = getTargetDateForEvent(arg);

				cardElement = createTaskCard(
					enrichedTask,
					this.plugin,
					visibleProperties,
					this.buildTaskCardOptions({
						targetDate: targetDate,
					})
				);
			}
			// Render ICS events with ICSCard
			else if (icsEvent && eventType === "ics") {
				cardElement = createICSEventCard(icsEvent, this.plugin, {
					relatedNoteCount: relatedNoteTotal,
				});
			}
			// Render property-based events with PropertyEventCard
			else if (eventType === "property-based" && basesEntry) {
				cardElement = createPropertyEventCard(basesEntry, this.plugin, this.config);
			}
			// Render timeblock events with TimeBlockCard
			else if (eventType === "timeblock" && timeblock) {
				const originalDate = arg.event.start
					? format(arg.event.start, "yyyy-MM-dd")
					: undefined;
				cardElement = createTimeBlockCard(timeblock, this.plugin, {
					eventDate: arg.event.start ?? undefined,
					originalDate: originalDate,
				});
			}

			// Replace the event element content with the card
			if (cardElement) {
				arg.el.appendChild(cardElement);
				// Remove default FullCalendar classes that interfere with card styling
				arg.el.classList.remove("fc-event", "fc-event-start", "fc-event-end");
				return; // Skip default handling
			} else {
				// Fallback: Add consistent styling to events without custom cards
				arg.el.classList.add("fc-event-default-list");
			}
		}

		// Set event type attribute
		arg.el.setAttribute("data-event-type", eventType || "unknown");

		// Handle timeblock events
		if (eventType === "timeblock" && timeblock) {
			// Apply timeblock styling
			applyTimeblockStyling(arg.el, timeblock);

			// Ensure timeblocks are editable
			if (arg.event.setProp) {
				arg.event.setProp("editable", true);
			}

			// Add tooltip
			const tooltipText = generateTimeblockTooltip(timeblock);
			setTooltip(arg.el, tooltipText, { placement: "top" });

			return;
		}

		// Add data attributes and classes for tasks
		if (taskInfo && taskInfo.path) {
			arg.el.setAttribute("data-task-path", taskInfo.path);
			arg.el.classList.add("fc-task-event");

			// Add tag classes to tasks
			if (taskInfo.tags && taskInfo.tags.length > 0) {
				taskInfo.tags.forEach((tag: string) => {
					const sanitizedTag = tag.replace(/[^a-zA-Z0-9-_]/g, "");
					if (sanitizedTag) {
						arg.el.classList.add(`fc-tag-${sanitizedTag}`);
					}
				});
			}

			// Set editable based on event type
			if (arg.event.setProp) {
				switch (eventType) {
					case "scheduled":
					case "recurring":
					case "timeEntry":
					case "due":
					case "scheduledToDueSpan":
						arg.event.setProp("editable", true);
						break;
					default:
						// Non-task events (like ICS without provider) remain non-editable
						break;
				}
			}

			// Apply recurring task styling (handles completion styling as well)
			applyRecurringTaskStyling(arg.el, arg.event.extendedProps);
		}

		// Add hover tooltip for tasks and ICS events
		if (taskInfo) {
			const tooltipText = generateTaskTooltip(taskInfo, this.plugin);
			setTooltip(arg.el, tooltipText);
		} else if (icsEvent) {
			const relatedNotesText =
				relatedNoteTotal > 0
					? `\n\n${getRelatedNoteTooltip(this.plugin, relatedNoteTotal)}`
					: "";
			const tooltipText = icsEvent.description
				? `${icsEvent.title}\n\n${icsEvent.description}${relatedNotesText}`
				: `${icsEvent.title}${relatedNotesText}`;
			setTooltip(arg.el, tooltipText);
		}

		// Add hover preview for tasks (Ctrl+hover to preview daily note)
		if (taskInfo && eventType !== "ics") {
			addTaskHoverPreview(arg.el, taskInfo, this.plugin, "tasknotes-bases-calendar");
		}

		// Add context menu for tasks (right-click) - includes time entries
		if (taskInfo) {
			arg.el.addEventListener("contextmenu", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();

				// Use shared UTC-anchored target date logic
				const targetDate = getTargetDateForEvent(arg);

				// Use shared TaskContextMenu component
				const contextMenu = new TaskContextMenu({
					task: taskInfo,
					plugin: this.plugin,
					targetDate: targetDate,
					onUpdate: () => {
						// Refresh calendar with fresh task data when task is updated
						void this.refreshCalendarWithFreshData();
					},
				});
				contextMenu.show(e);
			});
		}

		// Add context menu for ICS events (right-click) - includes Google/Microsoft Calendar
		if (icsEvent && eventType === "ics") {
			arg.el.addEventListener("contextmenu", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();

				const subscriptionName = arg.event.extendedProps.subscriptionName;

				const contextMenu = new ICSEventContextMenu({
					icsEvent: icsEvent,
					plugin: this.plugin,
					subscriptionName: subscriptionName,
					onUpdate: () => {
						// Refresh calendar with fresh data when ICS event is updated
						void this.refreshCalendarWithFreshData();
					},
				});
				contextMenu.show(e);
			});
		}

		// Add hover preview for property-based events (Ctrl+hover to preview note)
		if (eventType === "property-based" && arg.event.extendedProps.filePath) {
			arg.el.addEventListener("mouseover", (event: MouseEvent) => {
				const file = this.plugin.app.vault.getAbstractFileByPath(
					arg.event.extendedProps.filePath
				);
				if (file) {
					this.plugin.app.workspace.trigger("hover-link", {
						event,
						source: "tasknotes-bases-calendar",
						hoverParent: arg.el,
						targetEl: arg.el,
						linktext: arg.event.extendedProps.filePath,
						sourcePath: arg.event.extendedProps.filePath,
					});
				}
			});
		}

		// Add context menu for property-based events (right-click)
		if (eventType === "property-based" && arg.event.extendedProps.filePath) {
			arg.el.addEventListener("contextmenu", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();

				const file = this.plugin.app.vault.getAbstractFileByPath(
					arg.event.extendedProps.filePath
				);

				if (file instanceof TFile) {
					const menu = new Menu();

					// Trigger Obsidian's default file menu
					this.plugin.app.workspace.trigger(
						"file-menu",
						menu,
						file,
						"tasknotes-bases-calendar"
					);

					// Show menu at mouse position
					menu.showAtPosition({ x: e.clientX, y: e.clientY });
				}
			});
		}
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

			// Calendar element for FullCalendar to render into
			const calendarEl = doc.createElement("div");
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

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		// Use shorter debounce for task updates - these are often from user interactions
		// that expect quicker feedback than external file changes
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
				console.error("[TaskNotes][CalendarView] Render error:", error);
				this.renderError(error instanceof Error ? error : new Error(String(error)));
			})
			.finally(() => this.setEphemeralState(savedState));
	}

	renderError(error: Error): void {
		if (!this.calendarEl) return;

		// Use correct document for pop-out window support
		const doc = this.calendarEl.ownerDocument;
		const errorEl = doc.createElement("div");
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
		errorEl.textContent = `Error loading calendar: ${error.message || "Unknown error"}`;
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
				calendarScroll: captureCalendarScrollState(this.calendarEl),
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
					console.debug("[CalendarView] Failed to restore calendar date:", e);
				}
			}

			// Intentionally ignore legacy `calendarView` ephemeral state. The view
			// type is controlled by the Bases view config and is persisted there
			// when the user changes Calendar view modes.
		}

		if (Array.isArray(state.calendarScroll)) {
			const win = this.containerEl.ownerDocument.defaultView || window;
			const restoreScroll = () => {
				restoreCalendarScrollState(this.calendarEl, state.calendarScroll);
			};
			win.requestAnimationFrame(() => {
				restoreScroll();
				win.requestAnimationFrame(restoreScroll);
			});
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
			console.error("[TaskNotes][CalendarView] No containerEl provided");
			throw new Error("CalendarView requires a containerEl");
		}

		// Create and return the view instance directly; Bases assigns runtime view fields.
		return new CalendarView(controller, containerEl, plugin) as unknown as BasesView;
	};
}
