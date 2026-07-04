import type { TaskInfo } from "../types";
import {
	createUTCDateFromLocalCalendarDate,
	getDatePart,
	getTodayLocal,
	parseDateToUTC,
} from "../utils/dateUtils";

/**
 * The four completion "modes" offered by the task context menu. Modes are a UI
 * affordance only — each resolves to a concrete date here, then the caller
 * dispatches the existing completion mechanism (recurring toggle or a
 * non-recurring status change). No service method learns about "modes".
 */
export type CompletionMode = "today" | "asScheduled" | "onDue" | "onPicked";

export interface CompletionDateContext {
	/**
	 * The clicked recurring occurrence, when the producing view addresses a
	 * concrete occurrence (Calendar). Takes precedence over the task's own
	 * `scheduled` for `asScheduled`.
	 */
	occurrenceDate?: Date;
	/** The date/time chosen via the "Complete on…" picker (`onPicked` only). */
	pickedDate?: Date;
}

/**
 * Discriminated result. `available: false` reports *why* the mode cannot resolve
 * (via an i18n key) rather than silently substituting a fallback date, so the
 * menu can render the item disabled with a reason tooltip (R4).
 */
export type CompletionDateResolution =
	| { available: true; date: Date }
	| { available: false; reasonKey: string };

function toUtcDay(dateString: string | undefined): Date | null {
	if (!dateString) {
		return null;
	}
	const datePart = getDatePart(dateString);
	if (!datePart) {
		return null;
	}
	return parseDateToUTC(datePart);
}

/**
 * Resolve one completion mode to a concrete date (KTD1):
 *   - `today`        -> today (UTC-anchored, matching the recurring action path)
 *   - `asScheduled`  -> the clicked occurrence, else the task's scheduled date;
 *                       never falls through to `due` (R4)
 *   - `onDue`        -> the task's due date
 *   - `onPicked`     -> the user-picked date/time
 *
 * `asScheduled`/`onDue` report unavailable when their source is absent so the
 * caller disables the option instead of collapsing it onto another date. For a
 * completion-anchored recurring task, `asScheduled` deliberately resolves to
 * `scheduled` (an explicit re-anchor), distinct from the skip/default path.
 */
export function resolveCompletionDate(
	task: TaskInfo,
	mode: CompletionMode,
	ctx: CompletionDateContext = {}
): CompletionDateResolution {
	switch (mode) {
		case "today":
			return { available: true, date: createUTCDateFromLocalCalendarDate(getTodayLocal()) };
		case "asScheduled": {
			const date = ctx.occurrenceDate ?? toUtcDay(task.scheduled);
			return date
				? { available: true, date }
				: { available: false, reasonKey: "contextMenus.task.completion.noScheduledDate" };
		}
		case "onDue": {
			const date = toUtcDay(task.due);
			return date
				? { available: true, date }
				: { available: false, reasonKey: "contextMenus.task.completion.noDueDate" };
		}
		case "onPicked":
			return ctx.pickedDate
				? { available: true, date: ctx.pickedDate }
				: { available: false, reasonKey: "contextMenus.task.completion.noPickedDate" };
	}
}
