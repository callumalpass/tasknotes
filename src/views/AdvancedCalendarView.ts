import { ItemView, WorkspaceLeaf, TFile, Notice, EventRef, Menu, Modal, setTooltip } from 'obsidian';
import { ICSEventInfoModal } from '../modals/ICSEventInfoModal';
import { TimeblockInfoModal } from '../modals/TimeblockInfoModal';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Calendar } from '@fullcalendar/core';
import { 
    createDailyNote, 
    getDailyNote, 
    getAllDailyNotes,
    appHasDailyNotesPluginLoaded
} from 'obsidian-daily-notes-interface';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import TaskNotesPlugin from '../main';
import {
    ADVANCED_CALENDAR_VIEW_TYPE,
    EVENT_DATA_CHANGED,
    EVENT_TASK_UPDATED,
    EVENT_TIMEBLOCKING_TOGGLED,
    TaskInfo,
    TimeBlock,
    FilterQuery,
    CalendarViewPreferences,
    ICSEvent
} from '../types';
import { TaskCreationModal } from '../modals/TaskCreationModal';
import { TaskEditModal } from '../modals/TaskEditModal';
import { UnscheduledTasksSelectorModal, ScheduleTaskOptions } from '../modals/UnscheduledTasksSelectorModal';
import { TimeblockCreationModal } from '../modals/TimeblockCreationModal';
import { FilterBar } from '../ui/FilterBar';
import { showTaskContextMenu } from '../ui/TaskCard';
import { 
    hasTimeComponent, 
    getDatePart, 
    getTimePart,
    parseDate,
    normalizeCalendarBoundariesToUTC,
    formatUTCDateForCalendar,
    formatDateForStorage,
    getTodayLocal
} from '../utils/dateUtils';
import { 
    generateRecurringInstances,
    extractTimeblocksFromNote,
    timeblockToCalendarEvent,
    updateTimeblockInDailyNote
} from '../utils/helpers';

interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end?: string;
    allDay: boolean;
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    editable?: boolean;
    extendedProps: {
        taskInfo?: TaskInfo;
        icsEvent?: ICSEvent;
        timeblock?: TimeBlock;
        eventType: 'scheduled' | 'due' | 'timeEntry' | 'recurring' | 'ics' | 'timeblock';
        isCompleted?: boolean;
        isRecurringInstance?: boolean;
        instanceDate?: string; // YYYY-MM-DD for this specific occurrence
        recurringTemplateTime?: string; // Original scheduled time
        subscriptionName?: string; // For ICS events
        attachments?: string[]; // For timeblocks
    };
}

export class AdvancedCalendarView extends ItemView {
    plugin: TaskNotesPlugin;
    private calendar: Calendar | null = null;
    private listeners: EventRef[] = [];
    private functionListeners: (() => void)[] = [];
    
    // Resize handling
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimeout: number | null = null;
    
    // Filter system
    private filterBar: FilterBar | null = null;
    private currentQuery: FilterQuery;
    
    // View toggles (keeping for calendar-specific display options)
    private showScheduled: boolean;
    private showDue: boolean;
    private showTimeEntries: boolean;
    private showRecurring: boolean;
    private showICSEvents: boolean;
    private showTimeblocks: boolean;
    
    // Mobile collapsible header state
    private headerCollapsed = true;

    constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
        super(leaf);
        this.plugin = plugin;
        
        // Initialize view toggles from settings defaults (will be overridden by saved preferences in onOpen)
        this.showScheduled = this.plugin.settings.calendarViewSettings.defaultShowScheduled;
        this.showDue = this.plugin.settings.calendarViewSettings.defaultShowDue;
        this.showTimeEntries = this.plugin.settings.calendarViewSettings.defaultShowTimeEntries;
        this.showRecurring = this.plugin.settings.calendarViewSettings.defaultShowRecurring;
        this.showICSEvents = this.plugin.settings.calendarViewSettings.defaultShowICSEvents;
        this.showTimeblocks = this.plugin.settings.calendarViewSettings.defaultShowTimeblocks;
        
        // Initialize with default query - will be properly set when plugin services are ready
        this.currentQuery = {
            type: 'group',
            id: 'temp',
            conjunction: 'and',
            children: [],
            sortKey: 'due',
            sortDirection: 'asc',
            groupKey: 'none'
        };
    }

    getViewType(): string {
        return ADVANCED_CALENDAR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Advanced Calendar';
    }

    getIcon(): string {
        return 'calendar-range';
    }

    async onOpen() {
        await this.plugin.onReady();
        
        // Wait for migration to complete before initializing UI
        await this.plugin.waitForMigration();
        
        // Load saved filter state
        const savedQuery = this.plugin.viewStateManager.getFilterState(ADVANCED_CALENDAR_VIEW_TYPE);
        if (savedQuery) {
            this.currentQuery = savedQuery;
        } else if (this.plugin.filterService) {
            this.currentQuery = this.plugin.filterService.createDefaultQuery();
        }
        
        // Load saved view preferences (toggle states)
        const savedPreferences = this.plugin.viewStateManager.getViewPreferences<CalendarViewPreferences>(ADVANCED_CALENDAR_VIEW_TYPE);
        if (savedPreferences) {
            this.showScheduled = savedPreferences.showScheduled;
            this.showDue = savedPreferences.showDue;
            this.showTimeEntries = savedPreferences.showTimeEntries;
            this.showRecurring = savedPreferences.showRecurring;
            this.showICSEvents = savedPreferences.showICSEvents ?? this.plugin.settings.calendarViewSettings.defaultShowICSEvents;
            this.showTimeblocks = savedPreferences.showTimeblocks ?? this.plugin.settings.calendarViewSettings.defaultShowTimeblocks;
            this.headerCollapsed = savedPreferences.headerCollapsed ?? true;
        }

        // Ensure initialization
        const init = async () => {
            // Cleanup old calendar if it exists
            const contentEl = this.contentEl;
            contentEl.empty();
            contentEl.addClass('tasknotes-plugin');
            contentEl.addClass('advanced-calendar-view');

            // Re-render the view
            await this.renderView();
            this.registerEvents();

            // Initialize the calendar
            await this.initializeCalendar();            
        }

        await init();

        // Re-initialize on window migration
        this.contentEl.onWindowMigrated(init);
    }

    async renderView() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Create main layout container
        const mainContainer = contentEl.createDiv({ cls: 'advanced-calendar-view__container' });
        
        // Create header with controls
        await this.createHeader(mainContainer);
        
        // Create calendar container (now full width)
        mainContainer.createDiv({ 
            cls: 'advanced-calendar-view__calendar-container',
            attr: { id: 'advanced-calendar' }
        });       
    }

    async createHeader(container: HTMLElement) {
        const header = container.createDiv({ cls: 'advanced-calendar-view__header' });
        
        // Create mobile collapse toggle (only visible on mobile)
        const mobileToggle = header.createDiv({ cls: 'advanced-calendar-view__mobile-toggle' });
        const toggleBtn = mobileToggle.createEl('button', {
            text: this.headerCollapsed ? 'Show filters' : 'Hide filters',
            cls: 'advanced-calendar-view__collapse-btn'
        });
        toggleBtn.addEventListener('click', () => {
            this.headerCollapsed = !this.headerCollapsed;
            toggleBtn.textContent = this.headerCollapsed ? 'Show filters' : 'Hide filters';
            this.saveViewPreferences();
            this.updateHeaderVisibility();
        });
        
        // Create main header row that can contain both FilterBar and controls
        const mainRow = header.createDiv({ 
            cls: `advanced-calendar-view__main-row ${this.headerCollapsed ? 'collapsed' : 'expanded'}`
        });
        
        // Create FilterBar section
        const filterBarContainer = mainRow.createDiv({ cls: 'filter-bar-container' });
        
        // Wait for cache to be initialized with actual data
        await this.waitForCacheReady();
        
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
        });
        
        this.filterBar.on('deleteView', (viewId: string) => {
            this.plugin.viewStateManager.deleteView(viewId);
        });

        // Listen for view options load events
        this.filterBar.on('loadViewOptions', (viewOptions: {[key: string]: boolean}) => {
            this.applyViewOptions(viewOptions);
        });

        // Listen for global saved views changes
        this.plugin.viewStateManager.on('saved-views-changed', (updatedViews) => {
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
            await this.plugin.viewStateManager.setFilterState(ADVANCED_CALENDAR_VIEW_TYPE, newQuery);
            this.refreshEvents();
        });

        // Set up view-specific options
        this.setupViewOptions();
        
    }
    
    private updateHeaderVisibility() {
        const mainRow = this.contentEl.querySelector('.advanced-calendar-view__main-row');
        if (mainRow) {
            mainRow.className = `advanced-calendar-view__main-row ${this.headerCollapsed ? 'collapsed' : 'expanded'}`;
        }
        
        // Update FullCalendar header toolbar visibility
        if (this.calendar) {
            this.calendar.setOption('headerToolbar', this.getHeaderToolbarConfig());
        }
    }

    private setupViewOptions(): void {
        if (!this.filterBar) return;

        const options = [
            {
                id: 'icsEvents',
                label: 'Calendar subscriptions',
                value: this.showICSEvents,
                onChange: (value: boolean) => {
                    this.showICSEvents = value;
                    this.saveViewPreferences();
                    this.refreshEvents();
                }
            },
            {
                id: 'timeEntries',
                label: 'Time entries',
                value: this.showTimeEntries,
                onChange: (value: boolean) => {
                    this.showTimeEntries = value;
                    this.saveViewPreferences();
                    this.refreshEvents();
                }
            },
            {
                id: 'timeblocks',
                label: 'Timeblocks',
                value: this.showTimeblocks,
                onChange: (value: boolean) => {
                    this.showTimeblocks = value;
                    this.saveViewPreferences();
                    this.refreshEvents();
                }
            },
            {
                id: 'scheduled',
                label: 'Scheduled dates',
                value: this.showScheduled,
                onChange: (value: boolean) => {
                    this.showScheduled = value;
                    this.saveViewPreferences();
                    this.refreshEvents();
                }
            },
            {
                id: 'due',
                label: 'Due dates',
                value: this.showDue,
                onChange: (value: boolean) => {
                    this.showDue = value;
                    this.saveViewPreferences();
                    this.refreshEvents();
                }
            }
        ];
        
        // Only add timeblocks option if enabled
        if (this.plugin.settings.calendarViewSettings.enableTimeblocking) {
            // timeblocks option is already included above
        } else {
            // Remove timeblocks option if timeblocking is disabled
            const timeblockIndex = options.findIndex(opt => opt.id === 'timeblocks');
            if (timeblockIndex !== -1) {
                options.splice(timeblockIndex, 1);
            }
        }

        this.filterBar.setViewOptions(options);
    }


    // View options handling for FilterBar integration
    getViewOptionsConfig() {
        const options = [
            { id: 'scheduled', label: 'Scheduled tasks', value: this.showScheduled },
            { id: 'due', label: 'Due dates', value: this.showDue },
            { id: 'timeEntries', label: 'Time entries', value: this.showTimeEntries },
            { id: 'recurring', label: 'Recurring tasks', value: this.showRecurring },
            { id: 'icsEvents', label: 'Calendar subscriptions', value: this.showICSEvents }
        ];
        
        // Add timeblocks option if enabled
        if (this.plugin.settings.calendarViewSettings.enableTimeblocking) {
            options.push({ id: 'timeblocks', label: 'Timeblocks', value: this.showTimeblocks });
        }
        
        return options;
    }
    
    onViewOptionChange(optionId: string, enabled: boolean) {
        switch (optionId) {
            case 'scheduled':
                this.showScheduled = enabled;
                break;
            case 'due':
                this.showDue = enabled;
                break;
            case 'timeEntries':
                this.showTimeEntries = enabled;
                break;
            case 'recurring':
                this.showRecurring = enabled;
                break;
            case 'icsEvents':
                this.showICSEvents = enabled;
                break;
            case 'timeblocks':
                this.showTimeblocks = enabled;
                break;
        }
        
        this.saveViewPreferences();
        this.refreshEvents();
        
        // Update FilterBar view options to reflect the change
        this.setupViewOptions();
    }
    
    private getHeaderToolbarConfig() {
        // Hide FullCalendar header on mobile when collapsed
        if (this.headerCollapsed && window.innerWidth <= 768) {
            return false; // This hides the entire header toolbar
        }
        
        // Check if calendar container is narrow (less than 600px wide) to hide title
        const calendarContainer = this.contentEl.querySelector('.advanced-calendar-view__calendar-container');
        const containerWidth = calendarContainer ? calendarContainer.getBoundingClientRect().width : window.innerWidth;
        const isNarrowView = containerWidth <= 600;
        
        const toolbarConfig = {
            left: 'prev,next today',
            center: isNarrowView ? '' : 'title', // Hide title in narrow views
            right: 'refreshICS multiMonthYear,dayGridMonth,timeGridWeek,timeGridCustom,timeGridDay'
        };
        console.log('Header toolbar config:', toolbarConfig);
        return toolbarConfig;
    }

    private getCustomButtons() {
        const customButtons = {
            refreshICS: {
                text: 'Refresh',
                hint: 'Refresh Calendar Subscriptions',
                click: () => {
                    console.log('Refresh ICS button clicked!');
                    this.handleRefreshClick();
                }
            }
        };
        console.log('Custom buttons:', customButtons);
        return customButtons;
    }

    private async handleRefreshClick() {
        if (!this.plugin.icsSubscriptionService) {
            new Notice('ICS subscription service not available');
            return;
        }
        
        try {
            await this.plugin.icsSubscriptionService.refreshAllSubscriptions();
            new Notice('All calendar subscriptions refreshed successfully');
            // Force calendar to re-render with updated ICS events
            this.refreshEvents();
        } catch (error) {
            console.error('Error refreshing subscriptions:', error);
            new Notice('Failed to refresh some calendar subscriptions');
        }
    }

    

    openScheduleTasksModal() {
        const modal = new UnscheduledTasksSelectorModal(
            this.app,
            this.plugin,
            (task: TaskInfo | null, options?: ScheduleTaskOptions) => {
                if (task) {
                    this.scheduleTask(task, options);
                }
            }
        );
        modal.open();
    }

    async scheduleTask(task: TaskInfo, options?: ScheduleTaskOptions) {
        try {
            let scheduledDate: string;
            
            if (options?.date) {
                if (options.allDay) {
                    scheduledDate = formatDateForStorage(options.date);
                } else if (options.time) {
                    scheduledDate = formatDateForStorage(options.date) + 'T' + options.time;
                } else {
                    // Default to 9 AM if no time specified
                    scheduledDate = formatDateForStorage(options.date) + 'T09:00';
                }
            } else {
                // Default to today at 9 AM
                scheduledDate = formatDateForStorage(getTodayLocal()) + 'T09:00';
            }
            
            await this.plugin.taskService.updateProperty(task, 'scheduled', scheduledDate);
        } catch (error) {
            console.error('Error scheduling task:', error);
        }
    }

    async initializeCalendar() {
        const calendarEl = this.contentEl.querySelector('#advanced-calendar');
        if (!calendarEl) {
            console.error('Calendar element not found');
            return;
        }

        const calendarSettings = this.plugin.settings.calendarViewSettings;
        
        // Apply today highlight setting
        this.updateTodayHighlight();
        
        const customButtons = this.getCustomButtons();
        const headerToolbar = this.getHeaderToolbarConfig();
        
        console.log('Initializing calendar with customButtons:', customButtons);
        console.log('Initializing calendar with headerToolbar:', headerToolbar);
        
        this.calendar = new Calendar(calendarEl as HTMLElement, {
            plugins: [dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin],
            initialView: calendarSettings.defaultView,
            headerToolbar: headerToolbar,
            customButtons: customButtons,
            views: {
                timeGridCustom: {
                    type: 'timeGrid',
                    duration: { days: calendarSettings.customDayCount || 3 },
                    buttonText: `${calendarSettings.customDayCount || 3} days`
                }
            },
            height: '100%',
            editable: true,
            droppable: true,
            selectable: true,
            selectMirror: calendarSettings.selectMirror,
            
            // Locale settings - use browser locale for date formatting
            locale: this.getUserLocale(),
            
            // Week settings
            firstDay: calendarSettings.firstDay,
            weekNumbers: calendarSettings.weekNumbers,
            weekends: calendarSettings.showWeekends,
            
            // Current time indicator
            nowIndicator: calendarSettings.nowIndicator,
            
            // Enable clickable date titles
            navLinks: true,
            navLinkDayClick: this.handleDateTitleClick.bind(this),
            
            // Time view configuration
            slotMinTime: calendarSettings.slotMinTime,
            slotMaxTime: calendarSettings.slotMaxTime,
            scrollTime: calendarSettings.scrollTime,
            
            // Time grid configurations
            slotDuration: calendarSettings.slotDuration,
            slotLabelInterval: this.getSlotLabelInterval(calendarSettings.slotDuration),
            
            // Time format
            eventTimeFormat: this.getTimeFormat(calendarSettings.timeFormat),
            slotLabelFormat: this.getTimeFormat(calendarSettings.timeFormat),
            
            // Event handlers
            select: this.handleDateSelect.bind(this),
            eventClick: this.handleEventClick.bind(this),
            eventDrop: this.handleEventDrop.bind(this),
            eventResize: this.handleEventResize.bind(this),
            drop: this.handleExternalDrop.bind(this),
            eventReceive: this.handleEventReceive.bind(this),
            eventDidMount: this.handleEventDidMount.bind(this),
            
            // Event sources will be added dynamically
            events: this.getCalendarEvents.bind(this)
        });

        // Defer rendering to next frame to avoid forced reflow during window transitions
        requestAnimationFrame(() => {
            if (this.calendar) {
                this.calendar.render();
                // Set up resize handling after initial render
                this.setupResizeHandling();
                // Refresh events to ensure initial state is correct
                this.refreshEvents();
            }
        });
    }

    private saveViewPreferences(): void {
        const preferences: CalendarViewPreferences = {
            showScheduled: this.showScheduled,
            showDue: this.showDue,
            showTimeEntries: this.showTimeEntries,
            showRecurring: this.showRecurring,
            showICSEvents: this.showICSEvents,
            showTimeblocks: this.showTimeblocks,
            headerCollapsed: this.headerCollapsed
        };
        this.plugin.viewStateManager.setViewPreferences(ADVANCED_CALENDAR_VIEW_TYPE, preferences);
    }

    /**
     * Apply view options from a loaded saved view
     */
    private applyViewOptions(viewOptions: {[key: string]: boolean}): void {
        // Apply the loaded view options to the internal state
        if (viewOptions.hasOwnProperty('showScheduled')) {
            this.showScheduled = viewOptions.showScheduled;
        }
        if (viewOptions.hasOwnProperty('showDue')) {
            this.showDue = viewOptions.showDue;
        }
        if (viewOptions.hasOwnProperty('showTimeEntries')) {
            this.showTimeEntries = viewOptions.showTimeEntries;
        }
        if (viewOptions.hasOwnProperty('showRecurring')) {
            this.showRecurring = viewOptions.showRecurring;
        }
        if (viewOptions.hasOwnProperty('showICSEvents')) {
            this.showICSEvents = viewOptions.showICSEvents;
        }
        if (viewOptions.hasOwnProperty('showTimeblocks')) {
            this.showTimeblocks = viewOptions.showTimeblocks;
        }

        // Update the view options in the FilterBar to reflect the loaded state
        this.setupViewOptions();
        
        // Refresh the calendar to apply the changes
        this.refreshEvents();
    }

    private setupResizeHandling(): void {
        if (!this.calendar) return;

        // Clean up previous resize handling
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        if (this.resizeTimeout) {
            window.clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        // Clean up previous listeners
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        this.functionListeners = [];
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.listeners = [];

        // Use the correct window reference (supports popout windows)
        const win = this.contentEl.ownerDocument.defaultView || window;

        // Debounced resize handler
        const debouncedResize = () => {
            if (this.resizeTimeout) {
                win.clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = win.setTimeout(() => {
                if (this.calendar) {
                    this.calendar.updateSize();
                    // Update header toolbar to handle narrow view title visibility
                    this.updateHeaderVisibility();
                }
            }, 150);
        };

        // Use ResizeObserver to detect container size changes
        if (win.ResizeObserver) {
            this.resizeObserver = new win.ResizeObserver(debouncedResize);
            const calendarContainer = this.contentEl.querySelector('.advanced-calendar-view__calendar-container');
            if (calendarContainer) {
                this.resizeObserver.observe(calendarContainer);
            }
        }

        // Listen for workspace layout changes (Obsidian-specific)
        const layoutChangeListener = this.plugin.app.workspace.on('layout-change', debouncedResize);
        this.listeners.push(layoutChangeListener);

        // Listen for window resize as fallback
        win.addEventListener('resize', debouncedResize);
        this.functionListeners.push(() => win.removeEventListener('resize', debouncedResize));

        // Listen for active leaf changes that might affect calendar size
        const activeLeafListener = this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
            if (leaf === this.leaf) {
                // Small delay to ensure layout has settled after leaf activation
                setTimeout(debouncedResize, 100);
            }
        });
        
        this.listeners.push(activeLeafListener);
    }

    private getSlotLabelInterval(slotDuration: string): string {
        // Show labels every hour, but at least as often as the slot duration
        switch (slotDuration) {
            case '00:15:00': return '01:00:00'; // 15-min slots, hourly labels
            case '00:30:00': return '01:00:00'; // 30-min slots, hourly labels  
            case '01:00:00': return '01:00:00'; // 1-hour slots, hourly labels
            default: return '01:00:00';
        }
    }

    private getUserLocale(): string {
        // Try to get the user's locale in order of preference:
        // 1. Browser language (most specific)
        // 2. Obsidian locale if available 
        // 3. System language
        // 4. Default to 'en' as fallback
        
        // Check browser language first
        if (navigator.language) {
            return navigator.language;
        }
        
        // Check for system languages array
        if (navigator.languages && navigator.languages.length > 0) {
            return navigator.languages[0];
        }
        
        // Check for older browser support
        const legacyLocale = (navigator as any).userLanguage || (navigator as any).browserLanguage;
        if (legacyLocale) {
            return legacyLocale;
        }
        
        // Default fallback
        return 'en';
    }

    private getTimeFormat(timeFormat: '12' | '24'): any {
        if (timeFormat === '12') {
            return {
                hour: 'numeric',
                minute: '2-digit',
                omitZeroMinute: true,
                hour12: true
            };
        } else {
            return {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            };
        }
    }

    async getCalendarEvents(): Promise<CalendarEvent[]> {
        const events: CalendarEvent[] = [];
        
        try {
            // Get filtered tasks from FilterService
            const groupedTasks = await this.plugin.filterService.getGroupedTasks(this.currentQuery);
            
            // Flatten grouped tasks since calendar doesn't use grouping
            const allTasks: TaskInfo[] = [];
            for (const tasks of groupedTasks.values()) {
                allTasks.push(...tasks);
            }
            
            // Get calendar's visible date range for recurring task generation
            const calendarView = this.calendar?.view;
            const today = getTodayLocal();
            const rawVisibleStart = calendarView?.activeStart || startOfDay(today);
            const rawVisibleEnd = calendarView?.activeEnd || endOfDay(today);
            
            // Normalize FullCalendar boundaries to UTC to prevent timezone mismatches with RRule
            const { utcStart: visibleStart, utcEnd: visibleEnd } = normalizeCalendarBoundariesToUTC(rawVisibleStart, rawVisibleEnd);
            
            for (const task of allTasks) {
                // Apply different rules for recurring vs non-recurring tasks
                if (task.recurrence) {
                    // Recurring tasks: require scheduled date (scheduled date determines recurrence start)
                    if (!task.scheduled) {
                        continue;
                    }
                    
                    // Handle recurring tasks
                    if (this.showRecurring) {
                        const recurringEvents = this.generateRecurringTaskInstances(task, visibleStart, visibleEnd);
                        events.push(...recurringEvents);
                    }
                } else {
                    // Non-recurring tasks: show on scheduled date OR due date
                    const hasScheduled = !!task.scheduled;
                    const hasDue = !!task.due;
                    
                    // Skip if neither scheduled nor due date exists
                    if (!hasScheduled && !hasDue) {
                        continue;
                    }
                    
                    // Add scheduled event if task has scheduled date
                    if (this.showScheduled && hasScheduled) {
                        const scheduledEvent = this.createScheduledEvent(task);
                        if (scheduledEvent) events.push(scheduledEvent);
                    }
                    
                    // Add due event if task has due date
                    if (this.showDue && hasDue) {
                        const dueEvent = this.createDueEvent(task);
                        if (dueEvent) events.push(dueEvent);
                    }
                }
                
                // Add time entry events
                if (this.showTimeEntries && task.timeEntries) {
                    const timeEvents = this.createTimeEntryEvents(task);
                    events.push(...timeEvents);
                }
            }

            // Add ICS events
            if (this.showICSEvents && this.plugin.icsSubscriptionService) {
                const icsEvents = this.plugin.icsSubscriptionService.getAllEvents();
                for (const icsEvent of icsEvents) {
                    const calendarEvent = this.createICSEvent(icsEvent);
                    if (calendarEvent) {
                        events.push(calendarEvent);
                    }
                }
            }
        } catch (error) {
            console.error('Error getting calendar events:', error);
        }
        
        // Add timeblock events if enabled
        if (this.showTimeblocks && this.plugin.settings.calendarViewSettings.enableTimeblocking) {
            try {
                const timeblockEvents = await this.getTimeblockEvents();
                events.push(...timeblockEvents);
            } catch (error) {
                console.error('Error getting timeblock events:', error);
            }
        }
        
        return events;
    }

    createScheduledEvent(task: TaskInfo): CalendarEvent | null {
        if (!task.scheduled) return null;
        
        const hasTime = hasTimeComponent(task.scheduled);
        const startDate = task.scheduled;
        
        let endDate: string | undefined;
        if (hasTime && task.timeEstimate) {
            // Calculate end time based on time estimate
            const start = parseDate(startDate);
            const end = new Date(start.getTime() + (task.timeEstimate * 60 * 1000));
            endDate = format(end, "yyyy-MM-dd'T'HH:mm");
        }
        
        // Get priority-based color for border
        const priorityConfig = this.plugin.priorityManager.getPriorityConfig(task.priority);
        const borderColor = priorityConfig?.color || 'var(--color-accent)';
        
        // Check if task is completed
        const isCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
        
        return {
            id: `scheduled-${task.path}`,
            title: task.title,
            start: startDate,
            end: endDate,
            allDay: !hasTime,
            backgroundColor: 'transparent',
            borderColor: borderColor,
            textColor: borderColor,
            editable: true, // Tasks are also editable
            extendedProps: {
                taskInfo: task,
                eventType: 'scheduled',
                isCompleted: isCompleted
            }
        };
    }

    createDueEvent(task: TaskInfo): CalendarEvent | null {
        if (!task.due) return null;
        
        const hasTime = hasTimeComponent(task.due);
        const startDate = task.due;
        
        let endDate: string | undefined;
        if (hasTime) {
            // Fixed duration for due events (30 minutes)
            const start = parseDate(startDate);
            const end = new Date(start.getTime() + (30 * 60 * 1000));
            endDate = format(end, "yyyy-MM-dd'T'HH:mm");
        }
        
        // Get priority-based color with faded background
        const priorityConfig = this.plugin.priorityManager.getPriorityConfig(task.priority);
        const borderColor = priorityConfig?.color || 'var(--color-orange)';
        
        // Create faded background color from priority color
        const fadedBackground = this.hexToRgba(borderColor, 0.15);
        
        // Check if task is completed
        const isCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
        
        return {
            id: `due-${task.path}`,
            title: `DUE: ${task.title}`,
            start: startDate,
            end: endDate,
            allDay: !hasTime,
            backgroundColor: fadedBackground,
            borderColor: borderColor,
            textColor: borderColor,
            editable: false, // Due events are not editable via drag (different from scheduled)
            extendedProps: {
                taskInfo: task,
                eventType: 'due',
                isCompleted: isCompleted
            }
        };
    }

    hexToRgba(hex: string, alpha: number): string {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex color
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    createTimeEntryEvents(task: TaskInfo): CalendarEvent[] {
        if (!task.timeEntries) return [];
        
        // Check if task is completed
        const isCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
        
        return task.timeEntries
            .filter(entry => entry.endTime) // Only completed time entries
            .map((entry, index) => ({
                id: `timeentry-${task.path}-${index}`,
                title: task.title,
                start: entry.startTime,
                end: entry.endTime!,
                allDay: false,
                backgroundColor: 'var(--color-base-50)',
                borderColor: 'var(--color-base-40)',
                textColor: 'var(--text-on-accent)',
                editable: false, // Time entries are read-only
                extendedProps: {
                    taskInfo: task,
                    eventType: 'timeEntry' as const,
                    isCompleted: isCompleted,
                    timeEntryIndex: index
                }
            }));
    }

    createICSEvent(icsEvent: ICSEvent): CalendarEvent | null {
        try {
            // Get subscription info for styling
            const subscription = this.plugin.icsSubscriptionService.getSubscriptions()
                .find(sub => sub.id === icsEvent.subscriptionId);
            
            if (!subscription || !subscription.enabled) {
                return null;
            }

            const backgroundColor = this.hexToRgba(subscription.color, 0.2);
            const borderColor = subscription.color;

            return {
                id: icsEvent.id,
                title: icsEvent.title,
                start: icsEvent.start,
                end: icsEvent.end,
                allDay: icsEvent.allDay,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                textColor: borderColor,
                editable: false, // ICS events are not editable
                extendedProps: {
                    icsEvent: icsEvent,
                    eventType: 'ics',
                    subscriptionName: subscription.name
                }
            };
        } catch (error) {
            console.error('Error creating ICS event:', error);
            return null;
        }
    }

    generateRecurringTaskInstances(task: TaskInfo, startDate: Date, endDate: Date): CalendarEvent[] {
        if (!task.recurrence || !task.scheduled) {
            return [];
        }

        const instances: CalendarEvent[] = [];
        const hasOriginalTime = hasTimeComponent(task.scheduled);
        const templateTime = this.getRecurringTime(task);
        
        // Use the new helper function to generate recurring dates
        const recurringDates = generateRecurringInstances(task, startDate, endDate);
        
        for (const date of recurringDates) {
            // Use UTC-safe formatting to prevent off-by-one date shifts
            const instanceDate = formatUTCDateForCalendar(date);
            
            // Only append time if the original task had a time component
            const eventStart = hasOriginalTime ? `${instanceDate}T${templateTime}` : instanceDate;
            
            // Create the recurring event instance
            const recurringEvent = this.createRecurringEvent(task, eventStart, instanceDate, templateTime);
            if (recurringEvent) {
                instances.push(recurringEvent);
            }
        }

        return instances;
    }

    getRecurringTime(task: TaskInfo): string {
        if (!task.scheduled) return '09:00'; // default
        const timePart = getTimePart(task.scheduled);
        return timePart || '09:00';
    }

    createRecurringEvent(task: TaskInfo, eventStart: string, instanceDate: string, templateTime: string): CalendarEvent | null {
        const hasTime = hasTimeComponent(eventStart);
        
        // Calculate end time if time estimate is available
        let endDate: string | undefined;
        if (hasTime && task.timeEstimate) {
            const start = parseDate(eventStart);
            const end = new Date(start.getTime() + (task.timeEstimate * 60 * 1000));
            endDate = format(end, "yyyy-MM-dd'T'HH:mm");
        }
        
        // Get priority-based color for border
        const priorityConfig = this.plugin.priorityManager.getPriorityConfig(task.priority);
        const borderColor = priorityConfig?.color || 'var(--color-accent)';
        
        // Check if this instance is completed
        const isInstanceCompleted = task.complete_instances?.includes(instanceDate) || false;
        
        // Visual styling for recurring instances
        const backgroundColor = isInstanceCompleted ? 'rgba(0,0,0,0.3)' : 'transparent';
        // Text decoration handled in renderEvent hook
        
        return {
            id: `recurring-${task.path}-${instanceDate}`,
            title: task.title,
            start: eventStart,
            end: endDate,
            allDay: !hasTime,
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            textColor: borderColor,
            editable: true, // Recurring tasks are editable
            extendedProps: {
                taskInfo: task,
                eventType: 'recurring',
                isCompleted: isInstanceCompleted,
                isRecurringInstance: true,
                instanceDate: instanceDate,
                recurringTemplateTime: templateTime
            }
        };
    }

    // Event handlers
    handleDateSelect(selectInfo: any) {
        const { start, end, allDay, jsEvent } = selectInfo;
        
        // Check if timeblocking is enabled and Shift key is held
        const isTimeblockMode = this.plugin.settings.calendarViewSettings.enableTimeblocking && 
                               this.showTimeblocks && 
                               jsEvent && jsEvent.shiftKey;
        
        if (isTimeblockMode) {
            // Create timeblock
            this.handleTimeblockCreation(start, end, allDay);
        } else {
            // Create task (default behavior)
            this.handleTaskCreation(start, end, allDay);
        }
        
        // Clear selection
        this.calendar?.unselect();
    }
    
    private parseSlotDurationToMinutes(slotDuration: string): number {
        // Parse slot duration format like '00:30:00' to minutes
        const parts = slotDuration.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        return hours * 60 + minutes;
    }
    
    private handleTaskCreation(start: Date, end: Date, allDay: boolean) {
        // Pre-populate with selected date/time
        const scheduledDate = allDay 
            ? formatDateForStorage(start)
            : formatDateForStorage(start) + 'T' + format(start, 'HH:mm');
            
        const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
        
        // Convert slot duration setting to minutes for comparison
        const slotDurationSetting = this.plugin.settings.calendarViewSettings.slotDuration;
        const slotDurationMinutes = this.parseSlotDurationToMinutes(slotDurationSetting);
        
        // Determine if this was a drag (intentional time selection) or just a click
        // If duration is greater than slot duration, it's an intentional drag
        const isDragOperation = !allDay && durationMinutes > slotDurationMinutes;
        
        const prePopulatedValues: any = {
            scheduled: scheduledDate
        };
        
        // Only override time estimate if it's an intentional drag operation
        if (allDay) {
            // For all-day events, don't override user's default time estimate
            // Let TaskCreationModal use the default setting
        } else if (isDragOperation) {
            // User dragged to select a specific duration, use that
            prePopulatedValues.timeEstimate = durationMinutes;
        }
        // For clicks (not drags), don't set timeEstimate to let default setting apply
        
        const modal = new TaskCreationModal(this.app, this.plugin, {
            prePopulatedValues
        });
        
        modal.open();
    }
    
    private handleTimeblockCreation(start: Date, end: Date, allDay: boolean) {
        // Don't create timeblocks for all-day selections
        if (allDay) {
            new Notice('Timeblocks must have specific times. Please select a time range in week or day view.');
            return;
        }
        
        const date = formatDateForStorage(start);
        const startTime = format(start, 'HH:mm');
        const endTime = format(end, 'HH:mm');
        
        const modal = new TimeblockCreationModal(this.app, this.plugin, {
            date,
            startTime,
            endTime
        });
        
        modal.open();
    }

    /**
     * Handle clicking on a date title to open/create daily note
     */
    async handleDateTitleClick(date: Date) {
        try {
            // Check if Daily Notes plugin is enabled
            if (!appHasDailyNotesPluginLoaded()) {
                new Notice('Daily Notes core plugin is not enabled. Please enable it in Settings > Core plugins.');
                return;
            }

            // Convert date to moment for the API
            const moment = (window as any).moment(date);
            
            // Get all daily notes to check if one exists for this date
            const allDailyNotes = getAllDailyNotes();
            let dailyNote = getDailyNote(moment, allDailyNotes);
            
            if (!dailyNote) {
                // Daily note doesn't exist, create it
                try {
                    dailyNote = await createDailyNote(moment);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Failed to create daily note:', error);
                    new Notice(`Failed to create daily note: ${errorMessage}`);
                    return;
                }
            }
            
            // Open the daily note
            if (dailyNote) {
                await this.app.workspace.getLeaf(false).openFile(dailyNote);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Failed to navigate to daily note:', error);
            new Notice(`Failed to navigate to daily note: ${errorMessage}`);
        }
    }

    async getTimeblockEvents(): Promise<CalendarEvent[]> {
        const events: CalendarEvent[] = [];
        
        try {
            // Check if Daily Notes plugin is enabled
            if (!appHasDailyNotesPluginLoaded()) {
                return events;
            }
            
            // Get calendar's visible date range
            const calendarView = this.calendar?.view;
            if (!calendarView) return events;
            
            const visibleStart = calendarView.activeStart;
            const visibleEnd = calendarView.activeEnd;
            
            // Get all daily notes
            const allDailyNotes = getAllDailyNotes();
            
            // Iterate through each day in the visible range
            const currentDate = new Date(visibleStart);
            while (currentDate <= visibleEnd) {
                const dateString = formatDateForStorage(currentDate);
                const moment = (window as any).moment(currentDate);
                const dailyNote = getDailyNote(moment, allDailyNotes);
                
                if (dailyNote) {
                    try {
                        const content = await this.app.vault.read(dailyNote);
                        const timeblocks = extractTimeblocksFromNote(content, dailyNote.path);
                        
                        // Convert timeblocks to calendar events
                        for (const timeblock of timeblocks) {
                            const calendarEvent = timeblockToCalendarEvent(timeblock, dateString);
                            events.push(calendarEvent);
                        }
                    } catch (error) {
                        console.error(`Error reading daily note ${dailyNote.path}:`, error);
                    }
                }
                
                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } catch (error) {
            console.error('Error getting timeblock events:', error);
        }
        
        return events;
    }

    handleEventClick(clickInfo: any) {
        const { taskInfo, icsEvent, timeblock, eventType, subscriptionName } = clickInfo.event.extendedProps;
        const jsEvent = clickInfo.jsEvent;
        
        if (eventType === 'timeEntry') {
            // Time entries open the task edit modal
            if (taskInfo && (jsEvent.button === 0 && !jsEvent.ctrlKey && !jsEvent.metaKey)) {
                const editModal = new TaskEditModal(this.app, this.plugin, { task: taskInfo });
                editModal.open();
            }
            return;
        }
        
        if (eventType === 'timeblock') {
            // Timeblocks are read-only for now, could add editing later
            this.showTimeblockInfo(timeblock, clickInfo.event.start);
            return;
        }
        
        if (eventType === 'ics') {
            // ICS events are read-only, show info modal
            this.showICSEventInfo(icsEvent, subscriptionName);
            return;
        }
        
        // Handle different click types - removed right-click handling to avoid conflicts with eventDidMount
        if (jsEvent.ctrlKey || jsEvent.metaKey) {
            // Ctrl/Cmd + Click: Open task in new tab
            const file = this.app.vault.getAbstractFileByPath(taskInfo.path);
            if (file instanceof TFile) {
                this.app.workspace.openLinkText(taskInfo.path, '', true);
            }
        } else if (jsEvent.button === 0) {
            // Left click only: Open edit modal
            const editModal = new TaskEditModal(this.app, this.plugin, { task: taskInfo });
            editModal.open();
        }
    }

    async handleEventDrop(dropInfo: any) {
        const { taskInfo, timeblock, eventType, isRecurringInstance, originalDate } = dropInfo.event.extendedProps;
        
        if (eventType === 'timeEntry' || eventType === 'ics') {
            // Time entries and ICS events cannot be moved
            dropInfo.revert();
            return;
        }
        
        // Handle timeblock drops
        if (eventType === 'timeblock') {
            await this.handleTimeblockDrop(dropInfo, timeblock, originalDate);
            return;
        }
        
        try {
            const newStart = dropInfo.event.start;
            const allDay = dropInfo.event.allDay;
            
            if (isRecurringInstance) {
                // For recurring instances, only allow time changes, not date changes
                const originalDate = getDatePart(taskInfo.scheduled!);
                let updatedScheduled: string;
                
                if (allDay) {
                    // If dragged to all-day section, remove time component entirely
                    updatedScheduled = originalDate;
                    new Notice('Updated recurring task to all-day. This affects all future instances.');
                } else {
                    // If dragged to a specific time, update the time
                    const newTime = format(newStart, 'HH:mm');
                    updatedScheduled = `${originalDate}T${newTime}`;
                    new Notice(`Updated recurring task time to ${newTime}. This affects all future instances.`);
                }
                
                // Update the template time in scheduled field
                await this.plugin.taskService.updateProperty(taskInfo, 'scheduled', updatedScheduled);
            } else {
                // Handle non-recurring events normally
                let newDateString: string;
                if (allDay) {
                    newDateString = formatDateForStorage(newStart);
                } else {
                    newDateString = formatDateForStorage(newStart) + 'T' + format(newStart, 'HH:mm');
                }
                
                // Update the appropriate property
                const propertyToUpdate = eventType === 'scheduled' ? 'scheduled' : 'due';
                await this.plugin.taskService.updateProperty(taskInfo, propertyToUpdate, newDateString);
            }
            
        } catch (error) {
            console.error('Error updating task date:', error);
            dropInfo.revert();
        }
    }

    private async handleTimeblockDrop(dropInfo: any, timeblock: TimeBlock, originalDate: string): Promise<void> {
        try {
            const newStart = dropInfo.event.start;
            const newEnd = dropInfo.event.end;
            
            // Calculate new date and times
            const newDate = formatDateForStorage(newStart);
            const newStartTime = format(newStart, 'HH:mm');
            const newEndTime = format(newEnd, 'HH:mm');
            
            // Update timeblock in daily notes
            await updateTimeblockInDailyNote(
                this.app,
                timeblock.id,
                originalDate,
                newDate,
                newStartTime,
                newEndTime
            );
            
            // Refresh calendar to show updated timeblock
            this.refreshEvents();
            
            // Show success message
            if (originalDate !== newDate) {
                new Notice(`Moved timeblock "${timeblock.title}" to ${newDate}`);
            } else {
                new Notice(`Updated timeblock "${timeblock.title}" time`);
            }
            
        } catch (error) {
            console.error('Error moving timeblock:', error);
            new Notice(`Failed to move timeblock: ${error.message}`);
            dropInfo.revert();
        }
    }

    async handleEventResize(resizeInfo: any) {
        const { taskInfo, timeblock, eventType, originalDate } = resizeInfo.event.extendedProps;
        
        if (eventType === 'timeblock') {
            // Handle timeblock resize
            await this.handleTimeblockResize(resizeInfo, timeblock, originalDate);
            return;
        }
        
        if (eventType !== 'scheduled' && eventType !== 'recurring') {
            // Only scheduled and recurring events and timeblocks can be resized (not timeEntry, ics, due)
            resizeInfo.revert();
            return;
        }
        
        try {
            const start = resizeInfo.event.start;
            const end = resizeInfo.event.end;
            
            if (start && end) {
                const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
                await this.plugin.taskService.updateProperty(taskInfo, 'timeEstimate', durationMinutes);
            }
            
        } catch (error) {
            console.error('Error updating task duration:', error);
            resizeInfo.revert();
        }
    }

    private async handleTimeblockResize(resizeInfo: any, timeblock: TimeBlock, originalDate: string): Promise<void> {
        try {
            const start = resizeInfo.event.start;
            const end = resizeInfo.event.end;
            
            if (!start || !end) {
                resizeInfo.revert();
                return;
            }
            
            // Calculate new times
            const newStartTime = format(start, 'HH:mm');
            const newEndTime = format(end, 'HH:mm');
            
            // Validate that end is after start
            const [startHour, startMin] = newStartTime.split(':').map(Number);
            const [endHour, endMin] = newEndTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            if (endMinutes <= startMinutes) {
                new Notice('End time must be after start time');
                resizeInfo.revert();
                return;
            }
            
            // Update timeblock in daily note (same date, just time change)
            await updateTimeblockInDailyNote(
                this.app,
                timeblock.id,
                originalDate,
                originalDate, // Same date
                newStartTime,
                newEndTime
            );
            
            // Refresh calendar
            this.refreshEvents();
            
            new Notice(`Updated timeblock "${timeblock.title}" duration`);
            
        } catch (error) {
            console.error('Error resizing timeblock:', error);
            new Notice(`Failed to resize timeblock: ${error.message}`);
            resizeInfo.revert();
        }
    }

    async handleExternalDrop(dropInfo: any) {
        try {
            
            // Get task path from drag data transfer
            let taskPath: string | undefined;
            
            // Try to get from dataTransfer first (most reliable)
            if (dropInfo.dataTransfer) {
                taskPath = dropInfo.dataTransfer.getData('text/plain') || 
                          dropInfo.dataTransfer.getData('application/x-task-path');
            }
            
            // Fallback to element data attribute
            if (!taskPath && dropInfo.draggedEl) {
                taskPath = dropInfo.draggedEl.dataset.taskPath;
            }
            
            if (!taskPath) {
                console.warn('No task path found in drop data', dropInfo);
                return;
            }
            
            // Get the task info
            const task = await this.plugin.cacheManager.getTaskInfo(taskPath);
            if (!task) {
                console.warn('Task not found:', taskPath);
                return;
            }
            
            // Get the drop date/time
            const dropDate = dropInfo.date;
            if (!dropDate) {
                console.warn('No drop date provided');
                return;
            }
            
            // Format the date for task scheduling
            let scheduledDate: string;
            if (dropInfo.allDay) {
                // All-day event - just the date
                scheduledDate = formatDateForStorage(dropDate);
            } else {
                // Specific time - include time
                scheduledDate = formatDateForStorage(dropDate) + 'T' + format(dropDate, 'HH:mm');
            }
            
            // Update the task's scheduled date
            await this.plugin.taskService.updateProperty(task, 'scheduled', scheduledDate);
            
            
            // Show success feedback
            new Notice(`Task "${task.title}" scheduled for ${format(dropDate, dropInfo.allDay ? 'MMM d, yyyy' : 'MMM d, yyyy h:mm a')}`);
            
            // Remove any event that FullCalendar might have created from the drop
            if (dropInfo.draggedEl) {
                // Remove the dragged element to prevent it from being rendered as an event
                dropInfo.draggedEl.remove();
            }
            
            // Refresh calendar to show the new event with proper task data
            this.refreshEvents();
            
        } catch (error) {
            console.error('Error handling external drop:', error);
            new Notice('Failed to schedule task');
            
            // Remove any event that might have been created on error
            if (dropInfo.draggedEl) {
                dropInfo.draggedEl.remove();
            }
        }
    }

    /**
     * Handle when FullCalendar tries to create an event from external drop
     * We prevent this since we handle the task scheduling ourselves
     */
    handleEventReceive(info: any) {
        // Remove the automatically created event since we handle scheduling ourselves
        info.event.remove();
    }

    handleEventDidMount(arg: any) {
        // Check if we have extended props
        if (!arg.event.extendedProps) {
            return;
        }
        
        const { taskInfo, icsEvent, timeblock, eventType, isCompleted, isRecurringInstance, instanceDate, subscriptionName } = arg.event.extendedProps;
        
        // Set common event type attribute for all events
        arg.el.setAttribute('data-event-type', eventType || 'unknown');
        
        // Handle ICS events
        if (eventType === 'ics') {
            // Add visual styling for ICS events
            arg.el.style.borderStyle = 'solid';
            arg.el.style.borderWidth = '2px';
            arg.el.setAttribute('data-ics-event', 'true');
            arg.el.setAttribute('data-subscription', subscriptionName || 'Unknown');
            arg.el.classList.add('fc-ics-event');
            
            // Add tooltip with subscription name
            setTooltip(arg.el, `${icsEvent?.title || 'Event'} (from ${subscriptionName || 'Calendar subscription'})`, { placement: 'top' });
            
            // Add context menu for ICS events
            arg.el.addEventListener("contextmenu", (jsEvent: MouseEvent) => {
                jsEvent.preventDefault();
                jsEvent.stopPropagation();
                this.showICSEventContextMenu(jsEvent, icsEvent, subscriptionName);
            });
            return;
        }
        
        // Handle timeblock events
        if (eventType === 'timeblock') {
            // Add data attributes for timeblocks
            arg.el.setAttribute('data-timeblock-id', timeblock?.id || '');
            
            // Add visual styling for timeblocks
            arg.el.style.borderStyle = 'solid';
            arg.el.style.borderWidth = '2px';
            arg.el.classList.add('fc-timeblock-event');
            
            // Ensure timeblocks are editable (can be dragged/resized)
            if (arg.event.setProp) {
                arg.event.setProp('editable', true);
            }
            
            // Add tooltip
            const attachmentCount = timeblock?.attachments?.length || 0;
            const tooltipText = `${timeblock?.title || 'Timeblock'}${timeblock?.description ? ` - ${timeblock.description}` : ''}${attachmentCount > 0 ? ` (${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''})` : ''}`;
            setTooltip(arg.el, tooltipText, { placement: 'top' });
            
            return;
        }
        
        // Handle task events
        if (!taskInfo || !taskInfo.path) {
            return;
        }
        
        // Add data attributes for tasks
        arg.el.setAttribute('data-task-path', taskInfo.path);
        arg.el.classList.add('fc-task-event');

		// Add tag classes to tasks
		if (taskInfo.tags && taskInfo.tags.length > 0) {
			taskInfo.tags.forEach((tag: string) => {
				const sanitizedTag = tag.replace(/[^a-zA-Z0-9-_]/g, ''); 
				if (sanitizedTag) {
					arg.el.classList.add(`fc-tag-${sanitizedTag}`); 
				}
			});
		}
        
        // Set editable based on event type
        if (arg.event.setProp) {
            switch (eventType) {
                case 'scheduled':
                case 'recurring':
                    arg.event.setProp('editable', true);
                    break;
                case 'due':
                case 'timeEntry':
                    arg.event.setProp('editable', false);
                    break;
                default:
                    arg.event.setProp('editable', true);
            }
        }
        
        // Apply visual styling for recurring instances
        if (isRecurringInstance) {
            // Add dashed border for recurring instances
            arg.el.style.borderStyle = 'dashed';
            arg.el.style.borderWidth = '2px';
            
            // Add recurring badge (already in title with 🔄)
            arg.el.setAttribute('data-recurring', 'true');
            arg.el.classList.add('fc-recurring-event');
            
            // Apply dimmed appearance for completed instances
            if (isCompleted) {
                arg.el.style.opacity = '0.6';
            }
        }
        
        // Apply strikethrough styling for completed tasks
        if (isCompleted) {
            const titleElement = arg.el.querySelector('.fc-event-title, .fc-event-title-container');
            if (titleElement) {
                titleElement.style.textDecoration = 'line-through';
            } else {
                // Fallback: apply to the entire event element
                arg.el.style.textDecoration = 'line-through';
            }
            arg.el.classList.add('fc-completed-event');
        }
        
        // Add hover preview and context menu event listeners
        if (taskInfo) {
            // Add hover preview functionality for all task-related events
            if (eventType !== 'ics') {
                arg.el.addEventListener('mouseover', (event: MouseEvent) => {
                    const file = this.plugin.app.vault.getAbstractFileByPath(taskInfo.path);
                    if (file) {
                        this.plugin.app.workspace.trigger('hover-link', {
                            event,
                            source: 'tasknotes-advanced-calendar',
                            hoverParent: arg.el,
                            targetEl: arg.el,
                            linktext: taskInfo.path,
                            sourcePath: taskInfo.path
                        });
                    }
                });
            }
            
            // Add context menu functionality
            arg.el.addEventListener("contextmenu", (jsEvent: MouseEvent) => {
                jsEvent.preventDefault();
                jsEvent.stopPropagation();
                
                if (eventType === 'timeEntry') {
                    // Special context menu for time entries
                    const { timeEntryIndex } = arg.event.extendedProps;
                    this.showTimeEntryContextMenu(jsEvent, taskInfo, timeEntryIndex);
                } else {
                    // Standard task context menu for other event types
                    const targetDate = isRecurringInstance && instanceDate 
                        ? parseDate(instanceDate + 'T00:00:00Z')  // Treat instanceDate as UTC to avoid double conversion
                        : (arg.event.start || new Date());
                        
                    showTaskContextMenu(jsEvent, taskInfo.path, this.plugin, targetDate);
                }
            });
        }
    }

    registerEvents(): void {
        // Clean up any existing listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.listeners = [];
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        this.functionListeners = [];
        
        // Listen for data changes
        const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, async () => {
            this.refreshEvents();
            // Update FilterBar options when data changes (new properties, contexts, etc.)
            if (this.filterBar) {
                console.log('AdvancedCalendarView: Updating FilterBar options due to data change');
                const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                console.log('AdvancedCalendarView: Got updated options with projects count:', updatedFilterOptions.projects.length);
                this.filterBar.updateFilterOptions(updatedFilterOptions);
            }
        });
        this.listeners.push(dataListener);
        
        // Listen for task updates
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async () => {
            this.refreshEvents();
            // Update FilterBar options when tasks are updated (may have new properties, contexts, etc.)
            if (this.filterBar) {
                const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                this.filterBar.updateFilterOptions(updatedFilterOptions);
            }
        });
        this.listeners.push(taskUpdateListener);
        
        // Listen for filter service data changes
        const filterDataListener = this.plugin.filterService.on('data-changed', () => {
            this.refreshEvents();
        });
        this.functionListeners.push(filterDataListener);
        
        // Listen for ICS subscription changes
        if (this.plugin.icsSubscriptionService) {
            const icsDataListener = this.plugin.icsSubscriptionService.on('data-changed', () => {
                this.refreshEvents();
            });
            this.functionListeners.push(icsDataListener);
        }
        
        // Listen for timeblocking toggle changes
        const timeblockingToggleListener = this.plugin.emitter.on(EVENT_TIMEBLOCKING_TOGGLED, (enabled: boolean) => {
            // Update visibility and refresh if timeblocking was enabled
            this.showTimeblocks = enabled && this.plugin.settings.calendarViewSettings.defaultShowTimeblocks;
            this.refreshEvents();
            this.setupViewOptions(); // Re-render view options
        });
        this.listeners.push(timeblockingToggleListener);

        // Listen for settings changes to update today highlight and custom view
        const settingsListener = this.plugin.emitter.on('settings-changed', () => {
            this.updateTodayHighlight();
            this.updateCustomViewConfiguration();
        });
        this.listeners.push(settingsListener);
    }

    /**
     * Update the custom view configuration when settings change
     */
    private updateCustomViewConfiguration(): void {
        if (!this.calendar) return;
        
        const calendarSettings = this.plugin.settings.calendarViewSettings;
        
        // Update the custom view definition
        this.calendar.setOption('views', {
            timeGridCustom: {
                type: 'timeGrid',
                duration: { days: calendarSettings.customDayCount || 3 },
                buttonText: `${calendarSettings.customDayCount || 3} days`
            }
        });
        
        // Update the header toolbar in case it needs to refresh
        this.calendar.setOption('headerToolbar', this.getHeaderToolbarConfig());
    }

    async refreshEvents() {
        if (this.calendar) {
            this.calendar.refetchEvents();
        }
    }

    async onClose() {
        // Clean up resize handling
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        
        if (this.resizeTimeout) {
            window.clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        
        // Remove event listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        
        // Clean up FilterBar
        if (this.filterBar) {
            this.filterBar.destroy();
            this.filterBar = null;
        }
        
        // Destroy calendar
        if (this.calendar) {
            this.calendar.destroy();
            this.calendar = null;
        }
        
        // Clean up
        this.contentEl.empty();
    }

    private showICSEventInfo(icsEvent: ICSEvent, subscriptionName?: string): void {
        const modal = new ICSEventInfoModal(this.app, this.plugin, icsEvent, subscriptionName);
        modal.open();
    }

    private showTimeblockInfo(timeblock: TimeBlock, eventDate: Date): void {
        const modal = new TimeblockInfoModal(this.app, this.plugin, timeblock, eventDate);
        modal.open();
    }

    private showICSEventContextMenu(jsEvent: MouseEvent, icsEvent: ICSEvent, subscriptionName?: string): void {
        const menu = new Menu();

        // Show details option
        menu.addItem((item) =>
            item
                .setTitle("Show details")
                .setIcon("info")
                .onClick(() => {
                    this.showICSEventInfo(icsEvent, subscriptionName);
                })
        );

        // Copy title option
        menu.addItem((item) =>
            item
                .setTitle("Copy title")
                .setIcon("copy")
                .onClick(async () => {
                    try {
                        await navigator.clipboard.writeText(icsEvent.title);
                        new Notice('Event title copied to clipboard');
                    } catch (error) {
                        new Notice('Failed to copy to clipboard');
                    }
                })
        );

        // Copy URL option (if available)
        if (icsEvent.url) {
            menu.addItem((item) =>
                item
                    .setTitle("Copy URL")
                    .setIcon("link")
                    .onClick(async () => {
                        try {
                            await navigator.clipboard.writeText(icsEvent.url!);
                            new Notice('Event URL copied to clipboard');
                        } catch (error) {
                            new Notice('Failed to copy to clipboard');
                        }
                    })
            );
        }

        menu.showAtMouseEvent(jsEvent);
    }

    private showTimeEntryContextMenu(jsEvent: MouseEvent, taskInfo: TaskInfo, timeEntryIndex: number): void {
        const menu = new Menu();

        // Show task details option
        menu.addItem((item) =>
            item
                .setTitle("Open task")
                .setIcon("edit")
                .onClick(() => {
                    const editModal = new TaskEditModal(this.app, this.plugin, { task: taskInfo });
                    editModal.open();
                })
        );

        menu.addSeparator();

        // Delete time entry option
        menu.addItem((item) =>
            item
                .setTitle("Delete time entry")
                .setIcon("trash")
                .onClick(async () => {
                    try {
                        const timeEntry = taskInfo.timeEntries?.[timeEntryIndex];
                        if (!timeEntry) {
                            new Notice('Time entry not found');
                            return;
                        }

                        // Calculate duration for confirmation message
                        let durationText = '';
                        if (timeEntry.startTime && timeEntry.endTime) {
                            const start = new Date(timeEntry.startTime);
                            const end = new Date(timeEntry.endTime);
                            const durationMs = end.getTime() - start.getTime();
                            const durationMinutes = Math.round(durationMs / (1000 * 60));
                            const hours = Math.floor(durationMinutes / 60);
                            const minutes = durationMinutes % 60;
                            
                            if (hours > 0) {
                                durationText = ` (${hours}h ${minutes}m)`;
                            } else {
                                durationText = ` (${minutes}m)`;
                            }
                        }

                        // Show confirmation
                        const confirmed = await new Promise<boolean>((resolve) => {
                            const confirmModal = new Modal(this.app);
                            confirmModal.setTitle('Delete Time Entry');
                            confirmModal.setContent(`Are you sure you want to delete this time entry${durationText}? This action cannot be undone.`);
                            
                            const buttonContainer = confirmModal.contentEl.createDiv({ cls: 'modal-button-container' });
                            buttonContainer.style.display = 'flex';
                            buttonContainer.style.justifyContent = 'flex-end';
                            buttonContainer.style.gap = '8px';
                            buttonContainer.style.marginTop = '20px';
                            
                            const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
                            const deleteBtn = buttonContainer.createEl('button', { text: 'Delete', cls: 'mod-warning' });
                            
                            cancelBtn.onclick = () => {
                                confirmModal.close();
                                resolve(false);
                            };
                            
                            deleteBtn.onclick = () => {
                                confirmModal.close();
                                resolve(true);
                            };
                            
                            confirmModal.open();
                        });

                        if (confirmed) {
                            await this.plugin.taskService.deleteTimeEntry(taskInfo, timeEntryIndex);
                            new Notice('Time entry deleted');
                            this.refreshEvents();
                        }
                    } catch (error) {
                        console.error('Error deleting time entry:', error);
                        new Notice('Failed to delete time entry');
                    }
                })
        );

        menu.showAtMouseEvent(jsEvent);
    }

    private updateTodayHighlight() {
        const calendarContainer = this.contentEl.querySelector('.advanced-calendar-view__calendar-container');
        if (!calendarContainer) return;

        const showTodayHighlight = this.plugin.settings.calendarViewSettings.showTodayHighlight;
        if (showTodayHighlight) {
            calendarContainer.removeClass('hide-today-highlight');
        } else {
            calendarContainer.addClass('hide-today-highlight');
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
