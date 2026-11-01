import { calendarDateToInstant, calendarInstantToDate, planCalendarEdit, type CalendarChange, type CalendarEntry } from "@tasknotes/model/calendar";
import type { TaskInfo } from "../types";
import { eventApiFromItem, type CalendarEventChange, type CalendarEventItem, type CalendarEventProps } from "./calendarEngine";

/** Only ordinary date markers are task-level targets, not series, spans or tracked time. */
export function isCalendarBatchTarget(props: CalendarEventProps | undefined): props is CalendarEventProps & { taskInfo: TaskInfo; modelEntry: CalendarEntry } {
	const entry = props?.modelEntry;
	return Boolean(props?.taskInfo && entry && !props.isBatchPreview && !props.taskInfo.recurrence && !entry.recurringKind &&
		entry.startEditable && !entry.isOverdueOnToday && ["scheduled", "due"].includes(entry.type));
}

export interface CalendarBatchMove {
	task: TaskInfo;
	entry: CalendarEntry;
	change: CalendarChange;
	undoEntry: CalendarEntry;
	undoChange: CalendarChange;
	before: Pick<TaskInfo, "scheduled" | "due">;
	after: Pick<TaskInfo, "scheduled" | "due">;
}

export interface CalendarBatchProposal {
	item: CalendarEventItem;
	start: Date;
	end: Date;
	allDay: boolean;
}

/** Uses exactly the persistence plan, without writing notes or modifying source items. */
export function buildCalendarBatchPreview(
	items: readonly CalendarEventItem[],
	paths: readonly string[],
	proposal: CalendarBatchProposal,
	timezone: string,
	fieldMapping: Parameters<typeof planCalendarEdit>[0]["fieldMapping"],
	now: string
): CalendarEventItem[] | null {
	const anchor = proposal.item.data?.taskInfo?.path;
	if (!anchor || !isCalendarBatchTarget(proposal.item.data) || !paths.includes(anchor) || paths.length < 2) return null;
	const tasks = paths.map(path => {
		const task = items.find(item => item.data?.taskInfo?.path === path)?.data?.taskInfo;
		if (!task) throw new Error("Selected task is no longer visible");
		return task;
	});
	const oldEvent = eventApiFromItem(proposal.item);
	const moves = planCalendarBatchMove(items, tasks, {
		oldEvent, event: { ...oldEvent, start: proposal.start, end: proposal.end, allDay: proposal.allDay },
		jsEvent: null, isPointer: true, revert: () => {},
	}, timezone, fieldMapping, now);
	return moves.flatMap(move => items
		.filter(item => item.id !== proposal.item.id && item.data?.taskInfo?.path === move.task.path && item.data.modelEntry?.id === move.entry.id)
		.map(item => ({
			...item,
			start: move.change.start,
			end: move.change.end,
			rev: `batch-preview:${move.change.start}:${move.change.end ?? ""}:${item.rev ?? ""}`,
			preview: true,
			editable: false, startEditable: false, durationEditable: false,
			className: [...(typeof item.className === "string" ? [item.className] : item.className ?? []), "tn-calendar-batch-preview"],
			data: { ...item.data, eventType: move.entry.type, isBatchPreview: true },
		})));
}

/** Wall-clock arithmetic preserves local appointment times across DST, not elapsed milliseconds. */
function wallTime(value: string): number {
	return Date.parse(`${value.length === 10 ? `${value}T00:00:00` : value}Z`);
}

export function planCalendarBatchMove(
	items: readonly CalendarEventItem[],
	tasks: readonly TaskInfo[],
	info: CalendarEventChange,
	timezone: string,
	fieldMapping: Parameters<typeof planCalendarEdit>[0]["fieldMapping"],
	now: string
): CalendarBatchMove[] {
	const origin = info.oldEvent.extendedProps;
	if (!isCalendarBatchTarget(origin) || !info.event.start || !info.oldEvent.start || info.event.allDay !== info.oldEvent.allDay) {
		throw new Error("Unsupported calendar batch move");
	}
	const currentOrigin = items.find(item => item.id === info.oldEvent.id)?.data?.taskInfo;
	if (!currentOrigin || currentOrigin.scheduled !== origin.taskInfo.scheduled || currentOrigin.due !== origin.taskInfo.due) {
		throw new Error("Dragged task changed during the gesture");
	}
	const oldWall = calendarInstantToDate(info.oldEvent.start.getTime(), timezone);
	const newWall = calendarInstantToDate(info.event.start.getTime(), timezone);
	const delta = wallTime(newWall) - wallTime(oldWall);
	const dayDelta = wallTime(newWall.slice(0, 10)) - wallTime(oldWall.slice(0, 10));
	const shift = (value: string, allDay: boolean): string => {
		const wall = calendarInstantToDate(calendarDateToInstant(value, timezone), timezone, allDay);
		const shifted = new Date(wallTime(wall) + (allDay ? dayDelta : delta)).toISOString();
		return shifted.slice(0, allDay ? 10 : 19);
	};
	return tasks.map(task => {
		const item = items.find(candidate => candidate.data?.taskInfo?.path === task.path &&
			candidate.data?.modelEntry?.type === origin.modelEntry?.type && isCalendarBatchTarget(candidate.data));
		const entry = item?.data?.modelEntry;
		if (!entry || task.recurrence || task.scheduled !== item?.data?.taskInfo?.scheduled || task.due !== item?.data?.taskInfo?.due) {
			throw new Error("Selection is hidden, incompatible, or changed since rendering");
		}
		const start = shift(entry.start, entry.allDay);
		const end = entry.end ? shift(entry.end, entry.allDay) : undefined;
		const change: CalendarChange = { kind: "drop", start, end, allDay: entry.allDay };
		const plan = planCalendarEdit({ task, entry, change, timezone, fieldMapping, now });
		if (plan.clearedInstances.complete.length || plan.clearedInstances.skipped.length) {
			throw new Error("Batch moves cannot clear recurrence history");
		}
		return {
			task, entry, change,
			undoEntry: { ...entry, start, end },
			undoChange: { kind: "drop", start: entry.start, end: entry.end, allDay: entry.allDay },
			before: { scheduled: task.scheduled, due: task.due },
			after: { scheduled: plan.updatedTask.scheduled, due: plan.updatedTask.due },
		};
	});
}
