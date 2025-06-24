import { TFile, ItemView, WorkspaceLeaf, EventRef, Setting } from 'obsidian';
import { format, addDays, startOfWeek, endOfWeek, isToday, isSameDay } from 'date-fns';
import TaskNotesPlugin from '../main';
import { 
    AGENDA_VIEW_TYPE,
    EVENT_DATA_CHANGED,
    EVENT_DATE_SELECTED,
    EVENT_TASK_UPDATED,
    TaskInfo, 
    NoteInfo,
    FilterQuery
} from '../types';
// No helper functions needed from helpers
import { createTaskCard, updateTaskCard } from '../ui/TaskCard';
import { createNoteCard } from '../ui/NoteCard';
import { FilterBar } from '../ui/FilterBar';
import { FilterService } from '../services/FilterService';
// No date utils needed

export class AgendaView extends ItemView {
    plugin: TaskNotesPlugin;
    
    // View settings
    private daysToShow = 7;
    private groupByDate = true;
    private showOverdueOnToday = false;
    private showNotes = true;
    private startDate: Date;
    
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
        
        // Initialize with default query (will be updated in onOpen after plugin is ready)
        this.currentQuery = {
            searchQuery: undefined,
            statuses: undefined,
            contexts: undefined,
            priorities: undefined,
            dateRange: this.getDateRange(),
            showArchived: false,
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
        const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, () => {
            this.refresh();
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
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, ({ path, originalTask, updatedTask }) => {
            // For agenda view, since items are organized by date and can move between days,
            // it's safer to do a refresh rather than try to update in place
            this.refresh();
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
        
        // Wait for ViewStateManager initialization and load saved filter state
        // ViewStateManager loads synchronously now
        const savedQuery = this.plugin.viewStateManager.getFilterState(AGENDA_VIEW_TYPE);
        if (savedQuery) {
            // Preserve our current date range but use saved filters
            this.currentQuery = {
                ...savedQuery,
                dateRange: this.getDateRange()
            };
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
        this.registerKeyboardNavigation();
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
        
        // Navigation controls
        const prevButton = headerContent.createEl('button', {
            cls: 'agenda-view__nav-button agenda-view__nav-button--prev',
            text: '‹',
            attr: {
                'aria-label': 'Previous period',
                'title': 'Previous period (Left arrow)'
            }
        });
        
        // Current period display (large, styled like tasks view date)
        headerContent.createDiv({ 
            cls: 'agenda-view__period-title',
            text: this.getCurrentPeriodText()
        });
        
        const nextButton = headerContent.createEl('button', {
            cls: 'agenda-view__nav-button agenda-view__nav-button--next',
            text: '›',
            attr: {
                'aria-label': 'Next period',
                'title': 'Next period (Right arrow)'
            }
        });
        
        prevButton.addEventListener('click', () => {
            this.navigateToPreviousPeriod();
        });
        
        nextButton.addEventListener('click', () => {
            this.navigateToNextPeriod();
        });
        
        // FilterBar section (like tasks view)
        const filterBarContainer = controlsContainer.createDiv({ cls: 'agenda-view__filter-container' });
        
        // Wait for cache to be initialized with actual data
        await this.waitForCacheReady();
        
        // Get filter options from FilterService
        const filterOptions = await this.plugin.filterService.getFilterOptions();
        
        // Create FilterBar with Agenda configuration
        this.filterBar = new FilterBar(
            filterBarContainer,
            this.currentQuery,
            filterOptions,
            {
                showSearch: true,
                showGroupBy: false, // Agenda groups by date internally
                showSortBy: true,
                showAdvancedFilters: true,
                allowedSortKeys: ['due', 'scheduled', 'priority', 'title'],
                allowedGroupKeys: ['none'] // Only none allowed since we group by date
            }
        );
        
        // Initialize FilterBar (placeholder for future cache-ready initialization)
        await this.filterBar.initialize();
        
        // Set up cache refresh mechanism for FilterBar
        this.filterBar.setupCacheRefresh(this.plugin.cacheManager, this.plugin.filterService);
        
        // Listen for filter changes
        this.filterBar.on('queryChange', async (newQuery: FilterQuery) => {
            this.currentQuery = newQuery;
            // Save the filter state (but always update date range based on current view)
            const queryToSave = { ...newQuery, dateRange: this.getDateRange() };
            await this.plugin.viewStateManager.setFilterState(AGENDA_VIEW_TYPE, queryToSave);
            this.refresh();
        });
        
        // Settings section with period selector, today button, and toggles
        const settingsSection = controlsContainer.createDiv({ cls: 'agenda-view__settings' });
        
        // Left side: Period selector and Today button
        const leftControls = settingsSection.createDiv({ cls: 'agenda-view__settings-left' });
        
        const periodSelect = leftControls.createEl('select', { cls: 'agenda-view__period-select' });
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
            
            // Update the date range in the query
            this.currentQuery.dateRange = this.getDateRange();
            
            this.refresh();
        });
        
        const todayButton = leftControls.createEl('button', {
            text: 'Today',
            cls: 'agenda-view__today-button'
        });
        
        todayButton.addEventListener('click', () => {
            this.startDate = new Date();
            this.refresh();
        });
        
        // Right side: Toggles
        const rightControls = settingsSection.createDiv({ cls: 'agenda-view__settings-right' });
        
        // Show overdue tasks toggle
        const overdueToggle = rightControls.createEl('label', { cls: 'agenda-view__toggle' });
        const overdueCheckbox = overdueToggle.createEl('input', { 
            type: 'checkbox',
            cls: 'agenda-view__toggle-checkbox'
        });
        overdueCheckbox.checked = this.showOverdueOnToday;
        overdueToggle.createSpan({ text: 'Overdue on today' });
        
        overdueCheckbox.addEventListener('change', () => {
            this.showOverdueOnToday = overdueCheckbox.checked;
            this.refresh();
        });
        
        // Show notes toggle (only show if note indexing is enabled)
        if (!this.plugin.settings.disableNoteIndexing) {
            const notesToggle = rightControls.createEl('label', { cls: 'agenda-view__toggle' });
            const notesCheckbox = notesToggle.createEl('input', { 
                type: 'checkbox',
                cls: 'agenda-view__toggle-checkbox'
            });
            notesCheckbox.checked = this.showNotes;
            notesToggle.createSpan({ text: 'Show notes' });
            
            notesCheckbox.addEventListener('change', () => {
                this.showNotes = notesCheckbox.checked;
                this.refresh();
            });
        }
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
        if (!this.showNotes || this.plugin.settings.disableNoteIndexing) {
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
            
            // Use FilterService for all agenda filtering logic
            const agendaData = await this.plugin.filterService.getAgendaData(
                dates,
                {
                    searchQuery: this.currentQuery.searchQuery,
                    statuses: this.currentQuery.statuses,
                    contexts: this.currentQuery.contexts,
                    priorities: this.currentQuery.priorities,
                    showArchived: this.currentQuery.showArchived,
                    sortKey: this.currentQuery.sortKey,
                    sortDirection: this.currentQuery.sortDirection,
                    groupKey: this.currentQuery.groupKey
                },
                this.showOverdueOnToday
            );
            
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
            const dateStr = format(dayData.date, 'yyyy-MM-dd');
            
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
            const weekStart = startOfWeek(this.startDate, { weekStartsOn: 0 }); // Sunday
            const weekEnd = endOfWeek(this.startDate, { weekStartsOn: 0 });
            
            let currentDate = weekStart;
            while (currentDate <= weekEnd) {
                dates.push(new Date(currentDate));
                currentDate = addDays(currentDate, 1);
            }
        } else {
            // Fixed number of days starting from startDate
            for (let i = 0; i < this.daysToShow; i++) {
                dates.push(addDays(this.startDate, i));
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
        
        // Update the date range in the query
        this.currentQuery.dateRange = this.getDateRange();
        
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
        
        // Update the date range in the query
        this.currentQuery.dateRange = this.getDateRange();
        
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
            // Use DOMReconciler for efficient updates
            await this.renderAgendaContent(container);
        }
    }
    
    private registerKeyboardNavigation() {
        this.registerDomEvent(document, 'keydown', async (e: KeyboardEvent) => {
            // Only handle events when this view is active
            if (!this.isThisViewActive()) {
                return;
            }
            
            switch (e.key) {
                // Left arrow - previous period
                case 'ArrowLeft':
                    e.preventDefault();
                    this.navigateToPreviousPeriod();
                    break;
                    
                // Right arrow - next period
                case 'ArrowRight':
                    e.preventDefault();
                    this.navigateToNextPeriod();
                    break;
            }
        });
    }
    
    private isThisViewActive(): boolean {
        const activeView = this.app.workspace.getActiveViewOfType(AgendaView);
        return activeView === this;
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
