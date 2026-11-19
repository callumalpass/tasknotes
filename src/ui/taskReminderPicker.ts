import { msg } from "@lingui/core/macro";
import { setIcon } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { Reminder, TaskInfo } from "../types";
import { ReminderModal } from "../modals/ReminderModal";
import { openListPicker, type PickerItem } from "./kit/listPicker";
import type { PopoverHandle, PopoverOptions } from "./kit/popover";
import { changeTaskProperty, taskPropertyLabel } from "./taskPropertyPickers";

export interface ReminderChoiceOptions {
	plugin: TaskNotesPlugin;
	anchor: PopoverOptions["anchor"];
	due?: string;
	scheduled?: string;
	/** Read when a choice is made, so it reflects changes made since opening. */
	getReminders: () => Reminder[];
	setReminders: (reminders: Reminder[]) => void;
	/** The task the reminder modal edits for **Manage all reminders...**. */
	draft: () => TaskInfo;
}

/**
 * The reminder picker: quick reminders relative to the due and scheduled
 * dates, then the reminder modal and Clear. Reminders already set are ticked.
 */
export function openReminderChoices(options: ReminderChoiceOptions): PopoverHandle {
	const { plugin } = options;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const offsets = [
		{ offset: "PT0M", label: t(msg({ message: "At time of event", context: "components.reminderContextMenu.quickReminders.atTime" })) },
		{ offset: "-PT5M", label: t(msg({ message: "5 minutes before", context: "components.reminderContextMenu.quickReminders.fiveMinutesBefore" })) },
		{ offset: "-PT15M", label: t(msg({ message: "15 minutes before", context: "components.reminderContextMenu.quickReminders.fifteenMinutesBefore" })) },
		{ offset: "-PT1H", label: t(msg({ message: "1 hour before", context: "components.reminderContextMenu.quickReminders.oneHourBefore" })) },
		{ offset: "-P1D", label: t(msg({ message: "1 day before", context: "components.reminderContextMenu.quickReminders.oneDayBefore" })) },
	];
	const current = options.getReminders();
	const quick = new Map<string, Reminder>();
	const items: PickerItem[] = [];
	for (const relatedTo of ["due", "scheduled"] as const) {
		if (!(relatedTo === "due" ? options.due : options.scheduled)) continue;
		const group = taskPropertyLabel(relatedTo);
		for (const { offset, label } of offsets) {
			const id = `${relatedTo}:${offset}`;
			quick.set(id, { id: "", type: "relative", relatedTo, offset, description: label });
			items.push({
				id,
				label,
				group,
				keywords: group,
				selected: current.some(
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
	if (current.length) {
		items.push({
			id: "clear",
			label: t(msg({ message: "Clear all reminders", context: "components.reminderContextMenu.clearAllReminders" })),
			renderLeading: (host) => setIcon(host, "x"),
		});
	}
	const label = t(msg({ message: "Reminders", context: "contextMenus.task.reminders" }));
	return openListPicker({
		anchor: options.anchor,
		app: plugin.app,
		items,
		revealSelected: false,
		placeholder: label,
		emptyText: label,
		onChoose: (item) => {
			const reminder = quick.get(item.id);
			if (reminder)
				options.setReminders([...options.getReminders(), { ...reminder, id: `rem_${Date.now()}` }]);
			else if (item.id === "clear") options.setReminders([]);
			else if (item.id === "manage")
				new ReminderModal(plugin.app, plugin, options.draft(), options.setReminders).open();
		},
	});
}

/** The reminder picker for a saved task; each change is written with Undo. */
export async function openTaskReminderPicker(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	anchor: PopoverOptions["anchor"],
	onChange?: () => void
): Promise<void> {
	let latest = (await plugin.cacheManager.getTaskInfo(task.path)) ?? task;
	openReminderChoices({
		plugin,
		anchor,
		due: latest.due,
		scheduled: latest.scheduled,
		getReminders: () => latest.reminders ?? [],
		draft: () => latest,
		setReminders: (reminders) =>
			void changeTaskProperty(plugin, [latest], "reminders", reminders.length ? reminders : undefined).then(
				([updated]) => {
					if (updated) latest = updated;
					onChange?.();
				}
			),
	});
}
