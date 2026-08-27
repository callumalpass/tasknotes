import {
	addDTSTARTToRecurrenceRule,
	generateRecurringInstances,
	getNextUncompletedOccurrence,
	updateDTSTARTInRecurrenceRule,
	updateToNextScheduledOccurrence,
} from "../../core/recurrence";
import type { TaskInfo } from "../../types";
import {
	createUTCDateFromLocalCalendarDate,
	formatDateForStorage,
	getDatePart,
	getTodayLocal,
	getTodayString,
	parseDateToUTC,
} from "../../utils/dateUtils";
import {
	applyGoogleCalendarRecurringExceptionCleanup,
	resolveGoogleCalendarRecurringExceptionAfterCurrentInstanceAction,
} from "./googleCalendarRecurringExceptions";

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
	googleCalendarExceptionOriginalScheduledField: string;
	googleCalendarMovedOriginalDatesField: string;
	plan: RecurringTaskCompletePlan;
}

export interface ApplyRecurringTaskSkippedFrontmatterInput {
	frontmatter: Record<string, unknown>;
	skippedField: string;
	completeField: string;
	dateModifiedField: string;
	scheduledField: string;
	dueField: string;
	googleCalendarExceptionOriginalScheduledField: string;
	googleCalendarMovedOriginalDatesField: string;
	plan: RecurringTaskSkippedPlan;
}

function getStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

function getRecurrenceSearchDays(recurrence: string): number {
	const intervalMatch = recurrence.match(/(?:^|;)INTERVAL=(\d+)(?:;|$)/);
	const interval = intervalMatch ? Number.parseInt(intervalMatch[1], 10) : 1;

	if (recurrence.includes("FREQ=DAILY")) return Math.max(30, interval * 2);
	if (recurrence.includes("FREQ=WEEKLY")) return Math.max(90, interval * 7 * 2);
	if (recurrence.includes("FREQ=MONTHLY")) return Math.max(400, interval * 31 * 2);
	if (recurrence.includes("FREQ=YEARLY")) return Math.max(800, interval * 366 * 2);
	return 365;
}

function findOwningRecurrenceDate(task: TaskInfo, targetDate: Date): Date | null {
	if (!task.recurrence) return null;

	// If targetDate is itself a recurrence occurrence, return it as-is.
	// This keeps toggle-off (un-complete) working correctly when an explicit
	// recurrence date is passed.
	const exactOccurrences = generateRecurringInstances(task, targetDate, targetDate);
	const targetDateStr = formatDateForStorage(targetDate);
	if (exactOccurrences.some((occ) => formatDateForStorage(occ) === targetDateStr)) {
		return targetDate;
	}

	// targetDate is a shifted scheduled date — find the recurrence occurrence it belongs to.
	const processedInstances = new Set([
		...(task.complete_instances || []),
		...(task.skipped_instances || []),
	]);

	// Prefer the most recent unprocessed occurrence at or before the target date.
	// Size the search window from the RRULE frequency and interval so multi-year
	// rules are covered without scanning the series' complete history.
	const searchDays = getRecurrenceSearchDays(task.recurrence);
	const lookBackStart = new Date(targetDate.getTime() - searchDays * 24 * 60 * 60 * 1000);
	const pastOccurrences = generateRecurringInstances(task, lookBackStart, targetDate);
	for (let i = pastOccurrences.length - 1; i >= 0; i--) {
		if (!processedInstances.has(formatDateForStorage(pastOccurrences[i]))) {
			return pastOccurrences[i];
		}
	}

	// If every earlier occurrence is processed, let the recurrence model perform
	// its frequency-aware forward search from the shifted date.
	return getNextUncompletedOccurrence(task, { minOccurrenceDate: targetDateStr });
}

function getOwningRecurrenceDate(task: TaskInfo, targetDate: Date): Date | null {
	const recurrenceAnchor = task.recurrence_anchor || "scheduled";
	if (recurrenceAnchor === "completion" || task.googleCalendarExceptionOriginalScheduled) {
		return null;
	}

	return findOwningRecurrenceDate(task, targetDate);
}

function moveScheduledDateToOccurrence(
	scheduled: string | undefined,
	occurrenceDate: Date
): string {
	const occurrenceDateStr = formatDateForStorage(occurrenceDate);
	if (!scheduled) {
		return occurrenceDateStr;
	}

	const scheduledDatePart = getDatePart(scheduled);
	return `${occurrenceDateStr}${scheduled.slice(scheduledDatePart.length)}`;
}

function withGoogleCalendarReplacedDatesProcessedForNextOccurrence(
	task: TaskInfo,
	originalTask: TaskInfo,
	actionDate: string
): TaskInfo {
	if ((originalTask.recurrence_anchor || "scheduled") !== "scheduled") {
		return task;
	}

	const replacedDates = new Set<string>();
	for (const date of originalTask.googleCalendarMovedOriginalDates || []) {
		const normalized = getDatePart(date);
		if (normalized) {
			replacedDates.add(normalized);
		}
	}

	const pendingOriginal = getDatePart(
		originalTask.googleCalendarExceptionOriginalScheduled || ""
	);
	const movedDate = getDatePart(originalTask.scheduled || "");
	if (pendingOriginal && pendingOriginal !== actionDate && movedDate === actionDate) {
		replacedDates.add(pendingOriginal);
	}

	// Moved occurrences replace their original series dates. Mark those dates as
	// processed only for this calculation; persisted state stays keyed to moved dates.
	const completeInstances = new Set(getStringArray(task.complete_instances));
	const skippedInstances = getStringArray(task.skipped_instances);
	const skippedInstanceSet = new Set(skippedInstances);
	const additionalSkippedInstances = Array.from(replacedDates)
		.filter((date) => !completeInstances.has(date) && !skippedInstanceSet.has(date))
		.sort();
	if (additionalSkippedInstances.length === 0) {
		return task;
	}

	return {
		...task,
		skipped_instances: [...skippedInstances, ...additionalSkippedInstances],
	};
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

	const recurrenceAnchor = freshTask.recurrence_anchor || "scheduled";
	// For scheduled-anchor tasks, find the recurrence date that owns the target date.
	// The scheduled field may have been manually shifted forward from the actual recurrence
	// date; storing the recurrence date in complete_instances ensures the model's exact-match
	// check correctly marks this instance as done.
	// Skip this for Google Calendar moved exceptions: the exception's scheduled date is
	// distinct from the original series date and must be tracked as-is.
	const owningRecurrenceDate = getOwningRecurrenceDate(freshTask, targetDate);
	const instanceDate = owningRecurrenceDate ?? targetDate;
	const dateStr = formatDateForStorage(instanceDate);
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

	// Use the recurrence date (not the shifted scheduled date) as the reference for
	// due-date offset calculation and next-occurrence search.
	// Pass max(today, instanceDate) as the floor so future-dated tasks advance past
	// the current cycle rather than jumping back to today's nearest occurrence.
	const taskForNextOccurrenceBase = owningRecurrenceDate
		? {
				...updatedTask,
				scheduled: moveScheduledDateToOccurrence(
					updatedTask.scheduled,
					owningRecurrenceDate
				),
			}
		: updatedTask;
	const taskForNextOccurrence = withGoogleCalendarReplacedDatesProcessedForNextOccurrence(
		taskForNextOccurrenceBase,
		freshTask,
		dateStr
	);
	const todayStr = getTodayString();
	const floorDate = dateStr > todayStr ? dateStr : todayStr;
	const nextDates = updateToNextScheduledOccurrence(
		taskForNextOccurrence,
		maintainDueDateOffsetInRecurring,
		{ minOccurrenceDate: floorDate }
	);
	if (nextDates.scheduled) {
		updatedTask.scheduled = nextDates.scheduled;
	}
	if (nextDates.due) {
		updatedTask.due = nextDates.due;
	}
	resolveGoogleCalendarRecurringExceptionAfterCurrentInstanceAction(
		freshTask,
		dateStr,
		updatedTask
	);
	applyGoogleCalendarRecurringExceptionCleanup(updatedTask);

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
	googleCalendarExceptionOriginalScheduledField,
	googleCalendarMovedOriginalDatesField,
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

	writeOptionalFrontmatterField(
		frontmatter,
		googleCalendarExceptionOriginalScheduledField,
		plan.updatedTask.googleCalendarExceptionOriginalScheduled
	);
	writeOptionalFrontmatterField(
		frontmatter,
		googleCalendarMovedOriginalDatesField,
		plan.updatedTask.googleCalendarMovedOriginalDates
	);

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

	const owningRecurrenceDate = getOwningRecurrenceDate(freshTask, targetDate);
	const instanceDate = owningRecurrenceDate ?? targetDate;
	const dateStr = formatDateForStorage(instanceDate);
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

	const taskForNextOccurrenceBase = owningRecurrenceDate
		? {
				...updatedTask,
				scheduled: moveScheduledDateToOccurrence(
					updatedTask.scheduled,
					owningRecurrenceDate
				),
			}
		: updatedTask;
	const taskForNextOccurrence = withGoogleCalendarReplacedDatesProcessedForNextOccurrence(
		taskForNextOccurrenceBase,
		freshTask,
		dateStr
	);
	const todayStr = getTodayString();
	const floorDate = dateStr > todayStr ? dateStr : todayStr;
	const nextDates = updateToNextScheduledOccurrence(
		taskForNextOccurrence,
		maintainDueDateOffsetInRecurring,
		{ minOccurrenceDate: floorDate }
	);
	if (nextDates.scheduled) {
		updatedTask.scheduled = nextDates.scheduled;
	}
	if (nextDates.due) {
		updatedTask.due = nextDates.due;
	}
	resolveGoogleCalendarRecurringExceptionAfterCurrentInstanceAction(
		freshTask,
		dateStr,
		updatedTask
	);
	applyGoogleCalendarRecurringExceptionCleanup(updatedTask);

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
	googleCalendarExceptionOriginalScheduledField,
	googleCalendarMovedOriginalDatesField,
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

	writeOptionalFrontmatterField(
		frontmatter,
		googleCalendarExceptionOriginalScheduledField,
		plan.updatedTask.googleCalendarExceptionOriginalScheduled
	);
	writeOptionalFrontmatterField(
		frontmatter,
		googleCalendarMovedOriginalDatesField,
		plan.updatedTask.googleCalendarMovedOriginalDates
	);

	frontmatter[dateModifiedField] = plan.dateModified;
}

function writeOptionalFrontmatterField(
	frontmatter: Record<string, unknown>,
	fieldName: string,
	value: unknown
): void {
	if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
		delete frontmatter[fieldName];
		return;
	}

	frontmatter[fieldName] = value;
}
