import TaskNotesPlugin from "../main";
import { BasesViewBase } from "./BasesViewBase";
import { TaskInfo } from "../types";
import { identifyTaskNotesFromBasesData } from "./helpers";
import { Calendar, CalendarOptions } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import multiMonthPlugin from "@fullcalendar/multimonth";
import {
	generateCalendarEvents,
	handleRecurringTaskDrop,
	handleTimeblockDrop,
	handleTimeblockResize,
	handleTimeblockCreation,
	handleTimeEntryCreation,
	handleDateTitleClick,
	getTargetDateForEvent,
	calculateTaskCreationValues,
	generateTaskTooltip,
	applyRecurringTaskStyling,
	applyTimeblockStyling,
	generateTimeblockTooltip,
	addTaskHoverPreview,
	createICSEvent,
	showTimeblockInfoModal,
} from "./calendar-core";
import { handleCalendarTaskClick } from "../utils/clickHandlers";
import { TaskCreationModal } from "../modals/TaskCreationModal";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";
import { Menu, TFile, setIcon, setTooltip } from "obsidian";
import { format } from "date-fns";
import { createTaskCard } from "../ui/TaskCard";
import { createICSEventCard } from "../ui/ICSCard";
import { createPropertyEventCard } from "../ui/PropertyEventCard";
import { createTimeBlockCard } from "../ui/TimeBlockCard";
import { TaskContextMenu } from "../components/TaskContextMenu";
import { ICSEventContextMenu } from "../components/ICSEventContextMenu";
import { formatDateForStorage, hasTimeComponent, parseDateToLocal, parseDateToUTC } from "../utils/dateUtils";

/**
 * Normalize date-like inputs to UTC-anchored strings for all-day values, or
 * to localized datetime strings for time-aware values.
 * Exported for testing.
 */
export function normalizeDateValueForCalendar(
	value: unknown
): { value: string | Date; isAllDay: boolean } | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;

		if (hasTimeComponent(trimmed)) {
			const parsed = parseDateToLocal(trimmed);
			if (isNaN(parsed.getTime())) return null;
			return { value: format(parsed, "yyyy-MM-dd'T'HH:mm"), isAllDay: false };
		}

		try {
			const anchored = parseDateToUTC(trimmed);
			return { value: formatDateForStorage(anchored), isAllDay: true };
		} catch {
			return null;
		}
	}

	if (typeof value === "number") {
		const date = new Date(value);
		if (isNaN(date.getTime())) return null;
		return { value: formatDateForStorage(date), isAllDay: true };
	}

	if (value instanceof Date) {
		if (isNaN(value.getTime())) return null;
		const hasTime =
			value.getHours() !== 0 ||
			value.getMinutes() !== 0 ||
			value.getSeconds() !== 0 ||
			value.getMilliseconds() !== 0;
		if (hasTime) {
			return { value: format(value, "yyyy-MM-dd'T'HH:mm"), isAllDay: false };
		}
		return { value: formatDateForStorage(value), isAllDay: true };
	}

	return null;
}

export class CalendarView extends BasesViewBase {
	type = "tasknoteCalendar";
	calendar: Calendar | null = null; // Made public for factory access
	private calendarEl: HTMLElement | null = null;
	private currentTasks: TaskInfo[] = [];
	private basesEntryByPath: Map<string, any> = new Map(); // Map task path to Bases entry for enrichment
	
	private viewOptions: {
		// Events
		showScheduled: boolean;
		showDue: boolean;
		showRecurring: boolean;
		showTimeEntries: boolean;
		showTimeblocks: boolean;
		showPropertyBasedEvents: boolean;

		// Date navigation
		initialDate: string;
		initialDateProperty: string | null;
		initialDateStrategy: "first" | "earliest" | "latest";

		// Layout
		calendarView: string;
		customDayCount: number;
		listDayCount: number;
		slotMinTime: string;
		slotMaxTime: string;
		slotDuration: string;
		firstDay: number;
		weekNumbers: boolean;
		nowIndicator: boolean;
		showWeekends: boolean;
		showAllDaySlot: boolean;
		showTodayHighlight: boolean;
		selectMirror: boolean;
		timeFormat: string;
		scrollTime: string;
		eventMinHeight: number;
		slotEventOverlap: boolean;
		eventMaxStack: number | null;
		dayMaxEvents: number | boolean;
		dayMaxEventRows: number | boolean;
		// Locale (non-configurable per view)
		locale: string;

		// Property-based events
		startDateProperty: string | null;
		endDateProperty: string | null;
		titleProperty: string | null;

	};


	// ICS/Google/Microsoft calendar toggles (dynamic)
	private icsCalendarToggles = new Map<string, boolean>();
	private googleCalendarToggles = new Map<string, boolean>();
	private microsoftCalendarToggles = new Map<string, boolean>();
	private configLoaded = false; // Track if we've successfully loaded config

	constructor(controller: any, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super(controller, containerEl, plugin);
		// BasesView now provides this.data, this.config, and this.app directly
		(this.dataAdapter as any).basesView = this;
		// Note: Don't read config here - this.config is not set until after construction
		// readViewOptions() will be called in onload()
		// View options (read from config)
		const calendarSettings = this.plugin.settings.calendarViewSettings;
		this.viewOptions = {
			// Events
			showScheduled: calendarSettings.defaultShowScheduled,
			showDue: calendarSettings.defaultShowDue, 
			showRecurring: calendarSettings.defaultShowRecurring,
			showTimeEntries: calendarSettings.defaultShowTimeEntries,
			showTimeblocks: calendarSettings.defaultShowTimeblocks,
			showPropertyBasedEvents: true,

			// Date navigation
			initialDate: "",
			initialDateProperty: null as string | null,
			initialDateStrategy: "first" as "first" | "earliest" | "latest",

			// Layout
			calendarView: calendarSettings.defaultView,
			customDayCount: calendarSettings.customDayCount,
			listDayCount: 7,
			slotMinTime: this.validateTimeValue(calendarSettings.slotMinTime, "00:00:00", false),
			slotMaxTime: this.validateTimeValue(calendarSettings.slotMaxTime, "24:00:00", true), 
			slotDuration: this.validateTimeValue( calendarSettings.slotDuration, "00:30:00", false),
			scrollTime: this.validateTimeValue( calendarSettings.scrollTime, "08:00:00", false),
			firstDay: calendarSettings.firstDay,
			weekNumbers: calendarSettings.weekNumbers,
			nowIndicator: calendarSettings.nowIndicator,
			showWeekends: calendarSettings.showWeekends,
			showAllDaySlot: true,
			showTodayHighlight: calendarSettings.showTodayHighlight,
			selectMirror: calendarSettings.selectMirror,
			timeFormat: calendarSettings.timeFormat,
			eventMinHeight: calendarSettings.eventMinHeight,
			slotEventOverlap: calendarSettings.slotEventOverlap,
			eventMaxStack: calendarSettings.eventMaxStack,
			dayMaxEvents: calendarSettings.dayMaxEvents,
			dayMaxEventRows: calendarSettings.dayMaxEventRows,
			locale: calendarSettings.locale,

			// Property-based events
			startDateProperty: null as string | null,
			endDateProperty: null as string | null,
			titleProperty: null as string | null,
		};
	}

	/**
	 * Component lifecycle: Called when view is first loaded.
	 * Override from Component base class.
	 */
	onload(): void {
		// Read view options now that config is available
		this.readViewOptions();
		// Call parent onload which sets up container and listeners
		super.onload();
	}

	/**
	 * Lifecycle: Handle view resize.
	 * Override to update FullCalendar size when container resizes.
	 */
	onResize(): void {
		if (this.calendar) {
			this.calendar.updateSize();
		}
	}

	/**
	 * Validate and format time string (HH:MM or HH:MM:SS format).
	 * Returns the validated time in HH:MM:SS format, or the default value if invalid.
	 */
	private validateTimeValue(value: string | undefined, defaultValue: string, allowMax24 = false): string {
		if (!value) return defaultValue;

		// If already in HH:MM:SS format, validate it
		if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
			const [hours, minutes] = value.split(':').map(Number);
			const maxHours = allowMax24 ? 24 : 23;

			if (hours < 0 || hours > maxHours || minutes < 0 || minutes > 59) {
				console.warn(`[TaskNotes][CalendarView] Invalid time value: ${value}, using default: ${defaultValue}`);
				return defaultValue;
			}

			// Special case: 24:XX is only valid as 24:00
			if (hours === 24 && minutes !== 0) {
				console.warn(`[TaskNotes][CalendarView] Invalid time value: ${value}, using default: ${defaultValue}`);
				return defaultValue;
			}

			return value;
		}

		// If in HH:MM format, validate and convert to HH:MM:SS
		if (/^\d{2}:\d{2}$/.test(value)) {
			const [hours, minutes] = value.split(':').map(Number);
			const maxHours = allowMax24 ? 24 : 23;

			if (hours < 0 || hours > maxHours || minutes < 0 || minutes > 59) {
				console.warn(`[TaskNotes][CalendarView] Invalid time value: ${value}, using default: ${defaultValue}`);
				return defaultValue;
			}

			// Special case: 24:XX is only valid as 24:00
			if (hours === 24 && minutes !== 0) {
				console.warn(`[TaskNotes][CalendarView] Invalid time value: ${value}, using default: ${defaultValue}`);
				return defaultValue;
			}

			return `${value}:00`;
		}

		// Invalid format
		console.warn(`[TaskNotes][CalendarView] Invalid time format: ${value}, using default: ${defaultValue}`);
		return defaultValue;
	}

	/**
	 * Read event toggle options from config.
	 * These should be re-read on every render to respond to toggle changes.
	 */
	private readEventToggles(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== 'function') {
			return;
		}

		try {
			this.viewOptions.showScheduled = this.config.get('showScheduled') ?? this.viewOptions.showScheduled;
			this.viewOptions.showDue = this.config.get('showDue') ?? this.viewOptions.showDue;
			this.viewOptions.showRecurring = this.config.get('showRecurring') ?? this.viewOptions.showRecurring;
			this.viewOptions.showTimeEntries = this.config.get('showTimeEntries') ?? this.viewOptions.showTimeEntries;
			this.viewOptions.showTimeblocks = this.config.get('showTimeblocks') ?? this.viewOptions.showTimeblocks;
			this.viewOptions.showPropertyBasedEvents = this.config.get('showPropertyBasedEvents') ?? this.viewOptions.showPropertyBasedEvents;

			// ICS calendar toggles
			if (this.plugin.icsSubscriptionService) {
				const subscriptions = this.plugin.icsSubscriptionService.getSubscriptions();
				for (const sub of subscriptions) {
					const key = `showICS_${sub.id}`;
					this.icsCalendarToggles.set(sub.id, this.config.get(key) ?? true);
				}
			}

			// Google calendar toggles
			if (this.plugin.googleCalendarService) {
				const calendars = this.plugin.googleCalendarService.getAvailableCalendars();
				for (const cal of calendars) {
					const key = `showGoogleCalendar_${cal.id}`;
					this.googleCalendarToggles.set(cal.id, this.config.get(key) ?? true);
				}
			}

			// Microsoft calendar toggles
			if (this.plugin.microsoftCalendarService) {
				const calendars = this.plugin.microsoftCalendarService.getAvailableCalendars();
				for (const cal of calendars) {
					const key = `showMicrosoftCalendar_${cal.id}`;
					this.microsoftCalendarToggles.set(cal.id, this.config.get(key) ?? true);
				}
			}
		} catch (e) {
			console.error("[TaskNotes][CalendarView] Error reading event toggles:", e);
		}
	}

	/**
	 * Read view configuration options from BasesViewConfig.
	 * Layout options are only read once to avoid resetting the view on toggle changes.
	 */
	private readViewOptions(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== 'function') {
			return;
		}

		try {
			// Always read event toggles
			this.readEventToggles();

			// Date navigation
			this.viewOptions.initialDate = this.config.get('initialDate') ?? this.viewOptions.initialDate;
			this.viewOptions.initialDateProperty = this.config.get('initialDateProperty') ?? this.viewOptions.initialDateProperty;
			this.viewOptions.initialDateStrategy = this.config.get('initialDateStrategy') ?? this.viewOptions.initialDateStrategy;

			// Layout
			this.viewOptions.calendarView = this.config.get('calendarView') ?? this.viewOptions.calendarView;
			this.viewOptions.customDayCount = this.config.get('customDayCount') ?? this.viewOptions.customDayCount;
			this.viewOptions.listDayCount = this.config.get('listDayCount') ?? this.viewOptions.listDayCount;

			// Validate time values to prevent crashes from invalid input
			this.viewOptions.slotMinTime = this.validateTimeValue(
				this.config.get('slotMinTime'),
				this.viewOptions.slotMinTime,
				false
			);
			this.viewOptions.slotMaxTime = this.validateTimeValue(
				this.config.get('slotMaxTime'),
				this.viewOptions.slotMaxTime,
				true // Allow 24:00 for end time
			);
			this.viewOptions.slotDuration = this.validateTimeValue(
				this.config.get('slotDuration'),
				this.viewOptions.slotDuration,
				false
			);
			this.viewOptions.scrollTime = this.validateTimeValue(
				this.config.get('scrollTime'),
				this.viewOptions.scrollTime,
				false
			);

			this.viewOptions.firstDay = Number(this.config.get('firstDay') ?? this.viewOptions.firstDay);
			this.viewOptions.weekNumbers = this.config.get('weekNumbers') ?? this.viewOptions.weekNumbers;
			this.viewOptions.nowIndicator = this.config.get('nowIndicator') ?? this.viewOptions.nowIndicator;
			this.viewOptions.showWeekends = this.config.get('showWeekends') ?? this.viewOptions.showWeekends;
			this.viewOptions.showAllDaySlot = this.config.get('showAllDaySlot') ?? this.viewOptions.showAllDaySlot;
			this.viewOptions.showTodayHighlight = this.config.get('showTodayHighlight') ?? this.viewOptions.showTodayHighlight;
			this.viewOptions.selectMirror = this.config.get('selectMirror') ?? this.viewOptions.selectMirror;
			this.viewOptions.timeFormat = this.config.get('timeFormat') ?? this.viewOptions.timeFormat;
			this.viewOptions.eventMinHeight = this.config.get('eventMinHeight') ?? this.viewOptions.eventMinHeight;
			this.viewOptions.slotEventOverlap = this.config.get('slotEventOverlap') ?? this.viewOptions.slotEventOverlap;

			// Convert slider values: 0 means special behavior (null/true/false)
			const eventMaxStackValue = this.config.get('eventMaxStack');
			if (eventMaxStackValue !== undefined) {
				this.viewOptions.eventMaxStack = eventMaxStackValue === 0 ? null : eventMaxStackValue;
			}

			const dayMaxEventsValue = this.config.get('dayMaxEvents');
			if (dayMaxEventsValue !== undefined) {
				// 0 = auto (true), positive number = limit
				this.viewOptions.dayMaxEvents = dayMaxEventsValue === 0 ? true : dayMaxEventsValue;
			}

			const dayMaxEventRowsValue = this.config.get('dayMaxEventRows');
			if (dayMaxEventRowsValue !== undefined) {
				// 0 = unlimited (false), positive number = limit
				this.viewOptions.dayMaxEventRows = dayMaxEventRowsValue === 0 ? false : dayMaxEventRowsValue;
			}

			// Property-based events
			this.viewOptions.startDateProperty = this.config.get('startDateProperty') ?? this.viewOptions.startDateProperty;
			this.viewOptions.endDateProperty = this.config.get('endDateProperty') ?? this.viewOptions.endDateProperty;
			this.viewOptions.titleProperty = this.config.get('titleProperty') ?? this.viewOptions.titleProperty;

			// Read enableSearch toggle (default: false for backward compatibility)
			const enableSearchValue = this.config.get('enableSearch');
			this.enableSearch = (enableSearchValue as boolean) ?? false;

			// Mark config as successfully loaded
			this.configLoaded = true;

			// Apply today highlight styling if calendar is already initialized
			if (this.calendar) {
				this.applyTodayHighlightStyling();
			}
		} catch (e) {
			console.error("[TaskNotes][CalendarView] Error reading view options:", e);
		}
	}

	async render(): Promise<void> {
		if (!this.calendarEl || !this.rootElement) return;
		if (!this.data?.data) return;

		// Ensure view options are read (in case config wasn't available in onload)
		if (!this.configLoaded && this.config) {
			this.readViewOptions();
		} else if (this.config) {
			// Always re-read event toggles to respond to toggle changes
			this.readEventToggles();
		}

		// Now that config is loaded, setup search (idempotent: will only create once)
		if (this.rootElement) {
			this.setupSearch(this.rootElement);
		}

		try {
			// Extract tasks from Bases
			const dataItems = this.dataAdapter.extractDataItems();
			const taskNotes = await identifyTaskNotesFromBasesData(dataItems, this.plugin);

			// Apply search filter
			const filteredTasks = this.applySearchFilter(taskNotes);
			this.currentTasks = filteredTasks;

			// Build Bases entry mapping for task enrichment
			this.basesEntryByPath.clear();
			if (this.data?.data) {
				for (const entry of this.data.data) {
					if (entry.file?.path) {
						this.basesEntryByPath.set(entry.file.path, entry);
					}
				}
			}

			// Initialize or update calendar
			if (!this.calendar) {
				await this.initializeCalendar(taskNotes);
			} else {
				await this.updateCalendarEvents(taskNotes);
			}
		} catch (error: any) {
			console.error("[TaskNotes][CalendarView] Error rendering:", error);
			this.renderError(error);
		}
	}

	private async initializeCalendar(taskNotes: TaskInfo[]): Promise<void> {
		if (!this.calendarEl) return;

		// Determine initial date
		const initialDate = this.determineInitialDate(taskNotes);

		// Build calendar options
		const calendarOptions: CalendarOptions = {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin],
			initialView: this.viewOptions.calendarView,
			initialDate: initialDate,
			headerToolbar: {
				left: "prev,next today refreshCalendars",
				center: "title",
				right: "multiMonthYear,dayGridMonth,timeGridWeek,timeGridCustom,timeGridDay,listWeekButton"
			},
			buttonText: {
				today: this.plugin.i18n.translate("views.basesCalendar.today"),
				month: this.plugin.i18n.translate("views.basesCalendar.buttonText.month"),
				week: this.plugin.i18n.translate("views.basesCalendar.buttonText.week"),
				day: this.plugin.i18n.translate("views.basesCalendar.buttonText.day"),
				year: this.plugin.i18n.translate("views.basesCalendar.buttonText.year"),
				list: this.plugin.i18n.translate("views.basesCalendar.buttonText.list"),
			},
			customButtons: {
				listWeekButton: {
					text: this.plugin.i18n.translate("views.basesCalendar.buttonText.list"),
					hint: this.plugin.i18n.translate("views.basesCalendar.buttonText.list") || "List",
					click: () => {
						if (this.calendar) {
							const currentView = this.calendar.view?.type;
							if (currentView !== 'listWeek') {
								this.calendar.changeView('listWeek');
							}
						}
					},
				},
				refreshCalendars: {
					text: this.plugin.i18n.translate("views.basesCalendar.buttonText.refresh") || "Refresh",
					hint: this.plugin.i18n.translate("views.basesCalendar.hints.refresh") || "Refresh calendar subscriptions",
					click: async () => {
						try {
							// Refresh ICS subscriptions
							if (this.plugin.icsSubscriptionService) {
								await this.plugin.icsSubscriptionService.refreshAllSubscriptions();
							}

							// Refresh Google Calendar events
							if (this.plugin.googleCalendarService) {
								await this.plugin.googleCalendarService.refreshAllCalendars();
							}

							// Refresh Microsoft Calendar events
							if (this.plugin.microsoftCalendarService) {
								await this.plugin.microsoftCalendarService.refreshAllCalendars();
							}

							// Refetch calendar events to show updated data
							if (this.calendar) {
								this.calendar.refetchEvents();
							}
						} catch (error) {
							console.error("[TaskNotes][CalendarView] Error refreshing calendars:", error);
						}
					},
				},
			},
			views: {
				timeGridCustom: {
					type: "timeGrid",
					duration: { days: this.viewOptions.customDayCount },
					buttonText: this.plugin.i18n.translate("views.basesCalendar.buttonText.customDays", {
						count: this.viewOptions.customDayCount.toString()
					}),
				},
				listWeek: {
					type: "list",
					duration: { days: this.viewOptions.listDayCount },
					buttonText: this.plugin.i18n.translate("views.basesCalendar.buttonText.listDays", {
						count: this.viewOptions.listDayCount.toString()
					}) || `${this.viewOptions.listDayCount}d List`,
				}
			},
			height: "100%",
			expandRows: true,
			handleWindowResize: true,
			stickyHeaderDates: false,
			locale: this.viewOptions.locale || this.plugin.settings.uiLanguage || navigator.language || "en",
			slotMinTime: this.viewOptions.slotMinTime,
			slotMaxTime: this.viewOptions.slotMaxTime,
			slotDuration: this.viewOptions.slotDuration,
			firstDay: this.viewOptions.firstDay,
			weekNumbers: this.viewOptions.weekNumbers,
			nowIndicator: this.viewOptions.nowIndicator,
			weekends: this.viewOptions.showWeekends,
			allDaySlot: this.viewOptions.showAllDaySlot,
			dayMaxEvents: this.viewOptions.dayMaxEvents,
			dayMaxEventRows: this.viewOptions.dayMaxEventRows,
			eventMaxStack: this.viewOptions.eventMaxStack ?? undefined,
			navLinks: true,
			navLinkDayClick: (date: Date) => handleDateTitleClick(date, this.plugin),
			editable: true,
			selectable: true,
			selectMirror: this.viewOptions.selectMirror,
			eventTimeFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: this.viewOptions.timeFormat === "12",
			},
			slotLabelFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: this.viewOptions.timeFormat === "12",
			},
			scrollTime: this.viewOptions.scrollTime,
			eventMinHeight: this.viewOptions.eventMinHeight,
			slotEventOverlap: this.viewOptions.slotEventOverlap,
			eventAllow: () => true, // Allow all drops to proceed visually
			events: (fetchInfo, successCallback, failureCallback) => {
				this.fetchEvents(fetchInfo, successCallback, failureCallback);
			},
			eventDidMount: (arg) => this.handleEventDidMount(arg),
			eventClick: (info) => this.handleEventClick(info),
			eventDrop: (info) => this.handleEventDrop(info),
			eventResize: (info) => this.handleEventResize(info),
			select: (info) => this.handleDateSelect(info),
			viewDidMount: (arg) => {
				// Save the current view to config when it changes
				const newViewType = arg.view.type;
				if (newViewType && newViewType !== this.viewOptions.calendarView) {
					this.viewOptions.calendarView = newViewType;
					try {
						this.config.set('calendarView', newViewType);
					} catch (error) {
						console.debug('[TaskNotes][CalendarView] Failed to save view type:', error);
					}
				}
			},
		};

		// Create calendar
		this.calendar = new Calendar(this.calendarEl, calendarOptions);
		this.calendar.render();

		// Apply showTodayHighlight option via CSS
		this.applyTodayHighlightStyling();
	}

	/**
	 * Apply or remove today's date highlighting based on showTodayHighlight option.
	 * FullCalendar doesn't have a built-in option for this, so we control it via CSS.
	 */
	private applyTodayHighlightStyling(): void {
		if (!this.calendarEl) return;

		if (this.viewOptions.showTodayHighlight) {
			// Remove the class that hides today highlighting
			this.calendarEl.classList.remove('hide-today-highlight');
		} else {
			// Add the existing CSS class to hide today highlighting
			this.calendarEl.classList.add('hide-today-highlight');
		}
	}

	private determineInitialDate(taskNotes: TaskInfo[]): Date | string | undefined {
		// Check for explicit initial date option
		if (this.viewOptions.initialDate) {
			const normalized = normalizeDateValueForCalendar(this.viewOptions.initialDate);
			return normalized?.value ?? this.viewOptions.initialDate;
		}

		// Check for property-based navigation
		if (this.viewOptions.initialDateProperty) {
			const propertyId = this.viewOptions.initialDateProperty;
			const internalFieldName = this.propertyMapper.basesToInternal(propertyId);

			// Collect dates from tasks
			const dates: { compare: Date; value: string | Date }[] = [];
			for (const task of taskNotes) {
				const value = (task as any)[internalFieldName];
				const normalized = normalizeDateValueForCalendar(value);
				if (!normalized) continue;

					const compareDate = normalized.isAllDay
						? parseDateToUTC(normalized.value as string)
						: new Date(normalized.value as Date);
				if (isNaN(compareDate.getTime())) continue;

				dates.push({ compare: compareDate, value: normalized.value });
			}

			if (dates.length > 0) {
				// Apply strategy
				if (this.viewOptions.initialDateStrategy === "earliest") {
					const earliest = dates.reduce((prev, curr) =>
						curr.compare.getTime() < prev.compare.getTime() ? curr : prev
					);
					return earliest.value;
				} else if (this.viewOptions.initialDateStrategy === "latest") {
					const latest = dates.reduce((prev, curr) =>
						curr.compare.getTime() > prev.compare.getTime() ? curr : prev
					);
					return latest.value;
				} else {
					// "first" - return first date
					return dates[0].value;
				}
			}
		}

		// Default to today
		return undefined;
	}

	private async fetchEvents(fetchInfo: any, successCallback: any, failureCallback: any): Promise<void> {
		try {
			const events = await this.buildAllEvents(fetchInfo);
			successCallback(events);
		} catch (error) {
			console.error("[TaskNotes][CalendarView] Error fetching events:", error);
			failureCallback(error);
		}
	}

	private async buildAllEvents(fetchInfo: any): Promise<any[]> {
		const allEvents: any[] = [];

		// Build event configuration for generateCalendarEvents
		const eventConfig = {
			showScheduled: this.viewOptions.showScheduled,
			showDue: this.viewOptions.showDue,
			showRecurring: this.viewOptions.showRecurring,
			showTimeEntries: this.viewOptions.showTimeEntries,
			showTimeblocks: this.viewOptions.showTimeblocks,
			showICSEvents: false, // ICS handled separately
			visibleStart: fetchInfo.start,
			visibleEnd: fetchInfo.end,
		};

		// Use existing calendar-core helper to generate task events
		const taskEvents = await generateCalendarEvents(
			this.currentTasks,
			this.plugin,
			eventConfig
		);

		allEvents.push(...taskEvents);

		// Add property-based events from non-TaskNotes items
		if (this.viewOptions.showPropertyBasedEvents && this.viewOptions.startDateProperty) {
			const propertyEvents = await this.buildPropertyBasedEvents();
			allEvents.push(...propertyEvents);
		}

		// Add ICS calendar events
		if (this.plugin.icsSubscriptionService) {
			const icsEvents = await this.buildICSEvents();
			allEvents.push(...icsEvents);
		}

		// Add Google Calendar events
		if (this.plugin.googleCalendarService) {
			const googleEvents = await this.buildGoogleCalendarEvents();
			allEvents.push(...googleEvents);
		}

		// Add Microsoft Calendar events
		if (this.plugin.microsoftCalendarService) {
			const microsoftEvents = await this.buildMicrosoftCalendarEvents();
			allEvents.push(...microsoftEvents);
		}

		return allEvents;
	}

	private async buildPropertyBasedEvents(): Promise<any[]> {
		if (!this.data?.data) return [];
		if (!this.viewOptions.startDateProperty) return [];

		const events: any[] = [];

		for (const entry of this.data.data) {
			try {
				const file = entry.file;

				// Skip if no file
				if (!file) continue;

				// Use BasesDataAdapter to get the property value (handles all Bases Value types)
				const startValue = this.dataAdapter.getPropertyValue(entry, this.viewOptions.startDateProperty);
				const startNormalized = normalizeDateValueForCalendar(startValue);
				if (!startNormalized) continue;

				// Try to get end date if property is configured
				let endDateStr: string | undefined;
				let isEndAllDay = startNormalized.isAllDay;
				if (this.viewOptions.endDateProperty) {
					const endValue = this.dataAdapter.getPropertyValue(entry, this.viewOptions.endDateProperty);
					const endNormalized = normalizeDateValueForCalendar(endValue);
					if (endNormalized) {
						endDateStr = typeof endNormalized.value === "string" ? endNormalized.value : format(endNormalized.value, "yyyy-MM-dd'T'HH:mm");
						isEndAllDay = endNormalized.isAllDay;
					}
				}

				// Try to get title from configured property
				let eventTitle: string | undefined;
				if (this.viewOptions.titleProperty) {
					const titleValue = this.dataAdapter.getPropertyValue(entry, this.viewOptions.titleProperty);
					if (titleValue && typeof titleValue === 'string' && titleValue.trim()) {
						eventTitle = titleValue.trim();
					}
				}

				// Create event
				const startDateStr = typeof startNormalized.value === "string" ? startNormalized.value : format(startNormalized.value, "yyyy-MM-dd'T'HH:mm");
				const isAllDay = startNormalized.isAllDay && (endDateStr ? isEndAllDay : true);
				events.push({
					id: `property-${file.path}`,
					title: eventTitle || file.basename || file.name,
					start: startDateStr,
					end: endDateStr,
					allDay: isAllDay,
					backgroundColor: "var(--color-accent)",
					borderColor: "var(--color-accent)",
					textColor: "var(--text-on-accent)",
					editable: true,
					extendedProps: {
						eventType: "property-based",
						filePath: file.path,
						file: file,
						basesEntry: entry,
					},
				});
			} catch (error) {
				console.warn(`[TaskNotes][CalendarView] Error processing property-based entry:`, error);
			}
		}

		return events;
	}

	private async buildICSEvents(): Promise<any[]> {
		if (!this.plugin.icsSubscriptionService) return [];

		const events: any[] = [];
		const allICSEvents = this.plugin.icsSubscriptionService.getAllEvents();

		for (const icsEvent of allICSEvents) {
			// Check if this calendar is enabled
			if (this.icsCalendarToggles.get(icsEvent.subscriptionId) === false) continue;

			const calendarEvent = createICSEvent(icsEvent, this.plugin);
			if (calendarEvent) {
				events.push(calendarEvent);
			}
		}

		return events;
	}

	private async buildGoogleCalendarEvents(): Promise<any[]> {
		if (!this.plugin.googleCalendarService) return [];

		const events: any[] = [];
		const allGoogleEvents = this.plugin.googleCalendarService.getAllEvents();

		for (const icsEvent of allGoogleEvents) {
			// Check if this calendar is enabled
			const calendarId = icsEvent.subscriptionId.replace("google-", "");
			if (this.googleCalendarToggles.get(calendarId) === false) continue;

			const calendarEvent = createICSEvent(icsEvent, this.plugin);
			if (calendarEvent) {
				events.push(calendarEvent);
			}
		}

		return events;
	}

	private async buildMicrosoftCalendarEvents(): Promise<any[]> {
		if (!this.plugin.microsoftCalendarService) return [];

		const events: any[] = [];
		const allMicrosoftEvents = this.plugin.microsoftCalendarService.getAllEvents();

		for (const icsEvent of allMicrosoftEvents) {
			// Check if this calendar is enabled
			const calendarId = icsEvent.subscriptionId.replace("microsoft-", "");
			if (this.microsoftCalendarToggles.get(calendarId) === false) continue;

			const calendarEvent = createICSEvent(icsEvent, this.plugin);
			if (calendarEvent) {
				events.push(calendarEvent);
			}
		}

		return events;
	}


	private async updateCalendarEvents(taskNotes: TaskInfo[]): Promise<void> {
		if (!this.calendar) return;

		// Refetch events from all sources
		this.calendar.refetchEvents();
	}

	private async handleEventClick(info: any): Promise<void> {
		const { taskInfo, timeblock, eventType, filePath, icsEvent, subscriptionName } = info.event.extendedProps || {};
		const jsEvent = info.jsEvent;

		// Handle timeblock click
		if (eventType === "timeblock" && timeblock) {
			const originalDate = format(info.event.start, "yyyy-MM-dd");
			showTimeblockInfoModal(timeblock, info.event.start, originalDate, this.plugin);
			return;
		}

		// Handle time entry click - left click opens time entry modal
		if (eventType === "timeEntry" && taskInfo && jsEvent.button === 0) {
			this.plugin.openTimeEntryEditor(taskInfo);
			return;
		}

		// Handle ICS event click - show info modal
		if (eventType === "ics" && icsEvent) {
			const modal = new ICSEventInfoModal(this.plugin.app, this.plugin, icsEvent, subscriptionName);
			modal.open();
			return;
		}

		// Handle property-based event click - open file directly
		if (eventType === "property-based" && filePath) {
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				const isModKey = jsEvent.ctrlKey || jsEvent.metaKey;
				const newLeaf = isModKey || jsEvent.button === 1; // Ctrl/Cmd+click or middle click
				this.plugin.app.workspace.getLeaf(newLeaf).openFile(file);
			}
			return;
		}

		// Handle task click with single/double click detection based on user settings
		if (taskInfo?.path && jsEvent.button === 0) {
			handleCalendarTaskClick(taskInfo, this.plugin, jsEvent, info.event.id);
		}
	}

	private async handleEventDrop(info: any): Promise<void> {
		if (!info?.event?.extendedProps) {
			console.warn("[TaskNotes][CalendarView] Event dropped without extendedProps");
			return;
		}

		const {
			taskInfo,
			timeblock,
			eventType,
			isRecurringInstance,
			isNextScheduledOccurrence,
			isPatternInstance,
			filePath,
			icsEvent,
		} = info.event.extendedProps;

		// Handle timeblock drops
		if (eventType === "timeblock") {
			const originalDate = format(info.oldEvent.start, "yyyy-MM-dd");
			await handleTimeblockDrop(info, timeblock, originalDate, this.plugin);
			return;
		}

		// Handle property-based event drops
		if (eventType === "property-based" && filePath) {
			try {
				const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
				if (!file || !(file instanceof TFile)) {
					info.revert();
					return;
				}

				// Get property IDs
				const startDateProperty = this.viewOptions.startDateProperty;
				const endDateProperty = this.viewOptions.endDateProperty;

				if (!startDateProperty) {
					info.revert();
					return;
				}

				// Strip property prefix if present
				const startProp = startDateProperty.includes('.')
					? startDateProperty.split('.').pop()
					: startDateProperty;
				const endProp = endDateProperty && endDateProperty.includes('.')
					? endDateProperty.split('.').pop()
					: endDateProperty;

				if (!startProp) {
					info.revert();
					return;
				}

				// Calculate time shift (in milliseconds)
				const oldStart = info.oldEvent.start;
				const newStart = info.event.start;
				const timeDiffMs = newStart.getTime() - oldStart.getTime();

				// Update frontmatter
				await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
					// Update start date
					const oldStartValue = frontmatter[startProp];
					if (oldStartValue) {
						const oldStartDate = new Date(oldStartValue);
						if (isNaN(oldStartDate.getTime())) return;
						const newStartDate = new Date(oldStartDate.getTime() + timeDiffMs);
						if (isNaN(newStartDate.getTime())) return;
						frontmatter[startProp] = format(newStartDate, info.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
					}

					// Update end date if configured
					if (endProp) {
						const oldEndValue = frontmatter[endProp];
						if (oldEndValue) {
							const oldEndDate = new Date(oldEndValue);
							if (isNaN(oldEndDate.getTime())) return;
							const newEndDate = new Date(oldEndDate.getTime() + timeDiffMs);
							if (isNaN(newEndDate.getTime())) return;
							frontmatter[endProp] = format(newEndDate, info.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
						}
					}
				});
			} catch (error) {
				console.error("[TaskNotes][CalendarView] Error updating property-based event:", error);
				info.revert();
			}
			return;
		}

		// Handle calendar provider event drops (Google, Microsoft, etc.)
		if (eventType === "ics" && icsEvent) {
			const provider = this.plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
			if (provider) {
				try {
					const { calendarId, eventId } = provider.extractEventIds(icsEvent);
					const newStart = info.event.start;
					const newAllDay = info.event.allDay;
					let newEnd = info.event.end;
					if (!newEnd) {
						newEnd = new Date(newStart);
						if (newAllDay) {
							newEnd.setDate(newEnd.getDate() + 1);
						} else {
							newEnd.setHours(newEnd.getHours() + 1);
						}
					}

					// Build update payload
					const updates: any = {};
					if (newAllDay) {
						updates.start = { date: format(newStart, "yyyy-MM-dd") };
						updates.end = { date: format(newEnd, "yyyy-MM-dd") };
					} else {
						const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
						updates.start = {
							dateTime: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
							timeZone: timezone
						};
						updates.end = {
							dateTime: format(newEnd, "yyyy-MM-dd'T'HH:mm:ss"),
							timeZone: timezone
						};
					}

					await provider.updateEvent(calendarId, eventId, updates);
				} catch (error) {
					console.error(`[TaskNotes][CalendarView] Error updating ${provider.providerName} event:`, error);
					info.revert();
				}
				return;
			} else {
				// ICS event without provider, block move
				info.revert();
				return;
			}
		}

		// Handle time entry drops
		if (eventType === "timeEntry") {
			const timeEntryIndex = info.event.extendedProps.timeEntryIndex;
			if (typeof timeEntryIndex !== "number") {
				info.revert();
				return;
			}

			try {
				const newStart = info.event.start;
				const newEnd = info.event.end;

				if (!newStart || !newEnd) {
					info.revert();
					return;
				}

				// Calculate time shift
				const oldStart = info.oldEvent.start;
				const timeDiffMs = newStart.getTime() - oldStart.getTime();

				// Update the time entry
				const updatedEntries = [...(taskInfo.timeEntries || [])];
				const entry = updatedEntries[timeEntryIndex];

				if (entry) {
					// Shift both start and end time by the same amount
					const oldStartDate = new Date(entry.startTime);
					if (!entry.endTime) {
						info.revert();
						return;
					}
					const oldEndDate = new Date(entry.endTime);

					entry.startTime = new Date(oldStartDate.getTime() + timeDiffMs).toISOString();
					entry.endTime = new Date(oldEndDate.getTime() + timeDiffMs).toISOString();

					// Recalculate duration
					entry.duration = Math.round(
						(new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / 60000
					);

					await this.plugin.taskService.updateTask(taskInfo, {
						timeEntries: updatedEntries,
					});
				}
			} catch (error) {
				console.error("Error updating time entry:", error);
				info.revert();
			}
			return;
		}

		// Only allow scheduled and recurring events to be moved (block due dates)
		if (eventType === "due") {
			info.revert();
			return;
		}

		// Handle recurring task drops
		if (taskInfo && (isRecurringInstance || isNextScheduledOccurrence || isPatternInstance)) {
			await handleRecurringTaskDrop(info, taskInfo, this.plugin);
			return;
		}

		// Handle normal task drops
		if (taskInfo) {
			try {
				if (eventType === "scheduled") {
					const newStart = info.event.start;
					const allDay = info.event.allDay;
					const newDateString = allDay
						? format(newStart, "yyyy-MM-dd")
						: format(newStart, "yyyy-MM-dd'T'HH:mm");

					await this.plugin.taskService.updateProperty(taskInfo, "scheduled", newDateString);
				}
			} catch (error) {
				console.error("[TaskNotes][CalendarView] Error updating task date:", error);
				info.revert();
			}
		}
	}

	private async handleEventResize(info: any): Promise<void> {
		if (!info?.event?.extendedProps) {
			console.warn("[TaskNotes][CalendarView] Event resized without extendedProps");
			return;
		}

		const { taskInfo, timeblock, eventType, filePath, timeEntryIndex, icsEvent } = info.event.extendedProps;

		// Handle time entry resize
		if (eventType === "timeEntry") {
			if (typeof timeEntryIndex !== "number") {
				info.revert();
				return;
			}

			try {
				const newStart = info.event.start;
				const newEnd = info.event.end;

				if (!newStart || !newEnd) {
					info.revert();
					return;
				}

				// Update the time entry
				const updatedEntries = [...(taskInfo.timeEntries || [])];
				const entry = updatedEntries[timeEntryIndex];

				if (entry) {
					// Update start and end times
					entry.startTime = newStart.toISOString();
					entry.endTime = newEnd.toISOString();

					// Recalculate duration
					entry.duration = Math.round(
						(newEnd.getTime() - newStart.getTime()) / 60000
					);

					await this.plugin.taskService.updateTask(taskInfo, {
						timeEntries: updatedEntries,
					});
				}
			} catch (error) {
				console.error("Error resizing time entry:", error);
				info.revert();
			}
			return;
		}

		// Handle timeblock resize
		if (eventType === "timeblock") {
			const originalDate = format(info.event.start, "yyyy-MM-dd");
			await handleTimeblockResize(info, timeblock, originalDate, this.plugin);
			return;
		}

		// Handle property-based event resize
		if (eventType === "property-based" && filePath) {
			try {
				const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
				if (!file || !(file instanceof TFile)) {
					info.revert();
					return;
				}

				const endDateProperty = this.viewOptions.endDateProperty;

				if (!endDateProperty) {
					// No end date property configured, can't resize
					info.revert();
					return;
				}

				// Strip property prefix
				const endProp = endDateProperty.includes('.')
					? endDateProperty.split('.').pop()
					: endDateProperty;

				if (!endProp) {
					info.revert();
					return;
				}

				const newEnd = info.event.end;
				if (!newEnd) {
					info.revert();
					return;
				}

				// Update frontmatter
				await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
					if (isNaN(newEnd.getTime())) return;
					frontmatter[endProp] = format(newEnd, info.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
				});
			} catch (error) {
				console.error("[TaskNotes][CalendarView] Error resizing property-based event:", error);
				info.revert();
			}
			return;
		}

		// Handle calendar provider event resize (Google, Microsoft, etc.)
		if (eventType === "ics" && icsEvent) {
			const provider = this.plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
			if (provider) {
				try {
					const { calendarId, eventId } = provider.extractEventIds(icsEvent);
					const newStart = info.event.start;
					const newEnd = info.event.end;

					if (!newEnd) {
						info.revert();
						return;
					}

					const newAllDay = info.event.allDay;

					// Build update payload
					const updates: any = {};
					if (newAllDay) {
						updates.start = { date: format(newStart, "yyyy-MM-dd") };
						updates.end = { date: format(newEnd, "yyyy-MM-dd") };
					} else {
						const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
						updates.start = {
							dateTime: format(newStart, "yyyy-MM-dd'T'HH:mm:ss"),
							timeZone: timezone
						};
						updates.end = {
							dateTime: format(newEnd, "yyyy-MM-dd'T'HH:mm:ss"),
							timeZone: timezone
						};
					}

					await provider.updateEvent(calendarId, eventId, updates);
				} catch (error) {
					console.error(`[TaskNotes][CalendarView] Error resizing ${provider.providerName} event:`, error);
					info.revert();
				}
				return;
			}
		}

		// Only scheduled and recurring events can be resized (block ICS subscriptions without provider)
		if (eventType !== "scheduled" && eventType !== "recurring") {
			info.revert();
			return;
		}

		// Handle task resize (update time estimate)
		try {
			const start = info.event.start;
			const end = info.event.end;

			if (start && end) {
				let durationMinutes: number;

				if (info.event.allDay) {
					// For all-day events, FullCalendar's end date is exclusive (next day at midnight)
					const dayDurationMillis = 24 * 60 * 60 * 1000;
					const daysDuration = Math.round((end.getTime() - start.getTime()) / dayDurationMillis);
					const minutesPerDay = 60 * 24;
					durationMinutes = daysDuration * minutesPerDay;
				} else {
					// For timed events, calculate duration directly
					durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
				}

				await this.plugin.taskService.updateProperty(taskInfo, "timeEstimate", durationMinutes);
			}
		} catch (error) {
			console.error("[TaskNotes][CalendarView] Error updating task duration:", error);
			info.revert();
		}
	}

	private async handleDateSelect(info: any): Promise<void> {
		// Determine what type of event to create based on view
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Create task")
				.setIcon("check-square")
				.onClick(async () => {
					// Parse slot duration to get minutes (default to 30 if not set)
					const slotDurationParts = this.viewOptions.slotDuration.split(":");
					const slotDurationMinutes = parseInt(slotDurationParts[0]) * 60 + parseInt(slotDurationParts[1] || "0");

					const values = calculateTaskCreationValues(
						info.start,
						info.end,
						info.allDay,
						slotDurationMinutes
					);

					const modal = new TaskCreationModal(
						this.plugin.app,
						this.plugin,
						{ prePopulatedValues: values }
					);
					modal.open();
				});
		});

		// Only show timeblock option if timeblocking is enabled
		if (this.plugin.settings.calendarViewSettings.enableTimeblocking) {
			menu.addItem((item) => {
				item.setTitle("Create timeblock")
					.setIcon("clock")
					.onClick(async () => {
						await handleTimeblockCreation(info.start, info.end, info.allDay, this.plugin);
					});
			});
		}

		menu.addItem((item) => {
			item.setTitle("Create time entry")
				.setIcon("play")
				.onClick(async () => {
					await handleTimeEntryCreation(info.start, info.end, info.allDay, this.plugin);
				});
		});

		menu.showAtMouseEvent(info.jsEvent);

		// Unselect after handling
		if (this.calendar) {
			this.calendar.unselect();
		}
	}

	private handleEventDidMount(arg: any): void {
		if (!arg?.event?.extendedProps) return;

		const { taskInfo, timeblock, icsEvent, eventType, basesEntry } = arg.event.extendedProps;

		// Add calendar icon to provider-managed calendar events in grid views
		if (icsEvent && arg.view.type !== 'listWeek') {
			const provider = this.plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
			if (provider) {
				const titleEl = arg.el.querySelector('.fc-event-title');
				if (titleEl) {
					const iconContainer = document.createElement('span');
					iconContainer.style.marginRight = '4px';
					iconContainer.style.display = 'inline-flex';
					iconContainer.style.alignItems = 'center';

					const iconEl = document.createElement('span');
					iconEl.style.width = '12px';
					iconEl.style.height = '12px';
					iconEl.style.display = 'inline-flex';
					iconEl.style.flexShrink = '0';
					setIcon(iconEl, 'calendar');

					iconContainer.appendChild(iconEl);
					titleEl.insertBefore(iconContainer, titleEl.firstChild);
				}
			}
		}

		// Custom rendering for list view - replace with card components
		if (arg.view.type === 'listWeek') {
			// Clear the default content
			arg.el.innerHTML = '';

			let cardElement: HTMLElement | null = null;

			// Get visible properties from Bases view configuration
			const visibleProperties = this.getVisibleProperties();

			// Render task events with TaskCard
			if (taskInfo && eventType !== 'ics' && eventType !== 'property-based') {
				// Enrich TaskInfo with Bases data for formula and file property access
				const enrichedTask = { ...taskInfo };
				const basesEntry = this.basesEntryByPath.get(taskInfo.path);

				if (basesEntry) {
					// Add basesData for formula results
					enrichedTask.basesData = {
						formulaResults: {
							cachedFormulaOutputs: {} as Record<string, any>
						}
					};

					// Populate formula results from Bases entry
					if (visibleProperties) {
						for (const propId of visibleProperties) {
							if (propId.startsWith('formula.')) {
								const formulaName = propId.substring(8);
								try {
									const value = basesEntry.getValue?.(propId);
									if (value) {
										enrichedTask.basesData.formulaResults.cachedFormulaOutputs[formulaName] = value;
									}
								} catch (error) {
									console.debug('[TaskNotes][CalendarView] Error getting formula:', propId, error);
								}
							}
						}
					}

					// Add file properties if not already present
					if (!enrichedTask.dateCreated) {
						try {
							const ctimeValue = basesEntry.getValue?.('file.ctime');
							if (ctimeValue?.data) enrichedTask.dateCreated = ctimeValue.data;
						} catch (error) {
							console.debug('[TaskNotes][CalendarView] Error getting file.ctime:', error);
						}
					}
					if (!enrichedTask.dateModified) {
						try {
							const mtimeValue = basesEntry.getValue?.('file.mtime');
							if (mtimeValue?.data) enrichedTask.dateModified = mtimeValue.data;
						} catch (error) {
							console.debug('[TaskNotes][CalendarView] Error getting file.mtime:', error);
						}
					}
				}

				// Use shared UTC-anchored target date logic
				const targetDate = getTargetDateForEvent(arg);

				cardElement = createTaskCard(enrichedTask, this.plugin, visibleProperties, {
					targetDate: targetDate,
				});
			}
			// Render ICS events with ICSCard
			else if (icsEvent && eventType === 'ics') {
				cardElement = createICSEventCard(icsEvent, this.plugin);
			}
			// Render property-based events with PropertyEventCard
			else if (eventType === 'property-based' && basesEntry) {
				cardElement = createPropertyEventCard(
					basesEntry,
					this.plugin,
					this.config
				);
			}
			// Render timeblock events with TimeBlockCard
			else if (eventType === 'timeblock' && timeblock) {
				const originalDate = arg.event.start ? format(arg.event.start, "yyyy-MM-dd") : undefined;
				cardElement = createTimeBlockCard(timeblock, this.plugin, {
					eventDate: arg.event.start,
					originalDate: originalDate,
				});
			}

			// Replace the event element content with the card
			if (cardElement) {
				arg.el.appendChild(cardElement);
				// Remove default FullCalendar classes that interfere with card styling
				arg.el.classList.remove('fc-event', 'fc-event-start', 'fc-event-end');
				return; // Skip default handling
			} else {
				// Fallback: Add consistent styling to events without custom cards
				arg.el.classList.add('fc-event-default-list');
			}
		}

		// Set event type attribute
		arg.el.setAttribute("data-event-type", eventType || "unknown");

		// Handle timeblock events
		if (eventType === "timeblock" && timeblock) {
			// Apply timeblock styling
			applyTimeblockStyling(arg.el, timeblock);

			// Ensure timeblocks are editable
			if (arg.event.setProp) {
				arg.event.setProp("editable", true);
			}

			// Add tooltip
			const tooltipText = generateTimeblockTooltip(timeblock);
			setTooltip(arg.el, tooltipText, { placement: "top" });

			return;
		}

		// Add data attributes and classes for tasks
		if (taskInfo && taskInfo.path) {
			arg.el.setAttribute("data-task-path", taskInfo.path);
			arg.el.classList.add("fc-task-event");

			// Add tag classes to tasks
			if (taskInfo.tags && taskInfo.tags.length > 0) {
				taskInfo.tags.forEach((tag: string) => {
					const sanitizedTag = tag.replace(/[^a-zA-Z0-9-_]/g, "");
					if (sanitizedTag) {
						arg.el.classList.add(`fc-tag-${sanitizedTag}`);
					}
				});
			}

			// Set editable based on event type
			if (arg.event.setProp) {
				switch (eventType) {
					case "scheduled":
					case "recurring":
					case "timeEntry":
						arg.event.setProp("editable", true);
						break;
					case "due":
						arg.event.setProp("editable", false);
						break;
					default:
						arg.event.setProp("editable", true);
				}
			}

			// Apply recurring task styling (handles completion styling as well)
			applyRecurringTaskStyling(arg.el, arg.event.extendedProps);
		}

		// Add hover tooltip for tasks and ICS events
		if (taskInfo) {
			const tooltipText = generateTaskTooltip(taskInfo, this.plugin);
			setTooltip(arg.el, tooltipText);
		} else if (icsEvent) {
			const tooltipText = icsEvent.description
				? `${icsEvent.title}\n\n${icsEvent.description}`
				: icsEvent.title;
			setTooltip(arg.el, tooltipText);
		}

		// Add hover preview for tasks (Ctrl+hover to preview daily note)
		if (taskInfo && eventType !== "ics") {
			addTaskHoverPreview(arg.el, taskInfo, this.plugin, "tasknotes-bases-calendar");
		}

		// Add context menu for tasks (right-click) - includes time entries
		if (taskInfo) {
			arg.el.addEventListener("contextmenu", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();

				// Use shared UTC-anchored target date logic
				const targetDate = getTargetDateForEvent(arg);

				// Use shared TaskContextMenu component
				const contextMenu = new TaskContextMenu({
					task: taskInfo,
					plugin: this.plugin,
					targetDate: targetDate,
					onUpdate: () => {
						// Refresh calendar events when task is updated
						if (this.calendar) {
							this.calendar.refetchEvents();
						}
					},
				});
				contextMenu.show(e);
			});
		}

		// Add context menu for ICS events (right-click) - includes Google/Microsoft Calendar
		if (icsEvent && eventType === "ics") {
			arg.el.addEventListener("contextmenu", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();

				const subscriptionName = arg.event.extendedProps.subscriptionName;

				const contextMenu = new ICSEventContextMenu({
					icsEvent: icsEvent,
					plugin: this.plugin,
					subscriptionName: subscriptionName,
					onUpdate: () => {
						// Refresh calendar events when ICS event is updated
						if (this.calendar) {
							this.calendar.refetchEvents();
						}
					},
				});
				contextMenu.show(e);
			});
		}

		// Add hover preview for property-based events (Ctrl+hover to preview note)
		if (eventType === "property-based" && arg.event.extendedProps.filePath) {
			arg.el.addEventListener("mouseover", (event: MouseEvent) => {
				const file = this.plugin.app.vault.getAbstractFileByPath(arg.event.extendedProps.filePath);
				if (file) {
					this.plugin.app.workspace.trigger("hover-link", {
						event,
						source: "tasknotes-bases-calendar",
						hoverParent: arg.el,
						targetEl: arg.el,
						linktext: arg.event.extendedProps.filePath,
						sourcePath: arg.event.extendedProps.filePath,
					});
				}
			});
		}

		// Add context menu for property-based events (right-click)
		if (eventType === "property-based" && arg.event.extendedProps.filePath) {
			arg.el.addEventListener("contextmenu", (e: MouseEvent) => {
				e.preventDefault();
				e.stopPropagation();

				const file = this.plugin.app.vault.getAbstractFileByPath(arg.event.extendedProps.filePath);

				if (file instanceof TFile) {
					const menu = new Menu();

					// Trigger Obsidian's default file menu
					this.plugin.app.workspace.trigger("file-menu", menu, file, "tasknotes-bases-calendar");

					// Show menu at mouse position
					menu.showAtPosition({ x: e.clientX, y: e.clientY });
				}
			});
		}
	}

	protected setupContainer(): void {
		// Clear container
		this.containerEl.empty();

		// Root container with proper classes for calendar styling
		const root = document.createElement("div");
		root.className = "tn-bases-integration tasknotes-plugin advanced-calendar-view";
		root.style.cssText = "min-height: 800px; height: 100%; display: flex; flex-direction: column;";
		root.tabIndex = -1; // Make focusable
		this.containerEl.appendChild(root);
		this.rootElement = root;

		// Calendar element
		const calendarEl = document.createElement("div");
		calendarEl.id = "bases-calendar";
		calendarEl.style.cssText = "flex: 1; min-height: 700px; overflow: auto;";
		root.appendChild(calendarEl);
		this.calendarEl = calendarEl;
	}

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		// Refresh calendar to show updated events
		this.debouncedRefresh();
	}

	renderError(error: Error): void {
		if (!this.calendarEl) return;

		const errorEl = document.createElement("div");
		errorEl.className = "tn-bases-error";
		errorEl.style.cssText =
			"padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px 0;";
		errorEl.textContent = `Error loading calendar: ${error.message || "Unknown error"}`;
		this.calendarEl.appendChild(errorEl);
	}

	onunload(): void {
		// Component.register() calls will be automatically cleaned up

		if (this.calendar) {
			this.calendar.destroy();
			this.calendar = null;
		}

		this.calendarEl = null;
		this.currentTasks = [];
	}

	/**
	 * Get ephemeral state to preserve across view reloads.
	 * Saves current calendar date and view type.
	 */
	getEphemeralState(): any {
		const baseState = super.getEphemeralState();

		if (this.calendar) {
			const currentDate = this.calendar.getDate();
			const currentView = this.calendar.view?.type;

			return {
				...baseState,
				calendarDate: currentDate ? currentDate.toISOString() : null,
				calendarView: currentView || null,
			};
		}

		return baseState;
	}

	/**
	 * Restore ephemeral state after view reload.
	 * Restores calendar date and view type.
	 */
	setEphemeralState(state: any): void {
		super.setEphemeralState(state);

		if (!state) return;

		// Restore calendar date and view after calendar is initialized
		if (this.calendar) {
			if (state.calendarDate) {
				try {
					this.calendar.gotoDate(new Date(state.calendarDate));
				} catch (e) {
					console.debug("[CalendarView] Failed to restore calendar date:", e);
				}
			}

			if (state.calendarView && state.calendarView !== this.calendar.view?.type) {
				try {
					this.calendar.changeView(state.calendarView);
				} catch (e) {
					console.debug("[CalendarView] Failed to restore calendar view:", e);
				}
			}
		}
	}
}

// Factory function
/**
 * Factory function for Bases registration.
 * Returns an actual CalendarView instance (extends BasesView).
 */
export function buildCalendarViewFactory(plugin: TaskNotesPlugin) {
	return function (controller: any, containerEl: HTMLElement): CalendarView {
		if (!containerEl) {
			console.error("[TaskNotes][CalendarView] No containerEl provided");
			throw new Error("CalendarView requires a containerEl");
		}

		// Create and return the view instance directly
		// CalendarView now properly extends BasesView, so Bases can call its methods directly
		return new CalendarView(controller, containerEl, plugin);
	};
}
