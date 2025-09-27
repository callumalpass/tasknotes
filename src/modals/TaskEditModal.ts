import { App, Notice, TFile, setIcon, setTooltip } from 'obsidian';
import TaskNotesPlugin from '../main';
import { TaskModal } from './TaskModal';
import { TaskInfo } from '../types';
import { getCurrentTimestamp, formatDateForStorage, generateUTCCalendarDates, getUTCStartOfWeek, getUTCEndOfWeek, getUTCStartOfMonth, getUTCEndOfMonth, getTodayLocal, parseDateAsLocal } from '../utils/dateUtils';
import { formatTimestampForDisplay } from '../utils/dateUtils';
import { generateRecurringInstances, extractTaskInfo, calculateTotalTimeSpent, formatTime, updateToNextScheduledOccurrence, sanitizeTags } from '../utils/helpers';
import { splitListPreservingLinksAndQuotes } from '../utils/stringSplit';
import { ReminderContextMenu } from '../components/ReminderContextMenu';
import { renderProjectLinks, type LinkServices } from '../ui/renderers/linkRenderer';

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
    private initialBlockedBy: string[] = [];
    private initialBlockingPaths: string[] = [];
    private pendingBlockingUpdates: { added: string[]; removed: string[]; raw: Record<string, string> } = { added: [], removed: [], raw: {} };
    private unresolvedBlockingEntries: string[] = [];

    constructor(app: App, plugin: TaskNotesPlugin, options: TaskEditOptions) {
        super(app, plugin);
        this.task = options.task;
        this.options = options;
    }

    protected getCurrentTaskPath(): string | undefined {
        return this.task.path;
    }


    getModalTitle(): string {
        return this.t('modals.taskEdit.title');
    }

    protected isEditMode(): boolean {
        return true;
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
            ? sanitizeTags(this.task.tags.filter(tag => tag !== this.plugin.settings.taskTag).join(', '))
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

        // Initialize reminders
        this.reminders = this.task.reminders ? [...this.task.reminders] : [];

        this.details = this.normalizeDetails(this.details);
        this.originalDetails = this.details;

        this.blockedByItems = (this.task.blockedBy ?? []).map(raw => this.createDependencyItemFromRaw(raw, this.task.path));
        this.initialBlockedBy = this.blockedByItems.map(item => item.raw);

        this.blockingItems = (this.task.blocking ?? []).map(path => this.createDependencyItemFromPath(path));
        this.initialBlockingPaths = this.blockingItems
            .filter(item => item.path)
            .map(item => item.path!);
        this.pendingBlockingUpdates = { added: [], removed: [], raw: {} };
        this.unresolvedBlockingEntries = [];

        // Initialize user fields from frontmatter
        await this.initializeUserFields();
    }

    private async initializeUserFields(): Promise<void> {
        try {
            // Get the file and read its frontmatter
            const file = this.app.vault.getAbstractFileByPath(this.task.path);
            if (!file || !(file instanceof TFile)) {
                return;
            }

            const metadata = this.app.metadataCache.getFileCache(file);
            const frontmatter = metadata?.frontmatter;

            if (!frontmatter) {
                return;
            }

            // Load user field values from frontmatter
            const userFieldConfigs = this.plugin.settings?.userFields || [];
            for (const field of userFieldConfigs) {
                if (!field || !field.key) continue;

                const value = frontmatter[field.key];
                if (value !== undefined) {
                    this.userFields[field.key] = value;
                }
            }
        } catch (error) {
            console.error('Error initializing user fields:', error);
        }
    }

    private arraysEqual(a: string[], b: string[]): boolean {
        if (a.length !== b.length) {
            return false;
        }

        const normalize = (arr: string[]) => arr.map(item => item.trim()).sort();
        const normalizedA = normalize(a);
        const normalizedB = normalize(b);

        for (let i = 0; i < normalizedA.length; i++) {
            if (normalizedA[i] !== normalizedB[i]) {
                return false;
            }
        }

        return true;
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

    protected showReminderContextMenu(event: MouseEvent): void {
        // Override parent method to use the actual task with its path
        // Update the task object with current form values before showing menu
        const currentTask: TaskInfo = {
            ...this.task,
            title: this.title,
            due: this.dueDate,
            scheduled: this.scheduledDate,
            reminders: this.reminders
        };
        
        const menu = new ReminderContextMenu(
            this.plugin,
            currentTask, // Use task with current form values and correct path
            event.target as HTMLElement,
            (updatedTask: TaskInfo) => {
                this.reminders = updatedTask.reminders || [];
                this.updateReminderIconState();
            }
        );
        
        menu.show(event);
    }

    async onOpen() {
        // Clear any previous completion changes
        this.completedInstancesChanges.clear();
        
        // Refresh task data from file before opening
        await this.refreshTaskData();
        
        this.containerEl.addClass('tasknotes-plugin', 'minimalist-task-modal');
        
        // Set the modal title using the standard Obsidian approach (preserves close button)
        this.titleEl.setText(this.getModalTitle());
        
        // Add TaskNotes icon at the beginning of the title
        const iconContainer = this.titleEl.createSpan('modal-header-icon');
        setIcon(iconContainer, 'tasknotes-simple');
        this.titleEl.insertBefore(iconContainer, this.titleEl.firstChild);
        
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
            const file = this.app.vault.getAbstractFileByPath(this.task.path);
            if (!file || !(file instanceof TFile)) {
                console.warn('Could not find file for task:', this.task.path);
                return;
            }

            const content = await this.app.vault.read(file);
            this.details = this.extractDetailsFromContent(content);
            this.originalDetails = this.details;

            const cachedTaskInfo = await this.plugin.cacheManager.getTaskInfo(this.task.path);

            if (cachedTaskInfo) {
                cachedTaskInfo.details = this.details;
                this.task = cachedTaskInfo;
                this.options.task = cachedTaskInfo;
            } else {
                const freshTaskInfo = extractTaskInfo(
                    this.app,
                    content,
                    this.task.path,
                    file,
                    this.plugin.fieldMapper,
                    this.plugin.settings.storeTitleInFilename
                );

                if (freshTaskInfo) {
                    freshTaskInfo.details = this.details;
                    this.task = freshTaskInfo;
                    this.options.task = freshTaskInfo;
                }
            }
        } catch (error) {
            console.warn('Could not refresh task data:', error);
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
            calendarLabel.textContent = this.t('modals.taskEdit.sections.completions');
            
            const calendarContent = calendarContainer.createDiv('completions-calendar-content');
            this.createRecurringCalendar(calendarContent);
        }
    }

    private createMetadataSection(container: HTMLElement): void {
        this.metadataContainer = container.createDiv('metadata-container');
        
        const metadataLabel = this.metadataContainer.createDiv('detail-label');
        metadataLabel.textContent = this.t('modals.taskEdit.sections.taskInfo');
        
        const metadataContent = this.metadataContainer.createDiv('metadata-content');
        
        // Total tracked time
        const totalTimeSpent = calculateTotalTimeSpent(this.task.timeEntries || []);
        if (totalTimeSpent > 0) {
            const timeDiv = metadataContent.createDiv('metadata-item');
            timeDiv.createSpan('metadata-key').textContent = this.t('modals.taskEdit.metadata.totalTrackedTime') + ' ';
            timeDiv.createSpan('metadata-value').textContent = formatTime(totalTimeSpent);
        }
        
        // Created date
        if (this.task.dateCreated) {
            const createdDiv = metadataContent.createDiv('metadata-item');
            createdDiv.createSpan('metadata-key').textContent = this.t('modals.taskEdit.metadata.created') + ' ';
            createdDiv.createSpan('metadata-value').textContent = formatTimestampForDisplay(this.task.dateCreated);
        }
        
        // Modified date
        if (this.task.dateModified) {
            const modifiedDiv = metadataContent.createDiv('metadata-item');
            modifiedDiv.createSpan('metadata-key').textContent = this.t('modals.taskEdit.metadata.modified') + ' ';
            modifiedDiv.createSpan('metadata-value').textContent = formatTimestampForDisplay(this.task.dateModified);
        }
        
        // File path (if available)
        if (this.task.path) {
            const pathDiv = metadataContent.createDiv('metadata-item');
            pathDiv.createSpan('metadata-key').textContent = this.t('modals.taskEdit.metadata.file') + ' ';
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
        const locale = this.plugin.i18n.getCurrentLocale() || 'en';
        const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' });
        monthLabel.textContent = monthFormatter.format(displayDate);
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
        const recurringDateStrings = new Set(recurringDates.map(d => formatDateForStorage(d)));
        
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
            const dayStr = formatDateForStorage(day);
            // FIX: Use UTC-to-UTC comparison instead of mixing local and UTC dates
            const isCurrentMonth = day.getUTCMonth() === displayDate.getUTCMonth();
            const isRecurring = recurringDateStrings.has(dayStr);
            const isCompleted = completedInstances.has(dayStr);
            
            const dayElement = grid.createDiv('recurring-calendar__day');
            // FIX: Use UTC date method instead of timezone-sensitive format()
            dayElement.textContent = String(day.getUTCDate());
            
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
            // FIX: Use UTC methods to prevent timezone drift
            const prevMonth = new Date(displayDate);
            prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
            this.renderCalendarMonth(container, prevMonth);
        });
        
        nextButton.addEventListener('click', () => {
            // FIX: Use UTC methods to prevent timezone drift
            const nextMonth = new Date(displayDate);
            nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
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
            new Notice(this.t('modals.taskEdit.notices.titleRequired'));
            return;
        }

        try {
            const changes = this.getChanges();
            const hasBlockingChanges = this.pendingBlockingUpdates.added.length > 0 || this.pendingBlockingUpdates.removed.length > 0;
            const hasTaskChanges = Object.keys(changes).length > 0;

            if (this.unresolvedBlockingEntries.length > 0 && !hasBlockingChanges) {
                new Notice(this.t('modals.taskEdit.notices.blockingUnresolved', {
                    entries: this.unresolvedBlockingEntries.join(', ')
                }));
                this.unresolvedBlockingEntries = [];
            }

            if (!hasTaskChanges && !hasBlockingChanges) {
                new Notice(this.t('modals.taskEdit.notices.noChanges'));
                this.close();
                return;
            }

            let updatedTask = this.task;

            if (hasTaskChanges) {
                updatedTask = await this.plugin.taskService.updateTask(this.task, changes);
                this.task = updatedTask;
                if (Object.prototype.hasOwnProperty.call(changes as any, 'details')) {
                    const updatedDetails = ((changes as any).details ?? '').toString();
                    this.details = updatedDetails;
                    this.originalDetails = updatedDetails;
                }
            }

            if (hasBlockingChanges) {
                await this.plugin.taskService.updateBlockingRelationships(
                    updatedTask,
                    this.pendingBlockingUpdates.added,
                    this.pendingBlockingUpdates.removed,
                    this.pendingBlockingUpdates.raw
                );

                const refreshed = await this.plugin.cacheManager.getTaskInfo(updatedTask.path);
                if (refreshed) {
                    updatedTask = refreshed;
                    this.task = refreshed;
                }
            }

            if (this.unresolvedBlockingEntries.length > 0) {
                new Notice(this.t('modals.taskEdit.notices.blockingUnresolved', {
                    entries: this.unresolvedBlockingEntries.join(', ')
                }));
            }

            if (this.options.onTaskUpdated) {
                this.options.onTaskUpdated(updatedTask);
            }

            if (hasTaskChanges) {
                new Notice(this.t('modals.taskEdit.notices.updateSuccess', { title: updatedTask.title }));
            } else if (hasBlockingChanges) {
                new Notice(this.t('modals.taskEdit.notices.dependenciesUpdateSuccess'));
            }

            this.pendingBlockingUpdates = { added: [], removed: [], raw: {} };
            this.unresolvedBlockingEntries = [];

        } catch (error) {
            console.error('Failed to update task:', error);
            const message = error instanceof Error && error.message ? error.message : String(error);
            new Notice(this.t('modals.taskEdit.notices.updateFailure', { message }));
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
        const newProjects = splitListPreservingLinksAndQuotes(this.projects);
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

        // Compare reminders
        const oldReminders = this.task.reminders || [];
        const newReminders = this.reminders || [];
        
        if (JSON.stringify(newReminders) !== JSON.stringify(oldReminders)) {
            changes.reminders = newReminders.length > 0 ? newReminders : undefined;
        }

        const newBlockedEntries = this.blockedByItems.map(item => item.raw);
        if (!this.arraysEqual(newBlockedEntries, this.initialBlockedBy)) {
            changes.blockedBy = newBlockedEntries.length > 0 ? newBlockedEntries : undefined;
        }

        const resolvedBlocking = new Map<string, string>();
        const unresolvedEntries: string[] = [];

        this.blockingItems.forEach(item => {
            if (item.path) {
                resolvedBlocking.set(item.path, item.raw);
            } else {
                unresolvedEntries.push(item.raw);
            }
        });

        const newBlockingPaths = Array.from(resolvedBlocking.keys());
        const originalPaths = new Set(this.initialBlockingPaths);
        const newPathSet = new Set(newBlockingPaths);

        const addedPaths = newBlockingPaths.filter(path => !originalPaths.has(path));
        const removedPaths = this.initialBlockingPaths.filter(path => !newPathSet.has(path));

        const rawAdditions: Record<string, string> = {};
        for (const path of addedPaths) {
            const raw = resolvedBlocking.get(path);
            if (raw) {
                rawAdditions[path] = raw;
            }
        }

        this.pendingBlockingUpdates = {
            added: addedPaths,
            removed: removedPaths,
            raw: rawAdditions
        };
        this.unresolvedBlockingEntries = unresolvedEntries;

        const normalizedDetails = this.normalizeDetails(this.details);
        const normalizedOriginal = this.normalizeDetails(this.originalDetails);
        if (normalizedDetails !== normalizedOriginal) {
            changes.details = normalizedDetails.trimEnd();
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
            
            // If task has recurrence, update scheduled date to next uncompleted occurrence
            if (this.task.recurrence) {
                const tempTask: TaskInfo = { ...this.task, ...changes };
                const nextDates = updateToNextScheduledOccurrence(tempTask, this.plugin.settings.maintainDueDateOffsetInRecurring);
                if (nextDates.scheduled) {
                    changes.scheduled = nextDates.scheduled;
                }
                if (nextDates.due) {
                    changes.due = nextDates.due;
                }
            }
        }

        // Compare user fields and add to changes if modified
        const userFieldsChanges = this.getUserFieldChanges();
        if (Object.keys(userFieldsChanges).length > 0) {
            (changes as any).customFrontmatter = userFieldsChanges;
        }

        // Always update modified timestamp if there are changes
        if (Object.keys(changes).length > 0) {
            changes.dateModified = getCurrentTimestamp();
        }

        return changes;
    }

    private getUserFieldChanges(): Record<string, any> {
        const userFieldsChanges: Record<string, any> = {};
        
        try {
            // Get current frontmatter values
            const file = this.app.vault.getAbstractFileByPath(this.task.path);
            if (!file || !(file instanceof TFile)) {
                return userFieldsChanges;
            }

            const metadata = this.app.metadataCache.getFileCache(file);
            const frontmatter: Record<string, any> = metadata?.frontmatter || {};

            // Compare current values with original frontmatter
            const userFieldConfigs = this.plugin.settings?.userFields || [];
            for (const field of userFieldConfigs) {
                if (!field || !field.key) continue;

                const newValue = this.userFields[field.key];
                const oldValue = frontmatter[field.key];

                // Check if values are different
                if (this.isDifferent(newValue, oldValue)) {
                    // Set to null if empty value, otherwise use the new value
                    userFieldsChanges[field.key] = (newValue === null || newValue === undefined || newValue === '') ? 
                        null : newValue;
                }
            }
        } catch (error) {
            console.error('Error comparing user fields:', error);
        }

        return userFieldsChanges;
    }

    private isDifferent(newValue: any, oldValue: any): boolean {
        // Handle null/undefined/empty comparisons
        const normalizeEmpty = (value: any) => {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            return value;
        };

        const normalizedNew = normalizeEmpty(newValue);
        const normalizedOld = normalizeEmpty(oldValue);

        // For arrays (list fields), compare as JSON strings
        if (Array.isArray(normalizedNew) || Array.isArray(normalizedOld)) {
            return JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOld);
        }

        // For other values, direct comparison
        return normalizedNew !== normalizedOld;
    }

    private async openTaskNote(): Promise<void> {
        try {
            // Get the file from the task path
            const file = this.app.vault.getAbstractFileByPath(this.task.path);
            
            if (!file) {
                new Notice(this.t('modals.taskEdit.notices.fileMissing', { path: this.task.path }));
                return;
            }

            // Open the file in a new leaf
            const leaf = this.app.workspace.getLeaf(true);
            await leaf.openFile(file as TFile);
            
            // Close the modal
            this.close();
            
        } catch (error) {
            console.error('Failed to open task note:', error);
            new Notice(this.t('modals.taskEdit.notices.openNoteFailure'));
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
            const actionKey = updatedTask.archived
                ? 'modals.taskEdit.archiveAction.archived'
                : 'modals.taskEdit.archiveAction.unarchived';
            const actionText = this.t(actionKey);
            new Notice(this.t('modals.taskEdit.notices.archiveSuccess', { action: actionText }));
            
            // Close the modal
            this.close();
            
        } catch (error) {
            console.error('Failed to archive task:', error);
            new Notice(this.t('modals.taskEdit.notices.archiveFailure'));
        }
    }

    protected createActionButtons(container: HTMLElement): void {
        const buttonContainer = container.createDiv('button-container');

        // Add "Open note" button
        const openNoteButton = buttonContainer.createEl('button', {
            cls: 'open-note-button',
            text: this.t('modals.task.buttons.openNote')
        });
        
        openNoteButton.addEventListener('click', async () => {
            await this.openTaskNote();
        });

        // Add "Archive" button
        const archiveButton = buttonContainer.createEl('button', {
            cls: 'archive-button',
            text: this.task.archived
                ? this.t('modals.taskEdit.buttons.unarchive')
                : this.t('modals.taskEdit.buttons.archive')
        });
        
        archiveButton.addEventListener('click', async () => {
            await this.archiveTask();
        });

        // Spacer to push Save/Cancel to the right
        buttonContainer.createDiv('button-spacer');

        // Save button
        const saveButton = buttonContainer.createEl('button', {
            cls: 'save-button',
            text: this.t('modals.task.buttons.save')
        });
        
        saveButton.addEventListener('click', async () => {
            saveButton.disabled = true;
            try {
                await this.handleSave();
                this.close();
            } finally {
                saveButton.disabled = false;
            }
        });

        // Cancel button
        const cancelButton = buttonContainer.createEl('button', {
            cls: 'cancel-button',
            text: this.t('common.cancel')
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    protected renderProjectsList(): void {
        if (!this.projectsList) return;
        
        this.projectsList.empty();

        if (this.selectedProjectFiles.length === 0) {
            return;
        }

        // Create LinkServices for the renderProjectLinks function
        const linkServices: LinkServices = {
            metadataCache: this.app.metadataCache,
            workspace: this.app.workspace
        };

        this.selectedProjectFiles.forEach(file => {
            const projectItem = this.projectsList.createDiv({ cls: 'task-project-item' });
            
            // Info container
            const infoEl = projectItem.createDiv({ cls: 'task-project-info' });
            
            // Create clickable project name using existing renderProjectLinks functionality
            const nameEl = infoEl.createDiv({ cls: 'task-project-name clickable-project' });
            
            // Use the file name as a wikilink format for consistent handling
            const projectAsWikilink = `[[${file.path}|${file.name}]]`;
            renderProjectLinks(nameEl, [projectAsWikilink], linkServices);
            
            // File path (if different from name)
            if (file.path !== file.name) {
                const pathEl = infoEl.createDiv({ cls: 'task-project-path' });
                pathEl.textContent = file.path;
            }
            
            // Remove button
            const removeBtn = projectItem.createEl('button', { 
                cls: 'task-project-remove',
                text: '×'
            });
            setTooltip(removeBtn, this.t('modals.task.projectsRemoveTooltip'), { placement: 'top' });
            removeBtn.addEventListener('click', () => {
                this.removeProject(file);
            });
        });
    }

    // Start expanded for edit modal - override parent property
    protected isExpanded = true;
}
