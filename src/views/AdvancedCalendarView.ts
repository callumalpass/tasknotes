import { ItemView, WorkspaceLeaf, TFile, Notice, EventRef, Menu, Modal, setTooltip, setIcon } from 'obsidian';
import { ICSEventInfoModal } from '../modals/ICSEventInfoModal';
import { ICSEventContextMenu } from '../components/ICSEventContextMenu';
import { TaskContextMenu } from '../components/TaskContextMenu';
import { PriorityContextMenu } from '../components/PriorityContextMenu';
import { RecurrenceContextMenu } from '../components/RecurrenceContextMenu';
import { createTaskClickHandler, createTaskHoverHandler } from '../utils/clickHandlers';
import { TimeblockInfoModal } from '../modals/TimeblockInfoModal';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Calendar, EventApi } from '@fullcalendar/core';
import { 
    createDailyNote, 
    getDailyNote, 
    getAllDailyNotes,
    appHasDailyNotesPluginLoaded
} from 'obsidian-daily-notes-interface';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import TaskNotesPlugin from '../main';
import {
    ADVANCED_CALENDAR_VIEW_TYPE,
    EVENT_DATA_CHANGED,
    EVENT_TASK_UPDATED,
    EVENT_DATE_CHANGED,
    EVENT_TIMEBLOCKING_TOGGLED,
    TaskInfo,
    TimeBlock,
    FilterQuery,
    CalendarViewPreferences,
    ICSEvent,
    SavedView
} from '../types';
import { TaskCreationModal } from '../modals/TaskCreationModal';
import { TaskEditModal } from '../modals/TaskEditModal';
import { UnscheduledTasksSelectorModal, ScheduleTaskOptions } from '../modals/UnscheduledTasksSelectorModal';
import { TimeblockCreationModal } from '../modals/TimeblockCreationModal';
import { FilterBar } from '../ui/FilterBar';
import {
    hasTimeComponent,
    getDatePart,
    getTimePart,
    parseDateToLocal,
    parseDateToUTC,
    normalizeCalendarBoundariesToUTC,
    formatDateForStorage,
    getTodayLocal,
    formatDateTimeForDisplay
} from '../utils/dateUtils';
import { getRecurrenceDisplayText } from '../utils/helpers';
import { 
    generateRecurringInstances,
    extractTimeblocksFromNote,
    timeblockToCalendarEvent,
    updateTimeblockInDailyNote,
    addDTSTARTToRecurrenceRuleWithDraggedTime
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
        isNextScheduledOccurrence?: boolean; // Flag for next scheduled occurrence
        isPatternInstance?: boolean; // Flag for pattern instances
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
    
    // Track if we're waiting for a recurring task update
    private pendingRecurringUpdate = false;

    // Performance optimization: Change detection and cache management
    private taskVersionCache = new Map<string, string>(); // taskPath -> dateModified
    private lastKnownTaskCount = 0;
    private lastRefreshTime = 0;

    // Debouncing for cross-view performance
    private updateDebounceTimer: number | null = null;
    private pendingUpdates = new Set<string>();


    // View toggles (keeping for calendar-specific display options)
    private showScheduled: boolean;
    private showDue: boolean;
    private showTimeEntries: boolean;
    private showRecurring: boolean;
    private showICSEvents: boolean;
    private showTimeblocks: boolean;
    private showAllDaySlot: boolean;
    
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
        this.showAllDaySlot = true; // Default to true to match FullCalendar's default
        
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
            this.showAllDaySlot = savedPreferences.showAllDaySlot ?? true;
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
            this.plugin,
            filterBarContainer,
            this.currentQuery,
            filterOptions,
            this.plugin.settings.viewsButtonAlignment || 'right',
            { enableGroupExpandCollapse: false, forceShowExpandCollapse: false, viewType: 'advanced-calendar' }
        );
        
        // Get saved views for the FilterBar
        const savedViews = this.plugin.viewStateManager.getSavedViews();
        this.filterBar.updateSavedViews(savedViews);
        
        // Listen for saved view events
        this.filterBar.on('saveView', ({ name, query, viewOptions, visibleProperties }) => {
            const savedView = this.plugin.viewStateManager.saveView(name, query, viewOptions, visibleProperties);
            // Set the newly saved view as active to prevent incorrect view matching
            this.filterBar!.setActiveSavedView(savedView);
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
            },
            {
                id: 'allDaySlot',
                label: 'All-day slot',
                value: this.showAllDaySlot,
                onChange: (value: boolean) => {
                    this.showAllDaySlot = value;
                    this.saveViewPreferences();
                    if (this.calendar) {
                        this.calendar.setOption('allDaySlot', value);
                    }
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
            case 'allDaySlot':
                this.showAllDaySlot = enabled;
                if (this.calendar) {
                    this.calendar.setOption('allDaySlot', enabled);
                }
                break;
        }
        
        this.saveViewPreferences();
        this.refreshEvents();
        
        // Update FilterBar view options to reflect the change
        this.setupViewOptions();
    }
    
    private getHeaderToolbarConfig() {
        // FIX: Use the correct window context for the view (handles pop-out windows)
        const win = this.contentEl.ownerDocument.defaultView || window;
        
        // Hide FullCalendar header on mobile when collapsed
        if (this.headerCollapsed && win.innerWidth <= 768) {
            return false; // This hides the entire header toolbar
        }
        
        // Check if calendar container is narrow (less than 600px wide) to hide title
        const calendarContainer = this.contentEl.querySelector('.advanced-calendar-view__calendar-container');
        const containerWidth = calendarContainer ? calendarContainer.getBoundingClientRect().width : win.innerWidth;
        const isNarrowView = containerWidth <= 600;
        
        const toolbarConfig = {
            left: 'prev,next today',
            center: isNarrowView ? '' : 'title', // Hide title in narrow views
            right: 'refreshICS multiMonthYear,dayGridMonth,timeGridWeek,timeGridCustom,timeGridDay,listWeek'
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
                    // Use format() to extract local date components for consistency
                    scheduledDate = format(options.date, 'yyyy-MM-dd');
                } else if (options.time) {
                    // Use format() for date part to maintain local timezone consistency
                    scheduledDate = format(options.date, 'yyyy-MM-dd') + 'T' + options.time;
                } else {
                    // Default to 9 AM if no time specified
                    scheduledDate = format(options.date, 'yyyy-MM-dd') + 'T09:00';
                }
            } else {
                // Default to today at 9 AM
                const today = getTodayLocal();
                scheduledDate = format(today, 'yyyy-MM-dd') + 'T09:00';
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
            plugins: [dayGridPlugin, timeGridPlugin, multiMonthPlugin, listPlugin, interactionPlugin],
            initialView: calendarSettings.defaultView,
            headerToolbar: headerToolbar,
            customButtons: customButtons,

            // Custom button text for clean, short labels
            buttonText: {
                multiMonthYear: 'Y',
                dayGridMonth: 'M',
                timeGridWeek: 'W',
                timeGridDay: 'D',
                listWeek: 'List'
            },

            views: {
                timeGridCustom: {
                    type: 'timeGrid',
                    duration: { days: calendarSettings.customDayCount || 3 },
                    buttonText: `${calendarSettings.customDayCount || 3}D`
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
            allDaySlot: this.showAllDaySlot,
            
            // Time format
            eventTimeFormat: this.getTimeFormat(calendarSettings.timeFormat),
            slotLabelFormat: this.getTimeFormat(calendarSettings.timeFormat),
            
            // Event handlers
            select: this.handleDateSelect.bind(this),
            eventClick: this.handleEventClick.bind(this),
            eventDrop: this.handleEventDrop.bind(this),
            eventAllow: (dropInfo: any) => {
                // Allow all drops to proceed visually
                return true;
            },
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
            headerCollapsed: this.headerCollapsed,
            showAllDaySlot: this.showAllDaySlot
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
        if (viewOptions.hasOwnProperty('showAllDaySlot')) {
            this.showAllDaySlot = viewOptions.showAllDaySlot;
            if (this.calendar) {
                this.calendar.setOption('allDaySlot', this.showAllDaySlot);
            }
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

        // Clean up function listeners
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        this.functionListeners = [];

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
        // 1. User's configured locale setting (if set)
        // 2. Browser language (most specific)
        // 3. Obsidian locale if available 
        // 4. System language
        // 5. Default to 'en' as fallback
        
        // Check user's configured locale setting first
        const userLocale = this.plugin.settings.calendarViewSettings.locale;
        if (userLocale && userLocale.trim() !== '') {
            return userLocale.trim();
        }
        
        // Check browser language
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

    /**
     * Generate calendar events for a single task (extracted from getCalendarEvents)
     * This method is used for selective updates to avoid regenerating all events
     */
    private async generateEventsForTask(task: TaskInfo): Promise<CalendarEvent[]> {
        const events: CalendarEvent[] = [];

        try {
            // Get calendar's current visible range for recurring task generation
            const calendarView = this.calendar?.view;
            const today = getTodayLocal();
            const rawVisibleStart = calendarView?.activeStart || startOfDay(today);
            const rawVisibleEnd = calendarView?.activeEnd || endOfDay(today);
            const { utcStart: visibleStart, utcEnd: visibleEnd } =
                normalizeCalendarBoundariesToUTC(rawVisibleStart, rawVisibleEnd);

            // Apply same logic as getCalendarEvents() but for single task
            if (task.recurrence) {
                // Recurring tasks: require scheduled date
                if (task.scheduled && this.showRecurring) {
                    const recurringEvents = this.generateRecurringTaskInstances(
                        task, visibleStart, visibleEnd
                    );
                    events.push(...recurringEvents);
                }
            } else {
                // Non-recurring tasks: show on scheduled date OR due date
                const hasScheduled = !!task.scheduled;
                const hasDue = !!task.due;

                // Skip if neither scheduled nor due date exists
                if (!hasScheduled && !hasDue) {
                    return events;
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

        } catch (error) {
            console.error(`Error generating events for task ${task.path}:`, error);
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
            // Use parseDateToLocal for display purposes since this has time
            const start = parseDateToLocal(startDate);
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
            const start = parseDateToLocal(startDate);
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
        
        // Get the current scheduled date for comparison
        const nextScheduledDate = getDatePart(task.scheduled);
        
        // 1. Always create the next scheduled occurrence event (regardless of pattern)
        const scheduledTime = hasOriginalTime ? getTimePart(task.scheduled) : null;
        const scheduledEventStart = scheduledTime ? `${nextScheduledDate}T${scheduledTime}` : nextScheduledDate;
        const nextScheduledEvent = this.createNextScheduledEvent(task, scheduledEventStart, nextScheduledDate, scheduledTime || '09:00');
        if (nextScheduledEvent) {
            instances.push(nextScheduledEvent);
        }
        
        // 2. Generate pattern instances from recurrence rule
        const recurringDates = generateRecurringInstances(task, startDate, endDate);
        
        for (const date of recurringDates) {
            const instanceDate = formatDateForStorage(date);
            
            // Skip pattern instance if it conflicts with the next scheduled occurrence
            if (instanceDate === nextScheduledDate) {
                continue; // Already added the next scheduled occurrence above
            }
            
            // Create pattern instance with DTSTART time
            const eventStart = hasOriginalTime ? `${instanceDate}T${templateTime}` : instanceDate;
            const event = this.createRecurringEvent(task, eventStart, instanceDate, templateTime);
            if (event) instances.push(event);
        }

        return instances;
    }

    getRecurringTime(task: TaskInfo): string {
        // Extract time from DTSTART in recurrence rule, not from scheduled field
        if (task.recurrence && typeof task.recurrence === 'string') {
            const dtstartMatch = task.recurrence.match(/DTSTART:(\d{8}(?:T\d{6}Z?)?)/);
            if (dtstartMatch && dtstartMatch[1].includes('T')) {
                // Parse time from YYYYMMDDTHHMMSSZ format
                const timeStr = dtstartMatch[1].split('T')[1];
                if (timeStr.length >= 4) {
                    const hours = timeStr.slice(0, 2);
                    const minutes = timeStr.slice(2, 4);
                    return `${hours}:${minutes}`;
                }
            }
        }
        
        // Fallback: if no time in DTSTART, use scheduled time or default
        if (task.scheduled) {
            const timePart = getTimePart(task.scheduled);
            if (timePart) return timePart;
        }
        
        return '09:00'; // final fallback
    }

    createNextScheduledEvent(task: TaskInfo, eventStart: string, instanceDate: string, templateTime: string): CalendarEvent | null {
        const hasTime = hasTimeComponent(eventStart);
        
        // Calculate end time if time estimate is available
        let endDate: string | undefined;
        if (hasTime && task.timeEstimate) {
            const start = parseDateToLocal(eventStart);
            const end = new Date(start.getTime() + (task.timeEstimate * 60 * 1000));
            endDate = format(end, "yyyy-MM-dd'T'HH:mm");
        }
        
        // Get priority-based color for border
        const priorityConfig = this.plugin.priorityManager.getPriorityConfig(task.priority);
        const borderColor = priorityConfig?.color || 'var(--color-accent)';
        
        // Check if this instance is completed
        const isInstanceCompleted = task.complete_instances?.includes(instanceDate) || false;
        
        // Next scheduled occurrence uses normal task styling (solid border, full opacity)
        const backgroundColor = isInstanceCompleted ? 'rgba(0,0,0,0.3)' : 'transparent';
        
        return {
            id: `next-scheduled-${task.path}-${instanceDate}`,
            title: task.title,
            start: eventStart,
            end: endDate,
            allDay: !hasTime,
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            textColor: borderColor,
            editable: true,
            extendedProps: {
                taskInfo: task,
                eventType: 'scheduled', // Use 'scheduled' instead of 'recurring' for next occurrence
                isCompleted: isInstanceCompleted,
                isNextScheduledOccurrence: true, // Flag to identify this as the next occurrence
                instanceDate: instanceDate,
                recurringTemplateTime: templateTime
            }
        };
    }

    createRecurringEvent(task: TaskInfo, eventStart: string, instanceDate: string, templateTime: string): CalendarEvent | null {
        const hasTime = hasTimeComponent(eventStart);
        
        // Calculate end time if time estimate is available
        let endDate: string | undefined;
        if (hasTime && task.timeEstimate) {
            const start = parseDateToLocal(eventStart);
            const end = new Date(start.getTime() + (task.timeEstimate * 60 * 1000));
            endDate = format(end, "yyyy-MM-dd'T'HH:mm");
        }
        
        // Get priority-based color for border
        const priorityConfig = this.plugin.priorityManager.getPriorityConfig(task.priority);
        const borderColor = priorityConfig?.color || 'var(--color-accent)';
        
        // Check if this instance is completed
        const isInstanceCompleted = task.complete_instances?.includes(instanceDate) || false;
        
        // Pattern instances use recurring preview styling (dashed border, reduced opacity)
        const backgroundColor = isInstanceCompleted ? 'rgba(0,0,0,0.3)' : 'transparent';
        
        return {
            id: `recurring-${task.path}-${instanceDate}`,
            title: task.title,
            start: eventStart,
            end: endDate,
            allDay: !hasTime,
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            textColor: borderColor,
            editable: true, // Pattern instances are editable
            extendedProps: {
                taskInfo: task,
                eventType: 'recurring',
                isCompleted: isInstanceCompleted,
                isRecurringInstance: true,
                isPatternInstance: true, // Flag to identify this as a pattern instance
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
            ? format(start, 'yyyy-MM-dd')
            : format(start, "yyyy-MM-dd'T'HH:mm");
            
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
        
        const date = format(start, 'yyyy-MM-dd');
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
            // Use UTC-based date iteration to avoid DST issues and ensure consistent date handling
            const startDateString = formatDateForStorage(visibleStart);
            const endDateString = formatDateForStorage(visibleEnd);
            
            // Create UTC dates for proper iteration
            const startUTC = new Date(`${startDateString}T00:00:00.000Z`);
            const endUTC = new Date(`${endDateString}T00:00:00.000Z`);
            
            for (let currentUTC = new Date(startUTC); currentUTC <= endUTC; currentUTC.setUTCDate(currentUTC.getUTCDate() + 1)) {
                const dateString = formatDateForStorage(currentUTC);
                // Use the date string to create moment for daily notes consistency
                const currentDate = new Date(`${dateString}T12:00:00`);
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
            }
        } catch (error) {
            console.error('Error getting timeblock events:', error);
        }
        
        return events;
    }

    handleEventClick(clickInfo: any) {
        const { taskInfo, icsEvent, timeblock, eventType, subscriptionName } = clickInfo.event.extendedProps;
        const jsEvent = clickInfo.jsEvent;

        // Skip task events in list view - they have their own TaskCard-style handlers
        const isListView = this.calendar?.view?.type === 'listWeek';
        if (isListView && taskInfo && (eventType === 'scheduled' || eventType === 'due' || eventType === 'recurring')) {
            return; // Let the custom handlers handle it
        }
        
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
        const { 
            taskInfo, 
            timeblock, 
            eventType, 
            isRecurringInstance, 
            isNextScheduledOccurrence, 
            isPatternInstance, 
            originalDate 
        } = dropInfo.event.extendedProps;
        
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
        
        // Store whether this is a recurring task update for special handling
        const isRecurringUpdate = isRecurringInstance || isNextScheduledOccurrence || isPatternInstance;
        
        try {
            const newStart = dropInfo.event.start;
            const allDay = dropInfo.event.allDay;
            
            if (isNextScheduledOccurrence) {
                // Dragging Next Scheduled Occurrence: Updates only task.scheduled (manual reschedule)
                let newDateString: string;
                if (allDay) {
                    // Fix: Use format() to extract local date components for timezone consistency
                    newDateString = format(newStart, 'yyyy-MM-dd');
                } else {
                    // Fix: Use format() for the entire date-time string to maintain local timezone consistency
                    newDateString = format(newStart, "yyyy-MM-dd'T'HH:mm");
                }
                
                // Update the scheduled field directly (manual reschedule of next occurrence)
                await this.plugin.taskService.updateProperty(taskInfo, 'scheduled', newDateString);
                new Notice('Rescheduled next occurrence. This does not change the recurrence pattern.');
                
                // The refresh will happen automatically via EVENT_TASK_UPDATED listener
                
            } else if (isPatternInstance) {
                // Dragging Pattern Instances: Updates DTSTART in RRULE and recalculates task.scheduled
                await this.handlePatternInstanceDrop(taskInfo, newStart, allDay);
                // Note: handlePatternInstanceDrop already calls refreshEvents()
                
            } else if (isRecurringInstance) {
                // Legacy support: Handle old-style recurring instances (time changes only)
                const originalDate = getDatePart(taskInfo.scheduled!);
                let updatedScheduled: string;
                
                if (allDay) {
                    updatedScheduled = originalDate;
                    new Notice('Updated recurring task to all-day. This affects all future instances.');
                } else {
                    const newTime = format(newStart, 'HH:mm');
                    updatedScheduled = `${originalDate}T${newTime}`;
                    new Notice(`Updated recurring task time to ${newTime}. This affects all future instances.`);
                }
                
                await this.plugin.taskService.updateProperty(taskInfo, 'scheduled', updatedScheduled);
                
                // The refresh will happen automatically via EVENT_TASK_UPDATED listener
                
            } else {
                // Handle non-recurring events normally
                let newDateString: string;
                if (allDay) {
                    // Fix: Use format() to extract local date components instead of formatDateForStorage()
                    // which uses UTC methods and causes timezone shift for users ahead of UTC
                    newDateString = format(newStart, 'yyyy-MM-dd');
                } else {
                    // Fix: Use format() for the entire date-time string to maintain local timezone consistency
                    newDateString = format(newStart, "yyyy-MM-dd'T'HH:mm");
                }
                
                // Update the appropriate property
                const propertyToUpdate = eventType === 'scheduled' ? 'scheduled' : 'due';
                await this.plugin.taskService.updateProperty(taskInfo, propertyToUpdate, newDateString);
            }
            
            // For recurring tasks, we need special handling
            if (isRecurringUpdate) {
                console.log('Recurring task drop completed', { 
                    taskPath: taskInfo.path,
                    newStart: newStart?.toISOString(),
                    isPatternInstance,
                    isNextScheduledOccurrence
                });
                
                // The EVENT_TASK_UPDATED will trigger refreshEvents()
                // But on slow systems, we need to wait longer for file writes to complete
                // Let's use a longer delay and verify the data has actually changed
                const originalRecurrence = taskInfo.recurrence;
                
                // Use a longer delay for slow systems
                setTimeout(async () => {
                    console.log('Checking if task data has been updated...');
                    
                    // Get fresh task data to verify the update went through
                    const freshTask = await this.plugin.cacheManager.getTaskInfo(taskInfo.path);
                    
                    if (freshTask && freshTask.recurrence !== originalRecurrence) {
                        console.log('Task data confirmed updated, refreshing calendar');
                        
                        // Remove all existing events for this task to ensure clean state
                        if (this.calendar) {
                            const allEvents = this.calendar.getEvents();
                            const taskEvents = allEvents.filter(event => 
                                event.extendedProps.taskInfo?.path === taskInfo.path
                            );
                            
                            taskEvents.forEach(event => event.remove());
                            
                            // Force a complete refresh
                            await this.refreshEvents();
                        }
                    } else {
                        console.log('Task data not yet updated, waiting longer...');
                        // Try again after another delay
                        setTimeout(async () => {
                            await this.refreshEvents();
                        }, 1000);
                    }
                }, 1500); // 1.5 second initial delay for slow systems
            }
            
        } catch (error) {
            console.error('Error updating task date:', error);
            dropInfo.revert();
        }
    }

    private async handlePatternInstanceDrop(taskInfo: TaskInfo, newStart: Date, allDay: boolean): Promise<void> {
        try {
            if (!taskInfo.recurrence || typeof taskInfo.recurrence !== 'string') {
                throw new Error('Task does not have a valid RRULE string');
            }

            // Check if DTSTART already exists
            const currentDtstartMatch = taskInfo.recurrence.match(/DTSTART:(\d{8}(?:T\d{6}Z?)?)/);
            let updatedRRule: string;

            if (!currentDtstartMatch) {
                // No DTSTART exists - add it using the drag interaction
                const ruleWithDTSTART = addDTSTARTToRecurrenceRuleWithDraggedTime(taskInfo, newStart, allDay);
                if (!ruleWithDTSTART) {
                    throw new Error('Failed to add DTSTART to recurrence rule');
                }
                updatedRRule = ruleWithDTSTART;
                new Notice('Added time information to recurring pattern. All future instances now appear at this time.');
            } else {
                // DTSTART exists - update the time component
                const currentDtstart = currentDtstartMatch[1];
                let newDTSTART: string;

                if (allDay) {
                    // For all-day, remove time component entirely (keep original date)
                    newDTSTART = currentDtstart.slice(0, 8); // Keep YYYYMMDD only
                } else {
                    // Update only the time component, preserve the original date
                    const originalDate = currentDtstart.slice(0, 8); // YYYYMMDD
                    const hours = String(newStart.getHours()).padStart(2, '0');
                    const minutes = String(newStart.getMinutes()).padStart(2, '0');
                    newDTSTART = `${originalDate}T${hours}${minutes}00Z`;
                }

                // Update DTSTART in RRULE string
                updatedRRule = taskInfo.recurrence.replace(/DTSTART:[^;]+/, `DTSTART:${newDTSTART}`);
                new Notice('Updated recurring pattern time. All future instances now appear at this time.');
            }

            // Update the recurrence pattern
            await this.plugin.taskService.updateProperty(taskInfo, 'recurrence', updatedRRule);

            // Note: Don't update scheduled date - it should remain independent
            // Only the pattern timing changes, not the next occurrence timing
            
            // The refresh will happen automatically via EVENT_TASK_UPDATED listener
            
        } catch (error) {
            console.error('Error updating pattern instance time:', error);
            throw error;
        }
    }

    private async handleTimeblockDrop(dropInfo: any, timeblock: TimeBlock, originalDate: string): Promise<void> {
        try {
            const newStart = dropInfo.event.start;
            const newEnd = dropInfo.event.end;
            
            // Calculate new date and times
            const newDate = format(newStart, 'yyyy-MM-dd');
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
                // All-day event - use format() to extract local date components
                scheduledDate = format(dropDate, 'yyyy-MM-dd');
            } else {
                // Specific time - use format() for the entire date-time string
                scheduledDate = format(dropDate, "yyyy-MM-dd'T'HH:mm");
            }
            
            // Update the task's scheduled date
            await this.plugin.taskService.updateProperty(task, 'scheduled', scheduledDate);
            
            
            // Show success feedback
            const timeFormat = this.plugin.settings.calendarViewSettings.timeFormat;
            const dateFormat = dropInfo.allDay ? 'MMM d, yyyy' : (timeFormat === '12' ? 'MMM d, yyyy h:mm a' : 'MMM d, yyyy HH:mm');
            new Notice(`Task "${task.title}" scheduled for ${format(dropDate, dateFormat)}`);
            
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

        // Check if we're in a list view
        const isListView = arg.view.type.startsWith('list');

        // Handle ICS events FIRST in list view - they should be completely untouched
        if (isListView && eventType === 'ics') {
            // Just set the basic attributes and return immediately
            arg.el.setAttribute('data-event-type', 'ics');
            arg.el.setAttribute('data-ics-event', 'true');
            // Don't call any other styling or processing
            return;
        }

        // Apply enhanced task card styling for list view task events
        if (isListView && taskInfo && (eventType === 'scheduled' || eventType === 'due' || eventType === 'recurring' || eventType === 'timeEntry')) {
            this.enhanceListViewTaskEvent(arg, taskInfo, eventType, isCompleted);
            return;
        }
        
        // Set common event type attribute for all events
        arg.el.setAttribute('data-event-type', eventType || 'unknown');
        
        // Handle ICS events
        if (eventType === 'ics') {
            // Add data attributes and class for ICS events
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
        
        // Apply visual styling based on event type and recurrence status
        const { isNextScheduledOccurrence, isPatternInstance } = arg.event.extendedProps;
        
        if (isNextScheduledOccurrence) {
            // Next scheduled occurrence: Normal task styling (solid border, full opacity)
            arg.el.style.borderStyle = 'solid';
            arg.el.style.borderWidth = '2px';
            arg.el.setAttribute('data-next-scheduled', 'true');
            arg.el.classList.add('fc-next-scheduled-event');
            
            // Apply dimmed appearance for completed instances
            if (isCompleted) {
                arg.el.style.opacity = '0.6';
            }
        } else if (isPatternInstance) {
            // Pattern occurrences: Recurring preview styling (dashed border, reduced opacity)
            arg.el.style.borderStyle = 'dashed';
            arg.el.style.borderWidth = '2px';
            arg.el.style.opacity = isCompleted ? '0.4' : '0.7'; // Reduced opacity for pattern instances
            
            arg.el.setAttribute('data-pattern-instance', 'true');
            arg.el.classList.add('fc-pattern-instance-event');
        } else if (isRecurringInstance) {
            // Legacy recurring instances (for backward compatibility)
            arg.el.style.borderStyle = 'dashed';
            arg.el.style.borderWidth = '2px';
            
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
                    const { isNextScheduledOccurrence, isPatternInstance } = arg.event.extendedProps;
                    
                    let targetDate: Date;
                    if ((isRecurringInstance || isNextScheduledOccurrence || isPatternInstance) && instanceDate) {
                        // For all recurring-related events, use UTC anchor for instance date
                        targetDate = parseDateToUTC(instanceDate);
                    } else {
                        // For regular events, convert FullCalendar date to UTC anchor
                        const eventDate = arg.event.start;
                        if (eventDate) {
                            // Convert FullCalendar Date to date string preserving local date
                            const dateStr = format(eventDate, 'yyyy-MM-dd');
                            targetDate = parseDateToUTC(dateStr);
                        } else {
                            targetDate = getTodayLocal();
                        }
                    }
                        
                    // Use TaskContextMenu component directly
                    this.showTaskContextMenuForEvent(jsEvent, taskInfo, targetDate);
                }
            });
        }
    }

    registerEvents(): void {
        // Clean up function listeners (FilterService, ICS subscription service, etc.)
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        this.functionListeners = [];
        
        // Listen for data changes
        const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, async () => {
            this.refreshEvents();
            // Update FilterBar options when data changes (new properties, contexts, etc.)
            if (this.filterBar) {
                const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                this.filterBar.updateFilterOptions(updatedFilterOptions);
            }
        });
        this.listeners.push(dataListener);
        
        // Listen for date changes to refresh recurring task states
        const dateChangeListener = this.plugin.emitter.on(EVENT_DATE_CHANGED, async () => {
            this.refreshEvents();
        });
        this.listeners.push(dateChangeListener);
        
        // Listen for task updates - use debounced selective updates for cross-view performance
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, async (eventData: any) => {
            // Try to extract task info from event data
            const updatedTask = eventData?.task || eventData?.taskInfo;

            if (updatedTask && updatedTask.path) {
                // Check if task actually changed to avoid unnecessary updates
                if (!this.hasTaskChanged(updatedTask)) {
                    console.log(`Skipping update for ${updatedTask.path} - no changes detected`);
                    return;
                }

                // Add to pending updates and debounce to avoid refresh storms when multiple views are open
                this.pendingUpdates.add(updatedTask.path);
                this.debouncedUpdateCalendar();
            } else {
                // Fallback to full refresh if we can't identify the specific task
                console.log('Task update event missing path info, doing full refresh');
                this.debouncedFullRefresh();
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
        const timeblockingListener = this.plugin.emitter.on(EVENT_TIMEBLOCKING_TOGGLED, (enabled: boolean) => {
            // Update visibility and refresh if timeblocking was enabled
            this.showTimeblocks = enabled && this.plugin.settings.calendarViewSettings.defaultShowTimeblocks;
            this.refreshEvents();
            this.setupViewOptions(); // Re-render view options
        });
        this.listeners.push(timeblockingListener);

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
                buttonText: `${calendarSettings.customDayCount || 3} D`
            }
        });
        
        // Update the header toolbar in case it needs to refresh
        this.calendar.setOption('headerToolbar', this.getHeaderToolbarConfig());
    }

    /**
     * Get current visible properties for event cards
     */
    private getCurrentVisibleProperties(): string[] | undefined {
        // Use the FilterBar's method which handles temporary state
        return this.filterBar?.getCurrentVisibleProperties();
    }

    /**
     * Enhance list view task events to look like task cards
     */
    private enhanceListViewTaskEvent(arg: any, taskInfo: TaskInfo, eventType: string, isCompleted: boolean): void {
        const { el } = arg;

        // Add task card classes
        el.classList.add('fc-task-event', 'fc-list-task-card');
        el.setAttribute('data-task-path', taskInfo.path);
        el.setAttribute('data-event-type', eventType);

        // Apply priority and status colors as CSS custom properties
        const priorityConfig = this.plugin.priorityManager.getPriorityConfig(taskInfo.priority);
        if (priorityConfig) {
            el.style.setProperty('--priority-color', priorityConfig.color);
        }

        const statusConfig = this.plugin.statusManager.getStatusConfig(taskInfo.status);
        if (statusConfig) {
            el.style.setProperty('--current-status-color', statusConfig.color);
        }

        // Get visible properties for metadata display
        const visibleProperties = this.getCurrentVisibleProperties() || ['due', 'scheduled', 'projects', 'contexts', 'tags'];

        // Find the main event content elements
        const titleElement = el.querySelector('.fc-list-event-title, .fc-event-title');
        const graphicElement = el.querySelector('.fc-list-event-graphic');

        // Add status-colored dot to the graphic column
        if (graphicElement && statusConfig) {
            graphicElement.innerHTML = '';
            const statusDot = graphicElement.createEl('div', {
                cls: 'fc-list-event-status-dot'
            });
            statusDot.style.width = '10px';
            statusDot.style.height = '10px';
            statusDot.style.borderRadius = '50%';
            statusDot.style.border = `2px solid ${statusConfig.color}`;
            // Only fill background if task is completed
            statusDot.style.backgroundColor = isCompleted ? statusConfig.color : 'transparent';
            statusDot.setAttribute('aria-label', `Status: ${statusConfig.label || taskInfo.status}`);
        }

        if (titleElement) {
            // Completely clear all content including text nodes
            while (titleElement.firstChild) {
                titleElement.removeChild(titleElement.firstChild);
            }

            // Create main title row with indicators and title on same line
            const titleRow = titleElement.createEl('div', { cls: 'fc-list-task-title-row' });


            // Add priority dot
            if (taskInfo.priority && priorityConfig && (!visibleProperties || visibleProperties.includes('priority'))) {
                const priorityDot = titleRow.createEl('span', {
                    cls: 'fc-list-task-priority-dot',
                    attr: { 'aria-label': `Priority: ${priorityConfig.label}` }
                });
                priorityDot.style.borderColor = priorityConfig.color;

                // Add click context menu for priority
                priorityDot.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation(); // Don't trigger card click
                    const menu = new PriorityContextMenu({
                        currentValue: taskInfo.priority,
                        onSelect: async (newPriority) => {
                            try {
                                await this.plugin.updateTaskProperty(taskInfo, 'priority', newPriority);
                            } catch (error) {
                                console.error('Error updating priority:', error);
                                new Notice('Failed to update priority');
                            }
                        },
                        plugin: this.plugin
                    });
                    menu.show(e as MouseEvent);
                });
            }

            // Add recurring indicator
            if (taskInfo.recurrence) {
                const recurringIndicator = titleRow.createEl('span', {
                    cls: 'fc-list-task-recurring-indicator',
                    attr: { 'aria-label': 'Recurring task' }
                });
                setIcon(recurringIndicator, 'rotate-ccw');

                // Add click context menu for recurrence
                recurringIndicator.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation(); // Don't trigger card click
                    const menu = new RecurrenceContextMenu({
                        currentValue: typeof taskInfo.recurrence === 'string' ? taskInfo.recurrence : undefined,
                        onSelect: async (newRecurrence: string | null) => {
                            try {
                                await this.plugin.updateTaskProperty(taskInfo, 'recurrence', newRecurrence || undefined);
                            } catch (error) {
                                console.error('Error updating recurrence:', error);
                                new Notice('Failed to update recurrence');
                            }
                        },
                        app: this.plugin.app
                    });
                    menu.show(e as MouseEvent);
                });
            }

            // Add title
            const titleText = titleRow.createEl('span', {
                cls: 'fc-list-task-title',
                text: taskInfo.title
            });

            if (isCompleted) {
                titleText.style.textDecoration = 'line-through';
                titleText.style.opacity = '0.7';
            }

            // Add metadata based on visible properties
            const metadataContainer = titleElement.createEl('div', { cls: 'fc-list-task-metadata' });
            this.addTaskMetadataToListEvent(metadataContainer, taskInfo, visibleProperties, eventType);
        }

        // Add hover preview and context menu
        this.addTaskInteractionsToListEvent(el, taskInfo);
    }

    /**
     * Render a single property for list view with comprehensive TaskCard compatibility
     */
    private renderListViewProperty(container: HTMLElement, propertyId: string, taskInfo: TaskInfo): HTMLElement | null {
        // Get property value using TaskCard's logic patterns
        let value: any = null;

        switch (propertyId) {
            case 'due':
                value = taskInfo.due;
                break;
            case 'scheduled':
                value = taskInfo.scheduled;
                break;
            case 'projects':
                value = taskInfo.projects;
                break;
            case 'contexts':
                value = taskInfo.contexts;
                break;
            case 'tags':
                value = taskInfo.tags;
                break;
            case 'timeEstimate':
                value = taskInfo.timeEstimate;
                break;
            case 'totalTrackedTime':
                value = taskInfo.totalTrackedTime;
                break;
            case 'recurrence':
                value = taskInfo.recurrence;
                break;
            case 'completedDate':
                value = taskInfo.completedDate;
                break;
            case 'file.ctime':
                value = taskInfo.dateCreated;
                break;
            case 'file.mtime':
                value = taskInfo.dateModified;
                break;
            default:
                // Handle user properties and custom properties
                if (propertyId.startsWith('user:')) {
                    const fieldId = propertyId.slice(5);
                    const userField = this.plugin.settings.userFields?.find(f => f.id === fieldId);
                    if (userField?.key) {
                        value = (taskInfo as any)[userField.key];
                    }
                } else if (taskInfo.customProperties && propertyId in taskInfo.customProperties) {
                    value = taskInfo.customProperties[propertyId];
                }
                break;
        }

        // Check if value is valid for display
        if (!this.hasValidValue(value)) {
            return null;
        }

        const element = container.createEl('span', {
            cls: `fc-list-task-${propertyId.replace(':', '-').replace('.', '-')}`
        });

        // Render the property based on type
        this.renderPropertyValue(element, propertyId, value, taskInfo);

        return element;
    }

    /**
     * Check if a value is valid for display (matching TaskCard logic)
     */
    private hasValidValue(value: any): boolean {
        return value !== null &&
               value !== undefined &&
               !(Array.isArray(value) && value.length === 0) &&
               !(typeof value === 'string' && value.trim() === '');
    }

    /**
     * Render property value with proper formatting and interactions
     */
    private renderPropertyValue(element: HTMLElement, propertyId: string, value: any, taskInfo: TaskInfo): void {
        switch (propertyId) {
            case 'due':
                this.renderDueDateProperty(element, value, taskInfo);
                break;
            case 'scheduled':
                this.renderScheduledDateProperty(element, value, taskInfo);
                break;
            case 'projects':
                this.renderProjectsProperty(element, value);
                break;
            case 'contexts':
                this.renderContextsProperty(element, value);
                break;
            case 'tags':
                this.renderTagsProperty(element, value);
                break;
            case 'timeEstimate':
                element.textContent = `${this.plugin.formatTime(value)} estimated`;
                break;
            case 'totalTrackedTime':
                if (value > 0) {
                    element.textContent = `${this.plugin.formatTime(value)} tracked`;
                }
                break;
            case 'recurrence':
                element.textContent = `Recurring: ${this.getRecurrenceDisplayText(value)}`;
                break;
            case 'completedDate':
                element.textContent = `Completed: ${this.formatDateForDisplay(value)}`;
                break;
            case 'file.ctime':
                element.textContent = `Created: ${this.formatDateForDisplay(value)}`;
                break;
            case 'file.mtime':
                element.textContent = `Modified: ${this.formatDateForDisplay(value)}`;
                break;
            default:
                // Handle user properties and generic values
                if (propertyId.startsWith('user:')) {
                    const fieldId = propertyId.slice(5);
                    const userField = this.plugin.settings.userFields?.find(f => f.id === fieldId);
                    const fieldName = userField?.displayName || fieldId;
                    element.textContent = `${fieldName}: ${String(value)}`;
                } else {
                    // Generic property
                    const displayName = propertyId.charAt(0).toUpperCase() + propertyId.slice(1);
                    element.textContent = `${displayName}: ${String(value)}`;
                }
                break;
        }
    }

    // Helper methods for specific property rendering
    private renderDueDateProperty(element: HTMLElement, due: string, taskInfo: TaskInfo): void {
        const userTimeFormat = this.plugin.settings.calendarViewSettings.timeFormat;
        const display = formatDateTimeForDisplay(due, {
            dateFormat: 'MMM d',
            showTime: true,
            userTimeFormat
        });
        element.textContent = `Due: ${display}`;
        element.classList.add('fc-list-task-date', 'fc-list-task-date--due');

        // Add click handler for date editing (like TaskCard)
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            // TODO: Implement date context menu if needed
        });
    }

    private renderScheduledDateProperty(element: HTMLElement, scheduled: string, taskInfo: TaskInfo): void {
        const userTimeFormat = this.plugin.settings.calendarViewSettings.timeFormat;
        const display = formatDateTimeForDisplay(scheduled, {
            dateFormat: 'MMM d',
            showTime: true,
            userTimeFormat
        });
        element.textContent = `Scheduled: ${display}`;
        element.classList.add('fc-list-task-date', 'fc-list-task-date--scheduled');
    }

    private renderProjectsProperty(element: HTMLElement, projects: string[]): void {
        const iconSpan = element.createEl('span', { cls: 'fc-list-task-projects-icon' });
        setIcon(iconSpan, 'folder');
        element.createEl('span', { text: ` ${projects.join(', ')}` });
    }

    private renderContextsProperty(element: HTMLElement, contexts: string[]): void {
        element.textContent = `@ ${contexts.join(', ')}`;
        // TODO: Add click handlers for context search like TaskCard
    }

    private renderTagsProperty(element: HTMLElement, tags: string[]): void {
        element.textContent = `# ${tags.join(', ')}`;
        // TODO: Add click handlers for tag search like TaskCard
    }

    private getRecurrenceDisplayText(recurrence: string): string {
        return getRecurrenceDisplayText(recurrence);
    }

    private formatDateForDisplay(dateString: string): string {
        const userTimeFormat = this.plugin.settings.calendarViewSettings.timeFormat;
        return formatDateTimeForDisplay(dateString, {
            dateFormat: 'MMM d',
            showTime: false,
            userTimeFormat
        });
    }

    /**
     * Add task metadata to list view events
     */
    private addTaskMetadataToListEvent(container: HTMLElement, taskInfo: TaskInfo, visibleProperties: string[], eventType: string): void {
        const metadataElements: HTMLElement[] = [];

        for (const propertyId of visibleProperties) {
            // Skip status and priority as they're shown as dots
            if (propertyId === 'status' || propertyId === 'priority') continue;

            // Skip the property that's already shown as the event type
            if ((propertyId === 'due' && eventType === 'due') ||
                (propertyId === 'scheduled' && (eventType === 'scheduled' || eventType === 'recurring'))) {
                continue;
            }

            let element: HTMLElement | null = null;

            // Use TaskCard's renderPropertyMetadata function for comprehensive property support
            element = this.renderListViewProperty(container, propertyId, taskInfo);

            if (element) {
                metadataElements.push(element);
            }
        }

        // No separators between metadata elements for cleaner appearance
    }

    /**
     * Add task interactions (hover and context menu) to list view events
     */
    private addTaskInteractionsToListEvent(el: HTMLElement, taskInfo: TaskInfo): void {
        const targetDate = this.plugin.selectedDate || new Date();

        // Add hover preview using TaskCard hover handler
        el.addEventListener('mouseover', createTaskHoverHandler(taskInfo, this.plugin));

        // Add click handlers with single/double click distinction like TaskCard
        const { clickHandler, dblclickHandler } = createTaskClickHandler({
            task: taskInfo,
            plugin: this.plugin,
            excludeSelector: '.fc-list-task-priority-dot, .fc-list-task-recurring-indicator',
            contextMenuHandler: async (e) => {
                await this.showTaskContextMenuForEvent(e, taskInfo, targetDate);
            }
        });

        el.addEventListener('click', clickHandler);
        el.addEventListener('dblclick', dblclickHandler);

        // Add context menu
        el.addEventListener('contextmenu', async (jsEvent: MouseEvent) => {
            jsEvent.preventDefault();
            jsEvent.stopPropagation();
            await this.showTaskContextMenuForEvent(jsEvent, taskInfo, targetDate);
        });

        // Status dots are visual indicators only - use context menu for status changes
    }

    async refreshEvents(force = false) {
        if (this.calendar) {
            try {
                if (force) {
                    // Clear caches on forced refresh
                    this.taskVersionCache.clear();
                }

                // For a complete refresh, remove all event sources and re-add them
                // This ensures FullCalendar doesn't cache any stale positions
                this.calendar.removeAllEventSources();
                this.calendar.addEventSource({
                    events: this.getCalendarEvents.bind(this)
                });

                // Update tracking variables
                this.lastRefreshTime = Date.now();

                // Update task count for change detection (estimate based on cache)
                this.lastKnownTaskCount = this.taskVersionCache.size;

                console.log(`Full refresh completed`);
            } catch (error) {
                console.error('Calendar refresh failed:', error);
                // Clear potentially corrupted cache
                this.taskVersionCache.clear();
                throw error;
            }
        }
    }

    /**
     * Update only events related to a specific task, avoiding full calendar refresh
     * @param taskPath - Path to the task file
     * @param operation - Type of update operation
     * @returns Promise<boolean> - Success status, false triggers fallback refresh
     */
    async updateSpecificEvent(
        taskPath: string,
        operation: 'update' | 'delete' | 'create'
    ): Promise<boolean> {
        try {
            if (!this.calendar) return false;

            const existingEvents = this.calendar.getEvents();
            const taskEvents = existingEvents.filter(e =>
                e.extendedProps?.taskInfo?.path === taskPath ||
                e.id?.includes(taskPath) // Handle recurring event IDs
            );

            switch (operation) {
                case 'update':
                    return await this.updateTaskEvents(taskPath, taskEvents);
                case 'delete':
                    return this.deleteTaskEvents(taskEvents);
                case 'create':
                    return await this.createTaskEvents(taskPath);
                default:
                    return false;
            }
        } catch (error) {
            console.error(`Failed to update specific event for ${taskPath}:`, error);
            return false; // Triggers fallback refresh
        }
    }

    /**
     * Update existing events for a task
     */
    private async updateTaskEvents(taskPath: string, existingEvents: EventApi[]): Promise<boolean> {
        // Get fresh task data
        const freshTask = await this.plugin.cacheManager.getTaskInfo(taskPath);
        if (!freshTask) {
            // Task was deleted, remove events
            existingEvents.forEach(e => e.remove());
            return true;
        }

        // Remove old events for this task
        existingEvents.forEach(e => e.remove());

        // Generate new events for updated task
        const newEvents = await this.generateEventsForTask(freshTask);

        // Add new events to calendar
        newEvents.forEach(eventData => {
            this.calendar!.addEvent(eventData);
        });

        return true;
    }

    /**
     * Delete events for a task
     */
    private deleteTaskEvents(taskEvents: EventApi[]): boolean {
        taskEvents.forEach(e => e.remove());
        return true;
    }

    /**
     * Create events for a new task
     */
    private async createTaskEvents(taskPath: string): Promise<boolean> {
        const newTask = await this.plugin.cacheManager.getTaskInfo(taskPath);
        if (!newTask) return false;

        const newEvents = await this.generateEventsForTask(newTask);
        newEvents.forEach(eventData => {
            this.calendar!.addEvent(eventData);
        });

        return true;
    }

    /**
     * Check if task has actually changed since last update
     */
    private hasTaskChanged(task: TaskInfo): boolean {
        const cachedVersion = this.taskVersionCache.get(task.path);
        const currentVersion = task.dateModified || Date.now().toString();

        if (cachedVersion !== currentVersion) {
            this.taskVersionCache.set(task.path, currentVersion);
            return true;
        }
        return false;
    }

    /**
     * Check if we need a full refresh vs selective update
     */
    private shouldDoFullRefresh(): boolean {
        const timeSinceLastRefresh = Date.now() - this.lastRefreshTime;
        const cacheSize = this.taskVersionCache.size;

        // Full refresh if:
        // - Haven't refreshed in 5+ minutes (stale cache)
        // - Significant change in task count (bulk operations)
        // - Cache seems corrupted
        return timeSinceLastRefresh > 5 * 60 * 1000 ||
               Math.abs(cacheSize - this.lastKnownTaskCount) > 10 ||
               cacheSize === 0;
    }

    /**
     * Intelligent update method that chooses between full refresh and selective update
     */
    async updateCalendarForTask(taskPath: string, operation: 'update' | 'delete' | 'create' = 'update'): Promise<void> {
        // Check if we need full refresh
        if (this.shouldDoFullRefresh()) {
            console.log('Performing full calendar refresh (cache stale or bulk changes detected)');
            await this.refreshEvents();
            return;
        }

        // Try selective update first
        const success = await this.updateSpecificEvent(taskPath, operation);

        if (!success) {
            console.log(`Selective update failed for ${taskPath}, falling back to full refresh`);
            await this.refreshEvents();
        } else {
            console.log(`Selective update successful for ${taskPath}`);
        }
    }

    /**
     * Debounced update to avoid refresh storms when multiple views are open
     */
    private debouncedUpdateCalendar(): void {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
        }

        this.updateDebounceTimer = window.setTimeout(async () => {
            try {
                const pathsToUpdate = Array.from(this.pendingUpdates);
                this.pendingUpdates.clear();

                console.log(`Processing batched updates for ${pathsToUpdate.length} tasks`);

                if (pathsToUpdate.length > 5) {
                    // Too many updates, do full refresh
                    await this.refreshEvents();
                } else {
                    // Process selective updates
                    for (const path of pathsToUpdate) {
                        await this.updateCalendarForTask(path, 'update');
                    }
                }

                // Update FilterBar options once for all updates
                if (this.filterBar && pathsToUpdate.length > 0) {
                    const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                    this.filterBar.updateFilterOptions(updatedFilterOptions);
                }

                // Periodic cache cleanup
                if (Math.random() < 0.1) { // 10% chance to clean up
                    await this.cleanupTaskVersionCache();
                }
            } catch (error) {
                console.error('Error in debounced calendar update:', error);
                // Fallback to full refresh on error
                await this.refreshEvents();
            } finally {
                this.updateDebounceTimer = null;
            }
        }, 100); // 100ms debounce delay
    }

    /**
     * Debounced full refresh to avoid multiple simultaneous refreshes
     */
    private debouncedFullRefresh(): void {
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
        }

        // Clear pending selective updates since we're doing a full refresh
        this.pendingUpdates.clear();

        this.updateDebounceTimer = window.setTimeout(async () => {
            try {
                await this.refreshEvents();

                // Update FilterBar options
                if (this.filterBar) {
                    const updatedFilterOptions = await this.plugin.filterService.getFilterOptions();
                    this.filterBar.updateFilterOptions(updatedFilterOptions);
                }
            } catch (error) {
                console.error('Error in debounced full refresh:', error);
            } finally {
                this.updateDebounceTimer = null;
            }
        }, 150); // Slightly longer delay for full refresh
    }

    /**
     * Periodic cache cleanup to prevent unbounded growth
     */
    private async cleanupTaskVersionCache(): Promise<void> {
        try {
            // This would need integration with CacheManager to get all known task paths
            // const existingPaths = new Set<string>();

            // Get all task paths from cache manager if available
            // For now, we'll implement a basic cleanup based on cache size
            if (this.taskVersionCache.size > 1000) {
                // Clear cache if it gets too large - full refresh will repopulate it
                console.log('Task version cache too large, clearing for memory management');
                this.taskVersionCache.clear();
                this.lastRefreshTime = 0; // Force full refresh next time
            }
        } catch (error) {
            console.error('Error cleaning up task version cache:', error);
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

        // Clean up caches for memory management
        this.taskVersionCache.clear();
        this.pendingUpdates.clear();

        // Clean up debounce timer
        if (this.updateDebounceTimer) {
            clearTimeout(this.updateDebounceTimer);
            this.updateDebounceTimer = null;
        }

        // Clean up function listeners
        this.functionListeners.forEach(unsubscribe => unsubscribe());
        this.functionListeners = [];

        // Clean up event listeners
        this.listeners.forEach(listener => this.plugin.emitter.offref(listener));
        this.listeners = [];
        
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
        const contextMenu = new ICSEventContextMenu({
            icsEvent: icsEvent,
            plugin: this.plugin,
            subscriptionName: subscriptionName,
            onUpdate: () => {
                // Refresh the calendar to show any newly created/linked notes
                this.refreshEvents();
            }
        });
        
        contextMenu.show(jsEvent);
    }

    private async showTaskContextMenuForEvent(jsEvent: MouseEvent, taskInfo: TaskInfo, targetDate: Date): Promise<void> {
        const contextMenu = new TaskContextMenu({
            task: taskInfo,
            plugin: this.plugin,
            targetDate: targetDate,
            onUpdate: () => {
                // Refresh the calendar to show any updates
                this.refreshEvents();
            }
        });
        
        contextMenu.show(jsEvent);
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
                            const start = parseDateToLocal(timeEntry.startTime);
                            const end = parseDateToLocal(timeEntry.endTime);
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
