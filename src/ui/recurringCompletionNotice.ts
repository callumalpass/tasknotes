import { Notice } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { getDatePart, parseDateToLocal } from "../utils/dateUtils";
import { getNextUncompletedOccurrence } from "../core/recurrence";
import { format } from "date-fns";
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
		? "notices.recurringCompletion.completed"
		: "notices.recurringCompletion.incomplete", {
		date: format(parseDateToLocal(date), "d MMM yyyy"),
	}) });
	const hasNext = getNextUncompletedOccurrence(task, {
		minOccurrenceDate: task.scheduled ? getDatePart(task.scheduled) : date,
	}) !== null;
	content.createDiv({ text: task.scheduled && hasNext
		? translate("notices.recurringCompletion.next", {
			date: format(parseDateToLocal(getDatePart(task.scheduled)), "d MMM yyyy"),
		})
		: translate("notices.recurringCompletion.noNext") });
	const button = content.createEl("button", {
		text: translate("notices.recurringCompletion.undo"),
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
					? "notices.recurringCompletion.undone"
					: "notices.recurringCompletion.conflict"));
			} catch (error) {
				tasknotesLogger.error("Recurring completion undo failed", {
					category: "persistence", operation: "recurring-completion-undo", error,
				});
				new Notice(translate("notices.recurringCompletion.failed"));
			} finally {
				notice.hide();
			}
		})();
	});
}
