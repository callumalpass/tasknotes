import { ItemView, WorkspaceLeaf, TFile, Notice, EventRef, Menu } from 'obsidian';
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
    TimeEntry,
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
    combineDateAndTime,
    getCurrentDateTimeString,
    parseDate 
} from '../utils/dateUtils';
import { 
    isRecurringTaskDueOn, 
    getEffectiveTaskStatus,
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
    private headerCollapsed: boolean = true;

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
        
        // Initialize with default filter query
        this.currentQuery = {
            searchQuery: undefined,
            statuses: undefined,
            contexts: undefined,
            priorities: undefined,
            dateRange: undefined,
            showArchived: false,
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
        
        const contentEl = this.contentEl;
        contentEl.empty();
        contentEl.addClass('tasknotes-plugin');
        contentEl.addClass('advanced-calendar-view');

        // Create the calendar container
        await this.renderView();
        
        // Register event listeners
        this.registerEvents();
        
        // Initialize the calendar
        await this.initializeCalendar();
    }

    async renderView() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Create main layout container
        const mainContainer = contentEl.createDiv({ cls: 'advanced-calendar-view__container' });
        
        // Create header with controls
        await this.createHeader(mainContainer);
        
        // Create calendar container (now full width)
        const calendarContainer = mainContainer.createDiv({ 
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
        
        // Create FilterBar container
        const filterBarContainer = mainRow.createDiv({ cls: 'filter-bar-container' });
        
        // Get filter options from FilterService
        const filterOptions = await this.plugin.filterService.getFilterOptions();
        
        // Create FilterBar with AdvancedCalendarView configuration
        this.filterBar = new FilterBar(
            filterBarContainer,
            this.currentQuery,
            filterOptions,
            {
                showSearch: true,
                showGroupBy: false, // Calendar doesn't need grouping
                showSortBy: false,  // Calendar sorts by date
                showAdvancedFilters: true,
                showDateRangePicker: false, // Calendar provides date navigation
                allowedSortKeys: [],
                allowedGroupKeys: []
            }
        );
        
        // Initialize FilterBar
        await this.filterBar.initialize();
        
        // Set up cache refresh mechanism for FilterBar
        this.filterBar.setupCacheRefresh(this.plugin.cacheManager, this.plugin.filterService);
        
        // Listen for filter changes
        this.filterBar.on('queryChange', async (newQuery: FilterQuery) => {
            this.currentQuery = newQuery;
            // Save the filter state
            await this.plugin.viewStateManager.setFilterState(ADVANCED_CALENDAR_VIEW_TYPE, newQuery);
            this.refreshEvents();
        });
        
        // Controls section - view toggles and button
        const controlsSection = mainRow.createDiv({ cls: 'advanced-calendar-view__controls' });
        
        // View toggles
        const toggles = controlsSection.createDiv({ cls: 'advanced-calendar-view__toggles' });
        
        // Create all view toggles
        this.createViewToggles(toggles);
        
        // Schedule Tasks button
        const scheduleTasksBtn = controlsSection.createEl('button', {
            text: 'Schedule tasks',
            cls: 'advanced-calendar-view__schedule-tasks-btn'
        });
        scheduleTasksBtn.addEventListener('click', () => {
            this.openScheduleTasksModal();
        });
        
        // Add help text for timeblock creation if enabled
        if (this.plugin.settings.calendarViewSettings.enableTimeblocking) {
            const helpText = controlsSection.createDiv({ 
                cls: 'advanced-calendar-view__help-text'
            });
            helpText.innerHTML = '💡 <strong>Timeblocks:</strong> Hold Shift + drag to create • Drag to move • Resize edges to adjust duration';
        }
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

    private renderViewToggles() {
        // Re-render the controls section to update toggle visibility
        const controlsSection = this.contentEl.querySelector('.advanced-calendar-view__controls');
        if (controlsSection) {
            // Clear existing toggles
            const togglesContainer = controlsSection.querySelector('.advanced-calendar-view__toggles');
            if (togglesContainer) {
                togglesContainer.empty();
                
                // Re-create toggles
                this.createViewToggles(togglesContainer as HTMLElement);
            }
            
            // Update help text visibility
            const existingHelpText = controlsSection.querySelector('.advanced-calendar-view__help-text');
            if (existingHelpText) {
                existingHelpText.remove();
            }
            
            // Add help text if timeblocking is enabled
            if (this.plugin.settings.calendarViewSettings.enableTimeblocking) {
                const helpText = controlsSection.createDiv({ 
                    cls: 'advanced-calendar-view__help-text'
                });
                helpText.innerHTML = '💡 <strong>Timeblocks:</strong> Hold Shift + drag to create • Drag to move • Resize edges to adjust duration';
            }
        }
    }

    private createViewToggles(toggles: HTMLElement) {
        // Scheduled Tasks toggle
        this.createToggle(
            toggles,
            'Scheduled tasks',
            this.showScheduled,
            (enabled) => {
                this.showScheduled = enabled;
                this.saveViewPreferences();
                this.refreshEvents();
            }
        );
        
        // Due Dates toggle
        this.createToggle(
            toggles,
            'Due dates',
            this.showDue,
            (enabled) => {
                this.showDue = enabled;
                this.saveViewPreferences();
                this.refreshEvents();
            }
        );
        
        // Time Entries toggle
        this.createToggle(
            toggles,
            'Time entries',
            this.showTimeEntries,
            (enabled) => {
                this.showTimeEntries = enabled;
                this.saveViewPreferences();
                this.refreshEvents();
            }
        );
        
        // Recurring Tasks toggle
        this.createToggle(
            toggles,
            'Recurring tasks',
            this.showRecurring,
            (enabled) => {
                this.showRecurring = enabled;
                this.saveViewPreferences();
                this.refreshEvents();
            }
        );
        
        // ICS Events toggle
        this.createToggle(
            toggles,
            'Calendar subscriptions',
            this.showICSEvents,
            (enabled) => {
                this.showICSEvents = enabled;
                this.saveViewPreferences();
                this.refreshEvents();
            }
        );
        
        // Timeblocks toggle (only show if timeblocking is enabled)
        if (this.plugin.settings.calendarViewSettings.enableTimeblocking) {
            this.createToggle(
                toggles,
                'Timeblocks',
                this.showTimeblocks,
                (enabled) => {
                    this.showTimeblocks = enabled;
                    this.saveViewPreferences();
                    this.refreshEvents();
                }
            );
        }
    }
    
    private getHeaderToolbarConfig() {
        // Hide FullCalendar header on mobile when collapsed
        if (this.headerCollapsed && window.innerWidth <= 768) {
            return false; // This hides the entire header toolbar
        }
        
        return {
            left: 'prev,next today',
            center: 'title',
            right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay'
        };
    }

    createToggle(
        container: HTMLElement, 
        label: string, 
        initialValue: boolean, 
        onChange: (enabled: boolean) => void
    ): HTMLElement {
        const toggleContainer = container.createDiv({ cls: 'advanced-calendar-view__toggle' });
        
        const checkbox = toggleContainer.createEl('input', {
            type: 'checkbox',
            cls: 'advanced-calendar-view__toggle-input'
        });
        checkbox.checked = initialValue;
        
        const labelEl = toggleContainer.createEl('label', {
            text: label,
            cls: 'advanced-calendar-view__toggle-label'
        });
        
        checkbox.addEventListener('change', () => {
            onChange(checkbox.checked);
        });
        
        return toggleContainer;
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
                    scheduledDate = format(options.date, 'yyyy-MM-dd');
                } else if (options.time) {
                    scheduledDate = format(options.date, 'yyyy-MM-dd') + 'T' + options.time;
                } else {
                    // Default to 9 AM if no time specified
                    scheduledDate = format(options.date, 'yyyy-MM-dd') + 'T09:00';
                }
            } else {
                // Default to today at 9 AM
                scheduledDate = format(new Date(), 'yyyy-MM-dd') + 'T09:00';
            }
            
            await this.plugin.taskService.updateProperty(task, 'scheduled', scheduledDate);
        } catch (error) {
            console.error('Error scheduling task:', error);
        }
    }

    async initializeCalendar() {
        const calendarEl = document.getElementById('advanced-calendar');
        if (!calendarEl) {
            console.error('Calendar element not found');
            return;
        }

        const calendarSettings = this.plugin.settings.calendarViewSettings;
        
        this.calendar = new Calendar(calendarEl, {
            plugins: [dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin],
            initialView: calendarSettings.defaultView,
            headerToolbar: this.getHeaderToolbarConfig(),
            height: '100%',
            editable: true,
            droppable: true,
            selectable: true,
            selectMirror: calendarSettings.selectMirror,
            
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

        this.calendar.render();
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

    private getSlotLabelInterval(slotDuration: string): string {
        // Show labels every hour, but at least as often as the slot duration
        switch (slotDuration) {
            case '00:15:00': return '01:00:00'; // 15-min slots, hourly labels
            case '00:30:00': return '01:00:00'; // 30-min slots, hourly labels  
            case '01:00:00': return '01:00:00'; // 1-hour slots, hourly labels
            default: return '01:00:00';
        }
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
            const visibleStart = calendarView?.activeStart || startOfDay(new Date());
            const visibleEnd = calendarView?.activeEnd || endOfDay(new Date());
            
            for (const task of allTasks) {
                // Handle recurring tasks
                if (this.showRecurring && task.recurrence && task.scheduled) {
                    const recurringEvents = this.generateRecurringInstances(task, visibleStart, visibleEnd);
                    events.push(...recurringEvents);
                } else {
                    // Add non-recurring scheduled events (only if not recurring)
                    if (this.showScheduled && task.scheduled && !task.recurrence) {
                        const scheduledEvent = this.createScheduledEvent(task);
                        if (scheduledEvent) events.push(scheduledEvent);
                    }
                }
                
                // Add due events (only if no scheduled event exists to avoid duplicates)
                if (this.showDue && task.due && !task.scheduled) {
                    const dueEvent = this.createDueEvent(task);
                    if (dueEvent) events.push(dueEvent);
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
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
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
                    isCompleted: isCompleted
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

    generateRecurringInstances(task: TaskInfo, startDate: Date, endDate: Date): CalendarEvent[] {
        if (!task.recurrence || !task.scheduled) {
            return [];
        }

        const instances: CalendarEvent[] = [];
        const templateTime = this.getRecurringTime(task);
        
        // Iterate through each day in the visible range
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            // Check if this recurring task should appear on this date
            if (isRecurringTaskDueOn(task, currentDate)) {
                // Stop if past due date
                if (task.due && currentDate > parseDate(task.due)) {
                    break;
                }

                const instanceDate = format(currentDate, 'yyyy-MM-dd');
                const eventStart = `${instanceDate}T${templateTime}`;
                
                // Create the recurring event instance
                const recurringEvent = this.createRecurringEvent(task, eventStart, instanceDate, templateTime);
                if (recurringEvent) {
                    instances.push(recurringEvent);
                }
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
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
        const textDecoration = isInstanceCompleted ? 'line-through' : 'none';
        
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
    
    private handleTaskCreation(start: Date, end: Date, allDay: boolean) {
        // Pre-populate with selected date/time
        const scheduledDate = allDay 
            ? format(start, 'yyyy-MM-dd')
            : format(start, "yyyy-MM-dd'T'HH:mm");
            
        const timeEstimate = allDay 
            ? 60 // Default 1 hour for all-day events
            : Math.round((end.getTime() - start.getTime()) / (1000 * 60)); // Duration in minutes
        
        const modal = new TaskCreationModal(this.app, this.plugin, {
            scheduled: scheduledDate,
            timeEstimate: timeEstimate > 0 ? timeEstimate : 60
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
            const currentDate = new Date(visibleStart);
            while (currentDate <= visibleEnd) {
                const dateString = format(currentDate, 'yyyy-MM-dd');
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
        const { taskInfo, icsEvent, timeblock, eventType, isRecurringInstance, subscriptionName } = clickInfo.event.extendedProps;
        const jsEvent = clickInfo.jsEvent;
        
        if (eventType === 'timeEntry') {
            // Time entries are read-only, just show info
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
            const editModal = new TaskEditModal(this.app, this.plugin, taskInfo);
            editModal.open();
        }
    }

    async handleEventDrop(dropInfo: any) {
        const { taskInfo, timeblock, eventType, isRecurringInstance, recurringTemplateTime, originalDate } = dropInfo.event.extendedProps;
        
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
                const newTime = format(newStart, 'HH:mm');
                const originalDate = getDatePart(taskInfo.scheduled!);
                const updatedScheduled = `${originalDate}T${newTime}`;
                
                // Show notice about the behavior
                new Notice(`Updated recurring task time to ${newTime}. This affects all future instances.`);
                
                // Update the template time in scheduled field
                await this.plugin.taskService.updateProperty(taskInfo, 'scheduled', updatedScheduled);
            } else {
                // Handle non-recurring events normally
                let newDateString: string;
                if (allDay) {
                    newDateString = format(newStart, 'yyyy-MM-dd');
                } else {
                    newDateString = format(newStart, "yyyy-MM-dd'T'HH:mm");
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
        
        if (eventType !== 'scheduled') {
            // Only scheduled events and timeblocks can be resized (not timeEntry, ics, due, or recurring)
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
                scheduledDate = format(dropDate, 'yyyy-MM-dd');
            } else {
                // Specific time - include time
                scheduledDate = format(dropDate, "yyyy-MM-dd'T'HH:mm");
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
            arg.el.title = `${icsEvent?.title || 'Event'} (from ${subscriptionName || 'Calendar subscription'})`;
            
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
            arg.el.title = tooltipText;
            
            return;
        }
        
        // Handle task events
        if (!taskInfo || !taskInfo.path) {
            return;
        }
        
        // Add data attributes for tasks
        arg.el.setAttribute('data-task-path', taskInfo.path);
        arg.el.classList.add('fc-task-event');
        
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
        
        // Add context menu event listener (not for time entries)
        if (eventType !== 'timeEntry') {
            arg.el.addEventListener("contextmenu", (jsEvent: MouseEvent) => {
                jsEvent.preventDefault();
                jsEvent.stopPropagation();
                
                // For recurring instances, use the instance date
                const targetDate = isRecurringInstance && instanceDate 
                    ? parseDate(instanceDate) 
                    : (arg.event.start || new Date());
                    
                showTaskContextMenu(jsEvent, taskInfo.path, this.plugin, targetDate);
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
        const dataListener = this.plugin.emitter.on(EVENT_DATA_CHANGED, () => {
            this.refreshEvents();
        });
        this.listeners.push(dataListener);
        
        // Listen for task updates
        const taskUpdateListener = this.plugin.emitter.on(EVENT_TASK_UPDATED, () => {
            this.refreshEvents();
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
            this.renderViewToggles(); // Re-render toggle buttons
        });
        this.listeners.push(timeblockingToggleListener);
    }

    async refreshEvents() {
        if (this.calendar) {
            this.calendar.refetchEvents();
        }
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
        
        // Destroy calendar
        if (this.calendar) {
            this.calendar.destroy();
            this.calendar = null;
        }
        
        // Clean up
        this.contentEl.empty();
    }

    private showICSEventInfo(icsEvent: ICSEvent, subscriptionName?: string): void {
        const modal = document.createElement('div');
        modal.className = 'modal-container';
        
        const modalBg = modal.createDiv('modal-bg');
        const modalContent = modal.createDiv('modal');
        
        modalContent.createDiv('modal-title').textContent = 'Calendar Event Details';
        
        const content = modalContent.createDiv('modal-content');
        
        // Event title
        const titleSection = content.createDiv();
        titleSection.createEl('strong', { text: 'Title: ' });
        titleSection.createSpan({ text: icsEvent.title || 'Untitled Event' });
        
        // Subscription source
        if (subscriptionName) {
            const sourceSection = content.createDiv();
            sourceSection.createEl('strong', { text: 'Source: ' });
            sourceSection.createSpan({ text: subscriptionName });
        }
        
        // Date/time
        const dateSection = content.createDiv();
        dateSection.createEl('strong', { text: 'Date: ' });
        const startDate = new Date(icsEvent.start);
        let dateText = startDate.toLocaleDateString();
        if (!icsEvent.allDay) {
            dateText += ` at ${startDate.toLocaleTimeString()}`;
            if (icsEvent.end) {
                const endDate = new Date(icsEvent.end);
                dateText += ` - ${endDate.toLocaleTimeString()}`;
            }
        } else if (icsEvent.end) {
            const endDate = new Date(icsEvent.end);
            const endDateStr = endDate.toLocaleDateString();
            if (endDateStr !== dateText) {
                dateText += ` - ${endDateStr}`;
            }
        }
        dateSection.createSpan({ text: dateText });
        
        // Description
        if (icsEvent.description) {
            const descSection = content.createDiv();
            descSection.createEl('strong', { text: 'Description: ' });
            const descEl = descSection.createDiv({ cls: 'ics-event-description' });
            descEl.textContent = icsEvent.description;
        }
        
        // Location
        if (icsEvent.location) {
            const locationSection = content.createDiv();
            locationSection.createEl('strong', { text: 'Location: ' });
            locationSection.createSpan({ text: icsEvent.location });
        }
        
        // URL
        if (icsEvent.url) {
            const urlSection = content.createDiv();
            urlSection.createEl('strong', { text: 'URL: ' });
            const linkEl = urlSection.createEl('a', {
                href: icsEvent.url,
                text: icsEvent.url,
                cls: 'external-link'
            });
            linkEl.setAttribute('target', '_blank');
        }
        
        // Close button
        const buttonContainer = modalContent.createDiv('modal-button-container');
        const closeButton = buttonContainer.createEl('button', { text: 'Close' });
        
        document.body.appendChild(modal);
        
        const handleClose = () => {
            modal.remove();
        };
        
        closeButton.addEventListener('click', handleClose);
        modalBg.addEventListener('click', handleClose);
        
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        });
        
        setTimeout(() => closeButton.focus(), 50);
    }

    private showTimeblockInfo(timeblock: TimeBlock, eventDate: Date): void {
        const modal = document.createElement('div');
        modal.className = 'modal-container';
        
        const modalBg = modal.createDiv('modal-bg');
        const modalContent = modal.createDiv('modal');
        
        modalContent.createDiv('modal-title').textContent = 'Timeblock Details';
        
        const content = modalContent.createDiv('modal-content');
        
        // Timeblock title
        const titleSection = content.createDiv();
        titleSection.createEl('strong', { text: 'Title: ' });
        titleSection.createSpan({ text: timeblock.title });
        
        // Date and time
        const dateSection = content.createDiv();
        dateSection.createEl('strong', { text: 'Time: ' });
        const dateText = `${eventDate.toLocaleDateString()} from ${timeblock.startTime} to ${timeblock.endTime}`;
        dateSection.createSpan({ text: dateText });
        
        // Description
        if (timeblock.description) {
            const descSection = content.createDiv();
            descSection.createEl('strong', { text: 'Description: ' });
            const descEl = descSection.createDiv({ cls: 'timeblock-description' });
            descEl.textContent = timeblock.description;
        }
        
        // Attachments
        if (timeblock.attachments && timeblock.attachments.length > 0) {
            const attachSection = content.createDiv();
            attachSection.createEl('strong', { text: 'Attachments: ' });
            const attachList = attachSection.createDiv({ cls: 'timeblock-attachments' });
            
            for (const attachment of timeblock.attachments) {
                const attachItem = attachList.createDiv({ cls: 'timeblock-attachment-item' });
                
                // Parse markdown link and create clickable element
                const linkMatch = attachment.match(/\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+)\)/);
                if (linkMatch) {
                    const linkText = linkMatch[1] || linkMatch[2] || attachment;
                    const linkPath = linkMatch[1] || linkMatch[3] || attachment;
                    
                    const linkEl = attachItem.createEl('a', {
                        text: linkText,
                        cls: 'internal-link'
                    });
                    
                    linkEl.addEventListener('click', async (e) => {
                        e.preventDefault();
                        // Try to open the linked file
                        const file = this.app.vault.getAbstractFileByPath(linkPath + '.md') || 
                                   this.app.vault.getAbstractFileByPath(linkPath);
                        if (file instanceof TFile) {
                            await this.app.workspace.getLeaf(false).openFile(file);
                            handleClose();
                        } else {
                            new Notice(`File not found: ${linkPath}`);
                        }
                    });
                } else {
                    attachItem.createSpan({ text: attachment });
                }
            }
        }
        
        // Close button
        const buttonContainer = modalContent.createDiv('modal-button-container');
        const closeButton = buttonContainer.createEl('button', { text: 'Close' });
        
        document.body.appendChild(modal);
        
        const handleClose = () => {
            modal.remove();
        };
        
        closeButton.addEventListener('click', handleClose);
        modalBg.addEventListener('click', handleClose);
        
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        });
        
        setTimeout(() => closeButton.focus(), 50);
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
                .onClick(() => {
                    navigator.clipboard.writeText(icsEvent.title);
                    new Notice('Event title copied to clipboard');
                })
        );

        // Copy URL option (if available)
        if (icsEvent.url) {
            menu.addItem((item) =>
                item
                    .setTitle("Copy URL")
                    .setIcon("link")
                    .onClick(() => {
                        navigator.clipboard.writeText(icsEvent.url!);
                        new Notice('Event URL copied to clipboard');
                    })
            );
        }

        menu.showAtMouseEvent(jsEvent);
    }
}
