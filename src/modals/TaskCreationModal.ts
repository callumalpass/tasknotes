import { App, Notice, TFile, Setting, Editor, MarkdownView, normalizePath } from 'obsidian';
import { format } from 'date-fns';
import TaskNotesPlugin from '../main';
import { BaseTaskModal } from './BaseTaskModal';
import { MINI_CALENDAR_VIEW_TYPE, TaskInfo } from '../types';
import { ParsedTaskData } from '../utils/TasksPluginParser';
import { getCurrentTimestamp, hasTimeComponent, getDatePart, getTimePart } from '../utils/dateUtils';
import { generateTaskFilename, FilenameContext } from '../utils/filenameGenerator';
import { calculateDefaultDate } from '../utils/helpers';

export interface TaskConversionOptions {
	parsedData?: ParsedTaskData;
	editor?: Editor;
	lineNumber?: number;
	selectionInfo?: { taskLine: string; details: string; startLine: number; endLine: number; originalContent: string[] };
	prefilledDetails?: string;
}

export class TaskCreationModal extends BaseTaskModal {
	details: string = '';
	
	// UI elements for filename preview
	private filenamePreview: HTMLElement | null = null;
	private dueDateInput: HTMLInputElement | null = null;

	// Task conversion options
	private conversionOptions: TaskConversionOptions;
	
	// Pre-populated values
	private prePopulatedValues: Partial<TaskInfo>;
  
	constructor(app: App, plugin: TaskNotesPlugin, prePopulatedValues?: Partial<TaskInfo>, conversionOptions?: TaskConversionOptions) {
		super(app, plugin);
		this.prePopulatedValues = prePopulatedValues || {};
		this.conversionOptions = conversionOptions || {};
	}

	protected async initializeFormData(): Promise<void> {
		// Check if we have parsed data to pre-populate
		if (this.conversionOptions.parsedData) {
			this.populateFromParsedData(this.conversionOptions.parsedData);
		} else {
			// Initialize with default values
			this.priority = this.plugin.settings.defaultTaskPriority;
			this.status = this.plugin.settings.defaultTaskStatus;
			
			// Apply task creation defaults
			const defaults = this.plugin.settings.taskCreationDefaults;
			
			// Apply default due date
			this.dueDate = calculateDefaultDate(defaults.defaultDueDate);
			
			// Apply scheduled date: prioritize selected calendar date, then use configured default
			if (this.plugin.selectedDate) {
				// If calendar date is selected, always use it (preserve existing behavior)
				this.scheduledDate = format(this.plugin.selectedDate, 'yyyy-MM-dd');
			} else {
				// No calendar date selected, use the configured default
				this.scheduledDate = calculateDefaultDate(defaults.defaultScheduledDate);
			}
			
			// Apply default contexts and tags
			this.contexts = defaults.defaultContexts || '';
			this.tags = defaults.defaultTags || '';
			
			// Apply default time estimate
			if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
				this.timeEstimate = defaults.defaultTimeEstimate;
			}
			
			// Apply default recurrence
			this.recurrence = defaults.defaultRecurrence || 'none';
		}
		
		// Apply pre-populated values if provided (overrides defaults)
		if (this.prePopulatedValues) {
			this.populateFromPrePopulatedValues(this.prePopulatedValues);
		}
	}

	private populateFromPrePopulatedValues(values: Partial<TaskInfo>): void {
		if (values.title !== undefined) this.title = values.title;
		if (values.status !== undefined) this.status = values.status;
		if (values.priority !== undefined) this.priority = values.priority;
		if (values.due !== undefined) {
			this.dueDate = values.due;
		}
		if (values.scheduled !== undefined) {
			this.scheduledDate = values.scheduled;
		}
		if (values.contexts !== undefined && values.contexts.length > 0) {
			this.contexts = values.contexts.join(', ');
		}
	}

	private populateFromParsedData(data: ParsedTaskData): void {
		// Reset all fields to ensure clean state for this conversion
		this.title = data.title || '';
		this.priority = data.priority || this.plugin.settings.defaultTaskPriority;
		this.status = data.status || this.plugin.settings.defaultTaskStatus;
		this.dueDate = data.dueDate || ''; // Always reset due date
		this.scheduledDate = ''; // Always reset scheduled date for converted tasks
		// Use prefilled details from multi-line selection if available
		this.details = this.conversionOptions.prefilledDetails || '';
		
		// Time components will be set by the input fields automatically
		
		// Update input field if it exists
		if (this.dueDateInput) {
			this.dueDateInput.value = getDatePart(this.dueDate);
		}
		
		// Set other optional fields if available
		if (data.scheduledDate) {
			// Note: TaskNotes doesn't have scheduled date, but we could use start date
			// or add it to details
			this.details = `Scheduled: ${data.scheduledDate}\n${this.details}`.trim();
		}
		
		if (data.startDate) {
			// Note: TaskNotes doesn't have start date, add to details
			this.details = `Start: ${data.startDate}\n${this.details}`.trim();
		}
		
		if (data.createdDate) {
			this.details = `Originally created: ${data.createdDate}\n${this.details}`.trim();
		}
		
		if (data.doneDate) {
			this.details = `Completed on: ${data.doneDate}\n${this.details}`.trim();
		}
		
		// Handle recurrence
		if (data.recurrence && data.recurrence !== 'none') {
			// Map parsed recurrence to valid BaseTaskModal types
			const validRecurrenceTypes: ('none' | 'daily' | 'weekly' | 'monthly' | 'yearly')[] = 
				['none', 'daily', 'weekly', 'monthly', 'yearly'];
			
			if (validRecurrenceTypes.includes(data.recurrence as any)) {
				this.recurrence = data.recurrence as 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
			} else {
				// For custom recurrence patterns, add to details instead
				this.details = `Recurrence: ${data.recurrence}\n${this.details}`.trim();
			}
			
			if (data.recurrenceData) {
				if (data.recurrenceData.days_of_week) {
					this.daysOfWeek = data.recurrenceData.days_of_week;
				}
				if (data.recurrenceData.day_of_month) {
					this.dayOfMonth = data.recurrenceData.day_of_month.toString();
				}
				if (data.recurrenceData.month_of_year) {
					this.monthOfYear = data.recurrenceData.month_of_year.toString();
				}
			}
		}
	}

	private async cacheAutocompleteData(): Promise<void> {
		try {
			this.existingContexts = await this.getExistingContexts();
			this.existingTags = await this.getExistingTags();
		} catch (error) {
			console.error('Error caching autocomplete data:', error);
		}
	}
  
	async onOpen() {
		const { contentEl } = this;
		contentEl.addClass('tasknotes-plugin', 'task-creation-modal');
		new Setting(contentEl)
			.setName('Create new task')
			.setHeading();

		// Initialize form data
		await this.initializeFormData();

		// Cache autocomplete data
		this.cacheAutocompleteData();
		
		// Title with character count and filename preview updates
		this.createFormGroup(contentEl, 'Title', (container) => {
			const inputContainer = container.createDiv({ cls: 'modal-form__input-container' });
			const input = inputContainer.createEl('input', { 
				type: 'text',
				cls: 'modal-form__input modal-form__input--title',
				attr: { 
					placeholder: 'Enter task title...',
					maxlength: '200'
				}
			});
			const counter = inputContainer.createDiv({ 
				cls: 'modal-form__char-counter',
				text: '0/200'
			});
			
			// Set initial value if pre-populated
			if (this.title) {
				input.value = this.title;
				this.updateCharCounter(counter, this.title.length, 200);
				this.updateFilenamePreview();
			}
			
			input.addEventListener('input', (e) => {
				const value = (e.target as HTMLInputElement).value;
				this.title = value;
				this.updateCharCounter(counter, value.length, 200);
				this.updateFilenamePreview();
			});
			
			// Auto-focus on the title field
			setTimeout(() => input.focus(), 50);
		});
		
		// Filename preview
		this.createFormGroup(contentEl, 'Filename preview', (container) => {
			this.filenamePreview = container.createDiv({ 
				cls: 'task-creation-modal__preview',
				text: 'Enter a title to see filename preview...'
			});
		});
		
		// Details
		this.createFormGroup(contentEl, 'Details', (container) => {
			const textarea = container.createEl('textarea', {
				cls: 'modal-form__input modal-form__input--textarea',
				attr: { 
					placeholder: 'Optional details or description...',
					rows: '3'
				}
			});
			
			// Set initial value if pre-populated
			if (this.details) {
				textarea.value = this.details;
			}
			
			textarea.addEventListener('input', (e) => {
				this.details = (e.target as HTMLTextAreaElement).value;
			});
		});
		
		// Due Date
		this.createFormGroup(contentEl, 'Due date', (container) => {
			this.createDueDateInputWithRef(container);
		});
		
		// Scheduled Date
		this.createFormGroup(contentEl, 'Scheduled date', (container) => {
			this.createScheduledDateInput(container);
		});
		
		// Priority
		this.createFormGroup(contentEl, 'Priority', (container) => {
			this.createPriorityDropdown(container);
			// Add filename preview update listener
			const select = container.querySelector('select');
			if (select) {
				select.addEventListener('change', () => {
					this.updateFilenamePreview();
				});
			}
		});
		
		// Status
		this.createFormGroup(contentEl, 'Status', (container) => {
			this.createStatusDropdown(container);
			// Add filename preview update listener
			const select = container.querySelector('select');
			if (select) {
				select.addEventListener('change', () => {
					this.updateFilenamePreview();
				});
			}
		});
		
		// Contexts with autocomplete
		this.createFormGroup(contentEl, 'Contexts', (container) => {
			this.createAutocompleteInput(
				container,
				'contexts',
				() => this.existingContexts,
				(value) => { this.contexts = value; }
			);
		});
		
		// Tags with autocomplete
		this.createFormGroup(contentEl, 'Tags', (container) => {
			this.createAutocompleteInput(
				container,
				'tags',
				() => this.existingTags,
				(value) => { this.tags = value; }
			);
		});
		
		// Time Estimate
		this.createFormGroup(contentEl, 'Time estimate', (container) => {
			this.createTimeEstimateInput(container);
		});
		
		// Recurrence
		this.createFormGroup(contentEl, 'Recurrence', (container) => {
			this.createRecurrenceDropdown(container);
		});
		
		// Action buttons
		this.createActionButtons(contentEl);
		
		// Keyboard shortcuts
		contentEl.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				this.close();
			} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.createTask();
			}
		});
	}

	protected createActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: 'modal-form__buttons' });
		
		const createButton = buttonContainer.createEl('button', { 
			text: 'Create task', 
			cls: 'modal-form__button modal-form__button--primary' 
		});
		createButton.addEventListener('click', () => {
			this.createTask();
		});
		
		const cancelButton = buttonContainer.createEl('button', { 
			text: 'Cancel', 
			cls: 'modal-form__button modal-form__button--secondary' 
		});
		cancelButton.addEventListener('click', () => {
			this.close();
		});
	}

	protected async handleSubmit(): Promise<void> {
		await this.createTask();
	}


	private updateFilenamePreview() {
		if (!this.filenamePreview) return;
		
		if (!this.title || !this.title.trim()) {
			this.filenamePreview.textContent = 'Enter a title to see filename preview...';
			this.filenamePreview.className = 'task-creation-modal__preview';
			return;
		}
		
		try {
			const filenameContext: FilenameContext = {
				title: this.title,
				priority: this.priority,
				status: this.status,
				date: new Date()
			};
			
			const filename = generateTaskFilename(filenameContext, this.plugin.settings);
			this.filenamePreview.textContent = `${filename}.md`;
			this.filenamePreview.className = 'task-creation-modal__preview task-creation-modal__preview--valid';
		} catch (error) {
			this.filenamePreview.textContent = 'Error generating filename preview';
			this.filenamePreview.className = 'task-creation-modal__preview task-creation-modal__preview--error';
		}
	}

	async createTask() {
		if (!await this.validateAndPrepareTask()) {
			return;
		}

		try {
			const file = await this.performTaskCreation();
			
			// If this is a conversion, replace the original line with a link
			if (this.conversionOptions.editor && this.conversionOptions.lineNumber !== undefined) {
				await this.replaceOriginalTaskLine(file);
			}
			
			new Notice(`Task created: ${this.title}`);
			this.close();
		} catch (error) {
			console.error('Failed to create task:', error);
			new Notice('Failed to create task. Please try again.');
		}
	}

	/**
	 * Replace the original Tasks Plugin line(s) with a link to the new TaskNote
	 * Supports multi-line replacement when selection info is available
	 */
	private async replaceOriginalTaskLine(file: TFile): Promise<void> {
		if (!this.conversionOptions.editor || this.conversionOptions.lineNumber === undefined) {
			return;
		}

		const editor = this.conversionOptions.editor;
		const lineNumber = this.conversionOptions.lineNumber;
		
		// Check if we have multi-line selection info
		if (this.conversionOptions.selectionInfo) {
			const { startLine, endLine, originalContent } = this.conversionOptions.selectionInfo;
			
			// Get original indentation from the first line
			const originalIndentation = originalContent[0].match(/^(\s*)/)?.[1] || '';
			
			// Create link text with proper indentation
			const linkText = `${originalIndentation}- [[${file.path}|${this.title}]]`;
			
			// Replace the entire selection with the link
			const rangeStart = { line: startLine, ch: 0 };
			const rangeEnd = { line: endLine, ch: editor.getLine(endLine).length };
			
			editor.replaceRange(linkText, rangeStart, rangeEnd);
		} else {
			// Single line replacement (original behavior)
			const linkText = `- [[${file.path}|${this.title}]]`;
			
			// Replace the entire line with the link
			const lineStart = { line: lineNumber, ch: 0 };
			const lineEnd = { line: lineNumber, ch: editor.getLine(lineNumber).length };
			
			editor.replaceRange(linkText, lineStart, lineEnd);
		}
	}

	/**
	 * Validate form and prepare for task creation
	 */
	private async validateAndPrepareTask(): Promise<boolean> {
		// Validate required fields
		if (!this.title || !this.title.trim()) {
			new Notice('Title is required');
			return false;
		}

		if (this.title.length > 200) {
			new Notice('Title is too long (max 200 characters)');
			return false;
		}

		// Validate recurrence fields
		if (this.recurrence === 'weekly' && this.daysOfWeek.length === 0) {
			new Notice('Please select at least one day for weekly recurrence');
			return false;
		}

		if (this.recurrence === 'monthly' && (!this.dayOfMonth || parseInt(this.dayOfMonth) < 1 || parseInt(this.dayOfMonth) > 31)) {
			new Notice('Please enter a valid day of month (1-31)');
			return false;
		}

		if (this.recurrence === 'yearly') {
			if (!this.monthOfYear || !this.dayOfMonth) {
				new Notice('Please select month and day for yearly recurrence');
				return false;
			}
			if (parseInt(this.dayOfMonth) < 1 || parseInt(this.dayOfMonth) > 31) {
				new Notice('Please enter a valid day of month (1-31)');
				return false;
			}
		}

		return true;
	}

	/**
	 * Perform the actual task creation using the centralized service
	 */
	private async performTaskCreation(): Promise<TFile> {
		// Prepare contexts and tags arrays
		const contextsArray = this.contexts ? this.contexts.split(',').map(c => c.trim()).filter(c => c) : [];
		const tagsArray = this.tags ? this.tags.split(',').map(t => t.trim()).filter(t => t) : [];
		
		// Add task tag
		tagsArray.unshift(this.plugin.settings.taskTag);

		// For manual task creation, don't associate with any parent note
		const parentNote = '';

		// Create TaskCreationData object with all the data
		const taskData: import('../services/TaskService').TaskCreationData = {
			title: this.title,
			status: this.status,
			priority: this.priority,
			due: this.dueDate || undefined,
			scheduled: this.scheduledDate || undefined,
			contexts: contextsArray.length > 0 ? contextsArray : undefined,
			tags: tagsArray,
			timeEstimate: this.timeEstimate > 0 ? this.timeEstimate : undefined,
			details: this.details && this.details.trim() ? this.details.trim() : undefined,
			parentNote: parentNote, // Include parent note for template variable
			dateCreated: getCurrentTimestamp(),
			dateModified: getCurrentTimestamp()
		};

		// Add recurrence data
		if (this.recurrence !== 'none') {
			taskData.recurrence = {
				frequency: this.recurrence
			};

			if (this.recurrence === 'weekly' && this.daysOfWeek.length > 0) {
				// Convert full names to abbreviations for storage
				taskData.recurrence.days_of_week = this.convertFullNamesToAbbreviations(this.daysOfWeek);
			}

			if (this.recurrence === 'monthly' && this.dayOfMonth) {
				taskData.recurrence.day_of_month = parseInt(this.dayOfMonth);
			}

			if (this.recurrence === 'yearly') {
				if (this.monthOfYear) {
					taskData.recurrence.month_of_year = parseInt(this.monthOfYear);
				}
				if (this.dayOfMonth) {
					taskData.recurrence.day_of_month = parseInt(this.dayOfMonth);
				}
			}
		}

		// Use the centralized task creation service
		const { file } = await this.plugin.taskService.createTask(taskData);

		// If calendar view is open, update it to show the new task
		const leaves = this.app.workspace.getLeavesOfType(MINI_CALENDAR_VIEW_TYPE);
		if (leaves.length > 0) {
			const calendarView = leaves[0].view as any;
			if (calendarView && typeof calendarView.refresh === 'function') {
				calendarView.refresh();
			}
		}

		return file;
	}

	/**
	 * Create due date input with reference for later updates
	 */
	private createDueDateInputWithRef(container: HTMLElement): void {
		// Use the base implementation
		this.createDueDateInput(container);
		
		// Get reference to the date input for compatibility
		this.dueDateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
	}
}