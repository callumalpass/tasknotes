import type { MessageDescriptor } from "@lingui/core";
import type { App } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { Reminder, TaskInfo } from "../types";
import { openTaskPropertyChoices } from "../ui/taskPropertyPickers";
import { openReminderChoices } from "../ui/taskReminderPicker";
import { openRecurrenceChoices } from "../ui/taskRecurrencePicker";
import type { PopoverHandle } from "../ui/kit/popover";

export type TaskModalDateMenuType = "due" | "scheduled";
type RecurrenceAnchor = "scheduled" | "completion";

export interface TaskModalActionMenuState {
	title: string;
	status: string;
	priority: string;
	dueDate: string;
	scheduledDate: string;
	recurrenceRule: string;
	recurrenceAnchor: RecurrenceAnchor;
	reminders: Reminder[];
}

export interface TaskModalActionMenuContext {
	app: App;
	plugin: TaskNotesPlugin;
	translate: (key: MessageDescriptor, params?: Record<string, string | number>) => string;
	getState: () => TaskModalActionMenuState;
	setDate: (type: TaskModalDateMenuType, value: string) => void;
	setStatus: (value: string) => void;
	setPriority: (value: string) => void;
	setRecurrence: (value: string, anchor?: RecurrenceAnchor) => void;
	setReminders: (reminders: Reminder[]) => void;
	onChange: () => void;
}

export function showTaskModalPropertyPicker(
	context: TaskModalActionMenuContext,
	property: "status" | "priority" | TaskModalDateMenuType,
	anchor: HTMLElement
): Promise<PopoverHandle | undefined> {
	const draft = () => createTaskModalReminderDraft(context.getState());
	return openTaskPropertyChoices(context.plugin, property, [draft()], anchor, (choice) => {
		const value = typeof choice === "function" ? choice(draft()) : choice;
		if (typeof value !== "string" && value !== undefined) return;
		if (property === "status") context.setStatus(value ?? "");
		else if (property === "priority") context.setPriority(value ?? "");
		else context.setDate(property, value ?? "");
		context.onChange();
	});
}

export function showTaskModalRecurrencePicker(
	context: TaskModalActionMenuContext,
	anchor: HTMLElement
): PopoverHandle {
	const state = context.getState();
	return openRecurrenceChoices(
		context.plugin,
		context.app,
		{
			recurrence: state.recurrenceRule,
			anchor: state.recurrenceAnchor,
			scheduled: state.scheduledDate,
		},
		anchor,
		(value, recurrenceAnchor) => {
			context.setRecurrence(value || "", recurrenceAnchor);
			context.onChange();
		}
	);
}

/**
 * The reminder picker: quick reminders relative to the due and scheduled
 * dates, then the reminder modal and Clear. Reminders already set are ticked.
 * Changes stay in the modal until it is saved.
 */
export function showTaskModalReminderPicker(
	context: TaskModalActionMenuContext,
	anchor: HTMLElement,
	taskBase?: TaskInfo
): PopoverHandle {
	const state = context.getState();
	return openReminderChoices({
		plugin: context.plugin,
		anchor,
		due: state.dueDate,
		scheduled: state.scheduledDate,
		getReminders: () => context.getState().reminders,
		draft: () => createTaskModalReminderDraft(context.getState(), taskBase),
		setReminders: (reminders) => {
			context.setReminders(reminders);
			context.onChange();
		},
	});
}

export function createTaskModalReminderDraft(
	state: TaskModalActionMenuState,
	taskBase?: TaskInfo
): TaskInfo {
	return {
		...taskBase,
		title: state.title,
		status: state.status,
		priority: state.priority,
		due: state.dueDate,
		scheduled: state.scheduledDate,
		path: taskBase?.path || "",
		archived: taskBase?.archived || false,
		reminders: state.reminders,
	};
}
