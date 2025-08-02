import { Notice, TFile, ItemView, WorkspaceLeaf, EventRef, debounce, setTooltip } from 'obsidian';
import { format } from 'date-fns';
import { formatDateForStorage, createSafeUTCDate, getTodayLocal, createUTCDateFromLocalCalendarDate } from '../utils/dateUtils';
import TaskNotesPlugin from '../main';
import { getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';
import { 
    MINI_CALENDAR_VIEW_TYPE, 
    EVENT_DATA_CHANGED,
    EVENT_DATE_SELECTED,
    EVENT_TASK_UPDATED,
    TaskInfo, 
    ColorizeMode,
} from '../types';
import { 
    isSameDay
} from '../utils/helpers';
import { perfMonitor } from '../utils/PerformanceMonitor';
import { createSafeDate, getDatePart } from '../utils/dateUtils';

export class MiniCalendarView extends ItemView {
    // Static property to track initialization status for daily notes
    static dailyNotesInitialized = false;
    
    plugin: TaskNotesPlugin;
    colorizeMode: ColorizeMode = 'tasks';
    
    // Track currently displayed month for proper change detection
    private displayedMonth: number;
    private displayedYear: number;
    
    // Event listeners
    private listeners: EventRef[] = [];
    
    // Performance optimizations
    private monthCalculationCache: Map<string, { actualMonth: number; dateObj: Date; dateKey: string }> = new Map();
    private debouncedRefresh: (() => void) | null = null;
    private currentCacheKey = '';
    private calendarDayElements: NodeListOf<Element> | null = null;
    private elementToDateMap: Map<Element, { date: number; dateKey: string }> = new Map();
  
    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Initialize displayed month/year tracking
        const currentDate = this.plugin.selectedDate;
        this.displayedMonth = currentDate.getMonth();
        this.displayedYear = currentDate.getFullYear();
        
        // Register event listeners
        this.registerEvents();
    }
    
    registerEvents(): void {
        // Clean up any existing listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.listeners = [];
        
        // Listen for data changes
        const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, () => {
            this.refresh();
        });
        this.listeners.push(dataListener);
        
        // Listen for date selection changes
        const dateListener = this.plugin.emitter.on(EVENT_DATE_SELECTED, (date: Date) => {
            // Check if we're changing months compared to what's currently displayed
            if (this.displayedMonth !== date.getMonth() || this.displayedYear !== date.getFullYear()) {
                // Month changed - update tracking and do full refresh
                this.displayedMonth = date.getMonth();
                this.displayedYear = date.getFullYear();
                
                // Clear month calculation cache for performance
                this.clearMonthCalculationCache();
                
                // Force daily notes cache rebuild for the new month if in daily mode
                if (this.colorizeMode === 'daily') {
                    this.plugin.cacheManager.rebuildDailyNotesCache(date.getFullYear(), date.getMonth());
                }
                
                // Do full calendar refresh
                this.refresh();
            } else {
                // Same month, just update selected date and month display
                this.updateSelectedDate(date);
                this.updateMonthDisplay();
            }
        });
        this.listeners.push(dateListener);
        
        // Listen for individual task updates for granular calendar updates
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, ({ path, originalTask, updatedTask }) => {
            if (!path || !updatedTask) {
                console.error('EVENT_TASK_UPDATED received invalid data:', { path, originalTask, updatedTask });
                return;
            }
            
            // Perform granular calendar update for task changes
            this.handleTaskUpdate(originalTask, updatedTask);
        });
        this.listeners.push(taskUpdateListener);
    }
  
    getViewType(): string {
        return MINI_CALENDAR_VIEW_TYPE;
    }
  
    getDisplayText(): string {
        return 'Mini Calendar';
    }
  
    getIcon(): string {
        return 'calendar-days';
    }
  
    async onOpen() {
        // Wait for the plugin to be fully initialized before proceeding
        await this.plugin.onReady();
        
        // Clear and prepare the content element
        const contentEl = this.contentEl;
        contentEl.empty();
        
        // Add a container for our view content
        const container = contentEl.createDiv({ cls: 'tasknotes-plugin mini-calendar-view' });
        
        // Show loading indicator while loading initial data
        this.showLoadingIndicator();
        
        // Start rendering the view immediately
        this.renderView(container);
        
        // Refresh the view to load the data
        await this.refresh();
        
        // Register keyboard event handlers
        this.registerKeyboardNavigation();
    }

    renderView(container: HTMLElement) {
        // Clear existing content
        container.empty();
        
        // Create the calendar UI
        this.createCalendarControls(container);
        
        // Create the calendar grid
        this.createCalendarGrid(container);
        this.colorizeCalendar();
    }
    
    colorizeCalendar() {
        switch (this.colorizeMode) {
            case 'tasks':
                this.colorizeCalendarForTasks();
                break;
            case 'notes':
                this.colorizeCalendarForNotes();
                break;
            case 'daily':
                this.colorizeCalendarForDailyNotes();
                break;
        }
    }
    
    async navigateToPreviousPeriod() {
        const currentDate = new Date(this.plugin.selectedDate);
        const date = new Date(currentDate);
        
        // Use local month methods for consistent date arithmetic
        date.setMonth(date.getMonth() - 1);
        
        // Set the selected date - the event listener will handle the calendar update
        this.plugin.setSelectedDate(date);
    }
    
    async navigateToNextPeriod() {
        const currentDate = new Date(this.plugin.selectedDate);
        const date = new Date(currentDate);
        
        // Use local month methods for consistent date arithmetic
        date.setMonth(date.getMonth() + 1);
        
        // Set the selected date - the event listener will handle the calendar update
        this.plugin.setSelectedDate(date);
    }
    
    async navigateToToday() {
        // Get today in the user's local timezone and convert to UTC anchor
        const todayLocal = getTodayLocal();
        const todayUTCRepresentation = createUTCDateFromLocalCalendarDate(todayLocal);
        
        // Set the selected date - the event listener will handle the calendar update
        this.plugin.setSelectedDate(todayUTCRepresentation);
    }
    
  
    async onClose() {
        // Remove event listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        
        // Clean up caches and references
        this.monthCalculationCache.clear();
        this.elementToDateMap.clear();
        this.calendarDayElements = null;
        this.currentCacheKey = '';
        
        // Clean up when the view is closed
        this.contentEl.empty();
    }
    
    /**
     * Registers keyboard navigation for the calendar
     */
    registerKeyboardNavigation() {
        // Add keyboard event handling for this view
        this.registerDomEvent(document, 'keydown', async (e: KeyboardEvent) => {
            // Only handle events when this view is active
            if (!this.isThisViewActive()) {
                return;
            }
            
            // Get the currently selected date
            const currentDate = new Date(this.plugin.selectedDate);
            let newDate: Date | undefined = undefined;
            
            switch (e.key) {
                // Left arrow - previous day
                case 'ArrowLeft':
                    newDate = new Date(currentDate);
                    newDate.setUTCDate(currentDate.getUTCDate() - 1);
                    break;
                    
                // Right arrow - next day
                case 'ArrowRight':
                    newDate = new Date(currentDate);
                    newDate.setUTCDate(currentDate.getUTCDate() + 1);
                    break;
                    
                // Up arrow - previous week (same day)
                case 'ArrowUp':
                    newDate = new Date(currentDate);
                    newDate.setUTCDate(currentDate.getUTCDate() - 7);
                    break;
                    
                // Down arrow - next week (same day)
                case 'ArrowDown':
                    newDate = new Date(currentDate);
                    newDate.setUTCDate(currentDate.getUTCDate() + 7);
                    break;
                
                // Enter key - open daily note for selected date
                case 'Enter':
                    e.preventDefault();
                    this.plugin.navigateToDailyNote(currentDate);
                    return;
                    
                default:
                    // Not a navigation key
                    return;
            }
            
            // If we have a new date, update it and prevent default
            if (newDate) {
                e.preventDefault();
                
                // Set the selected date - the event listener will handle the calendar update
                this.plugin.setSelectedDate(newDate);
            }
        });
    }
    
    /**
     * Helper to check if this view is currently the active one
     */
    private isThisViewActive(): boolean {
        const activeView = this.app.workspace.getActiveViewOfType(MiniCalendarView);
        return activeView === this;
    }
    
    /**
     * Helper to navigate by days and weeks
     */
    private navigateDate(dayOffset: number, weekOffset: number) {
        const currentDate = new Date(this.plugin.selectedDate);
        const newDate = new Date(currentDate);
        
        // Apply week offset (7 days per week) using UTC methods
        newDate.setUTCDate(currentDate.getUTCDate() + (weekOffset * 7) + dayOffset);
        
        // Set the selected date - the event listener will handle the calendar update
        this.plugin.setSelectedDate(newDate);
    }
    
    // Helper method to refresh the view
    async refresh() {
        this.showLoadingIndicator();
        
        try {
            let container = this.contentEl.querySelector('.mini-calendar-view') as HTMLElement;
            if (!container) {
                // Create container if it doesn't exist
                container = this.contentEl.createDiv({ cls: 'tasknotes-plugin mini-calendar-view' });
            }
            
            // Simply render the view and get fresh data from CacheManager
            this.renderView(container);
        } finally {
            this.hideLoadingIndicator();
        }
    }
    
    // Update selected date without re-rendering entire calendar
    private updateSelectedDate(newDate: Date) {
        // Remove selected class from all days
        const allDays = this.contentEl.querySelectorAll('.mini-calendar-view__day');
        allDays.forEach(day => {
            day.classList.remove('mini-calendar-view__day--selected');
            day.setAttribute('aria-selected', 'false');
            day.setAttribute('tabindex', '-1');
        });
        
        // Find and select the new date element
        // Will select based on aria-label
        allDays.forEach(day => {
            const dayEl = day as HTMLElement;
            const ariaLabel = dayEl.getAttribute('aria-label') || '';
            // Check if this element represents the new date
            if (ariaLabel.includes(format(newDate, 'EEEE, MMMM d, yyyy'))) {
                dayEl.classList.add('mini-calendar-view__day--selected');
                dayEl.setAttribute('aria-selected', 'true');
                dayEl.setAttribute('tabindex', '0');
                dayEl.focus();
            }
        });
        
        // Update the plugin's selected date - but don't trigger the event again
        // since this is already in response to a date selection event
        this.plugin.selectedDate = newDate;
    }
    
    // Update the month display text in the header
    private updateMonthDisplay() {
        const monthDisplay = this.contentEl.querySelector('.mini-calendar-view__month-display');
        if (monthDisplay) {
            monthDisplay.textContent = format(this.plugin.selectedDate, 'MMMM yyyy');
        }
    }
    
    // Show a loading indicator while building cache
    private showLoadingIndicator() {
        const container = this.contentEl.querySelector('.mini-calendar-view') || this.contentEl;
        
        // Check if indicator already exists
        if (container.querySelector('.cache-loading-indicator')) return;

        const indicator = document.createElement('div');
        indicator.className = 'cache-loading-indicator';
        indicator.textContent = 'Loading calendar data...';
        container.prepend(indicator);
    }

    // Hide the loading indicator
    private hideLoadingIndicator() {
        const indicator = this.contentEl.querySelector('.cache-loading-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
  
    createCalendarControls(container: HTMLElement) {
        const controlsContainer = container.createDiv({ cls: 'mini-calendar-view__controls' });
        
        // Calendar header with view selector first, then navigation
        const headerContainer = controlsContainer.createDiv({ cls: 'mini-calendar-view__header' });
        
        // View Type Dropdown (moved to front)
        const colorizeSelect = headerContainer.createEl('select', { 
            cls: 'mini-calendar-view__view-selector',
            attr: {
                'title': 'Change view',
                'aria-label': 'Change calendar view'
            }
        });
        
        // Add colorize mode options
        const modes = [
            { value: 'tasks', text: 'Tasks' },
            { value: 'notes', text: 'Notes' },
            { value: 'daily', text: 'Daily notes' }
        ];
        
        modes.forEach(mode => {
            const option = colorizeSelect.createEl('option', { 
                value: mode.value, 
                text: mode.text 
            });
            
            if (mode.value === this.colorizeMode) {
                option.selected = true;
            }
        });
        
        // Add change event listener
        colorizeSelect.addEventListener('change', async () => {
            const newMode = colorizeSelect.value as ColorizeMode;
            // Show loading indicator while changing modes
            this.showLoadingIndicator();
            try {
                await this.setColorizeMode(newMode);
            } finally {
                this.hideLoadingIndicator();
            }
        });
        
        // Month Navigation Section (grouped together)
        const navSection = headerContainer.createDiv({ cls: 'mini-calendar-view__navigation' });
        
        // Previous Month Button
        const prevButton = navSection.createEl('button', { 
            text: '‹', 
            cls: 'mini-calendar-view__nav-button mini-calendar-view__nav-button--prev',
            attr: {
                'aria-label': 'Previous month',
                'title': 'Previous month'
            }
        });
        prevButton.addEventListener('click', () => {
            this.navigateToPreviousPeriod();
        });
        
        // Current Month Display
        navSection.createDiv({ 
            cls: 'mini-calendar-view__month-display',
            text: format(this.plugin.selectedDate, 'MMMM yyyy')
        });
        
        // Next Month Button
        const nextButton = navSection.createEl('button', { 
            text: '›', 
            cls: 'mini-calendar-view__nav-button mini-calendar-view__nav-button--next',
            attr: {
                'aria-label': 'Next month',
                'title': 'Next month'
            }
        });
        nextButton.addEventListener('click', () => {
            this.navigateToNextPeriod();
        });
        
        // Today button (moved to end)
        const todayButton = headerContainer.createEl('button', { 
            text: 'Today', 
            cls: 'mini-calendar-view__today-button',
            attr: {
                'aria-label': 'Go to today',
                'title': 'Go to today'
            }
        });
        
        todayButton.addEventListener('click', () => {
            this.navigateToToday();
        });
    }
    
    // Set the colorization mode and update the view
    async setColorizeMode(mode: ColorizeMode) {
        if (this.colorizeMode !== mode) {
            this.colorizeMode = mode;
            
            // If switching to daily notes mode, rebuild the daily notes cache
            if (mode === 'daily') {
                const currentYear = this.plugin.selectedDate.getFullYear();
                const currentMonth = this.plugin.selectedDate.getMonth();
                await this.plugin.cacheManager.rebuildDailyNotesCache(currentYear, currentMonth);
            }
            
            this.colorizeCalendar();
        }
    }
    
    createCalendarGrid(container: HTMLElement) {
        // Create container for the calendar grid
        const gridContainer = container.createDiv({ cls: 'mini-calendar-view__grid-container' });

        // Get the currently selected date
        const selectedDate = this.plugin.selectedDate;
        
        // Get the current month and year
        const currentMonth = selectedDate.getUTCMonth();
        const currentYear = selectedDate.getUTCFullYear();
        
        // Get the first day of the month
        const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
        
        // Get the last day of the month
        const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
        
        const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
        
        // Get the day of the week for the first day (0-6, 0 is Sunday)
        const firstDayOfWeek = (firstDayOfMonth.getUTCDay() - firstDaySetting + 7) % 7;
        
        // Create the calendar grid with ARIA role
        const calendarGrid = gridContainer.createDiv({ 
            cls: 'mini-calendar-view__grid',
            attr: {
                'role': 'grid',
                'aria-label': `Calendar for ${format(this.plugin.selectedDate, 'MMMM yyyy')}`,
                'id': 'calendar-grid'
            }
        });
        
        // Create the calendar header (day names)
        const calendarHeader = calendarGrid.createDiv({ 
            cls: 'mini-calendar-view__grid-header',
            attr: {
                'role': 'row'
            }
        });
        
        // Day names
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const reorderedDayNames = [...dayNames.slice(firstDaySetting), ...dayNames.slice(0, firstDaySetting)];
        
        // Add day headers with ARIA roles
        reorderedDayNames.forEach((dayName, index) => {
            calendarHeader.createDiv({ 
                text: dayName, 
                cls: 'mini-calendar-view__day-header',
                attr: {
                    'role': 'columnheader',
                    'aria-label': dayName
                }
            });
        });
        
        // Calculate days from previous month to show
        const daysFromPrevMonth = firstDayOfWeek;
        
        // Calculate days from next month to show (to fill the grid)
        const totalCells = 42; // 6 rows of 7 days
        const daysThisMonth = lastDayOfMonth.getUTCDate();
        const daysFromNextMonth = totalCells - daysThisMonth - daysFromPrevMonth;
        
        // Get the last day of the previous month
        const lastDayOfPrevMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
        
        // Create calendar days - start new row for first week
        let currentWeekRow = calendarGrid.createDiv({
            cls: 'mini-calendar-view__week',
            attr: { 'role': 'row' }
        });
        
        // Days from previous month
        for (let i = 0; i < daysFromPrevMonth; i++) {
            const dayNum = lastDayOfPrevMonth - daysFromPrevMonth + i + 1;
            const dayDate = new Date(Date.UTC(currentYear, currentMonth - 1, dayNum));
            
            const isSelected = isSameDay(dayDate, selectedDate);
            
            const dayEl = currentWeekRow.createDiv({ 
                cls: `mini-calendar-view__day mini-calendar-view__day--outside-month${isSelected ? ' mini-calendar-view__day--selected' : ''}`, 
                text: dayNum.toString(),
                attr: {
                    'role': 'gridcell',
                    'tabindex': isSelected ? '0' : '-1',
                    'aria-label': format(dayDate, 'EEEE, MMMM d, yyyy'),
                    'aria-selected': isSelected ? 'true' : 'false'
                }
            });
            
            // Add click handler
            dayEl.addEventListener('click', () => {
                this.plugin.setSelectedDate(dayDate);
            });
            
            // Add hover preview functionality for daily notes
            dayEl.addEventListener('mouseover', (event) => {
                this.showDayPreview(event, dayDate, dayEl);
            });
            
            // Add keyboard event handler to each day
            dayEl.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.plugin.setSelectedDate(dayDate);
                }
            });
            
            // Add drag and drop handlers
            this.addDropHandlers(dayEl, dayDate);
        }
        
        // Days from current month
        const today = new Date();
        for (let i = 1; i <= daysThisMonth; i++) {
            // Start a new row every 7 days (once per week)
            if ((i + daysFromPrevMonth - 1) % 7 === 0 && i > 1) {
                currentWeekRow = calendarGrid.createDiv({
                    cls: 'mini-calendar-view__week',
                    attr: { 'role': 'row' }
                });
            }
            
            const dayDate = new Date(Date.UTC(currentYear, currentMonth, i));
            
            const isToday = isSameDay(dayDate, today);
            const isSelected = isSameDay(dayDate, selectedDate);
            
            let classNames = 'mini-calendar-view__day';
            if (isToday) classNames += ' mini-calendar-view__day--today';
            if (isSelected) classNames += ' mini-calendar-view__day--selected';
            
            const dayEl = currentWeekRow.createDiv({ 
                cls: classNames, 
                text: i.toString(),
                attr: {
                    'role': 'gridcell',
                    'tabindex': isSelected ? '0' : '-1',
                    'aria-label': format(dayDate, 'EEEE, MMMM d, yyyy') + (isToday ? ' (Today)' : ''),
                    'aria-selected': isSelected ? 'true' : 'false',
                    'aria-current': isToday ? 'date' : null
                }
            });
            
            // Add click handler
            dayEl.addEventListener('click', () => {
                this.plugin.setSelectedDate(dayDate);
            });
            
            // Add hover preview functionality for daily notes
            dayEl.addEventListener('mouseover', (event) => {
                this.showDayPreview(event, dayDate, dayEl);
            });
            
            // Add keyboard event handler to each day
            dayEl.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.plugin.setSelectedDate(dayDate);
                }
            });
            
            // Add drag and drop handlers
            this.addDropHandlers(dayEl, dayDate);
        }
        
        // Days from next month
        for (let i = 1; i <= daysFromNextMonth; i++) {
            // Start a new row every 7 days (once per week)
            if ((i + daysFromPrevMonth + daysThisMonth - 1) % 7 === 0 && i > 1) {
                currentWeekRow = calendarGrid.createDiv({
                    cls: 'mini-calendar-view__week',
                    attr: { 'role': 'row' }
                });
            }
            
            const dayDate = new Date(Date.UTC(currentYear, currentMonth + 1, i));
            
            const isSelected = isSameDay(dayDate, selectedDate);
            
            const dayEl = currentWeekRow.createDiv({ 
                cls: `mini-calendar-view__day mini-calendar-view__day--outside-month${isSelected ? ' mini-calendar-view__day--selected' : ''}`, 
                text: i.toString(),
                attr: {
                    'role': 'gridcell',
                    'tabindex': isSelected ? '0' : '-1',
                    'aria-label': format(dayDate, 'EEEE, MMMM d, yyyy'),
                    'aria-selected': isSelected ? 'true' : 'false'
                }
            });
            
            // Add click handler
            dayEl.addEventListener('click', () => {
                this.plugin.setSelectedDate(dayDate);
            });
            
            // Add hover preview functionality for daily notes
            dayEl.addEventListener('mouseover', (event) => {
                this.showDayPreview(event, dayDate, dayEl);
            });
            
            // Add keyboard event handler to each day
            dayEl.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.plugin.setSelectedDate(dayDate);
                }
            });
            
            // Add drag and drop handlers
            this.addDropHandlers(dayEl, dayDate);
        }
    }
    
    // Clear all colorization to prepare for new colorization
    private clearCalendarColorization() {
        // Get all calendar day elements
        const calendarDays = this.contentEl.querySelectorAll('.mini-calendar-view__day');
        
        // Remove all colorization classes and indicators
        calendarDays.forEach(day => {
            // Remove indicator elements
            day.querySelectorAll('.note-indicator, .task-indicator, .daily-note-indicator').forEach(el => el.remove());
            
            // Remove colorization classes
            day.classList.remove(
                'mini-calendar-view__day--has-notes-few', 'mini-calendar-view__day--has-notes-some', 'mini-calendar-view__day--has-notes-many',
                'mini-calendar-view__day--has-tasks', 'mini-calendar-view__day--has-completed-tasks', 'mini-calendar-view__day--has-archived-tasks', 'mini-calendar-view__day--has-scheduled-tasks',
                'mini-calendar-view__day--has-daily-note'
            );
        });
    }
    
    // Method to colorize calendar for notes (notes tab)
    async colorizeCalendarForNotes() {
        return perfMonitor.measure('calendar-colorize-notes', async () => {
            // First clear all existing colorization
            this.clearCalendarColorization();
            
            // Get current year and month
            const currentYear = this.plugin.selectedDate.getFullYear();
            const currentMonth = this.plugin.selectedDate.getMonth();
            
            // Get data from unified cache manager
            let calendarData;
            try {
                calendarData = await this.plugin.cacheManager.getCalendarData(currentYear, currentMonth);
            } catch (error) {
                console.warn('Failed to get calendar data from unified cache manager:', error);
                calendarData = await this.plugin.cacheManager.getCalendarData(currentYear, currentMonth);
            }
            const notesCache = calendarData.notes;
        
        // Find all calendar days
        const calendarDays = this.contentEl.querySelectorAll('.mini-calendar-view__day');
        
        // Add note indicators
        calendarDays.forEach(day => {
            const dateText = (day as HTMLElement).innerText.trim();
            if (dateText) {
                // Create the date string in yyyy-MM-dd format
                const year = this.plugin.selectedDate.getFullYear();
                const month = this.plugin.selectedDate.getMonth();
                const date = parseInt(dateText);
                
                // Skip if the date is not valid
                if (isNaN(date)) return;
                
                // Adjust for days outside current month
                let actualMonth = month;
                if (day.classList.contains('mini-calendar-view__day--outside-month')) {
                    if (date > 15) { // Probably previous month
                        actualMonth = month === 0 ? 11 : month - 1;
                    } else { // Probably next month
                        actualMonth = month === 11 ? 0 : month + 1;
                    }
                }
                
                const dateObj = createSafeDate(year, actualMonth, date);
                const dateKey = formatDateForStorage(dateObj);
                
                // Get note count for this date
                const noteCount = notesCache.get(dateKey) || 0;
                
                if (noteCount > 0) {
                    // Create indicator element
                    const indicator = document.createElement('div');
                    indicator.className = 'note-indicator';
                    
                    // Different styling based on note count
                    let noteClass = '';
                    if (noteCount >= 5) {
                        noteClass = 'many-notes';
                        day.classList.add('mini-calendar-view__day--has-notes-many');
                    } else if (noteCount >= 2) {
                        noteClass = 'some-notes';
                        day.classList.add('mini-calendar-view__day--has-notes-some');
                    } else {
                        noteClass = 'few-notes';
                        day.classList.add('mini-calendar-view__day--has-notes-few');
                    }
                    
                    indicator.classList.add(noteClass);
                    
                    // Add tooltip with note count
                    indicator.setAttribute('aria-label', `${noteCount} note${noteCount > 1 ? 's' : ''}`);
                    setTooltip(indicator, `${noteCount} note${noteCount > 1 ? 's' : ''}`, { placement: 'top' });
                    
                    // Add indicator to the day cell
                    day.appendChild(indicator);
                }
            }
        });
        });
    }
    
    // Method to colorize calendar for tasks (tasks tab)
    async colorizeCalendarForTasks() {
        // First clear all existing colorization
        this.clearCalendarColorization();
        
        // Get current year and month
        const currentYear = this.plugin.selectedDate.getFullYear();
        const currentMonth = this.plugin.selectedDate.getMonth();
        
        // Get calendar data from unified cache
        const calendarData = await this.plugin.cacheManager.getCalendarData(currentYear, currentMonth);
        const tasksCache = calendarData.tasks;
        
        // Find all calendar days
        const calendarDays = this.contentEl.querySelectorAll('.mini-calendar-view__day');
        
        // Add task indicators
        calendarDays.forEach(day => {
            const dateText = (day as HTMLElement).innerText.trim();
            if (dateText) {
                // Create the date string in yyyy-MM-dd format
                const year = this.plugin.selectedDate.getFullYear();
                const month = this.plugin.selectedDate.getMonth();
                const date = parseInt(dateText);
                
                // Skip if the date is not valid
                if (isNaN(date)) return;
                
                // Use cached month calculation for better performance
                const cacheKey = `${year}-${month}-${date}-${day.classList.contains('mini-calendar-view__day--outside-month')}`;
                let cachedResult = this.monthCalculationCache.get(cacheKey);
                
                if (!cachedResult) {
                    // Adjust for days outside current month
                    let actualMonth = month;
                    if (day.classList.contains('mini-calendar-view__day--outside-month')) {
                        if (date > 15) { // Probably previous month
                            actualMonth = month === 0 ? 11 : month - 1;
                        } else { // Probably next month
                            actualMonth = month === 11 ? 0 : month + 1;
                        }
                    }
                    
                    const dateObj = createSafeDate(year, actualMonth, date);
                    const dateKey = formatDateForStorage(dateObj);
                    
                    cachedResult = { actualMonth, dateObj, dateKey };
                    this.monthCalculationCache.set(cacheKey, cachedResult);
                }
                
                const { dateKey } = cachedResult;
                
                // Get task info for this date
                const taskInfo = tasksCache.get(dateKey);
                
                if (taskInfo && (taskInfo.hasDue || taskInfo.hasScheduled)) {
                    // Create indicator element
                    const indicator = document.createElement('div');
                    indicator.className = 'task-indicator';
                    
                    // Different styling for completed, due, scheduled, and archived tasks
                    // Priority order: archived > completed > due > scheduled
                    let taskStatus = '';
                    if (taskInfo.hasArchived) {
                        // Archived tasks get a different style
                        day.classList.add('mini-calendar-view__day--has-archived-tasks');
                        indicator.classList.add('archived-tasks');
                        taskStatus = 'Archived';
                    } else if (taskInfo.hasCompleted) {
                        // Completed tasks
                        day.classList.add('mini-calendar-view__day--has-completed-tasks');
                        indicator.classList.add('completed-tasks');
                        taskStatus = 'Completed';
                    } else if (taskInfo.hasDue) {
                        // Due tasks (prioritized over scheduled)
                        day.classList.add('mini-calendar-view__day--has-tasks');
                        indicator.classList.add('due-tasks');
                        taskStatus = 'Due';
                    } else if (taskInfo.hasScheduled) {
                        // Scheduled tasks
                        day.classList.add('mini-calendar-view__day--has-scheduled-tasks');
                        indicator.classList.add('scheduled-tasks');
                        taskStatus = 'Scheduled';
                    }
                    
                    // Add tooltip with task count information
                    indicator.setAttribute('aria-label', `${taskStatus} tasks (${taskInfo.count})`);
                    setTooltip(indicator, `${taskStatus} tasks (${taskInfo.count})`, { placement: 'top' });
                    
                    // Add indicator to the day cell
                    day.appendChild(indicator);
                }
            }
        });
    }
    
    // Method to colorize calendar for daily notes (timeblock tab)
    async colorizeCalendarForDailyNotes() {
        // First clear all existing colorization
        this.clearCalendarColorization();
        
        // Get current year and month
        const currentYear = this.plugin.selectedDate.getFullYear();
        const currentMonth = this.plugin.selectedDate.getMonth();
        
        // Force a rebuild of the cache on the first call to ensure daily notes are properly indexed
        // Using class property instead of static variable to track first call
        let dailyNotesCache: Set<string>;
        
        if (!MiniCalendarView.dailyNotesInitialized) {
            // Use the targeted rebuild method instead of rebuilding the entire index
            await this.plugin.cacheManager.rebuildDailyNotesCache(currentYear, currentMonth);
            MiniCalendarView.dailyNotesInitialized = true;
            
            // Get calendar data after rebuild
            const calendarData = await this.plugin.cacheManager.getCalendarData(currentYear, currentMonth);
            dailyNotesCache = calendarData.dailyNotes;
        } else {
            // Get calendar data from file indexer
            const calendarData = await this.plugin.cacheManager.getCalendarData(currentYear, currentMonth);
            dailyNotesCache = calendarData.dailyNotes;
        }
        
        
        // Find all calendar days
        const calendarDays = this.contentEl.querySelectorAll('.mini-calendar-view__day');
        
        // Add daily note indicators
        calendarDays.forEach(day => {
            const dateText = (day as HTMLElement).innerText.trim();
            if (dateText) {
                // Create the date string in yyyy-MM-dd format
                const year = this.plugin.selectedDate.getFullYear();
                const month = this.plugin.selectedDate.getMonth();
                const date = parseInt(dateText);
                
                // Skip if the date is not valid
                if (isNaN(date)) return;
                
                // Use cached month calculation for better performance
                const cacheKey = `${year}-${month}-${date}-${day.classList.contains('mini-calendar-view__day--outside-month')}`;
                let cachedResult = this.monthCalculationCache.get(cacheKey);
                
                if (!cachedResult) {
                    // Adjust for days outside current month
                    let actualMonth = month;
                    if (day.classList.contains('mini-calendar-view__day--outside-month')) {
                        if (date > 15) { // Probably previous month
                            actualMonth = month === 0 ? 11 : month - 1;
                        } else { // Probably next month
                            actualMonth = month === 11 ? 0 : month + 1;
                        }
                    }
                    
                    const dateObj = createSafeDate(year, actualMonth, date);
                    const dateKey = formatDateForStorage(dateObj);
                    
                    cachedResult = { actualMonth, dateObj, dateKey };
                    this.monthCalculationCache.set(cacheKey, cachedResult);
                }
                
                // Format the date as the file basename
                const dateStr = cachedResult.dateKey;
                
                // Check if we have a daily note for this date
                if (dailyNotesCache.has(dateStr)) {
                    // Create indicator element
                    const indicator = document.createElement('div');
                    indicator.className = 'daily-note-indicator';
                    
                    // Add class to the day
                    day.classList.add('mini-calendar-view__day--has-daily-note');
                    
                    // Add tooltip for daily note
                    indicator.setAttribute('aria-label', 'Daily note exists');
                    setTooltip(indicator, 'Daily note exists', { placement: 'top' });
                    
                    // Add indicator to the day cell
                    day.appendChild(indicator);
                }
            }
        });
    }
    
    /**
     * Handle granular task updates without full calendar re-colorization
     */
    private handleTaskUpdate(originalTask: TaskInfo | undefined, updatedTask: TaskInfo) {
        // Only perform granular updates if we're in tasks mode
        if (this.colorizeMode !== 'tasks') {
            return;
        }
        
        // Get the dates that might be affected by this change
        const affectedDates = new Set<string>();
        
        // Add original due date if it exists
        if (originalTask?.due) {
            affectedDates.add(getDatePart(originalTask.due));
        }
        
        // Add new due date if it exists
        if (updatedTask.due) {
            affectedDates.add(getDatePart(updatedTask.due));
        }
        
        // Add original scheduled date if it exists
        if (originalTask?.scheduled) {
            affectedDates.add(getDatePart(originalTask.scheduled));
        }
        
        // Add new scheduled date if it exists
        if (updatedTask.scheduled) {
            affectedDates.add(getDatePart(updatedTask.scheduled));
        }
        
        // If no dates are affected, nothing to update
        if (affectedDates.size === 0) {
            return;
        }
        
        // Update only the affected calendar cells
        this.updateCalendarCellsForDates(Array.from(affectedDates));
    }
    
    /**
     * Update specific calendar cells for given dates with optimized DOM updates
     */
    private async updateCalendarCellsForDates(dates: string[]) {
        if (dates.length === 0) return;
        
        // Get current calendar data
        const currentYear = this.plugin.selectedDate.getFullYear();
        const currentMonth = this.plugin.selectedDate.getMonth();
        const calendarData = await this.plugin.cacheManager.getCalendarData(currentYear, currentMonth);
        const tasksCache = calendarData.tasks;
        
        // Cache calendar day elements if needed or invalidate if month changed
        const currentCacheKey = `${currentYear}-${currentMonth}`;
        if (this.currentCacheKey !== currentCacheKey || !this.calendarDayElements) {
            this.calendarDayElements = this.contentEl.querySelectorAll('.mini-calendar-view__day');
            this.currentCacheKey = currentCacheKey;
            this.buildElementToDateMap(currentYear, currentMonth);
        }
        
        // Create a set for O(1) lookup
        const datesToUpdate = new Set(dates);
        
        // Use document fragment for batch DOM updates
        const elementsToUpdate: { element: HTMLElement; dateKey: string }[] = [];
        
        // Note: Only updating visible elements based on cached map
        
        // Build list of elements to update using the cached map
        for (const [element, dateInfo] of this.elementToDateMap) {
            if (datesToUpdate.has(dateInfo.dateKey)) {
                elementsToUpdate.push({ element: element as HTMLElement, dateKey: dateInfo.dateKey });
            }
        }
        
        // Batch update all elements using requestAnimationFrame for better performance
        requestAnimationFrame(() => {
            elementsToUpdate.forEach(({ element, dateKey }) => {
                this.updateSingleCalendarCell(element, dateKey, tasksCache);
            });
        });
    }
    
    /**
     * Update a single calendar cell with task data
     */
    private updateSingleCalendarCell(dayEl: HTMLElement, dateKey: string, tasksCache: Map<string, any>) {
        // Remove existing task indicators and classes
        dayEl.querySelectorAll('.task-indicator').forEach(el => el.remove());
        dayEl.classList.remove('has-tasks', 'has-scheduled-tasks', 'has-completed-tasks', 'has-archived-tasks');
        
        // Get task info for this date
        const taskInfo = tasksCache.get(dateKey);
        
        if (taskInfo && (taskInfo.hasDue || taskInfo.hasScheduled)) {
            // Create indicator element
            const indicator = document.createElement('div');
            indicator.className = 'task-indicator';
            
            // Different styling for completed, due, scheduled, and archived tasks
            // Priority order: archived > completed > due > scheduled
            let taskStatus = '';
            if (taskInfo.hasArchived) {
                // Archived tasks get a different style
                dayEl.classList.add('has-archived-tasks');
                indicator.classList.add('archived-tasks');
                taskStatus = 'Archived';
            } else if (taskInfo.hasCompleted) {
                // Completed tasks
                dayEl.classList.add('has-completed-tasks');
                indicator.classList.add('completed-tasks');
                taskStatus = 'Completed';
            } else if (taskInfo.hasDue) {
                // Due tasks (prioritized over scheduled)
                dayEl.classList.add('has-tasks');
                indicator.classList.add('due-tasks');
                taskStatus = 'Due';
            } else if (taskInfo.hasScheduled) {
                // Scheduled tasks
                dayEl.classList.add('has-scheduled-tasks');
                indicator.classList.add('scheduled-tasks');
                taskStatus = 'Scheduled';
            }
            
            // Add tooltip with task count information
            indicator.setAttribute('aria-label', `${taskStatus} tasks (${taskInfo.count})`);
            setTooltip(indicator, `${taskStatus} tasks (${taskInfo.count})`, { placement: 'top' });
            
            // Add indicator to the day cell
            dayEl.appendChild(indicator);
        }
    }
    
    /**
     * Get the actual date that a calendar cell represents
     */
    private getCellDate(dayEl: HTMLElement, dayNum: number, currentYear: number, currentMonth: number): Date | null {
        // Determine which month this cell actually represents
        let actualMonth = currentMonth;
        
        if (dayEl.classList.contains('outside-month')) {
            if (dayNum > 15) { // Probably previous month
                actualMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            } else { // Probably next month
                actualMonth = currentMonth === 11 ? 0 : currentMonth + 1;
            }
        }
        
        try {
            return createSafeUTCDate(currentYear, actualMonth, dayNum);
        } catch (error) {
            console.error('Error creating date:', error);
            return null;
        }
    }
    
    /**
     * Build a map of calendar elements to their corresponding dates for efficient lookups
     */
    private buildElementToDateMap(currentYear: number, currentMonth: number): void {
        this.elementToDateMap.clear();
        
        if (!this.calendarDayElements) return;
        
        this.calendarDayElements.forEach(element => {
            const dayEl = element as HTMLElement;
            const dateText = dayEl.innerText.trim();
            
            if (!dateText || isNaN(parseInt(dateText))) return;
            
            const date = parseInt(dateText);
            const cellDate = this.getCellDate(dayEl, date, currentYear, currentMonth);
            
            if (cellDate) {
                const dateKey = formatDateForStorage(cellDate);
                this.elementToDateMap.set(element, { date, dateKey });
            }
        });
    }
    
    /**
     * Clear month calculation cache when month changes
     */
    private clearMonthCalculationCache(): void {
        // Only keep cache for current month to prevent memory buildup
        const currentCachePrefix = `${this.plugin.selectedDate.getFullYear()}-${this.plugin.selectedDate.getMonth()}`;
        
        for (const [key] of this.monthCalculationCache) {
            if (!key.startsWith(currentCachePrefix)) {
                this.monthCalculationCache.delete(key);
            }
        }
    }
    
    /**
     * Initialize debounced refresh function
     */
    private initializeDebouncedRefresh(): void {
        if (!this.debouncedRefresh) {
            this.debouncedRefresh = debounce(() => {
                this.refresh();
            }, 150); // 150ms debounce for calendar refreshes
        }
    }
    
    
    // Helper methods for date calculations
    getViewStartDate(): Date {
        // First day of the month
        return createSafeDate(this.plugin.selectedDate.getFullYear(), this.plugin.selectedDate.getMonth(), 1);
    }
    
    getViewEndDate(): Date {
        // Last day of the month
        return createSafeDate(this.plugin.selectedDate.getFullYear(), this.plugin.selectedDate.getMonth() + 1, 0);
    }
    
    // Helper method to show day preview on hover
    private showDayPreview(event: MouseEvent, date: Date, targetEl: HTMLElement) {
        // Get the daily note path for this date
        const dailyNotePath = this.getDailyNotePath(date);
        if (!dailyNotePath) {
            return; // No daily note exists for this date
        }
        const dailyNoteFile = this.app.vault.getAbstractFileByPath(dailyNotePath);
        
        if (dailyNoteFile && dailyNoteFile instanceof TFile) {
            // Show preview for the daily note only
            this.app.workspace.trigger('hover-link', {
                event,
source: 'tasknotes-calendar',
                hoverParent: this,
                targetEl: targetEl,
                linktext: dailyNotePath,
                sourcePath: dailyNotePath
            });
        }
        // If no daily note exists, don't show any preview
    }
    
    // Helper method to get daily note path for a date
    private getDailyNotePath(date: Date): string | null {
        try {
            const moment = (window as any).moment(date);
            const allDailyNotes = getAllDailyNotes();
            const dailyNote = getDailyNote(moment, allDailyNotes);
            return dailyNote ? dailyNote.path : null;
        } catch (error) {
            // Daily Notes interface not available, return null
            return null;
        }
    }
    
    /**
     * Add drag and drop handlers to calendar day elements for task date assignment
     */
    private addDropHandlers(dayEl: HTMLElement, dayDate: Date): void {
        dayEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'move';
            dayEl.classList.add('mini-calendar-view__day--dragover');
        });

        dayEl.addEventListener('dragleave', (e) => {
            // Only remove styling if we're actually leaving the day element
            if (!dayEl.contains(e.relatedTarget as Node)) {
                dayEl.classList.remove('mini-calendar-view__day--dragover');
            }
        });

        dayEl.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Remove drop styling
            dayEl.classList.remove('mini-calendar-view__day--dragover');
            
            try {
                // Get task path from drag data
                const taskPath = e.dataTransfer?.getData('text/plain') ||
                               e.dataTransfer?.getData('application/x-task-path');
                
                if (!taskPath) {
                    console.warn('No task path found in drop data');
                    return;
                }
                
                // Get the task info
                const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
                if (!task) {
                    console.warn('Task not found:', taskPath);
                    return;
                }
                
                // Format the date for task due date (all-day)
                const dueDate = formatDateForStorage(dayDate);
                
                // Update the task's due date
                await this.plugin.taskService.updateProperty(task, 'due', dueDate);
                
                
                // Show success feedback
                new Notice(`Task "${task.title}" due date set to ${format(dayDate, 'MMM d, yyyy')}`);
                
                // Refresh calendar to show the new task assignment
                this.refresh();
                
            } catch (error) {
                console.error('Error handling task drop on mini calendar:', error);
                new Notice('Failed to update task due date');
            }
        });
    }
    
}
