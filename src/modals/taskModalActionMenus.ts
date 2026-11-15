import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { setIcon, type App } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { Reminder, TaskInfo } from "../types";
import { openListPicker, type PickerItem } from "../ui/kit/listPicker";
import { openTaskPropertyChoices, taskPropertyLabel } from "../ui/taskPropertyPickers";
import { ReminderModal } from "./ReminderModal";
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
	const t = context.translate;
	const offsets = [
		{ offset: "PT0M", label: t(msg({ message: "At time of event", context: "components.reminderContextMenu.quickReminders.atTime" })) },
		{ offset: "-PT5M", label: t(msg({ message: "5 minutes before", context: "components.reminderContextMenu.quickReminders.fiveMinutesBefore" })) },
		{ offset: "-PT15M", label: t(msg({ message: "15 minutes before", context: "components.reminderContextMenu.quickReminders.fifteenMinutesBefore" })) },
		{ offset: "-PT1H", label: t(msg({ message: "1 hour before", context: "components.reminderContextMenu.quickReminders.oneHourBefore" })) },
		{ offset: "-P1D", label: t(msg({ message: "1 day before", context: "components.reminderContextMenu.quickReminders.oneDayBefore" })) },
	];
	const quick = new Map<string, Reminder>();
	const items: PickerItem[] = [];
	for (const relatedTo of ["due", "scheduled"] as const) {
		if (!(relatedTo === "due" ? state.dueDate : state.scheduledDate)) continue;
		const group = taskPropertyLabel(relatedTo);
		for (const { offset, label } of offsets) {
			const id = `${relatedTo}:${offset}`;
			quick.set(id, { id: "", type: "relative", relatedTo, offset, description: label });
			items.push({
				id,
				label,
				group,
				keywords: group,
				selected: state.reminders.some(
					(reminder) =>
						reminder.type === "relative" &&
						reminder.relatedTo === relatedTo &&
						reminder.offset === offset
				),
				renderLeading: (host) => setIcon(host, "bell"),
			});
		}
	}
	items.push({
		id: "manage",
		label: t(msg({ message: "Manage all reminders...", context: "components.reminderContextMenu.manageAllReminders" })),
		renderLeading: (host) => setIcon(host, "settings"),
	});
	if (state.reminders.length) {
		items.push({
			id: "clear",
			label: t(msg({ message: "Clear all reminders", context: "components.reminderContextMenu.clearAllReminders" })),
			renderLeading: (host) => setIcon(host, "x"),
		});
	}
	const setReminders = (reminders: Reminder[]) => {
		context.setReminders(reminders);
		context.onChange();
	};
	const label = t(msg({ message: "Reminders", context: "contextMenus.task.reminders" }));
	return openListPicker({
		anchor,
		app: context.app,
		items,
		revealSelected: false,
		placeholder: label,
		emptyText: label,
		onChoose: (item) => {
			const current = context.getState().reminders;
			const reminder = quick.get(item.id);
			if (reminder) setReminders([...current, { ...reminder, id: `rem_${Date.now()}` }]);
			else if (item.id === "clear") setReminders([]);
			else if (item.id === "manage")
				new ReminderModal(
					context.app,
					context.plugin,
					createTaskModalReminderDraft(context.getState(), taskBase),
					setReminders
				).open();
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
