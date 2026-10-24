import { formatUIDate } from "../i18n/formatters";
import { msg } from "@lingui/core/macro";
import { Notice } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { getDatePart, parseDateToLocal } from "../utils/dateUtils";
import { getNextUncompletedOccurrence } from "../core/recurrence";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "RecurringCompletionNotice" });

export function showRecurringCompletionNotice(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	date: string,
	completed: boolean,
	undo: () => Promise<boolean>
): void {
	const translate = plugin.i18n.translate.bind(plugin.i18n);
	const fragment = createFragment();
	const content = createDiv();
	content.createDiv({ text: task.title });
	content.createDiv({ text: translate(completed
		? msg({ message: "Completed occurrence: {date}", context: "notices.recurringCompletion.completed" })
		: msg({ message: "Marked incomplete: {date}", context: "notices.recurringCompletion.incomplete" }), {
		date: formatUIDate(parseDateToLocal(date), "d MMM yyyy"),
	}) });
	const hasNext = getNextUncompletedOccurrence(task, {
		minOccurrenceDate: task.scheduled ? getDatePart(task.scheduled) : date,
	}) !== null;
	content.createDiv({ text: task.scheduled && hasNext
		? translate(msg({ message: "Next: {date}", context: "notices.recurringCompletion.next" }), {
			date: formatUIDate(parseDateToLocal(getDatePart(task.scheduled)), "d MMM yyyy"),
		})
		: translate(msg({ message: "No next occurrence", context: "notices.recurringCompletion.noNext" })) });
	const button = content.createEl("button", {
		text: translate(msg({ message: "Undo", context: "notices.recurringCompletion.undo" })),
		attr: { type: "button" },
	});
	fragment.append(content);
	const notice = new Notice(fragment, 15000);
	button.addEventListener("click", event => {
		event.stopPropagation();
		button.disabled = true;
		void (async () => {
			try {
				const restored = await undo();
				new Notice(translate(restored
					? msg({ message: "Recurring task change undone.", context: "notices.recurringCompletion.undone" })
					: msg({ message: "Cannot undo: this occurrence or its schedule has changed.", context: "notices.recurringCompletion.conflict" })));
			} catch (error) {
				tasknotesLogger.error("Recurring completion undo failed", {
					category: "persistence", operation: "recurring-completion-undo", error,
				});
				new Notice(translate(msg({ message: "Could not undo the recurring task change.", context: "notices.recurringCompletion.failed" })));
			} finally {
				notice.hide();
			}
		})();
	});
}
