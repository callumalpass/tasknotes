import type { MessageDescriptor } from "@lingui/core";
import type { App } from "obsidian";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { ReminderContextMenu } from "../components/ReminderContextMenu";
import type TaskNotesPlugin from "../main";
import type { Reminder, TaskInfo } from "../types";
import { openTaskPropertyChoices } from "../ui/taskPropertyPickers";
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

export function showTaskModalRecurrenceContextMenu(
	context: TaskModalActionMenuContext,
	event: UIEvent
): void {
	const state = context.getState();
	const menu = new RecurrenceContextMenu({
		currentValue: state.recurrenceRule,
		currentAnchor: state.recurrenceAnchor,
		scheduledDate: state.scheduledDate,
		onSelect: (value, anchor) => {
			context.setRecurrence(value || "", anchor);
			context.onChange();
		},
		app: context.app,
		plugin: context.plugin,
	});

	menu.show(event);
}

export function showTaskModalReminderContextMenu(
	context: TaskModalActionMenuContext,
	event: UIEvent,
	taskBase?: TaskInfo
): void {
	const menu = new ReminderContextMenu(
		context.plugin,
		createTaskModalReminderDraft(context.getState(), taskBase),
		event.target as HTMLElement,
		(updatedTask: TaskInfo) => {
			context.setReminders(updatedTask.reminders || []);
			context.onChange();
		}
	);

	menu.show(event);
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
