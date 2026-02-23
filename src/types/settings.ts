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
	defaultValue?: string | number | boolean | string[]; // Default value for the field
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

/**
 * Mapping between a device and a user note in the vault.
 * Used by the device identity system for auto-attribution in shared vaults.
 */
export interface DeviceUserMapping {
	deviceId: string;
	userNotePath: string;
	deviceName: string;
	lastSeen: number;
	userDisplayName?: string;
	/** Custom avatar color (hex). If not set, color is generated from name. */
	avatarColor?: string;
}

/**
 * Mapping for a discovered group note in the vault.
 * Used by GroupRegistry for caching group membership.
 */
export interface GroupNoteMapping {
	notePath: string;
	displayName: string;
	memberPaths: string[]; // Direct members (before recursive resolution)
	lastUpdated: number;
}

/**
 * Lead time configuration for reminder notifications.
 * Specifies how far in advance to notify before a task is due.
 */
export interface LeadTime {
	value: number;
	unit: "minutes" | "hours" | "days" | "weeks";
}

/**
 * Preferences for a person note, used for per-assignee notifications.
 * Read from frontmatter of person notes with type: person.
 */
export interface PersonPreferences {
	availableFrom: string; // "09:00" format, start of availability window
	availableUntil: string; // "17:00" format, end of availability window
	reminderLeadTimes: LeadTime[];
	notificationEnabled: boolean;
	overrideGlobalReminders: boolean; // true = replace global lead-time rules, false = add to them
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
	taskFilenameFormat: "title" | "zettel" | "zettel-title" | "timestamp" | "custom";
	storeTitleInFilename: boolean;
	customFilenameTemplate: string; // Template for custom format
	filenameCollisionBehavior: "silent" | "notify" | "ask"; // How to handle filename collisions
	collisionRetrySuffix: "timestamp" | "random" | "zettel"; // What to append when retrying
	zettelDateSource: "creation" | "due"; // Legacy - kept for backwards compatibility
	zettelDateChain: ("due" | "scheduled" | "creation")[]; // Fallback chain for zettel date
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
	pomodoroMobileSidebar: "tab" | "left" | "right"; // where to open pomodoro view on mobile
	// Editor settings
	enableTaskLinkOverlay: boolean;
	disableOverlayOnAlias: boolean;
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
	notificationType: "in-app" | "system" | "both";
	// HTTP API settings
	enableAPI: boolean;
	apiPort: number;
	apiAuthToken: string;
	enableMCP: boolean;
	// Webhook settings
	webhooks: WebhookConfig[];
	// User-defined field mappings (optional)
	userFields?: UserMappedField[];
	// Legacy single-field (for migration only)
	userField?: UserFieldMapping;
	// Task modal field configuration
	modalFieldsConfig?: TaskModalFieldsConfig;
	// Split layout for task modals on wide screens
	enableModalSplitLayout: boolean;
	// Default visible properties for task cards (when no saved view is active)
	defaultVisibleProperties?: string[];
	// Default visible properties for inline task cards (task link widgets in editor)
	inlineVisibleProperties?: string[];
	// Bases integration settings
	enableBases: boolean;
	enableMdbaseSpec: boolean;
	autoCreateDefaultBasesFiles: boolean; // Auto-create missing default Base files on startup
	enableBulkActionsButton: boolean; // Show the "Bulk tasking" button in Bases view toolbars (key kept for backward compat)
	enableUniversalBasesButtons: boolean; // Show TaskNotes buttons on all Bases views (not just TaskNotes view types)
	defaultBulkMode: "generate" | "convert" | "bulkEdit"; // Default mode for the bulk tasking modal
	suppressBulkEditConfirmation: boolean; // Suppress confirmation dialog for bulk edit operations
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
	resetCheckboxesOnRecurrence: boolean; // Reset markdown checkboxes in task body when recurring task completes
	// Frontmatter link format settings
	useFrontmatterMarkdownLinks: boolean; // Use markdown links in frontmatter (requires obsidian-frontmatter-markdown-links plugin)
	// OAuth Calendar Integration settings
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
	// Google Calendar task export settings
	googleCalendarExport: GoogleCalendarExportSettings;
	// Device identity settings (for shared vaults)
	deviceUserMappings: DeviceUserMapping[];
	autoSetCreator: boolean;
	creatorFieldName: string;
	assigneeFieldName: string;
	// Person notes configuration (for Team & Attribution)
	personNotesFolder: string;
	personNotesTag: string;
	// Group notes configuration (for team assignment)
	groupNotesFolder: string; // Can be same as personNotesFolder
	groupNotesTag: string; // Optional filter tag
	groupNoteMappings: GroupNoteMapping[]; // Cached discovered groups
	// Configurable type property names (for enterprise compatibility)
	identityTypePropertyName: string; // Property name for person/group type detection (default: "type")
	personTypeValue: string; // Value that identifies person notes (default: "person")
	groupTypeValue: string; // Value that identifies group notes (default: "group")
	// Vault-wide notification settings
	vaultWideNotifications: VaultWideNotificationSettings;
	// Debug logging (persists between restarts)
	enableDebugLogging: boolean;
	// Note UUID settings (for persistent identity across renames)
	noteUuidPropertyName: string; // Empty = feature disabled
	noteUuidAutoGenerate: boolean;
	// Base identity settings (for per-base property mapping, see ADR-011)
	baseIdentityTrackSourceView: boolean; // Write tnSourceViewId/tnSourceBaseId on created tasks
	// Global reminder rules (virtual reminders applied to all tasks at runtime)
	globalReminderRules: GlobalReminderRule[];
	// Upcoming View date format settings
	upcomingViewDateFormat: "iso" | "us" | "eu" | "relative" | "rich" | "custom";
	upcomingViewCustomDateFormat: string; // date-fns format string when "custom"
	upcomingViewUseRelativeDates: boolean; // "2 days ago" vs "Jan 29, 2026"
	upcomingViewRelativeDateThreshold: number; // Days within which to use relative (default: 7)
}

/**
 * Time category for grouping notification items in the unified modal.
 */
export type TimeCategory = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth' | 'later';

/**
 * Source that triggered a notification item.
 */
export interface NotificationSource {
	type: 'base' | 'reminder-view' | 'upstream' | 'view-entry';
	path?: string;
	name: string;
}

/**
 * An aggregated notification item for the unified modal.
 * Combines items from multiple notification sources (bases, reminders, view-entry tracking).
 */
export interface AggregatedNotificationItem {
	path: string;
	title: string;
	isTask: boolean;
	status?: string;
	dueDate?: string;
	scheduledDate?: string;
	assignees?: string[];
	/** Project(s) this task belongs to - shown as grey text in UpcomingView */
	projects?: string | string[];
	/** Sources that triggered this notification (may come from multiple bases) */
	sources: NotificationSource[];
	/** Time-based grouping category */
	timeCategory: TimeCategory;
	/** Human-readable time context (e.g., "Due 2 days ago", "In queue for 3 days") */
	timeContext?: string;
	/** Whether this is a base notification task (type: base-notification) */
	isBaseNotification?: boolean;
	/** For base notifications: number of items matching the base filter */
	matchCount?: number;
	/** For base notifications: path to the source .base file */
	sourceBasePath?: string;
}

/**
 * Settings for the vault-wide notification system.
 */
export interface VaultWideNotificationSettings {
	enabled: boolean;
	showOnStartup: boolean;
	checkInterval: number; // minutes
	enabledSources: {
		bases: boolean;
		reminderViews: boolean;
		upstreamReminders: boolean;
		viewEntry: boolean;
	};
	defaultReminderTime: string; // HH:MM format
	/** Path to the .base file to open when clicking toast (optional, uses convention if not set) */
	upcomingViewPath?: string;
	/** Only notify for tasks assigned to current device's user (or groups containing them) */
	onlyNotifyIfAssignedToMe: boolean;
	/** Whether to notify for tasks with no assignee (when onlyNotifyIfAssignedToMe is true) */
	notifyForUnassignedTasks: boolean;
	/**
	 * How to display base notifications in toast/upcoming view:
	 * - "rollup": Show one item per base with match count (e.g., "Documents Coming Due (3 items)")
	 * - "individual": Show each matching item separately
	 * Default: "rollup" - bases represent queries, not individual items
	 */
	baseNotificationDisplay: "rollup" | "individual";
	/** Per-category reminder behavior configuration */
	reminderTypeSettings?: ReminderTypeSettings;
}

/**
 * Behavior when user dismisses a notification item.
 * Different categories may need different dismiss semantics.
 */
export type DismissBehavior =
	| "until-restart"       // Returns on Obsidian restart (current default)
	| "until-data-change"   // Returns when due date/content changes
	| "until-complete"      // Persistent until task completed (for overdue)
	| "snooze-1h"           // Auto-snooze for 1 hour, then return
	| "snooze-4h"           // Auto-snooze for 4 hours
	| "snooze-1d"           // Auto-snooze for 1 day
	| "until-next-reminder" // For lead-time: dismiss this one, next scheduled fires later
	| "permanent";          // Gone forever (user can re-enable via Upcoming View)

/**
 * Configuration for how a specific time category behaves in the notification system.
 * Each category (overdue, today, tomorrow, etc.) can have independent settings.
 */
export interface TimeCategoryBehavior {
	/** Whether items in this category contribute to the bell count */
	showInBellCount: boolean;
	/** Whether items in this category trigger toast popups */
	showToast: boolean;
	/** What happens when user clicks "Got it" / dismisses */
	dismissBehavior: DismissBehavior;
	/** Force return after X hours even if dismissed (0 = never auto-return) */
	autoReturnHours: number;
}

/**
 * Per-category behavior configuration for the notification system.
 * Allows different treatment for overdue vs today vs upcoming items.
 */
export interface ReminderTypeSettings {
	/** Overdue items (past due date) — typically most persistent */
	overdue: TimeCategoryBehavior;
	/** Due today items */
	today: TimeCategoryBehavior;
	/** Tomorrow items (heads up) */
	tomorrow: TimeCategoryBehavior;
	/** This week items (planning horizon) */
	thisWeek: TimeCategoryBehavior;
	/** Scheduled/start date reminders (awareness) */
	scheduled: TimeCategoryBehavior;
	/** Base query notifications (different paradigm - about query results, not individual items) */
	queryBased: TimeCategoryBehavior;
}

/**
 * Semantic type of a reminder, describing its behavioral intent.
 * Determines persistence, repeat logic, and auto-cancellation behavior.
 */
export type ReminderSemanticType =
	| "lead-time"    // Fire X before anchor date, one-shot, dismissed forever
	| "due-date"     // Fire on due date, persistent until task completed
	| "overdue"      // Fire after due date, repeats at interval until actioned
	| "start-date"   // Fire on start/scheduled date, one-shot
	| "custom";      // User-defined, no special semantics (existing behavior)

/**
 * Global reminder rule that applies to all tasks at runtime.
 * Virtual reminders are generated during evaluation — never written to task frontmatter.
 */
export interface GlobalReminderRule {
	id: string;
	enabled: boolean;
	semanticType: ReminderSemanticType;
	/** Human-readable description (e.g., "1 day before due") */
	description: string;
	/** Date property to anchor to (e.g., "due", "scheduled") */
	anchorProperty: string;
	/** ISO 8601 offset from anchor (e.g., "-P1D" for 1 day before, "PT0S" for at time) */
	offset: string;
	/** For overdue: repeat interval in hours (0 = don't repeat) */
	repeatIntervalHours?: number;
	/** Skip if task already has an explicit reminder with this semanticType */
	skipIfExplicitExists: boolean;
}

export interface DefaultReminder {
	id: string;
	type: "relative" | "absolute";
	// For relative reminders
	relatedTo?: string; // Any date property (e.g., "due", "scheduled", custom date fields)
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
	useDurationForExport: boolean; // Whether to use timeEstimate (duration) instead of due date for DTEND
	// Task creation from ICS events
	useICSEndAsDue: boolean; // Whether to use ICS event end time as task due date
}

/**
 * Configuration for exporting tasks to Google Calendar
 */
export interface GoogleCalendarExportSettings {
	enabled: boolean; // Master enable/disable for task export
	targetCalendarId: string; // Which calendar to create events in
	syncOnTaskCreate: boolean; // Auto-sync when task is created
	syncOnTaskUpdate: boolean; // Auto-sync when task is updated
	syncOnTaskComplete: boolean; // Update event when task is completed
	syncOnTaskDelete: boolean; // Delete event when task is deleted
	eventTitleTemplate: string; // Template for event title (e.g., "{{title}}" or "[TaskNotes] {{title}}")
	includeDescription: boolean; // Include task details in event description
	eventColorId: string | null; // Optional: Google Calendar color ID for TaskNotes events (null = calendar default)
	syncTrigger: "scheduled" | "due" | "both"; // Which date triggers event creation
	createAsAllDay: boolean; // Create as all-day events vs timed
	defaultEventDuration: number; // Duration in minutes if timed (uses timeEstimate if available)
	includeObsidianLink: boolean; // Include obsidian:// link in event description
	defaultReminderMinutes: number | null; // Popup reminder X minutes before event (null = no reminder)
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
	defaultShowScheduledToDueSpan: boolean; // Show multi-day span from scheduled to due
	defaultShowTimeEntries: boolean;
	defaultShowRecurring: boolean;
	defaultShowICSEvents: boolean;
	// Timeblocking settings
	enableTimeblocking: boolean;
	defaultShowTimeblocks: boolean;
	defaultTimeblockColor: string;
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
