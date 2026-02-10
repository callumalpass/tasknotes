import { FieldMapping, StatusConfig, PriorityConfig } from "../types";
import {
	TaskNotesSettings,
	TaskCreationDefaults,
	CalendarViewSettings,
	ICSIntegrationSettings,
	ProjectAutosuggestSettings,
	NLPTriggersConfig,
	GoogleCalendarExportSettings,
} from "../types/settings";

/**
 * Internal field names for default visible properties.
 * These are FieldMapping keys that will be converted to user-configured property names.
 */
export const DEFAULT_INTERNAL_VISIBLE_PROPERTIES: (keyof FieldMapping)[] = [
	"status",
	"priority",
	"due",
	"scheduled",
	"projects",
	"contexts",
];

// Default field mapping maintains backward compatibility
export const DEFAULT_FIELD_MAPPING: FieldMapping = {
	title: "title",
	status: "status",
	priority: "priority",
	due: "due",
	scheduled: "scheduled",
	contexts: "contexts",
	projects: "projects",
	timeEstimate: "timeEstimate",
	completedDate: "completedDate",
	dateCreated: "dateCreated",
	dateModified: "dateModified",
	recurrence: "recurrence",
	recurrenceAnchor: "recurrence_anchor",
	archiveTag: "archived",
	timeEntries: "timeEntries",
	completeInstances: "complete_instances",
	skippedInstances: "skipped_instances",
	blockedBy: "blockedBy",
	pomodoros: "pomodoros",
	icsEventId: "icsEventId",
	icsEventTag: "ics_event",
	googleCalendarEventId: "googleCalendarEventId",
	reminders: "reminders",
};

// Default status configuration matches current hardcoded behavior
export const DEFAULT_STATUSES: StatusConfig[] = [
	{
		id: "none",
		value: "none",
		label: "None",
		color: "#cccccc",
		isCompleted: false,
		order: 0,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "open",
		value: "open",
		label: "Open",
		color: "#808080",
		isCompleted: false,
		order: 1,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "in-progress",
		value: "in-progress",
		label: "In progress",
		color: "#0066cc",
		isCompleted: false,
		order: 2,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
	{
		id: "done",
		value: "done",
		label: "Done",
		color: "#00aa00",
		isCompleted: true,
		order: 3,
		autoArchive: false,
		autoArchiveDelay: 5,
	},
];

// Default priority configuration matches current hardcoded behavior
export const DEFAULT_PRIORITIES: PriorityConfig[] = [
	{
		id: "none",
		value: "none",
		label: "None",
		color: "#cccccc",
		weight: 0,
	},
	{
		id: "low",
		value: "low",
		label: "Low",
		color: "#00aa00",
		weight: 1,
	},
	{
		id: "normal",
		value: "normal",
		label: "Normal",
		color: "#ffaa00",
		weight: 2,
	},
	{
		id: "high",
		value: "high",
		label: "High",
		color: "#ff0000",
		weight: 3,
	},
];

export const DEFAULT_TASK_CREATION_DEFAULTS: TaskCreationDefaults = {
	defaultContexts: "",
	defaultTags: "",
	defaultProjects: "",
	useParentNoteAsProject: false,
	defaultTimeEstimate: 0,
	defaultRecurrence: "none",
	defaultDueDate: "none",
	defaultScheduledDate: "today",
	bodyTemplate: "",
	useBodyTemplate: false,
	defaultReminders: [],
};

export const DEFAULT_CALENDAR_VIEW_SETTINGS: CalendarViewSettings = {
	// Default view
	defaultView: "dayGridMonth",
	// Custom multi-day view settings
	customDayCount: 3, // Default to 3 days as requested in issue #282
	// Time settings
	slotDuration: "00:30:00", // 30-minute slots
	slotMinTime: "00:00:00", // Start at midnight
	slotMaxTime: "24:00:00", // End at midnight next day
	scrollTime: "08:00:00", // Scroll to 8 AM
	// Week settings
	firstDay: 1, // Monday
	// Display preferences
	timeFormat: "24", // 24-hour format
	showWeekends: true,
	// Locale settings
	locale: "", // Empty string means auto-detect from browser
	// Default event type visibility
	defaultShowScheduled: true,
	defaultShowDue: true,
	defaultShowDueWhenScheduled: true,
	defaultShowScheduledToDueSpan: false, // Off by default - opt-in feature
	defaultShowTimeEntries: false,
	defaultShowRecurring: true,
	defaultShowICSEvents: true,
	// Timeblocking settings
	enableTimeblocking: false, // Disabled by default - toggleable feature
	defaultShowTimeblocks: true,
	defaultTimeblockColor: "#6366f1",
	// Calendar behavior
	nowIndicator: true,
	selectMirror: true,
	weekNumbers: false,
	// Today highlighting
	showTodayHighlight: true,
	// Event display
	eventMinHeight: 15, // FullCalendar default
	// Event overlap and stacking behavior
	slotEventOverlap: true, // FullCalendar default - events can visually overlap
	eventMaxStack: null, // No limit on stacked events in timeGrid (null = unlimited)
	dayMaxEvents: true, // Auto-limit based on cell height in dayGrid
	dayMaxEventRows: false, // No row limit in dayGrid (false = unlimited)
};

export const DEFAULT_ICS_INTEGRATION_SETTINGS: ICSIntegrationSettings = {
	defaultNoteTemplate: "",
	defaultNoteFolder: "",
	icsNoteFilenameFormat: "title", // Default to using the event title for ICS notes
	customICSNoteFilenameTemplate: "{title}", // Simple title template for ICS notes
	// Automatic export defaults
	enableAutoExport: false,
	autoExportPath: "tasknotes-calendar.ics",
	autoExportInterval: 60, // 60 minutes by default
	useDurationForExport: false, // Preserve existing behavior: use due date as DTEND
	// Task creation defaults
	useICSEndAsDue: false, // Preserve existing behavior: don't set due date from ICS events
};

export const DEFAULT_GOOGLE_CALENDAR_EXPORT: GoogleCalendarExportSettings = {
	enabled: false, // Disabled by default - user must opt-in
	targetCalendarId: "", // Empty = user must select a calendar
	syncOnTaskCreate: true,
	syncOnTaskUpdate: true,
	syncOnTaskComplete: true,
	syncOnTaskDelete: true,
	eventTitleTemplate: "{{title}}", // Simple title by default
	includeDescription: true,
	eventColorId: null, // Use calendar default color
	syncTrigger: "scheduled", // Default to scheduled date
	createAsAllDay: true, // All-day events by default
	defaultEventDuration: 60, // 1 hour if timed events
	includeObsidianLink: true, // Include link back to Obsidian
	defaultReminderMinutes: null, // No reminder by default (user opts in)
};

export const DEFAULT_PROJECT_AUTOSUGGEST: ProjectAutosuggestSettings = {
	enableFuzzy: false,
	rows: ["{title|n(Title)}", "{aliases|n(Aliases)}", "{file.path|n(Path)}"],
	showAdvanced: false,
	requiredTags: [],
	includeFolders: [],
	propertyKey: "",
	propertyValue: "",
};

// Default NLP triggers configuration
export const DEFAULT_NLP_TRIGGERS: NLPTriggersConfig = {
	triggers: [
		{
			propertyId: "tags",
			trigger: "#",
			enabled: true,
		},
		{
			propertyId: "contexts",
			trigger: "@",
			enabled: true,
		},
		{
			propertyId: "projects",
			trigger: "+",
			enabled: true,
		},
		{
			propertyId: "status",
			trigger: "*",
			enabled: true,
		},
		{
			propertyId: "priority",
			trigger: "!",
			enabled: false, // Disabled by default - priority uses keyword matching
		},
	],
};

export const DEFAULT_SETTINGS: TaskNotesSettings = {
	tasksFolder: "TaskNotes/Tasks",
	moveArchivedTasks: false,
	archiveFolder: "TaskNotes/Archive",
	taskTag: "task",
	taskIdentificationMethod: "tag", // Default to tag-based identification
	hideIdentifyingTagsInCards: false, // Default to showing all tags (backward compatibility)
	taskPropertyName: "",
	taskPropertyValue: "",
	excludedFolders: "", // Default to no excluded folders
	defaultTaskPriority: "normal",
	defaultTaskStatus: "open",
	taskOrgFiltersCollapsed: false, // Default to expanded
	// Task filename defaults
	taskFilenameFormat: "zettel", // Keep existing behavior as default
	storeTitleInFilename: true,
	customFilenameTemplate: "{title}", // Simple title template
	// Task creation defaults
	taskCreationDefaults: DEFAULT_TASK_CREATION_DEFAULTS,
	// Calendar view defaults
	calendarViewSettings: DEFAULT_CALENDAR_VIEW_SETTINGS,
	// Pomodoro defaults
	pomodoroWorkDuration: 25,
	pomodoroShortBreakDuration: 5,
	pomodoroLongBreakDuration: 15,
	pomodoroLongBreakInterval: 4,
	pomodoroAutoStartBreaks: true,
	pomodoroAutoStartWork: false,
	pomodoroNotifications: true,
	pomodoroSoundEnabled: true,
	pomodoroSoundVolume: 50,
	pomodoroStorageLocation: "plugin",
	pomodoroMobileSidebar: "tab",
	// Editor defaults
	enableTaskLinkOverlay: true,
	disableOverlayOnAlias: false,
	enableInstantTaskConvert: true,
	useDefaultsOnInstantConvert: true,
	enableNaturalLanguageInput: true,
	nlpDefaultToScheduled: true,
	nlpLanguage: "en", // Default to English
	uiLanguage: "system",
	// NLP status suggestion trigger (deprecated)
	statusSuggestionTrigger: "*",
	// NLP triggers
	nlpTriggers: DEFAULT_NLP_TRIGGERS,

	singleClickAction: "edit",
	doubleClickAction: "openNote",
	// Autosuggest project card defaults
	projectAutosuggest: DEFAULT_PROJECT_AUTOSUGGEST,

	// Inline task conversion defaults
	inlineTaskConvertFolder: "{{currentNotePath}}",
	// Performance defaults
	disableNoteIndexing: false,
	// Suggestion performance defaults
	suggestionDebounceMs: 0,
	// Customization defaults
	fieldMapping: DEFAULT_FIELD_MAPPING,
	customStatuses: DEFAULT_STATUSES,
	customPriorities: DEFAULT_PRIORITIES,
	// Migration defaults
	recurrenceMigrated: false,
	// Release notes defaults
	lastSeenVersion: undefined,
	showReleaseNotesOnUpdate: true,
	// Status bar defaults
	showTrackedTasksInStatusBar: false,
	// Time tracking defaults
	autoStopTimeTrackingOnComplete: true,
	autoStopTimeTrackingNotification: false,
	// Relationships widget defaults (unified subtasks, projects, and dependencies)
	showRelationships: true,
	relationshipsPosition: "bottom",
	// Task card in note defaults
	showTaskCardInNote: true,
	// Task card expandable subtasks defaults
	showExpandableSubtasks: true,
	// Subtask chevron position default
	subtaskChevronPosition: "right",
	// Filter toolbar layout defaults
	viewsButtonAlignment: "right",
	// Overdue behavior defaults
	hideCompletedFromOverdue: true,
	// ICS integration defaults
	icsIntegration: DEFAULT_ICS_INTEGRATION_SETTINGS,
	// Saved filter views defaults
	savedViews: [],
	// Notification defaults
	enableNotifications: true,
	notificationType: "system",
	// HTTP API defaults
	enableAPI: false,
	apiPort: 8080,
	apiAuthToken: "",
	// Webhook defaults
	webhooks: [],
	// User Fields defaults (multiple)
	userFields: [],
	// Modal Fields Configuration defaults
	modalFieldsConfig: undefined, // Initialized on first use via migration
	// Split layout for task modals on wide screens
	enableModalSplitLayout: true, // Enabled by default
	// Default visible properties for task cards
	defaultVisibleProperties: [
		"status", // Status dot
		"priority", // Priority dot
		"due", // Due date
		"scheduled", // Scheduled date
		"projects", // Projects
		"contexts", // Contexts
		"tags", // Tags
		"blocked", // Blocked indicator
		"blocking", // Blocking indicator
	],
	// Default visible properties for inline task cards (more compact by default)
	inlineVisibleProperties: ["status", "priority", "due", "scheduled", "recurrence"],
	// Bases integration defaults
	enableBases: true,
	enableMdbaseSpec: false,
	autoCreateDefaultBasesFiles: true, // Auto-create missing default Base files on startup
	// Command-to-file mappings for view commands (v4)
	commandFileMapping: {
		'open-calendar-view': 'TaskNotes/Views/mini-calendar-default.base',
		'open-kanban-view': 'TaskNotes/Views/kanban-default.base',
		'open-tasks-view': 'TaskNotes/Views/tasks-default.base',
		'open-advanced-calendar-view': 'TaskNotes/Views/calendar-default.base',
		'open-agenda-view': 'TaskNotes/Views/agenda-default.base',
		'relationships': 'TaskNotes/Views/relationships.base',
	},
	// Recurring task behavior defaults
	maintainDueDateOffsetInRecurring: false,
	// Frontmatter link format defaults
	useFrontmatterMarkdownLinks: false, // Default to wikilinks for compatibility
	// OAuth Calendar Integration defaults
	oauthSetupMode: "advanced" as "quick" | "advanced", // BETA: Default to advanced setup (quick setup temporarily disabled)
	lemonSqueezyLicenseKey: "",
	googleOAuthClientId: "",
	googleOAuthClientSecret: "",
	microsoftOAuthClientId: "",
	microsoftOAuthClientSecret: "",
	enableGoogleCalendar: false,
	enableMicrosoftCalendar: false,
	// Google Calendar selection (empty = show all calendars)
	enabledGoogleCalendars: [],
	// Google Calendar sync tokens (for incremental sync)
	googleCalendarSyncTokens: {},
	// Microsoft Calendar selection (empty = show all calendars)
	enabledMicrosoftCalendars: [],
	// Microsoft Calendar sync tokens (delta links for incremental sync)
	microsoftCalendarSyncTokens: {},
	// Google Calendar task export settings
	googleCalendarExport: DEFAULT_GOOGLE_CALENDAR_EXPORT,
};
