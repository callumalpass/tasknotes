// View types
export const MINI_CALENDAR_VIEW_TYPE = 'tasknotes-mini-calendar-view';
export const ADVANCED_CALENDAR_VIEW_TYPE = 'tasknotes-advanced-calendar-view';
export const TASK_LIST_VIEW_TYPE = 'tasknotes-task-list-view';
export const NOTES_VIEW_TYPE = 'tasknotes-notes-view';
export const AGENDA_VIEW_TYPE = 'tasknotes-agenda-view';
export const POMODORO_VIEW_TYPE = 'tasknotes-pomodoro-view';
export const POMODORO_STATS_VIEW_TYPE = 'tasknotes-pomodoro-stats-view';
export const KANBAN_VIEW_TYPE = 'tasknotes-kanban-view';

// Event types
export const EVENT_DATE_SELECTED = 'date-selected';
export const EVENT_TAB_CHANGED = 'tab-changed';
export const EVENT_DATA_CHANGED = 'data-changed';
export const EVENT_TASK_UPDATED = 'task-updated';
export const EVENT_TASK_DELETED = 'task-deleted';
export const EVENT_POMODORO_START = 'pomodoro-start';
export const EVENT_POMODORO_COMPLETE = 'pomodoro-complete';
export const EVENT_POMODORO_INTERRUPT = 'pomodoro-interrupt';
export const EVENT_POMODORO_TICK = 'pomodoro-tick';
export const EVENT_TIMEBLOCKING_TOGGLED = 'timeblocking-toggled';
export const EVENT_TIMEBLOCK_UPDATED = 'timeblock-updated';
export const EVENT_TIMEBLOCK_DELETED = 'timeblock-deleted';

// Calendar colorization modes
export type ColorizeMode = 'tasks' | 'notes' | 'daily';

// Calendar display modes
export type CalendarDisplayMode = 'month' | 'agenda';

// Task sorting and grouping types
export type TaskSortKey = 'due' | 'scheduled' | 'priority' | 'title';
export type TaskGroupKey = 'none' | 'priority' | 'context' | 'due' | 'scheduled' | 'status';
export type SortDirection = 'asc' | 'desc';

// Unified filtering system types
export interface FilterQuery {
	// Filtering
	searchQuery?: string;
	statuses?: string[]; // Multiple status selection support
	contexts?: string[];
	priorities?: string[];
	dateRange?: {
		start: string; // YYYY-MM-DD
		end: string;   // YYYY-MM-DD
	};
	includeOverdue?: boolean; // Include overdue tasks in addition to date range
	showArchived: boolean;
	
	// Sorting
	sortKey: TaskSortKey;
	sortDirection: SortDirection;

	// Grouping
	groupKey: TaskGroupKey;
}

export interface FilterBarConfig {
	showSearch?: boolean;
	showGroupBy?: boolean;
	showSortBy?: boolean;
	showAdvancedFilters?: boolean;
	showDateRangePicker?: boolean;
	allowedSortKeys?: TaskSortKey[];
	allowedGroupKeys?: TaskGroupKey[];
}

// Time and date related types
export interface TimeInfo {
	hours: number;
	minutes: number;
}

// Task types
/**
 * @deprecated Use rrule string instead. This interface will be removed in a future version.
 */
export interface RecurrenceInfo {
	frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
	days_of_week?: string[];  // For weekly recurrence: ['mon', 'tue', etc.]
	day_of_month?: number;    // For monthly/yearly recurrence: 1-31
	month_of_year?: number;   // For yearly recurrence: 1-12
}

export interface TaskInfo {
	title: string;
	status: string;
	priority: string;
	due?: string;
	scheduled?: string; // Date (YYYY-MM-DD) when task is scheduled to be worked on
	path: string;
	archived: boolean;
	tags?: string[];
	contexts?: string[];
	recurrence?: string | RecurrenceInfo | undefined; // RFC 5545 recurrence rule string or legacy RecurrenceInfo object
	complete_instances?: string[]; // Array of dates (YYYY-MM-DD) when recurring task was completed
	completedDate?: string; // Date (YYYY-MM-DD) when task was marked as done
	timeEstimate?: number; // Estimated time in minutes
	timeEntries?: TimeEntry[]; // Individual time tracking sessions
	dateCreated?: string; // Creation date (ISO timestamp)
	dateModified?: string; // Last modification date (ISO timestamp)
}

export interface TaskCreationData extends Partial<TaskInfo> {
    details?: string; // Optional details/description for file content
    parentNote?: string; // Optional parent note name/path for template variable
}

export interface TimeEntry {
	startTime: string; // ISO timestamp
	endTime?: string; // ISO timestamp, undefined if currently running
	description?: string; // Optional description of what was worked on
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
	status: 'open' | 'in-progress' | 'done';
	due?: string;
	scheduled?: string;
	tags: string[];
	priority: 'low' | 'normal' | 'high';
	contexts?: string[];
	recurrence?: string | RecurrenceInfo | undefined; // RFC 5545 recurrence rule string or legacy RecurrenceInfo object
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
	type: 'work' | 'short-break' | 'long-break';
	completed: boolean;
	interrupted?: boolean;
	activePeriods: PomodoroTimePeriod[]; // Array of active timing periods (excludes pauses)
}

export interface PomodoroState {
	isRunning: boolean;
	currentSession?: PomodoroSession;
	timeRemaining: number; // seconds
}

export interface PomodoroSessionHistory {
	id: string;
	startTime: string; // ISO datetime when session was created
	endTime: string; // ISO datetime when session completed/interrupted
	plannedDuration: number; // originally planned duration in minutes
	type: 'work' | 'short-break' | 'long-break';
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
export interface FieldMapping {
	title: string;
	status: string;
	priority: string;
	due: string;
	scheduled: string;
	contexts: string;
	timeEstimate: string;
	completedDate: string;
	dateCreated: string;
	dateModified: string;
	recurrence: string;  // RFC 5545 recurrence rule string or legacy RecurrenceInfo object
	archiveTag: string;  // For the archive tag in the tags array
	timeEntries: string;
	completeInstances: string;
	pomodoros: string;  // For daily note pomodoro tracking
}

export interface StatusConfig {
	id: string;           // Unique identifier
	value: string;        // What gets written to YAML
	label: string;        // What displays in UI
	color: string;        // Hex color for UI elements
	isCompleted: boolean; // Whether this counts as "done"
	order: number;        // Sort order (for cycling)
}

export interface PriorityConfig {
	id: string;          // Unique identifier
	value: string;       // What gets written to YAML
	label: string;       // What displays in UI
	color: string;       // Hex color for indicators
	weight: number;      // For sorting (higher = more important)
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
export type KanbanGroupByField = 'status' | 'priority' | 'context';

export interface KanbanBoardConfig {
	id: string;                          // Unique ID
	name: string;                        // User-facing name
	groupByField: KanbanGroupByField;    // What to group tasks by
	columnOrder: string[];               // Order of column values
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
	type: 'remote' | 'local'; // Type of ICS source
	color: string;
	enabled: boolean;
	refreshInterval: number; // minutes (for remote) or check interval (for local)
	lastFetched?: string; // ISO timestamp
	lastError?: string;
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
}

export interface ICSCache {
	subscriptionId: string;
	events: ICSEvent[];
	lastUpdated: string; // ISO timestamp
	expires: string; // ISO timestamp
}

