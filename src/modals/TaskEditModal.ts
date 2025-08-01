import { App, Notice, TFile } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskModal } from './TaskModal';
import { TaskInfo } from '../types';
import { getCurrentTimestamp, createUTCDateForRRule, formatUTCDateForCalendar, generateUTCCalendarDates, getUTCStartOfWeek, getUTCEndOfWeek, getUTCStartOfMonth, getUTCEndOfMonth, getTodayLocal, parseDateAsLocal, formatDateAsUTCString } from '../utils/dateUtils';
import { formatTimestampForDisplay } from '../utils/dateUtils';
import { format, isSameMonth } from 'date-fns';
import { generateRecurringInstances, extractTaskInfo, calculateTotalTimeSpent, formatTime } from '../utils/helpers';

export interface TaskEditOptions {
    task: TaskInfo;
    onTaskUpdated?: (task: TaskInfo) => void;
}

export class TaskEditModal extends TaskModal {
    private task: TaskInfo;
    private options: TaskEditOptions;
    private metadataContainer: HTMLElement;
    private completedInstancesChanges: Set<string> = new Set();
    private calendarWrapper: HTMLElement | null = null;

    constructor(app: App, plugin: TaskNotesPlugin, options: TaskEditOptions) {
        super(app, plugin);
        this.task = options.task;
        this.options = options;
    }


    getModalTitle(): string {
        return 'Edit task';
    }

    async initializeFormData(): Promise<void> {
        // Initialize form fields with current task data
        this.title = this.task.title;
        this.dueDate = this.task.due || '';
        this.scheduledDate = this.task.scheduled || '';
        this.priority = this.task.priority;
        this.status = this.task.status;
        this.contexts = this.task.contexts ? this.task.contexts.join(', ') : '';
        
        // Initialize projects using the new method that handles both old and new formats
        if (this.task.projects && this.task.projects.length > 0) {
            // Filter out null, undefined, or empty strings before checking if we have valid projects
            const validProjects = this.task.projects.filter(p => p && typeof p === 'string' && p.trim() !== '');
            if (validProjects.length > 0) {
                this.initializeProjectsFromStrings(this.task.projects);
            } else {
                this.projects = '';
                this.selectedProjectFiles = [];
            }
        } else {
            this.projects = '';
            this.selectedProjectFiles = [];
        }
        
        this.tags = this.task.tags 
            ? this.task.tags.filter(tag => tag !== this.plugin.settings.taskTag).join(', ') 
            : '';
        this.timeEstimate = this.task.timeEstimate || 0;
        
        // Handle recurrence - support both new rrule strings and old RecurrenceInfo objects
        if (this.task.recurrence) {
            if (typeof this.task.recurrence === 'string') {
                this.recurrenceRule = this.task.recurrence;
            } else if (typeof this.task.recurrence === 'object' && this.task.recurrence.frequency) {
                // Legacy recurrence object - convert to string representation for display
                this.recurrenceRule = this.convertLegacyRecurrenceToString(this.task.recurrence);
            }
        } else {
            this.recurrenceRule = '';
        }
    }

    private convertLegacyRecurrenceToString(recurrence: { frequency?: string; days_of_week?: string[]; day_of_month?: number }): string {
        // Convert legacy recurrence object to a readable string
        // This is for display purposes in the edit modal
        if (!recurrence.frequency) return '';
        
        let recurrenceText = recurrence.frequency;
        
        if (recurrence.frequency === 'weekly' && recurrence.days_of_week) {
            recurrenceText += ` on ${recurrence.days_of_week.join(', ')}`;
        }
        
        if (recurrence.frequency === 'monthly' && recurrence.day_of_month) {
            recurrenceText += ` on day ${recurrence.day_of_month}`;
        }
        
        return recurrenceText;
    }

    async onOpen() {
        // Clear any previous completion changes
        this.completedInstancesChanges.clear();
        
        // Refresh task data from file before opening
        await this.refreshTaskData();
        
        this.containerEl.addClass('tasknotes-plugin', 'minimalist-task-modal');
        this.titleEl.textContent = this.getModalTitle();
        
        this.initializeFormData().then(() => {
            this.createModalContent();
            // Render projects list after modal content is created
            this.renderProjectsList();
            // Update icon states after creating the action bar
            this.updateIconStates();
            this.focusTitleInput();
        });
    }

    private async refreshTaskData(): Promise<void> {
        try {
            // Get the file from the path
            const file = this.app.vault.getAbstractFileByPath(this.task.path);
            if (!file || !(file instanceof TFile)) {
                console.warn('Could not find file for task:', this.task.path);
                return;
            }

            // Read the file content
            const content = await this.app.vault.read(file);
            
            // Extract fresh task info
            const freshTaskInfo = extractTaskInfo(
                this.app,
                content,
                this.task.path,
                file,
                this.plugin.fieldMapper,
                this.plugin.settings.storeTitleInFilename
            );

            if (freshTaskInfo) {
                // Update task data with fresh information
                this.task = freshTaskInfo;
                this.options.task = freshTaskInfo;
            }
        } catch (error) {
            console.warn('Could not refresh task data:', error);
            // Continue with existing task data if refresh fails
        }
    }

    protected createModalContent(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Create main container
        const container = contentEl.createDiv('minimalist-modal-container');

        // Create action bar with icons  
        this.createActionBar(container);

        // Create expanded details section (always expanded for editing)
        this.createDetailsSection(container);

        // Create completions calendar section (for recurring tasks)
        this.createCompletionsCalendarSection(container);

        // Create metadata section (for edit modal)
        this.createMetadataSection(container);

        // Create save/cancel buttons
        this.createActionButtons(container);
    }

    private createCompletionsCalendarSection(container: HTMLElement): void {
        // Only show calendar for recurring tasks
        if (this.task.recurrence) {
            const calendarContainer = container.createDiv('completions-calendar-container');
            
            const calendarLabel = calendarContainer.createDiv('detail-label');
            calendarLabel.textContent = 'Completions';
            
            const calendarContent = calendarContainer.createDiv('completions-calendar-content');
            this.createRecurringCalendar(calendarContent);
        }
    }

    private createMetadataSection(container: HTMLElement): void {
        this.metadataContainer = container.createDiv('metadata-container');
        
        const metadataLabel = this.metadataContainer.createDiv('detail-label');
        metadataLabel.textContent = 'Task Information';
        
        const metadataContent = this.metadataContainer.createDiv('metadata-content');
        
        // Total tracked time
        const totalTimeSpent = calculateTotalTimeSpent(this.task.timeEntries || []);
        if (totalTimeSpent > 0) {
            const timeDiv = metadataContent.createDiv('metadata-item');
            timeDiv.createSpan('metadata-key').textContent = 'Total tracked time: ';
            timeDiv.createSpan('metadata-value').textContent = formatTime(totalTimeSpent);
        }
        
        // Created date
        if (this.task.dateCreated) {
            const createdDiv = metadataContent.createDiv('metadata-item');
            createdDiv.createSpan('metadata-key').textContent = 'Created: ';
            createdDiv.createSpan('metadata-value').textContent = formatTimestampForDisplay(this.task.dateCreated);
        }
        
        // Modified date
        if (this.task.dateModified) {
            const modifiedDiv = metadataContent.createDiv('metadata-item');
            modifiedDiv.createSpan('metadata-key').textContent = 'Modified: ';
            modifiedDiv.createSpan('metadata-value').textContent = formatTimestampForDisplay(this.task.dateModified);
        }
        
        // File path (if available)
        if (this.task.path) {
            const pathDiv = metadataContent.createDiv('metadata-item');
            pathDiv.createSpan('metadata-key').textContent = 'File: ';
            pathDiv.createSpan('metadata-value').textContent = this.task.path;
        }
    }

    private createRecurringCalendar(container: HTMLElement): void {
        // Calendar wrapper
        this.calendarWrapper = container.createDiv('recurring-calendar');
        
        // Show current month by default, or the month with most recent completions
        // Use local dates for calendar display
        const currentDate = getTodayLocal();
        let mostRecentCompletion = currentDate;
        
        if (this.task.complete_instances && this.task.complete_instances.length > 0) {
            const validCompletions = this.task.complete_instances
                .filter(d => d && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) // Only valid YYYY-MM-DD dates
                .map(d => parseDateAsLocal(d).getTime())
                .filter(time => !isNaN(time)); // Filter out invalid dates
                
            if (validCompletions.length > 0) {
                mostRecentCompletion = new Date(Math.max(...validCompletions));
            }
        }
        
        this.renderCalendarMonth(this.calendarWrapper, mostRecentCompletion);
    }
    
    private renderCalendarMonth(container: HTMLElement, displayDate: Date): void {
        container.empty();
        
        // Minimalist header
        const header = container.createDiv('recurring-calendar__header');
        const prevButton = header.createEl('button', { 
            cls: 'recurring-calendar__nav',
            text: '‹'
        });
        const monthLabel = header.createSpan('recurring-calendar__month');
        monthLabel.textContent = format(displayDate, 'MMM yyyy');
        const nextButton = header.createEl('button', { 
            cls: 'recurring-calendar__nav',
            text: '›'
        });
        
        // Minimalist grid
        const grid = container.createDiv('recurring-calendar__grid');
        
        // Get all dates to display (including padding from previous/next month)
        // Use UTC dates consistently to avoid timezone issues
        const monthStart = getUTCStartOfMonth(displayDate);
        const monthEnd = getUTCEndOfMonth(displayDate);
        
        // Respect the week start setting from calendar view settings
        const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
        
        const calendarStart = getUTCStartOfWeek(monthStart, firstDaySetting);
        const calendarEnd = getUTCEndOfWeek(monthEnd, firstDaySetting);
        const allDays = generateUTCCalendarDates(calendarStart, calendarEnd);
        
        // Generate recurring instances for this month (with some buffer)
        const bufferStart = getUTCStartOfMonth(displayDate);
        bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
        const bufferEnd = getUTCEndOfMonth(displayDate);
        bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
        
        const recurringDates = generateRecurringInstances(this.task, bufferStart, bufferEnd);
        const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
        
        // Get current completed instances (original + changes)
        const completedInstances = new Set(this.task.complete_instances || []);
        this.completedInstancesChanges.forEach(dateStr => {
            if (completedInstances.has(dateStr)) {
                completedInstances.delete(dateStr);
            } else {
                completedInstances.add(dateStr);
            }
        });
        
        // Render each day (no headers, just numbers)
        allDays.forEach(day => {
            const dayStr = formatUTCDateForCalendar(day);
            const isCurrentMonth = isSameMonth(day, displayDate);
            const isRecurring = recurringDateStrings.has(dayStr);
            const isCompleted = completedInstances.has(dayStr);
            
            const dayElement = grid.createDiv('recurring-calendar__day');
            dayElement.textContent = format(day, 'd');
            
            // Apply BEM modifier classes
            if (!isCurrentMonth) {
                dayElement.addClass('recurring-calendar__day--faded');
            }
            
            // Make all dates clickable
            dayElement.addClass('recurring-calendar__day--clickable');
            
            if (isRecurring) {
                dayElement.addClass('recurring-calendar__day--recurring');
            }
            
            if (isCompleted) {
                dayElement.addClass('recurring-calendar__day--completed');
            }
            
            // Make all dates clickable
            dayElement.addEventListener('click', () => {
                this.toggleCompletedInstance(dayStr);
                this.renderCalendarMonth(container, displayDate);
            });
        });
        
        // Navigation event handlers
        prevButton.addEventListener('click', () => {
            // Create previous month date using local time
            const prevMonth = new Date(
                displayDate.getFullYear(), 
                displayDate.getMonth() - 1, 
                1
            );
            this.renderCalendarMonth(container, prevMonth);
        });
        
        nextButton.addEventListener('click', () => {
            // Create next month date using local time
            const nextMonth = new Date(
                displayDate.getFullYear(), 
                displayDate.getMonth() + 1, 
                1
            );
            this.renderCalendarMonth(container, nextMonth);
        });
    }
    
    private toggleCompletedInstance(dateStr: string): void {
        if (this.completedInstancesChanges.has(dateStr)) {
            this.completedInstancesChanges.delete(dateStr);
        } else {
            this.completedInstancesChanges.add(dateStr);
        }
    }

    async handleSave(): Promise<void> {
        if (!this.validateForm()) {
            new Notice('Please enter a task title');
            return;
        }

        try {
            const changes = this.getChanges();
            
            if (Object.keys(changes).length === 0) {
                new Notice('No changes to save');
                this.close();
                return;
            }

            const updatedTask = await this.plugin.taskService.updateTask(this.task, changes);

            new Notice(`Task "${updatedTask.title}" updated successfully`);
            
            if (this.options.onTaskUpdated) {
                this.options.onTaskUpdated(updatedTask);
            }

        } catch (error) {
            console.error('Failed to update task:', error);
            new Notice('Failed to update task: ' + error.message);
        }
    }

    private getChanges(): Partial<TaskInfo> {
        const changes: Partial<TaskInfo> = {};

        // Check for changes and only include modified fields
        if (this.title.trim() !== this.task.title) {
            changes.title = this.title.trim();
        }

        if (this.dueDate !== (this.task.due || '')) {
            changes.due = this.dueDate || undefined;
        }

        if (this.scheduledDate !== (this.task.scheduled || '')) {
            changes.scheduled = this.scheduledDate || undefined;
        }

        if (this.priority !== this.task.priority) {
            changes.priority = this.priority;
        }

        if (this.status !== this.task.status) {
            changes.status = this.status;
        }

        // Parse and compare contexts
        const newContexts = this.contexts
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);
        const oldContexts = this.task.contexts || [];
        
        if (JSON.stringify(newContexts.sort()) !== JSON.stringify(oldContexts.sort())) {
            changes.contexts = newContexts.length > 0 ? newContexts : undefined;
        }

        // Parse and compare projects
        const newProjects = this.projects
            .split(',')
            .map(p => p.trim())
            .filter(p => p.length > 0);
        const oldProjects = this.task.projects || [];
        
        if (JSON.stringify(newProjects.sort()) !== JSON.stringify(oldProjects.sort())) {
            changes.projects = newProjects;
        }

        // Parse and compare tags
        const newTags = this.tags
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
        
        // Add the task tag if it's not already present
        if (this.plugin.settings.taskTag && !newTags.includes(this.plugin.settings.taskTag)) {
            newTags.push(this.plugin.settings.taskTag);
        }
        
        const oldTags = this.task.tags || [];
        
        if (JSON.stringify(newTags.sort()) !== JSON.stringify(oldTags.sort())) {
            changes.tags = newTags.length > 0 ? newTags : undefined;
        }

        // Compare time estimate
        const newTimeEstimate = this.timeEstimate > 0 ? this.timeEstimate : undefined;
        const oldTimeEstimate = this.task.timeEstimate;
        
        if (newTimeEstimate !== oldTimeEstimate) {
            changes.timeEstimate = newTimeEstimate;
        }

        // Compare recurrence
        const oldRecurrence = typeof this.task.recurrence === 'string' 
            ? this.task.recurrence 
            : '';
            
        if (this.recurrenceRule !== oldRecurrence) {
            changes.recurrence = this.recurrenceRule || undefined;
        }

        // Apply completed instances changes
        if (this.completedInstancesChanges.size > 0) {
            const currentCompleted = new Set(this.task.complete_instances || []);
            this.completedInstancesChanges.forEach(dateStr => {
                if (currentCompleted.has(dateStr)) {
                    currentCompleted.delete(dateStr);
                } else {
                    currentCompleted.add(dateStr);
                }
            });
            changes.complete_instances = Array.from(currentCompleted);
        }

        // Always update modified timestamp if there are changes
        if (Object.keys(changes).length > 0) {
            changes.dateModified = getCurrentTimestamp();
        }

        return changes;
    }


    private async openTaskNote(): Promise<void> {
        try {
            // Get the file from the task path
            const file = this.app.vault.getAbstractFileByPath(this.task.path);
            
            if (!file) {
                new Notice(`Could not find task file: ${this.task.path}`);
                return;
            }

            // Open the file in a new leaf
            const leaf = this.app.workspace.getLeaf(true);
            await leaf.openFile(file as TFile);
            
            // Close the modal
            this.close();
            
        } catch (error) {
            console.error('Failed to open task note:', error);
            new Notice('Failed to open task note');
        }
    }

    private async archiveTask(): Promise<void> {
        try {
            const updatedTask = await this.plugin.taskService.toggleArchive(this.task);
            
            // Update the task reference
            this.task = updatedTask;
            
            // Notify parent component if callback exists
            if (this.options.onTaskUpdated) {
                this.options.onTaskUpdated(updatedTask);
            }
            
            // Show success message
            const actionText = updatedTask.archived ? 'archived' : 'unarchived';
            new Notice(`Task ${actionText} successfully`);
            
            // Close the modal
            this.close();
            
        } catch (error) {
            console.error('Failed to archive task:', error);
            new Notice('Failed to archive task');
        }
    }

    protected createActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv('button-container');

        // Add "Open note" button
        const openNoteButton = buttonContainer.createEl('button', {
            cls: 'open-note-button',
            text: 'Open note'
        });
        
        openNoteButton.addEventListener('click', async () => {
            await this.openTaskNote();
        });

        // Add "Archive" button
        const archiveButton = buttonContainer.createEl('button', {
            cls: 'archive-button',
            text: this.task.archived ? 'Unarchive' : 'Archive'
        });
        
        archiveButton.addEventListener('click', async () => {
            await this.archiveTask();
        });

        // Spacer to push Save/Cancel to the right
        buttonContainer.createDiv('button-spacer');

        // Save button
        const saveButton = buttonContainer.createEl('button', {
            cls: 'save-button',
            text: 'Save'
        });
        
        saveButton.addEventListener('click', async () => {
            await this.handleSave();
            this.close();
        });

        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            cls: 'cancel-button',
            text: 'Cancel'
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    // Start expanded for edit modal - override parent property
    protected isExpanded = true;
}
