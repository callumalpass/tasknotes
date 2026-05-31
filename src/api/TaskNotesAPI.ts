import { normalizePath, TFile, type EventRef } from "obsidian";
import type TaskNotesPlugin from "../main";
import {
	NaturalLanguageParser,
	type ParsedTaskData,
} from "../services/NaturalLanguageParser";
import type {
	FilterQuery,
	TaskCreationData,
	TaskInfo,
	TimeEntry,
} from "../types";
import { EVENT_TASK_DELETED, EVENT_TASK_UPDATED } from "../types";
import type { TaskNotesSettings } from "../types/settings";
import { ensureFolderExists } from "../utils/helpers";

export const TASKNOTES_API_VERSION = 1 as const;

export const TASKNOTES_API_CAPABILITIES = [
	"tasks.read",
	"tasks.write",
	"tasks.move",
	"tasks.events",
	"time.read",
	"time.write",
	"settings.snapshot",
	"nlp.parse",
] as const;

export type TaskNotesApiVersion = typeof TASKNOTES_API_VERSION;
export type TaskNotesApiCapability = (typeof TASKNOTES_API_CAPABILITIES)[number];

export type TaskNotesApiEvent =
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
	| "time.started"
	| "time.stopped";

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

export interface ActiveTimeEntry {
	taskPath: string;
	task: TaskInfo;
	entry: TimeEntry;
	index: number;
}

export interface TaskNotesApiChange {
	before: unknown;
	after: unknown;
}

export type TaskNotesApiChanges = Record<string, TaskNotesApiChange>;

export interface TaskNotesApiEventPayload {
	event: TaskNotesApiEvent;
	taskPath: string;
	task?: TaskInfo;
	before?: TaskInfo;
	after?: TaskInfo;
	deletedTask?: TaskInfo;
	changes: TaskNotesApiChanges;
	context?: TaskNotesMutationContext;
	source?: string;
	correlationId?: string;
	reason?: string;
	rawEvent: typeof EVENT_TASK_UPDATED | typeof EVENT_TASK_DELETED;
}

export type TaskNotesApiEventHandler = (payload: TaskNotesApiEventPayload) => void;

export interface TaskNotesApiV1 {
	readonly apiVersion: TaskNotesApiVersion;
	readonly capabilities: readonly TaskNotesApiCapability[];
	hasCapability(capability: TaskNotesApiCapability | string): boolean;

	parseNaturalLanguage(text: string): ParsedTaskData;

	getTask(path: string): Promise<TaskInfo | null>;
	listTasks(query?: FilterQuery): Promise<TaskInfo[]>;
	createTask(
		taskData: TaskCreationData,
		context?: TaskNotesMutationContext
	): Promise<TaskInfo>;
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

	on(event: TaskNotesApiEvent, handler: TaskNotesApiEventHandler): EventRef;
	off(ref: EventRef): void;
}

export type TaskNotesPublicAPI = TaskNotesApiV1;

interface TaskUpdatedEventPayload {
	path?: string;
	originalTask?: TaskInfo;
	updatedTask?: TaskInfo;
}

interface TaskDeletedEventPayload {
	path?: string;
	deletedTask?: TaskInfo;
}

export class TaskNotesAPI implements TaskNotesApiV1 {
	readonly apiVersion = TASKNOTES_API_VERSION;
	readonly capabilities = TASKNOTES_API_CAPABILITIES;

	private readonly mutationContextByPath = new Map<string, TaskNotesMutationContext[]>();
	private readonly mutationContextStack: TaskNotesMutationContext[] = [];

	constructor(private plugin: TaskNotesPlugin) {}

	hasCapability(capability: TaskNotesApiCapability | string): boolean {
		return (TASKNOTES_API_CAPABILITIES as readonly string[]).includes(capability);
	}

	parseNaturalLanguage(text: string): ParsedTaskData {
		if (typeof text !== "string") {
			throw new TypeError("TaskNotes API parseNaturalLanguage expects a string");
		}

		return NaturalLanguageParser.fromPlugin(this.plugin).parseInput(text);
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

	async startTimeEntry(path: string, context?: TaskNotesMutationContext): Promise<void> {
		const task = await this.requireTask(path);
		await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.startTimeTracking(task)
		);
	}

	async stopTimeEntry(path: string, context?: TaskNotesMutationContext): Promise<void> {
		const task = await this.requireTask(path);
		await this.withMutationContext([task.path], context, () =>
			this.plugin.taskService.stopTimeTracking(task)
		);
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

	on(event: TaskNotesApiEvent, handler: TaskNotesApiEventHandler): EventRef {
		const rawEvent = event === "task.deleted" ? EVENT_TASK_DELETED : EVENT_TASK_UPDATED;
		return this.plugin.emitter.on(rawEvent, (payload: unknown) => {
			const apiEvents =
				rawEvent === EVENT_TASK_DELETED
					? this.normalizeDeletedEvent(payload as TaskDeletedEventPayload)
					: this.normalizeUpdatedEvent(payload as TaskUpdatedEventPayload);

			for (const apiEvent of apiEvents) {
				if (apiEvent.event === event) {
					handler(apiEvent);
				}
			}
		});
	}

	off(ref: EventRef): void {
		this.plugin.emitter.offref(ref);
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
		payload: Omit<TaskNotesApiEventPayload, "event"> & { event?: TaskNotesApiEvent }
	): TaskNotesApiEventPayload {
		return {
			event: payload.event ?? "task.updated",
			taskPath: payload.taskPath,
			task: payload.task,
			before: payload.before,
			after: payload.after,
			deletedTask: payload.deletedTask,
			changes: payload.changes,
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

function copyTaskInfo(task: TaskInfo): TaskInfo {
	return {
		...task,
		tags: task.tags ? [...task.tags] : undefined,
		contexts: task.contexts ? [...task.contexts] : undefined,
		projects: task.projects ? [...task.projects] : undefined,
		complete_instances: task.complete_instances ? [...task.complete_instances] : undefined,
		skipped_instances: task.skipped_instances ? [...task.skipped_instances] : undefined,
		icsEventId: task.icsEventId ? [...task.icsEventId] : undefined,
		googleCalendarMovedOriginalDates: task.googleCalendarMovedOriginalDates
			? [...task.googleCalendarMovedOriginalDates]
			: undefined,
		reminders: task.reminders ? task.reminders.map((reminder) => ({ ...reminder })) : undefined,
		timeEntries: task.timeEntries ? task.timeEntries.map((entry) => ({ ...entry })) : undefined,
		blockedBy: task.blockedBy
			? task.blockedBy.map((dependency) => ({ ...dependency }))
			: undefined,
		blocking: task.blocking ? [...task.blocking] : undefined,
		customProperties: task.customProperties ? { ...task.customProperties } : undefined,
	};
}
