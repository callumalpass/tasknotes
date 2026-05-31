import type { EventRef } from "obsidian";
import type { ParsedTaskData } from "../services/NaturalLanguageParser";
import type {
	FilterQuery,
	PomodoroHistoryStats,
	PomodoroSessionHistory,
	PomodoroState,
	Reminder,
	TaskCreationData,
	TaskDependency,
	TaskInfo,
	TimeEntry,
	WebhookEvent,
} from "../types";
import type { TaskNotesSettings } from "../types/settings";

export const TASKNOTES_RUNTIME_API_VERSION = 1 as const;

export const TASKNOTES_RUNTIME_API_CAPABILITIES = [
	"extensions.read",
	"extensions.register",
	"tasks.read",
	"tasks.write",
	"tasks.delete",
	"tasks.move",
	"tasks.events",
	"time.read",
	"time.write",
	"pomodoro.read",
	"pomodoro.write",
	"pomodoro.events",
	"recurring.write",
	"recurring.events",
	"settings.snapshot",
	"nlp.parse",
] as const;

export type TaskNotesRuntimeApiVersion = typeof TASKNOTES_RUNTIME_API_VERSION;
export type TaskNotesRuntimeCoreCapability = (typeof TASKNOTES_RUNTIME_API_CAPABILITIES)[number];
export type TaskNotesRuntimeApiCapability =
	| TaskNotesRuntimeCoreCapability
	| (string & {});

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

export type TaskNotesRuntimeEventName =
	| TaskNotesTaskEventName
	| WebhookEvent;

export interface TaskNotesMutationContext {
	source?: string;
	correlationId?: string;
	reason?: string;
}

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

export interface StartTimeEntryOptions {
	description?: string;
}

export interface PomodoroStartOptions {
	taskPath?: string;
	duration?: number;
}

export interface PomodoroSessionsOptions {
	date?: string;
	limit?: number;
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
	list(query?: FilterQuery): Promise<TaskInfo[]>;
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
	setScheduled(
		path: string,
		date: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	clearScheduled(path: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	reschedule(
		path: string,
		date: string | null,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	archive(
		path: string,
		archived: boolean,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	move(path: string, targetFolder: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	addTag(path: string, tag: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	removeTag(path: string, tag: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	addProject(path: string, project: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	removeProject(
		path: string,
		project: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	addContext(path: string, contextName: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
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
	addReminder(path: string, reminder: Reminder, context?: TaskNotesMutationContext): Promise<TaskInfo>;
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

export interface TaskNotesRuntimeTimeApi {
	start(
		path: string,
		options?: StartTimeEntryOptions,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
	stop(path: string, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	active(): Promise<ActiveTimeEntry[]>;
	append(path: string, entry: TimeEntry, context?: TaskNotesMutationContext): Promise<TaskInfo>;
	deleteEntry(
		path: string,
		entryIndex: number,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
}

export interface TaskNotesRuntimePomodoroApi {
	status(): Promise<PomodoroState>;
	start(options?: PomodoroStartOptions, context?: TaskNotesMutationContext): Promise<PomodoroState>;
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
}

export interface TaskNotesRuntimeEventsApi {
	on<EventName extends TaskNotesRuntimeEventName>(
		event: EventName,
		handler: TaskNotesRuntimeEventHandler<EventName>
	): EventRef;
	off(ref: EventRef): void;
}

export interface TaskNotesRuntimeSettingsApi {
	snapshot(): Readonly<TaskNotesSettings>;
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

export interface TaskNotesRuntimeApiV1 {
	readonly apiVersion: TaskNotesRuntimeApiVersion;
	readonly capabilities: readonly TaskNotesRuntimeApiCapability[];
	hasCapability(capability: string): boolean;

	readonly tasks: TaskNotesRuntimeTasksApi;
	readonly time: TaskNotesRuntimeTimeApi;
	readonly pomodoro: TaskNotesRuntimePomodoroApi;
	readonly recurring: TaskNotesRuntimeRecurringApi;
	readonly events: TaskNotesRuntimeEventsApi;
	readonly settings: TaskNotesRuntimeSettingsApi;
	readonly nlp: TaskNotesRuntimeNlpApi;
	readonly extensions: TaskNotesRuntimeExtensionsApi;

	parseNaturalLanguage(text: string): ParsedTaskData;

	getTask(path: string): Promise<TaskInfo | null>;
	listTasks(query?: FilterQuery): Promise<TaskInfo[]>;
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
export type TaskNotesApiEventHandler<EventName extends TaskNotesRuntimeEventName = TaskNotesRuntimeEventName> =
	TaskNotesRuntimeEventHandler<EventName>;
export type TaskNotesApiCapability = TaskNotesRuntimeApiCapability;
export type TaskNotesApiCoreCapability = TaskNotesRuntimeCoreCapability;
export type TaskNotesApiVersion = TaskNotesRuntimeApiVersion;
