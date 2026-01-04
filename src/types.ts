// View types (active views)
export const MINI_CALENDAR_VIEW_TYPE = "tasknotes-mini-calendar-view";
export const TASK_LIST_VIEW_TYPE = "tasknotes-task-list-view";
export const AGENDA_VIEW_TYPE = "tasknotes-agenda-view";
export const POMODORO_VIEW_TYPE = "tasknotes-pomodoro-view";
export const POMODORO_STATS_VIEW_TYPE = "tasknotes-pomodoro-stats-view";
export const STATS_VIEW_TYPE = "tasknotes-stats-view";
export const KANBAN_VIEW_TYPE = "tasknotes-kanban-view";
export const SUBTASK_WIDGET_VIEW_TYPE = "tasknotes-subtask-widget-view";

// Bases view IDs (for Bases plugin integration)
export const BASES_CALENDAR_VIEW_ID = "tasknotesCalendar";

// Event types
export const EVENT_DATE_SELECTED = "date-selected";
export const EVENT_TAB_CHANGED = "tab-changed";
export const EVENT_DATA_CHANGED = "data-changed";
export const EVENT_TASK_UPDATED = "task-updated";
export const EVENT_TASK_DELETED = "task-deleted";
export const EVENT_POMODORO_START = "pomodoro-start";
export const EVENT_POMODORO_COMPLETE = "pomodoro-complete";
export const EVENT_POMODORO_INTERRUPT = "pomodoro-interrupt";
export const EVENT_POMODORO_TICK = "pomodoro-tick";
export const EVENT_TIMEBLOCKING_TOGGLED = "timeblocking-toggled";
export const EVENT_TIMEBLOCK_UPDATED = "timeblock-updated";
export const EVENT_TIMEBLOCK_DELETED = "timeblock-deleted";
export const EVENT_DATE_CHANGED = "date-changed";

// Calendar colorization modes
export type ColorizeMode = "tasks" | "notes" | "daily";

// Calendar display modes
export type CalendarDisplayMode = "month" | "agenda";

// Task sorting and grouping types
export type TaskSortKey =
	| "due"
	| "scheduled"
	| "priority"
	| "status"
	| "title"
	| "dateCreated"
	| "completedDate"
	| "tags"
	| `user:${string}`;
export type TaskGroupKey =
	| "none"
	| "priority"
	| "context"
	| "project"
	| "due"
	| "scheduled"
	| "status"
	| "tags"
	| "completedDate"
	| `user:${string}`;
export type SortDirection = "asc" | "desc";

// New Advanced Filtering System Types

// A single filter rule
export interface FilterCondition {
	type: "condition";
	id: string; // Unique ID for DOM management
	property: FilterProperty; // The field to filter on (e.g., 'status', 'due', 'file.ctime')
	operator: FilterOperator; // The comparison operator (e.g., 'is', 'contains')
	value: string | string[] | number | boolean | null; // The value for comparison
}

// A logical grouping of conditions or other groups
export interface FilterGroup {
	type: "group";
	id: string; // Unique ID for DOM management and state tracking
	conjunction: "and" | "or"; // How children are evaluated
	children: FilterNode[]; // The contents of the group
}

// Union type for filter nodes
export type FilterNode = FilterCondition | FilterGroup;

// The main query structure, a single root group with display properties
export interface FilterQuery extends FilterGroup {
	sortKey?: TaskSortKey;
	sortDirection?: SortDirection;
	groupKey?: TaskGroupKey;
	// Secondary grouping key for hierarchical grouping (optional)
	subgroupKey?: TaskGroupKey;
}

// A named, persistent configuration that encapsulates the entire state
export interface SavedView {
	id: string; // Unique ID for the view
	name: string; // User-defined name (e.g., "High-Priority Work")
	query: FilterQuery; // The complete configuration, including filters, sorting, and grouping
	viewOptions?: { [key: string]: boolean }; // View-specific options (e.g., showOverdueOnToday, showNotes)
	visibleProperties?: string[]; // Array of property IDs to display on task cards (e.g., ['due', 'priority', 'projects'])
}

// Property and operator definitions for the advanced filtering system
export type FilterProperty =
	// Placeholder for "Select..." option
	| ""
	// Text properties
	| "title"
	| "path"
	// Select properties
	| "status"
	| "priority"
	| "tags"
	| "contexts"
	| "projects"
	| "blockedBy"
	| "blocking"
	// Date properties
	| "due"
	| "scheduled"
	| "completedDate"
	| "dateCreated"
	| "dateModified"
	// Boolean properties
	| "archived"
	| "dependencies.isBlocked"
	| "dependencies.isBlocking"
	// Numeric properties
	| "timeEstimate"
	// Special properties
	| "recurrence"
	| "status.isCompleted"
	// Dynamic user-mapped properties
	| `user:${string}`;

export type FilterOperator =
	// Basic comparison
	| "is"
	| "is-not"
	// Text operators
	| "contains"
	| "does-not-contain"
	// Date operators
	| "is-before"
	| "is-after"
	| "is-on-or-before"
	| "is-on-or-after"
	// Existence operators
	| "is-empty"
	| "is-not-empty"
	// Boolean operators
	| "is-checked"
	| "is-not-checked"
	// Numeric operators
	| "is-greater-than"
	| "is-less-than"
	| "is-greater-than-or-equal"
	| "is-less-than-or-equal";

// Property metadata for UI generation
export interface PropertyDefinition {
	id: FilterProperty;
	label: string;
	category: "text" | "select" | "date" | "boolean" | "numeric" | "special";
	supportedOperators: FilterOperator[];
	valueInputType: "text" | "select" | "multi-select" | "date" | "number" | "none";
}

// Predefined property definitions
export const FILTER_PROPERTIES: PropertyDefinition[] = [
	// Text properties
	{
		id: "title",
		label: "Title",
		category: "text",
		supportedOperators: [
			"is",
			"is-not",
			"contains",
			"does-not-contain",
			"is-empty",
			"is-not-empty",
		],
		valueInputType: "text",
	},
	{
		id: "path",
		label: "Path",
		category: "select",
		supportedOperators: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
		valueInputType: "select",
	},

	// Select properties
	{
		id: "status",
		label: "Status",
		category: "select",
		supportedOperators: ["is", "is-not", "is-empty", "is-not-empty"],
		valueInputType: "select",
	},
	{
		id: "priority",
		label: "Priority",
		category: "select",
		supportedOperators: ["is", "is-not", "is-empty", "is-not-empty"],
		valueInputType: "select",
	},
	{
		id: "tags",
		label: "Tags",
		category: "select",
		supportedOperators: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
		valueInputType: "select",
	},
	{
		id: "contexts",
		label: "Contexts",
		category: "select",
		supportedOperators: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
		valueInputType: "select",
	},
	{
		id: "projects",
		label: "Projects",
		category: "select",
		supportedOperators: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
		valueInputType: "select",
	},
	{
		id: "blockedBy",
		label: "Blocked By",
		category: "select",
		supportedOperators: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
		valueInputType: "text",
	},
	{
		id: "blocking",
		label: "Blocking",
		category: "select",
		supportedOperators: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
		valueInputType: "text",
	},

	// Date properties
	{
		id: "due",
		label: "Due Date",
		category: "date",
		supportedOperators: [
			"is",
			"is-not",
			"is-before",
			"is-after",
			"is-on-or-before",
			"is-on-or-after",
			"is-empty",
			"is-not-empty",
		],
		valueInputType: "date",
	},
	{
		id: "scheduled",
		label: "Scheduled Date",
		category: "date",
		supportedOperators: [
			"is",
			"is-not",
			"is-before",
			"is-after",
			"is-on-or-before",
			"is-on-or-after",
			"is-empty",
			"is-not-empty",
		],
		valueInputType: "date",
	},
	{
		id: "completedDate",
		label: "Completed Date",
		category: "date",
		supportedOperators: [
			"is",
			"is-not",
			"is-before",
			"is-after",
			"is-on-or-before",
			"is-on-or-after",
			"is-empty",
			"is-not-empty",
		],
		valueInputType: "date",
	},
	{
		id: "dateCreated",
		label: "Created Date",
		category: "date",
		supportedOperators: [
			"is",
			"is-not",
			"is-before",
			"is-after",
			"is-on-or-before",
			"is-on-or-after",
			"is-empty",
			"is-not-empty",
		],
		valueInputType: "date",
	},
	{
		id: "dateModified",
		label: "Modified Date",
		category: "date",
		supportedOperators: [
			"is",
			"is-not",
			"is-before",
			"is-after",
			"is-on-or-before",
			"is-on-or-after",
			"is-empty",
			"is-not-empty",
		],
		valueInputType: "date",
	},

	// Boolean properties
	{
		id: "archived",
		label: "Archived",
		category: "boolean",
		supportedOperators: ["is-checked", "is-not-checked"],
		valueInputType: "none",
	},

	// Numeric properties
	{
		id: "timeEstimate",
		label: "Time Estimate",
		category: "numeric",
		supportedOperators: [
			"is",
			"is-not",
			"is-greater-than",
			"is-less-than",
			"is-greater-than-or-equal",
			"is-less-than-or-equal",
		],
		valueInputType: "number",
	},

	// Special properties
	{
		id: "recurrence",
		label: "Recurrence",
		category: "special",
		supportedOperators: ["is-empty", "is-not-empty"],
		valueInputType: "none",
	},
	{
		id: "status.isCompleted",
		label: "Completed",
		category: "boolean",
		supportedOperators: ["is-checked", "is-not-checked"],
		valueInputType: "none",
	},
	{
		id: "dependencies.isBlocked",
		label: "Blocked",
		category: "boolean",
		supportedOperators: ["is-checked", "is-not-checked"],
		valueInputType: "none",
	},
	{
		id: "dependencies.isBlocking",
		label: "Blocking Others",
		category: "boolean",
		supportedOperators: ["is-checked", "is-not-checked"],
		valueInputType: "none",
	},
];

// Operator metadata for UI generation
export interface OperatorDefinition {
	id: FilterOperator;
	label: string;
	requiresValue: boolean;
}

// Predefined operator definitions
export const FILTER_OPERATORS: OperatorDefinition[] = [
	{ id: "is", label: "is", requiresValue: true },
	{ id: "is-not", label: "is not", requiresValue: true },
	{ id: "contains", label: "contains", requiresValue: true },
	{ id: "does-not-contain", label: "does not contain", requiresValue: true },
	{ id: "is-before", label: "is before", requiresValue: true },
	{ id: "is-after", label: "is after", requiresValue: true },
	{ id: "is-on-or-before", label: "is on or before", requiresValue: true },
	{ id: "is-on-or-after", label: "is on or after", requiresValue: true },
	{ id: "is-empty", label: "is empty", requiresValue: false },
	{ id: "is-not-empty", label: "is not empty", requiresValue: false },
	{ id: "is-checked", label: "is checked", requiresValue: false },
	{ id: "is-not-checked", label: "is not checked", requiresValue: false },
	{ id: "is-greater-than", label: "is greater than", requiresValue: true },
	{ id: "is-less-than", label: "is less than", requiresValue: true },
	{ id: "is-greater-than-or-equal", label: "is equal or greater than", requiresValue: true },
	{ id: "is-less-than-or-equal", label: "is equal or less than", requiresValue: true },
];

export interface FilterOptions {
	statuses: readonly StatusConfig[];
	priorities: readonly PriorityConfig[];
	contexts: readonly string[];
	projects: readonly string[];
	tags: readonly string[];
	folders: readonly string[];
	// Dynamic user-defined properties built from settings.userFields
	userProperties?: readonly PropertyDefinition[];
}

// Time and date related types
export interface TimeInfo {
	hours: number;
	minutes: number;
}

// Task types
export type TaskDependencyRelType =
	| "FINISHTOSTART"
	| "FINISHTOFINISH"
	| "STARTTOSTART"
	| "STARTTOFINISH";

export interface TaskDependency {
	uid: string; // Identifier for the blocking task (typically an Obsidian link)
	reltype: TaskDependencyRelType; // Relationship type per RFC 9253 terminology
	gap?: string; // Optional ISO 8601 duration offset between tasks
}

export interface TaskInfo {
	id?: string; // Task identifier (typically same as path for API consistency)
	title: string;
	status: string;
	priority: string;
	due?: string;
	scheduled?: string; // Date (YYYY-MM-DD) when task is scheduled to be worked on
	path: string;
	archived: boolean;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	recurrence?: string; // RFC 5545 recurrence rule string
	recurrence_anchor?: 'scheduled' | 'completion'; // Determines if recurrence is from scheduled date (fixed) or completion date (flexible). Defaults to 'scheduled'
	complete_instances?: string[]; // Array of dates (YYYY-MM-DD) when recurring task was completed
	skipped_instances?: string[]; // Array of dates (YYYY-MM-DD) when recurring task was skipped
	completedDate?: string; // Date (YYYY-MM-DD) when task was marked as done
	timeEstimate?: number; // Estimated time in minutes
	timeEntries?: TimeEntry[]; // Individual time tracking sessions
	totalTrackedTime?: number; // Total tracked time in minutes (calculated from timeEntries)
	dateCreated?: string; // Creation date (ISO timestamp)
	dateModified?: string; // Last modification date (ISO timestamp)
	icsEventId?: string[]; // Links to ICS calendar event IDs
	googleCalendarEventId?: string; // Google Calendar event ID for sync
	reminders?: Reminder[]; // Task reminders
	customProperties?: Record<string, any>; // Custom properties from Bases or other sources
	basesData?: any; // Raw Bases data for formula computation (internal use)
	blockedBy?: TaskDependency[]; // Dependencies that must be satisfied before this task can start
	blocking?: string[]; // Task paths that this task is blocking
	isBlocked?: boolean; // True if any blocking dependency is incomplete
	isBlocking?: boolean; // True if this task blocks at least one other task
	details?: string; // Optional task body content
}

export interface TaskCreationData extends Partial<TaskInfo> {
	details?: string; // Optional details/description for file content
	parentNote?: string; // Optional parent note name/path for template variable
	creationContext?: "inline-conversion" | "manual-creation" | "modal-inline-creation" | "api" | "import" | "ics-event"; // Context for folder determination
	customFrontmatter?: Record<string, any>; // Custom frontmatter properties (including user fields)
}

export interface TimeEntry {
	startTime: string; // ISO timestamp
	endTime?: string; // ISO timestamp, undefined if currently running
	description?: string; // Optional description of what was worked on
	duration?: number; // Duration in minutes (calculated or manually set)
}

// Reminder types
export interface Reminder {
	id: string; // A unique ID for UI keying, e.g., 'rem_1678886400000'
	type: "absolute" | "relative";

	// For relative reminders
	relatedTo?: "due" | "scheduled"; // The anchor date property
	offset?: string; // ISO 8601 duration format, e.g., "-PT5M", "-PT1H", "-P2D"

	// For absolute reminders
	absoluteTime?: string; // Full ISO 8601 timestamp, e.g., "2025-10-26T09:00:00"

	// Common properties
	description?: string; // The notification message (optional, can be auto-generated)
}

// Timeblocking types
export interface TimeBlock {
	id: string; // Unique identifier for the timeblock
	title: string; // Display title for the timeblock
	startTime: string; // Start time in HH:MM format
	endTime: string; // End time in HH:MM format
	attachments?: string[]; // Optional array of markdown links to tasks/notes
	color?: string; // Optional hex color for display
	description?: string; // Optional description
}

// Note types
export interface NoteInfo {
	title: string;
	tags: string[];
	path: string;
	createdDate?: string;
	lastModified?: number; // Timestamp of last modification
}

// File index types
export interface FileIndex {
	taskFiles: IndexedFile[];
	noteFiles: IndexedFile[];
	lastIndexed: number;
}

export interface IndexedFile {
	path: string;
	mtime: number;
	ctime: number;
	tags?: string[];
	isTask?: boolean;
	cachedInfo?: TaskInfo | NoteInfo;
}

// YAML Frontmatter types
export interface TaskFrontmatter {
	title: string;
	dateCreated: string;
	dateModified: string;
	status: "open" | "in-progress" | "done";
	due?: string;
	scheduled?: string;
	tags: string[];
	priority: "low" | "normal" | "high";
	contexts?: string[];
	projects?: string[];
	recurrence?: string; // RFC 5545 recurrence rule string
	complete_instances?: string[];
	completedDate?: string;
	timeEstimate?: number;
	timeEntries?: TimeEntry[];
}

export interface NoteFrontmatter {
	title: string;
	dateCreated: string;
	dateModified?: string;
	tags?: string[];
}

export interface DailyNoteFrontmatter {
	title?: string;
	dateCreated?: string;
	dateModified?: string;
	tags?: string[];
	timeblocks?: TimeBlock[]; // Timeblocks for the day
}

// Event handler types
export interface FileEventHandlers {
	modify?: (file: any) => void;
	delete?: (file: any) => void;
	rename?: (file: any, oldPath: string) => void;
	create?: (file: any) => void;
}

// Pomodoro types
export interface PomodoroTimePeriod {
	startTime: string; // ISO datetime when active period started
	endTime?: string; // ISO datetime when active period ended (undefined if currently active)
}

export interface PomodoroSession {
	id: string;
	taskPath?: string; // optional, can run timer without task
	startTime: string; // ISO datetime when session was first created
	endTime?: string; // ISO datetime when session completed/interrupted
	plannedDuration: number; // planned duration in minutes
	type: "work" | "short-break" | "long-break";
	completed: boolean;
	interrupted?: boolean;
	activePeriods: PomodoroTimePeriod[]; // Array of active timing periods (excludes pauses)
}

export interface PomodoroState {
	isRunning: boolean;
	currentSession?: PomodoroSession;
	timeRemaining: number; // seconds
	nextSessionType?: "work" | "short-break" | "long-break"; // What type of session to start next when no current session
}

export interface PomodoroSessionHistory {
	id: string;
	startTime: string; // ISO datetime when session was created
	endTime: string; // ISO datetime when session completed/interrupted
	plannedDuration: number; // originally planned duration in minutes
	type: "work" | "short-break" | "long-break";
	taskPath?: string; // optional task association
	completed: boolean; // true if session finished normally, false if interrupted
	activePeriods: PomodoroTimePeriod[]; // Array of active timing periods (excludes pauses)
}

export interface PomodoroHistoryStats {
	pomodorosCompleted: number;
	currentStreak: number;
	totalMinutes: number;
	averageSessionLength: number;
	completionRate: number; // percentage of sessions completed vs interrupted
}

// Field mapping and customization types

/**
 * Property Naming Concepts
 *
 * The codebase uses three related but distinct property naming concepts:
 *
 * 1. FrontmatterPropertyName: The actual property name in YAML frontmatter
 *    Examples: "complete_instances", "due", "status", "my_custom_field"
 *    Source: FieldMapping values (e.g., mapping.completeInstances = "complete_instances")
 *
 * 2. FieldMappingKey: The key in the FieldMapping configuration object
 *    Examples: "completeInstances", "due", "status"
 *    Source: FieldMapping keys (keyof FieldMapping)
 *
 * 3. TaskCardPropertyId: The property identifier used by TaskCard extractors/renderers
 *    Examples: "complete_instances", "totalTrackedTime", "due"
 *    Notes: Usually matches FrontmatterPropertyName, but may differ for computed properties
 *           (e.g., "totalTrackedTime" is the display property for "timeEntries" data)
 *
 * Key Insight: FieldMappingKey and FrontmatterPropertyName are often DIFFERENT
 * (e.g., key="completeInstances" -> value="complete_instances")
 * This distinction is critical for proper property mapping throughout the system.
 */

/** Property name as it appears in YAML frontmatter (e.g., "complete_instances", "due") */
export type FrontmatterPropertyName = string;

/** Key in the FieldMapping configuration object (e.g., "completeInstances", "due") */
export type FieldMappingKey = keyof FieldMapping;

/** Property identifier for TaskCard extractors/renderers (e.g., "complete_instances", "totalTrackedTime") */
export type TaskCardPropertyId = string;

export interface FieldMapping {
	title: string;
	status: string;
	priority: string;
	due: string;
	scheduled: string;
	contexts: string;
	projects: string;
	timeEstimate: string;
	completedDate: string;
	dateCreated: string;
	dateModified: string;
	recurrence: string; // RFC 5545 recurrence rule string
	recurrenceAnchor: string; // User-configurable property name for recurrence_anchor field
	archiveTag: string; // For the archive tag in the tags array
	timeEntries: string;
	completeInstances: string;
	skippedInstances: string; // User-configurable property name for skipped instances
	blockedBy: string;
	pomodoros: string; // For daily note pomodoro tracking
	icsEventId: string; // For linking to ICS calendar events (stored as array in frontmatter)
	icsEventTag: string; // Tag used for ICS event-related content
	googleCalendarEventId: string; // For Google Calendar sync (stores event ID)
	reminders: string; // For task reminders
}

export interface StatusConfig {
	id: string; // Unique identifier
	value: string; // What gets written to YAML
	label: string; // What displays in UI
	color: string; // Hex color for UI elements
	icon?: string; // Optional Lucide icon name (e.g., "circle", "check", "clock")
	isCompleted: boolean; // Whether this counts as "done"
	order: number; // Sort order (for cycling)
	autoArchive: boolean; // Whether to auto-archive tasks with this status
	autoArchiveDelay: number; // Minutes to wait before auto-archiving
}

export interface PriorityConfig {
	id: string; // Unique identifier
	value: string; // What gets written to YAML
	label: string; // What displays in UI
	color: string; // Hex color for indicators
	weight: number; // For sorting (higher = more important)
}

// Template configuration for quick setup
export interface Template {
	id: string;
	name: string;
	description: string;
	config: {
		fieldMapping: Partial<FieldMapping>;
		customStatuses: StatusConfig[];
		customPriorities: PriorityConfig[];
	};
}

// Configuration export/import
export interface ExportedConfig {
	version: string;
	fieldMapping: FieldMapping;
	customStatuses: StatusConfig[];
	customPriorities: PriorityConfig[];
}

// Kanban board types
export type KanbanGroupByField = "status" | "priority" | "context";

export interface KanbanBoardConfig {
	id: string; // Unique ID
	name: string; // User-facing name
	groupByField: KanbanGroupByField; // What to group tasks by
	columnOrder: string[]; // Order of column values
}

// UI state management for filter preferences
export interface ViewFilterState {
	[viewType: string]: FilterQuery;
}

// Calendar view preferences for Advanced Calendar
export interface CalendarViewPreferences {
	showScheduled: boolean;
	showDue: boolean;
	showTimeEntries: boolean;
	showRecurring: boolean;
	showICSEvents: boolean;
	showTimeblocks?: boolean;
	headerCollapsed?: boolean;
	showAllDaySlot?: boolean;
}

// All view-specific preferences
export interface ViewPreferences {
	[viewType: string]: any; // Can be CalendarViewPreferences or other view-specific types
}

// ICS Subscription types
export interface ICSSubscription {
	id: string;
	name: string;
	url?: string; // Optional for local files
	filePath?: string; // Path to local ICS file
	type: "remote" | "local"; // Type of ICS source
	color: string;
	enabled: boolean;
	refreshInterval: number; // minutes (for remote) or check interval (for local)
}

export interface ICSEvent {
	id: string;
	subscriptionId: string;
	title: string;
	description?: string;
	start: string; // ISO timestamp
	end?: string; // ISO timestamp
	allDay: boolean;
	location?: string;
	url?: string;
	rrule?: string; // Recurrence rule
	color?: string; // Hex color code (e.g., "#4285F4")
}

export interface ICSCache {
	subscriptionId: string;
	events: ICSEvent[];
	lastUpdated: string; // ISO timestamp
	expires: string; // ISO timestamp
}

// Webhook types
export type WebhookEvent =
	| "task.created"
	| "task.updated"
	| "task.deleted"
	| "task.completed"
	| "task.archived"
	| "task.unarchived"
	| "time.started"
	| "time.stopped"
	| "pomodoro.started"
	| "pomodoro.completed"
	| "pomodoro.interrupted"
	| "recurring.instance.completed"
	| "recurring.instance.skipped"
	| "reminder.triggered";

export interface WebhookConfig {
	id: string;
	url: string;
	events: WebhookEvent[];
	secret: string;
	active: boolean;
	createdAt: string;
	lastTriggered?: string;
	failureCount: number;
	successCount: number;
	transformFile?: string; // Optional path to transformation file (.js or .json)
	corsHeaders?: boolean; // Whether to include custom headers (false for Discord, Slack, etc.)
}

export interface WebhookPayload {
	event: WebhookEvent;
	timestamp: string;
	vault: {
		name: string;
		path?: string;
	};
	data: any;
}

export interface WebhookDelivery {
	id: string;
	webhookId: string;
	event: WebhookEvent;
	payload: WebhookPayload;
	status: "pending" | "success" | "failed";
	attempts: number;
	lastAttempt?: string;
	responseStatus?: number;
	error?: string;
}

// Auto-archive types
export interface PendingAutoArchive {
	taskPath: string;
	statusChangeTimestamp: number;
	archiveAfterTimestamp: number;
	statusValue: string;
}

// Webhook notification interface for loose coupling
export interface IWebhookNotifier {
	triggerWebhook(event: WebhookEvent, data: any): Promise<void>;
}

// OAuth types
export type OAuthProvider = "google" | "microsoft";

export interface OAuthTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: number; // Unix timestamp in milliseconds
	scope: string;
	tokenType: string;
}

export interface OAuthConnection {
	provider: OAuthProvider;
	tokens: OAuthTokens;
	userEmail?: string; // Optional user identifier
	connectedAt: string; // ISO timestamp
	lastRefreshed?: string; // ISO timestamp
}

export interface OAuthConfig {
	provider: OAuthProvider;
	clientId: string;
	clientSecret?: string; // Not needed for Device Flow, optional for standard flow
	redirectUri: string;
	scope: string[];
	authorizationEndpoint: string;
	tokenEndpoint: string;
	deviceCodeEndpoint?: string; // For OAuth Device Flow (RFC 8628)
	revocationEndpoint?: string; // For revoking tokens on disconnect
}

// Google Calendar types
export interface GoogleCalendarEvent {
	id: string;
	summary: string;
	description?: string;
	start: {
		dateTime?: string; // ISO timestamp for timed events
		date?: string; // YYYY-MM-DD for all-day events
		timeZone?: string;
	};
	end: {
		dateTime?: string;
		date?: string;
		timeZone?: string;
	};
	location?: string;
	attendees?: Array<{
		email: string;
		displayName?: string;
		responseStatus?: string;
	}>;
	htmlLink?: string;
	recurrence?: string[]; // RRULE strings
	colorId?: string; // Google Calendar color ID (1-11)
	status?: string; // Event status: "confirmed", "tentative", or "cancelled"
}

export interface GoogleCalendar {
	id: string;
	summary: string;
	description?: string;
	backgroundColor?: string;
	primary?: boolean;
}
