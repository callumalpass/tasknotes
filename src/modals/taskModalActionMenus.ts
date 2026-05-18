import type { App } from "obsidian";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { ReminderContextMenu } from "../components/ReminderContextMenu";
import { StatusContextMenu } from "../components/StatusContextMenu";
import type TaskNotesPlugin from "../main";
import type { Reminder, TaskInfo } from "../types";
import { combineDateAndTime, getDatePart, getTimePart } from "../utils/dateUtils";
import { DateTimePickerModal } from "./DateTimePickerModal";

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
	translate: (key: string, params?: Record<string, string | number>) => string;
	getState: () => TaskModalActionMenuState;
	setDate: (type: TaskModalDateMenuType, value: string) => void;
	setStatus: (value: string) => void;
	setPriority: (value: string) => void;
	setRecurrence: (value: string, anchor?: RecurrenceAnchor) => void;
	setReminders: (reminders: Reminder[]) => void;
	onChange: () => void;
}

export function showTaskModalDateContextMenu(
	context: TaskModalActionMenuContext,
	type: TaskModalDateMenuType
): void {
	const currentValue = getDateValue(context.getState(), type);
	const modal = new DateTimePickerModal(context.app, {
		currentDate: currentValue ? getDatePart(currentValue) : undefined,
		currentTime: currentValue ? getTimePart(currentValue) : undefined,
		title: getDateMenuTitle(context, type),
		dateRole: type,
		plugin: context.plugin,
		onSelect: (value: string | null, time: string | null) => {
			context.setDate(type, getSelectedDateValue(value, time));
			context.onChange();
		},
	});

	modal.open();
}

export function showTaskModalStatusContextMenu(
	context: TaskModalActionMenuContext,
	event: UIEvent
): void {
	const menu = new StatusContextMenu({
		currentValue: context.getState().status,
		onSelect: (value) => {
			context.setStatus(value);
			context.onChange();
		},
		plugin: context.plugin,
	});

	menu.show(event);
}

export function showTaskModalPriorityContextMenu(
	context: TaskModalActionMenuContext,
	event: UIEvent
): void {
	const menu = new PriorityContextMenu({
		currentValue: context.getState().priority,
		onSelect: (value) => {
			context.setPriority(value);
			context.onChange();
		},
		plugin: context.plugin,
	});

	menu.show(event);
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

export function getSelectedDateValue(value: string | null, time: string | null): string {
	if (!value) return "";
	return time ? combineDateAndTime(value, time) : value;
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

function getDateValue(
	state: TaskModalActionMenuState,
	type: TaskModalDateMenuType
): string {
	return type === "due" ? state.dueDate : state.scheduledDate;
}

function getDateMenuTitle(
	context: TaskModalActionMenuContext,
	type: TaskModalDateMenuType
): string {
	return type === "due"
		? context.translate("modals.task.dateMenu.dueTitle")
		: context.translate("modals.task.dateMenu.scheduledTitle");
}
