import { TFile, ItemView, WorkspaceLeaf, EventRef, Setting } from 'obsidian';
import { format, addDays, startOfWeek, endOfWeek, isToday, isSameDay } from 'date-fns';
import { formatDateForStorage, createUTCDateFromLocalCalendarDate, getTodayLocal } from '../utils/dateUtils';
import TaskNotesPlugin from '../main';
import { 
    AGENDA_VIEW_TYPE,
    EVENT_DATA_CHANGED,
    EVENT_DATE_SELECTED,
    EVENT_TASK_UPDATED,
    TaskInfo, 
    NoteInfo,
    FilterQuery,
    SavedView
} from '../types';
// No helper functions needed from helpers
import { createTaskCard, updateTaskCard } from '../ui/TaskCard';
import { createNoteCard } from '../ui/NoteCard';
import { FilterBar } from '../ui/FilterBar';
import { FilterService } from '../services/FilterService';

export class AgendaView extends ItemView {
    plugin: TaskNotesPlugin;
    
    // View settings
    private daysToShow = 7;
    private groupByDate = true;
    private startDate: Date;
    private showOverdueOnToday = true;
    private showNotes = true;
    
    // Filter system
    private filterBar: FilterBar | null = null;
    private currentQuery: FilterQuery;
    
    // Event listeners
    private listeners: EventRef[] = [];
    private functionListeners: (() => void)[] = [];
    
    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.startDate = new Date(plugin.selectedDate);
        
        // Initialize with default query - will be properly set when plugin services are ready
        this.currentQuery = {
            type: 'group',
            id: 'temp',
            conjunction: 'and',
            children: [],
            sortKey: 'scheduled',
            sortDirection: 'asc',
            groupKey: 'none' // Agenda groups by date internally
        };
        
        // Register event listeners
        this.registerEvents();
    }
    
    registerEvents(): void {
        // Clean up any existing listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.listeners = [];
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        this.functionListeners = [];
        
        // Listen for data changes
        const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, async () => {
            this.refresh();
            // Update FilterBar options when data changes (new properties, contexts, etc.)
            if (this.filterBar) {
                const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                this.filterBar.updateFilterOptions(updatedFilterOptions);
            }
        });
        this.listeners.push(dataListener);
        
        // Listen for date selection changes
        const dateListener = this.plugin.emitter.on(EVENT_DATE_SELECTED, (date: Date) => {
            this.startDate = new Date(date);
            this.updatePeriodDisplay();
            this.refresh();
        });
        this.listeners.push(dateListener);
        
        // Listen for individual task updates for granular DOM updates
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async ({ path, originalTask, updatedTask }) => {
            // For agenda view, since items are organized by date and can move between days,
            // it's safer to do a refresh rather than try to update in place
            this.refresh();
            // Update FilterBar options when tasks are updated (may have new properties, contexts, etc.)
            if (this.filterBar) {
                const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                this.filterBar.updateFilterOptions(updatedFilterOptions);
            }
        });
        this.listeners.push(taskUpdateListener);
        
        // Listen for filter service data changes
        const filterDataListener = this.plugin.filterService.on('data-changed', () => {
            this.refresh();
        });
        this.functionListeners.push(filterDataListener);
    }
    
    getViewType(): string {
        return AGENDA_VIEW_TYPE;
    }
    
    getDisplayText(): string {
        return 'Agenda';
    }
    
    getIcon(): string {
        return 'calendar-clock';
    }
    
    async onOpen() {
        // Wait for the plugin to be fully initialized before proceeding
        await this.plugin.onReady();
        
        // Wait for migration to complete before initializing UI
        await this.plugin.waitForMigration();
        
        // Load saved filter state
        const savedQuery = this.plugin.viewStateManager.getFilterState(AGENDA_VIEW_TYPE);
        if (savedQuery) {
            this.currentQuery = savedQuery;
        }
        
        const contentEl = this.contentEl;
        contentEl.empty();
        
        // Add container
        const container = contentEl.createDiv({ cls: 'tasknotes-plugin agenda-view' });
        
        // Show loading indicator
        this.showLoadingIndicator();
        
        // Render the view
        await this.renderView(container);
        
        // Hide loading indicator
        this.hideLoadingIndicator();
        
        // Register keyboard navigation
    }
    
    async onClose() {
        // Remove event listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        
        // Clean up FilterBar
        if (this.filterBar) {
            this.filterBar.destroy();
            this.filterBar = null;
        }
        
        // Clean up
        this.contentEl.empty();
    }
    
    private async renderView(container: HTMLElement) {
        // Clear existing content
        container.empty();
        
        // Create controls
        await this.createAgendaControls(container);
        
        // Create agenda content
        await this.renderAgendaContent(container);
    }
    
    private async createAgendaControls(container: HTMLElement) {
        const controlsContainer = container.createDiv({ cls: 'agenda-view__controls' });
        
        // Header section with date range and navigation (like tasks view)
        const headerSection = controlsContainer.createDiv({ cls: 'agenda-view__header' });
        
        const headerContent = headerSection.createDiv({ cls: 'agenda-view__header-content' });
        
        // Left section: Navigation controls
        const navSection = headerContent.createDiv({ cls: 'agenda-view__nav-section' });
        
        const prevButton = navSection.createEl('button', {
            cls: 'agenda-view__nav-button agenda-view__nav-button--prev',
            text: '‹',
            attr: {
                'aria-label': 'Previous period',
                'title': 'Previous period'
            }
        });
        
        const nextButton = navSection.createEl('button', {
            cls: 'agenda-view__nav-button agenda-view__nav-button--next',
            text: '›',
            attr: {
                'aria-label': 'Next period',
                'title': 'Next period'
            }
        });
        
        // Center section: Current period display
        const titleSection = headerContent.createDiv({ cls: 'agenda-view__title-section' });
        titleSection.createDiv({ 
            cls: 'agenda-view__period-title',
            text: this.getCurrentPeriodText()
        });
        
        // Right section: Today button
        const actionsSection = headerContent.createDiv({ cls: 'agenda-view__actions-section' });
        
        prevButton.addEventListener('click', () => {
            this.navigateToPreviousPeriod();
        });
        
        nextButton.addEventListener('click', () => {
            this.navigateToNextPeriod();
        });
        
        // Today button
        const todayButton = actionsSection.createEl('button', {
            text: 'Today',
            cls: 'agenda-view__today-button',
            attr: {
                'aria-label': 'Go to today',
                'title': 'Go to today'
            }
        });
        
        todayButton.addEventListener('click', () => {
            const today = getTodayLocal();
            this.startDate = today;
            this.plugin.setSelectedDate(today);
            this.updatePeriodDisplay();
            this.refresh();
        });
        
        // FilterBar section (like tasks view)
        const filterBarContainer = controlsContainer.createDiv({ cls: 'agenda-view__filter-container' });
        
        // Wait for cache to be initialized with actual data
        await this.waitForCacheReady();
        
        // Initialize with default query from FilterService
        this.currentQuery = this.plugin.filterService.createDefaultQuery();
        this.currentQuery.sortKey = 'scheduled';
        this.currentQuery.sortDirection = 'asc';
        this.currentQuery.groupKey = 'none';
        
        // Load saved filter state if it exists
        const savedQuery = this.plugin.viewStateManager.getFilterState(AGENDA_VIEW_TYPE);
        if (savedQuery) {
            this.currentQuery = savedQuery;
        }
        
        // Get filter options from FilterService
        const filterOptions = await this.plugin.filterService.getFilterOptions();
        
        // Create new FilterBar
        this.filterBar = new FilterBar(
            this.app,
            filterBarContainer,
            this.currentQuery,
            filterOptions
        );
        
        // Get saved views for the FilterBar
        const savedViews = this.plugin.viewStateManager.getSavedViews();
        this.filterBar.updateSavedViews(savedViews);
        
        // Listen for saved view events
        this.filterBar.on('saveView', ({ name, query, viewOptions }) => {
            this.plugin.viewStateManager.saveView(name, query, viewOptions);
            // Don't update here - the ViewStateManager event will handle it
        });
        
        this.filterBar.on('deleteView', (viewId: string) => {
            this.plugin.viewStateManager.deleteView(viewId);
            // Don't update here - the ViewStateManager event will handle it
        });

        // Listen for view options load events
        this.filterBar.on('loadViewOptions', (viewOptions: {[key: string]: boolean}) => {
            this.applyViewOptions(viewOptions);
        });

        // Listen for global saved views changes
        this.plugin.viewStateManager.on('saved-views-changed', (updatedViews: readonly SavedView[]) => {
            this.filterBar?.updateSavedViews(updatedViews);
        });
        
        this.filterBar.on('reorderViews', (fromIndex: number, toIndex: number) => {
            this.plugin.viewStateManager.reorderSavedViews(fromIndex, toIndex);
        });
        
        this.filterBar.on('manageViews', () => {
            console.log('Manage views requested');
        });
        
        
        // Listen for filter changes
        this.filterBar.on('queryChange', async (newQuery: FilterQuery) => {
            this.currentQuery = newQuery;
            // Save the filter state (but always update date range based on current view)
            const queryToSave = newQuery;
            await this.plugin.viewStateManager.setFilterState(AGENDA_VIEW_TYPE, queryToSave);
            this.refresh();
        });

        // Set up view-specific options
        this.setupViewOptions();
    }

    /**
     * Set up view-specific options for the FilterBar
     */
    private setupViewOptions(): void {
        if (!this.filterBar) return;

        const options = [
            {
                id: 'showOverdueOnToday',
                label: 'Show overdue on today',
                value: this.showOverdueOnToday,
                onChange: (value: boolean) => {
                    this.showOverdueOnToday = value;
                    this.refresh();
                }
            },
            {
                id: 'showNotes',
                label: 'Show notes',
                value: this.showNotes,
                onChange: (value: boolean) => {
                    this.showNotes = value;
                    this.refresh();
                }
            }
        ];

        this.filterBar.setViewOptions(options);
    }

    /**
     * Apply view options from a loaded saved view
     */
    private applyViewOptions(viewOptions: {[key: string]: boolean}): void {
        // Apply the loaded view options to the internal state
        if (viewOptions.hasOwnProperty('showOverdueOnToday')) {
            this.showOverdueOnToday = viewOptions.showOverdueOnToday;
        }
        if (viewOptions.hasOwnProperty('showNotes')) {
            this.showNotes = viewOptions.showNotes;
        }

        // Update the view options in the FilterBar to reflect the loaded state
        this.setupViewOptions();
        
        // Refresh the view to apply the changes
        this.refresh();
    }
    
    /**
     * Render period selector as custom button in FilterBar
     */
    private renderPeriodSelector(container: HTMLElement): void {
        const periodSelect = container.createEl('select', { cls: 'agenda-view__period-select' });
        const periods = [
            { value: '7', text: '7 days' },
            { value: '14', text: '14 days' },
            { value: '30', text: '30 days' },
            { value: 'week', text: 'This week' },
        ];
        
        periods.forEach(period => {
            const option = periodSelect.createEl('option', { 
                value: period.value, 
                text: period.text 
            });
            if ((period.value === '7' && this.daysToShow === 7) ||
                (period.value === 'week' && this.daysToShow === -1)) {
                option.selected = true;
            }
        });
        
        periodSelect.addEventListener('change', () => {
            const value = periodSelect.value;
            if (value === 'week') {
                this.daysToShow = -1; // Special value for week view
            } else {
                this.daysToShow = parseInt(value);
            }
            
            // Date range is handled internally by getAgendaDates()
            
            this.refresh();
        });
    }
    
    
    /**
     * Get date range for FilterService query
     */
    private getDateRange(): { start: string; end: string } {
        const dates = this.getAgendaDates();
        return FilterService.createDateRangeFromDates(dates);
    }

    /**
     * Add notes to agenda data by fetching notes for each specific date
     */
    private async addNotesToAgendaData(agendaData: Array<{date: Date; tasks: TaskInfo[]}>): Promise<Array<{date: Date; tasks: TaskInfo[]; notes: NoteInfo[]}>> {
        if (this.plugin.settings.disableNoteIndexing || !this.showNotes) {
            return agendaData.map(dayData => ({ ...dayData, notes: [] }));
        }

        // Use Promise.all to fetch notes for all dates in parallel for optimal performance
        const notesPromises = agendaData.map(async (dayData) => {
            const notesForDate = await this.plugin.cacheManager.getNotesForDate(dayData.date);
            return { ...dayData, notes: notesForDate };
        });
        
        return Promise.all(notesPromises);
    }
    
    private async renderAgendaContent(container: HTMLElement) {
        // Find existing content container or create new one
        let contentContainer = container.querySelector('.agenda-view__content') as HTMLElement;
        if (!contentContainer) {
            contentContainer = container.createDiv({ cls: 'agenda-view__content' });
        }
        
        try {
            const dates = this.getAgendaDates();
            
            // Use FilterService to get tasks for each date (properly handles recurring tasks)
            const agendaData: Array<{date: Date; tasks: TaskInfo[]}> = [];
            
            for (const date of dates) {
                // Use FilterService's getTasksForDate which properly handles recurring tasks
                const tasksForDate = await this.plugin.filterService.getTasksForDate(
                    date,
                    this.currentQuery,
                    this.showOverdueOnToday
                );
                
                agendaData.push({ date, tasks: tasksForDate });
            }
            
            // Get notes separately and add them to the agenda data
            const agendaDataWithNotes = await this.addNotesToAgendaData(agendaData);
            
            // Use DOMReconciler-based rendering
            if (this.groupByDate) {
                this.renderGroupedAgendaWithReconciler(contentContainer, agendaDataWithNotes);
            } else {
                this.renderFlatAgendaWithReconciler(contentContainer, agendaDataWithNotes);
            }
        } catch (error) {
            console.error('Error rendering agenda content:', error);
            contentContainer.empty();
            const errorEl = contentContainer.createDiv({ cls: 'agenda-view__error' });
            errorEl.createSpan({ text: 'Error loading agenda. Please try refreshing.' });
        }
    }
    
    
    
    
    
    
    
    /**
     * Render grouped agenda using DOMReconciler for efficient updates
     */
    private renderGroupedAgendaWithReconciler(container: HTMLElement, agendaData: Array<{date: Date, tasks: TaskInfo[], notes: NoteInfo[]}>) {
        // Create flattened list of all items with their day grouping
        const allItems: Array<{type: 'day-header' | 'task' | 'note', item: any, date: Date, dayKey: string}> = [];
        
        let hasAnyItems = false;
        agendaData.forEach(dayData => {
            const dateStr = formatDateForStorage(dayData.date);
            
            // Tasks are already filtered by FilterService, no need to re-filter
            const hasItems = dayData.tasks.length > 0 || dayData.notes.length > 0;
            
            if (hasItems) {
                hasAnyItems = true;
                const dayKey = dateStr;
                
                // Add day header
                allItems.push({
                    type: 'day-header',
                    item: dayData,
                    date: dayData.date,
                    dayKey
                });
                
                // Add tasks (already filtered by FilterService)
                dayData.tasks.forEach(task => {
                    allItems.push({
                        type: 'task',
                        item: task,
                        date: dayData.date,
                        dayKey
                    });
                });
                
                // Add notes
                dayData.notes.forEach(note => {
                    allItems.push({
                        type: 'note',
                        item: note,
                        date: dayData.date,
                        dayKey
                    });
                });
            }
        });
        
        if (!hasAnyItems) {
            container.empty();
            const emptyMessage = container.createDiv({ cls: 'agenda-view__empty' });
            new Setting(emptyMessage)
                .setName('No items scheduled')
                .setHeading();
            emptyMessage.createEl('p', { 
                text: 'No items scheduled for this period.',
                cls: 'agenda-view__empty-description'
            });
            const tipMessage = emptyMessage.createEl('p', { cls: 'agenda-view__empty-tip' });
            tipMessage.createEl('span', { text: 'Tip: ' });
            tipMessage.appendChild(document.createTextNode('Create tasks with due or scheduled dates, or add notes to see them here.'));
            return;
        }
        
        // Use DOMReconciler to update the list
        this.plugin.domReconciler.updateList(
            container,
            allItems,
            (item) => `${item.type}-${item.dayKey}-${item.type === 'day-header' ? item.dayKey : (item.item.path || (item.item as any).id || 'unknown')}`,
            (item) => this.createAgendaItemElement(item),
            (element, item) => this.updateAgendaItemElement(element, item)
        );
    }
    
    /**
     * Render flat agenda using DOMReconciler for efficient updates
     */
    private renderFlatAgendaWithReconciler(container: HTMLElement, agendaData: Array<{date: Date, tasks: TaskInfo[], notes: NoteInfo[]}>) {
        // Collect all items with their dates
        const allItems: Array<{type: 'task' | 'note', item: TaskInfo | NoteInfo, date: Date}> = [];
        
        agendaData.forEach(dayData => {
            // Tasks are already filtered by FilterService, no need to re-filter
            dayData.tasks.forEach(task => {
                allItems.push({ type: 'task', item: task, date: dayData.date });
            });
            
            dayData.notes.forEach(note => {
                allItems.push({ type: 'note', item: note, date: dayData.date });
            });
        });
        
        if (allItems.length === 0) {
            container.empty();
            const emptyMessage = container.createDiv({ cls: 'agenda-view__empty' });
            new Setting(emptyMessage)
                .setName('No items found')
                .setHeading();
            emptyMessage.createEl('p', { 
                text: 'No items found for the selected period.',
                cls: 'agenda-view__empty-description'
            });
            return;
        }
        
        // Sort by date
        allItems.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        // Use DOMReconciler to update the list
        this.plugin.domReconciler.updateList(
            container,
            allItems,
            (item) => `${item.type}-${item.item.path || (item.item as any).id || 'unknown'}`,
            (item) => this.createFlatAgendaItemElement(item),
            (element, item) => this.updateFlatAgendaItemElement(element, item)
        );
    }
    
    /**
     * Create agenda item element for reconciler
     */
    private createAgendaItemElement(item: {type: 'day-header' | 'task' | 'note', item: any, date: Date, dayKey: string}): HTMLElement {
        if (item.type === 'day-header') {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'agenda-view__day-header';
            
            const headerText = dayHeader.createDiv({ cls: 'agenda-view__day-header-text' });
            const dayName = format(item.date, 'EEEE');
            const dateFormatted = format(item.date, 'MMMM d');
            
            if (isToday(item.date)) {
                headerText.createSpan({ cls: 'agenda-view__day-name agenda-view__day-name--today', text: 'Today' });
                headerText.createSpan({ cls: 'agenda-view__day-date', text: ` • ${dateFormatted}` });
            } else {
                headerText.createSpan({ cls: 'agenda-view__day-name', text: dayName });
                headerText.createSpan({ cls: 'agenda-view__day-date', text: ` • ${dateFormatted}` });
            }
            
            // Item count badge
            const itemCount = item.item.tasks.length + item.item.notes.length;
            dayHeader.createDiv({ cls: 'agenda-view__item-count', text: `${itemCount}` });
            
            return dayHeader;
        } else if (item.type === 'task') {
            return this.createTaskItemElement(item.item as TaskInfo, item.date);
        } else {
            return this.createNoteItemElement(item.item as NoteInfo, item.date);
        }
    }
    
    /**
     * Update agenda item element for reconciler
     */
    private updateAgendaItemElement(element: HTMLElement, item: {type: 'day-header' | 'task' | 'note', item: any, date: Date, dayKey: string}): void {
        if (item.type === 'day-header') {
            // Update item count badge
            const countBadge = element.querySelector('.agenda-view__item-count');
            if (countBadge) {
                const itemCount = item.item.tasks.length + item.item.notes.length;
                countBadge.textContent = `${itemCount}`;
            }
        } else if (item.type === 'task') {
            updateTaskCard(element, item.item as TaskInfo, this.plugin, {
                showDueDate: !this.groupByDate,
                showCheckbox: false,
                showTimeTracking: true,
                showRecurringControls: true,
                groupByDate: this.groupByDate,
                targetDate: item.date
            });
        }
        // Note updates are handled automatically by the note card structure
    }
    
    /**
     * Create flat agenda item element for reconciler
     */
    private createFlatAgendaItemElement(item: {type: 'task' | 'note', item: TaskInfo | NoteInfo, date: Date}): HTMLElement {
        if (item.type === 'task') {
            return this.createTaskItemElement(item.item as TaskInfo, item.date);
        } else {
            return this.createNoteItemElement(item.item as NoteInfo, item.date);
        }
    }
    
    /**
     * Update flat agenda item element for reconciler
     */
    private updateFlatAgendaItemElement(element: HTMLElement, item: {type: 'task' | 'note', item: TaskInfo | NoteInfo, date: Date}): void {
        if (item.type === 'task') {
            updateTaskCard(element, item.item as TaskInfo, this.plugin, {
                showDueDate: !this.groupByDate,
                showCheckbox: false,
                showTimeTracking: true,
                showRecurringControls: true,
                groupByDate: this.groupByDate,
                targetDate: item.date
            });
        }
        // Note updates are handled automatically by the note card structure
    }
    
    /**
     * Create task item element
     */
    private createTaskItemElement(task: TaskInfo, date?: Date): HTMLElement {
        const taskCard = createTaskCard(task, this.plugin, {
            showDueDate: !this.groupByDate,
            showCheckbox: false,
            showTimeTracking: true,
            showRecurringControls: true,
            groupByDate: this.groupByDate,
            targetDate: date
        });
        
        // Add completion status class if task is completed
        if (this.plugin.statusManager.isCompletedStatus(task.status)) {
            taskCard.classList.add('done');
        }
        
        // Add drag functionality
        this.addDragHandlers(taskCard, task);
        
        return taskCard;
    }
    
    /**
     * Create note item element
     */
    private createNoteItemElement(note: NoteInfo, date?: Date): HTMLElement {
        const noteCard = createNoteCard(note, this.plugin, {
            showCreatedDate: false,
            showTags: true,
            showPath: false,
            maxTags: 3,
            showDailyNoteBadge: false
        });
        
        // Add date if not grouping by date
        if (!this.groupByDate && date) {
            noteCard.createSpan({ 
                cls: 'agenda-view__note-date', 
                text: format(date, 'MMM d') 
            });
        }
        
        return noteCard;
    }
    
    /**
     * Add drag handlers to task cards for dragging to calendar
     */
    private addDragHandlers(card: HTMLElement, task: TaskInfo): void {
        // Use the centralized drag drop manager for FullCalendar compatibility
        this.plugin.dragDropManager.makeTaskCardDraggable(card, task.path);
    }

    private addHoverPreview(element: HTMLElement, filePath: string) {
        element.addEventListener('mouseover', (event) => {
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                this.app.workspace.trigger('hover-link', {
                    event,
                    source: 'tasknotes-agenda',
                    hoverParent: this,
                    targetEl: element,
                    linktext: filePath,
                    sourcePath: filePath
                });
            }
        });
    }
    
    private openFile(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
            this.app.workspace.getLeaf(false).openFile(file);
        }
    }
    
    private getAgendaDates(): Date[] {
        const dates: Date[] = [];
        
        if (this.daysToShow === -1) {
            // Week view - show current week based on startDate
            const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
            const weekStartOptions = { weekStartsOn: firstDaySetting as 0 | 1 | 2 | 3 | 4 | 5 | 6 };
            const weekStart = startOfWeek(this.startDate, weekStartOptions);
            const weekEnd = endOfWeek(this.startDate, weekStartOptions);
            
            let currentDate = weekStart;
            while (currentDate <= weekEnd) {
                // Create UTC date that represents this calendar date
                const normalizedDate = createUTCDateFromLocalCalendarDate(currentDate);
                dates.push(normalizedDate);
                currentDate = addDays(currentDate, 1);
            }
        } else {
            // Fixed number of days starting from startDate
            for (let i = 0; i < this.daysToShow; i++) {
                const targetDate = addDays(this.startDate, i);
                // Create UTC date that represents this calendar date
                const normalizedDate = createUTCDateFromLocalCalendarDate(targetDate);
                dates.push(normalizedDate);
            }
        }
        
        return dates;
    }
    
    private navigateToPreviousPeriod() {
        if (this.daysToShow === -1) {
            // Week view - go to previous week
            this.startDate = addDays(this.startDate, -7);
        } else {
            // Fixed days - go back by the number of days shown
            this.startDate = addDays(this.startDate, -this.daysToShow);
        }
        
        // Date range is handled internally by getAgendaDates()
        
        this.updatePeriodDisplay();
        this.refresh();
    }
    
    private navigateToNextPeriod() {
        if (this.daysToShow === -1) {
            // Week view - go to next week
            this.startDate = addDays(this.startDate, 7);
        } else {
            // Fixed days - go forward by the number of days shown
            this.startDate = addDays(this.startDate, this.daysToShow);
        }
        
        // Date range is handled internally by getAgendaDates()
        
        this.updatePeriodDisplay();
        this.refresh();
    }
    
    private updatePeriodDisplay(): void {
        const currentPeriodDisplay = this.contentEl.querySelector('.agenda-view__period-title');
        if (currentPeriodDisplay) {
            currentPeriodDisplay.textContent = this.getCurrentPeriodText();
        }
    }
    
    private getCurrentPeriodText(): string {
        const dates = this.getAgendaDates();
        if (dates.length === 0) return '';
        
        const start = dates[0];
        const end = dates[dates.length - 1];
        
        if (isSameDay(start, end)) {
            return format(start, 'EEEE, MMMM d, yyyy');
        } else {
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        }
    }
    
    private showLoadingIndicator() {
        const container = this.contentEl.querySelector('.agenda-view');
        if (!container || container.querySelector('.agenda-view__loading')) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'agenda-view__loading';
        indicator.textContent = 'Loading agenda...';
        container.prepend(indicator);
    }
    
    private hideLoadingIndicator() {
        const indicator = this.contentEl.querySelector('.agenda-view__loading');
        if (indicator) {
            indicator.remove();
        }
    }
    
    async refresh() {
        const container = this.contentEl.querySelector('.agenda-view') as HTMLElement;
        if (container) {
            // Re-apply view options to ensure they persist through refreshes
            this.setupViewOptions();
            // Use DOMReconciler for efficient updates
            await this.renderAgendaContent(container);
        }
    }
    
    
    
    /**
     * Wait for cache to be ready with actual data
     */
    private async waitForCacheReady(): Promise<void> {
        // First check if cache is already initialized
        if (this.plugin.cacheManager.isInitialized()) {
            return;
        }
        
        // If not initialized, wait for the cache-initialized event
        return new Promise((resolve) => {
            const unsubscribe = this.plugin.cacheManager.subscribe('cache-initialized', () => {
                unsubscribe();
                resolve();
            });
        });
    }
}
