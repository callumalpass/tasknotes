import type { Reminder, TaskCreationData } from "../../types";
import type {
	DefaultReminder,
	TaskCreationDefaults,
	UserMappedField,
} from "../../types/settings";
import { calculateDefaultDate, calculateDefaultDateTime } from "../../utils/helpers";
import { convertDefaultRemindersToReminders } from "../../utils/settingsUtils";

export interface TaskCreationDefaultsContext {
	taskCreationDefaults: TaskCreationDefaults;
	userFields?: readonly UserMappedField[];
}

export interface TaskCreationDefaultAdapters {
	calculateDefaultDate?: typeof calculateDefaultDate;
	calculateDefaultDateTime?: typeof calculateDefaultDateTime;
	convertDefaultRemindersToReminders?: (
		defaultReminders: DefaultReminder[]
	) => Reminder[];
}

const DEFAULT_RECURRENCE_RULES: Record<TaskCreationDefaults["defaultRecurrence"], string | undefined> =
	{
		none: undefined,
		daily: "FREQ=DAILY",
		weekly: "FREQ=WEEKLY",
		monthly: "FREQ=MONTHLY",
		yearly: "FREQ=YEARLY",
	};

export function applyTaskCreationDefaults(
	taskData: TaskCreationData,
	context: TaskCreationDefaultsContext,
	adapters: TaskCreationDefaultAdapters = {}
): TaskCreationData {
	const defaults = context.taskCreationDefaults;
	const resolveDefaultDate = adapters.calculateDefaultDate ?? calculateDefaultDate;
	const resolveDefaultDateTime =
		adapters.calculateDefaultDateTime ?? calculateDefaultDateTime;
	const convertDefaultReminders =
		adapters.convertDefaultRemindersToReminders ?? convertDefaultRemindersToReminders;
	const result: TaskCreationData = {
		...taskData,
		customFrontmatter: taskData.customFrontmatter
			? { ...taskData.customFrontmatter }
			: undefined,
	};

	if (result.due === undefined && defaults.defaultDueDate !== "none") {
		result.due = resolveDefaultDateTime(defaults.defaultDueDate, defaults.defaultDueTime);
	}

	if (result.scheduled === undefined && defaults.defaultScheduledDate !== "none") {
		result.scheduled = resolveDefaultDateTime(
			defaults.defaultScheduledDate,
			defaults.defaultScheduledTime
		);
	}

	if (!result.contexts && defaults.defaultContexts) {
		result.contexts = splitCommaSeparatedDefaults(defaults.defaultContexts);
	}

	if (!result.projects && defaults.defaultProjects) {
		result.projects = splitCommaSeparatedDefaults(defaults.defaultProjects);
	}

	if (!result.tags && defaults.defaultTags) {
		result.tags = splitCommaSeparatedDefaults(defaults.defaultTags);
	}

	if (!result.timeEstimate && defaults.defaultTimeEstimate > 0) {
		result.timeEstimate = defaults.defaultTimeEstimate;
	}

	if (!result.recurrence && defaults.defaultRecurrence !== "none") {
		result.recurrence = DEFAULT_RECURRENCE_RULES[defaults.defaultRecurrence];
	}

	if (
		!result.reminders &&
		defaults.defaultReminders &&
		defaults.defaultReminders.length > 0
	) {
		result.reminders = convertDefaultReminders(defaults.defaultReminders);
	}

	applyUserFieldDefaults(result, context.userFields ?? [], resolveDefaultDate);

	return result;
}

function splitCommaSeparatedDefaults(value: string): string[] {
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function applyUserFieldDefaults(
	taskData: TaskCreationData,
	userFields: readonly UserMappedField[],
	resolveDefaultDate: typeof calculateDefaultDate
): void {
	if (userFields.length === 0) {
		return;
	}

	if (!taskData.customFrontmatter) {
		taskData.customFrontmatter = {};
	}

	for (const field of userFields) {
		const defaultValue = getUserFieldCreationDefault(field);
		if (
			defaultValue !== undefined &&
			taskData.customFrontmatter[field.key] === undefined
		) {
			if (field.type === "date" && typeof defaultValue === "string") {
				const calculatedDate = resolveDefaultDate(
					defaultValue as "none" | "today" | "tomorrow" | "next-week"
				);
				if (calculatedDate) {
					taskData.customFrontmatter[field.key] = calculatedDate;
				}
			} else {
				taskData.customFrontmatter[field.key] = defaultValue;
			}
		}
	}
}

function getUserFieldCreationDefault(
	field: UserMappedField
): string | number | boolean | string[] | undefined {
	if (field.defaultValue !== undefined) {
		return field.defaultValue;
	}
	if (field.type === "boolean") {
		return false;
	}
	return undefined;
}
