import { formatUIDate } from "../i18n/formatters";
import { msg } from "@lingui/core/macro";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { getDatePart, parseDateToLocal } from "../utils/dateUtils";
import { getNextUncompletedOccurrence } from "../core/recurrence";
import { showToast } from "./kit/toast";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "RecurringCompletionNotice" });

export function recurringCompletionMessage(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	date: string,
	completed: boolean
): string {
	const translate = plugin.i18n.translate.bind(plugin.i18n);
	const result = translate(
		completed
			? msg({
					message: "Completed occurrence: {date}",
					context: "notices.recurringCompletion.completed",
				})
			: msg({
					message: "Marked incomplete: {date}",
					context: "notices.recurringCompletion.incomplete",
				}),
		{
			date: formatUIDate(parseDateToLocal(date), "d MMM yyyy"),
		}
	);
	const hasNext =
		getNextUncompletedOccurrence(task, {
			minOccurrenceDate: task.scheduled ? getDatePart(task.scheduled) : date,
		}) !== null;
	const next =
		task.scheduled && hasNext
			? translate(
					msg({ message: "Next: {date}", context: "notices.recurringCompletion.next" }),
					{
						date: formatUIDate(
							parseDateToLocal(getDatePart(task.scheduled)),
							"d MMM yyyy"
						),
					}
				)
			: translate(
					msg({
						message: "No next occurrence",
						context: "notices.recurringCompletion.noNext",
					})
				);
	return `${task.title} · ${result} · ${next}`;
}

export function showRecurringCompletionNotice(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	date: string,
	completed: boolean,
	undo: () => Promise<boolean>
): void {
	const translate = plugin.i18n.translate.bind(plugin.i18n);
	showToast({
		undoScope: plugin.app.vault,
		message: recurringCompletionMessage(plugin, task, date, completed),
		durationMs: 15000,
		action: {
			label: translate(msg({ message: "Undo", context: "notices.recurringCompletion.undo" })),
			run: async () => {
				let restored: boolean;
				try {
					restored = await undo();
				} catch (error) {
					tasknotesLogger.error("Recurring completion undo failed", {
						category: "persistence", operation: "recurring-completion-undo", error,
					});
					showToast({ message: translate(msg({ message: "Could not undo the recurring task change.", context: "notices.recurringCompletion.failed" })) });
					throw error;
				}
				if (!restored) throw new Error("Occurrence changed since completion");
				showToast({ message: translate(msg({ message: "Recurring task change undone.", context: "notices.recurringCompletion.undone" })) });
			},
		},
	});
}
