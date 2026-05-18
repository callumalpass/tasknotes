import type { Reminder, TaskInfo } from "../types";
import type { HideIdentifyingTagsMode, UserMappedField } from "../types/settings";
import { sanitizeTags } from "../utils/helpers";
import { filterTaskIdentificationTags } from "../utils/taskTagFiltering";
import {
	readTaskEditFrontmatter,
	type TaskEditFrontmatterReadInput,
} from "./taskEditChangeState";

export interface TaskEditFormStateSettings {
	taskIdentificationMethod?: string;
	taskTag?: string;
	hideIdentifyingTagsMode?: HideIdentifyingTagsMode;
	userFields?: UserMappedField[];
}

export interface TaskEditFormStateInput {
	task: TaskInfo;
	details: string;
	frontmatter: Record<string, unknown>;
	settings: TaskEditFormStateSettings;
	normalizeDetails: (value: string) => string;
}

export interface TaskEditFormStateFromTaskInput
	extends Omit<TaskEditFormStateInput, "frontmatter"> {
	app: TaskEditFrontmatterReadInput["app"];
	logger?: TaskEditFrontmatterReadInput["logger"];
}

export interface TaskEditFormState {
	title: string;
	dueDate: string;
	scheduledDate: string;
	priority: string;
	status: string;
	contexts: string;
	projectValues: string[];
	hasValidProjects: boolean;
	tags: string;
	initialTags: string;
	timeEstimate: number;
	recurrenceRule: string;
	recurrenceAnchor: "scheduled" | "completion";
	reminders: Reminder[];
	details: string;
	originalDetails: string;
	userFields: Record<string, unknown>;
}

export function buildTaskEditFormStateFromTask(
	input: TaskEditFormStateFromTaskInput
): TaskEditFormState {
	const frontmatter = readTaskEditFrontmatter({
		app: input.app,
		taskPath: input.task.path,
		logger: input.logger,
	});

	return buildTaskEditFormState({
		task: input.task,
		details: input.details,
		frontmatter,
		settings: input.settings,
		normalizeDetails: input.normalizeDetails,
	});
}

export function buildTaskEditFormState(input: TaskEditFormStateInput): TaskEditFormState {
	const rawTags = input.task.tags || [];
	const visibleTags =
		input.settings.taskIdentificationMethod === "tag"
			? filterTaskIdentificationTags(
					rawTags,
					input.settings.taskTag || "",
					input.settings.hideIdentifyingTagsMode
				)
			: rawTags;
	const tags = rawTags.length > 0 ? sanitizeTags(visibleTags.join(", ")) : "";
	const details = input.normalizeDetails(input.details);
	const projectValues = input.task.projects || [];

	return {
		title: input.task.title,
		dueDate: input.task.due || "",
		scheduledDate: input.task.scheduled || "",
		priority: input.task.priority,
		status: input.task.status,
		contexts: input.task.contexts ? input.task.contexts.join(", ") : "",
		projectValues,
		hasValidProjects: projectValues.some(
			(project) => typeof project === "string" && project.trim() !== ""
		),
		tags,
		initialTags: tags,
		timeEstimate: input.task.timeEstimate || 0,
		recurrenceRule: typeof input.task.recurrence === "string" ? input.task.recurrence : "",
		recurrenceAnchor: input.task.recurrence_anchor || "scheduled",
		reminders: input.task.reminders ? [...input.task.reminders] : [],
		details,
		originalDetails: details,
		userFields: getTaskEditUserFieldValues(input.frontmatter, input.settings.userFields || []),
	};
}

export function getTaskEditUserFieldValues(
	frontmatter: Record<string, unknown>,
	userFieldConfigs: readonly UserMappedField[]
): Record<string, unknown> {
	const values: Record<string, unknown> = {};

	for (const field of userFieldConfigs) {
		if (!field?.key) {
			continue;
		}

		const value = frontmatter[field.key];
		if (value !== undefined) {
			values[field.key] = value;
		}
	}

	return values;
}
