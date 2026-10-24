import type { CalendarItem, DateInput, ItemChangeArg } from "@tasknotes/calendar";
import type { CalendarEvent } from "./calendar-core";
import type { CalendarPropertyEvent } from "./calendarPropertyEvents";

/** Event objects built by calendar-core and the property/external event builders. */
export type CalendarEventInput = CalendarEvent | CalendarPropertyEvent;

/** Per-item data: the event's extended props, plus the Bases sort rank. */
export type CalendarEventProps = CalendarEvent["extendedProps"] & {
	tasknotesSortIndex?: number;
};

export type CalendarEventItem = CalendarItem<CalendarEventProps>;

/**
 * The event shape the mutation and menu helpers read: start/end as Dates in
 * the local zone, `end` null when the event has no explicit end.
 */
export interface CalendarEventApi {
	id: string;
	title: string;
	start: Date | null;
	end: Date | null;
	allDay: boolean;
	extendedProps: CalendarEventProps;
}

export interface CalendarEventChange {
	event: CalendarEventApi;
	oldEvent: CalendarEventApi;
	jsEvent: PointerEvent | KeyboardEvent | null;
	/** Modifier keys only mean "copy" for pointer drops, not keyboard moves. */
	isPointer: boolean;
	revert: () => void;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const FLOATING = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Parses calendar date input the way the calendar does: date-only and floating values are local. */
export function calendarInputToDate(value: DateInput | null | undefined): Date | null {
	if (value === null || value === undefined || value === "") return null;
	if (value instanceof Date) return new Date(value.getTime());
	if (typeof value === "number") return new Date(value);
	const day = DATE_ONLY.exec(value);
	if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
	const floating = FLOATING.exec(value);
	if (floating) {
		return new Date(
			Number(floating[1]),
			Number(floating[2]) - 1,
			Number(floating[3]),
			Number(floating[4]),
			Number(floating[5]),
			Number(floating[6] ?? 0)
		);
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const EDITABLE_TASK_EVENT_TYPES = new Set([
	"scheduled",
	"recurring",
	"timeEntry",
	"due",
	"scheduledToDueSpan",
]);

/**
 * Whether dragging may change an event. Timeblocks and task events are
 * editable except recurring spans; property-based and provider events keep
 * the permission their builder set.
 */
export function resolveCalendarEventEditable(event: CalendarEventInput): boolean | undefined {
	const props = event.extendedProps as CalendarEventProps;
	if (props.eventType === "timeblock" && props.timeblock) return true;
	if (props.taskInfo?.path && EDITABLE_TASK_EVENT_TYPES.has(props.eventType)) {
		return (
			props.eventType !== "scheduledToDueSpan" ||
			!(props.isRecurringInstance || props.isNextScheduledOccurrence || props.isPatternInstance)
		);
	}
	return event.editable;
}

/** Converts built events to calendar items. Ids are made unique, as the calendar keys items by id. */
export function toCalendarItems(events: readonly CalendarEventInput[]): CalendarEventItem[] {
	const seen = new Map<string, number>();
	return events.map((event) => {
		const count = seen.get(event.id) ?? 0;
		seen.set(event.id, count + 1);
		const props = event.extendedProps as CalendarEventProps;
		const editable = resolveCalendarEventEditable(event);
		const item: CalendarEventItem = {
			id: count === 0 ? event.id : `${event.id}#${count}`,
			title: event.title,
			start: event.start,
			end: event.end ?? null,
			allDay: event.allDay,
			kind: props.eventType,
			backgroundColor: event.backgroundColor,
			borderColor: event.borderColor,
			textColor: event.textColor,
			editable,
			data: props,
		};
		if (props.eventType === "timeEntry") item.lane = "actual";
		if (props.isCompleted) item.completed = true;
		return item;
	});
}

export function eventApiFromItem(item: CalendarEventItem): CalendarEventApi {
	const start = calendarInputToDate(item.start);
	const end = calendarInputToDate(item.end);
	const allDay = item.allDay ?? (typeof item.start === "string" && DATE_ONLY.test(item.start));
	return {
		id: item.id,
		title: item.title,
		start,
		end,
		allDay,
		extendedProps: item.data ?? { eventType: "scheduled" },
	};
}

export function eventChangeFromArg(
	arg: ItemChangeArg<CalendarEventProps>,
	kind: "drop" | "resize"
): CalendarEventChange {
	const oldEvent = eventApiFromItem(arg.item);
	// A moved event without an end keeps none; its displayed length is a default.
	const keepsOpenEnd =
		kind === "drop" &&
		(arg.item.end === null || arg.item.end === undefined) &&
		arg.allDay === arg.oldAllDay;
	return {
		event: {
			...oldEvent,
			start: arg.start,
			end: keepsOpenEnd ? null : arg.end,
			allDay: arg.allDay,
		},
		oldEvent,
		jsEvent: arg.jsEvent,
		isPointer: arg.source === "pointer",
		revert: arg.revert,
	};
}
