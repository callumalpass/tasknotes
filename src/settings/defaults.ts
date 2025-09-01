import { FieldMapping, StatusConfig, PriorityConfig } from '../types';
import { TaskNotesSettings, TaskCreationDefaults, CalendarViewSettings, ICSIntegrationSettings } from '../types/settings';

// Default field mapping maintains backward compatibility
export const DEFAULT_FIELD_MAPPING: FieldMapping = {
	title: 'title',
	status: 'status',
	priority: 'priority',
	due: 'due',
	scheduled: 'scheduled',
	contexts: 'contexts',
	projects: 'projects',
	timeEstimate: 'timeEstimate',
	completedDate: 'completedDate',
	dateCreated: 'dateCreated',
	dateModified: 'dateModified',
	recurrence: 'recurrence',
	archiveTag: 'archived',
	timeEntries: 'timeEntries',
	completeInstances: 'complete_instances',
	pomodoros: 'pomodoros',
	icsEventId: 'icsEventId',
	icsEventTag: 'ics_event',
	reminders: 'reminders'
};

// Default status configuration matches current hardcoded behavior
export const DEFAULT_STATUSES: StatusConfig[] = [
	{
		id: 'none',
		value: 'none',
		label: 'None',
		color: '#cccccc',
		isCompleted: false,
		order: 0
	},
	{
		id: 'open',
		value: 'open',
		label: 'Open',
		color: '#808080',
		isCompleted: false,
		order: 1
	},
	{
		id: 'in-progress',
		value: 'in-progress',
		label: 'In progress',
		color: '#0066cc',
		isCompleted: false,
		order: 2
	},
	{
		id: 'done',
		value: 'done',
		label: 'Done',
		color: '#00aa00',
		isCompleted: true,
		order: 3
	}
];

// Default priority configuration matches current hardcoded behavior
export const DEFAULT_PRIORITIES: PriorityConfig[] = [
	{
		id: 'none',
		value: 'none',
		label: 'None',
		color: '#cccccc',
		weight: 0
	},
	{
		id: 'low',
		value: 'low',
		label: 'Low',
		color: '#00aa00',
		weight: 1
	},
	{
		id: 'normal',
		value: 'normal',
		label: 'Normal',
		color: '#ffaa00',
		weight: 2
	},
	{
		id: 'high',
		value: 'high',
		label: 'High',
		color: '#ff0000',
		weight: 3
	}
];

export const DEFAULT_TASK_CREATION_DEFAULTS: TaskCreationDefaults = {
	defaultContexts: '',
	defaultTags: '',
	defaultProjects: '',
	useParentNoteAsProject: false,
	defaultTimeEstimate: 0,
	defaultRecurrence: 'none',
	defaultDueDate: 'none',
	defaultScheduledDate: 'today',
	bodyTemplate: '',
	useBodyTemplate: false,
	defaultReminders: []
};

export const DEFAULT_CALENDAR_VIEW_SETTINGS: CalendarViewSettings = {
	// Default view
	defaultView: 'dayGridMonth',
	// Custom multi-day view settings
	customDayCount: 3, // Default to 3 days as requested in issue #282
	// Time settings
	slotDuration: '00:30:00', // 30-minute slots
	slotMinTime: '00:00:00', // Start at midnight
	slotMaxTime: '24:00:00', // End at midnight next day
	scrollTime: '08:00:00', // Scroll to 8 AM
	// Week settings
	firstDay: 1, // Monday
	// Display preferences
	timeFormat: '24', // 24-hour format
	showWeekends: true,
	// Locale settings
	locale: '', // Empty string means auto-detect from browser
	// Default event type visibility
	defaultShowScheduled: true,
	defaultShowDue: true,
	defaultShowDueWhenScheduled: true,
	defaultShowTimeEntries: false,
	defaultShowRecurring: true,
	defaultShowICSEvents: true,
	// Timeblocking settings
	enableTimeblocking: false, // Disabled by default - toggleable feature
	defaultShowTimeblocks: true,
	// Calendar behavior
	nowIndicator: true,
	selectMirror: true,
	weekNumbers: false,
	// Today highlighting
	showTodayHighlight: true
};

export const DEFAULT_ICS_INTEGRATION_SETTINGS: ICSIntegrationSettings = {
	defaultNoteTemplate: '',
	defaultNoteFolder: '',
	icsNoteFilenameFormat: 'title', // Default to using the event title for ICS notes
	customICSNoteFilenameTemplate: '{title}' // Simple title template for ICS notes
};

export const DEFAULT_SETTINGS: TaskNotesSettings = {
	tasksFolder: 'TaskNotes/Tasks',
	moveArchivedTasks: false,
	archiveFolder: 'TaskNotes/Archive',
	taskTag: 'task',
	taskIdentificationMethod: 'tag',  // Default to tag-based identification
	taskPropertyName: '',
	taskPropertyValue: '',
	excludedFolders: '',  // Default to no excluded folders
	defaultTaskPriority: 'normal',
	defaultTaskStatus: 'open',
	taskOrgFiltersCollapsed: false,  // Default to expanded
	// Task filename defaults
	taskFilenameFormat: 'zettel',  // Keep existing behavior as default
	storeTitleInFilename: true,
	customFilenameTemplate: '{title}',  // Simple title template
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
	pomodoroStorageLocation: 'plugin',
	// Editor defaults
	enableTaskLinkOverlay: true,
	enableInstantTaskConvert: true,
	useDefaultsOnInstantConvert: true,
	enableNaturalLanguageInput: true,
	nlpDefaultToScheduled: true,
		// NLP status suggestion trigger
		statusSuggestionTrigger: '*',

	singleClickAction: 'edit',
	doubleClickAction: 'openNote',
	// Inline task conversion defaults
	inlineTaskConvertFolder: '{{currentNotePath}}',
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
	// Status bar defaults
	showTrackedTasksInStatusBar: false,
	// Time tracking defaults
	autoStopTimeTrackingOnComplete: true,
	autoStopTimeTrackingNotification: false,
	// Project subtasks widget defaults
	showProjectSubtasks: true,
	showExpandableSubtasks: true,
	projectSubtasksPosition: 'bottom',
	// Subtask chevron position default
	subtaskChevronPosition: 'right',
	// Filter toolbar layout defaults
	viewsButtonAlignment: 'right',
	// Overdue behavior defaults
	hideCompletedFromOverdue: true,
	// ICS integration defaults
	icsIntegration: DEFAULT_ICS_INTEGRATION_SETTINGS,
	// Saved filter views defaults
	savedViews: [],
	// Notification defaults
	enableNotifications: true,
	notificationType: 'system',
	// HTTP API defaults
	enableAPI: false,
	apiPort: 8080,
	apiAuthToken: '',
	// Webhook defaults
	webhooks: [],
	// User Fields defaults (multiple)
	userFields: [],
	// Default visible properties for task cards
	defaultVisibleProperties: [
		'status',      // Status dot
		'priority',    // Priority dot
		'due',         // Due date
		'scheduled',   // Scheduled date
		'projects',    // Projects
		'contexts',    // Contexts
		'tags'         // Tags
	],
	// Recurring task behavior defaults
	maintainDueDateOffsetInRecurring: false
};