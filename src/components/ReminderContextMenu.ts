import { Menu } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo, Reminder } from "../types";
import { ReminderModal } from "../modals/ReminderModal";
import { ContextMenu } from "./ContextMenu";
import { getAvailableDateAnchors, resolveAnchorDate } from "../utils/dateAnchorUtils";

export class ReminderContextMenu {
	private plugin: TaskNotesPlugin;
	private task: TaskInfo;
	private triggerElement: HTMLElement;
	private onUpdate: (task: TaskInfo) => void;
	private itemPaths?: string[];

	constructor(
		plugin: TaskNotesPlugin,
		task: TaskInfo,
		triggerElement: HTMLElement,
		onUpdate: (task: TaskInfo) => void,
		itemPaths?: string[]
	) {
		this.plugin = plugin;
		this.task = task;
		this.triggerElement = triggerElement;
		this.onUpdate = onUpdate;
		this.itemPaths = itemPaths;
	}

	show(event: UIEvent): void {
		const menu = new ContextMenu();

		// Quick Add sections - dynamically enumerate all date anchors
		const anchors = getAvailableDateAnchors(this.plugin, this.task);
		for (const anchor of anchors) {
			this.addQuickRemindersSection(
				menu,
				anchor.key,
				`Remind before ${anchor.displayName.toLowerCase()}`,
			);
		}

		menu.addSeparator();

		// Manage reminders
		menu.addItem((item) => {
			item.setTitle(
				this.plugin.i18n.translate("components.reminderContextMenu.manageAllReminders")
			)
				.setIcon("settings")
				.onClick(() => {
					this.openReminderModal();
				});
		});

		// Clear reminders (if any exist)
		if (this.task.reminders && this.task.reminders.length > 0) {
			menu.addItem((item) => {
				item.setTitle(
					this.plugin.i18n.translate("components.reminderContextMenu.clearAllReminders")
				)
					.setIcon("trash")
					.onClick(async () => {
						await this.clearAllReminders();
					});
			});
		}

		menu.show(event)
	}

	private addQuickRemindersSection(menu: Menu, anchor: string, title: string): void {
		const anchorDate = resolveAnchorDate(this.task, anchor, this.plugin);

		if (!anchorDate) {
			// If no anchor date, show disabled option
			menu.addItem((item) => {
				item.setTitle(title).setIcon("bell").setDisabled(true);
			});
			return;
		}

		menu.addItem(item => {
			item.setTitle(title)
			item.setIcon("bell")

			this.addQuickReminderSubmenu(item.setSubmenu(), anchor)
		})
	}

	private addQuickReminderSubmenu(subMenu: Menu, anchor: string): void {
		const quickOptions = [
			{
				label: this.plugin.i18n.translate(
					"components.reminderContextMenu.quickReminders.atTime"
				),
				offset: "PT0M",
			},
			{
				label: this.plugin.i18n.translate(
					"components.reminderContextMenu.quickReminders.fiveMinutesBefore"
				),
				offset: "-PT5M",
			},
			{
				label: this.plugin.i18n.translate(
					"components.reminderContextMenu.quickReminders.fifteenMinutesBefore"
				),
				offset: "-PT15M",
			},
			{
				label: this.plugin.i18n.translate(
					"components.reminderContextMenu.quickReminders.oneHourBefore"
				),
				offset: "-PT1H",
			},
			{
				label: this.plugin.i18n.translate(
					"components.reminderContextMenu.quickReminders.oneDayBefore"
				),
				offset: "-P1D",
			},
		];

		quickOptions.forEach((option) => {
			subMenu.addItem((item) => {
				item.setTitle(option.label).onClick(async () => {
					await this.addQuickReminder(anchor, option.offset, option.label);
				});
			});
		});
	}

	private async addQuickReminder(
		anchor: string,
		offset: string,
		description: string
	): Promise<void> {
		const reminder: Reminder = {
			id: `rem_${Date.now()}`,
			type: "relative",
			relatedTo: anchor,
			offset,
			description,
		};

		const updatedReminders = [...(this.task.reminders || []), reminder];
		await this.saveReminders(updatedReminders);
	}

	private async clearAllReminders(): Promise<void> {
		await this.saveReminders([]);
	}

	private async saveReminders(reminders: Reminder[]): Promise<void> {
		let updatedTask: TaskInfo;

		// If task has a path, try to fetch the latest data to avoid overwriting changes
		if (this.task.path && this.task.path.trim() !== "") {
			const freshTask = await this.plugin.cacheManager.getTaskInfo(this.task.path);
			if (freshTask) {
				// Use fresh task data as base if available
				updatedTask = {
					...freshTask,
					reminders,
				};
				// Save to file since task exists
				await this.plugin.taskService.updateProperty(updatedTask, "reminders", reminders);
			} else {
				// Task path exists but task not found in cache - this shouldn't happen in edit modal
				// Use the provided task data
				updatedTask = {
					...this.task,
					reminders,
				};
			}
		} else {
			// Task doesn't have a path yet (new task being created)
			// Just update the in-memory task object
			updatedTask = {
				...this.task,
				reminders,
			};
		}

		// Always notify the caller about the update (for local state management)
		this.onUpdate(updatedTask);
	}

	private openReminderModal(): void {
		const modal = new ReminderModal(
			this.plugin.app,
			this.plugin,
			this.task,
			async (reminders: Reminder[]) => {
				await this.saveReminders(reminders);
			},
			this.itemPaths
		);
		modal.open();
	}
}
