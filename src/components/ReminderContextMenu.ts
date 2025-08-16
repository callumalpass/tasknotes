import { Menu } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, Reminder } from '../types';
import { ReminderModal } from '../modals/ReminderModal';

export class ReminderContextMenu {
	private plugin: TaskNotesPlugin;
	private task: TaskInfo;
	private triggerElement: HTMLElement;
	private onUpdate: (task: TaskInfo) => void;

	constructor(
		plugin: TaskNotesPlugin,
		task: TaskInfo,
		triggerElement: HTMLElement,
		onUpdate: (task: TaskInfo) => void
	) {
		this.plugin = plugin;
		this.task = task;
		this.triggerElement = triggerElement;
		this.onUpdate = onUpdate;
	}

	show(event?: MouseEvent): void {
		const menu = new Menu();

		// Quick Add sections
		this.addQuickRemindersSection(menu, 'due', 'Remind before due...');
		this.addQuickRemindersSection(menu, 'scheduled', 'Remind before scheduled...');

		menu.addSeparator();

		// Manage reminders
		menu.addItem(item => {
			item
				.setTitle('Manage All Reminders...')
				.setIcon('settings')
				.onClick(() => {
					this.openReminderModal();
				});
		});

		// Clear reminders (if any exist)
		if (this.task.reminders && this.task.reminders.length > 0) {
			menu.addItem(item => {
				item
					.setTitle('Clear All Reminders')
					.setIcon('trash')
					.onClick(async () => {
						await this.clearAllReminders();
					});
			});
		}

		if (event) {
			menu.showAtMouseEvent(event);
		} else {
			menu.showAtMouseEvent(new MouseEvent('contextmenu'));
		}
	}

	private addQuickRemindersSection(menu: Menu, anchor: 'due' | 'scheduled', title: string): void {
		const anchorDate = anchor === 'due' ? this.task.due : this.task.scheduled;
		
		if (!anchorDate) {
			// If no anchor date, show disabled option
			menu.addItem(item => {
				item
					.setTitle(title)
					.setIcon('bell')
					.setDisabled(true);
			});
			return;
		}

		// Add submenu for quick reminder options
		menu.addItem(item => {
			item
				.setTitle(title)
				.setIcon('bell')
				.onClick((event) => {
					// Only pass MouseEvent, ignore KeyboardEvent
					this.showQuickReminderSubmenu(anchor, event instanceof MouseEvent ? event : undefined);
				});
		});
	}

	private showQuickReminderSubmenu(anchor: 'due' | 'scheduled', event?: MouseEvent): void {
		const menu = new Menu();

		const quickOptions = [
			{ label: 'At time of event', offset: 'PT0M' },
			{ label: '5 minutes before', offset: '-PT5M' },
			{ label: '15 minutes before', offset: '-PT15M' },
			{ label: '1 hour before', offset: '-PT1H' },
			{ label: '1 day before', offset: '-P1D' }
		];

		quickOptions.forEach(option => {
			menu.addItem(item => {
				item
					.setTitle(option.label)
					.onClick(async () => {
						await this.addQuickReminder(anchor, option.offset, option.label);
					});
			});
		});

		if (event) {
			menu.showAtMouseEvent(event);
		} else {
			menu.showAtMouseEvent(new MouseEvent('contextmenu'));
		}
	}

	private async addQuickReminder(anchor: 'due' | 'scheduled', offset: string, description: string): Promise<void> {
		const reminder: Reminder = {
			id: `rem_${Date.now()}`,
			type: 'relative',
			relatedTo: anchor,
			offset,
			description
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
		if (this.task.path && this.task.path.trim() !== '') {
			const freshTask = await this.plugin.cacheManager.getTaskInfo(this.task.path);
			if (freshTask) {
				// Use fresh task data as base if available
				updatedTask = {
					...freshTask,
					reminders
				};
				// Save to file since task exists
				await this.plugin.taskService.updateProperty(updatedTask, 'reminders', reminders);
			} else {
				// Task path exists but task not found in cache - this shouldn't happen in edit modal
				// Use the provided task data
				updatedTask = {
					...this.task,
					reminders
				};
			}
		} else {
			// Task doesn't have a path yet (new task being created)
			// Just update the in-memory task object
			updatedTask = {
				...this.task,
				reminders
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
			}
		);
		modal.open();
	}
}