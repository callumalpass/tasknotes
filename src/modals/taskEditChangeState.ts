import { App, TFile } from "obsidian";
import type { Reminder, TaskDependency, TaskInfo } from "../types";
import type { HideIdentifyingTagsMode, UserMappedField } from "../types/settings";
import {
	buildTaskEditChanges,
	type TaskEditChangeResult,
} from "./taskEditChanges";
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";

interface DependencyItemLike {
	dependency: TaskDependency;
	path?: string;
}

export interface TaskEditChangeSettings {
	userFields?: UserMappedField[];
	taskIdentificationMethod?: string;
	taskTag?: string;
	hideIdentifyingTagsMode?: HideIdentifyingTagsMode;
	maintainDueDateOffsetInRecurring?: boolean;
}

export interface TaskEditModalChangeState {
	task: TaskInfo;
	title: string;
	dueDate: string;
	scheduledDate: string;
	priority: string;
	status: string;
	contexts: string;
	projects: string;
	tags: string;
	initialTags: string;
	timeEstimate: number;
	recurrenceRule: string;
	recurrenceAnchor: "scheduled" | "completion";
	reminders: Reminder[];
	blockedByItems: DependencyItemLike[];
	initialBlockedBy: TaskDependency[];
	blockingItems: DependencyItemLike[];
	initialBlockingPaths: string[];
	details: string;
	originalDetails: string;
	completedInstancesChanges: string[];
	skippedInstancesChanges: string[];
	userFields: Record<string, unknown>;
}

export interface TaskEditChangeStateInput extends TaskEditModalChangeState {
	app: Pick<App, "vault" | "metadataCache">;
	settings: TaskEditChangeSettings;
	normalizeDetails: (value: string) => string;
	logger?: Pick<TaskNotesLogger, "warn">;
}

export interface TaskEditFrontmatterReadInput {
	app: Pick<App, "vault" | "metadataCache">;
	taskPath: string;
	logger?: Pick<TaskNotesLogger, "warn">;
}

const taskEditChangeStateLogger = createTaskNotesLogger({
	tag: "TaskEditModal/Changes",
});

export function buildTaskEditChangesFromModalState(
	input: TaskEditChangeStateInput
): TaskEditChangeResult {
	const frontmatter = readTaskEditFrontmatter({
		app: input.app,
		taskPath: input.task.path,
		logger: input.logger,
	});

	return buildTaskEditChanges({
		task: input.task,
		title: input.title,
		dueDate: input.dueDate,
		scheduledDate: input.scheduledDate,
		priority: input.priority,
		status: input.status,
		contexts: input.contexts,
		projects: input.projects,
		tags: input.tags,
		initialTags: input.initialTags,
		timeEstimate: input.timeEstimate,
		recurrenceRule: input.recurrenceRule,
		recurrenceAnchor: input.recurrenceAnchor,
		reminders: input.reminders,
		blockedByItems: input.blockedByItems,
		initialBlockedBy: input.initialBlockedBy,
		blockingItems: input.blockingItems,
		initialBlockingPaths: input.initialBlockingPaths,
		details: input.details,
		originalDetails: input.originalDetails,
		completedInstancesChanges: input.completedInstancesChanges,
		skippedInstancesChanges: input.skippedInstancesChanges,
		userFields: input.userFields,
		frontmatter,
		userFieldConfigs: input.settings.userFields || [],
		taskIdentificationMethod: input.settings.taskIdentificationMethod || "",
		taskTag: input.settings.taskTag || "",
		hideIdentifyingTagsMode: input.settings.hideIdentifyingTagsMode,
		maintainDueDateOffsetInRecurring:
			input.settings.maintainDueDateOffsetInRecurring === true,
		normalizeDetails: input.normalizeDetails,
	});
}

export function readTaskEditFrontmatter(
	input: TaskEditFrontmatterReadInput
): Record<string, unknown> {
	try {
		const file = input.app.vault.getAbstractFileByPath(input.taskPath);
		if (file instanceof TFile) {
			return input.app.metadataCache.getFileCache(file)?.frontmatter || {};
		}
	} catch (error) {
		const logger = input.logger ?? taskEditChangeStateLogger;
		logger.warn("Error reading user field frontmatter", {
			category: "stale-data",
			operation: "task-edit-frontmatter-read",
			details: { path: input.taskPath },
			error,
		});
	}

	return {};
}
