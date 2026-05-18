import { format } from "date-fns";
import type { TaskInfo, TimeEntry } from "../types";
import {
	formatDateForStorage,
	getDatePart,
	getTimePart,
	hasTimeComponent,
	parseDateToLocal,
	parseDateToUTC,
} from "../utils/dateUtils";
import {
	colorWithAlpha,
	isCssVariableColor,
	normalizeThemeColor,
} from "../utils/themeColors";

export interface CalendarTaskEvent {
	id: string;
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
	backgroundColor?: string;
	borderColor?: string;
	textColor?: string;
	editable?: boolean;
	extendedProps: {
		taskInfo: TaskInfo;
		eventType: "scheduled" | "due" | "scheduledToDueSpan" | "timeEntry";
		isCompleted: boolean;
		timeEntryIndex?: number;
	};
}

export interface CalendarTaskEventContext {
	getPriorityColor(priority: string): string | undefined;
	isCompletedStatus(status: string): boolean;
	getThemeTextColor(useThemeColor?: boolean): string;
}

export function calculateAllDayEndDate(
	startDate: string,
	timeEstimate?: number
): string | undefined {
	if (!timeEstimate) return undefined;

	const days = Math.ceil(timeEstimate / (24 * 60));
	const start = parseDateToUTC(startDate);
	const end = new Date(
		Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + days)
	);
	return formatDateForStorage(end);
}

export function createScheduledTaskEvent(
	task: TaskInfo,
	context: CalendarTaskEventContext
): CalendarTaskEvent | null {
	if (!task.scheduled) return null;

	const hasTime = hasTimeComponent(task.scheduled);
	const startDate = task.scheduled;

	let endDate: string | undefined;
	if (hasTime && task.timeEstimate) {
		const start = parseDateToLocal(startDate);
		const end = new Date(start.getTime() + task.timeEstimate * 60 * 1000);
		endDate = format(end, "yyyy-MM-dd'T'HH:mm");
	} else if (!hasTime) {
		endDate = calculateAllDayEndDate(startDate, task.timeEstimate);
	}

	const borderColor = normalizeThemeColor(
		context.getPriorityColor(task.priority),
		"var(--color-accent)"
	);
	const textColor = isCssVariableColor(borderColor)
		? context.getThemeTextColor(true)
		: borderColor;

	return {
		id: `scheduled-${task.path}`,
		title: task.title,
		start: startDate,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: "transparent",
		borderColor,
		textColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "scheduled",
			isCompleted: context.isCompletedStatus(task.status),
		},
	};
}

export function createDueTaskEvent(
	task: TaskInfo,
	context: CalendarTaskEventContext
): CalendarTaskEvent | null {
	if (!task.due) return null;

	const hasTime = hasTimeComponent(task.due);
	const startDate = task.due;

	let endDate: string | undefined;
	if (hasTime) {
		const start = parseDateToLocal(startDate);
		const end = new Date(start.getTime() + 30 * 60 * 1000);
		endDate = format(end, "yyyy-MM-dd'T'HH:mm");
	}

	const borderColor = normalizeThemeColor(
		context.getPriorityColor(task.priority),
		"var(--color-orange)"
	);
	const textColor = isCssVariableColor(borderColor)
		? context.getThemeTextColor(true)
		: borderColor;

	return {
		id: `due-${task.path}`,
		title: task.title,
		start: startDate,
		end: endDate,
		allDay: !hasTime,
		backgroundColor: colorWithAlpha(borderColor, 0.15),
		borderColor,
		textColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "due",
			isCompleted: context.isCompletedStatus(task.status),
		},
	};
}

function isCalendarEventInVisibleRange(
	event: CalendarTaskEvent,
	visibleStart?: Date,
	visibleEnd?: Date
): boolean {
	if (!visibleStart || !visibleEnd) return true;

	const eventStart = parseDateToLocal(event.start);
	const eventEnd = event.end ? parseDateToLocal(event.end) : eventStart;

	return (
		eventStart.getTime() < visibleEnd.getTime() &&
		eventEnd.getTime() >= visibleStart.getTime()
	);
}

function createAllDayScheduledToDueSpanEvent(
	task: TaskInfo,
	context: CalendarTaskEventContext
): CalendarTaskEvent | null {
	if (!task.scheduled || !task.due) return null;

	const scheduledDate = parseDateToLocal(task.scheduled);
	const dueDate = parseDateToLocal(task.due);
	if (dueDate <= scheduledDate) return null;

	const endDateExclusive = new Date(dueDate);
	endDateExclusive.setDate(endDateExclusive.getDate() + 1);

	const borderColor = normalizeThemeColor(
		context.getPriorityColor(task.priority),
		"var(--color-accent)"
	);
	const textColor = isCssVariableColor(borderColor)
		? context.getThemeTextColor(true)
		: borderColor;

	return {
		id: `span-${task.path}`,
		title: task.title,
		start: format(scheduledDate, "yyyy-MM-dd"),
		end: format(endDateExclusive, "yyyy-MM-dd"),
		allDay: true,
		backgroundColor: colorWithAlpha(borderColor, 0.2),
		borderColor,
		textColor,
		editable: true,
		extendedProps: {
			taskInfo: task,
			eventType: "scheduledToDueSpan",
			isCompleted: context.isCompletedStatus(task.status),
		},
	};
}

function createTimedScheduledToDueSpanEvents(
	task: TaskInfo,
	context: CalendarTaskEventContext,
	visibleStart?: Date,
	visibleEnd?: Date
): CalendarTaskEvent[] {
	if (!task.scheduled || !task.due) return [];

	const scheduledDate = parseDateToLocal(task.scheduled);
	const dueDate = parseDateToLocal(task.due);
	if (dueDate <= scheduledDate) return [];

	const scheduledTime = getTimePart(task.scheduled);
	if (!scheduledTime) return [];

	const [hours, minutes] = scheduledTime.split(":").map(Number);
	const firstDate = parseDateToLocal(getDatePart(task.scheduled));
	const lastDate = parseDateToLocal(getDatePart(task.due));

	const borderColor = normalizeThemeColor(
		context.getPriorityColor(task.priority),
		"var(--color-accent)"
	);
	const textColor = isCssVariableColor(borderColor)
		? context.getThemeTextColor(true)
		: borderColor;
	const isCompleted = context.isCompletedStatus(task.status);

	const events: CalendarTaskEvent[] = [];
	for (
		const day = new Date(firstDate);
		day.getTime() <= lastDate.getTime();
		day.setDate(day.getDate() + 1)
	) {
		const start = new Date(day);
		start.setHours(hours, minutes, 0, 0);

		let end: string | undefined;
		if (task.timeEstimate) {
			const endDate = new Date(start.getTime() + task.timeEstimate * 60 * 1000);
			end = format(endDate, "yyyy-MM-dd'T'HH:mm");
		}

		const instanceDate = format(day, "yyyy-MM-dd");
		const event: CalendarTaskEvent = {
			id: `span-${task.path}-${instanceDate}`,
			title: task.title,
			start: format(start, "yyyy-MM-dd'T'HH:mm"),
			end,
			allDay: false,
			backgroundColor: colorWithAlpha(borderColor, 0.2),
			borderColor,
			textColor,
			editable: true,
			extendedProps: {
				taskInfo: task,
				eventType: "scheduledToDueSpan",
				isCompleted,
			},
		};

		if (isCalendarEventInVisibleRange(event, visibleStart, visibleEnd)) {
			events.push(event);
		}
	}

	return events;
}

export function createScheduledToDueSpanTaskEvents(
	task: TaskInfo,
	context: CalendarTaskEventContext,
	visibleStart?: Date,
	visibleEnd?: Date
): CalendarTaskEvent[] {
	if (!task.scheduled || !task.due) return [];

	if (hasTimeComponent(task.scheduled)) {
		return createTimedScheduledToDueSpanEvents(task, context, visibleStart, visibleEnd);
	}

	const spanEvent = createAllDayScheduledToDueSpanEvent(task, context);
	if (!spanEvent || !isCalendarEventInVisibleRange(spanEvent, visibleStart, visibleEnd)) {
		return [];
	}

	return [spanEvent];
}

export function createScheduledToDueSpanTaskEvent(
	task: TaskInfo,
	context: CalendarTaskEventContext
): CalendarTaskEvent | null {
	return createScheduledToDueSpanTaskEvents(task, context)[0] ?? null;
}

function hasFinishedTimeEntry(entry: TimeEntry): entry is TimeEntry & { endTime: string } {
	return typeof entry.endTime === "string" && entry.endTime.length > 0;
}

export function createTimeEntryTaskEvents(
	task: TaskInfo,
	context: CalendarTaskEventContext
): CalendarTaskEvent[] {
	if (!task.timeEntries) return [];

	const isCompleted = context.isCompletedStatus(task.status);

	return task.timeEntries
		.map((entry, index) => ({ entry, index }))
		.filter(({ entry }) => hasFinishedTimeEntry(entry))
		.map(({ entry, index }) => ({
			id: `timeentry-${task.path}-${index}`,
			title: task.title,
			start: entry.startTime,
			end: entry.endTime,
			allDay: false,
			editable: true,
			extendedProps: {
				taskInfo: task,
				eventType: "timeEntry" as const,
				isCompleted,
				timeEntryIndex: index,
			},
		}));
}
