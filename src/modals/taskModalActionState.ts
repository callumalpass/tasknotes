import type { App } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { PriorityConfig, Reminder, StatusConfig } from "../types";
import type { TaskModalActionIconState } from "./taskModalActionIconStates";
import type {
	TaskModalActionMenuContext,
	TaskModalActionMenuState,
} from "./taskModalActionMenus";
import {
	getDefaultTaskModalPriority,
	getDefaultTaskModalStatus,
	getTaskModalRecurrenceDisplayText,
} from "./taskModalActionValues";

type RecurrenceAnchor = TaskModalActionMenuState["recurrenceAnchor"];

export interface TaskModalActionStateInput {
	title: string;
	status: string;
	priority: string;
	dueDate: string;
	scheduledDate: string;
	recurrenceRule: string;
	recurrenceAnchor: RecurrenceAnchor;
	reminders?: Reminder[];
}

export interface TaskModalActionMenuContextOptions {
	app: App;
	plugin: TaskNotesPlugin;
	translate: (key: string, params?: Record<string, string | number>) => string;
	getState: () => TaskModalActionMenuState;
	setDueDate: (value: string) => void;
	setScheduledDate: (value: string) => void;
	setStatus: (value: string) => void;
	setPriority: (value: string) => void;
	setRecurrenceRule: (value: string) => void;
	setRecurrenceAnchor: (value: RecurrenceAnchor) => void;
	setReminders: (reminders: Reminder[]) => void;
	onChange: () => void;
}

export interface TaskModalActionIconStateOptions {
	statusConfigs?: readonly StatusConfig[];
	priorityConfigs?: readonly PriorityConfig[];
}

export function createTaskModalActionMenuState(
	input: TaskModalActionStateInput
): TaskModalActionMenuState {
	return {
		title: input.title,
		status: input.status,
		priority: input.priority,
		dueDate: input.dueDate,
		scheduledDate: input.scheduledDate,
		recurrenceRule: input.recurrenceRule,
		recurrenceAnchor: input.recurrenceAnchor,
		reminders: input.reminders || [],
	};
}

export function createTaskModalActionMenuContext(
	options: TaskModalActionMenuContextOptions
): TaskModalActionMenuContext {
	return {
		app: options.app,
		plugin: options.plugin,
		translate: options.translate,
		getState: options.getState,
		setDate: (type, value) => {
			if (type === "due") {
				options.setDueDate(value);
				return;
			}

			options.setScheduledDate(value);
		},
		setStatus: options.setStatus,
		setPriority: options.setPriority,
		setRecurrence: (value, anchor) => {
			options.setRecurrenceRule(value);
			if (anchor !== undefined) {
				options.setRecurrenceAnchor(anchor);
			}
		},
		setReminders: options.setReminders,
		onChange: options.onChange,
	};
}

export function buildTaskModalActionIconState(
	state: TaskModalActionMenuState,
	options: TaskModalActionIconStateOptions
): TaskModalActionIconState {
	const statusConfigs = options.statusConfigs || [];
	const priorityConfigs = options.priorityConfigs || [];

	return {
		dueDate: state.dueDate,
		scheduledDate: state.scheduledDate,
		status: state.status,
		priority: state.priority,
		recurrenceRule: state.recurrenceRule,
		recurrenceDisplayText: getTaskModalRecurrenceDisplayText(state.recurrenceRule),
		reminderCount: state.reminders.length,
		defaultStatus: getDefaultTaskModalStatus(statusConfigs),
		defaultPriority: getDefaultTaskModalPriority(priorityConfigs),
		statusConfigs,
		priorityConfigs,
	};
}
