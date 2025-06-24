import { App, Notice, TFile, Setting, Editor, setIcon } from 'obsidian';
import TaskNotesPlugin from '../main';
import { BaseTaskModal } from './BaseTaskModal';
import { MINI_CALENDAR_VIEW_TYPE, TaskInfo } from '../types';
import { ParsedTaskData } from '../utils/TasksPluginParser';
import { getCurrentTimestamp, getDatePart } from '../utils/dateUtils';
import { generateTaskFilename, FilenameContext } from '../utils/filenameGenerator';
import { calculateDefaultDate } from '../utils/helpers';
import { NaturalLanguageParser, ParsedTaskData as NLParsedTaskData } from '../services/NaturalLanguageParser';

export interface TaskConversionOptions {
	parsedData?: ParsedTaskData;
	editor?: Editor;
	lineNumber?: number;
	selectionInfo?: { taskLine: string; details: string; startLine: number; endLine: number; originalContent: string[] };
	prefilledDetails?: string;
}

export class TaskCreationModal extends BaseTaskModal {
	details = '';
	
	// UI elements for filename preview
	private filenamePreview: HTMLElement | null = null;
	private dueDateInput: HTMLInputElement | null = null;

	// Task conversion options
	private conversionOptions: TaskConversionOptions;
	
	// Pre-populated values
	private prePopulatedValues: Partial<TaskInfo>;

	// Natural language parsing
	private nlParser: NaturalLanguageParser;
	private nlInputContainer: HTMLElement | null = null;
	private nlPreviewContainer: HTMLElement | null = null;
	private detailedFormContainer: HTMLElement | null = null;
	private isDetailedFormVisible = false;
	private filenamePreviewContainer: HTMLElement | null = null;
  
	constructor(app: App, plugin: TaskNotesPlugin, prePopulatedValues?: Partial<TaskInfo>, conversionOptions?: TaskConversionOptions) {
		super(app, plugin);
		this.prePopulatedValues = prePopulatedValues || {};
		this.conversionOptions = conversionOptions || {};
		this.nlParser = new NaturalLanguageParser(
			plugin.settings.customStatuses,
			plugin.settings.customPriorities,
			plugin.settings.nlpDefaultToScheduled
		);
		
		// If this is a task conversion, start with detailed form visible
		if (this.conversionOptions.parsedData) {
			this.isDetailedFormVisible = true;
		}
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
			
			// Apply default scheduled date based on user settings
			this.scheduledDate = calculateDefaultDate(defaults.defaultScheduledDate);
			
			// Apply default contexts and tags
			this.contexts = defaults.defaultContexts || '';
			this.tags = defaults.defaultTags || '';
			
			// Apply default time estimate
			if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
				this.timeEstimate = defaults.defaultTimeEstimate;
			}
			
			// Apply default recurrence
			if (defaults.defaultRecurrence && defaults.defaultRecurrence !== 'none') {
				// For now, just set to no recurrence by default - rrule defaults can be added later
				this.frequencyMode = 'NONE';
				this.recurrenceRule = '';
			} else {
				this.frequencyMode = 'NONE';
				this.recurrenceRule = '';
			}
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
		
		// Handle recurrence - for now, convert basic patterns to details
		// Full rrule support for conversions can be added later
		if (data.recurrence && data.recurrence !== 'none') {
			this.details = `Recurrence: ${data.recurrence}\n${this.details}`.trim();
			
			if (data.recurrenceData) {
				const recurrenceDetails = [];
				if (data.recurrenceData.days_of_week) {
					recurrenceDetails.push(`Days: ${data.recurrenceData.days_of_week.join(', ')}`);
				}
				if (data.recurrenceData.day_of_month) {
					recurrenceDetails.push(`Day of month: ${data.recurrenceData.day_of_month}`);
				}
				if (data.recurrenceData.month_of_year) {
					recurrenceDetails.push(`Month: ${data.recurrenceData.month_of_year}`);
				}
				if (recurrenceDetails.length > 0) {
					this.details = `${recurrenceDetails.join(', ')}\n${this.details}`.trim();
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

		// Natural language input (if enabled)
		if (this.plugin.settings.enableNaturalLanguageInput) {
			this.createNaturalLanguageInput(contentEl);
		}

		// Create container for detailed form
		this.detailedFormContainer = contentEl.createDiv({ cls: 'detailed-form-container' });
		if (this.plugin.settings.enableNaturalLanguageInput && !this.conversionOptions.parsedData) {
			this.detailedFormContainer.style.display = 'none';
		}
		
		// Title with character count and filename preview updates
		this.createFormGroup(this.detailedFormContainer, 'Title', (container) => {
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
			window.setTimeout(() => input.focus(), 50);
		});
		
		// Filename preview
		this.filenamePreviewContainer = this.createFormGroup(contentEl, 'Filename preview', (container) => {
			this.filenamePreview = container.createDiv({ 
				cls: 'task-creation-modal__preview',
				text: 'Enter a title to see filename preview...'
			});
		});

		// Hide filename preview if natural language input is enabled and not converting a task
		if (this.plugin.settings.enableNaturalLanguageInput && !this.conversionOptions.parsedData) {
			this.filenamePreviewContainer.style.display = 'none';
		}
		
		// Details
		this.createFormGroup(this.detailedFormContainer, 'Details', (container) => {
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
		this.createFormGroup(this.detailedFormContainer, 'Due date', (container) => {
			this.createDueDateInputWithRef(container);
		});
		
		// Scheduled Date
		this.createFormGroup(this.detailedFormContainer, 'Scheduled date', (container) => {
			this.createScheduledDateInput(container);
		});
		
		// Priority
		this.createFormGroup(this.detailedFormContainer, 'Priority', (container) => {
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
		this.createFormGroup(this.detailedFormContainer, 'Status', (container) => {
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
		this.createFormGroup(this.detailedFormContainer, 'Contexts', (container) => {
			this.createAutocompleteInput(
				container,
				'contexts',
				() => this.existingContexts,
				(value) => { this.contexts = value; }
			);
		});
		
		// Tags with autocomplete
		this.createFormGroup(this.detailedFormContainer, 'Tags', (container) => {
			this.createAutocompleteInput(
				container,
				'tags',
				() => this.existingTags,
				(value) => { this.tags = value; }
			);
		});
		
		// Time Estimate
		this.createFormGroup(this.detailedFormContainer, 'Time estimate', (container) => {
			this.createTimeEstimateInput(container);
		});
		
		// Recurrence - create in detailedFormContainer like other fields
		this.createFormGroup(this.detailedFormContainer, 'Recurrence', (container) => {
			this.createRRuleBuilder(container);
		});
		
		// Action buttons
		this.createActionButtons(this.detailedFormContainer);
		
		
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
				date: new Date(),
				dueDate: this.dueDate,
				scheduledDate: this.scheduledDate
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
		if (this.frequencyMode === 'WEEKLY' && this.rruleByWeekday.length === 0) {
			new Notice('Please select at least one day for weekly recurrence');
			return false;
		}

		if (this.frequencyMode === 'MONTHLY') {
			if (this.monthlyMode === 'day' && this.rruleByMonthday.length === 0) {
				new Notice('Please specify a day for monthly recurrence');
				return false;
			}
			if (this.monthlyMode === 'weekday' && (this.rruleByWeekday.length === 0 || this.rruleBySetpos.length === 0)) {
				new Notice('Please specify both position and weekday for monthly recurrence');
				return false;
			}
		}

		if (this.frequencyMode === 'YEARLY') {
			if (this.rruleByMonth.length === 0 || this.rruleByMonthday.length === 0) {
				new Notice('Please specify both month and day for yearly recurrence');
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

		// Add recurrence data as rrule string
		if (this.recurrenceRule && this.recurrenceRule.trim()) {
			taskData.recurrence = this.recurrenceRule;
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

	/**
	 * Create natural language input section
	 */
	private createNaturalLanguageInput(contentEl: HTMLElement): void {
		this.nlInputContainer = contentEl.createDiv({ cls: 'nl-input-container' });
		
		// Create minimalist input field without label
		const inputContainer = this.nlInputContainer.createDiv({ cls: 'modal-form__input-container' });
		const textarea = inputContainer.createEl('textarea', {
			cls: 'modal-form__input modal-form__input--textarea nl-input',
			attr: {
				placeholder: 'Buy groceries tomorrow at 3 in the afternoon @home #errands\n\nAdd details here...\n',
				rows: '3'
			}
		});

		// Minimal button container
		const buttonContainer = inputContainer.createDiv({ 
			cls: 'nl-button-container',
			attr: { style: 'display: flex; gap: 6px; margin-top: 6px; align-items: center;' }
		});
		
		const quickCreateButton = buttonContainer.createEl('button', {
			cls: 'mod-cta nl-quick-create-button',
			text: 'Create'
		});

		const parseButton = buttonContainer.createEl('button', {
			cls: 'nl-parse-button',
			text: 'Fill form'
		});

		const showDetailButton = buttonContainer.createEl('button', {
			cls: 'nl-show-detail-button',
			text: this.isDetailedFormVisible ? '−' : '+',
			attr: { title: this.isDetailedFormVisible ? 'Hide detailed options' : 'Show detailed options' }
		});

		// Event listeners
		textarea.addEventListener('input', () => {
			const input = textarea.value.trim();
			if (input) {
				this.updateNaturalLanguagePreview(input);
			} else {
				this.clearNaturalLanguagePreview();
			}
		});

		quickCreateButton.addEventListener('click', async () => {
			const input = textarea.value.trim();
			if (input) {
				await this.quickCreateTask(input);
			}
		});

		parseButton.addEventListener('click', () => {
			const input = textarea.value.trim();
			if (input) {
				this.parseAndFillForm(input);
			}
		});

		showDetailButton.addEventListener('click', () => {
			this.toggleDetailedForm();
			showDetailButton.textContent = this.isDetailedFormVisible ? '−' : '+';
			showDetailButton.setAttribute('title', this.isDetailedFormVisible ? 'Hide detailed options' : 'Show detailed options');
		});

		// Keyboard shortcuts
		textarea.addEventListener('keydown', (e) => {
			const input = textarea.value.trim();
			if (!input) return;

			// Ctrl/Cmd + Enter = Quick create
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				e.stopPropagation();
				// Use setTimeout to avoid async issues
				window.setTimeout(async () => {
					await this.quickCreateTask(input);
				}, 0);
			}
			// Shift + Enter = Parse and fill form
			else if (e.key === 'Enter' && e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				this.parseAndFillForm(input);
			}
		});

		// Create preview container
		this.nlPreviewContainer = this.nlInputContainer.createDiv({ cls: 'nl-preview-container' });
		this.nlPreviewContainer.style.display = 'none';

		// Focus the textarea when natural language input is enabled (but not for conversions)
		if (!this.isDetailedFormVisible) {
			window.setTimeout(() => {
				const nlTextarea = this.nlInputContainer?.querySelector('.nl-input') as HTMLTextAreaElement;
				if (nlTextarea) {
					nlTextarea.focus();
				}
			}, 100);
		}
	}

	/**
	 * Update natural language preview
	 */
	private updateNaturalLanguagePreview(input: string): void {
		if (!this.nlPreviewContainer) return;

		const parsed = this.nlParser.parseInput(input);
		const previewData = this.nlParser.getPreviewData(parsed);

		if (previewData.length > 0 && parsed.title) {
			this.nlPreviewContainer.empty();
			// No label for preview - let the content speak for itself
			
			const previewContent = this.nlPreviewContainer.createEl('div', {
				cls: 'nl-preview-text'
			});

			// Create each preview item with proper icon on new lines
			previewData.forEach((item, index) => {
				const itemContainer = previewContent.createDiv({ cls: 'nl-preview-item' });
				const iconEl = itemContainer.createSpan({ cls: 'nl-preview-icon' });
				setIcon(iconEl, item.icon);
				itemContainer.createSpan({ text: ` ${item.text}`, cls: 'nl-preview-text-content' });
			});

			this.nlPreviewContainer.style.display = 'block';
		} else {
			this.nlPreviewContainer.style.display = 'none';
		}
	}

	/**
	 * Clear natural language preview
	 */
	private clearNaturalLanguagePreview(): void {
		if (this.nlPreviewContainer) {
			this.nlPreviewContainer.style.display = 'none';
		}
	}

	/**
	 * Parse input and fill form fields
	 */
	private parseAndFillForm(input: string): void {
		const parsed = this.nlParser.parseInput(input);
		
		// Fill form fields with parsed data
		this.applyParsedData(parsed);
		
		// Show detailed form
		this.showDetailedForm();
		
		// Clear natural language input
		const nlTextarea = this.nlInputContainer?.querySelector('.nl-input') as HTMLTextAreaElement;
		if (nlTextarea) {
			nlTextarea.value = '';
		}
		this.clearNaturalLanguagePreview();
	}

	/**
	 * Apply parsed data to form fields
	 */
	private applyParsedData(parsed: NLParsedTaskData): void {
		// Apply title
		if (parsed.title) {
			this.title = parsed.title;
			const titleInput = this.detailedFormContainer?.querySelector('.modal-form__input--title') as HTMLInputElement;
			if (titleInput) {
				titleInput.value = parsed.title;
				titleInput.dispatchEvent(new Event('input'));
			}
		}

		// Apply details
		if (parsed.details) {
			this.details = parsed.details;
			
			// Find details form group and textarea
			const detailsFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
			const detailsGroup = detailsFormGroups.find(group => {
				const label = group.querySelector('.modal-form__label');
				return label?.textContent?.includes('Details');
			});
			
			if (detailsGroup) {
				const textarea = detailsGroup.querySelector('textarea') as HTMLTextAreaElement;
				if (textarea) {
					textarea.value = this.details;
					textarea.dispatchEvent(new Event('input'));
				}
			}
		}

		// Apply due date and time
		if (parsed.dueDate) {
			this.dueDate = parsed.dueTime ? `${parsed.dueDate} ${parsed.dueTime}` : parsed.dueDate;
			
			// Find due date form group and inputs
			const dueDateFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
			const dueDateGroup = dueDateFormGroups.find(group => {
				const label = group.querySelector('.modal-form__label');
				return label?.textContent?.includes('Due date');
			});
			
			if (dueDateGroup) {
				const dateInput = dueDateGroup.querySelector('input[type="date"]') as HTMLInputElement;
				const timeInput = dueDateGroup.querySelector('input[type="time"]') as HTMLInputElement;
				
				if (dateInput) {
					dateInput.value = parsed.dueDate;
					dateInput.dispatchEvent(new Event('change'));
				}
				if (timeInput && parsed.dueTime) {
					timeInput.value = parsed.dueTime;
					timeInput.dispatchEvent(new Event('change'));
				}
			}
		}

		// Apply scheduled date and time
		if (parsed.scheduledDate) {
			this.scheduledDate = parsed.scheduledTime ? `${parsed.scheduledDate} ${parsed.scheduledTime}` : parsed.scheduledDate;
			
			// Find scheduled date form group and inputs
			const scheduledDateFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
			const scheduledDateGroup = scheduledDateFormGroups.find(group => {
				const label = group.querySelector('.modal-form__label');
				return label?.textContent?.includes('Scheduled date');
			});
			
			if (scheduledDateGroup) {
				const dateInput = scheduledDateGroup.querySelector('input[type="date"]') as HTMLInputElement;
				const timeInput = scheduledDateGroup.querySelector('input[type="time"]') as HTMLInputElement;
				
				if (dateInput) {
					dateInput.value = parsed.scheduledDate;
					dateInput.dispatchEvent(new Event('change'));
				}
				if (timeInput && parsed.scheduledTime) {
					timeInput.value = parsed.scheduledTime;
					timeInput.dispatchEvent(new Event('change'));
				}
			}
		}

		// Apply priority
		if (parsed.priority) {
			this.priority = parsed.priority;
			
			// Find priority form group and select
			const priorityFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
			const priorityGroup = priorityFormGroups.find(group => {
				const label = group.querySelector('.modal-form__label');
				return label?.textContent?.includes('Priority');
			});
			
			if (priorityGroup) {
				const select = priorityGroup.querySelector('select') as HTMLSelectElement;
				if (select) {
					select.value = parsed.priority;
					select.dispatchEvent(new Event('change'));
				}
			}
		}

		// Apply status
		if (parsed.status) {
			this.status = parsed.status;
			
			// Find status form group and select
			const statusFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
			const statusGroup = statusFormGroups.find(group => {
				const label = group.querySelector('.modal-form__label');
				return label?.textContent?.includes('Status');
			});
			
			if (statusGroup) {
				const select = statusGroup.querySelector('select') as HTMLSelectElement;
				if (select) {
					select.value = parsed.status;
					select.dispatchEvent(new Event('change'));
				}
			}
		}

		// Apply contexts
		if (parsed.contexts.length > 0) {
			this.contexts = parsed.contexts.join(', ');
			
			// Find contexts form group and input
			const contextsFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
			const contextsGroup = contextsFormGroups.find(group => {
				const label = group.querySelector('.modal-form__label');
				return label?.textContent?.includes('Contexts');
			});
			
			if (contextsGroup) {
				const input = contextsGroup.querySelector('input[type="text"]') as HTMLInputElement;
				if (input) {
					input.value = this.contexts;
					input.dispatchEvent(new Event('input'));
				}
			}
		}

		// Apply tags
		if (parsed.tags.length > 0) {
			this.tags = parsed.tags.join(', ');
			
			// Find tags form group and input
			const tagsFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
			const tagsGroup = tagsFormGroups.find(group => {
				const label = group.querySelector('.modal-form__label');
				return label?.textContent?.includes('Tags');
			});
			
			if (tagsGroup) {
				const input = tagsGroup.querySelector('input[type="text"]') as HTMLInputElement;
				if (input) {
					input.value = this.tags;
					input.dispatchEvent(new Event('input'));
				}
			}
		}

		// Apply time estimate
		if (parsed.estimate) {
			this.timeEstimate = parsed.estimate;
			
			// Find time estimate form group and input
			const estimateFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
			const estimateGroup = estimateFormGroups.find(group => {
				const label = group.querySelector('.modal-form__label');
				return label?.textContent?.includes('Time estimate');
			});
			
			if (estimateGroup) {
				const input = estimateGroup.querySelector('input[type="number"]') as HTMLInputElement;
				if (input) {
					input.value = parsed.estimate.toString();
					input.dispatchEvent(new Event('input'));
				}
			}
		}

		// Apply recurrence - now supports rrule strings
		if (parsed.recurrence && parsed.recurrence !== 'none') {
			// If it's an rrule string, parse it and populate the recurrence UI
			if (parsed.recurrence.startsWith('FREQ=')) {
				this.recurrenceRule = parsed.recurrence;
				this.parseRRuleString(parsed.recurrence);
				
				// Update the recurrence UI by triggering the frequency dropdown change
				const recurrenceFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
				const recurrenceGroup = recurrenceFormGroups.find(group => {
					const label = group.querySelector('.modal-form__label');
					return label?.textContent?.includes('Recurrence');
				});
				
				if (recurrenceGroup) {
					// Find and update the frequency dropdown
					const frequencySelect = recurrenceGroup.querySelector('select') as HTMLSelectElement;
					if (frequencySelect) {
						frequencySelect.value = this.frequencyMode;
						frequencySelect.dispatchEvent(new Event('change'));
					}
					
					// After the frequency change event processes, update the interval input
					window.setTimeout(() => {
						const intervalInput = recurrenceGroup.querySelector('.modal-form__input--interval') as HTMLInputElement;
						if (intervalInput) {
							intervalInput.value = this.rruleInterval.toString();
						}
						
						// Update weekday checkboxes for weekly recurrence
						if (this.frequencyMode === 'WEEKLY' && this.rruleByWeekday.length > 0) {
							const dayCheckboxes = recurrenceGroup.querySelectorAll('.modal-form__day-input') as NodeListOf<HTMLInputElement>;
							dayCheckboxes.forEach(checkbox => {
								const dayLabel = checkbox.parentElement?.querySelector('.modal-form__day-label')?.textContent;
								if (dayLabel) {
									const fullDayName = this.getDayNameFromAbbreviation(dayLabel);
									const isSelected = this.rruleByWeekday.some(wd => {
										const dayNum = wd.weekday;
										const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
										return dayNames[dayNum] === fullDayName;
									});
									checkbox.checked = isSelected;
								}
							});
						}
					}, 100);
				}
			} else {
				// Legacy handling for simple recurrence patterns - add to details
				let recurrenceText = `Recurrence: ${parsed.recurrence}`;
				this.details = this.details ? `${recurrenceText}\n${this.details}` : recurrenceText;
				
				// Update details field if it exists
				const detailsFormGroups = Array.from(this.detailedFormContainer?.querySelectorAll('.modal-form__group') || []);
				const detailsGroup = detailsFormGroups.find(group => {
					const label = group.querySelector('.modal-form__label');
					return label?.textContent?.includes('Details');
				});
				
				if (detailsGroup) {
					const textarea = detailsGroup.querySelector('textarea') as HTMLTextAreaElement;
					if (textarea) {
						textarea.value = this.details;
						textarea.dispatchEvent(new Event('input'));
					}
				}
			}
		}

		// Update filename preview
		this.updateFilenamePreview();
	}

	/**
	 * Toggle detailed form visibility
	 */
	private toggleDetailedForm(): void {
		if (this.isDetailedFormVisible) {
			this.hideDetailedForm();
		} else {
			this.showDetailedForm();
		}
	}

	/**
	 * Show detailed form
	 */
	private showDetailedForm(): void {
		if (this.detailedFormContainer) {
			this.detailedFormContainer.style.display = 'block';
			this.isDetailedFormVisible = true;
			
			// Show filename preview when detailed form is shown
			if (this.filenamePreviewContainer) {
				this.filenamePreviewContainer.style.display = 'block';
			}
			
			
			// Update button text
			const showDetailButton = this.nlInputContainer?.querySelector('.nl-show-detail-button') as HTMLButtonElement;
			if (showDetailButton) {
				showDetailButton.textContent = '−';
				showDetailButton.setAttribute('title', 'Hide detailed options');
			}
		}
	}


	/**
	 * Hide detailed form
	 */
	private hideDetailedForm(): void {
		if (this.detailedFormContainer) {
			this.detailedFormContainer.style.display = 'none';
			this.isDetailedFormVisible = false;
			
			// Hide filename preview when detailed form is hidden (only if natural language is enabled)
			if (this.plugin.settings.enableNaturalLanguageInput && this.filenamePreviewContainer) {
				this.filenamePreviewContainer.style.display = 'none';
			}
			
			
			// Update button text
			const showDetailButton = this.nlInputContainer?.querySelector('.nl-show-detail-button') as HTMLButtonElement;
			if (showDetailButton) {
				showDetailButton.textContent = '+';
				showDetailButton.setAttribute('title', 'Show detailed options');
			}
		}
	}

	/**
	 * Convert day abbreviation to full day name
	 */
	private getDayNameFromAbbreviation(abbr: string): string {
		const dayMap: Record<string, string> = {
			'MON': 'Monday',
			'TUE': 'Tuesday',
			'WED': 'Wednesday',
			'THU': 'Thursday',
			'FRI': 'Friday',
			'SAT': 'Saturday',
			'SUN': 'Sunday'
		};
		return dayMap[abbr.toUpperCase()] || abbr;
	}

	/**
	 * Quick create task from natural language input
	 */
	private async quickCreateTask(input: string): Promise<void> {
		try {
			// Disable the modal's form to prevent multiple submissions
			const formElements = this.containerEl.querySelectorAll('input, button, textarea, select');
			formElements.forEach(el => (el as HTMLElement).style.pointerEvents = 'none');

			// Parse the input and populate form fields
			const parsed = this.nlParser.parseInput(input);
			this.applyParsedData(parsed);
			
			// Wait for form population to complete (especially for days of week)
			await new Promise(resolve => window.setTimeout(resolve, 350));
			
			// Use the existing form submission logic
			await this.handleSubmit();
			
			// Close the modal
			this.close();
		} catch (error) {
			console.error('Error during quick task creation:', error);
			new Notice('Failed to create task. Please try using the detailed form.');
			
			// Re-enable form elements on error
			const formElements = this.containerEl.querySelectorAll('input, button, textarea, select');
			formElements.forEach(el => (el as HTMLElement).style.pointerEvents = 'auto');
		}
	}
}
