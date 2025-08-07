import { App, Modal, Setting, setIcon, Notice, setTooltip } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskInfo, Reminder } from '../types';
import { formatDateForDisplay, parseDateToLocal, getCurrentTimestamp } from '../utils/dateUtils';

export class ReminderModal extends Modal {
	private plugin: TaskNotesPlugin;
	private task: TaskInfo;
	private reminders: Reminder[];
	private onSave: (reminders: Reminder[]) => void;
	private originalReminders: Reminder[];
	private saveBtn: HTMLButtonElement;

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

		// Compact header
		const headerContainer = contentEl.createDiv({ cls: 'reminder-modal__header' });
		const header = headerContainer.createEl('h2', { text: 'Task Reminders' });
		
		const taskTitle = headerContainer.createDiv({ 
			cls: 'reminder-modal__task-title',
			text: this.task.title 
		});
		
		// Add task dates context if available
		const contextInfo = this.getTaskContextInfo();
		if (contextInfo) {
			const taskDates = headerContainer.createDiv({ cls: 'reminder-modal__task-dates' });
			taskDates.textContent = contextInfo;
		}

		// Main content area - more compact
		const contentContainer = contentEl.createDiv({ cls: 'reminder-modal__content' });
		
		// Existing reminders section
		this.renderExistingReminders(contentContainer);

		// Add new reminder section
		this.renderAddReminderForm(contentContainer);

		// Action buttons
		this.renderActionButtons(contentEl);
		
		// Set up keyboard handlers and update save button state
		this.setupKeyboardHandlers();
		this.updateSaveButtonState();
	}

	private renderActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: 'reminder-modal__actions' });
		
		// Save button (initially disabled)
		this.saveBtn = buttonContainer.createEl('button', { 
			text: 'Save Changes', 
			cls: 'mod-cta reminder-modal__save-btn'
		});
		this.saveBtn.disabled = true;
		this.saveBtn.onclick = () => {
			this.save();
		};

		const cancelBtn = buttonContainer.createEl('button', { 
			text: 'Cancel', 
			cls: 'reminder-modal__cancel-btn'
		});
		cancelBtn.onclick = () => {
			this.cancel();
		};
	}

	private getTaskContextInfo(): string | null {
		const parts: string[] = [];
		
		if (this.task.due) {
			parts.push(`Due: ${formatDateForDisplay(this.task.due)}`);
		}
		
		if (this.task.scheduled) {
			parts.push(`Scheduled: ${formatDateForDisplay(this.task.scheduled)}`);
		}
		
		return parts.length > 0 ? parts.join(' • ') : null;
	}

	private setupKeyboardHandlers(): void {
		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !this.saveBtn.disabled) {
				e.preventDefault();
				this.save();
			} else if (e.key === 'Escape') {
				e.preventDefault();
				this.cancel();
			}
		};
		
		this.contentEl.addEventListener('keydown', handleKeydown);
		this.onClose = () => {
			this.contentEl.removeEventListener('keydown', handleKeydown);
			const { contentEl } = this;
			contentEl.empty();
		};
	}

	private updateSaveButtonState(): void {
		if (!this.saveBtn) return;
		
		const hasChanges = this.remindersHaveChanged();
		this.saveBtn.disabled = !hasChanges;
		this.saveBtn.textContent = hasChanges ? 'Save Changes' : 'No Changes';
	}

	private renderExistingReminders(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'reminder-modal__section' });
		
		const sectionHeader = section.createDiv({ cls: 'reminder-modal__section-header' });
		const headerTitle = sectionHeader.createEl('h3', { text: 'Current Reminders' });
		
		if (this.reminders.length > 0) {
			const reminderCount = sectionHeader.createSpan({ 
				cls: 'reminder-modal__reminder-count',
				text: `(${this.reminders.length})`
			});
		}

		if (this.reminders.length === 0) {
			const emptyState = section.createDiv({ cls: 'reminder-modal__empty-state' });
			setIcon(emptyState.createDiv({ cls: 'reminder-modal__empty-icon' }), 'bell-off');
			emptyState.createEl('div', { 
				cls: 'reminder-modal__empty-text',
				text: 'No reminders set' 
			});
			return;
		}

		const reminderList = section.createDiv({ cls: 'reminder-modal__reminder-list' });
		
		this.reminders.forEach((reminder, index) => {
			const reminderCard = reminderList.createDiv({ cls: 'reminder-modal__reminder-card' });
			
			// Reminder type icon
			const iconContainer = reminderCard.createDiv({ cls: 'reminder-modal__reminder-icon' });
			const iconName = reminder.type === 'absolute' ? 'calendar-clock' : 'timer';
			setIcon(iconContainer, iconName);
			
			// Main content area
			const content = reminderCard.createDiv({ cls: 'reminder-modal__reminder-content' });
			
			// Primary info (timing with time for absolute reminders)
			const primaryInfo = content.createDiv({ cls: 'reminder-modal__reminder-primary' });
			primaryInfo.textContent = this.formatReminderDisplayText(reminder);
			
			// Custom description (if any)
			if (reminder.description) {
				const description = content.createDiv({ cls: 'reminder-modal__reminder-description' });
				description.textContent = `"${reminder.description}"`;
			}

			// Actions area - only remove button
			const actions = reminderCard.createDiv({ cls: 'reminder-modal__reminder-actions' });
			
			// Remove button with Obsidian tooltip
			const removeBtn = actions.createEl('button', { 
				cls: 'reminder-modal__action-btn reminder-modal__remove-btn'
			});
			setIcon(removeBtn, 'trash-2');
			setTooltip(removeBtn, 'Delete this reminder');
			removeBtn.onclick = (e) => {
				e.stopPropagation();
				this.removeReminder(index);
			};
		});
	}

	private formatReminderDisplayText(reminder: Reminder): string {
		if (reminder.type === 'absolute') {
			// For absolute reminders, show the full date and time
			if (reminder.absoluteTime) {
				try {
					const date = new Date(reminder.absoluteTime);
					return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
				} catch (error) {
					return `At ${reminder.absoluteTime}`;
				}
			}
			return 'Absolute reminder';
		} else {
			// For relative reminders, show the timing relative to task date
			const anchor = reminder.relatedTo === 'due' ? 'due date' : 'scheduled date';
			const offset = this.formatOffset(reminder.offset || '');
			return `${offset} ${anchor}`;
		}
	}

	private renderQuickActions(section: HTMLElement): void {
		// Only show quick actions if task has due/scheduled dates
		const hasDates = this.task.due || this.task.scheduled;
		if (!hasDates) return;

		const quickActions = section.createDiv({ cls: 'reminder-modal__quick-actions' });

		const buttonsContainer = quickActions.createDiv({ cls: 'reminder-modal__quick-buttons' });

		const commonReminders = [
			{ label: '5m', fullLabel: '5 minutes before', offset: '-PT5M', icon: 'clock' },
			{ label: '15m', fullLabel: '15 minutes before', offset: '-PT15M', icon: 'clock' },
			{ label: '1h', fullLabel: '1 hour before', offset: '-PT1H', icon: 'clock' },
			{ label: '1d', fullLabel: '1 day before', offset: '-P1D', icon: 'calendar' }
		];

		commonReminders.forEach(({ label, fullLabel, offset, icon }) => {
			const anchor = this.task.due ? 'due' : 'scheduled';
			
			const quickBtn = buttonsContainer.createEl('button', {
				cls: 'reminder-modal__quick-btn'
			});
			
			const iconEl = quickBtn.createSpan({ cls: 'reminder-modal__quick-btn-icon' });
			setIcon(iconEl, icon);
			
			const labelEl = quickBtn.createSpan({ 
				cls: 'reminder-modal__quick-btn-label',
				text: label 
			});
			
			// Use Obsidian's native tooltip
			setTooltip(quickBtn, `Add reminder ${fullLabel} ${anchor} date`);
			
			quickBtn.onclick = () => {
				this.addQuickReminder(anchor, offset, fullLabel);
			};
		});
	}

	private addQuickReminder(anchor: 'due' | 'scheduled', offset: string, description: string): void {
		const reminder: Reminder = {
			id: `rem_${Date.now()}`,
			type: 'relative',
			relatedTo: anchor,
			offset,
			description
		};

		this.addReminder(reminder);
		new Notice(`Added reminder: ${description}`);
	}

	private renderAddReminderForm(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'reminder-modal__section' });
		
		const sectionHeader = section.createDiv({ cls: 'reminder-modal__section-header' });
		const headerTitle = sectionHeader.createEl('h3', { text: 'Add New Reminder' });
		
		// Add quick actions for common reminders
		this.renderQuickActions(section);

		const form = section.createDiv({ cls: 'reminder-modal__form' });

		// Form state
		let selectedType: 'absolute' | 'relative' = 'relative';
		let relativeAnchor: 'due' | 'scheduled' = 'due';
		let relativeOffset = 15;
		let relativeUnit: 'minutes' | 'hours' | 'days' = 'minutes';
		let relativeDirection: 'before' | 'after' = 'before';
		let absoluteDate = '';
		let absoluteTime = '';
		let description = '';

		// Compact type selector
		const typeSelector = form.createDiv({ cls: 'reminder-modal__type-selector' });
		
		const relativeTab = typeSelector.createEl('button', { 
			cls: 'reminder-modal__type-tab reminder-modal__type-tab--active',
			text: 'Relative',
			attr: { 'data-type': 'relative' }
		});
		
		const absoluteTab = typeSelector.createEl('button', { 
			cls: 'reminder-modal__type-tab',
			text: 'Absolute',
			attr: { 'data-type': 'absolute' }
		});
		
		// Tab switching logic
		const switchToType = (type: 'relative' | 'absolute') => {
			selectedType = type;
			
			// Update tab appearance
			relativeTab.classList.toggle('reminder-modal__type-tab--active', type === 'relative');
			absoluteTab.classList.toggle('reminder-modal__type-tab--active', type === 'absolute');
			
			// Update form visibility
			this.updateFormVisibility(form, selectedType);
		};
		
		relativeTab.onclick = () => switchToType('relative');
		absoluteTab.onclick = () => switchToType('absolute');

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

		// Enhanced add button with icon
		const addBtn = form.createEl('button', { 
			cls: 'reminder-add-btn'
		});
		
		const addIcon = addBtn.createSpan({ cls: 'reminder-add-btn-icon' });
		setIcon(addIcon, 'plus');
		addBtn.createSpan({ 
			cls: 'reminder-add-btn-text',
			text: 'Add Reminder' 
		});
		addBtn.onclick = () => {
			// Add loading state
			addBtn.disabled = true;
			addBtn.classList.add('reminder-add-btn--loading');
			
			try {
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
					
					// Reset form values for next reminder
					if (selectedType === 'relative') {
						relativeOffset = 15;
						relativeUnit = 'minutes';
						description = '';
					} else {
						absoluteDate = '';
						absoluteTime = '';
						description = '';
					}
					
					// Clear description input
					const descInput = form.querySelector('input[placeholder*="Custom reminder message"]') as HTMLInputElement;
					if (descInput) {
						descInput.value = '';
					}
				}
			} catch (error) {
				console.error('Error adding reminder:', error);
				new Notice('Failed to add reminder. Please check your inputs.');
			} finally {
				// Remove loading state
				addBtn.disabled = false;
				addBtn.classList.remove('reminder-add-btn--loading');
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
		this.updateSaveButtonState();
		
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
		this.updateSaveButtonState();
		
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