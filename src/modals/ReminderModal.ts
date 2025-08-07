import { App, Modal, Setting, setIcon, Notice } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, Reminder } from '../types';
import { formatDateForDisplay, parseDateToLocal, getCurrentTimestamp } from '../utils/dateUtils';

export class ReminderModal extends Modal {
	private plugin: TaskNotesPlugin;
	private task: TaskInfo;
	private reminders: Reminder[];
	private onSave: (reminders: Reminder[]) => void;
	private originalReminders: Reminder[];

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		task: TaskInfo,
		onSave: (reminders: Reminder[]) => void
	) {
		super(app);
		this.plugin = plugin;
		this.task = task;
		this.reminders = task.reminders ? [...task.reminders] : [];
		this.originalReminders = task.reminders ? [...task.reminders] : [];
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('tasknotes-reminder-modal');

		// Header
		const header = contentEl.createEl('h2', { text: 'Manage Reminders' });
		const subtitle = contentEl.createEl('div', { 
			cls: 'tasknotes-reminder-subtitle',
			text: this.task.title 
		});

		// Existing reminders section
		this.renderExistingReminders(contentEl);

		// Add new reminder section
		this.renderAddReminderForm(contentEl);

		// Action buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		
		const saveBtn = buttonContainer.createEl('button', { text: 'Save' });
		saveBtn.onclick = () => {
			this.save();
		};

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => {
			this.cancel();
		};
	}

	private renderExistingReminders(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'reminder-section' });
		section.createEl('h3', { text: 'Existing Reminders' });

		if (this.reminders.length === 0) {
			section.createEl('div', { 
				cls: 'no-reminders',
				text: 'No reminders set' 
			});
			return;
		}

		const reminderList = section.createDiv({ cls: 'reminder-list' });
		
		this.reminders.forEach((reminder, index) => {
			const reminderItem = reminderList.createDiv({ cls: 'reminder-item' });
			
			// Main content area
			const content = reminderItem.createDiv({ cls: 'reminder-item__content' });
			
			// Type and timing
			const timing = content.createDiv({ cls: 'reminder-item__timing' });
			timing.textContent = this.formatReminderTiming(reminder);
			
			// Description (if custom)
			if (reminder.description) {
				const description = content.createDiv({ cls: 'reminder-item__description' });
				description.textContent = reminder.description;
			}
			
			// Details
			const details = content.createDiv({ cls: 'reminder-item__details' });
			details.textContent = this.formatReminderDetails(reminder);

			// Actions area
			const actions = reminderItem.createDiv({ cls: 'reminder-item__actions' });
			
			// Remove button
			const removeBtn = actions.createEl('button', { 
				cls: 'reminder-item__remove-btn',
				attr: { 'aria-label': 'Remove reminder' }
			});
			setIcon(removeBtn, 'trash');
			removeBtn.onclick = () => {
				this.removeReminder(index);
			};
		});
	}

	private renderAddReminderForm(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'reminder-section' });
		section.createEl('h3', { text: 'Add New Reminder' });

		const form = section.createDiv({ cls: 'reminder-form' });

		// Type selector
		let selectedType: 'absolute' | 'relative' = 'relative';
		let relativeAnchor: 'due' | 'scheduled' = 'due';
		let relativeOffset = 15;
		let relativeUnit: 'minutes' | 'hours' | 'days' = 'minutes';
		let relativeDirection: 'before' | 'after' = 'before';
		let absoluteDate = '';
		let absoluteTime = '';
		let description = '';

		new Setting(form)
			.setName('Reminder Type')
			.addDropdown(dropdown => {
				dropdown
					.addOption('relative', 'Relative to task date')
					.addOption('absolute', 'Specific date and time')
					.setValue(selectedType)
					.onChange(value => {
						selectedType = value as 'absolute' | 'relative';
						this.updateFormVisibility(form, selectedType);
					});
			});

		// Relative reminder fields
		const relativeContainer = form.createDiv({ cls: 'relative-fields' });

		new Setting(relativeContainer)
			.setName('Time')
			.addText(text => {
				text
					.setPlaceholder('15')
					.setValue(String(relativeOffset))
					.onChange(value => {
						relativeOffset = parseInt(value) || 0;
					});
			})
			.addDropdown(dropdown => {
				dropdown
					.addOption('minutes', 'minutes')
					.addOption('hours', 'hours')
					.addOption('days', 'days')
					.setValue(relativeUnit)
					.onChange(value => {
						relativeUnit = value as 'minutes' | 'hours' | 'days';
					});
			});

		new Setting(relativeContainer)
			.setName('Direction')
			.addDropdown(dropdown => {
				dropdown
					.addOption('before', 'Before')
					.addOption('after', 'After')
					.setValue(relativeDirection)
					.onChange(value => {
						relativeDirection = value as 'before' | 'after';
					});
			});

		new Setting(relativeContainer)
			.setName('Relative to')
			.addDropdown(dropdown => {
				const options: any = {};
				if (this.task.due) {
					options.due = `Due date (${formatDateForDisplay(this.task.due)})`;
				}
				if (this.task.scheduled) {
					options.scheduled = `Scheduled date (${formatDateForDisplay(this.task.scheduled)})`;
				}
				
				if (Object.keys(options).length === 0) {
					options.none = 'No dates available';
					dropdown.setDisabled(true);
				} else {
					Object.entries(options).forEach(([key, label]) => {
						dropdown.addOption(key, label as string);
					});
					dropdown.setValue(relativeAnchor);
				}
				
				dropdown.onChange(value => {
					relativeAnchor = value as 'due' | 'scheduled';
				});
			});

		// Absolute reminder fields
		const absoluteContainer = form.createDiv({ cls: 'absolute-fields' });
		absoluteContainer.style.display = 'none';

		new Setting(absoluteContainer)
			.setName('Date')
			.addText(text => {
				text
					.setPlaceholder('YYYY-MM-DD')
					.onChange(value => {
						absoluteDate = value;
					});
				text.inputEl.type = 'date';
			});

		new Setting(absoluteContainer)
			.setName('Time')
			.addText(text => {
				text
					.setPlaceholder('HH:MM')
					.onChange(value => {
						absoluteTime = value;
					});
				text.inputEl.type = 'time';
			});

		// Description field (common)
		new Setting(form)
			.setName('Description (optional)')
			.addText(text => {
				text
					.setPlaceholder('Custom reminder message')
					.onChange(value => {
						description = value;
					});
			});

		// Add button
		const addBtn = form.createEl('button', { 
			cls: 'reminder-add-btn',
			text: 'Add Reminder' 
		});
		addBtn.onclick = () => {
			const newReminder = this.createReminder(
				selectedType,
				relativeAnchor,
				relativeOffset,
				relativeUnit,
				relativeDirection,
				absoluteDate,
				absoluteTime,
				description
			);
			
			if (newReminder) {
				this.addReminder(newReminder);
			}
		};
	}

	private updateFormVisibility(form: HTMLElement, type: 'absolute' | 'relative'): void {
		const relativeFields = form.querySelector('.relative-fields') as HTMLElement;
		const absoluteFields = form.querySelector('.absolute-fields') as HTMLElement;

		if (type === 'relative') {
			relativeFields.style.display = 'block';
			absoluteFields.style.display = 'none';
		} else {
			relativeFields.style.display = 'none';
			absoluteFields.style.display = 'block';
		}
	}

	private createReminder(
		type: 'absolute' | 'relative',
		anchor: 'due' | 'scheduled',
		offset: number,
		unit: 'minutes' | 'hours' | 'days',
		direction: 'before' | 'after',
		date: string,
		time: string,
		description: string
	): Reminder | null {
		const id = `rem_${Date.now()}`;

		if (type === 'relative') {
			// Check if anchor date exists
			const anchorDate = anchor === 'due' ? this.task.due : this.task.scheduled;
			if (!anchorDate) {
				new Notice(`Cannot create reminder: Task has no ${anchor} date`);
				return null;
			}

			// Convert offset to ISO 8601 duration
			let duration = 'PT';
			if (unit === 'days') {
				duration = `P${offset}D`;
			} else if (unit === 'hours') {
				duration = `PT${offset}H`;
			} else {
				duration = `PT${offset}M`;
			}

			// Add negative sign for "before"
			if (direction === 'before') {
				duration = '-' + duration;
			}

			return {
				id,
				type: 'relative',
				relatedTo: anchor,
				offset: duration,
				description: description || undefined
			};
		} else {
			// Absolute reminder
			if (!date || !time) {
				new Notice('Please specify both date and time for absolute reminder');
				return null;
			}

			const absoluteTime = `${date}T${time}:00`;
			
			return {
				id,
				type: 'absolute',
				absoluteTime,
				description: description || undefined
			};
		}
	}

	private formatReminderTiming(reminder: Reminder): string {
		if (reminder.type === 'absolute') {
			return 'Absolute reminder';
		} else {
			const anchor = reminder.relatedTo === 'due' ? 'due date' : 'scheduled date';
			const offset = this.formatOffset(reminder.offset || '');
			return `${offset} ${anchor}`;
		}
	}

	private formatReminderDetails(reminder: Reminder): string {
		if (reminder.type === 'absolute') {
			return `At ${formatDateForDisplay(reminder.absoluteTime || '')}`;
		} else {
			const anchor = reminder.relatedTo === 'due' ? this.task.due : this.task.scheduled;
			if (!anchor) {
				return `Relative to ${reminder.relatedTo} date (not set)`;
			}
			return `When ${reminder.relatedTo} date is ${formatDateForDisplay(anchor)}`;
		}
	}

	private formatReminderDescription(reminder: Reminder): string {
		if (reminder.description) {
			return reminder.description;
		}

		if (reminder.type === 'absolute') {
			const date = parseDateToLocal(reminder.absoluteTime || '');
			return `At ${formatDateForDisplay(reminder.absoluteTime || '')}`;
		} else {
			const anchor = reminder.relatedTo === 'due' ? 'due date' : 'scheduled date';
			const offset = this.formatOffset(reminder.offset || '');
			return `${offset} ${anchor}`;
		}
	}

	private formatOffset(offset: string): string {
		const isNegative = offset.startsWith('-');
		const cleanOffset = isNegative ? offset.substring(1) : offset;
		
		const match = cleanOffset.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
		if (!match) return offset;

		const [, days, hours, minutes] = match;
		
		let parts: string[] = [];
		if (days) parts.push(`${days} day${days !== '1' ? 's' : ''}`);
		if (hours) parts.push(`${hours} hour${hours !== '1' ? 's' : ''}`);
		if (minutes) parts.push(`${minutes} minute${minutes !== '1' ? 's' : ''}`);

		if (parts.length === 0) {
			return 'At time of';
		}

		const formatted = parts.join(' ');
		return isNegative ? `${formatted} before` : `${formatted} after`;
	}

	private addReminder(reminder: Reminder): void {
		this.reminders.push(reminder);
		this.refresh();
		
		// Emit immediate event for live UI updates (optional, for real-time feedback)
		if (this.task.path) {
			this.plugin.emitter.trigger('reminder-preview-changed', {
				taskPath: this.task.path,
				currentReminders: [...this.reminders],
				action: 'added',
				reminder: reminder
			});
		}
	}

	private removeReminder(index: number): void {
		const removedReminder = this.reminders[index];
		this.reminders.splice(index, 1);
		this.refresh();
		
		// Emit immediate event for live UI updates (optional, for real-time feedback)
		if (this.task.path && removedReminder) {
			this.plugin.emitter.trigger('reminder-preview-changed', {
				taskPath: this.task.path,
				currentReminders: [...this.reminders],
				action: 'removed',
				reminder: removedReminder
			});
		}
	}

	private refresh(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.onOpen();
	}

	private async save(): Promise<void> {
		// Clear processed reminders for this task so they can trigger again if needed
		if (this.task.path && this.task.path.trim() !== '') {
			this.plugin.notificationService?.clearProcessedRemindersForTask(this.task.path);
		}
		
		// Check if reminders have actually changed
		const hasChanges = this.remindersHaveChanged();
		
		// Always call onSave to maintain existing behavior, but indicate if changes occurred
		this.onSave(this.reminders);
		
		// Emit a custom event to notify about reminder changes for immediate UI updates
		if (hasChanges && this.task.path) {
			this.plugin.emitter.trigger('reminder-changed', {
				taskPath: this.task.path,
				oldReminders: this.originalReminders,
				newReminders: [...this.reminders]
			});
		}
		
		this.close();
	}

	private cancel(): void {
		// Emit cancellation event to reset any preview changes
		if (this.remindersHaveChanged() && this.task.path) {
			this.plugin.emitter.trigger('reminder-preview-changed', {
				taskPath: this.task.path,
				currentReminders: [...this.originalReminders],
				action: 'cancelled'
			});
		}
		
		this.close();
	}

	private remindersHaveChanged(): boolean {
		// Quick reference check first
		if (this.reminders.length !== this.originalReminders.length) {
			return true;
		}

		// Deep comparison of reminder arrays
		return !this.reminders.every((reminder, index) => {
			const original = this.originalReminders[index];
			if (!original) return false;

			return (
				reminder.id === original.id &&
				reminder.type === original.type &&
				reminder.relatedTo === original.relatedTo &&
				reminder.offset === original.offset &&
				reminder.absoluteTime === original.absoluteTime &&
				reminder.description === original.description
			);
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}