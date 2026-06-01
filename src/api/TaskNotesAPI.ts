import { normalizePath, TFile, type EventRef } from "obsidian";
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
	FilterQuery,
	FILTER_PROPERTIES,
	PomodoroHistoryStats,
	PomodoroSessionHistory,
	PomodoroState,
	Reminder,
	TaskCreationData,
	TaskDependency,
	TaskInfo,
	TimeEntry,
} from "../types";
import {
	EVENT_POMODORO_COMPLETE,
	EVENT_POMODORO_INTERRUPT,
	EVENT_POMODORO_START,
	EVENT_TASK_DELETED,
	EVENT_TASK_UPDATED,
} from "../types";
import type { TaskNotesSettings } from "../types/settings";
import { ensureFolderExists } from "../utils/helpers";
import { parseLinkToPath } from "../utils/linkUtils";
import { computeTaskTimeData, computeTimeSummary } from "../utils/timeTrackingUtils";
import {
	TASKNOTES_RUNTIME_API_CAPABILITIES,
	TASKNOTES_RUNTIME_EVENT_DEFINITIONS,
	TASKNOTES_RUNTIME_API_VERSION,
	type ActiveTimeEntry,
	type CompleteTaskOptions,
	type PomodoroSessionsOptions,
	type PomodoroStartOptions,
	type ResolvedTaskDependency,
	type StartTimeEntryOptions,
	type TaskNotesRuntimeDependencyRelTypeDefinition,
	type TaskNotesRuntimeFieldDefinition,
	type TaskNotesRuntimeFilterOperatorDefinition,
	type TaskNotesRuntimeFilterPropertyDefinition,
	type TaskNotesRuntimeHealth,
	type TaskNotesRuntimeRelationshipDefinition,
	type TaskNotesRuntimeTaskQueryResult,
	type TaskNotesRuntimeTaskStats,
	type TaskNotesRuntimeTaskTimeData,
	type TaskNotesRuntimeTimeSummary,
	type TaskNotesRuntimeTimeSummaryOptions,
	type TaskNotesApiChanges,
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
		id: "is",
		label: "is",
		valueRequired: true,
		appliesTo: ["text", "select", "date", "numeric"],
	},
	{
		id: "is-not",
		label: "is not",
		valueRequired: true,
		appliesTo: ["text", "select", "date", "numeric"],
	},
	{ id: "contains", label: "contains", valueRequired: true, appliesTo: ["text", "select"] },
	{
		id: "does-not-contain",
		label: "does not contain",
		valueRequired: true,
		appliesTo: ["text", "select"],
	},
	{ id: "is-before", label: "is before", valueRequired: true, appliesTo: ["date"] },
	{ id: "is-after", label: "is after", valueRequired: true, appliesTo: ["date"] },
	{ id: "is-on-or-before", label: "is on or before", valueRequired: true, appliesTo: ["date"] },
	{ id: "is-on-or-after", label: "is on or after", valueRequired: true, appliesTo: ["date"] },
	{
		id: "is-empty",
		label: "is empty",
		valueRequired: false,
		appliesTo: ["text", "select", "date", "numeric"],
	},
	{
		id: "is-not-empty",
		label: "is not empty",
		valueRequired: false,
		appliesTo: ["text", "select", "date", "numeric"],
	},
	{ id: "is-checked", label: "is checked", valueRequired: false, appliesTo: ["boolean"] },
	{ id: "is-not-checked", label: "is not checked", valueRequired: false, appliesTo: ["boolean"] },
	{
		id: "is-greater-than",
		label: "is greater than",
		valueRequired: true,
		appliesTo: ["numeric"],
	},
	{ id: "is-less-than", label: "is less than", valueRequired: true, appliesTo: ["numeric"] },
	{
		id: "is-greater-than-or-equal",
		label: "is greater than or equal",
		valueRequired: true,
		appliesTo: ["numeric"],
	},
	{
		id: "is-less-than-or-equal",
		label: "is less than or equal",
		valueRequired: true,
		appliesTo: ["numeric"],
	},
];

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
		list: (query?: FilterQuery) => this.listTasks(query),
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

	readonly nlp = {
		parse: (text: string) => this.parseNaturalLanguage(text),
	};

	readonly query = {
		tasks: (query?: FilterQuery) => this.queryTasks(query),
		filterOptions: () => this.getFilterOptions(),
	};

	readonly stats = {
		tasks: (query?: FilterQuery) => this.getTaskStats(query),
	};

	readonly system = {
		health: () => this.getHealth(),
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
			throw new TypeError("TaskNotes API parseNaturalLanguage expects a string");
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
			return {
				...field,
				frontmatterKey: mappingKey ? mapping[mappingKey] : undefined,
			};
		});
		const userFields = this.getUserFields().map(
			(field): TaskNotesRuntimeFieldDefinition => ({
				id: `user:${field.id || field.key}`,
				label: field.displayName || field.key,
				valueType: userFieldTypeToRuntimeValueType(field.type),
				source: "user",
				writable: true,
				frontmatterKey: field.key,
				description: `User-defined field ${field.key}`,
			})
		);

		return [...coreFields, ...userFields];
	}

	private getFilterPropertyDefinitions(): TaskNotesRuntimeFilterPropertyDefinition[] {
		return FILTER_PROPERTIES.map((property) => ({
			id: property.id,
			label: property.label,
			category: property.category,
			supportedOperators: [...property.supportedOperators],
			valueInputType: property.valueInputType,
		}));
	}

	private async queryTasks(query?: FilterQuery): Promise<TaskNotesRuntimeTaskQueryResult> {
		const allTasks = await this.plugin.cacheManager.getAllTasks();
		if (!query) {
			return {
				tasks: allTasks.map(copyTaskInfo),
				total: allTasks.length,
				filtered: allTasks.length,
				groups: { all: allTasks.map((task) => task.path) },
			};
		}

		const groupedTasks = await this.plugin.filterService.getGroupedTasks(query);
		const tasks: TaskInfo[] = [];
		const groups: Record<string, string[]> = {};
		for (const [group, groupTasks] of groupedTasks.entries()) {
			tasks.push(...groupTasks);
			groups[group] = groupTasks.map((task) => task.path);
		}

		return {
			tasks: tasks.map(copyTaskInfo),
			total: allTasks.length,
			filtered: tasks.length,
			groups,
		};
	}

	private async getFilterOptions() {
		return this.plugin.filterService.getFilterOptions();
	}

	private async getTaskStats(query?: FilterQuery): Promise<TaskNotesRuntimeTaskStats> {
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

	async listTasks(query?: FilterQuery): Promise<TaskInfo[]> {
		if (!query) {
			const tasks = await this.plugin.cacheManager.getAllTasks();
			return tasks.map(copyTaskInfo);
		}

		const groupedTasks = await this.plugin.filterService.getGroupedTasks(query);
		const tasks: TaskInfo[] = [];
		for (const groupTasks of groupedTasks.values()) {
			tasks.push(...groupTasks);
		}
		return tasks.map(copyTaskInfo);
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
			throw new Error(`Status "${targetStatus}" is not configured as a completed status`);
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
				throw new Error(`Cannot move task to "${newPath}" because a file already exists`);
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
			throw new TypeError(`TaskNotes API ${operation} ${property} expects a non-empty value`);
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
		return this.updateTask(task.path, { blockedBy: dependencies }, context);
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
			throw new TypeError("TaskNotes API extension registration expects an object");
		}
		if (typeof extension.id !== "string" || extension.id.trim().length === 0) {
			throw new TypeError("TaskNotes API extension registration expects a non-empty id");
		}
		if (extension.api === null || typeof extension.api === "undefined") {
			throw new TypeError("TaskNotes API extension registration expects an api object");
		}

		const id = extension.id.trim();
		const namespace = this.normalizeExtensionNamespace(extension.namespace);
		if (RESERVED_RUNTIME_EXTENSION_NAMESPACES.has(namespace)) {
			throw new Error(`Cannot register TaskNotes API extension namespace "${namespace}"`);
		}
		if (this.extensionRegistry.has(namespace)) {
			throw new Error(
				`TaskNotes API extension namespace "${namespace}" is already registered`
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

		return {
			id,
			namespace,
			unregister: () => {
				const current = this.extensionRegistry.get(namespace);
				if (current?.token === token) {
					this.extensionRegistry.delete(namespace);
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
			throw new Error(
				`TaskNotes API extension namespace "${normalizedNamespace}" is not registered`
			);
		}
		return extension.api as TApi;
	}

	private hasExtension(namespace: string): boolean {
		return this.extensionRegistry.has(this.normalizeExtensionNamespace(namespace));
	}

	private listExtensions(): TaskNotesRuntimeExtensionInfo[] {
		return Array.from(this.extensionRegistry.values()).map((extension) => ({
			id: extension.id,
			namespace: extension.namespace,
			displayName: extension.displayName,
			version: extension.version,
			capabilities: [...extension.capabilities],
		}));
	}

	private getExtensionCapabilities(): readonly string[] {
		return Array.from(this.extensionRegistry.values()).flatMap((extension) => [
			...extension.capabilities,
		]);
	}

	private normalizeExtensionNamespace(namespace: string): string {
		if (typeof namespace !== "string" || namespace.trim().length === 0) {
			throw new TypeError("TaskNotes API extension namespace must be a non-empty string");
		}

		const normalizedNamespace = namespace.trim().toLowerCase();
		if (!/^[a-z][a-z0-9._-]*$/.test(normalizedNamespace)) {
			throw new TypeError(
				`TaskNotes API extension namespace "${namespace}" must use letters, numbers, dots, underscores, or dashes`
			);
		}
		return normalizedNamespace;
	}

	private normalizeExtensionCapability(capability: string): string {
		if (typeof capability !== "string" || capability.trim().length === 0) {
			throw new TypeError("TaskNotes API extension capabilities must be non-empty strings");
		}

		const normalizedCapability = capability.trim().toLowerCase();
		if (!/^[a-z][a-z0-9._:-]*$/.test(normalizedCapability)) {
			throw new TypeError(
				`TaskNotes API extension capability "${capability}" must use letters, numbers, dots, underscores, dashes, or colons`
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
			this.plugin.taskService.toggleRecurringTaskComplete(task, targetDate)
		);
		return copyTaskInfo(updatedTask);
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

		const metadataCache = this.plugin.app.metadataCache as
			| { getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => TFile | null }
			| undefined;
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
			throw new Error(`Task not found: ${normalizedPath}`);
		}
		return task;
	}

	private requireTaskFile(path: string): TFile {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			throw new Error(`Cannot find task file: ${path}`);
		}
		return file;
	}

	private normalizeTaskPath(path: string): string {
		if (typeof path !== "string" || path.trim().length === 0) {
			throw new TypeError("TaskNotes API expects a non-empty task path");
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
