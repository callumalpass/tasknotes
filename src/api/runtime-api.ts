import type { EventRef } from "obsidian";
import type {
	Reminder,
	PriorityConfig,
	StatusConfig,
	TaskCreationData,
	TaskDependency,
	TaskInfo,
	TaskNotesModelConfig,
	TaskValidationResult,
	TimeEntry,
	UserMappedField,
} from "@tasknotes/model";
import type { ParsedTaskData } from "../services/NaturalLanguageParser";
import type {
	FilterOptions,
	PomodoroHistoryStats,
	PomodoroSessionHistory,
	PomodoroState,
	WebhookEvent,
} from "../types";
import type { TaskNotesSettings } from "../types/settings";

export type {
	Reminder,
	PriorityConfig,
	StatusConfig,
	TaskCreationData,
	TaskDependency,
	TaskInfo,
	TaskNotesModelConfig,
	TaskValidationIssue,
	TaskValidationResult,
	TimeEntry,
	UserMappedField,
} from "@tasknotes/model";

export const TASKNOTES_RUNTIME_API_VERSION = 1 as const;

export const TASKNOTES_RUNTIME_API_CAPABILITIES = [
	"model.read",
	"model.validate",
	"catalog.read",
	"extensions.read",
	"extensions.register",
	"tasks.read",
	"tasks.write",
	"tasks.delete",
	"tasks.move",
	"tasks.events",
	"relationships.read",
	"events.list",
	"time.read",
	"time.write",
	"time.summary",
	"pomodoro.read",
	"pomodoro.write",
	"pomodoro.events",
	"recurring.write",
	"recurring.materialize",
	"recurring.events",
	"settings.snapshot",
	"bases.write",
	"nlp.parse",
	"query.tasks",
	"query.validate",
	"query.explain",
	"query.filter-options",
	"stats.tasks",
	"system.health",
	"lifecycle.events",
	"errors.typed",
] as const;

export type TaskNotesRuntimeApiVersion = typeof TASKNOTES_RUNTIME_API_VERSION;
export type TaskNotesRuntimeCoreCapability = (typeof TASKNOTES_RUNTIME_API_CAPABILITIES)[number];
export type TaskNotesRuntimeApiCapability = TaskNotesRuntimeCoreCapability | (string & {});

export type TaskNotesTaskEventName =
	| "task.created"
	| "task.updated"
	| "task.deleted"
	| "task.moved"
	| "task.status.changed"
	| "task.completed"
	| "task.uncompleted"
	| "task.archived"
	| "task.unarchived"
	| "task.scheduled.changed"
	| "task.due.changed"
	| "task.priority.changed"
	| "task.tags.changed"
	| "task.contexts.changed"
	| "task.projects.changed"
	| "task.reminders.changed"
	| "task.dependencies.changed"
	| "task.recurrence.changed";

export type TaskNotesRuntimeEventName = TaskNotesTaskEventName | WebhookEvent;

export type TaskNotesRuntimeEventCategory = "task" | "time" | "pomodoro" | "recurring";

export interface TaskNotesRuntimeEventDefinition {
	name: TaskNotesRuntimeEventName;
	label: string;
	description: string;
	category: TaskNotesRuntimeEventCategory;
}

export const TASKNOTES_RUNTIME_EVENT_DEFINITIONS: readonly TaskNotesRuntimeEventDefinition[] = [
	{
		name: "task.created",
		label: "Task created",
		description: "A TaskNotes task was created.",
		category: "task",
	},
	{
		name: "task.updated",
		label: "Task updated",
		description: "Any tracked TaskNotes task property changed.",
		category: "task",
	},
	{
		name: "task.deleted",
		label: "Task deleted",
		description: "A TaskNotes task was deleted.",
		category: "task",
	},
	{
		name: "task.moved",
		label: "Task moved",
		description: "A TaskNotes task note moved to a new path.",
		category: "task",
	},
	{
		name: "task.status.changed",
		label: "Task status changed",
		description: "A TaskNotes task status changed.",
		category: "task",
	},
	{
		name: "task.completed",
		label: "Task completed",
		description: "A TaskNotes task moved into a completed status.",
		category: "task",
	},
	{
		name: "task.uncompleted",
		label: "Task uncompleted",
		description: "A TaskNotes task moved out of a completed status.",
		category: "task",
	},
	{
		name: "task.archived",
		label: "Task archived",
		description: "A TaskNotes task was archived.",
		category: "task",
	},
	{
		name: "task.unarchived",
		label: "Task unarchived",
		description: "A TaskNotes task was unarchived.",
		category: "task",
	},
	{
		name: "task.scheduled.changed",
		label: "Task scheduled date changed",
		description: "A TaskNotes task scheduled date changed.",
		category: "task",
	},
	{
		name: "task.due.changed",
		label: "Task due date changed",
		description: "A TaskNotes task due date changed.",
		category: "task",
	},
	{
		name: "task.priority.changed",
		label: "Task priority changed",
		description: "A TaskNotes task priority changed.",
		category: "task",
	},
	{
		name: "task.tags.changed",
		label: "Task tags changed",
		description: "A TaskNotes task tag list changed.",
		category: "task",
	},
	{
		name: "task.contexts.changed",
		label: "Task contexts changed",
		description: "A TaskNotes task context list changed.",
		category: "task",
	},
	{
		name: "task.projects.changed",
		label: "Task projects changed",
		description: "A TaskNotes task project list changed.",
		category: "task",
	},
	{
		name: "task.reminders.changed",
		label: "Task reminders changed",
		description: "A TaskNotes task reminder list changed.",
		category: "task",
	},
	{
		name: "task.dependencies.changed",
		label: "Task dependencies changed",
		description: "A TaskNotes task dependency list changed.",
		category: "task",
	},
	{
		name: "task.recurrence.changed",
		label: "Task recurrence changed",
		description: "A TaskNotes task recurrence rule changed.",
		category: "task",
	},
	{
		name: "time.started",
		label: "Time tracking started",
		description: "A time entry started on a TaskNotes task.",
		category: "time",
	},
	{
		name: "time.stopped",
		label: "Time tracking stopped",
		description: "A time entry stopped on a TaskNotes task.",
		category: "time",
	},
	{
		name: "pomodoro.started",
		label: "Pomodoro started",
		description: "A Pomodoro session started.",
		category: "pomodoro",
	},
	{
		name: "pomodoro.completed",
		label: "Pomodoro completed",
		description: "A Pomodoro session completed.",
		category: "pomodoro",
	},
	{
		name: "pomodoro.interrupted",
		label: "Pomodoro interrupted",
		description: "A Pomodoro session was interrupted.",
		category: "pomodoro",
	},
	{
		name: "recurring.instance.completed",
		label: "Recurring instance completed",
		description: "A recurring task instance was completed.",
		category: "recurring",
	},
	{
		name: "recurring.instance.skipped",
		label: "Recurring instance skipped",
		description: "A recurring task instance was skipped.",
		category: "recurring",
	},
] as const;

export type TaskNotesRuntimeLifecycleEventName =
	| "ready"
	| "layout.ready"
	| "settings.changed"
	| "cache.changed"
	| "cache.rebuilt"
	| "extension.registered"
	| "extension.unregistered"
	| "unloading";

export const TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS = {
	ready: "tasknotes:runtime.ready",
	"layout.ready": "tasknotes:runtime.layout-ready",
	"settings.changed": "settings-changed",
	"cache.changed": "tasknotes:cache.changed",
	"cache.rebuilt": "tasknotes:cache.rebuilt",
	"extension.registered": "tasknotes:extension.registered",
	"extension.unregistered": "tasknotes:extension.unregistered",
	unloading: "tasknotes:runtime.unloading",
} as const satisfies Record<TaskNotesRuntimeLifecycleEventName, string>;

export type TaskNotesRuntimeLifecycleEventCategory = "runtime" | "settings" | "cache" | "extension";

export interface TaskNotesRuntimeLifecycleEventDefinition {
	name: TaskNotesRuntimeLifecycleEventName;
	label: string;
	description: string;
	category: TaskNotesRuntimeLifecycleEventCategory;
}

export const TASKNOTES_RUNTIME_LIFECYCLE_EVENT_DEFINITIONS: readonly TaskNotesRuntimeLifecycleEventDefinition[] =
	[
		{
			name: "ready",
			label: "Runtime ready",
			description: "TaskNotes loaded its runtime API.",
			category: "runtime",
		},
		{
			name: "layout.ready",
			label: "Layout ready",
			description: "TaskNotes completed post-layout initialization.",
			category: "runtime",
		},
		{
			name: "settings.changed",
			label: "Settings changed",
			description: "TaskNotes settings were saved or reloaded.",
			category: "settings",
		},
		{
			name: "cache.changed",
			label: "Cache changed",
			description: "TaskNotes task data changed or was invalidated.",
			category: "cache",
		},
		{
			name: "cache.rebuilt",
			label: "Cache rebuilt",
			description: "TaskNotes cache was explicitly rebuilt.",
			category: "cache",
		},
		{
			name: "extension.registered",
			label: "Extension registered",
			description: "A companion plugin registered a runtime API extension namespace.",
			category: "extension",
		},
		{
			name: "extension.unregistered",
			label: "Extension unregistered",
			description: "A companion plugin unregistered a runtime API extension namespace.",
			category: "extension",
		},
		{
			name: "unloading",
			label: "Runtime unloading",
			description: "TaskNotes started unloading.",
			category: "runtime",
		},
	] as const;

export interface TaskNotesMutationContext {
	source?: string;
	correlationId?: string;
	reason?: string;
}

export const TASKNOTES_API_ERROR_CODES = [
	"invalid_input",
	"invalid_task_path",
	"invalid_status",
	"task_not_found",
	"task_file_not_found",
	"file_already_exists",
	"extension_invalid",
	"extension_namespace_reserved",
	"extension_namespace_conflict",
	"extension_not_registered",
	"operation_failed",
] as const;

export type TaskNotesApiErrorCode = (typeof TASKNOTES_API_ERROR_CODES)[number];

export interface TaskNotesApiErrorPayload {
	name: "TaskNotesApiError";
	code: TaskNotesApiErrorCode;
	message: string;
	status: number;
	details?: unknown;
}

export class TaskNotesApiError extends Error {
	readonly name = "TaskNotesApiError";
	readonly code: TaskNotesApiErrorCode;
	readonly status: number;
	readonly details?: unknown;

	constructor(
		code: TaskNotesApiErrorCode,
		message: string,
		options: { status?: number; details?: unknown; cause?: unknown } = {}
	) {
		super(message);
		this.code = code;
		this.status = options.status ?? 500;
		this.details = options.details;
		if (options.cause !== undefined) {
			(this as Error & { cause?: unknown }).cause = options.cause;
		}
	}

	toJSON(): TaskNotesApiErrorPayload {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			status: this.status,
			details: this.details,
		};
	}
}

export function isTaskNotesApiErrorPayload(error: unknown): error is TaskNotesApiErrorPayload {
	if (!error || typeof error !== "object") {
		return false;
	}

	const candidate = error as Record<string, unknown>;
	return (
		candidate.name === "TaskNotesApiError" &&
		typeof candidate.message === "string" &&
		typeof candidate.status === "number" &&
		typeof candidate.code === "string" &&
		(TASKNOTES_API_ERROR_CODES as readonly string[]).includes(candidate.code)
	);
}

export function isTaskNotesApiError(
	error: unknown
): error is TaskNotesApiError | TaskNotesApiErrorPayload {
	return error instanceof TaskNotesApiError || isTaskNotesApiErrorPayload(error);
}

export type TaskNotesApiResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: TaskNotesApiErrorPayload };

export type TaskNotesTaskPatch = Partial<TaskInfo> & {
	details?: string;
};

export interface CompleteTaskOptions {
	status?: string;
}

export interface UncompleteTaskOptions {
	status?: string;
}

export interface ActiveTimeEntry {
	taskPath: string;
	task: TaskInfo;
	entry: TimeEntry;
	index: number;
}

export interface ResolvedTaskDependency {
	dependency: TaskDependency;
	task: TaskInfo | null;
	path: string | null;
}

export interface TaskNotesTaskRelationships {
	task: TaskInfo;
	parents: TaskInfo[];
	subtasks: TaskInfo[];
	dependencies: ResolvedTaskDependency[];
	blocking: TaskInfo[];
}

export interface StartTimeEntryOptions {
	description?: string;
}

export interface TaskNotesRuntimeTimeSummaryOptions {
	period?: "today" | "week" | "month" | "all" | "custom" | (string & {});
	from?: string | Date | null;
	to?: string | Date | null;
	includeTags?: boolean;
}

export interface TaskNotesRuntimeTimeSummary {
	period: string;
	dateRange: { from: string; to: string };
	summary: {
		totalMinutes: number;
		totalHours: number;
		tasksWithTime: number;
		activeTasks: number;
		completedTasks: number;
	};
	topTasks: Array<{ task: string; title: string; minutes: number }>;
	topProjects: Array<{ project: string; minutes: number }>;
	topTags?: Array<{ tag: string; minutes: number }>;
}

export interface TaskNotesRuntimeTaskTimeData {
	task: {
		id: string;
		title: string;
		status: string;
		priority: string;
	};
	summary: {
		totalMinutes: number;
		totalHours: number;
		totalSessions: number;
		completedSessions: number;
		activeSessions: number;
		averageSessionMinutes: number;
	};
	activeSession: {
		startTime: string;
		description?: string;
		elapsedMinutes: number;
	} | null;
	timeEntries: Array<{
		startTime: string;
		endTime: string | null;
		description: string | null;
		duration: number;
		isActive: boolean;
	}>;
}

export interface PomodoroStartOptions {
	taskPath?: string;
	duration?: number;
}

export interface PomodoroSessionsOptions {
	date?: string;
	limit?: number;
}

export interface TaskNotesRuntimeModelInfo {
	packageName: "@tasknotes/model";
	specVersion: string;
	runtimeApiVersion: TaskNotesRuntimeApiVersion;
}

export interface TaskNotesRuntimeModelApi {
	info(): TaskNotesRuntimeModelInfo;
	config(): Readonly<TaskNotesModelConfig>;
	validateTask(task: Partial<TaskInfo>): TaskValidationResult;
	validatePatch(patch: TaskNotesTaskPatch): TaskValidationResult;
}

export type TaskNotesRuntimeFieldSource = "model" | "computed" | "file" | "user";
export type TaskNotesRuntimeFieldValueType =
	| "string"
	| "number"
	| "boolean"
	| "date"
	| "datetime"
	| "string[]"
	| "timeEntry[]"
	| "dependency[]"
	| "reminder[]"
	| "unknown";

export interface TaskNotesRuntimeFieldDefinition {
	id: string;
	label: string;
	valueType: TaskNotesRuntimeFieldValueType;
	source: TaskNotesRuntimeFieldSource;
	writable: boolean;
	queryable?: boolean;
	sortable?: boolean;
	groupable?: boolean;
	supportedOperators?: readonly TaskNotesRuntimeOperator[];
	aliases?: readonly string[];
	required?: boolean;
	frontmatterKey?: string;
	description?: string;
}

export const TASKNOTES_RUNTIME_QUERY_OPERATORS = [
	"eq",
	"ne",
	"contains",
	"notContains",
	"in",
	"notIn",
	"exists",
	"missing",
	"lt",
	"lte",
	"gt",
	"gte",
	"isTrue",
	"isFalse",
] as const;

export type TaskNotesRuntimeOperator = (typeof TASKNOTES_RUNTIME_QUERY_OPERATORS)[number];

export interface TaskNotesRuntimeFilterOperatorDefinition {
	id: TaskNotesRuntimeOperator;
	label: string;
	valueRequired: boolean;
	appliesTo: readonly TaskNotesRuntimeFieldValueType[];
	aliases?: readonly string[];
}

export interface TaskNotesRuntimeFilterPropertyDefinition {
	id: string;
	label: string;
	category: string;
	valueType: TaskNotesRuntimeFieldValueType;
	source: TaskNotesRuntimeFieldSource;
	queryable: boolean;
	sortable: boolean;
	groupable: boolean;
	supportedOperators: readonly TaskNotesRuntimeOperator[];
	aliases?: readonly string[];
	frontmatterKey?: string;
	valueInputType: string;
}

export interface TaskNotesRuntimeRelationshipDefinition {
	id: "parents" | "subtasks" | "dependencies" | "blocking";
	label: string;
	description: string;
}

export interface TaskNotesRuntimeDependencyRelTypeDefinition {
	value: TaskDependency["reltype"];
	label: string;
	description: string;
}

export interface TaskNotesRuntimeCatalogApi {
	statuses(): StatusConfig[];
	priorities(): PriorityConfig[];
	userFields(): UserMappedField[];
	fields(): TaskNotesRuntimeFieldDefinition[];
	writableFields(): TaskNotesRuntimeFieldDefinition[];
	filterProperties(): TaskNotesRuntimeFilterPropertyDefinition[];
	filterOperators(): TaskNotesRuntimeFilterOperatorDefinition[];
	relationships(): TaskNotesRuntimeRelationshipDefinition[];
	dependencyRelTypes(): TaskNotesRuntimeDependencyRelTypeDefinition[];
	events(): readonly TaskNotesRuntimeEventDefinition[];
}

export interface TaskNotesRuntimeExtension<TApi = unknown> {
	id: string;
	namespace: string;
	api: TApi;
	displayName?: string;
	version?: string;
	capabilities?: readonly string[];
}

export interface TaskNotesRuntimeExtensionInfo {
	id: string;
	namespace: string;
	displayName?: string;
	version?: string;
	capabilities: readonly string[];
}

export interface TaskNotesRuntimeExtensionHandle {
	readonly id: string;
	readonly namespace: string;
	unregister(): void;
}

export interface TaskNotesApiChange {
	before: unknown;
	after: unknown;
}

export type TaskNotesApiChanges = Record<string, TaskNotesApiChange>;

export interface TaskNotesRuntimeEventPayload {
	event: TaskNotesRuntimeEventName;
	timestamp: string;
	taskPath?: string;
	task?: TaskInfo;
	before?: TaskInfo;
	after?: TaskInfo;
	deletedTask?: TaskInfo;
	changes: TaskNotesApiChanges;
	data?: unknown;
	context?: TaskNotesMutationContext;
	source?: string;
	correlationId?: string;
	reason?: string;
	rawEvent: string;
}

export type TaskNotesRuntimeEventPayloadMap = {
	[EventName in TaskNotesRuntimeEventName]: TaskNotesRuntimeEventPayload & {
		event: EventName;
	};
};

export type TaskNotesRuntimeEventHandler<EventName extends TaskNotesRuntimeEventName> = (
	payload: TaskNotesRuntimeEventPayloadMap[EventName]
) => void;

export interface TaskNotesRuntimeTasksApi {
	get(path: string): Promise<TaskInfo | null>;
	list(query?: TaskNotesRuntimeTaskQuery): Promise<TaskInfo[]>;
	create(taskData: TaskCreationData, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	update(
		path: string,
		patch: TaskNotesTaskPatch,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	patch(
		path: string,
		patch: TaskNotesTaskPatch,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	delete(path: string, context?: TaskNotesMutationContext): Promise<void>;
	complete(
		path: string,
		options?: CompleteTaskOptions,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	uncomplete(
		path: string,
		options?: UncompleteTaskOptions,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	setStatus(path: string, status: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	setPriority(
		path: string,
		priority: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	setDue(path: string, date: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	clearDue(path: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	setScheduled(path: string, date: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	clearScheduled(path: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	reschedule(
		path: string,
		date: string | null,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	archive(path: string, archived: boolean, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	move(path: string, targetFolder: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	addTag(path: string, tag: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	removeTag(path: string, tag: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	addProject(
		path: string,
		project: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	removeProject(
		path: string,
		project: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	addContext(
		path: string,
		contextName: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	removeContext(
		path: string,
		contextName: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	setReminders(
		path: string,
		reminders: Reminder[],
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	addReminder(
		path: string,
		reminder: Reminder,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	removeReminder(
		path: string,
		reminderId: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	addDependency(
		path: string,
		dependency: TaskDependency,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	removeDependency(
		path: string,
		uid: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
}

export interface TaskNotesRuntimeRelationshipsApi {
	parents(path: string): Promise<TaskInfo[]>;
	subtasks(path: string): Promise<TaskInfo[]>;
	dependencies(path: string): Promise<ResolvedTaskDependency[]>;
	blocking(path: string): Promise<TaskInfo[]>;
	all(path: string): Promise<TaskNotesTaskRelationships>;
}

export interface TaskNotesRuntimeTimeApi {
	start(
		path: string,
		options?: StartTimeEntryOptions,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	stop(path: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	active(): Promise<ActiveTimeEntry[]>;
	summary(options?: TaskNotesRuntimeTimeSummaryOptions): Promise<TaskNotesRuntimeTimeSummary>;
	task(path: string): Promise<TaskNotesRuntimeTaskTimeData>;
	append(path: string, entry: TimeEntry, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	deleteEntry(
		path: string,
		entryIndex: number,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
}

export interface TaskNotesRuntimePomodoroApi {
	status(): Promise<PomodoroState>;
	start(
		options?: PomodoroStartOptions,
		context?: TaskNotesMutationContext
	): Promise<PomodoroState>;
	stop(context?: TaskNotesMutationContext): Promise<PomodoroState>;
	pause(context?: TaskNotesMutationContext): Promise<PomodoroState>;
	resume(context?: TaskNotesMutationContext): Promise<PomodoroState>;
	assignTask(path: string | null, context?: TaskNotesMutationContext): Promise<PomodoroState>;
	sessions(options?: PomodoroSessionsOptions): Promise<PomodoroSessionHistory[]>;
	stats(date?: string): Promise<PomodoroHistoryStats>;
}

export interface TaskNotesRuntimeRecurringApi {
	toggleCompleteInstance(
		path: string,
		date?: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	toggleSkippedInstance(
		path: string,
		date?: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	materializeOccurrence(
		path: string,
		date: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
}

export interface TaskNotesRuntimeEventsApi {
	on<EventName extends TaskNotesRuntimeEventName>(
		event: EventName,
		handler: TaskNotesRuntimeEventHandler<EventName>
	): EventRef;
	off(ref: EventRef): void;
	list(): readonly TaskNotesRuntimeEventDefinition[];
}

export interface TaskNotesRuntimeSettingsApi {
	snapshot(): Readonly<TaskNotesSettings>;
}

export interface TaskNotesRuntimeDefaultBasesResult {
	created: string[];
	updated: string[];
	skipped: string[];
}

export interface TaskNotesRuntimeBasesApi {
	updateDefaultFiles(): Promise<TaskNotesRuntimeDefaultBasesResult>;
}

export interface TaskNotesRuntimeNlpApi {
	parse(text: string): ParsedTaskData;
}

export interface TaskNotesRuntimeExtensionsApi {
	register<TApi>(extension: TaskNotesRuntimeExtension<TApi>): TaskNotesRuntimeExtensionHandle;
	get<TApi = unknown>(namespace: string): TApi | undefined;
	require<TApi = unknown>(namespace: string): TApi;
	has(namespace: string): boolean;
	list(): TaskNotesRuntimeExtensionInfo[];
	capabilities(): readonly string[];
}

export interface TaskNotesRuntimeLifecyclePayload {
	event: TaskNotesRuntimeLifecycleEventName;
	timestamp: string;
	data?: unknown;
	settings?: Readonly<TaskNotesSettings>;
	extension?: TaskNotesRuntimeExtensionInfo;
	filePath?: string;
	force?: boolean;
	rawEvent: string;
}

export type TaskNotesRuntimeLifecycleHandler<EventName extends TaskNotesRuntimeLifecycleEventName> =
	(payload: TaskNotesRuntimeLifecyclePayload & { event: EventName }) => void;

export interface TaskNotesRuntimeLifecycleApi {
	ready(): Promise<void>;
	isReady(): boolean;
	on<EventName extends TaskNotesRuntimeLifecycleEventName>(
		event: EventName,
		handler: TaskNotesRuntimeLifecycleHandler<EventName>
	): EventRef;
	off(ref: EventRef): void;
	list(): readonly TaskNotesRuntimeLifecycleEventDefinition[];
}

export interface TaskNotesRuntimeErrorsApi {
	isApiError(error: unknown): error is TaskNotesApiError | TaskNotesApiErrorPayload;
	normalize(error: unknown): TaskNotesApiErrorPayload;
	toResult<T>(operation: () => Promise<T> | T): Promise<TaskNotesApiResult<T>>;
}

export interface TaskNotesRuntimeTaskQuery {
	where?: TaskNotesRuntimePredicate;
	sort?: TaskNotesRuntimeSort[];
	limit?: number;
	offset?: number;
	group?: TaskNotesRuntimeGroup[];
	scope?: TaskNotesRuntimeQueryScope;
}

export type TaskNotesRuntimePredicate =
	| { all: TaskNotesRuntimePredicate[] }
	| { any: TaskNotesRuntimePredicate[] }
	| { not: TaskNotesRuntimePredicate }
	| TaskNotesRuntimeCondition;

export interface TaskNotesRuntimeCondition {
	field: string;
	op: TaskNotesRuntimeOperator | (string & {});
	value?: TaskNotesRuntimeValue;
}

export type TaskNotesRuntimeValue =
	| string
	| number
	| boolean
	| null
	| TaskNotesRuntimeValue[]
	| { fn: "today" | "now" }
	| { fn: "date"; value: string }
	| {
			fn: "dateAdd";
			value: TaskNotesRuntimeValue;
			amount: number;
			unit: "day" | "week" | "month";
	  };

export interface TaskNotesRuntimeSort {
	field: string;
	direction?: "asc" | "desc";
}

export interface TaskNotesRuntimeGroup {
	field: string;
}

export interface TaskNotesRuntimeQueryScope {
	includeArchived?: boolean;
	folders?: string[];
	excludeFolders?: string[];
}

export interface TaskNotesRuntimeNormalizedCondition {
	field: string;
	op: TaskNotesRuntimeOperator;
	value?: TaskNotesRuntimeValue;
}

export type TaskNotesRuntimeNormalizedPredicate =
	| { all: TaskNotesRuntimeNormalizedPredicate[] }
	| { any: TaskNotesRuntimeNormalizedPredicate[] }
	| { not: TaskNotesRuntimeNormalizedPredicate }
	| TaskNotesRuntimeNormalizedCondition;

export interface TaskNotesRuntimeNormalizedTaskQuery {
	where?: TaskNotesRuntimeNormalizedPredicate;
	sort: TaskNotesRuntimeSort[];
	limit?: number;
	offset: number;
	group: TaskNotesRuntimeGroup[];
	scope: Required<Pick<TaskNotesRuntimeQueryScope, "includeArchived">> &
		Omit<TaskNotesRuntimeQueryScope, "includeArchived">;
}

export interface TaskNotesRuntimeQueryIssue {
	path: string;
	code: string;
	message: string;
}

export interface TaskNotesRuntimeQueryWarning {
	path: string;
	code: string;
	message: string;
}

export interface TaskNotesRuntimeQueryValidationResult {
	valid: boolean;
	issues: TaskNotesRuntimeQueryIssue[];
	warnings: TaskNotesRuntimeQueryWarning[];
	normalized?: TaskNotesRuntimeNormalizedTaskQuery;
}

export interface TaskNotesRuntimeQueryGroup {
	key: string;
	label: string;
	taskPaths: string[];
}

export interface TaskNotesRuntimeQueryExplainResult {
	valid: boolean;
	query?: TaskNotesRuntimeNormalizedTaskQuery;
	issues: TaskNotesRuntimeQueryIssue[];
	warnings: TaskNotesRuntimeQueryWarning[];
	total?: number;
	matched?: number;
	returned?: number;
	groups?: TaskNotesRuntimeQueryGroup[];
	appliedSort?: TaskNotesRuntimeSort[];
	appliedLimit?: number;
	appliedOffset?: number;
	notes: string[];
}

export interface TaskNotesRuntimeTaskQueryResult {
	tasks: TaskInfo[];
	total: number;
	matched: number;
	returned: number;
	groups?: TaskNotesRuntimeQueryGroup[];
	query: TaskNotesRuntimeNormalizedTaskQuery;
	warnings?: TaskNotesRuntimeQueryWarning[];
}

export interface TaskNotesRuntimeQueryApi {
	tasks(query?: TaskNotesRuntimeTaskQuery): Promise<TaskNotesRuntimeTaskQueryResult>;
	validate(query: unknown): TaskNotesRuntimeQueryValidationResult;
	normalize(query: unknown): TaskNotesRuntimeNormalizedTaskQuery;
	explain(query: unknown): Promise<TaskNotesRuntimeQueryExplainResult>;
	filterOptions(): Promise<FilterOptions>;
}

export interface TaskNotesRuntimeTaskStats {
	total: number;
	statusCounts: Record<string, number>;
	priorityCounts: Record<string, number>;
	completed: number;
	active: number;
	overdue: number;
	archived: number;
	withTimeEntries: number;
	totalTrackedMinutes: number;
	totalTrackedHours: number;
}

export interface TaskNotesRuntimeStatsApi {
	tasks(query?: TaskNotesRuntimeTaskQuery): Promise<TaskNotesRuntimeTaskStats>;
}

export interface TaskNotesRuntimeVaultInfo {
	name: string;
	path: string | null;
}

export interface TaskNotesRuntimeHealth {
	status: "ok";
	timestamp: string;
	apiVersion: TaskNotesRuntimeApiVersion;
	capabilities: readonly TaskNotesRuntimeApiCapability[];
	vault: TaskNotesRuntimeVaultInfo;
	tasks: {
		total: number;
	};
}

export interface TaskNotesRuntimeSystemApi {
	health(): Promise<TaskNotesRuntimeHealth>;
}

export interface TaskNotesRuntimeApiV1 {
	readonly apiVersion: TaskNotesRuntimeApiVersion;
	readonly capabilities: readonly TaskNotesRuntimeApiCapability[];
	hasCapability(capability: string): boolean;

	readonly model: TaskNotesRuntimeModelApi;
	readonly catalog: TaskNotesRuntimeCatalogApi;
	readonly tasks: TaskNotesRuntimeTasksApi;
	readonly relationships: TaskNotesRuntimeRelationshipsApi;
	readonly time: TaskNotesRuntimeTimeApi;
	readonly pomodoro: TaskNotesRuntimePomodoroApi;
	readonly recurring: TaskNotesRuntimeRecurringApi;
	readonly events: TaskNotesRuntimeEventsApi;
	readonly settings: TaskNotesRuntimeSettingsApi;
	readonly bases: TaskNotesRuntimeBasesApi;
	readonly nlp: TaskNotesRuntimeNlpApi;
	readonly query: TaskNotesRuntimeQueryApi;
	readonly stats: TaskNotesRuntimeStatsApi;
	readonly system: TaskNotesRuntimeSystemApi;
	readonly lifecycle: TaskNotesRuntimeLifecycleApi;
	readonly errors: TaskNotesRuntimeErrorsApi;
	readonly extensions: TaskNotesRuntimeExtensionsApi;

	parseNaturalLanguage(text: string): ParsedTaskData;

	getTask(path: string): Promise<TaskInfo | null>;
	listTasks(query?: TaskNotesRuntimeTaskQuery): Promise<TaskInfo[]>;
	createTask(taskData: TaskCreationData, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	updateTask(
		path: string,
		patch: TaskNotesTaskPatch,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	completeTask(
		path: string,
		options?: CompleteTaskOptions,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	rescheduleTask(
		path: string,
		date: string | null,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	archiveTask(
		path: string,
		archived: boolean,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	moveTask(
		path: string,
		targetFolder: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	startTimeEntry(path: string, context?: TaskNotesMutationContext): Promise<void>;
	stopTimeEntry(path: string, context?: TaskNotesMutationContext): Promise<void>;
	getActiveTimeEntries(): Promise<ActiveTimeEntry[]>;
	getSettingsSnapshot(): Readonly<TaskNotesSettings>;
	on<EventName extends TaskNotesRuntimeEventName>(
		event: EventName,
		handler: TaskNotesRuntimeEventHandler<EventName>
	): EventRef;
	off(ref: EventRef): void;
}

export type TaskNotesPublicAPI = TaskNotesRuntimeApiV1;
export type TaskNotesApiV1 = TaskNotesRuntimeApiV1;
export type TaskNotesApiEvent = TaskNotesRuntimeEventName;
export type TaskNotesApiEventPayload = TaskNotesRuntimeEventPayload;
export type TaskNotesApiEventHandler<
	EventName extends TaskNotesRuntimeEventName = TaskNotesRuntimeEventName,
> = TaskNotesRuntimeEventHandler<EventName>;
export type TaskNotesApiCapability = TaskNotesRuntimeApiCapability;
export type TaskNotesApiCoreCapability = TaskNotesRuntimeCoreCapability;
export type TaskNotesApiVersion = TaskNotesRuntimeApiVersion;
