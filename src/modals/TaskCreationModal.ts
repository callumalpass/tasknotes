import { App, Notice, setIcon, AbstractInputSuggest, setTooltip } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskModal } from './TaskModal';
import { TaskInfo, TaskCreationData } from '../types';
import { getCurrentTimestamp } from '../utils/dateUtils';
import { generateTaskFilename, FilenameContext } from '../utils/filenameGenerator';
import { calculateDefaultDate, sanitizeTags } from '../utils/helpers';
import { NaturalLanguageParser, ParsedTaskData as NLParsedTaskData } from '../services/NaturalLanguageParser';
import { combineDateAndTime } from '../utils/dateUtils';
import { splitListPreservingLinksAndQuotes } from '../utils/stringSplit';

export interface TaskCreationOptions {
    prePopulatedValues?: Partial<TaskInfo>;
    onTaskCreated?: (task: TaskInfo) => void;
}

/**
 * Auto-suggestion provider for NLP textarea with @, #, and + triggers
 * @ = contexts, # = tags, + = wikilinks to vault files
 */
interface ProjectSuggestion {
    basename: string;
    displayName: string;
    type: 'project';
    toString(): string;
}

interface TagSuggestion {
    value: string;
    display: string;
    type: 'tag';
    toString(): string;
}

interface ContextSuggestion {
    value: string;
    display: string;
    type: 'context';
    toString(): string;
}

class NLPSuggest extends AbstractInputSuggest<TagSuggestion | ContextSuggestion | ProjectSuggestion> {
    private plugin: TaskNotesPlugin;
    private textarea: HTMLTextAreaElement;
    private currentTrigger: '@' | '#' | '+' | null = null;
    
    constructor(app: App, textareaEl: HTMLTextAreaElement, plugin: TaskNotesPlugin) {
        super(app, textareaEl as unknown as HTMLInputElement);
        this.plugin = plugin;
        this.textarea = textareaEl;
    }
    
    protected async getSuggestions(query: string): Promise<(TagSuggestion | ContextSuggestion | ProjectSuggestion)[]> {
        // Get cursor position and text around it
        const cursorPos = this.textarea.selectionStart;
        const textBeforeCursor = this.textarea.value.slice(0, cursorPos);
        
        // Find the last @, #, or + before cursor
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        const lastHashIndex = textBeforeCursor.lastIndexOf('#');
        const lastPlusIndex = textBeforeCursor.lastIndexOf('+');
        
        let triggerIndex = -1;
        let trigger: '@' | '#' | '+' | null = null;
        
        // Find the most recent trigger
        if (lastAtIndex >= lastHashIndex && lastAtIndex >= lastPlusIndex && lastAtIndex !== -1) {
            triggerIndex = lastAtIndex;
            trigger = '@';
        } else if (lastHashIndex >= lastPlusIndex && lastHashIndex !== -1) {
            triggerIndex = lastHashIndex;
            trigger = '#';
        } else if (lastPlusIndex !== -1) {
            triggerIndex = lastPlusIndex;
            trigger = '+';
        }
        
        // No trigger found or trigger is not at word boundary
        if (triggerIndex === -1 || (triggerIndex > 0 && /\w/.test(textBeforeCursor[triggerIndex - 1]))) {
            this.currentTrigger = null;
            return [];
        }
        
        // Extract the query after the trigger
        const queryAfterTrigger = textBeforeCursor.slice(triggerIndex + 1);

        // If '+' trigger already has a completed wikilink (+[[...]]), do not suggest again
        if (trigger === '+' && /^\[\[[^\]]*\]\]/.test(queryAfterTrigger)) {
            this.currentTrigger = null;
            return [];
        }

        // Check if there's a space in the query (which would end the suggestion context)
        // For '+' (projects/wikilinks), allow spaces for multi-word fuzzy queries
        if ((trigger === '@' || trigger === '#') && (queryAfterTrigger.includes(' ') || queryAfterTrigger.includes('\n'))) {
            this.currentTrigger = null;
            return [];
        }

        this.currentTrigger = trigger;

        // Get suggestions based on trigger type
        if (trigger === '@') {
            const contexts = this.plugin.cacheManager.getAllContexts();
            return contexts
                .filter(context => context && typeof context === 'string')
                .filter(context => 
                    context.toLowerCase().includes(queryAfterTrigger.toLowerCase())
                )
                .slice(0, 10)
                .map(context => ({
                    value: context,
                    display: context,
                    type: 'context' as const,
                    toString() { return this.value; }
                }));
        } else if (trigger === '#') {
            const tags = this.plugin.cacheManager.getAllTags();
            return tags
                .filter(tag => tag && typeof tag === 'string')
                .filter(tag => 
                    tag.toLowerCase().includes(queryAfterTrigger.toLowerCase())
                )
                .slice(0, 10)
                .map(tag => ({
                    value: tag,
                    display: tag,
                    type: 'tag' as const,
                    toString() { return this.value; }
                }));
        } else if (trigger === '+') {
            // Inline fuzzy: use shared file suggestion helper with multi-word support
            const { FileSuggestHelper } = await import('../suggest/FileSuggestHelper');
            const list = await FileSuggestHelper.suggest(this.plugin, queryAfterTrigger);
            return list.map(item => ({
                basename: item.insertText,
                displayName: item.displayText,
                type: 'project' as const,
                toString() { return this.basename; }
            }));
        }
        
        return [];
    }
    
    public renderSuggestion(suggestion: TagSuggestion | ContextSuggestion | ProjectSuggestion, el: HTMLElement): void {
        const icon = el.createSpan('nlp-suggest-icon');
        icon.textContent = this.currentTrigger || '';
        
        const text = el.createSpan('nlp-suggest-text');
        
        if (suggestion.type === 'project') {
            // For projects with enhanced display
            text.textContent = suggestion.displayName;
        } else {
            // For contexts and tags
            text.textContent = suggestion.display;
        }
    }
    
    public selectSuggestion(suggestion: TagSuggestion | ContextSuggestion | ProjectSuggestion): void {
        if (!this.currentTrigger) return;
        
        const cursorPos = this.textarea.selectionStart;
        const textBeforeCursor = this.textarea.value.slice(0, cursorPos);
        const textAfterCursor = this.textarea.value.slice(cursorPos);
        
        // Find the last trigger position
        const lastTriggerIndex = this.currentTrigger === '@' 
            ? textBeforeCursor.lastIndexOf('@')
            : this.currentTrigger === '#'
            ? textBeforeCursor.lastIndexOf('#')
            : textBeforeCursor.lastIndexOf('+');
            
        if (lastTriggerIndex === -1) return;
        
        // Get the actual suggestion text to insert
        const suggestionText = suggestion.type === 'project' ? suggestion.basename : suggestion.value;
        
        // Replace the trigger and partial text with the full suggestion
        const beforeTrigger = textBeforeCursor.slice(0, lastTriggerIndex);
        let replacement = this.currentTrigger + suggestionText;
        
        // For project (+) trigger, wrap in wikilink syntax but keep the + sign
        if (this.currentTrigger === '+') {
            replacement = '+[[' + suggestionText + ']]';
        }
        
        const newText = beforeTrigger + replacement + ' ' + textAfterCursor;
        
        this.textarea.value = newText;

        // Set cursor position after the inserted suggestion
        const newCursorPos = beforeTrigger.length + replacement.length + 1;
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);

        // Close suggestions after insertion and reset trigger to prevent further replacements
        this.currentTrigger = null;
        this.close();

        // Trigger input event to update preview
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        this.textarea.focus();
    }
}

export class TaskCreationModal extends TaskModal {
    private options: TaskCreationOptions;
    private nlParser: NaturalLanguageParser;
    private nlInput: HTMLTextAreaElement;
    private nlPreviewContainer: HTMLElement;
    private nlButtonContainer: HTMLElement;
    private nlpSuggest: NLPSuggest;

    constructor(app: App, plugin: TaskNotesPlugin, options: TaskCreationOptions = {}) {
        super(app, plugin);
        this.options = options;
        this.nlParser = new NaturalLanguageParser(
            plugin.settings.customStatuses,
            plugin.settings.customPriorities,
            plugin.settings.nlpDefaultToScheduled
        );
    }

    getModalTitle(): string {
        return 'Create task';
    }

    protected createModalContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Create main container
        const container = contentEl.createDiv('minimalist-modal-container');

        // Create NLP input as primary interface (if enabled)
        if (this.plugin.settings.enableNaturalLanguageInput) {
            this.createNaturalLanguageInput(container);
        } else {
            // Fall back to regular title input
            this.createTitleInput(container);
            // When NLP is disabled, start with the modal expanded
            this.isExpanded = true;
            this.containerEl.addClass('expanded');
        }

        // Create action bar with icons
        this.createActionBar(container);

        // Create collapsible details section
        this.createDetailsSection(container);
        
        // Re-render projects list if pre-populated values were applied or defaults are set
        if ((this.options.prePopulatedValues && this.options.prePopulatedValues.projects) || 
            this.selectedProjectFiles.length > 0) {
            this.renderProjectsList();
        }

        // Create save/cancel buttons
        this.createActionButtons(container);
    }

    private createNaturalLanguageInput(container: HTMLElement): void {
        const nlContainer = container.createDiv('nl-input-container');
        
        // Create minimalist input field
        this.nlInput = nlContainer.createEl('textarea', {
            cls: 'nl-input',
            attr: {
                placeholder: 'Buy groceries tomorrow at 3pm @home #errands\n\nAdd details here...',
                rows: '3'
            }
        });

        // Preview container
        this.nlPreviewContainer = nlContainer.createDiv('nl-preview-container');

        // Event listeners
        this.nlInput.addEventListener('input', () => {
            const input = this.nlInput.value.trim();
            if (input) {
                this.updateNaturalLanguagePreview(input);
            } else {
                this.clearNaturalLanguagePreview();
            }
        });

        // Keyboard shortcuts
        this.nlInput.addEventListener('keydown', (e) => {
            const input = this.nlInput.value.trim();
            if (!input) return;

            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleSave();
            } else if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault();
                this.parseAndFillForm(input);
            }
        });

        // Initialize auto-suggestion
        this.nlpSuggest = new NLPSuggest(this.app, this.nlInput, this.plugin);

        // Focus the input
        setTimeout(() => {
            this.nlInput.focus();
        }, 100);
    }

    private updateNaturalLanguagePreview(input: string): void {
        if (!this.nlPreviewContainer) return;

        const parsed = this.nlParser.parseInput(input);
        const previewData = this.nlParser.getPreviewData(parsed);

        if (previewData.length > 0 && parsed.title) {
            this.nlPreviewContainer.empty();
            this.nlPreviewContainer.style.display = 'block';
            
            previewData.forEach((item) => {
                const previewItem = this.nlPreviewContainer.createDiv('nl-preview-item');
                previewItem.textContent = item.text;
            });
        } else {
            this.clearNaturalLanguagePreview();
        }
    }

    private clearNaturalLanguagePreview(): void {
        if (this.nlPreviewContainer) {
            this.nlPreviewContainer.empty();
            this.nlPreviewContainer.style.display = 'none';
        }
    }

    protected createActionBar(container: HTMLElement): void {
        this.actionBar = container.createDiv('action-bar');

        // NLP-specific icons (only if NLP is enabled)
        if (this.plugin.settings.enableNaturalLanguageInput) {
            // Fill form icon
            this.createActionIcon(this.actionBar, 'wand', 'Fill form from natural language', (icon, event) => {
                const input = this.nlInput?.value.trim();
                if (input) {
                    this.parseAndFillForm(input);
                }
            });

            // Expand/collapse icon
            this.createActionIcon(this.actionBar, this.isExpanded ? 'chevron-up' : 'chevron-down', 
                this.isExpanded ? 'Hide detailed options' : 'Show detailed options', (icon, event) => {
                this.toggleDetailedForm();
                // Update icon and tooltip
                const iconEl = icon.querySelector('.icon');
                if (iconEl) {
                    setIcon(iconEl as HTMLElement, this.isExpanded ? 'chevron-up' : 'chevron-down');
                }
                setTooltip(icon, this.isExpanded ? 'Hide detailed options' : 'Show detailed options', { placement: 'top' });
            });

            // Add separator
            const separator = this.actionBar.createDiv('action-separator');
            separator.style.width = '1px';
            separator.style.height = '24px';
            separator.style.backgroundColor = 'var(--background-modifier-border)';
            separator.style.margin = '0 var(--size-4-2)';
        }

        // Due date icon
        this.createActionIcon(this.actionBar, 'calendar', 'Set due date', (icon, event) => {
            this.showDateContextMenu(event, 'due');
        }, 'due-date');

        // Scheduled date icon
        this.createActionIcon(this.actionBar, 'calendar-clock', 'Set scheduled date', (icon, event) => {
            this.showDateContextMenu(event, 'scheduled');
        }, 'scheduled-date');

        // Status icon
        this.createActionIcon(this.actionBar, 'dot-square', 'Set status', (icon, event) => {
            this.showStatusContextMenu(event);
        }, 'status');

        // Priority icon
        this.createActionIcon(this.actionBar, 'star', 'Set priority', (icon, event) => {
            this.showPriorityContextMenu(event);
        }, 'priority');

        // Recurrence icon
        this.createActionIcon(this.actionBar, 'refresh-ccw', 'Set recurrence', (icon, event) => {
            this.showRecurrenceContextMenu(event);
        }, 'recurrence');

        // Reminder icon
        this.createActionIcon(this.actionBar, 'bell', 'Set reminders', (icon, event) => {
            this.showReminderContextMenu(event);
        }, 'reminders');

        // Update icon states based on current values
        this.updateIconStates();
    }


    private parseAndFillForm(input: string): void {
        const parsed = this.nlParser.parseInput(input);
        this.applyParsedData(parsed);
        
        // Expand the form to show filled fields
        if (!this.isExpanded) {
            this.expandModal();
        }
    }

    private applyParsedData(parsed: NLParsedTaskData): void {
        if (parsed.title) this.title = parsed.title;
        if (parsed.status) this.status = parsed.status;
        if (parsed.priority) this.priority = parsed.priority;
        
        // Handle due date with time
        if (parsed.dueDate) {
            this.dueDate = parsed.dueTime ? combineDateAndTime(parsed.dueDate, parsed.dueTime) : parsed.dueDate;
        }
        
        // Handle scheduled date with time
        if (parsed.scheduledDate) {
            this.scheduledDate = parsed.scheduledTime ? combineDateAndTime(parsed.scheduledDate, parsed.scheduledTime) : parsed.scheduledDate;
        }
        
        if (parsed.contexts && parsed.contexts.length > 0) this.contexts = parsed.contexts.join(', ');
        // Projects will be handled in the form input update section below
        if (parsed.tags && parsed.tags.length > 0) this.tags = sanitizeTags(parsed.tags.join(', '));
        if (parsed.details) this.details = parsed.details;
        if (parsed.recurrence) this.recurrenceRule = parsed.recurrence;

        // Update form inputs if they exist
        if (this.titleInput) this.titleInput.value = this.title;
        if (this.detailsInput) this.detailsInput.value = this.details;
        if (this.contextsInput) this.contextsInput.value = this.contexts;
        if (this.tagsInput) this.tagsInput.value = this.tags;
        
        // Handle projects differently - they use file selection, not text input
        if (parsed.projects && parsed.projects.length > 0) {
            this.initializeProjectsFromStrings(parsed.projects);
            this.renderProjectsList();
        }
        
        // Update icon states
        this.updateIconStates();
    }

    private toggleDetailedForm(): void {
        if (this.isExpanded) {
            // Collapse
            this.isExpanded = false;
            this.detailsContainer.style.display = 'none';
            this.containerEl.removeClass('expanded');
        } else {
            // Expand
            this.expandModal();
        }
    }

    async initializeFormData(): Promise<void> {
        // Initialize with default values from settings
        this.priority = this.plugin.settings.defaultTaskPriority;
        this.status = this.plugin.settings.defaultTaskStatus;
        
        // Apply task creation defaults
        const defaults = this.plugin.settings.taskCreationDefaults;
        
        // Apply default due date
        this.dueDate = calculateDefaultDate(defaults.defaultDueDate);
        
        // Apply default scheduled date based on user settings
        this.scheduledDate = calculateDefaultDate(defaults.defaultScheduledDate);
        
        // Apply default contexts, tags, and projects
        this.contexts = defaults.defaultContexts || '';
        this.tags = defaults.defaultTags || '';
        
        // Apply default projects
        if (defaults.defaultProjects) {
            const projectStrings = splitListPreservingLinksAndQuotes(defaults.defaultProjects);
            if (projectStrings.length > 0) {
                this.initializeProjectsFromStrings(projectStrings);
            }
        }
        
        // Apply default time estimate
        if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
            this.timeEstimate = defaults.defaultTimeEstimate;
        }
        
        // Apply default reminders
        if (defaults.defaultReminders && defaults.defaultReminders.length > 0) {
            // Import the conversion function
            const { convertDefaultRemindersToReminders } = await import('../utils/settingsUtils');
            this.reminders = convertDefaultRemindersToReminders(defaults.defaultReminders);
        }
        
        // Apply pre-populated values if provided (overrides defaults)
        if (this.options.prePopulatedValues) {
            this.applyPrePopulatedValues(this.options.prePopulatedValues);
        }
    }

    private applyPrePopulatedValues(values: Partial<TaskInfo>): void {
        if (values.title !== undefined) this.title = values.title;
        if (values.due !== undefined) this.dueDate = values.due;
        if (values.scheduled !== undefined) this.scheduledDate = values.scheduled;
        if (values.priority !== undefined) this.priority = values.priority;
        if (values.status !== undefined) this.status = values.status;
        if (values.contexts !== undefined) {
            this.contexts = values.contexts.join(', ');
        }
        if (values.projects !== undefined) {
            // Filter out null, undefined, or empty strings before checking if we have valid projects
            const validProjects = values.projects.filter(p => p && typeof p === 'string' && p.trim() !== '');
            if (validProjects.length > 0) {
                this.initializeProjectsFromStrings(values.projects);
            }
            this.renderProjectsList();
        }
        if (values.tags !== undefined) {
            this.tags = sanitizeTags(values.tags.filter(tag => tag !== this.plugin.settings.taskTag).join(', '));
        }
        if (values.timeEstimate !== undefined) this.timeEstimate = values.timeEstimate;
        if (values.recurrence !== undefined && typeof values.recurrence === 'string') {
            this.recurrenceRule = values.recurrence;
        }
    }

    async handleSave(): Promise<void> {
        // If NLP is enabled and there's content in the NL field, parse it first
        if (this.plugin.settings.enableNaturalLanguageInput && this.nlInput) {
            const nlContent = this.nlInput.value.trim();
            if (nlContent && !this.title.trim()) {
                // Only auto-parse if no title has been manually entered
                const parsed = this.nlParser.parseInput(nlContent);
                this.applyParsedData(parsed);
            }
        }

        if (!this.validateForm()) {
            new Notice('Please enter a task title');
            return;
        }

        try {
            const taskData = this.buildTaskData();
            const result = await this.plugin.taskService.createTask(taskData);

            new Notice(`Task "${result.taskInfo.title}" created successfully`);
            
            if (this.options.onTaskCreated) {
                this.options.onTaskCreated(result.taskInfo);
            }

            this.close();

        } catch (error) {
            console.error('Failed to create task:', error);
            new Notice('Failed to create task: ' + error.message);
        }
    }

    private buildTaskData(): Partial<TaskInfo> {
        const now = getCurrentTimestamp();
        
        // Parse contexts, projects, and tags
        const contextList = this.contexts
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);
            
        const projectList = splitListPreservingLinksAndQuotes(this.projects);
            
        const tagList = sanitizeTags(this.tags)
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        // Add the task tag if it's not already present
        if (this.plugin.settings.taskTag && !tagList.includes(this.plugin.settings.taskTag)) {
            tagList.push(this.plugin.settings.taskTag);
        }

        const taskData: TaskCreationData = {
            title: this.title.trim(),
            due: this.dueDate || undefined,
            scheduled: this.scheduledDate || undefined,
            priority: this.priority,
            status: this.status,
            contexts: contextList.length > 0 ? contextList : undefined,
            projects: projectList.length > 0 ? projectList : undefined,
            tags: tagList.length > 0 ? tagList : undefined,
            timeEstimate: this.timeEstimate > 0 ? this.timeEstimate : undefined,
            recurrenceField: this.recurrenceField || undefined,
            recurrence: this.recurrenceRule || undefined,
            reminders: this.reminders.length > 0 ? this.reminders : undefined,
            creationContext: 'manual-creation', // Mark as manual creation for folder logic
            dateCreated: now,
            dateModified: now,
            // Add user fields as custom frontmatter properties
            customFrontmatter: this.buildCustomFrontmatter()
        };

        // Add details if provided
        if (this.details.trim()) {
            // You might want to add the details to the task content or as a separate field
            // For now, we'll add it as part of the task description
            taskData.details = this.details.trim();
        }

        return taskData;
    }

    private buildCustomFrontmatter(): Record<string, any> {
        const customFrontmatter: Record<string, any> = {};
        
        // Add user field values to frontmatter
        for (const [fieldKey, fieldValue] of Object.entries(this.userFields)) {
            if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                customFrontmatter[fieldKey] = fieldValue;
            }
        }
        
        return customFrontmatter;
    }

    private generateFilename(taskData: TaskCreationData): string {
        const context: FilenameContext = {
            title: taskData.title || '',
            status: taskData.status || 'open',
            priority: taskData.priority || 'normal',
            dueDate: taskData.due,
            scheduledDate: taskData.scheduled
        };

        return generateTaskFilename(context, this.plugin.settings);
    }

    // Override to prevent creating duplicate title input when NLP is enabled
    protected createTitleInput(container: HTMLElement): void {
        // Only create title input if NLP is disabled
        if (!this.plugin.settings.enableNaturalLanguageInput) {
            super.createTitleInput(container);
        }
    }
}
