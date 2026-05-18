import {
	addDTSTARTToRecurrenceRule,
	updateDTSTARTInRecurrenceRule,
	updateToNextScheduledOccurrence,
} from "../../core/recurrence";
import type { TaskInfo } from "../../types";
import {
	createUTCDateFromLocalCalendarDate,
	formatDateForStorage,
	getDatePart,
	getTodayLocal,
	parseDateToUTC,
} from "../../utils/dateUtils";

export interface BuildRecurringTaskCompletePlanInput {
	freshTask: TaskInfo;
	targetDate: Date;
	currentTimestamp: string;
	maintainDueDateOffsetInRecurring: boolean;
}

export interface BuildRecurringTaskSkippedPlanInput {
	freshTask: TaskInfo;
	targetDate: Date;
	currentTimestamp: string;
	maintainDueDateOffsetInRecurring: boolean;
}

export interface RecurringTaskCompletePlan {
	updatedTask: TaskInfo;
	targetDate: Date;
	dateStr: string;
	newComplete: boolean;
	dateModified: string;
	originalRecurrence: unknown;
}

export interface RecurringTaskSkippedPlan {
	updatedTask: TaskInfo;
	targetDate: Date;
	dateStr: string;
	newSkipped: boolean;
	dateModified: string;
}

export interface ApplyRecurringTaskCompleteFrontmatterInput {
	frontmatter: Record<string, unknown>;
	completeInstancesField: string;
	skippedInstancesField: string;
	dateModifiedField: string;
	scheduledField: string;
	dueField: string;
	recurrenceField: string;
	plan: RecurringTaskCompletePlan;
}

export interface ApplyRecurringTaskSkippedFrontmatterInput {
	frontmatter: Record<string, unknown>;
	skippedField: string;
	completeField: string;
	dateModifiedField: string;
	scheduledField: string;
	dueField: string;
	plan: RecurringTaskSkippedPlan;
}

function getStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function getRecurringTaskActionDate(task: TaskInfo, date?: Date): Date {
	if (date) {
		return date;
	}

	if (task.recurrence_anchor !== "completion" && task.scheduled) {
		return parseDateToUTC(getDatePart(task.scheduled));
	}

	const todayLocal = getTodayLocal();
	return createUTCDateFromLocalCalendarDate(todayLocal);
}

export function buildRecurringTaskCompletePlan({
	freshTask,
	targetDate,
	currentTimestamp,
	maintainDueDateOffsetInRecurring,
}: BuildRecurringTaskCompletePlanInput): RecurringTaskCompletePlan {
	if (!freshTask.recurrence) {
		throw new Error("Task is not recurring");
	}

	const dateStr = formatDateForStorage(targetDate);
	const completeInstances = getStringArray(freshTask.complete_instances);
	const currentComplete = completeInstances.includes(dateStr);
	const newComplete = !currentComplete;
	const updatedTask = {
		...freshTask,
		dateModified: currentTimestamp,
	};

	if (newComplete) {
		if (!completeInstances.includes(dateStr)) {
			updatedTask.complete_instances = [...completeInstances, dateStr];
		}

		const skippedInstances = getStringArray(freshTask.skipped_instances);
		updatedTask.skipped_instances = skippedInstances.filter((d) => d !== dateStr);
	} else {
		updatedTask.complete_instances = completeInstances.filter((d) => d !== dateStr);

		const skippedInstances = getStringArray(freshTask.skipped_instances);
		updatedTask.skipped_instances = skippedInstances.filter((d) => d !== dateStr);
	}

	if (newComplete && typeof updatedTask.recurrence === "string") {
		const recurrenceAnchor = updatedTask.recurrence_anchor || "scheduled";

		if (recurrenceAnchor === "completion") {
			const updatedRecurrence = updateDTSTARTInRecurrenceRule(
				updatedTask.recurrence,
				dateStr
			);
			if (updatedRecurrence) {
				updatedTask.recurrence = updatedRecurrence;
			}
		} else if (!updatedTask.recurrence.includes("DTSTART:")) {
			const updatedRecurrence = addDTSTARTToRecurrenceRule(updatedTask);
			if (updatedRecurrence) {
				updatedTask.recurrence = updatedRecurrence;
			}
		}
	}

	const nextDates = updateToNextScheduledOccurrence(
		updatedTask,
		maintainDueDateOffsetInRecurring
	);
	if (nextDates.scheduled) {
		updatedTask.scheduled = nextDates.scheduled;
	}
	if (nextDates.due) {
		updatedTask.due = nextDates.due;
	}

	return {
		updatedTask,
		targetDate,
		dateStr,
		newComplete,
		dateModified: currentTimestamp,
		originalRecurrence: freshTask.recurrence,
	};
}

export function applyRecurringTaskCompleteFrontmatterChange({
	frontmatter,
	completeInstancesField,
	skippedInstancesField,
	dateModifiedField,
	scheduledField,
	dueField,
	recurrenceField,
	plan,
}: ApplyRecurringTaskCompleteFrontmatterInput): void {
	if (!frontmatter[completeInstancesField]) {
		frontmatter[completeInstancesField] = [];
	}
	if (!frontmatter[skippedInstancesField]) {
		frontmatter[skippedInstancesField] = [];
	}

	const completeDates = getStringArray(frontmatter[completeInstancesField]);

	if (plan.newComplete) {
		if (!completeDates.includes(plan.dateStr)) {
			frontmatter[completeInstancesField] = [...completeDates, plan.dateStr];
		}
	} else {
		frontmatter[completeInstancesField] = completeDates.filter((d) => d !== plan.dateStr);
	}

	frontmatter[skippedInstancesField] = plan.updatedTask.skipped_instances || [];

	if (plan.updatedTask.recurrence !== plan.originalRecurrence) {
		frontmatter[recurrenceField] = plan.updatedTask.recurrence;
	}

	if (plan.updatedTask.scheduled) {
		frontmatter[scheduledField] = plan.updatedTask.scheduled;
	}

	if (plan.updatedTask.due) {
		frontmatter[dueField] = plan.updatedTask.due;
	}

	frontmatter[dateModifiedField] = plan.dateModified;
}

export function buildRecurringTaskSkippedPlan({
	freshTask,
	targetDate,
	currentTimestamp,
	maintainDueDateOffsetInRecurring,
}: BuildRecurringTaskSkippedPlanInput): RecurringTaskSkippedPlan {
	if (!freshTask.recurrence) {
		throw new Error("Task is not recurring");
	}

	const dateStr = formatDateForStorage(targetDate);
	const skippedInstances = getStringArray(freshTask.skipped_instances);
	const currentlySkipped = skippedInstances.includes(dateStr);
	const newSkipped = !currentlySkipped;
	const updatedTask = {
		...freshTask,
		dateModified: currentTimestamp,
	};

	if (newSkipped) {
		if (!skippedInstances.includes(dateStr)) {
			updatedTask.skipped_instances = [...skippedInstances, dateStr];
		}

		const completeInstances = getStringArray(freshTask.complete_instances);
		updatedTask.complete_instances = completeInstances.filter((d) => d !== dateStr);
	} else {
		updatedTask.skipped_instances = skippedInstances.filter((d) => d !== dateStr);
	}

	const nextDates = updateToNextScheduledOccurrence(
		updatedTask,
		maintainDueDateOffsetInRecurring
	);
	if (nextDates.scheduled) {
		updatedTask.scheduled = nextDates.scheduled;
	}
	if (nextDates.due) {
		updatedTask.due = nextDates.due;
	}

	return {
		updatedTask,
		targetDate,
		dateStr,
		newSkipped,
		dateModified: currentTimestamp,
	};
}

export function applyRecurringTaskSkippedFrontmatterChange({
	frontmatter,
	skippedField,
	completeField,
	dateModifiedField,
	scheduledField,
	dueField,
	plan,
}: ApplyRecurringTaskSkippedFrontmatterInput): void {
	if (!frontmatter[skippedField]) {
		frontmatter[skippedField] = [];
	}
	frontmatter[skippedField] = plan.updatedTask.skipped_instances || [];

	if (!frontmatter[completeField]) {
		frontmatter[completeField] = [];
	}
	frontmatter[completeField] = plan.updatedTask.complete_instances || [];

	if (plan.updatedTask.scheduled) {
		frontmatter[scheduledField] = plan.updatedTask.scheduled;
	}
	if (plan.updatedTask.due) {
		frontmatter[dueField] = plan.updatedTask.due;
	}

	frontmatter[dateModifiedField] = plan.dateModified;
}
