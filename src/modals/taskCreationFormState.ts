import type { Reminder, TaskInfo } from "../types";
import type { TaskCreationDefaults, UserMappedField } from "../types/settings";
import { calculateDefaultDate, calculateDefaultDateTime, sanitizeTags } from "../utils/helpers";
import { convertDefaultRemindersToReminders } from "../utils/settingsUtils";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";

type RecurrenceAnchor = "scheduled" | "completion";

export type TaskCreationPrepopulatedValues = Partial<TaskInfo> & {
	customFrontmatter?: Record<string, unknown>;
};

export interface TaskCreationFormStateInput {
	defaultPriority: string;
	defaultStatus: string;
	taskCreationDefaults: TaskCreationDefaults;
	taskTag: string;
	userFields?: UserMappedField[];
	prePopulatedValues?: TaskCreationPrepopulatedValues;
}

export interface TaskCreationFormState {
	title: string;
	dueDate: string;
	scheduledDate: string;
	priority: string;
	status: string;
	contexts: string;
	tags: string;
	projectStrings: string[];
	timeEstimate: number;
	recurrenceRule: string;
	recurrenceAnchor: RecurrenceAnchor;
	reminders: Reminder[];
	userFields: Record<string, unknown>;
}

export function buildTaskCreationFormState(
	input: TaskCreationFormStateInput
): TaskCreationFormState {
	const defaults = input.taskCreationDefaults;
	const state: TaskCreationFormState = {
		title: "",
		dueDate: calculateDefaultDateTime(defaults.defaultDueDate, defaults.defaultDueTime),
		scheduledDate: calculateDefaultDateTime(
			defaults.defaultScheduledDate,
			defaults.defaultScheduledTime
		),
		priority: input.defaultPriority,
		status: input.defaultStatus,
		contexts: defaults.defaultContexts || "",
		tags: defaults.defaultTags || "",
		projectStrings: defaults.defaultProjects
			? splitListPreservingLinksAndQuotes(defaults.defaultProjects)
			: [],
		timeEstimate:
			defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0
				? defaults.defaultTimeEstimate
				: 0,
		recurrenceRule: "",
		recurrenceAnchor: "scheduled",
		reminders:
			defaults.defaultReminders && defaults.defaultReminders.length > 0
				? convertDefaultRemindersToReminders(defaults.defaultReminders)
				: [],
		userFields: buildDefaultUserFieldValues(input.userFields || []),
	};

	if (input.prePopulatedValues) {
		applyPrePopulatedValues(state, input.prePopulatedValues, input.taskTag);
	}

	return state;
}

function buildDefaultUserFieldValues(
	userFields: readonly UserMappedField[]
): Record<string, unknown> {
	const values: Record<string, unknown> = {};

	for (const field of userFields) {
		if (field.defaultValue === undefined) continue;

		if (field.type === "date" && typeof field.defaultValue === "string") {
			const calculatedDate = calculateDefaultDateValue(field.defaultValue);
			if (calculatedDate) {
				values[field.key] = calculatedDate;
			}
			continue;
		}

		values[field.key] = field.defaultValue;
	}

	return values;
}

function calculateDefaultDateValue(value: string): string {
	if (
		value !== "none" &&
		value !== "today" &&
		value !== "tomorrow" &&
		value !== "next-week"
	) {
		return "";
	}

	return calculateDefaultDate(value);
}

function applyPrePopulatedValues(
	state: TaskCreationFormState,
	values: TaskCreationPrepopulatedValues,
	taskTag: string
): void {
	if (values.title !== undefined) state.title = values.title;
	if (values.due !== undefined) state.dueDate = values.due;
	if (values.scheduled !== undefined) state.scheduledDate = values.scheduled;
	if (values.priority !== undefined) state.priority = values.priority;
	if (values.status !== undefined) state.status = values.status;
	if (values.contexts !== undefined) {
		state.contexts = values.contexts.join(", ");
	}
	if (values.projects !== undefined) {
		state.projectStrings = values.projects.filter(
			(project) => project && typeof project === "string" && project.trim() !== ""
		);
	}
	if (values.tags !== undefined) {
		state.tags = sanitizeTags(
			values.tags.filter((tag) => tag !== taskTag).join(", ")
		);
	}
	if (values.timeEstimate !== undefined) state.timeEstimate = values.timeEstimate;
	if (values.recurrence !== undefined && typeof values.recurrence === "string") {
		state.recurrenceRule = values.recurrence;
	}
	if (values.recurrence_anchor !== undefined) {
		state.recurrenceAnchor = values.recurrence_anchor;
	}
	if (values.customFrontmatter) {
		for (const [fieldKey, fieldValue] of Object.entries(values.customFrontmatter)) {
			state.userFields[fieldKey] = fieldValue;
		}
	}
}
