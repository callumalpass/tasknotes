import { FieldMapping, StatusConfig, PriorityConfig, SavedView, WebhookConfig } from '../types';

export interface UserFieldMapping {
	enabled: boolean;
	displayName: string;
	key: string; // frontmatter key
	type: 'text' | 'number' | 'date' | 'boolean' | 'list';
}

// New multi-field mapping for MVP
export interface UserMappedField {
	id: string; // stable id used in filters (e.g., 'effort')
	displayName: string;
	key: string; // frontmatter key
	type: 'text' | 'number' | 'date' | 'boolean' | 'list';
}

export interface ProjectAutosuggestSettings {
	enableFuzzy: boolean;
	rows: string[]; // up to 3 rows; each uses {property|flags} format
	showAdvanced?: boolean; // Show advanced configuration options
	requiredTags?: string[]; // Show notes that have ANY of these tags
	includeFolders?: string[]; // Only show notes in these folders (empty = all folders)
	propertyKey?: string; // Frontmatter property name to match
	propertyValue?: string; // Expected value for the property (empty = property must exist)
}

export interface TaskNotesSettings {
	tasksFolder: string;  // Now just a default location for new tasks
	moveArchivedTasks: boolean; // Whether to move tasks to archive folder when archived
	archiveFolder: string; // Folder to move archived tasks to, supports template variables
	taskTag: string;      // The tag that identifies tasks
	taskIdentificationMethod: 'tag' | 'property';  // Method to identify tasks
	taskPropertyName: string;     // Property name for property-based identification
	taskPropertyValue: string;    // Property value for property-based identification
	excludedFolders: string;  // Comma-separated list of folders to exclude from Notes tab
	defaultTaskPriority: string;  // Changed to string to support custom priorities
	defaultTaskStatus: string;    // Changed to string to support custom statuses
	taskOrgFiltersCollapsed: boolean;  // Save collapse state of task organization filters
	// Task filename settings
	taskFilenameFormat: 'title' | 'zettel' | 'timestamp' | 'custom';
	storeTitleInFilename: boolean;
	customFilenameTemplate: string; // Template for custom format
	// Task creation defaults
	taskCreationDefaults: TaskCreationDefaults;
	// Calendar view settings
	calendarViewSettings: CalendarViewSettings;
	// Pomodoro settings
	pomodoroWorkDuration: number; // minutes
	pomodoroShortBreakDuration: number; // minutes
	pomodoroLongBreakDuration: number; // minutes
	pomodoroLongBreakInterval: number; // after X pomodoros
	pomodoroAutoStartBreaks: boolean;
	pomodoroAutoStartWork: boolean;
	pomodoroNotifications: boolean;
	pomodoroSoundEnabled: boolean;
	pomodoroSoundVolume: number; // 0-100
	pomodoroStorageLocation: 'plugin' | 'daily-notes'; // where to store pomodoro history data
	// Editor settings
	enableTaskLinkOverlay: boolean;
	enableInstantTaskConvert: boolean;
	useDefaultsOnInstantConvert: boolean;
	enableNaturalLanguageInput: boolean;
	nlpDefaultToScheduled: boolean;
	nlpLanguage: string; // Language code for natural language processing (e.g., 'en', 'es', 'fr')
	uiLanguage: string; // 'system' or supported locale code for UI translations

		// NLP status suggestion trigger (empty to disable)
		statusSuggestionTrigger: string;

	projectAutosuggest?: ProjectAutosuggestSettings; // Display config for project suggestions in NL input
	// end of project autosuggest settings

	singleClickAction: 'edit' | 'openNote';
	doubleClickAction: 'edit' | 'openNote' | 'none';
	// Inline task conversion settings
	inlineTaskConvertFolder: string; // Folder for inline task conversion, supports {{currentNotePath}} and {{currentNoteTitle}}
	// Performance settings
	disableNoteIndexing: boolean;
	/** Optional debounce in milliseconds for inline file suggestions (0 = disabled) */
	suggestionDebounceMs?: number;
	// Customization settings
	fieldMapping: FieldMapping;
	customStatuses: StatusConfig[];
	customPriorities: PriorityConfig[];
	// Migration tracking
	recurrenceMigrated?: boolean;
	// Status bar settings
	showTrackedTasksInStatusBar: boolean;
	// Time tracking settings
	autoStopTimeTrackingOnComplete: boolean;
	autoStopTimeTrackingNotification: boolean;
	// Project subtasks widget settings
	showProjectSubtasks: boolean;
	showExpandableSubtasks: boolean;
	projectSubtasksPosition: 'top' | 'bottom';
	// Subtask chevron position in task cards
	subtaskChevronPosition: 'left' | 'right';
	// Filter toolbar layout
	viewsButtonAlignment: 'left' | 'right';
	// Overdue behavior settings
	hideCompletedFromOverdue: boolean;
	// ICS integration settings
	icsIntegration: ICSIntegrationSettings;
	// Saved filter views
	savedViews: SavedView[];
	// Notification settings
	enableNotifications: boolean;
	notificationType: 'in-app' | 'system';
	// HTTP API settings
	enableAPI: boolean;
	apiPort: number;
	apiAuthToken: string;
	// Webhook settings
	webhooks: WebhookConfig[];
	// User-defined field mappings (optional)
	userFields?: UserMappedField[];
	// Legacy single-field (for migration only)
	userField?: UserFieldMapping;
	// Default visible properties for task cards (when no saved view is active)
	defaultVisibleProperties?: string[];
	// Bases integration settings
	enableBases: boolean;
	// Recurring task behavior
	maintainDueDateOffsetInRecurring: boolean;
}

export interface DefaultReminder {
	id: string;
	type: 'relative' | 'absolute';
	// For relative reminders
	relatedTo?: 'due' | 'scheduled';
	offset?: number; // Amount in specified unit
	unit?: 'minutes' | 'hours' | 'days';
	direction?: 'before' | 'after';
	// For absolute reminders
	absoluteTime?: string; // Time in HH:MM format
	absoluteDate?: string; // Date in YYYY-MM-DD format
	description?: string;
}

export interface TaskCreationDefaults {
	// Pre-fill options
	defaultContexts: string;  // Comma-separated list
	defaultTags: string;      // Comma-separated list
	defaultProjects: string;  // Comma-separated list of project links
	useParentNoteAsProject: boolean; // Use the parent note as a project during instant conversion
	defaultTimeEstimate: number; // minutes, 0 = no default
	defaultRecurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
	// Date defaults
	defaultDueDate: 'none' | 'today' | 'tomorrow' | 'next-week';
	defaultScheduledDate: 'none' | 'today' | 'tomorrow' | 'next-week';
	// Body template settings
	bodyTemplate: string;     // Path to template file for task body, empty = no template
	useBodyTemplate: boolean; // Whether to use body template by default
	// Reminder defaults
	defaultReminders: DefaultReminder[];
}

export interface ICSIntegrationSettings {
	// Default templates for creating content from ICS events
	defaultNoteTemplate: string;     // Path to template file for notes created from ICS events
	// Default folders
	defaultNoteFolder: string;       // Folder for notes created from ICS events
	// Filename settings for ICS event notes
	icsNoteFilenameFormat: 'title' | 'zettel' | 'timestamp' | 'custom';
	customICSNoteFilenameTemplate: string; // Template for custom format
	// Automatic export settings
	enableAutoExport: boolean;       // Whether to automatically export tasks to ICS file
	autoExportPath: string;          // Path where the ICS file should be saved
	autoExportInterval: number;      // Export interval in minutes (default: 60)
}

export interface CalendarViewSettings {
	// Default view
	defaultView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'multiMonthYear' | 'timeGridCustom';
	// Custom multi-day view settings
	customDayCount: number; // Number of days to show in custom view (2-10)
	// Time settings
	slotDuration: '00:15:00' | '00:30:00' | '01:00:00'; // 15, 30, or 60 minutes
	slotMinTime: string; // Start time (HH:MM:SS format)
	slotMaxTime: string; // End time (HH:MM:SS format)
	scrollTime: string; // Initial scroll position (HH:MM:SS format)
	// Week settings
	firstDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
	// Display preferences
	timeFormat: '12' | '24'; // 12-hour or 24-hour format
	showWeekends: boolean;
	// Locale settings
	locale: string; // Calendar locale (e.g., 'en', 'fa', 'de', etc.) - empty string means auto-detect
	// Default event type visibility
	defaultShowScheduled: boolean;
	defaultShowDue: boolean;
	defaultShowDueWhenScheduled: boolean;
	defaultShowTimeEntries: boolean;
	defaultShowRecurring: boolean;
	defaultShowICSEvents: boolean;
	// Timeblocking settings
	enableTimeblocking: boolean;
	defaultShowTimeblocks: boolean;
	// Calendar behavior
	nowIndicator: boolean;
	selectMirror: boolean;
	weekNumbers: boolean;
	// Today highlighting
	showTodayHighlight: boolean;
}
