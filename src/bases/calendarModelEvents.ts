import {
	calendarDateToInstant,
	calendarTaskId,
	createCalendarEntryIndex,
	type CalendarContext,
	type CalendarEntry,
	type CalendarRange,
	type CalendarTask,
} from "@tasknotes/model/calendar";
import { normalizeTaskReference } from "@tasknotes/model/operations";
import type { TaskInfo } from "../types";
import type { CalendarEvent } from "./calendar-core";
import { colorWithAlpha, isCssVariableColor, normalizeThemeColor } from "../utils/themeColors";
import { parseLinkToPath } from "../utils/linkUtils";

export interface CalendarTaskAppearance {
	getPriorityColor(priority: string): string | undefined;
	getThemeTextColor(): string;
}

/** Only presentation belongs here; dates, identities and permissions come from the model. */
export function calendarEntryToEvent(
	entry: CalendarEntry,
	task: TaskInfo,
	appearance: CalendarTaskAppearance
): CalendarEvent {
	const pattern = entry.recurringKind === "pattern";
	const color = normalizeThemeColor(
		appearance.getPriorityColor(task.priority),
		entry.type === "due" ? "var(--color-orange)" : "var(--color-accent)"
	);
	let backgroundColor = "transparent";
	if (entry.type === "due") backgroundColor = colorWithAlpha(color, 0.15);
	else if (entry.type === "scheduledToDueSpan") backgroundColor = colorWithAlpha(color, 0.2);
	else if (entry.recurringKind && entry.isCompleted) {
		backgroundColor = pattern ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.3)";
	} else if (entry.recurringKind && entry.isSkipped) {
		backgroundColor = pattern ? "rgba(128,128,128,0.15)" : "rgba(128,128,128,0.2)";
	}
	const borderColor = pattern ? colorWithAlpha(color, 0.5) : color;
	return {
		id: entry.id,
		title: task.title,
		start: entry.start,
		end: entry.end,
		allDay: entry.allDay,
		...(entry.type === "timeEntry"
			? {}
			: {
					backgroundColor,
					borderColor,
					textColor: isCssVariableColor(color)
						? appearance.getThemeTextColor()
						: borderColor,
				}),
		editable: entry.startEditable,
		extendedProps: {
			modelEntry: entry,
			taskInfo: task,
			eventType: entry.type,
			isCompleted: entry.isCompleted,
			isSkipped: entry.isSkipped,
			isNextScheduledOccurrence: entry.recurringKind === "next-scheduled",
			isPatternInstance: pattern,
			isRecurringInstance: entry.recurringKind === "recorded",
			instanceDate: entry.instanceDate,
			recurringTemplateTime: entry.recurringTemplateTime,
			timeEntryIndex: entry.timeEntryIndex,
			isMaterializedOccurrence: entry.isMaterializedOccurrence,
			occurrenceDate: entry.isMaterializedOccurrence ? entry.instanceDate : undefined,
			occurrenceParent: entry.occurrenceParent,
			isOverdueOnToday: entry.isOverdueOnToday,
		},
	};
}

/** Resolve links using Obsidian, including children excluded by the Bases query. */
export function calendarMaterializedOccurrences(
	tasks: readonly TaskInfo[],
	resolve: (link: string, source: string) => string | undefined
): Record<string, string[]> {
	const ids = new Map<string, string>();
	for (const task of tasks) {
		ids.set(normalizeTaskReference(task.path), calendarTaskId(task));
		ids.set(calendarTaskId(task), calendarTaskId(task));
	}
	const result: Record<string, string[]> = {};
	for (const task of tasks) {
		if (!task.recurrence_parent || !task.occurrence_date) continue;
		const reference =
			resolve(parseLinkToPath(task.recurrence_parent), task.path) ?? task.recurrence_parent;
		const id = ids.get(normalizeTaskReference(reference)) ?? ids.get(reference);
		if (id) (result[id] ??= []).push(task.occurrence_date.slice(0, 10));
	}
	return result;
}

/** Strip host/formula data and retain stable projection objects across Bases snapshots. */
function projectionTask(task: TaskInfo): CalendarTask {
	return {
		id: task.id,
		path: task.path,
		title: task.title,
		status: task.status,
		scheduled: task.scheduled,
		due: task.due,
		timeEstimate: task.timeEstimate,
		recurrence: task.recurrence,
		recurrence_anchor: task.recurrence_anchor,
		recurrence_original_date: task.recurrence_original_date,
		recurrence_parent: task.recurrence_parent,
		occurrence_date: task.occurrence_date,
		complete_instances: task.complete_instances,
		skipped_instances: task.skipped_instances,
		timeEntries: task.timeEntries,
		dateCreated: task.dateCreated,
		dateModified: task.dateModified,
		googleCalendarExceptionOriginalScheduled: task.googleCalendarExceptionOriginalScheduled,
		googleCalendarMovedOriginalDates: task.googleCalendarMovedOriginalDates,
	};
}

/** Accept the space separator other tools write; the model parses strict ISO only. */
function calendarDate(value: string | undefined, timezone: string): string | undefined {
	if (!value) return value;
	for (const candidate of [value, value.trim().replace(/^(\d{4}-\d{2}-\d{2}) (?=\d)/, "$1T")]) {
		try {
			calendarDateToInstant(candidate, timezone);
			return candidate;
		} catch {
			// Try the next spelling.
		}
	}
	return undefined;
}

/** Drop only the unparseable dates, so a malformed field cannot hide the whole task. */
function withValidDates(
	task: CalendarTask,
	timezone: string
): { task: CalendarTask; invalid: string[] } {
	const invalid: string[] = [];
	const date = (field: string, value: string | undefined) => {
		const parsed = calendarDate(value, timezone);
		if (value && !parsed) invalid.push(field);
		return parsed;
	};
	const dates = (field: string, values: string[] | undefined) =>
		values?.flatMap((value) => {
			const parsed = date(field, value);
			return parsed ? [parsed] : [];
		});
	return {
		task: {
			...task,
			scheduled: date("scheduled", task.scheduled),
			due: date("due", task.due),
			dateCreated: date("dateCreated", task.dateCreated),
			complete_instances: dates("complete_instances", task.complete_instances),
			skipped_instances: dates("skipped_instances", task.skipped_instances),
			timeEntries: task.timeEntries?.flatMap((entry) => {
				const startTime = date("timeEntries", entry.startTime);
				const endTime = date("timeEntries", entry.endTime);
				return startTime && (endTime || !entry.endTime)
					? [{ ...entry, startTime, endTime }]
					: [];
			}),
		},
		invalid: [...new Set(invalid)],
	};
}

export class CalendarTaskProjection {
	private readonly index;
	private readonly tasks = new Map<string, { signature: string; task: CalendarTask }>();
	constructor(
		private context: CalendarContext,
		private readonly onInvalid: (task: TaskInfo, error: unknown) => void
	) {
		this.index = createCalendarEntryIndex(context);
	}

	getContext(): CalendarContext {
		return this.context;
	}

	setContext(context: CalendarContext): void {
		this.context = context;
		this.index.setContext(context);
	}

	setTasks(tasks: readonly TaskInfo[]): void {
		const ids = new Set(tasks.map(calendarTaskId));
		for (const id of this.tasks.keys()) if (!ids.has(id)) this.remove(id);
		for (const task of tasks) this.upsert(task);
		this.index.setTasks(
			tasks.flatMap((task) => {
				const cached = this.tasks.get(calendarTaskId(task));
				return cached ? [cached.task] : [];
			})
		);
	}

	upsert(task: TaskInfo): void {
		const id = calendarTaskId(task);
		const projected = projectionTask(task);
		const signature = JSON.stringify(projected);
		if (this.tasks.get(id)?.signature === signature) return;
		// Keep malformed notes from breaking every other row in the calendar, and a malformed
		// date from hiding the rest of its task.
		const { task: valid, invalid } = withValidDates(projected, this.context.timezone);
		if (invalid.length) {
			this.onInvalid(task, new Error(`invalid-calendar-date: ${invalid.join(", ")}`));
		}
		try {
			this.tasks.set(id, { signature, task: valid });
			this.index.upsert(id, valid);
		} catch (error) {
			this.remove(id);
			this.onInvalid(task, error);
		}
	}

	remove(id: string): void {
		this.tasks.delete(id);
		this.index.remove(id);
	}

	entriesInRange(range: CalendarRange): CalendarEntry[] {
		return this.index.entriesInRange(range);
	}

	clear(): void {
		this.tasks.clear();
		this.index.clear();
	}
}
