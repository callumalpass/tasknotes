import { FieldMapping, StatusConfig, PriorityConfig, SavedView, WebhookConfig } from "../types";
import type { FileFilterConfig } from "../suggest/FileSuggestHelper";

export interface UserFieldMapping {
	enabled: boolean;
	displayName: string;
	key: string; // frontmatter key
	type: "text" | "number" | "date" | "boolean" | "list";
}

// New multi-field mapping for MVP
export interface UserMappedField {
	id: string; // stable id used in filters (e.g., 'effort')
	displayName: string;
	key: string; // frontmatter key
	type: "text" | "number" | "date" | "boolean" | "list";
	autosuggestFilter?: FileFilterConfig; // Optional filter configuration for file suggestions
}

/**
 * Field types for task modal configuration
 */
export type FieldType = "core" | "user" | "dependency" | "organization";

/**
 * Field groups for organizing fields in the modal
 */
export type FieldGroup = "basic" | "metadata" | "organization" | "dependencies" | "custom";

/**
 * Configuration for a single field in task modals
 */
export interface ModalFieldConfig {
	id: string; // Unique identifier (e.g., 'title', 'contexts', 'due-date', or user field id)
	fieldType: FieldType; // Type of field (core, user, dependency, organization)
	group: FieldGroup; // Which group this field belongs to
	displayName: string; // Label shown in UI
	visibleInCreation: boolean; // Show in creation modal
	visibleInEdit: boolean; // Show in edit modal
	order: number; // Display order within group
	enabled: boolean; // Whether field is enabled at all
	required?: boolean; // Whether field is required (future use)
}

/**
 * Complete field configuration for task modals
 */
export interface TaskModalFieldsConfig {
	version: number; // Config version for migrations
	fields: ModalFieldConfig[]; // All configured fields
	groups: FieldGroupConfig[]; // Group configuration
}

/**
 * Configuration for field groups
 */
export interface FieldGroupConfig {
	id: FieldGroup;
	displayName: string;
	order: number; // Order of groups in modal
	collapsible: boolean; // Can be collapsed/expanded
	defaultCollapsed: boolean; // Default collapsed state
}

/**
 * Configuration for a single NLP trigger
 */
export interface PropertyTriggerConfig {
	propertyId: string; // 'tags', 'contexts', 'projects', 'status', 'priority', or user field id
	trigger: string; // The trigger string (e.g., '@', 'context:', '#')
	enabled: boolean; // Whether this trigger is active
}

/**
 * NLP triggers configuration
 */
export interface NLPTriggersConfig {
	triggers: PropertyTriggerConfig[];
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
	tasksFolder: string; // Now just a default location for new tasks
	moveArchivedTasks: boolean; // Whether to move tasks to archive folder when archived
	archiveFolder: string; // Folder to move archived tasks to, supports template variables
	taskTag: string; // The tag that identifies tasks
	taskIdentificationMethod: "tag" | "property"; // Method to identify tasks
	hideIdentifyingTagsInCards: boolean; // Hide identifying tags in task card displays
	taskPropertyName: string; // Property name for property-based identification
	taskPropertyValue: string; // Property value for property-based identification
	excludedFolders: string; // Comma-separated list of folders to exclude from Notes tab
	defaultTaskPriority: string; // Changed to string to support custom priorities
	defaultTaskStatus: string; // Changed to string to support custom statuses
	taskOrgFiltersCollapsed: boolean; // Save collapse state of task organization filters
	// Task filename settings
	taskFilenameFormat: "title" | "zettel" | "timestamp" | "custom";
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
	pomodoroStorageLocation: "plugin" | "daily-notes"; // where to store pomodoro history data
	// Editor settings
	enableTaskLinkOverlay: boolean;
	enableInstantTaskConvert: boolean;
	useDefaultsOnInstantConvert: boolean;
	enableNaturalLanguageInput: boolean;
	nlpDefaultToScheduled: boolean;
	nlpLanguage: string; // Language code for natural language processing (e.g., 'en', 'es', 'fr')
	uiLanguage: string; // 'system' or supported locale code for UI translations

	// NLP status suggestion trigger (empty to disable) - DEPRECATED: Use nlpTriggers instead
	statusSuggestionTrigger: string;

	// NLP triggers configuration
	nlpTriggers: NLPTriggersConfig;

	projectAutosuggest?: ProjectAutosuggestSettings; // Display config for project suggestions in NL input
	// end of project autosuggest settings

	singleClickAction: "edit" | "openNote";
	doubleClickAction: "edit" | "openNote" | "none";
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
	// Release notes tracking
	lastSeenVersion?: string;
	showReleaseNotesOnUpdate?: boolean;
	// Status bar settings
	showTrackedTasksInStatusBar: boolean;
	// Time tracking settings
	autoStopTimeTrackingOnComplete: boolean;
	autoStopTimeTrackingNotification: boolean;
	// Relationships widget settings (unified subtasks, projects, and dependencies)
	showRelationships: boolean;
	relationshipsPosition: "top" | "bottom";
	// Task card in note settings
	showTaskCardInNote: boolean;
	// Task card expandable subtasks settings
	showExpandableSubtasks: boolean;
	// Subtask chevron position in task cards
	subtaskChevronPosition: "left" | "right";
	// Filter toolbar layout
	viewsButtonAlignment: "left" | "right";
	// Overdue behavior settings
	hideCompletedFromOverdue: boolean;
	// ICS integration settings
	icsIntegration: ICSIntegrationSettings;
	// Saved filter views
	savedViews: SavedView[];
	// Notification settings
	enableNotifications: boolean;
	notificationType: "in-app" | "system";
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
	// Task modal field configuration
	modalFieldsConfig?: TaskModalFieldsConfig;
	// Default visible properties for task cards (when no saved view is active)
	defaultVisibleProperties?: string[];
	// Default visible properties for inline task cards (task link widgets in editor)
	inlineVisibleProperties?: string[];
	// Bases integration settings
	enableBases: boolean;
	// Command-to-file mappings for view commands (v4)
	commandFileMapping: {
		'open-calendar-view': string;
		'open-kanban-view': string;
		'open-tasks-view': string;
		'open-advanced-calendar-view': string;
		'open-agenda-view': string;
		'relationships': string; // Bases file for unified relationships widget
		[key: string]: string; // Allow string indexing
	};
	// Recurring task behavior
	maintainDueDateOffsetInRecurring: boolean;
	// Frontmatter link format settings
	useFrontmatterMarkdownLinks: boolean; // Use markdown links in frontmatter (requires obsidian-frontmatter-markdown-links plugin)
	// OAuth Calendar Integration settings
	oauthSetupMode: "quick" | "advanced"; // User's preferred setup mode
	lemonSqueezyLicenseKey: string; // License key for using TaskNotes' built-in OAuth credentials
	googleOAuthClientId: string;
	googleOAuthClientSecret: string;
	microsoftOAuthClientId: string;
	microsoftOAuthClientSecret: string;
	enableGoogleCalendar: boolean;
	enableMicrosoftCalendar: boolean;
	// Google Calendar selection
	enabledGoogleCalendars: string[]; // Array of calendar IDs that should be displayed
	// Google Calendar sync tokens (for incremental sync)
	googleCalendarSyncTokens: Record<string, string>; // Maps calendar ID to sync token
	// Microsoft Calendar selection
	enabledMicrosoftCalendars: string[]; // Array of calendar IDs that should be displayed
	// Microsoft Calendar sync tokens (delta links for incremental sync)
	microsoftCalendarSyncTokens: Record<string, string>; // Maps calendar ID to delta link
}

export interface DefaultReminder {
	id: string;
	type: "relative" | "absolute";
	// For relative reminders
	relatedTo?: "due" | "scheduled";
	offset?: number; // Amount in specified unit
	unit?: "minutes" | "hours" | "days";
	direction?: "before" | "after";
	// For absolute reminders
	absoluteTime?: string; // Time in HH:MM format
	absoluteDate?: string; // Date in YYYY-MM-DD format
	description?: string;
}

export interface TaskCreationDefaults {
	// Pre-fill options
	defaultContexts: string; // Comma-separated list
	defaultTags: string; // Comma-separated list
	defaultProjects: string; // Comma-separated list of project links
	useParentNoteAsProject: boolean; // Use the parent note as a project during instant conversion
	defaultTimeEstimate: number; // minutes, 0 = no default
	defaultRecurrence: "none" | "daily" | "weekly" | "monthly" | "yearly";
	// Date defaults
	defaultDueDate: "none" | "today" | "tomorrow" | "next-week";
	defaultScheduledDate: "none" | "today" | "tomorrow" | "next-week";
	// Body template settings
	bodyTemplate: string; // Path to template file for task body, empty = no template
	useBodyTemplate: boolean; // Whether to use body template by default
	// Reminder defaults
	defaultReminders: DefaultReminder[];
}

export interface ICSIntegrationSettings {
	// Default templates for creating content from ICS events
	defaultNoteTemplate: string; // Path to template file for notes created from ICS events
	// Default folders
	defaultNoteFolder: string; // Folder for notes created from ICS events
	// Filename settings for ICS event notes
	icsNoteFilenameFormat: "title" | "zettel" | "timestamp" | "custom";
	customICSNoteFilenameTemplate: string; // Template for custom format
	// Automatic export settings
	enableAutoExport: boolean; // Whether to automatically export tasks to ICS file
	autoExportPath: string; // Path where the ICS file should be saved
	autoExportInterval: number; // Export interval in minutes (default: 60)
}

export interface CalendarViewSettings {
	// Default view
	defaultView:
		| "dayGridMonth"
		| "timeGridWeek"
		| "timeGridDay"
		| "multiMonthYear"
		| "timeGridCustom";
	// Custom multi-day view settings
	customDayCount: number; // Number of days to show in custom view (2-10)
	// Time settings
	slotDuration: "00:15:00" | "00:30:00" | "01:00:00"; // 15, 30, or 60 minutes
	slotMinTime: string; // Start time (HH:MM:SS format)
	slotMaxTime: string; // End time (HH:MM:SS format)
	scrollTime: string; // Initial scroll position (HH:MM:SS format)
	// Week settings
	firstDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 1 = Monday, etc.
	// Display preferences
	timeFormat: "12" | "24"; // 12-hour or 24-hour format
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
	// Event display
	eventMinHeight: number; // Minimum height for events (FullCalendar eventMinHeight)
	// Event overlap and stacking behavior
	slotEventOverlap: boolean; // Whether timed events should visually overlap (false = side-by-side)
	eventMaxStack: number | null; // Max events stacked in timeGrid view (null = unlimited)
	dayMaxEvents: number | boolean; // Max events per day in dayGrid view (true = auto, number = limit, false = unlimited)
	dayMaxEventRows: number | boolean; // Max event rows per day in dayGrid view (true = auto, number = limit, false = unlimited)
}
