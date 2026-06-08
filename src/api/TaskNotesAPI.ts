import { normalizePath, TFile, type EventRef, type Menu } from "obsidian";
import {
	TASKNOTES_SPEC_VERSION,
	evaluateCoreValidation,
	resolveModelConfig,
	validateTask as validateModelTask,
	type TaskNotesModelConfig,
	type TaskValidationResult,
} from "@tasknotes/model";
import type TaskNotesPlugin from "../main";
import { NaturalLanguageParser, type ParsedTaskData } from "../services/NaturalLanguageParser";
import type {
	FilterCondition,
	FilterNode,
	FilterOperator,
	FilterProperty,
	FilterQuery,
	PomodoroHistoryStats,
	PomodoroSessionHistory,
	PomodoroState,
	Reminder,
	TaskGroupKey,
	TaskCreationData,
	TaskDependency,
	TaskInfo,
	TaskSortKey,
	TimeEntry,
} from "../types";
import {
	EVENT_POMODORO_COMPLETE,
	EVENT_POMODORO_INTERRUPT,
	EVENT_POMODORO_START,
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
	FILTER_PROPERTIES,
} from "../types";
import type { TaskNotesSettings } from "../types/settings";
import { ensureFolderExists } from "../utils/helpers";
import { parseLinkToPath } from "../utils/linkUtils";
import { computeTaskTimeData, computeTimeSummary } from "../utils/timeTrackingUtils";
import { TaskContextMenu } from "../components/TaskContextMenu";
import {
	TASKNOTES_RUNTIME_API_CAPABILITIES,
	TASKNOTES_RUNTIME_EVENT_DEFINITIONS,
	TASKNOTES_RUNTIME_LIFECYCLE_EVENT_DEFINITIONS,
	TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS,
	TASKNOTES_RUNTIME_API_VERSION,
	TASKNOTES_RUNTIME_QUERY_OPERATORS,
	TaskNotesApiError,
	isTaskNotesApiError,
	isTaskNotesApiErrorPayload,
	type ActiveTimeEntry,
	type CompleteTaskOptions,
	type PomodoroSessionsOptions,
	type PomodoroStartOptions,
	type ResolvedTaskDependency,
	type StartTimeEntryOptions,
	type TaskNotesRuntimeDependencyRelTypeDefinition,
	type TaskNotesRuntimeDefaultBasesResult,
	type TaskNotesRuntimeFieldDefinition,
	type TaskNotesRuntimeFilterOperatorDefinition,
	type TaskNotesRuntimeFilterPropertyDefinition,
	type TaskNotesRuntimeHealth,
	type TaskNotesRuntimeLifecycleEventName,
	type TaskNotesRuntimeLifecycleHandler,
	type TaskNotesRuntimeLifecyclePayload,
	type TaskNotesRuntimeNormalizedCondition,
	type TaskNotesRuntimeNormalizedPredicate,
	type TaskNotesRuntimeNormalizedTaskQuery,
	type TaskNotesRuntimeOperator,
	type TaskNotesRuntimeQueryExplainResult,
	type TaskNotesRuntimeQueryGroup,
	type TaskNotesRuntimeQueryIssue,
	type TaskNotesRuntimeQueryValidationResult,
	type TaskNotesRuntimeQueryWarning,
	type TaskNotesRuntimeRelationshipDefinition,
	type TaskNotesRuntimeTaskQuery,
	type TaskNotesRuntimeTaskQueryResult,
	type TaskNotesRuntimeTaskStats,
	type TaskNotesRuntimeTaskMenuOptions,
	type TaskNotesRuntimeTaskMenuShowAtElementOptions,
	type TaskNotesRuntimeTaskMenuShowOptions,
	type TaskNotesRuntimeValue,
	type TaskNotesRuntimeTaskTimeData,
	type TaskNotesRuntimeTimeSummary,
	type TaskNotesRuntimeTimeSummaryOptions,
	type TaskNotesApiChanges,
	type TaskNotesApiErrorPayload,
	type TaskNotesApiEvent,
	type TaskNotesApiEventHandler,
	type TaskNotesApiEventPayload,
	type TaskNotesMutationContext,
	type TaskNotesRuntimeApiV1,
	type TaskNotesRuntimeExtension,
	type TaskNotesRuntimeExtensionHandle,
	type TaskNotesRuntimeExtensionInfo,
	type TaskNotesRuntimeEventName,
	type TaskNotesTaskRelationships,
	type TaskNotesTaskPatch,
	type UncompleteTaskOptions,
} from "./runtime-api";

export * from "./runtime-api";

interface TaskUpdatedEventPayload {
	path?: string;
	originalTask?: TaskInfo;
	updatedTask?: TaskInfo;
}

interface TaskDeletedEventPayload {
	path?: string;
	deletedTask?: TaskInfo;
}

interface RegisteredRuntimeExtension {
	id: string;
	namespace: string;
	api: unknown;
	displayName?: string;
	version?: string;
	capabilities: readonly string[];
	token: symbol;
}

type VaultAdapterWithPath = {
	basePath?: string;
	path?: string;
};

const RESERVED_RUNTIME_EXTENSION_NAMESPACES = new Set([
	"apiversion",
	"capabilities",
	"events",
	"extensions",
	"hascapability",
	"nlp",
	"pomodoro",
	"relationships",
	"recurring",
	"settings",
	"tasks",
	"time",
]);

const CORE_FIELD_DEFINITIONS: ReadonlyArray<
	Omit<TaskNotesRuntimeFieldDefinition, "frontmatterKey">
> = [
	{
		id: "title",
		label: "Title",
		valueType: "string",
		source: "model",
		writable: true,
		required: true,
	},
	{
		id: "status",
		label: "Status",
		valueType: "string",
		source: "model",
		writable: true,
		required: true,
	},
	{
		id: "priority",
		label: "Priority",
		valueType: "string",
		source: "model",
		writable: true,
		required: true,
	},
	{ id: "due", label: "Due", valueType: "date", source: "model", writable: true },
	{ id: "scheduled", label: "Scheduled", valueType: "date", source: "model", writable: true },
	{ id: "archived", label: "Archived", valueType: "boolean", source: "model", writable: true },
	{ id: "tags", label: "Tags", valueType: "string[]", source: "model", writable: true },
	{ id: "contexts", label: "Contexts", valueType: "string[]", source: "model", writable: true },
	{ id: "projects", label: "Projects", valueType: "string[]", source: "model", writable: true },
	{ id: "recurrence", label: "Recurrence", valueType: "string", source: "model", writable: true },
	{
		id: "recurrence_anchor",
		label: "Recurrence anchor",
		valueType: "string",
		source: "model",
		writable: true,
	},
	{
		id: "complete_instances",
		label: "Complete instances",
		valueType: "string[]",
		source: "model",
		writable: true,
	},
	{
		id: "skipped_instances",
		label: "Skipped instances",
		valueType: "string[]",
		source: "model",
		writable: true,
	},
	{
		id: "recurrence_parent",
		label: "Recurrence parent",
		valueType: "string",
		source: "model",
		writable: true,
	},
	{
		id: "occurrence_date",
		label: "Occurrence date",
		valueType: "date",
		source: "model",
		writable: true,
	},
	{
		id: "occurrence_materialization",
		label: "Occurrence materialization",
		valueType: "string",
		source: "model",
		writable: true,
	},
	{
		id: "occurrence_next_trigger",
		label: "Occurrence next trigger",
		valueType: "string",
		source: "model",
		writable: true,
	},
	{
		id: "occurrence_template",
		label: "Occurrence template",
		valueType: "string",
		source: "model",
		writable: true,
	},
	{
		id: "occurrence_past_horizon",
		label: "Occurrence past horizon",
		valueType: "string",
		source: "model",
		writable: true,
	},
	{
		id: "occurrence_future_horizon",
		label: "Occurrence future horizon",
		valueType: "string",
		source: "model",
		writable: true,
	},
	{
		id: "completedDate",
		label: "Completed date",
		valueType: "date",
		source: "model",
		writable: true,
	},
	{
		id: "timeEstimate",
		label: "Time estimate",
		valueType: "number",
		source: "model",
		writable: true,
	},
	{
		id: "timeEntries",
		label: "Time entries",
		valueType: "timeEntry[]",
		source: "model",
		writable: true,
	},
	{
		id: "dateCreated",
		label: "Date created",
		valueType: "datetime",
		source: "model",
		writable: true,
	},
	{
		id: "dateModified",
		label: "Date modified",
		valueType: "datetime",
		source: "model",
		writable: true,
	},
	{
		id: "reminders",
		label: "Reminders",
		valueType: "reminder[]",
		source: "model",
		writable: true,
	},
	{
		id: "blockedBy",
		label: "Blocked by",
		valueType: "dependency[]",
		source: "model",
		writable: true,
	},
	{ id: "details", label: "Details", valueType: "string", source: "model", writable: true },
	{ id: "sortOrder", label: "Sort order", valueType: "string", source: "model", writable: true },
	{ id: "path", label: "Path", valueType: "string", source: "model", writable: false },
	{
		id: "totalTrackedTime",
		label: "Total tracked time",
		valueType: "number",
		source: "computed",
		writable: false,
	},
	{
		id: "blocking",
		label: "Blocking",
		valueType: "string[]",
		source: "computed",
		writable: false,
	},
	{
		id: "isBlocked",
		label: "Is blocked",
		valueType: "boolean",
		source: "computed",
		writable: false,
	},
	{
		id: "isBlocking",
		label: "Is blocking",
		valueType: "boolean",
		source: "computed",
		writable: false,
	},
	{
		id: "hasSubtasks",
		label: "Has subtasks",
		valueType: "boolean",
		source: "computed",
		writable: false,
	},
];

const FIELD_MAPPING_KEY_BY_FIELD_ID: Partial<
	Record<string, keyof TaskNotesSettings["fieldMapping"]>
> = {
	title: "title",
	status: "status",
	priority: "priority",
	due: "due",
	scheduled: "scheduled",
	contexts: "contexts",
	projects: "projects",
	recurrence: "recurrence",
	recurrence_anchor: "recurrenceAnchor",
	complete_instances: "completeInstances",
	skipped_instances: "skippedInstances",
	recurrence_parent: "recurrenceParent",
	occurrence_date: "occurrenceDate",
	occurrence_materialization: "occurrenceMaterialization",
	occurrence_next_trigger: "occurrenceNextTrigger",
	occurrence_template: "occurrenceTemplate",
	occurrence_past_horizon: "occurrencePastHorizon",
	occurrence_future_horizon: "occurrenceFutureHorizon",
	completedDate: "completedDate",
	timeEstimate: "timeEstimate",
	timeEntries: "timeEntries",
	dateCreated: "dateCreated",
	dateModified: "dateModified",
	reminders: "reminders",
	blockedBy: "blockedBy",
	sortOrder: "sortOrder",
};

const FILTER_OPERATOR_DEFINITIONS: readonly TaskNotesRuntimeFilterOperatorDefinition[] = [
	{
		id: "eq",
		label: "equals",
		valueRequired: true,
		appliesTo: ["string", "number", "boolean", "date", "datetime", "string[]"],
		aliases: ["is"],
	},
	{
		id: "ne",
		label: "does not equal",
		valueRequired: true,
		appliesTo: ["string", "number", "boolean", "date", "datetime", "string[]"],
		aliases: ["is-not"],
	},
	{
		id: "contains",
		label: "contains",
		valueRequired: true,
		appliesTo: ["string", "string[]", "dependency[]"],
	},
	{
		id: "notContains",
		label: "does not contain",
		valueRequired: true,
		appliesTo: ["string", "string[]", "dependency[]"],
		aliases: ["does-not-contain"],
	},
	{
		id: "in",
		label: "is one of",
		valueRequired: true,
		appliesTo: ["string", "number", "boolean", "date", "datetime"],
	},
	{
		id: "notIn",
		label: "is not one of",
		valueRequired: true,
		appliesTo: ["string", "number", "boolean", "date", "datetime"],
	},
	{
		id: "exists",
		label: "exists",
		valueRequired: false,
		appliesTo: ["string", "number", "boolean", "date", "datetime", "string[]"],
		aliases: ["is-not-empty"],
	},
	{
		id: "missing",
		label: "is missing",
		valueRequired: false,
		appliesTo: ["string", "number", "boolean", "date", "datetime", "string[]"],
		aliases: ["is-empty"],
	},
	{
		id: "lt",
		label: "is less than",
		valueRequired: true,
		appliesTo: ["number", "date", "datetime"],
		aliases: ["is-before", "is-less-than"],
	},
	{
		id: "lte",
		label: "is less than or equal",
		valueRequired: true,
		appliesTo: ["number", "date", "datetime"],
		aliases: ["is-on-or-before", "is-less-than-or-equal"],
	},
	{
		id: "gt",
		label: "is greater than",
		valueRequired: true,
		appliesTo: ["number", "date", "datetime"],
		aliases: ["is-after", "is-greater-than"],
	},
	{
		id: "gte",
		label: "is greater than or equal",
		valueRequired: true,
		appliesTo: ["number", "date", "datetime"],
		aliases: ["is-on-or-after", "is-greater-than-or-equal"],
	},
	{
		id: "isTrue",
		label: "is true",
		valueRequired: false,
		appliesTo: ["boolean"],
		aliases: ["is-checked"],
	},
	{
		id: "isFalse",
		label: "is false",
		valueRequired: false,
		appliesTo: ["boolean"],
		aliases: ["is-not-checked"],
	},
];

const RUNTIME_OPERATOR_BY_ALIAS = new Map<string, TaskNotesRuntimeOperator>(
	FILTER_OPERATOR_DEFINITIONS.flatMap((operator) => [
		[operator.id, operator.id] as const,
		...(operator.aliases ?? []).map((alias) => [alias, operator.id] as const),
	])
);

type RuntimeFilterPropertyDefinition = TaskNotesRuntimeFilterPropertyDefinition & {
	internalProperty: FilterProperty;
};

const RUNTIME_FILTER_PROPERTY_DEFINITIONS: readonly RuntimeFilterPropertyDefinition[] = [
	runtimeFilterProperty("task.title", "title", "Title", "text", "string", "model", {
		aliases: ["title", "note.title"],
		sortable: true,
	}),
	runtimeFilterProperty("file.path", "path", "Path", "file", "string", "file", {
		aliases: ["path", "task.path", "note.path"],
	}),
	runtimeFilterProperty("task.status", "status", "Status", "select", "string", "model", {
		aliases: ["status", "note.status"],
		sortable: true,
		groupable: true,
	}),
	runtimeFilterProperty("task.priority", "priority", "Priority", "select", "string", "model", {
		aliases: ["priority", "note.priority"],
		sortable: true,
		groupable: true,
	}),
	runtimeFilterProperty("task.tags", "tags", "Tags", "select", "string[]", "model", {
		aliases: ["tags", "file.tags", "note.tags"],
		sortable: true,
		groupable: true,
	}),
	runtimeFilterProperty("task.contexts", "contexts", "Contexts", "select", "string[]", "model", {
		aliases: ["contexts"],
		groupable: true,
	}),
	runtimeFilterProperty("task.projects", "projects", "Projects", "select", "string[]", "model", {
		aliases: ["projects"],
		groupable: true,
	}),
	runtimeFilterProperty(
		"task.blockedBy",
		"blockedBy",
		"Blocked by",
		"select",
		"dependency[]",
		"model",
		{
			aliases: ["blockedBy"],
		}
	),
	runtimeFilterProperty(
		"task.blocking",
		"blocking",
		"Blocking",
		"select",
		"string[]",
		"computed",
		{
			aliases: ["blocking"],
		}
	),
	runtimeFilterProperty("task.due", "due", "Due date", "date", "date", "model", {
		aliases: ["due", "note.due"],
		sortable: true,
		groupable: true,
	}),
	runtimeFilterProperty(
		"task.scheduled",
		"scheduled",
		"Scheduled date",
		"date",
		"date",
		"model",
		{
			aliases: ["scheduled", "note.scheduled"],
			sortable: true,
			groupable: true,
		}
	),
	runtimeFilterProperty(
		"task.completedDate",
		"completedDate",
		"Completed date",
		"date",
		"date",
		"model",
		{
			aliases: ["completedDate"],
			sortable: true,
			groupable: true,
		}
	),
	runtimeFilterProperty(
		"task.dateCreated",
		"dateCreated",
		"Created date",
		"date",
		"datetime",
		"model",
		{
			aliases: ["dateCreated", "file.ctime"],
			sortable: true,
		}
	),
	runtimeFilterProperty(
		"task.dateModified",
		"dateModified",
		"Modified date",
		"date",
		"datetime",
		"model",
		{
			aliases: ["dateModified", "file.mtime"],
		}
	),
	runtimeFilterProperty("task.archived", "archived", "Archived", "boolean", "boolean", "model", {
		aliases: ["archived"],
	}),
	runtimeFilterProperty(
		"task.hasSubtasks",
		"hasSubtasks",
		"Has subtasks",
		"boolean",
		"boolean",
		"computed",
		{
			aliases: ["hasSubtasks"],
		}
	),
	runtimeFilterProperty(
		"task.isBlocked",
		"dependencies.isBlocked",
		"Blocked",
		"boolean",
		"boolean",
		"computed",
		{
			aliases: ["dependencies.isBlocked", "isBlocked"],
		}
	),
	runtimeFilterProperty(
		"task.isBlocking",
		"dependencies.isBlocking",
		"Blocking others",
		"boolean",
		"boolean",
		"computed",
		{
			aliases: ["dependencies.isBlocking", "isBlocking"],
		}
	),
	runtimeFilterProperty(
		"task.timeEstimate",
		"timeEstimate",
		"Time estimate",
		"numeric",
		"number",
		"model",
		{
			aliases: ["timeEstimate"],
			sortable: true,
		}
	),
	runtimeFilterProperty(
		"task.recurrence",
		"recurrence",
		"Recurrence",
		"special",
		"string",
		"model",
		{
			aliases: ["recurrence"],
		}
	),
	runtimeFilterProperty(
		"task.isCompleted",
		"status.isCompleted",
		"Completed",
		"boolean",
		"boolean",
		"computed",
		{
			aliases: ["status.isCompleted", "completed"],
		}
	),
];

const RUNTIME_TO_LEGACY_OPERATOR: Record<TaskNotesRuntimeOperator, FilterOperator> = {
	eq: "is",
	ne: "is-not",
	contains: "contains",
	notContains: "does-not-contain",
	in: "is",
	notIn: "is-not",
	exists: "is-not-empty",
	missing: "is-empty",
	lt: "is-before",
	lte: "is-on-or-before",
	gt: "is-after",
	gte: "is-on-or-after",
	isTrue: "is-checked",
	isFalse: "is-not-checked",
};

const RELATIONSHIP_DEFINITIONS: readonly TaskNotesRuntimeRelationshipDefinition[] = [
	{ id: "parents", label: "Parents", description: "Tasks referenced from this task's projects." },
	{
		id: "subtasks",
		label: "Subtasks",
		description: "Tasks that reference this task as a project.",
	},
	{ id: "dependencies", label: "Dependencies", description: "Tasks this task is blocked by." },
	{ id: "blocking", label: "Blocking", description: "Tasks blocked by this task." },
];

const DEPENDENCY_REL_TYPE_DEFINITIONS: readonly TaskNotesRuntimeDependencyRelTypeDefinition[] = [
	{
		value: "FINISHTOSTART",
		label: "Finish to start",
		description: "The blocking task should finish before this task starts.",
	},
	{
		value: "FINISHTOFINISH",
		label: "Finish to finish",
		description: "The blocking task should finish before this task finishes.",
	},
	{
		value: "STARTTOSTART",
		label: "Start to start",
		description: "The blocking task should start before this task starts.",
	},
	{
		value: "STARTTOFINISH",
		label: "Start to finish",
		description: "The blocking task should start before this task finishes.",
	},
];

export class TaskNotesAPI implements TaskNotesRuntimeApiV1 {
	readonly apiVersion = TASKNOTES_RUNTIME_API_VERSION;

	readonly model = {
		info: () => ({
			packageName: "@tasknotes/model" as const,
			specVersion: TASKNOTES_SPEC_VERSION,
			runtimeApiVersion: this.apiVersion,
		}),
		config: () => this.getModelConfig(),
		validateTask: (task: Partial<TaskInfo>) => this.validateTask(task),
		validatePatch: (patch: TaskNotesTaskPatch) => this.validateTaskPatch(patch),
	};

	readonly catalog = {
		statuses: () => this.getStatuses(),
		priorities: () => this.getPriorities(),
		userFields: () => this.getUserFields(),
		fields: () => this.getFieldDefinitions(),
		writableFields: () => this.getFieldDefinitions().filter((field) => field.writable),
		filterProperties: () => this.getFilterPropertyDefinitions(),
		filterOperators: () => FILTER_OPERATOR_DEFINITIONS.map((operator) => ({ ...operator })),
		relationships: () => RELATIONSHIP_DEFINITIONS.map((relationship) => ({ ...relationship })),
		dependencyRelTypes: () =>
			DEPENDENCY_REL_TYPE_DEFINITIONS.map((relationshipType) => ({ ...relationshipType })),
		events: () => this.events.list(),
	};

	readonly tasks = {
		get: (path: string) => this.getTask(path),
		list: (query?: TaskNotesRuntimeTaskQuery) => this.listTasks(query),
		create: (taskData: TaskCreationData, context?: TaskNotesMutationContext) =>
			this.createTask(taskData, context),
		update: (path: string, patch: TaskNotesTaskPatch, context?: TaskNotesMutationContext) =>
			this.updateTask(path, patch, context),
		patch: (path: string, patch: TaskNotesTaskPatch, context?: TaskNotesMutationContext) =>
			this.updateTask(path, patch, context),
		delete: (path: string, context?: TaskNotesMutationContext) =>
			this.deleteTask(path, context),
		complete: (
			path: string,
			options?: CompleteTaskOptions,
			context?: TaskNotesMutationContext
		) => this.completeTask(path, options, context),
		uncomplete: (
			path: string,
			options?: UncompleteTaskOptions,
			context?: TaskNotesMutationContext
		) => this.uncompleteTask(path, options, context),
		setStatus: (path: string, status: string, context?: TaskNotesMutationContext) =>
			this.setTaskProperty(path, "status", status, context),
		setPriority: (path: string, priority: string, context?: TaskNotesMutationContext) =>
			this.setTaskProperty(path, "priority", priority, context),
		setDue: (path: string, date: string, context?: TaskNotesMutationContext) =>
			this.setTaskProperty(path, "due", date, context),
		clearDue: (path: string, context?: TaskNotesMutationContext) =>
			this.setTaskProperty(path, "due", undefined, context),
		setScheduled: (path: string, date: string, context?: TaskNotesMutationContext) =>
			this.setTaskProperty(path, "scheduled", date, context),
		clearScheduled: (path: string, context?: TaskNotesMutationContext) =>
			this.setTaskProperty(path, "scheduled", undefined, context),
		reschedule: (path: string, date: string | null, context?: TaskNotesMutationContext) =>
			this.rescheduleTask(path, date, context),
		archive: (path: string, archived: boolean, context?: TaskNotesMutationContext) =>
			this.archiveTask(path, archived, context),
		move: (path: string, targetFolder: string, context?: TaskNotesMutationContext) =>
			this.moveTask(path, targetFolder, context),
		addTag: (path: string, tag: string, context?: TaskNotesMutationContext) =>
			this.updateStringList(path, "tags", tag, "add", context),
		removeTag: (path: string, tag: string, context?: TaskNotesMutationContext) =>
			this.updateStringList(path, "tags", tag, "remove", context),
		addProject: (path: string, project: string, context?: TaskNotesMutationContext) =>
			this.updateStringList(path, "projects", project, "add", context),
		removeProject: (path: string, project: string, context?: TaskNotesMutationContext) =>
			this.updateStringList(path, "projects", project, "remove", context),
		addContext: (path: string, contextName: string, context?: TaskNotesMutationContext) =>
			this.updateStringList(path, "contexts", contextName, "add", context),
		removeContext: (path: string, contextName: string, context?: TaskNotesMutationContext) =>
			this.updateStringList(path, "contexts", contextName, "remove", context),
		setReminders: (path: string, reminders: Reminder[], context?: TaskNotesMutationContext) =>
			this.updateTask(
				path,
				{ reminders: reminders.map((reminder) => ({ ...reminder })) },
				context
			),
		addReminder: (path: string, reminder: Reminder, context?: TaskNotesMutationContext) =>
			this.addReminder(path, reminder, context),
		removeReminder: (path: string, reminderId: string, context?: TaskNotesMutationContext) =>
			this.removeReminder(path, reminderId, context),
		addDependency: (
			path: string,
			dependency: TaskDependency,
			context?: TaskNotesMutationContext
		) => this.addDependency(path, dependency, context),
		removeDependency: (path: string, uid: string, context?: TaskNotesMutationContext) =>
			this.removeDependency(path, uid, context),
	};

	readonly relationships = {
		parents: (path: string) => this.getParentTasks(path),
		subtasks: (path: string) => this.getSubtasks(path),
		dependencies: (path: string) => this.getTaskDependencies(path),
		blocking: (path: string) => this.getBlockingTasks(path),
		all: (path: string) => this.getTaskRelationships(path),
	};

	readonly time = {
		start: (
			path: string,
			options?: StartTimeEntryOptions,
			context?: TaskNotesMutationContext
		) => this.startTime(path, options, context),
		stop: (path: string, context?: TaskNotesMutationContext) => this.stopTime(path, context),
		active: () => this.getActiveTimeEntries(),
		summary: (options?: TaskNotesRuntimeTimeSummaryOptions) => this.getTimeSummary(options),
		task: (path: string) => this.getTaskTimeData(path),
		append: (path: string, entry: TimeEntry, context?: TaskNotesMutationContext) =>
			this.appendTimeEntry(path, entry, context),
		deleteEntry: (path: string, entryIndex: number, context?: TaskNotesMutationContext) =>
			this.deleteTimeEntry(path, entryIndex, context),
	};

	readonly pomodoro = {
		status: () =>
			Promise.resolve(this.copyPomodoroState(this.plugin.pomodoroService.getState())),
		start: (options?: PomodoroStartOptions, context?: TaskNotesMutationContext) =>
			this.startPomodoro(options, context),
		stop: (context?: TaskNotesMutationContext) => this.stopPomodoro(context),
		pause: (context?: TaskNotesMutationContext) => this.pausePomodoro(context),
		resume: (context?: TaskNotesMutationContext) => this.resumePomodoro(context),
		assignTask: (path: string | null, context?: TaskNotesMutationContext) =>
			this.assignPomodoroTask(path, context),
		sessions: (options?: PomodoroSessionsOptions) => this.getPomodoroSessions(options),
		stats: (date?: string) => this.getPomodoroStats(date),
	};

	readonly recurring = {
		toggleCompleteInstance: (path: string, date?: string, context?: TaskNotesMutationContext) =>
			this.toggleRecurringComplete(path, date, context),
		toggleSkippedInstance: (path: string, date?: string, context?: TaskNotesMutationContext) =>
			this.toggleRecurringSkipped(path, date, context),
		materializeOccurrence: (
			path: string,
			date: string,
			context?: TaskNotesMutationContext
		) => this.materializeOccurrence(path, date, context),
	};

	readonly events = {
		on: <EventName extends TaskNotesRuntimeEventName>(
			event: EventName,
			handler: TaskNotesApiEventHandler<EventName>
		) => this.on(event, handler),
		off: (ref: EventRef) => this.off(ref),
		list: () => TASKNOTES_RUNTIME_EVENT_DEFINITIONS.map((event) => ({ ...event })),
	};

	readonly settings = {
		snapshot: () => this.getSettingsSnapshot(),
	};

	readonly bases = {
		updateDefaultFiles: () => this.updateDefaultBasesFiles(),
	};

	readonly nlp = {
		parse: (text: string) => this.parseNaturalLanguage(text),
	};

	readonly query = {
		tasks: (query?: TaskNotesRuntimeTaskQuery) => this.queryTasks(query),
		validate: (query: unknown) => this.validateRuntimeQuery(query),
		normalize: (query: unknown) => this.normalizeRuntimeQueryOrThrow(query),
		explain: (query: unknown) => this.explainRuntimeQuery(query),
		filterOptions: () => this.getFilterOptions(),
	};

	readonly stats = {
		tasks: (query?: TaskNotesRuntimeTaskQuery) => this.getTaskStats(query),
	};

	readonly system = {
		health: () => this.getHealth(),
	};

	readonly ui = {
		taskMenu: {
			show: (options: TaskNotesRuntimeTaskMenuShowOptions) => this.showTaskMenu(options),
			showAtElement: (options: TaskNotesRuntimeTaskMenuShowAtElementOptions) =>
				this.showTaskMenuAtElement(options),
			populate: (menu: Menu, options: TaskNotesRuntimeTaskMenuOptions) =>
				this.populateTaskMenu(menu, options),
		},
	};

	readonly lifecycle = {
		ready: () => this.plugin.onReady(),
		isReady: () => this.plugin.initializationComplete === true,
		on: <EventName extends TaskNotesRuntimeLifecycleEventName>(
			event: EventName,
			handler: TaskNotesRuntimeLifecycleHandler<EventName>
		) => this.onLifecycle(event, handler),
		off: (ref: EventRef) => this.off(ref),
		list: () => TASKNOTES_RUNTIME_LIFECYCLE_EVENT_DEFINITIONS.map((event) => ({ ...event })),
	};

	readonly errors = {
		isApiError: (error: unknown) => isTaskNotesApiError(error),
		normalize: (error: unknown) => this.normalizeError(error),
		toResult: async <T>(operation: () => Promise<T> | T) => {
			try {
				return { ok: true as const, value: await operation() };
			} catch (error) {
				return { ok: false as const, error: this.normalizeError(error) };
			}
		},
	};

	readonly extensions = {
		register: <TApi>(extension: TaskNotesRuntimeExtension<TApi>) =>
			this.registerExtension(extension),
		get: <TApi = unknown>(namespace: string) => this.getExtension<TApi>(namespace),
		require: <TApi = unknown>(namespace: string) => this.requireExtension<TApi>(namespace),
		has: (namespace: string) => this.hasExtension(namespace),
		list: () => this.listExtensions(),
		capabilities: () => this.getExtensionCapabilities(),
	};

	private readonly mutationContextByPath = new Map<string, TaskNotesMutationContext[]>();
	private readonly mutationContextStack: TaskNotesMutationContext[] = [];
	private readonly extensionRegistry = new Map<string, RegisteredRuntimeExtension>();

	constructor(private plugin: TaskNotesPlugin) {}

	get capabilities(): readonly string[] {
		return [...TASKNOTES_RUNTIME_API_CAPABILITIES, ...this.getExtensionCapabilities()];
	}

	hasCapability(capability: string): boolean {
		return this.capabilities.includes(capability);
	}

	parseNaturalLanguage(text: string): ParsedTaskData {
		if (typeof text !== "string") {
			throw new TaskNotesApiError(
				"invalid_input",
				"TaskNotes API parseNaturalLanguage expects a string",
				{ status: 400 }
			);
		}

		return NaturalLanguageParser.fromPlugin(this.plugin).parseInput(text);
	}

	private getModelConfig(): Readonly<TaskNotesModelConfig> {
		const settings = this.plugin.settings;
		return resolveModelConfig({
			fieldMapping: settings.fieldMapping,
			statuses: settings.customStatuses,
			priorities: settings.customPriorities,
			defaults: {
				status: settings.defaultTaskStatus ?? "open",
				priority: settings.defaultTaskPriority ?? "normal",
				taskTag: settings.taskTag ?? "task",
			},
			taskIdentification: {
				method: settings.taskIdentificationMethod ?? "tag",
				tag: settings.taskTag ?? "task",
				propertyName: settings.taskPropertyName ?? "type",
				propertyValue: settings.taskPropertyValue ?? "task",
				excludedFolders: settings.excludedFolders ?? "",
			},
			storeTitleInFilename: settings.storeTitleInFilename ?? false,
			userFields: settings.userFields ?? [],
			recurrence: {
				maintainDueDateOffset: settings.maintainDueDateOffsetInRecurring ?? true,
				resetCheckboxesOnRecurrence: settings.resetCheckboxesOnRecurrence ?? true,
			},
			timeTracking: {
				autoStopOnComplete: settings.autoStopTimeTrackingOnComplete ?? false,
				autoStopNotification: settings.autoStopTimeTrackingNotification ?? true,
				defaultSessionDescription: "",
			},
		});
	}

	private validateTask(task: Partial<TaskInfo>): TaskValidationResult {
		return evaluateCoreValidation(task, this.plugin.settings.customStatuses ?? []);
	}

	private validateTaskPatch(patch: TaskNotesTaskPatch): TaskValidationResult {
		return validateModelTask(patch);
	}

	private normalizeError(error: unknown): TaskNotesApiErrorPayload {
		if (error instanceof TaskNotesApiError) {
			return error.toJSON();
		}
		if (isTaskNotesApiErrorPayload(error)) {
			return error;
		}

		return new TaskNotesApiError(
			"operation_failed",
			error instanceof Error ? error.message : String(error),
			{ status: 500, cause: error }
		).toJSON();
	}

	private async updateDefaultBasesFiles(): Promise<TaskNotesRuntimeDefaultBasesResult> {
		return this.plugin.updateDefaultBasesFiles();
	}

	private getStatuses() {
		return (this.plugin.settings.customStatuses ?? []).map((status) => ({ ...status }));
	}

	private getPriorities() {
		return (this.plugin.settings.customPriorities ?? []).map((priority) => ({ ...priority }));
	}

	private getUserFields() {
		return (this.plugin.settings.userFields ?? []).map((field) => ({ ...field }));
	}

	private getFieldDefinitions(): TaskNotesRuntimeFieldDefinition[] {
		const mapping = this.plugin.settings.fieldMapping ?? {};
		const coreFields = CORE_FIELD_DEFINITIONS.map((field) => {
			const mappingKey = FIELD_MAPPING_KEY_BY_FIELD_ID[field.id];
			const queryField = runtimeFilterPropertyForInternal(field.id);
			return {
				...field,
				frontmatterKey: mappingKey ? mapping[mappingKey] : undefined,
				queryable: !!queryField,
				sortable: queryField?.sortable ?? false,
				groupable: queryField?.groupable ?? false,
				supportedOperators: queryField?.supportedOperators,
				aliases: queryField ? [queryField.id, ...(queryField.aliases ?? [])] : undefined,
			};
		});
		const userFields = this.getUserFields().map(
			(field): TaskNotesRuntimeFieldDefinition => ({
				id: `user:${field.id || field.key}`,
				label: field.displayName || field.key,
				valueType: userFieldTypeToRuntimeValueType(field.type),
				source: "user",
				writable: true,
				queryable: true,
				sortable: true,
				groupable: true,
				supportedOperators: operatorsForRuntimeValueType(
					userFieldTypeToRuntimeValueType(field.type)
				),
				aliases: [`user.${field.id || field.key}`, `user:${field.id || field.key}`],
				frontmatterKey: field.key,
				description: `User-defined field ${field.key}`,
			})
		);

		return [...coreFields, ...userFields];
	}

	private getFilterPropertyDefinitions(): TaskNotesRuntimeFilterPropertyDefinition[] {
		const userFields = this.getUserFields().map(
			(field): TaskNotesRuntimeFilterPropertyDefinition => ({
				id: `user.${field.id || field.key}`,
				label: field.displayName || field.key,
				category: "user",
				valueType: userFieldTypeToRuntimeValueType(field.type),
				source: "user",
				queryable: true,
				sortable: true,
				groupable: true,
				supportedOperators: operatorsForRuntimeValueType(
					userFieldTypeToRuntimeValueType(field.type)
				),
				aliases: [
					`user:${field.id || field.key}`,
					`user.${field.key}`,
					`user:${field.key}`,
				],
				frontmatterKey: field.key,
				valueInputType: userFieldTypeToFilterInputType(field.type),
			})
		);
		return [
			...RUNTIME_FILTER_PROPERTY_DEFINITIONS.map(
				({ internalProperty: _internal, ...field }) => ({
					...field,
					aliases: field.aliases ? [...field.aliases] : undefined,
					supportedOperators: [...field.supportedOperators],
				})
			),
			...userFields,
		];
	}

	private async queryTasks(
		query?: TaskNotesRuntimeTaskQuery
	): Promise<TaskNotesRuntimeTaskQueryResult> {
		const execution = this.normalizeRuntimeQueryForExecution(query);
		if (!execution.validation.valid) {
			throw new TaskNotesApiError("invalid_input", "TaskNotes runtime query is invalid", {
				status: 400,
				details: { issues: execution.validation.issues },
			});
		}

		const allTasks = await this.plugin.cacheManager.getAllTasks();
		const scopedTasks = applyRuntimeQueryScope(allTasks, execution.normalized.scope);
		const scopedPaths = new Set(scopedTasks.map((task) => task.path));
		const groupedTasks = await this.plugin.filterService.getGroupedTasks(execution.filterQuery);
		const matchedTasksByPath = new Map<string, TaskInfo>();

		for (const groupTasks of groupedTasks.values()) {
			for (const task of groupTasks) {
				if (scopedPaths.has(task.path) && !matchedTasksByPath.has(task.path)) {
					matchedTasksByPath.set(task.path, task);
				}
			}
		}

		const matchedTasks = Array.from(matchedTasksByPath.values());
		const offset = execution.normalized.offset;
		const limit = execution.normalized.limit;
		const returnedTasks =
			typeof limit === "number"
				? matchedTasks.slice(offset, offset + limit)
				: matchedTasks.slice(offset);
		const returnedPaths = new Set(returnedTasks.map((task) => task.path));

		return {
			tasks: returnedTasks.map(copyTaskInfo),
			total: scopedTasks.length,
			matched: matchedTasks.length,
			returned: returnedTasks.length,
			groups:
				execution.normalized.group.length > 0
					? runtimeQueryGroups(groupedTasks, returnedPaths)
					: undefined,
			query: execution.normalized,
			warnings: execution.validation.warnings,
		};
	}

	private validateRuntimeQuery(query: unknown): TaskNotesRuntimeQueryValidationResult {
		return this.normalizeRuntimeQueryForExecution(query).validation;
	}

	private normalizeRuntimeQueryOrThrow(query: unknown): TaskNotesRuntimeNormalizedTaskQuery {
		const execution = this.normalizeRuntimeQueryForExecution(query);
		if (!execution.validation.valid) {
			throw new TaskNotesApiError("invalid_input", "TaskNotes runtime query is invalid", {
				status: 400,
				details: { issues: execution.validation.issues },
			});
		}
		return execution.normalized;
	}

	private async explainRuntimeQuery(query: unknown): Promise<TaskNotesRuntimeQueryExplainResult> {
		const execution = this.normalizeRuntimeQueryForExecution(query);
		if (!execution.validation.valid) {
			return {
				valid: false,
				issues: execution.validation.issues,
				warnings: execution.validation.warnings,
				notes: ["Query validation failed before execution."],
			};
		}

		const result = await this.queryTasks(query as TaskNotesRuntimeTaskQuery);
		const notes: string[] = [];
		if (execution.normalized.sort.length > 1) {
			notes.push("Only the first sort is currently applied by the TaskNotes filter engine.");
		}
		if (execution.normalized.group.length > 1) {
			notes.push("Only the first group is currently applied by the TaskNotes filter engine.");
		}

		return {
			valid: true,
			query: result.query,
			issues: [],
			warnings: result.warnings ?? [],
			total: result.total,
			matched: result.matched,
			returned: result.returned,
			groups: result.groups,
			appliedSort: result.query.sort.slice(0, 1),
			appliedLimit: result.query.limit,
			appliedOffset: result.query.offset,
			notes,
		};
	}

	private async getFilterOptions() {
		return this.plugin.filterService.getFilterOptions();
	}

	private normalizeRuntimeQueryForExecution(query: unknown): RuntimeQueryExecution {
		const issues: TaskNotesRuntimeQueryIssue[] = [];
		const warnings: TaskNotesRuntimeQueryWarning[] = [];
		const normalized = this.normalizeRuntimeTaskQuery(query, issues, warnings);
		const filterQuery = this.runtimeQueryToFilterQuery(normalized, issues, warnings);
		return {
			filterQuery,
			normalized,
			validation: {
				valid: issues.length === 0,
				issues,
				warnings,
				normalized: issues.length === 0 ? normalized : undefined,
			},
		};
	}

	private normalizeRuntimeTaskQuery(
		query: unknown,
		issues: TaskNotesRuntimeQueryIssue[],
		warnings: TaskNotesRuntimeQueryWarning[]
	): TaskNotesRuntimeNormalizedTaskQuery {
		if (query == null) return emptyRuntimeTaskQuery();
		if (!isRecord(query)) {
			issues.push({
				path: "$",
				code: "query_not_object",
				message: "Runtime task query must be an object.",
			});
			return emptyRuntimeTaskQuery();
		}

		const where =
			typeof query["where"] === "undefined"
				? undefined
				: this.normalizeRuntimePredicate(query["where"], "$.where", issues);
		const sort = this.normalizeRuntimeSorts(query["sort"], issues, warnings);
		const group = this.normalizeRuntimeGroups(query["group"], issues, warnings);
		const limit = normalizeRuntimeLimit(query["limit"], "$.limit", issues);
		const offset = normalizeRuntimeOffset(query["offset"], "$.offset", issues);
		const scope = normalizeRuntimeScope(query["scope"], issues);

		return { where, sort, limit, offset, group, scope };
	}

	private normalizeRuntimePredicate(
		predicate: unknown,
		path: string,
		issues: TaskNotesRuntimeQueryIssue[]
	): TaskNotesRuntimeNormalizedPredicate | undefined {
		if (!isRecord(predicate)) {
			issues.push({
				path,
				code: "predicate_not_object",
				message: "Runtime query predicate must be an object.",
			});
			return undefined;
		}

		if (Array.isArray(predicate["all"])) {
			return {
				all: predicate["all"]
					.map((child, index) =>
						this.normalizeRuntimePredicate(child, `${path}.all.${index}`, issues)
					)
					.filter(isDefined),
			};
		}
		if (Array.isArray(predicate["any"])) {
			return {
				any: predicate["any"]
					.map((child, index) =>
						this.normalizeRuntimePredicate(child, `${path}.any.${index}`, issues)
					)
					.filter(isDefined),
			};
		}
		if (typeof predicate["not"] !== "undefined") {
			const normalized = this.normalizeRuntimePredicate(
				predicate["not"],
				`${path}.not`,
				issues
			);
			return normalized ? { not: normalized } : undefined;
		}

		return this.normalizeRuntimeCondition(predicate, path, issues);
	}

	private normalizeRuntimeCondition(
		condition: Record<string, unknown>,
		path: string,
		issues: TaskNotesRuntimeQueryIssue[]
	): TaskNotesRuntimeNormalizedCondition | undefined {
		if (typeof condition["field"] !== "string" || condition["field"].trim().length === 0) {
			issues.push({
				path: `${path}.field`,
				code: "field_required",
				message: "Runtime query condition requires a field.",
			});
			return undefined;
		}
		const field = this.resolveRuntimeQueryField(condition["field"]);
		if (!field) {
			issues.push({
				path: `${path}.field`,
				code: "field_unknown",
				message: `Unsupported runtime query field: ${condition["field"]}`,
			});
			return undefined;
		}

		const op = normalizeRuntimeOperator(condition["op"]);
		if (!op) {
			issues.push({
				path: `${path}.op`,
				code: "operator_unknown",
				message: `Unsupported runtime query operator: ${String(condition["op"])}`,
			});
			return undefined;
		}
		if (!field.definition.supportedOperators.includes(op)) {
			issues.push({
				path: `${path}.op`,
				code: "operator_unsupported",
				message: `Operator ${op} is not supported for ${field.definition.id}.`,
			});
			return undefined;
		}

		const requiresValue = runtimeOperatorRequiresValue(op);
		if (requiresValue && typeof condition["value"] === "undefined") {
			issues.push({
				path: `${path}.value`,
				code: "value_required",
				message: `Operator ${op} requires a value.`,
			});
			return undefined;
		}
		if ((op === "in" || op === "notIn") && !Array.isArray(condition["value"])) {
			issues.push({
				path: `${path}.value`,
				code: "value_array_required",
				message: `Operator ${op} requires an array value.`,
			});
			return undefined;
		}

		return {
			field: field.definition.id,
			op,
			value: requiresValue ? normalizeRuntimeValue(condition["value"]) : undefined,
		};
	}

	private normalizeRuntimeSorts(
		value: unknown,
		issues: TaskNotesRuntimeQueryIssue[],
		warnings: TaskNotesRuntimeQueryWarning[]
	): TaskNotesRuntimeNormalizedTaskQuery["sort"] {
		if (typeof value === "undefined") return [];
		if (!Array.isArray(value)) {
			issues.push({
				path: "$.sort",
				code: "sort_not_array",
				message: "Runtime query sort must be an array.",
			});
			return [];
		}

		const sorts = value
			.map((entry, index): TaskNotesRuntimeNormalizedTaskQuery["sort"][number] | null => {
				if (!isRecord(entry) || typeof entry["field"] !== "string") {
					issues.push({
						path: `$.sort.${index}`,
						code: "sort_invalid",
						message: "Runtime query sort entries require a field.",
					});
					return null;
				}
				const field = this.resolveRuntimeQueryField(entry["field"]);
				if (!field || !field.definition.sortable) {
					issues.push({
						path: `$.sort.${index}.field`,
						code: "sort_field_unsupported",
						message: `Runtime query field is not sortable: ${entry["field"]}`,
					});
					return null;
				}
				const direction = entry["direction"] === "desc" ? "desc" : "asc";
				return { field: field.definition.id, direction };
			})
			.filter(isDefined);

		if (sorts.length > 1) {
			warnings.push({
				path: "$.sort",
				code: "multiple_sorts",
				message: "Only the first sort is currently applied by TaskNotes.",
			});
		}
		return sorts;
	}

	private normalizeRuntimeGroups(
		value: unknown,
		issues: TaskNotesRuntimeQueryIssue[],
		warnings: TaskNotesRuntimeQueryWarning[]
	): TaskNotesRuntimeNormalizedTaskQuery["group"] {
		if (typeof value === "undefined") return [];
		if (!Array.isArray(value)) {
			issues.push({
				path: "$.group",
				code: "group_not_array",
				message: "Runtime query group must be an array.",
			});
			return [];
		}

		const groups = value
			.map((entry, index): TaskNotesRuntimeNormalizedTaskQuery["group"][number] | null => {
				if (!isRecord(entry) || typeof entry["field"] !== "string") {
					issues.push({
						path: `$.group.${index}`,
						code: "group_invalid",
						message: "Runtime query group entries require a field.",
					});
					return null;
				}
				const field = this.resolveRuntimeQueryField(entry["field"]);
				if (!field || !field.definition.groupable) {
					issues.push({
						path: `$.group.${index}.field`,
						code: "group_field_unsupported",
						message: `Runtime query field is not groupable: ${entry["field"]}`,
					});
					return null;
				}
				return { field: field.definition.id };
			})
			.filter(isDefined);

		if (groups.length > 1) {
			warnings.push({
				path: "$.group",
				code: "multiple_groups",
				message: "Only the first group is currently applied by TaskNotes.",
			});
		}
		return groups;
	}

	private runtimeQueryToFilterQuery(
		query: TaskNotesRuntimeNormalizedTaskQuery,
		issues: TaskNotesRuntimeQueryIssue[],
		warnings: TaskNotesRuntimeQueryWarning[]
	): FilterQuery {
		const root = this.runtimePredicateToFilterNode(query.where, "$.where", issues);
		const children = root
			? root.type === "group" && root.conjunction === "and"
				? root.children
				: [root]
			: [];
		const filterQuery: FilterQuery = {
			type: "group",
			id: "runtime-query-root",
			conjunction: "and",
			children,
		};

		const sort = query.sort[0];
		if (sort) {
			const sortKey = this.runtimeFieldToSortKey(sort.field);
			if (sortKey) {
				filterQuery.sortKey = sortKey;
				filterQuery.sortDirection = sort.direction ?? "asc";
			} else {
				warnings.push({
					path: "$.sort.0.field",
					code: "sort_not_applied",
					message: `Sort field ${sort.field} could not be mapped to TaskNotes sorting.`,
				});
			}
		}

		const group = query.group[0];
		if (group) {
			const groupKey = this.runtimeFieldToGroupKey(group.field);
			if (groupKey) {
				filterQuery.groupKey = groupKey;
			} else {
				warnings.push({
					path: "$.group.0.field",
					code: "group_not_applied",
					message: `Group field ${group.field} could not be mapped to TaskNotes grouping.`,
				});
			}
		}

		return filterQuery;
	}

	private runtimePredicateToFilterNode(
		predicate: TaskNotesRuntimeNormalizedPredicate | undefined,
		path: string,
		issues: TaskNotesRuntimeQueryIssue[]
	): FilterNode | null {
		if (!predicate) return null;
		if ("all" in predicate) {
			return {
				type: "group",
				id: runtimeNodeId(path),
				conjunction: "and",
				children: predicate.all
					.map((child, index) =>
						this.runtimePredicateToFilterNode(child, `${path}.all.${index}`, issues)
					)
					.filter(isDefined),
			};
		}
		if ("any" in predicate) {
			return {
				type: "group",
				id: runtimeNodeId(path),
				conjunction: "or",
				children: predicate.any
					.map((child, index) =>
						this.runtimePredicateToFilterNode(child, `${path}.any.${index}`, issues)
					)
					.filter(isDefined),
			};
		}
		if ("not" in predicate) {
			const inverted = invertRuntimePredicate(predicate.not);
			if (!inverted) {
				issues.push({
					path: `${path}.not`,
					code: "not_unsupported",
					message: "Unable to invert runtime query predicate.",
				});
				return null;
			}
			return this.runtimePredicateToFilterNode(inverted, `${path}.not`, issues);
		}

		return this.runtimeConditionToFilterNode(predicate, path);
	}

	private runtimeConditionToFilterNode(
		condition: TaskNotesRuntimeNormalizedCondition,
		path: string
	): FilterNode {
		const field = this.resolveRuntimeQueryField(condition.field);
		const values =
			Array.isArray(condition.value) && (condition.op === "in" || condition.op === "notIn")
				? condition.value
				: null;
		if (values) {
			return {
				type: "group",
				id: runtimeNodeId(path),
				conjunction: condition.op === "in" ? "or" : "and",
				children: values.map(
					(value, index): FilterCondition => ({
						type: "condition",
						id: runtimeNodeId(`${path}.value.${index}`),
						property: field?.internalProperty ?? (condition.field as FilterProperty),
						operator: RUNTIME_TO_LEGACY_OPERATOR[condition.op],
						value: toFilterConditionValue(normalizeRuntimeValue(value)),
					})
				),
			};
		}

		return {
			type: "condition",
			id: runtimeNodeId(path),
			property: field?.internalProperty ?? (condition.field as FilterProperty),
			operator: RUNTIME_TO_LEGACY_OPERATOR[condition.op],
			value: toFilterConditionValue(condition.value),
		};
	}

	private resolveRuntimeQueryField(field: string): ResolvedRuntimeQueryField | null {
		const normalizedField = field.trim();
		const userField = this.resolveRuntimeUserField(normalizedField);
		if (userField) return userField;

		const direct = RUNTIME_FILTER_PROPERTY_DEFINITIONS.find(
			(definition) =>
				definition.id === normalizedField ||
				(definition.aliases ?? []).includes(normalizedField)
		);
		return direct ? { definition: direct, internalProperty: direct.internalProperty } : null;
	}

	private resolveRuntimeUserField(field: string): ResolvedRuntimeQueryField | null {
		if (!field.startsWith("user.") && !field.startsWith("user:")) return null;
		const key = field.slice(5);
		const userField = this.getUserFields().find(
			(candidate) => candidate.id === key || candidate.key === key
		);
		if (!userField) return null;
		const id = userField.id || userField.key;
		const valueType = userFieldTypeToRuntimeValueType(userField.type);
		return {
			internalProperty: `user:${id}`,
			definition: {
				id: `user.${id}`,
				label: userField.displayName || userField.key,
				category: "user",
				valueType,
				source: "user",
				queryable: true,
				sortable: true,
				groupable: true,
				supportedOperators: operatorsForRuntimeValueType(valueType),
				aliases: [`user:${id}`, `user.${userField.key}`, `user:${userField.key}`],
				frontmatterKey: userField.key,
				valueInputType: userFieldTypeToFilterInputType(userField.type),
			},
		};
	}

	private runtimeFieldToSortKey(field: string): TaskSortKey | null {
		const resolved = this.resolveRuntimeQueryField(field);
		if (!resolved) return null;
		const property = resolved.internalProperty;
		if (property.startsWith("user:")) return property as `user:${string}`;
		if (
			property === "due" ||
			property === "scheduled" ||
			property === "priority" ||
			property === "status" ||
			property === "title" ||
			property === "dateCreated" ||
			property === "completedDate" ||
			property === "tags"
		) {
			return property;
		}
		return null;
	}

	private runtimeFieldToGroupKey(field: string): TaskGroupKey | null {
		const resolved = this.resolveRuntimeQueryField(field);
		if (!resolved) return null;
		const property = resolved.internalProperty;
		if (property.startsWith("user:")) return property as `user:${string}`;
		if (
			property === "priority" ||
			property === "due" ||
			property === "scheduled" ||
			property === "status" ||
			property === "tags" ||
			property === "completedDate"
		) {
			return property;
		}
		if (property === "contexts") return "context";
		if (property === "projects") return "project";
		return null;
	}

	private async getTaskStats(
		query?: TaskNotesRuntimeTaskQuery
	): Promise<TaskNotesRuntimeTaskStats> {
		const tasks = query
			? (await this.queryTasks(query)).tasks
			: await this.plugin.cacheManager.getAllTasks();
		const stats = this.plugin.taskStatsService?.getStats(tasks) ?? this.computeTaskStats(tasks);
		return {
			total: stats.total,
			statusCounts: { ...stats.statusCounts },
			priorityCounts: { ...stats.priorityCounts },
			completed: stats.completed,
			active: stats.active,
			overdue: stats.overdue,
			archived: stats.archived,
			withTimeEntries: stats.withTimeEntries,
			totalTrackedMinutes: stats.totalTrackedMinutes,
			totalTrackedHours: stats.totalTrackedHours,
		};
	}

	private async getTimeSummary(
		options: TaskNotesRuntimeTimeSummaryOptions = {}
	): Promise<TaskNotesRuntimeTimeSummary> {
		const allTasks = await this.plugin.cacheManager.getAllTasks();
		return computeTimeSummary(
			allTasks,
			{
				period: options.period ?? "today",
				fromDate: coerceDateOption(options.from),
				toDate: coerceDateOption(options.to),
				includeTags: options.includeTags ?? true,
			},
			(status) => this.plugin.statusManager.isCompletedStatus(status)
		);
	}

	private async getTaskTimeData(path: string): Promise<TaskNotesRuntimeTaskTimeData> {
		const task = await this.requireTask(path);
		return computeTaskTimeData(task, (candidate) =>
			this.plugin.getActiveTimeSession(candidate)
		);
	}

	private async getHealth(): Promise<TaskNotesRuntimeHealth> {
		const tasks = await this.plugin.cacheManager.getAllTasks();
		return {
			status: "ok",
			timestamp: new Date().toISOString(),
			apiVersion: this.apiVersion,
			capabilities: this.capabilities,
			vault: this.getVaultInfo(),
			tasks: {
				total: tasks.length,
			},
		};
	}

	private async showTaskMenu(options: TaskNotesRuntimeTaskMenuShowOptions): Promise<void> {
		const contextMenu = await this.buildTaskContextMenu(options);
		contextMenu.show(options.event);
	}

	private async showTaskMenuAtElement(
		options: TaskNotesRuntimeTaskMenuShowAtElementOptions
	): Promise<void> {
		const contextMenu = await this.buildTaskContextMenu(options);
		contextMenu.showAtElement(options.element);
	}

	private async populateTaskMenu(
		menu: Menu,
		options: TaskNotesRuntimeTaskMenuOptions
	): Promise<void> {
		const task = await this.requireTask(options.taskPath);
		TaskContextMenu.addToMenu(menu, {
			task,
			plugin: this.plugin,
			targetDate: options.targetDate ?? new Date(),
			promoteOccurrenceControls: options.promoteOccurrenceControls,
			onUpdate: options.onUpdate ?? this.defaultTaskMenuUpdateHandler(),
		});
	}

	private async buildTaskContextMenu(
		options: TaskNotesRuntimeTaskMenuOptions
	): Promise<TaskContextMenu> {
		const task = await this.requireTask(options.taskPath);
		return new TaskContextMenu({
			task,
			plugin: this.plugin,
			targetDate: options.targetDate ?? new Date(),
			promoteOccurrenceControls: options.promoteOccurrenceControls,
			onUpdate: options.onUpdate ?? this.defaultTaskMenuUpdateHandler(),
		});
	}

	private defaultTaskMenuUpdateHandler(): () => void {
		return () => {
			this.plugin.app.workspace.trigger("tasknotes:refresh-views");
		};
	}

	private getVaultInfo() {
		const adapter = this.plugin.app.vault.adapter as VaultAdapterWithPath;
		let vaultPath: string | null = null;
		try {
			if (typeof adapter.basePath === "string") {
				vaultPath = adapter.basePath;
			} else if (typeof adapter.path === "string") {
				vaultPath = adapter.path;
			}
		} catch {
			vaultPath = null;
		}

		return {
			name: this.plugin.app.vault.getName(),
			path: vaultPath,
		};
	}

	private computeTaskStats(tasks: TaskInfo[]): TaskNotesRuntimeTaskStats {
		const statusCounts: Record<string, number> = {};
		const priorityCounts: Record<string, number> = {};
		let completed = 0;
		let active = 0;
		let overdue = 0;
		let archived = 0;
		let withTimeEntries = 0;
		let totalTrackedMinutes = 0;
		const today = new Date().toISOString().split("T")[0] ?? "";

		for (const task of tasks) {
			statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
			priorityCounts[task.priority] = (priorityCounts[task.priority] ?? 0) + 1;
			const isCompleted = this.plugin.statusManager.isCompletedStatus(task.status);
			if (isCompleted) completed++;
			if (task.archived) archived++;
			if (!isCompleted && !task.archived) active++;
			if (task.due && task.due < today && !isCompleted && !task.archived) overdue++;
			if (task.timeEntries?.length) {
				withTimeEntries++;
				totalTrackedMinutes += task.totalTrackedTime ?? 0;
			}
		}

		return {
			total: tasks.length,
			statusCounts,
			priorityCounts,
			completed,
			active,
			overdue,
			archived,
			withTimeEntries,
			totalTrackedMinutes,
			totalTrackedHours: Math.round((totalTrackedMinutes / 60) * 100) / 100,
		};
	}

	async getTask(path: string): Promise<TaskInfo | null> {
		const task = await this.plugin.cacheManager.getTaskInfo(this.normalizeTaskPath(path));
		return task ? copyTaskInfo(task) : null;
	}

	async listTasks(query?: TaskNotesRuntimeTaskQuery): Promise<TaskInfo[]> {
		if (!query) {
			const tasks = await this.plugin.cacheManager.getAllTasks();
			return tasks.map(copyTaskInfo);
		}
		return (await this.queryTasks(query)).tasks;
	}

	async getParentTasks(path: string): Promise<TaskInfo[]> {
		const task = await this.requireTask(path);
		const parents: TaskInfo[] = [];

		for (const project of task.projects ?? []) {
			const parent = await this.resolveTaskReference(project, task.path);
			if (parent) parents.push(parent);
		}

		return uniqueTasks(parents).map(copyTaskInfo);
	}

	async getSubtasks(path: string): Promise<TaskInfo[]> {
		const task = await this.requireTask(path);
		const allTasks = await this.plugin.cacheManager.getAllTasks();
		const subtasks: TaskInfo[] = [];

		for (const candidate of allTasks) {
			if (candidate.path === task.path) continue;
			for (const project of candidate.projects ?? []) {
				if (await this.taskReferenceMatches(project, candidate.path, task.path)) {
					subtasks.push(candidate);
					break;
				}
			}
		}

		return uniqueTasks(subtasks).map(copyTaskInfo);
	}

	async getTaskDependencies(path: string): Promise<ResolvedTaskDependency[]> {
		const task = await this.requireTask(path);
		const dependencies: ResolvedTaskDependency[] = [];

		for (const dependency of task.blockedBy ?? []) {
			const dependencyPath = await this.resolveTaskReferencePath(dependency.uid, task.path);
			const blockingTask = dependencyPath
				? await this.plugin.cacheManager.getTaskInfo(dependencyPath)
				: null;
			dependencies.push({
				dependency: copyTaskDependency(dependency),
				task: blockingTask ? copyTaskInfo(blockingTask) : null,
				path: blockingTask?.path ?? dependencyPath,
			});
		}

		return dependencies;
	}

	async getBlockingTasks(path: string): Promise<TaskInfo[]> {
		const task = await this.requireTask(path);
		const allTasks = await this.plugin.cacheManager.getAllTasks();
		const blocking: TaskInfo[] = [];

		for (const candidate of allTasks) {
			if (candidate.path === task.path) continue;
			for (const dependency of candidate.blockedBy ?? []) {
				if (await this.taskReferenceMatches(dependency.uid, candidate.path, task.path)) {
					blocking.push(candidate);
					break;
				}
			}
		}

		return uniqueTasks(blocking).map(copyTaskInfo);
	}

	async getTaskRelationships(path: string): Promise<TaskNotesTaskRelationships> {
		const task = await this.requireTask(path);
		const [parents, subtasks, dependencies, blocking] = await Promise.all([
			this.getParentTasks(task.path),
			this.getSubtasks(task.path),
			this.getTaskDependencies(task.path),
			this.getBlockingTasks(task.path),
		]);

		return {
			task: copyTaskInfo(task),
			parents,
			subtasks,
			dependencies,
			blocking,
		};
	}

	async createTask(
		taskData: TaskCreationData,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const result = await this.withMutationContext([], context, async () =>
			this.plugin.taskService.createTask(
				{
					...taskData,
					creationContext: taskData.creationContext ?? "api",
				},
				{ applyDefaults: true }
			)
		);
		return copyTaskInfo(result.taskInfo);
	}

	async updateTask(
		path: string,
		patch: TaskNotesTaskPatch,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.updateTask(task, patch)
		);
		return copyTaskInfo(updatedTask);
	}

	async completeTask(
		path: string,
		options?: CompleteTaskOptions,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const targetStatus =
			options?.status ?? this.plugin.statusManager.getCompletedStatuses()[0] ?? "done";

		if (!this.plugin.statusManager.isCompletedStatus(targetStatus)) {
			throw new TaskNotesApiError(
				"invalid_status",
				`Status "${targetStatus}" is not configured as a completed status`,
				{ status: 400, details: { status: targetStatus } }
			);
		}

		if (!options?.status && this.plugin.statusManager.isCompletedStatus(task.status)) {
			return copyTaskInfo(task);
		}

		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.updateProperty(task, "status", targetStatus)
		);
		return copyTaskInfo(updatedTask);
	}

	async rescheduleTask(
		path: string,
		date: string | null,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.updateProperty(task, "scheduled", date ?? undefined)
		);
		return copyTaskInfo(updatedTask);
	}

	async archiveTask(
		path: string,
		archived: boolean,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		if (task.archived === archived) {
			return copyTaskInfo(task);
		}

		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.toggleArchive(task)
		);
		return copyTaskInfo(updatedTask);
	}

	async moveTask(
		path: string,
		targetFolder: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const file = this.requireTaskFile(task.path);
		const normalizedFolder = normalizePath(targetFolder);
		const newPath = normalizedFolder ? `${normalizedFolder}/${file.name}` : file.name;

		if (newPath === task.path) {
			return copyTaskInfo(task);
		}

		return this.withMutationContext([task.path, newPath], context, async () => {
			if (normalizedFolder) {
				await ensureFolderExists(this.plugin.app.vault, normalizedFolder);
			}

			const existingFile = this.plugin.app.vault.getAbstractFileByPath(newPath);
			if (existingFile) {
				throw new TaskNotesApiError(
					"file_already_exists",
					`Cannot move task to "${newPath}" because a file already exists`,
					{ status: 409, details: { path: newPath } }
				);
			}

			await this.plugin.app.fileManager.renameFile(file, newPath);

			const updatedTask = copyTaskInfo({
				...task,
				id: task.id && task.id !== task.path ? task.id : newPath,
				path: newPath,
			});

			this.plugin.cacheManager.clearCacheEntry(task.path);
			this.plugin.cacheManager.updateTaskInfoInCache(newPath, updatedTask);
			this.plugin.emitter.trigger(EVENT_TASK_UPDATED, {
				path: newPath,
				originalTask: task,
				updatedTask,
			});

			return updatedTask;
		});
	}

	async deleteTask(path: string, context?: TaskNotesMutationContext): Promise<void> {
		const task = await this.requireTask(path);
		await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.deleteTask(task)
		);
	}

	async uncompleteTask(
		path: string,
		options?: UncompleteTaskOptions,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const targetStatus = options?.status ?? this.plugin.settings.defaultTaskStatus ?? "open";

		if (!this.plugin.statusManager.isCompletedStatus(task.status) && !options?.status) {
			return copyTaskInfo(task);
		}

		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.updateProperty(task, "status", targetStatus)
		);
		return copyTaskInfo(updatedTask);
	}

	async startTimeEntry(path: string, context?: TaskNotesMutationContext): Promise<void> {
		await this.startTime(path, undefined, context);
	}

	async stopTimeEntry(path: string, context?: TaskNotesMutationContext): Promise<void> {
		await this.stopTime(path, context);
	}

	private async setTaskProperty(
		path: string,
		property: keyof TaskInfo,
		value: unknown,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.updateProperty(task, property, value)
		);
		return copyTaskInfo(updatedTask);
	}

	private async updateStringList(
		path: string,
		property: "tags" | "projects" | "contexts",
		value: string,
		operation: "add" | "remove",
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const existingValues = task[property] ?? [];
		const normalizedValue = value.trim();
		if (!normalizedValue) {
			throw new TaskNotesApiError(
				"invalid_input",
				`TaskNotes API ${operation} ${property} expects a non-empty value`,
				{ status: 400, details: { operation, property } }
			);
		}

		const nextValues =
			operation === "add"
				? Array.from(new Set([...existingValues, normalizedValue]))
				: existingValues.filter((entry) => entry !== normalizedValue);

		return this.updateTask(task.path, { [property]: nextValues }, context);
	}

	private async addReminder(
		path: string,
		reminder: Reminder,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const reminders = [...(task.reminders ?? []), { ...reminder }];
		return this.updateTask(task.path, { reminders }, context);
	}

	private async removeReminder(
		path: string,
		reminderId: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const reminders = (task.reminders ?? []).filter((reminder) => reminder.id !== reminderId);
		return this.updateTask(task.path, { reminders }, context);
	}

	private async addDependency(
		path: string,
		dependency: TaskDependency,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const dependencies = task.blockedBy ?? [];
		const existingIndex = dependencies.findIndex(
			(candidate) => candidate.uid === dependency.uid
		);
		const nextDependencies =
			existingIndex >= 0
				? dependencies.map((candidate, index) =>
						index === existingIndex ? { ...dependency } : { ...candidate }
					)
				: [...dependencies.map((candidate) => ({ ...candidate })), { ...dependency }];

		return this.updateTask(task.path, { blockedBy: nextDependencies }, context);
	}

	private async removeDependency(
		path: string,
		uid: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const dependencies = (task.blockedBy ?? []).filter((dependency) => dependency.uid !== uid);
		return this.updateTask(
			task.path,
			{ blockedBy: dependencies.length > 0 ? dependencies : undefined },
			context
		);
	}

	private async startTime(
		path: string,
		options?: StartTimeEntryOptions,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		let updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.startTimeTracking(task)
		);

		if (options?.description && updatedTask.timeEntries?.length) {
			const timeEntries = updatedTask.timeEntries.map((entry) => ({ ...entry }));
			let activeEntryIndex = -1;
			for (let index = timeEntries.length - 1; index >= 0; index--) {
				if (!timeEntries[index].endTime) {
					activeEntryIndex = index;
					break;
				}
			}
			if (activeEntryIndex >= 0) {
				timeEntries[activeEntryIndex] = {
					...timeEntries[activeEntryIndex],
					description: options.description,
				};
				updatedTask = await this.updateTask(updatedTask.path, { timeEntries }, context);
			}
		}

		return copyTaskInfo(updatedTask);
	}

	private async stopTime(path: string, context?: TaskNotesMutationContext): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.stopTimeTracking(task)
		);
		return copyTaskInfo(updatedTask);
	}

	private async appendTimeEntry(
		path: string,
		entry: TimeEntry,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const timeEntries = [
			...(task.timeEntries ?? []).map((existing) => ({ ...existing })),
			{ ...entry },
		];
		return this.updateTask(task.path, { timeEntries }, context);
	}

	private async deleteTimeEntry(
		path: string,
		entryIndex: number,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.deleteTimeEntry(task, entryIndex)
		);
		return copyTaskInfo(updatedTask);
	}

	async getActiveTimeEntries(): Promise<ActiveTimeEntry[]> {
		const tasks = await this.plugin.cacheManager.getAllTasks();
		const activeEntries: ActiveTimeEntry[] = [];
		for (const task of tasks) {
			for (const [index, entry] of (task.timeEntries ?? []).entries()) {
				if (!entry.endTime) {
					activeEntries.push({
						taskPath: task.path,
						task: copyTaskInfo(task),
						entry: { ...entry },
						index,
					});
				}
			}
		}
		return activeEntries;
	}

	getSettingsSnapshot(): Readonly<TaskNotesSettings> {
		return JSON.parse(JSON.stringify(this.plugin.settings)) as TaskNotesSettings;
	}

	private registerExtension<TApi>(
		extension: TaskNotesRuntimeExtension<TApi>
	): TaskNotesRuntimeExtensionHandle {
		if (!extension || typeof extension !== "object") {
			throw new TaskNotesApiError(
				"extension_invalid",
				"TaskNotes API extension registration expects an object",
				{ status: 400 }
			);
		}
		if (typeof extension.id !== "string" || extension.id.trim().length === 0) {
			throw new TaskNotesApiError(
				"extension_invalid",
				"TaskNotes API extension registration expects a non-empty id",
				{ status: 400 }
			);
		}
		if (extension.api === null || typeof extension.api === "undefined") {
			throw new TaskNotesApiError(
				"extension_invalid",
				"TaskNotes API extension registration expects an api object",
				{ status: 400 }
			);
		}

		const id = extension.id.trim();
		const namespace = this.normalizeExtensionNamespace(extension.namespace);
		if (RESERVED_RUNTIME_EXTENSION_NAMESPACES.has(namespace)) {
			throw new TaskNotesApiError(
				"extension_namespace_reserved",
				`Cannot register TaskNotes API extension namespace "${namespace}"`,
				{ status: 400, details: { namespace } }
			);
		}
		if (this.extensionRegistry.has(namespace)) {
			throw new TaskNotesApiError(
				"extension_namespace_conflict",
				`TaskNotes API extension namespace "${namespace}" is already registered`,
				{ status: 409, details: { namespace } }
			);
		}

		const token = Symbol(namespace);
		const capabilities = Array.from(
			new Set(
				(extension.capabilities ?? []).map((capability) =>
					this.normalizeExtensionCapability(capability)
				)
			)
		);
		const registered: RegisteredRuntimeExtension = {
			id,
			namespace,
			api: extension.api,
			displayName: extension.displayName,
			version: extension.version,
			capabilities,
			token,
		};

		this.extensionRegistry.set(namespace, registered);
		this.emitLifecycle("extension.registered", {
			extension: this.extensionInfo(registered),
		});

		return {
			id,
			namespace,
			unregister: () => {
				const current = this.extensionRegistry.get(namespace);
				if (current?.token === token) {
					this.extensionRegistry.delete(namespace);
					this.emitLifecycle("extension.unregistered", {
						extension: this.extensionInfo(current),
					});
				}
			},
		};
	}

	private getExtension<TApi = unknown>(namespace: string): TApi | undefined {
		return this.extensionRegistry.get(this.normalizeExtensionNamespace(namespace))?.api as
			| TApi
			| undefined;
	}

	private requireExtension<TApi = unknown>(namespace: string): TApi {
		const normalizedNamespace = this.normalizeExtensionNamespace(namespace);
		const extension = this.extensionRegistry.get(normalizedNamespace);
		if (!extension) {
			throw new TaskNotesApiError(
				"extension_not_registered",
				`TaskNotes API extension namespace "${normalizedNamespace}" is not registered`,
				{ status: 404, details: { namespace: normalizedNamespace } }
			);
		}
		return extension.api as TApi;
	}

	private hasExtension(namespace: string): boolean {
		return this.extensionRegistry.has(this.normalizeExtensionNamespace(namespace));
	}

	private listExtensions(): TaskNotesRuntimeExtensionInfo[] {
		return Array.from(this.extensionRegistry.values()).map((extension) =>
			this.extensionInfo(extension)
		);
	}

	private extensionInfo(extension: RegisteredRuntimeExtension): TaskNotesRuntimeExtensionInfo {
		return {
			id: extension.id,
			namespace: extension.namespace,
			displayName: extension.displayName,
			version: extension.version,
			capabilities: [...extension.capabilities],
		};
	}

	private getExtensionCapabilities(): readonly string[] {
		return Array.from(this.extensionRegistry.values()).flatMap((extension) => [
			...extension.capabilities,
		]);
	}

	private normalizeExtensionNamespace(namespace: string): string {
		if (typeof namespace !== "string" || namespace.trim().length === 0) {
			throw new TaskNotesApiError(
				"extension_invalid",
				"TaskNotes API extension namespace must be a non-empty string",
				{ status: 400 }
			);
		}

		const normalizedNamespace = namespace.trim().toLowerCase();
		if (!/^[a-z][a-z0-9._-]*$/.test(normalizedNamespace)) {
			throw new TaskNotesApiError(
				"extension_invalid",
				`TaskNotes API extension namespace "${namespace}" must use letters, numbers, dots, underscores, or dashes`,
				{ status: 400, details: { namespace } }
			);
		}
		return normalizedNamespace;
	}

	private normalizeExtensionCapability(capability: string): string {
		if (typeof capability !== "string" || capability.trim().length === 0) {
			throw new TaskNotesApiError(
				"extension_invalid",
				"TaskNotes API extension capabilities must be non-empty strings",
				{ status: 400 }
			);
		}

		const normalizedCapability = capability.trim().toLowerCase();
		if (!/^[a-z][a-z0-9._:-]*$/.test(normalizedCapability)) {
			throw new TaskNotesApiError(
				"extension_invalid",
				`TaskNotes API extension capability "${capability}" must use letters, numbers, dots, underscores, dashes, or colons`,
				{ status: 400, details: { capability } }
			);
		}
		return normalizedCapability;
	}

	private async startPomodoro(
		options?: PomodoroStartOptions,
		context?: TaskNotesMutationContext
	): Promise<PomodoroState> {
		const task = options?.taskPath ? await this.requireTask(options.taskPath) : undefined;
		await this.withMutationContext(task ? [task.path] : [], context, () =>
			this.plugin.pomodoroService.startPomodoro(task, options?.duration)
		);
		return this.copyPomodoroState(this.plugin.pomodoroService.getState());
	}

	private async stopPomodoro(context?: TaskNotesMutationContext): Promise<PomodoroState> {
		await this.withMutationContext([], context, () =>
			this.plugin.pomodoroService.stopPomodoro()
		);
		return this.copyPomodoroState(this.plugin.pomodoroService.getState());
	}

	private async pausePomodoro(context?: TaskNotesMutationContext): Promise<PomodoroState> {
		await this.withMutationContext([], context, () =>
			this.plugin.pomodoroService.pausePomodoro()
		);
		return this.copyPomodoroState(this.plugin.pomodoroService.getState());
	}

	private async resumePomodoro(context?: TaskNotesMutationContext): Promise<PomodoroState> {
		await this.withMutationContext([], context, () =>
			this.plugin.pomodoroService.resumePomodoro()
		);
		return this.copyPomodoroState(this.plugin.pomodoroService.getState());
	}

	private async assignPomodoroTask(
		path: string | null,
		context?: TaskNotesMutationContext
	): Promise<PomodoroState> {
		const task = path ? await this.requireTask(path) : undefined;
		await this.withMutationContext(task ? [task.path] : [], context, () =>
			this.plugin.pomodoroService.assignTaskToCurrentSession(task)
		);
		return this.copyPomodoroState(this.plugin.pomodoroService.getState());
	}

	private async getPomodoroSessions(
		options?: PomodoroSessionsOptions
	): Promise<PomodoroSessionHistory[]> {
		let sessions = await this.plugin.pomodoroService.getSessionHistory();
		if (options?.date) {
			sessions = sessions.filter(
				(session) =>
					new Date(session.startTime).toISOString().split("T")[0] === options.date
			);
		}
		if (options?.limit && options.limit > 0) {
			sessions = sessions.slice(-options.limit);
		}
		return sessions.map((session) => ({ ...session }));
	}

	private getPomodoroStats(date?: string): Promise<PomodoroHistoryStats> {
		if (date) {
			return this.plugin.pomodoroService.getStatsForDate(new Date(date));
		}
		return this.plugin.pomodoroService.getTodayStats();
	}

	private copyPomodoroState(state: PomodoroState): PomodoroState {
		return JSON.parse(JSON.stringify(state)) as PomodoroState;
	}

	private async toggleRecurringComplete(
		path: string,
		date?: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const targetDate = date ? new Date(date) : undefined;
		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.toggleRecurringTaskCompleteWithOccurrenceNotes(
				task,
				targetDate
			)
		);
		return copyTaskInfo(updatedTask);
	}

	private async materializeOccurrence(
		path: string,
		date: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const occurrence = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.materializeOccurrence(task, date)
		);
		return copyTaskInfo(occurrence);
	}

	private async toggleRecurringSkipped(
		path: string,
		date?: string,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo> {
		const task = await this.requireTask(path);
		const targetDate = date ? new Date(date) : undefined;
		const updatedTask = await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.toggleRecurringTaskSkipped(task, targetDate)
		);
		return copyTaskInfo(updatedTask);
	}

	on<EventName extends TaskNotesRuntimeEventName>(
		event: EventName,
		handler: TaskNotesApiEventHandler<EventName>
	): EventRef {
		const rawEvent = getRawEventForRuntimeEvent(event);
		return this.plugin.emitter.on(rawEvent, (payload: unknown) => {
			const apiEvents = this.normalizeRawEvent(rawEvent, payload);

			for (const apiEvent of apiEvents) {
				if (apiEvent.event === event) {
					handler(apiEvent as Parameters<TaskNotesApiEventHandler<EventName>>[0]);
				}
			}
		});
	}

	onLifecycle<EventName extends TaskNotesRuntimeLifecycleEventName>(
		event: EventName,
		handler: TaskNotesRuntimeLifecycleHandler<EventName>
	): EventRef {
		const rawEvent = TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS[event];
		const ref = this.plugin.emitter.on(rawEvent, (payload: unknown) => {
			handler(
				this.normalizeLifecycleEvent(
					event,
					rawEvent,
					payload
				) as TaskNotesRuntimeLifecyclePayload & {
					event: EventName;
				}
			);
		});

		if (event === "ready") {
			void this.plugin.onReady().then(() => {
				handler(
					this.normalizeLifecycleEvent(
						event,
						rawEvent,
						undefined
					) as TaskNotesRuntimeLifecyclePayload & {
						event: EventName;
					}
				);
			});
		}

		return ref;
	}

	emitLifecycle(
		event: TaskNotesRuntimeLifecycleEventName,
		payload: Record<string, unknown> = {}
	): void {
		this.plugin.emitter.trigger(TASKNOTES_RUNTIME_LIFECYCLE_RAW_EVENTS[event], {
			...payload,
			timestamp: new Date().toISOString(),
		});
	}

	off(ref: EventRef): void {
		this.plugin.emitter.offref(ref);
	}

	private async resolveTaskReference(
		reference: string,
		sourcePath: string
	): Promise<TaskInfo | null> {
		const path = await this.resolveTaskReferencePath(reference, sourcePath);
		return path ? await this.plugin.cacheManager.getTaskInfo(path) : null;
	}

	private async taskReferenceMatches(
		reference: string,
		sourcePath: string,
		targetPath: string
	): Promise<boolean> {
		const path = await this.resolveTaskReferencePath(reference, sourcePath);
		return path === normalizePath(targetPath);
	}

	private async resolveTaskReferencePath(
		reference: string,
		sourcePath: string
	): Promise<string | null> {
		const linkPath = firstReferencePathCandidate(reference);
		if (!linkPath) return null;

		type Nullable<T> = T | null;
		type MetadataCacheWithLinkResolver = {
			getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => Nullable<TFile>;
		};
		const metadataCache = this.plugin.app.metadataCache as MetadataCacheWithLinkResolver | undefined;
		const resolvedFile = metadataCache?.getFirstLinkpathDest?.(linkPath, sourcePath);
		if (resolvedFile instanceof TFile) return normalizePath(resolvedFile.path);

		for (const candidate of taskReferencePathCandidates(linkPath)) {
			const task = await this.plugin.cacheManager.getTaskInfo(candidate);
			if (task) return task.path;
		}

		return normalizePath(linkPath);
	}

	private async requireTask(path: string): Promise<TaskInfo> {
		const normalizedPath = this.normalizeTaskPath(path);
		const task = await this.plugin.cacheManager.getTaskInfo(normalizedPath);
		if (!task) {
			throw new TaskNotesApiError("task_not_found", `Task not found: ${normalizedPath}`, {
				status: 404,
				details: { path: normalizedPath },
			});
		}
		return task;
	}

	private requireTaskFile(path: string): TFile {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			throw new TaskNotesApiError("task_file_not_found", `Cannot find task file: ${path}`, {
				status: 404,
				details: { path },
			});
		}
		return file;
	}

	private normalizeTaskPath(path: string): string {
		if (typeof path !== "string" || path.trim().length === 0) {
			throw new TaskNotesApiError(
				"invalid_task_path",
				"TaskNotes API expects a non-empty task path",
				{ status: 400 }
			);
		}
		return normalizePath(path);
	}

	private async withMutationContext<T>(
		paths: string[],
		context: TaskNotesMutationContext | undefined,
		operation: () => Promise<T>
	): Promise<T> {
		if (!context) {
			return operation();
		}

		const normalizedPaths = paths.map((path) => normalizePath(path));
		for (const path of normalizedPaths) {
			const contexts = this.mutationContextByPath.get(path) ?? [];
			contexts.push(context);
			this.mutationContextByPath.set(path, contexts);
		}
		this.mutationContextStack.push(context);

		try {
			return await operation();
		} finally {
			for (const path of normalizedPaths) {
				const contexts = this.mutationContextByPath.get(path);
				contexts?.pop();
				if (!contexts?.length) {
					this.mutationContextByPath.delete(path);
				}
			}
			this.mutationContextStack.pop();
		}
	}

	private normalizeUpdatedEvent(payload: TaskUpdatedEventPayload): TaskNotesApiEventPayload[] {
		const before = payload.originalTask ? copyTaskInfo(payload.originalTask) : undefined;
		const after = payload.updatedTask ? copyTaskInfo(payload.updatedTask) : undefined;
		const taskPath = after?.path ?? before?.path ?? payload.path ?? "";
		const changes = buildTaskChanges(before, after);
		const context = this.getMutationContext(payload);
		const common = this.buildEventPayloadBase({
			taskPath,
			before,
			after,
			task: after,
			changes,
			context,
			rawEvent: EVENT_TASK_UPDATED,
		});

		const events: TaskNotesApiEventPayload[] = [];

		if (!before && after) {
			events.push({ ...common, event: "task.created" });
		}

		events.push({ ...common, event: "task.updated" });

		if (before && after && before.path !== after.path) {
			events.push({ ...common, event: "task.moved" });
		}

		if (before && after && before.status !== after.status) {
			events.push({ ...common, event: "task.status.changed" });

			const wasCompleted = this.plugin.statusManager.isCompletedStatus(before.status);
			const isCompleted = this.plugin.statusManager.isCompletedStatus(after.status);
			if (!wasCompleted && isCompleted) {
				events.push({ ...common, event: "task.completed" });
			} else if (wasCompleted && !isCompleted) {
				events.push({ ...common, event: "task.uncompleted" });
			}
		}

		if (before && after && before.archived !== after.archived) {
			events.push({
				...common,
				event: after.archived ? "task.archived" : "task.unarchived",
			});
		}

		if (before && after && before.scheduled !== after.scheduled) {
			events.push({ ...common, event: "task.scheduled.changed" });
		}

		if (before && after && before.due !== after.due) {
			events.push({ ...common, event: "task.due.changed" });
		}

		if (before && after && before.priority !== after.priority) {
			events.push({ ...common, event: "task.priority.changed" });
		}

		if (before && after && !areValuesEqual(before.tags ?? [], after.tags ?? [])) {
			events.push({ ...common, event: "task.tags.changed" });
		}

		if (before && after && !areValuesEqual(before.contexts ?? [], after.contexts ?? [])) {
			events.push({ ...common, event: "task.contexts.changed" });
		}

		if (before && after && !areValuesEqual(before.projects ?? [], after.projects ?? [])) {
			events.push({ ...common, event: "task.projects.changed" });
		}

		if (before && after && !areValuesEqual(before.reminders ?? [], after.reminders ?? [])) {
			events.push({ ...common, event: "task.reminders.changed" });
		}

		if (before && after && !areValuesEqual(before.blockedBy ?? [], after.blockedBy ?? [])) {
			events.push({ ...common, event: "task.dependencies.changed" });
		}

		if (before && after && before.recurrence !== after.recurrence) {
			events.push({ ...common, event: "task.recurrence.changed" });
		}

		if (
			before &&
			after &&
			hasNewArrayValue(before.complete_instances, after.complete_instances)
		) {
			events.push({ ...common, event: "recurring.instance.completed" });
		}

		if (
			before &&
			after &&
			hasNewArrayValue(before.skipped_instances, after.skipped_instances)
		) {
			events.push({ ...common, event: "recurring.instance.skipped" });
		}

		if (before && after && getActiveTimeEntryCount(before) !== getActiveTimeEntryCount(after)) {
			events.push({
				...common,
				event:
					getActiveTimeEntryCount(after) > getActiveTimeEntryCount(before)
						? "time.started"
						: "time.stopped",
			});
		}

		return events;
	}

	private normalizeDeletedEvent(payload: TaskDeletedEventPayload): TaskNotesApiEventPayload[] {
		const deletedTask = payload.deletedTask ? copyTaskInfo(payload.deletedTask) : undefined;
		const taskPath = deletedTask?.path ?? payload.path ?? "";
		const context = this.getMutationContext(payload);

		return [
			this.buildEventPayloadBase({
				event: "task.deleted",
				taskPath,
				deletedTask,
				task: deletedTask,
				changes: {},
				context,
				rawEvent: EVENT_TASK_DELETED,
			}),
		];
	}

	private normalizeLifecycleEvent(
		event: TaskNotesRuntimeLifecycleEventName,
		rawEvent: string,
		payload: unknown
	): TaskNotesRuntimeLifecyclePayload {
		const record = isRecord(payload) ? payload : {};
		const extension = isRecord(record.extension)
			? (record.extension as unknown as TaskNotesRuntimeLifecyclePayload["extension"])
			: undefined;
		return {
			event,
			timestamp:
				typeof record.timestamp === "string" ? record.timestamp : new Date().toISOString(),
			data: record.data ?? payload,
			settings: event === "settings.changed" ? this.getSettingsSnapshot() : undefined,
			extension,
			filePath: typeof record.filePath === "string" ? record.filePath : undefined,
			force: typeof record.force === "boolean" ? record.force : undefined,
			rawEvent,
		};
	}

	private buildEventPayloadBase(
		payload: Partial<Omit<TaskNotesApiEventPayload, "event" | "timestamp">> & {
			event?: TaskNotesApiEvent;
			changes: TaskNotesApiChanges;
			rawEvent: string;
		}
	): TaskNotesApiEventPayload {
		return {
			event: payload.event ?? "task.updated",
			timestamp: new Date().toISOString(),
			taskPath: payload.taskPath,
			task: payload.task,
			before: payload.before,
			after: payload.after,
			deletedTask: payload.deletedTask,
			changes: payload.changes,
			data: payload.data,
			context: payload.context,
			source: payload.context?.source,
			correlationId: payload.context?.correlationId,
			reason: payload.context?.reason,
			rawEvent: payload.rawEvent,
		};
	}

	private getMutationContext(
		payload: TaskUpdatedEventPayload | TaskDeletedEventPayload
	): TaskNotesMutationContext | undefined {
		const candidates = [
			payload.path,
			"originalTask" in payload ? payload.originalTask?.path : undefined,
			"updatedTask" in payload ? payload.updatedTask?.path : undefined,
			"deletedTask" in payload ? payload.deletedTask?.path : undefined,
		]
			.filter((path): path is string => !!path)
			.map((path) => normalizePath(path));

		for (const path of candidates) {
			const contexts = this.mutationContextByPath.get(path);
			const context = contexts?.[contexts.length - 1];
			if (context) {
				return context;
			}
		}

		return this.mutationContextStack[this.mutationContextStack.length - 1];
	}

	private normalizeRawEvent(rawEvent: string, payload: unknown): TaskNotesApiEventPayload[] {
		if (rawEvent === EVENT_TASK_DELETED) {
			return this.normalizeDeletedEvent(payload as TaskDeletedEventPayload);
		}
		if (rawEvent === EVENT_POMODORO_START) {
			return this.normalizePomodoroEvent("pomodoro.started", rawEvent, payload);
		}
		if (rawEvent === EVENT_POMODORO_COMPLETE) {
			return this.normalizePomodoroEvent("pomodoro.completed", rawEvent, payload);
		}
		if (rawEvent === EVENT_POMODORO_INTERRUPT) {
			return this.normalizePomodoroEvent("pomodoro.interrupted", rawEvent, payload);
		}
		return this.normalizeUpdatedEvent(payload as TaskUpdatedEventPayload);
	}

	private normalizePomodoroEvent(
		event: TaskNotesApiEvent,
		rawEvent: string,
		payload: unknown
	): TaskNotesApiEventPayload[] {
		const data = payload as { task?: TaskInfo; session?: { taskPath?: string } };
		const task = data.task ? copyTaskInfo(data.task) : undefined;
		const taskPath = task?.path ?? data.session?.taskPath;
		const context = this.mutationContextStack[this.mutationContextStack.length - 1];

		return [
			this.buildEventPayloadBase({
				event,
				taskPath,
				task,
				changes: {},
				data: payload,
				context,
				rawEvent,
			}),
		];
	}
}

function firstReferencePathCandidate(reference: string): string | null {
	const parsed = parseLinkToPath(reference).trim();
	return parsed ? normalizePath(parsed) : null;
}

type RuntimeQueryExecution = {
	filterQuery: FilterQuery;
	normalized: TaskNotesRuntimeNormalizedTaskQuery;
	validation: TaskNotesRuntimeQueryValidationResult;
};

type ResolvedRuntimeQueryField = {
	definition: TaskNotesRuntimeFilterPropertyDefinition;
	internalProperty: FilterProperty;
};

function runtimeFilterProperty(
	id: string,
	internalProperty: FilterProperty,
	label: string,
	category: string,
	valueType: TaskNotesRuntimeFieldDefinition["valueType"],
	source: TaskNotesRuntimeFieldDefinition["source"],
	options: {
		aliases?: readonly string[];
		sortable?: boolean;
		groupable?: boolean;
		valueInputType?: string;
	} = {}
): RuntimeFilterPropertyDefinition {
	const internalPropertyDefinition = FILTER_PROPERTIES.find(
		(property) => property.id === internalProperty
	);
	return {
		id,
		internalProperty,
		label,
		category,
		valueType,
		source,
		queryable: true,
		sortable: options.sortable ?? false,
		groupable: options.groupable ?? false,
		supportedOperators: runtimeOperatorsFromLegacy(
			internalPropertyDefinition?.supportedOperators ??
				operatorsForRuntimeValueType(valueType)
		),
		aliases: options.aliases,
		valueInputType:
			options.valueInputType ?? internalPropertyDefinition?.valueInputType ?? "text",
	};
}

function runtimeFilterPropertyForInternal(
	internalProperty: string
): RuntimeFilterPropertyDefinition | undefined {
	return RUNTIME_FILTER_PROPERTY_DEFINITIONS.find(
		(definition) => definition.internalProperty === internalProperty
	);
}

function runtimeOperatorsFromLegacy(
	operators: readonly (FilterOperator | TaskNotesRuntimeOperator)[]
): TaskNotesRuntimeOperator[] {
	const normalizedOperators = operators
		.map((operator) => normalizeRuntimeOperator(operator))
		.filter(isDefined);
	if (normalizedOperators.includes("eq")) normalizedOperators.push("in");
	if (normalizedOperators.includes("ne")) normalizedOperators.push("notIn");
	return Array.from(new Set(normalizedOperators));
}

function operatorsForRuntimeValueType(
	valueType: TaskNotesRuntimeFieldDefinition["valueType"]
): TaskNotesRuntimeOperator[] {
	if (valueType === "boolean") return ["isTrue", "isFalse"];
	if (valueType === "number") {
		return ["eq", "ne", "in", "notIn", "lt", "lte", "gt", "gte", "exists", "missing"];
	}
	if (valueType === "date" || valueType === "datetime") {
		return ["eq", "ne", "in", "notIn", "lt", "lte", "gt", "gte", "exists", "missing"];
	}
	if (valueType.endsWith("[]")) {
		return ["contains", "notContains", "exists", "missing"];
	}
	return ["eq", "ne", "in", "notIn", "contains", "notContains", "exists", "missing"];
}

function userFieldTypeToFilterInputType(type: string): string {
	if (type === "number") return "number";
	if (type === "date") return "date";
	if (type === "boolean") return "none";
	if (type === "list") return "multi-select";
	return "text";
}

function normalizeRuntimeOperator(value: unknown): TaskNotesRuntimeOperator | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	const exact = RUNTIME_OPERATOR_BY_ALIAS.get(normalized);
	if (exact) return exact;
	if ((TASKNOTES_RUNTIME_QUERY_OPERATORS as readonly string[]).includes(normalized)) {
		return normalized as TaskNotesRuntimeOperator;
	}
	return null;
}

function runtimeOperatorRequiresValue(operator: TaskNotesRuntimeOperator): boolean {
	return !["exists", "missing", "isTrue", "isFalse"].includes(operator);
}

function emptyRuntimeTaskQuery(): TaskNotesRuntimeNormalizedTaskQuery {
	return {
		sort: [],
		offset: 0,
		group: [],
		scope: { includeArchived: true },
	};
}

function normalizeRuntimeLimit(
	value: unknown,
	path: string,
	issues: TaskNotesRuntimeQueryIssue[]
): number | undefined {
	if (typeof value === "undefined" || value === null) return undefined;
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
		issues.push({
			path,
			code: "limit_invalid",
			message: "Runtime query limit must be a positive integer.",
		});
		return undefined;
	}
	return value;
}

function normalizeRuntimeOffset(
	value: unknown,
	path: string,
	issues: TaskNotesRuntimeQueryIssue[]
): number {
	if (typeof value === "undefined" || value === null) return 0;
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		issues.push({
			path,
			code: "offset_invalid",
			message: "Runtime query offset must be a non-negative integer.",
		});
		return 0;
	}
	return value;
}

function normalizeRuntimeScope(
	value: unknown,
	issues: TaskNotesRuntimeQueryIssue[]
): TaskNotesRuntimeNormalizedTaskQuery["scope"] {
	if (typeof value === "undefined" || value === null) return { includeArchived: true };
	if (!isRecord(value)) {
		issues.push({
			path: "$.scope",
			code: "scope_not_object",
			message: "Runtime query scope must be an object.",
		});
		return { includeArchived: true };
	}

	return {
		includeArchived: value["includeArchived"] !== false,
		folders: normalizeFolderList(value["folders"], "$.scope.folders", issues),
		excludeFolders: normalizeFolderList(
			value["excludeFolders"],
			"$.scope.excludeFolders",
			issues
		),
	};
}

function normalizeFolderList(
	value: unknown,
	path: string,
	issues: TaskNotesRuntimeQueryIssue[]
): string[] | undefined {
	if (typeof value === "undefined") return undefined;
	if (!Array.isArray(value)) {
		issues.push({
			path,
			code: "folder_list_invalid",
			message: "Runtime query folder scope must be an array of folder paths.",
		});
		return undefined;
	}

	const folders = value
		.map((folder, index) => {
			if (typeof folder !== "string" || folder.trim().length === 0) {
				issues.push({
					path: `${path}.${index}`,
					code: "folder_invalid",
					message: "Runtime query folder path must be a non-empty string.",
				});
				return null;
			}
			return normalizePath(folder);
		})
		.filter(isDefined);
	return folders.length > 0 ? folders : undefined;
}

function normalizeRuntimeValue(value: unknown): TaskNotesRuntimeValue {
	if (Array.isArray(value)) return value.map(normalizeRuntimeValue);
	if (isRecord(value)) {
		const fn = value["fn"];
		if (fn === "today") return { fn: "today" };
		if (fn === "now") return { fn: "now" };
		if (fn === "date" && typeof value["value"] === "string") {
			return { fn: "date", value: value["value"] };
		}
		if (
			fn === "dateAdd" &&
			Number.isFinite(value["amount"]) &&
			(value["unit"] === "day" || value["unit"] === "week" || value["unit"] === "month")
		) {
			return {
				fn: "dateAdd",
				value: normalizeRuntimeValue(value["value"]),
				amount: Number(value["amount"]),
				unit: value["unit"],
			};
		}
	}
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null
	) {
		return value;
	}
	return stringifyUnknownValue(value);
}

function toFilterConditionValue(
	value: TaskNotesRuntimeValue | undefined
): FilterCondition["value"] {
	if (typeof value === "undefined") return null;
	if (Array.isArray(value)) {
		return value.map((entry) => String(toFilterConditionValue(entry)));
	}
	if (isRecord(value)) {
		if (value["fn"] === "today") return "today";
		if (value["fn"] === "now") return new Date().toISOString();
		if (value["fn"] === "date" && typeof value["value"] === "string") return value["value"];
		if (value["fn"] === "dateAdd") return dateAddRuntimeValue(value);
	}
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null
	) {
		return value;
	}
	return stringifyUnknownValue(value);
}

function stringifyUnknownValue(value: unknown): string {
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	) {
		return String(value);
	}
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return "";
	}
}

function dateAddRuntimeValue(value: {
	fn: "dateAdd";
	value: TaskNotesRuntimeValue;
	amount: number;
	unit: "day" | "week" | "month";
}): string {
	const baseValue = toFilterConditionValue(value.value);
	const base =
		baseValue === "today"
			? new Date()
			: typeof baseValue === "string"
				? new Date(baseValue)
				: new Date();
	if (value.unit === "day") base.setDate(base.getDate() + value.amount);
	if (value.unit === "week") base.setDate(base.getDate() + value.amount * 7);
	if (value.unit === "month") base.setMonth(base.getMonth() + value.amount);
	return base.toISOString().slice(0, 10);
}

function invertRuntimePredicate(
	predicate: TaskNotesRuntimeNormalizedPredicate
): TaskNotesRuntimeNormalizedPredicate | null {
	if ("all" in predicate) {
		return { any: predicate.all.map(invertRuntimePredicate).filter(isDefined) };
	}
	if ("any" in predicate) {
		return { all: predicate.any.map(invertRuntimePredicate).filter(isDefined) };
	}
	if ("not" in predicate) return predicate.not;
	const invertedOperator = invertRuntimeOperator(predicate.op);
	return invertedOperator ? { ...predicate, op: invertedOperator } : null;
}

function invertRuntimeOperator(
	operator: TaskNotesRuntimeOperator
): TaskNotesRuntimeOperator | null {
	const inverses: Partial<Record<TaskNotesRuntimeOperator, TaskNotesRuntimeOperator>> = {
		eq: "ne",
		ne: "eq",
		contains: "notContains",
		notContains: "contains",
		in: "notIn",
		notIn: "in",
		exists: "missing",
		missing: "exists",
		lt: "gte",
		lte: "gt",
		gt: "lte",
		gte: "lt",
		isTrue: "isFalse",
		isFalse: "isTrue",
	};
	return inverses[operator] ?? null;
}

function applyRuntimeQueryScope(
	tasks: TaskInfo[],
	scope: TaskNotesRuntimeNormalizedTaskQuery["scope"]
): TaskInfo[] {
	return tasks.filter((task) => {
		if (!scope.includeArchived && task.archived) return false;
		if (scope.folders && !scope.folders.some((folder) => taskIsInFolder(task, folder))) {
			return false;
		}
		if (scope.excludeFolders?.some((folder) => taskIsInFolder(task, folder))) return false;
		return true;
	});
}

function taskIsInFolder(task: TaskInfo, folder: string): boolean {
	const normalizedFolder = normalizePath(folder);
	if (!normalizedFolder) return true;
	return task.path === normalizedFolder || task.path.startsWith(`${normalizedFolder}/`);
}

function runtimeQueryGroups(
	groupedTasks: Map<string, TaskInfo[]>,
	returnedPaths: Set<string>
): TaskNotesRuntimeQueryGroup[] {
	const groups: TaskNotesRuntimeQueryGroup[] = [];
	for (const [key, tasks] of groupedTasks.entries()) {
		const taskPaths = tasks.map((task) => task.path).filter((path) => returnedPaths.has(path));
		if (taskPaths.length > 0) groups.push({ key, label: key, taskPaths });
	}
	return groups;
}

function runtimeNodeId(path: string): string {
	return `runtime:${path.replace(/[^a-z0-9._-]+/giu, "-")}`;
}

function isDefined<T>(value: T | null | undefined): value is T {
	return value !== null && typeof value !== "undefined";
}

function taskReferencePathCandidates(path: string): string[] {
	const normalizedPath = normalizePath(path);
	const candidates = [normalizedPath];
	if (!/\.md$/iu.test(normalizedPath)) {
		candidates.push(`${normalizedPath}.md`);
	}
	return candidates;
}

function uniqueTasks(tasks: TaskInfo[]): TaskInfo[] {
	const seen = new Set<string>();
	const unique: TaskInfo[] = [];
	for (const task of tasks) {
		if (seen.has(task.path)) continue;
		seen.add(task.path);
		unique.push(task);
	}
	return unique;
}

function copyTaskDependency(dependency: TaskDependency): TaskDependency {
	return { ...dependency };
}

function userFieldTypeToRuntimeValueType(
	type: string
): TaskNotesRuntimeFieldDefinition["valueType"] {
	switch (type) {
		case "number":
			return "number";
		case "date":
			return "date";
		case "boolean":
			return "boolean";
		case "list":
			return "string[]";
		case "text":
		default:
			return "string";
	}
}

function coerceDateOption(value: string | Date | null | undefined): Date | null {
	if (!value) return null;
	return value instanceof Date ? value : new Date(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildTaskChanges(before?: TaskInfo, after?: TaskInfo): TaskNotesApiChanges {
	const changes: TaskNotesApiChanges = {};
	const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);

	for (const key of keys) {
		if (key === "basesData") {
			continue;
		}

		const beforeValue = before?.[key as keyof TaskInfo];
		const afterValue = after?.[key as keyof TaskInfo];
		if (!areValuesEqual(beforeValue, afterValue)) {
			changes[key] = {
				before: beforeValue,
				after: afterValue,
			};
		}
	}

	return changes;
}

function areValuesEqual(before: unknown, after: unknown): boolean {
	if (Object.is(before, after)) {
		return true;
	}

	if (
		typeof before !== "object" ||
		before === null ||
		typeof after !== "object" ||
		after === null
	) {
		return false;
	}

	try {
		return JSON.stringify(before) === JSON.stringify(after);
	} catch {
		return false;
	}
}

function getActiveTimeEntryCount(task: TaskInfo): number {
	return (task.timeEntries ?? []).filter((entry) => !entry.endTime).length;
}

function hasNewArrayValue(before: string[] | undefined, after: string[] | undefined): boolean {
	const beforeValues = new Set(before ?? []);
	return (after ?? []).some((value) => !beforeValues.has(value));
}

function getRawEventForRuntimeEvent(event: TaskNotesRuntimeEventName): string {
	if (event === "task.deleted") {
		return EVENT_TASK_DELETED;
	}
	if (event === "pomodoro.started") {
		return EVENT_POMODORO_START;
	}
	if (event === "pomodoro.completed") {
		return EVENT_POMODORO_COMPLETE;
	}
	if (event === "pomodoro.interrupted") {
		return EVENT_POMODORO_INTERRUPT;
	}
	return EVENT_TASK_UPDATED;
}

function copyTaskInfo(task: TaskInfo): TaskInfo {
	const copy = { ...task };

	if (task.tags) {
		copy.tags = [...task.tags];
	}
	if (task.contexts) {
		copy.contexts = [...task.contexts];
	}
	if (task.projects) {
		copy.projects = [...task.projects];
	}
	if (task.complete_instances) {
		copy.complete_instances = [...task.complete_instances];
	}
	if (task.skipped_instances) {
		copy.skipped_instances = [...task.skipped_instances];
	}
	if (task.icsEventId) {
		copy.icsEventId = [...task.icsEventId];
	}
	if (task.googleCalendarMovedOriginalDates) {
		copy.googleCalendarMovedOriginalDates = [...task.googleCalendarMovedOriginalDates];
	}
	if (task.reminders) {
		copy.reminders = task.reminders.map((reminder) => ({ ...reminder }));
	}
	if (task.timeEntries) {
		copy.timeEntries = task.timeEntries.map((entry) => ({ ...entry }));
	}
	if (task.blockedBy) {
		copy.blockedBy = task.blockedBy.map((dependency) => ({ ...dependency }));
	}
	if (task.blocking) {
		copy.blocking = [...task.blocking];
	}
	if (task.customProperties) {
		copy.customProperties = { ...task.customProperties };
	}

	return copy;
}
