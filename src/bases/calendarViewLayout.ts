import type { CalendarEventInput } from "./calendarEngine";

const DEFAULT_CALENDAR_EVENT_ORDER = "start,-duration,allDay,title";
export const TASKNOTES_CALENDAR_SORT_INDEX = "tasknotesSortIndex";

export function isRecord(value: unknown): value is Record<string, unknown> {
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


