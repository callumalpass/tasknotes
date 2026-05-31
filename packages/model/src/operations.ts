import { formatDateForStorage, getDatePart, parseDateToUTC } from "./date";
import { isCompletedStatus } from "./config";
import {
	addDTSTARTToRecurrenceRule,
	completeRecurringTask,
	getRecurringTaskActionDate,
	recalculateRecurringSchedule,
	updateDTSTARTInRecurrenceRule,
	updateToNextScheduledOccurrence,
} from "./recurrence";
import {
	buildStartTimeTrackingPlan,
	buildStopTimeTrackingPlan,
	getActiveTimeEntry,
	sanitizeTimeEntries,
} from "./time";
import {
	coerceStatusFrontmatterValue,
	mapTaskToFrontmatter,
	normalizeDependencyEntry,
	serializeDependencies,
} from "./mapping";
import type {
	FieldMapping,
	FieldMappingKey,
	StatusConfig,
	TaskDependency,
	TaskInfo,
	TaskOperationPlan,
	TaskPatchOperation,
	TaskUpdateInput,
	TimeEntry,
	UserMappedField,
} from "./types";

export interface BuildTaskUpdatePlanInput {
	originalTask: TaskInfo;
	updates: TaskUpdateInput;
	fieldMapping: FieldMapping;
	taskTag?: string;
	storeTitleInFilename?: boolean;
	userFields?: readonly UserMappedField[];
	statuses?: readonly StatusConfig[];
	now?: string;
	currentDateString?: string;
	maintainDueDateOffsetInRecurring?: boolean;
}

export interface BuildTaskPropertyUpdatePlanInput {
	freshTask: TaskInfo;
	property: keyof TaskInfo;
	value: unknown;
	fieldMapping: FieldMapping;
	statuses?: readonly StatusConfig[];
	now: string;
	currentDateString: string;
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

export interface SpecTaskUpdatePlan {
	fields: Record<string, unknown>;
	updatedTask: TaskInfo;
	dateModified?: string;
	changed: boolean;
	metadata?: Record<string, unknown>;
}

export interface BuildSpecCompleteTaskUpdateInput {
	frontmatter: Record<string, unknown>;
	targetDate: string;
	completedStatus: string;
	currentTimestamp?: string;
	path?: string;
}

export interface BuildSpecRecurringSkipUpdateInput {
	frontmatter: Record<string, unknown>;
	targetDate: string;
	skip: boolean;
	currentTimestamp?: string;
	path?: string;
}

export interface BuildSpecTimeTrackingUpdateInput {
	frontmatter: Record<string, unknown>;
	currentTimestamp: string;
	path?: string;
}

export interface BuildSpecStartTimeTrackingUpdateInput extends BuildSpecTimeTrackingUpdateInput {
	startTimestamp?: string;
	description?: string;
}

export interface BuildSpecStopTimeTrackingUpdateInput extends BuildSpecTimeTrackingUpdateInput {
	stopTimestamp?: string;
}

export function buildTaskUpdatePlan({
	originalTask,
	updates,
	fieldMapping,
	taskTag,
	storeTitleInFilename = false,
	userFields = [],
	statuses = [],
	now = new Date().toISOString(),
	currentDateString = formatDateForStorage(parseDateToUTC(getDatePart(now))),
	maintainDueDateOffsetInRecurring = true,
}: BuildTaskUpdatePlanInput): TaskOperationPlan<TaskInfo> {
	const normalizedUpdates = normalizeTaskUpdateInput(updates);
	const recurrenceUpdates = buildTaskUpdateRecurrenceUpdates({
		originalTask,
		updates: normalizedUpdates,
		maintainDueDateOffsetInRecurring,
	});
	const updatedTask = buildUpdatedTaskFromPlan({
		originalTask,
		updates: normalizedUpdates,
		recurrenceUpdates,
		newPath: originalTask.path,
		dateModified: now,
		currentDateString,
		normalizedDetails: normalizeTaskUpdateDetails(normalizedUpdates),
		isCompletedStatus: (status) => isCompletedStatus(status, statuses),
	});
	const mapped = mapTaskToFrontmatter(
		fieldMapping,
		updatedTask,
		taskTag,
		storeTitleInFilename,
		userFields
	);
	const frontmatterPatch = buildSetPatch(mapped);
	addUnsetMappedFieldDeletes(frontmatterPatch, { ...normalizedUpdates, ...recurrenceUpdates }, fieldMapping);
	return {
		kind: "task.update",
		updatedTask,
		frontmatterPatch,
		dateModified: now,
		metadata: { recurrenceUpdates },
	};
}

export function normalizeTaskUpdateInput(updates: TaskUpdateInput): TaskUpdateInput {
	if (!Array.isArray(updates.timeEntries)) {
		return { ...updates };
	}
	return {
		...updates,
		timeEntries: updates.timeEntries.map(stripTimeEntryDuration),
	};
}

export function normalizeTaskUpdateDetails(updates: TaskUpdateInput): string | null {
	if (!Object.prototype.hasOwnProperty.call(updates, "details")) {
		return null;
	}
	return typeof updates.details === "string" ? updates.details.replace(/\r\n/g, "\n") : "";
}

export function buildTaskUpdateRecurrenceUpdates({
	originalTask,
	updates,
	maintainDueDateOffsetInRecurring,
}: {
	originalTask: TaskInfo;
	updates: TaskUpdateInput;
	maintainDueDateOffsetInRecurring: boolean;
}): Partial<TaskInfo> {
	const recurrenceUpdates: Partial<TaskInfo> = {};

	if (updates.recurrence !== undefined && updates.recurrence !== originalTask.recurrence) {
		const tempTask: TaskInfo = { ...originalTask, ...updates };
		const nextDates = updateToNextScheduledOccurrence(tempTask, maintainDueDateOffsetInRecurring);
		if (nextDates.scheduled) recurrenceUpdates.scheduled = nextDates.scheduled;
		if (nextDates.due) recurrenceUpdates.due = nextDates.due;
		if (typeof updates.recurrence === "string" && updates.recurrence && !updates.recurrence.includes("DTSTART:")) {
			const updatedRecurrence = addDTSTARTToRecurrenceRule({
				...originalTask,
				...updates,
				...recurrenceUpdates,
			});
			if (updatedRecurrence) recurrenceUpdates.recurrence = updatedRecurrence;
		}
	} else if (updates.recurrence !== undefined && !originalTask.recurrence && updates.recurrence) {
		if (typeof updates.recurrence === "string" && !updates.recurrence.includes("DTSTART:")) {
			const updatedRecurrence = addDTSTARTToRecurrenceRule({ ...originalTask, ...updates });
			if (updatedRecurrence) recurrenceUpdates.recurrence = updatedRecurrence;
		}
	}

	if (
		updates.scheduled !== undefined &&
		updates.scheduled !== originalTask.scheduled &&
		originalTask.recurrence &&
		typeof originalTask.recurrence === "string" &&
		!originalTask.recurrence.includes("DTSTART:")
	) {
		const updatedRecurrence = addDTSTARTToRecurrenceRule({ ...originalTask, ...updates });
		if (updatedRecurrence) recurrenceUpdates.recurrence = updatedRecurrence;
	}

	return recurrenceUpdates;
}

export function buildUpdatedTaskFromPlan({
	originalTask,
	updates,
	recurrenceUpdates,
	newPath,
	dateModified,
	currentDateString,
	normalizedDetails,
	finalTags,
	isCompletedStatus: isCompletedStatusFn,
}: {
	originalTask: TaskInfo;
	updates: TaskUpdateInput;
	recurrenceUpdates: Partial<TaskInfo>;
	newPath: string;
	dateModified: string;
	currentDateString: string;
	normalizedDetails: string | null;
	finalTags?: string[];
	isCompletedStatus: (status: string) => boolean;
}): TaskInfo {
	const updatedTask: TaskInfo = {
		...originalTask,
		...updates,
		...recurrenceUpdates,
		path: newPath,
		dateModified,
	};
	if (finalTags) updatedTask.tags = finalTags;
	if (normalizedDetails !== null) updatedTask.details = normalizedDetails;
	if (updates.status !== undefined && !originalTask.recurrence) {
		if (isCompletedStatusFn(updates.status)) {
			if (!originalTask.completedDate) updatedTask.completedDate = currentDateString;
		} else {
			updatedTask.completedDate = undefined;
		}
	}
	return updatedTask;
}

export function buildTaskPropertyUpdatePlan({
	freshTask,
	property,
	value,
	fieldMapping,
	statuses = [],
	now,
	currentDateString,
}: BuildTaskPropertyUpdatePlanInput): TaskOperationPlan<TaskInfo> {
	const normalizedValue = normalizeTaskPropertyValue(property, value);
	const updatedTask = { ...freshTask, [property]: normalizedValue, dateModified: now } as TaskInfo;

	if (property === "status" && !freshTask.recurrence) {
		const status = String(normalizedValue ?? "");
		updatedTask.completedDate = isCompletedStatus(status, statuses) ? currentDateString : undefined;
	}

	const fieldName = fieldNameForTaskProperty(fieldMapping, property);
	const frontmatterPatch: TaskPatchOperation[] = [{ op: "set", field: fieldMapping.dateModified, value: now }];
	if (fieldName) {
		if ((property === "due" || property === "scheduled") && !value) {
			frontmatterPatch.push({ op: "delete", field: fieldName });
		} else if (property === "status") {
			const status = String(normalizedValue ?? "");
			frontmatterPatch.push({ op: "set", field: fieldName, value: coerceStatusFrontmatterValue(status) });
			if (!freshTask.recurrence && isCompletedStatus(status, statuses)) {
				frontmatterPatch.push({ op: "set", field: fieldMapping.completedDate, value: currentDateString });
			} else if (!freshTask.recurrence) {
				frontmatterPatch.push({ op: "delete", field: fieldMapping.completedDate });
			}
		} else if (property === "blockedBy") {
			const dependencies = Array.isArray(normalizedValue) ? (normalizedValue as TaskDependency[]) : [];
			if (dependencies.length > 0) {
				frontmatterPatch.push({ op: "set", field: fieldName, value: serializeDependencies(dependencies) });
			} else {
				frontmatterPatch.push({ op: "delete", field: fieldName });
			}
		} else {
			frontmatterPatch.push({ op: "set", field: fieldName, value: normalizedValue });
		}
	}

	return {
		kind: "task.property-update",
		updatedTask,
		frontmatterPatch,
		dateModified: now,
		metadata: { property, normalizedValue },
	};
}

export function normalizeTaskPropertyValue(property: keyof TaskInfo, value: unknown): unknown {
	if (property === "blockedBy") {
		return normalizeBlockedByValue(value);
	}
	return value;
}

export function normalizeBlockedByValue(value: unknown): TaskDependency[] | undefined {
	if (value === null || value === undefined) return undefined;
	const normalized = (Array.isArray(value) ? value : [value])
		.map((entry) => normalizeDependencyEntry(entry))
		.filter((entry): entry is TaskDependency => !!entry);
	return normalized.length > 0 ? normalized : undefined;
}

export function buildRecurringTaskCompletePlan({
	freshTask,
	targetDate,
	currentTimestamp,
	maintainDueDateOffsetInRecurring,
}: {
	freshTask: TaskInfo;
	targetDate?: Date;
	currentTimestamp: string;
	maintainDueDateOffsetInRecurring: boolean;
}): RecurringTaskCompletePlan {
	if (!freshTask.recurrence) throw new Error("Task is not recurring");
	const resolvedTargetDate = getRecurringTaskActionDate(freshTask, targetDate);
	const dateStr = formatDateForStorage(resolvedTargetDate);
	const completeInstances = getStringArray(freshTask.complete_instances);
	const currentComplete = completeInstances.includes(dateStr);
	const newComplete = !currentComplete;
	const updatedTask: TaskInfo = { ...freshTask, dateModified: currentTimestamp };

	if (newComplete) {
		updatedTask.complete_instances = completeInstances.includes(dateStr)
			? completeInstances
			: [...completeInstances, dateStr];
		updatedTask.skipped_instances = getStringArray(freshTask.skipped_instances).filter((date) => date !== dateStr);
	} else {
		updatedTask.complete_instances = completeInstances.filter((date) => date !== dateStr);
		updatedTask.skipped_instances = getStringArray(freshTask.skipped_instances).filter((date) => date !== dateStr);
	}

	if (newComplete && typeof updatedTask.recurrence === "string") {
		if ((updatedTask.recurrence_anchor || "scheduled") === "completion") {
			updatedTask.recurrence = updateDTSTARTInRecurrenceRule(updatedTask.recurrence, dateStr) || updatedTask.recurrence;
		} else if (!updatedTask.recurrence.includes("DTSTART:")) {
			updatedTask.recurrence = addDTSTARTToRecurrenceRule(updatedTask) || updatedTask.recurrence;
		}
	}

	const nextDates = updateToNextScheduledOccurrence(updatedTask, maintainDueDateOffsetInRecurring);
	if (nextDates.scheduled) updatedTask.scheduled = nextDates.scheduled;
	if (nextDates.due) updatedTask.due = nextDates.due;

	return {
		updatedTask,
		targetDate: resolvedTargetDate,
		dateStr,
		newComplete,
		dateModified: currentTimestamp,
		originalRecurrence: freshTask.recurrence,
	};
}

export function buildRecurringTaskSkippedPlan({
	freshTask,
	targetDate,
	currentTimestamp,
	maintainDueDateOffsetInRecurring,
}: {
	freshTask: TaskInfo;
	targetDate?: Date;
	currentTimestamp: string;
	maintainDueDateOffsetInRecurring: boolean;
}): RecurringTaskSkippedPlan {
	if (!freshTask.recurrence) throw new Error("Task is not recurring");
	const resolvedTargetDate = getRecurringTaskActionDate(freshTask, targetDate);
	const dateStr = formatDateForStorage(resolvedTargetDate);
	const skippedInstances = getStringArray(freshTask.skipped_instances);
	const currentlySkipped = skippedInstances.includes(dateStr);
	const newSkipped = !currentlySkipped;
	const updatedTask: TaskInfo = { ...freshTask, dateModified: currentTimestamp };

	if (newSkipped) {
		updatedTask.skipped_instances = skippedInstances.includes(dateStr)
			? skippedInstances
			: [...skippedInstances, dateStr];
		updatedTask.complete_instances = getStringArray(freshTask.complete_instances).filter((date) => date !== dateStr);
	} else {
		updatedTask.skipped_instances = skippedInstances.filter((date) => date !== dateStr);
	}

	const nextDates = updateToNextScheduledOccurrence(updatedTask, maintainDueDateOffsetInRecurring);
	if (nextDates.scheduled) updatedTask.scheduled = nextDates.scheduled;
	if (nextDates.due) updatedTask.due = nextDates.due;

	return {
		updatedTask,
		targetDate: resolvedTargetDate,
		dateStr,
		newSkipped,
		dateModified: currentTimestamp,
	};
}

export function recurringCompletePlanToFrontmatterPatch(
	plan: RecurringTaskCompletePlan,
	fieldMapping: FieldMapping
): TaskPatchOperation[] {
	const patch: TaskPatchOperation[] = [
		{ op: "set", field: fieldMapping.completeInstances, value: plan.updatedTask.complete_instances || [] },
		{ op: "set", field: fieldMapping.skippedInstances, value: plan.updatedTask.skipped_instances || [] },
		{ op: "set", field: fieldMapping.dateModified, value: plan.dateModified },
	];
	if (plan.updatedTask.recurrence !== plan.originalRecurrence) {
		patch.push({ op: "set", field: fieldMapping.recurrence, value: plan.updatedTask.recurrence });
	}
	if (plan.updatedTask.scheduled) patch.push({ op: "set", field: fieldMapping.scheduled, value: plan.updatedTask.scheduled });
	if (plan.updatedTask.due) patch.push({ op: "set", field: fieldMapping.due, value: plan.updatedTask.due });
	return patch;
}

export function recurringSkippedPlanToFrontmatterPatch(
	plan: RecurringTaskSkippedPlan,
	fieldMapping: FieldMapping
): TaskPatchOperation[] {
	const patch: TaskPatchOperation[] = [
		{ op: "set", field: fieldMapping.skippedInstances, value: plan.updatedTask.skipped_instances || [] },
		{ op: "set", field: fieldMapping.completeInstances, value: plan.updatedTask.complete_instances || [] },
		{ op: "set", field: fieldMapping.dateModified, value: plan.dateModified },
	];
	if (plan.updatedTask.scheduled) patch.push({ op: "set", field: fieldMapping.scheduled, value: plan.updatedTask.scheduled });
	if (plan.updatedTask.due) patch.push({ op: "set", field: fieldMapping.due, value: plan.updatedTask.due });
	return patch;
}

export function applyFrontmatterPatch(
	frontmatter: Record<string, unknown>,
	patch: readonly TaskPatchOperation[]
): Record<string, unknown> {
	const result = { ...frontmatter };
	for (const operation of patch) {
		if (operation.op === "set") {
			result[operation.field] = operation.value;
		} else {
			delete result[operation.field];
		}
	}
	return result;
}

export function specFrontmatterToTaskInfo(
	frontmatter: Record<string, unknown>,
	path = "task.md"
): TaskInfo {
	return {
		title: readString(frontmatter.title) || path.replace(/\.md$/i, ""),
		status: readString(frontmatter.status) || "open",
		priority: readString(frontmatter.priority) || "normal",
		path,
		archived: frontmatter.archived === true,
		due: readString(frontmatter.due),
		scheduled: readString(frontmatter.scheduled),
		completedDate: readString(frontmatter.completedDate),
		dateCreated: readString(frontmatter.dateCreated),
		dateModified: readString(frontmatter.dateModified),
		recurrence: readString(frontmatter.recurrence),
		recurrence_anchor:
			frontmatter.recurrenceAnchor === "completion" ? "completion" : "scheduled",
		complete_instances: getStringArray(frontmatter.completeInstances),
		skipped_instances: getStringArray(frontmatter.skippedInstances),
		timeEntries: sanitizeTimeEntries(frontmatter.timeEntries as TimeEntry[] | undefined),
		tags: getStringArray(frontmatter.tags),
		contexts: getStringArray(frontmatter.contexts),
		projects: getStringArray(frontmatter.projects),
		timeEstimate:
			typeof frontmatter.timeEstimate === "number" ? frontmatter.timeEstimate : undefined,
		blockedBy: normalizeBlockedByValue(frontmatter.blockedBy),
		reminders: Array.isArray(frontmatter.reminders)
			? (frontmatter.reminders as TaskInfo["reminders"])
			: undefined,
	};
}

export function taskInfoToSpecFields(task: Partial<TaskInfo>): Record<string, unknown> {
	const fields: Record<string, unknown> = {};
	writeIfDefined(fields, "title", task.title);
	writeIfDefined(fields, "status", task.status);
	writeIfDefined(fields, "priority", task.priority);
	writeIfDefined(fields, "due", task.due);
	writeIfDefined(fields, "scheduled", task.scheduled);
	writeIfDefined(fields, "completedDate", task.completedDate);
	writeIfDefined(fields, "dateCreated", task.dateCreated);
	writeIfDefined(fields, "dateModified", task.dateModified);
	writeIfDefined(fields, "recurrence", task.recurrence);
	writeIfDefined(fields, "recurrenceAnchor", task.recurrence_anchor);
	writeIfDefined(fields, "completeInstances", task.complete_instances);
	writeIfDefined(fields, "skippedInstances", task.skipped_instances);
	writeIfDefined(fields, "timeEntries", task.timeEntries);
	writeIfDefined(fields, "tags", task.tags);
	writeIfDefined(fields, "contexts", task.contexts);
	writeIfDefined(fields, "projects", task.projects);
	writeIfDefined(fields, "timeEstimate", task.timeEstimate);
	writeIfDefined(fields, "blockedBy", task.blockedBy);
	writeIfDefined(fields, "reminders", task.reminders);
	return fields;
}

export function buildSpecCompleteTaskUpdate({
	frontmatter,
	targetDate,
	completedStatus,
	currentTimestamp,
	path,
}: BuildSpecCompleteTaskUpdateInput): SpecTaskUpdatePlan {
	const task = specFrontmatterToTaskInfo(frontmatter, path);
	if (!task.recurrence) {
		const fields: Record<string, unknown> = {
			status: completedStatus,
			completedDate: targetDate,
		};
		if (currentTimestamp) fields.dateModified = currentTimestamp;
		return {
			fields,
			updatedTask: applySpecFieldsToTaskInfo(task, fields),
			dateModified: currentTimestamp,
			changed: true,
			metadata: { recurring: false, targetDate },
		};
	}

	const completeInstances = getStringArray(frontmatter.completeInstances);
	if (completeInstances.includes(targetDate)) {
		return {
			fields: {},
			updatedTask: task,
			dateModified: currentTimestamp,
			changed: false,
			metadata: { recurring: true, targetDate, alreadyCompleted: true },
		};
	}

	const recurring = completeRecurringTask({
		recurrence: task.recurrence,
		recurrenceAnchor: task.recurrence_anchor,
		scheduled: task.scheduled,
		due: task.due,
		dateCreated: task.dateCreated,
		completionDate: targetDate,
		completeInstances: task.complete_instances,
		skippedInstances: task.skipped_instances,
	});
	const fields: Record<string, unknown> = {
		recurrence: recurring.updatedRecurrence,
		completeInstances: recurring.completeInstances,
		skippedInstances: recurring.skippedInstances,
	};

	if (recurring.nextScheduled) {
		fields.scheduled = recurring.nextScheduled;
		if (recurring.nextDue) fields.due = recurring.nextDue;
	} else {
		fields.status = completedStatus;
		fields.completedDate = targetDate;
	}
	if (currentTimestamp) fields.dateModified = currentTimestamp;

	return {
		fields,
		updatedTask: applySpecFieldsToTaskInfo(task, fields),
		dateModified: currentTimestamp,
		changed: true,
		metadata: {
			recurring: true,
			targetDate,
			nextScheduled: recurring.nextScheduled,
			nextDue: recurring.nextDue,
		},
	};
}

export function buildSpecRecurringSkipUpdate({
	frontmatter,
	targetDate,
	skip,
	currentTimestamp,
	path,
}: BuildSpecRecurringSkipUpdateInput): SpecTaskUpdatePlan {
	const task = specFrontmatterToTaskInfo(frontmatter, path);
	if (!task.recurrence) {
		throw new Error("Skip/unskip is only supported for recurring tasks.");
	}

	const skippedInstances = getStringArray(frontmatter.skippedInstances);
	const completeInstances = getStringArray(frontmatter.completeInstances);
	const alreadyInState = skip
		? skippedInstances.includes(targetDate)
		: !skippedInstances.includes(targetDate);
	if (alreadyInState) {
		return {
			fields: {},
			updatedTask: task,
			dateModified: currentTimestamp,
			changed: false,
			metadata: { targetDate, skip, alreadyInState: true },
		};
	}

	const nextSkippedInstances = skip
		? appendUnique(skippedInstances, targetDate)
		: skippedInstances.filter((date) => date !== targetDate);
	const nextCompleteInstances = completeInstances.filter((date) => date !== targetDate);
	const schedule = recalculateRecurringSchedule({
		recurrence: task.recurrence,
		recurrenceAnchor: task.recurrence_anchor,
		scheduled: task.scheduled,
		due: task.due,
		dateCreated: task.dateCreated,
		completeInstances: nextCompleteInstances,
		skippedInstances: nextSkippedInstances,
		referenceDate: targetDate,
	});
	const fields: Record<string, unknown> = {
		recurrence: schedule.updatedRecurrence,
		completeInstances: nextCompleteInstances,
		skippedInstances: nextSkippedInstances,
	};
	if (schedule.nextScheduled) fields.scheduled = schedule.nextScheduled;
	if (schedule.nextDue) fields.due = schedule.nextDue;
	if (currentTimestamp) fields.dateModified = currentTimestamp;

	return {
		fields,
		updatedTask: applySpecFieldsToTaskInfo(task, fields),
		dateModified: currentTimestamp,
		changed: true,
		metadata: {
			targetDate,
			skip,
			nextScheduled: schedule.nextScheduled,
			nextDue: schedule.nextDue,
		},
	};
}

export function buildSpecStartTimeTrackingUpdate({
	frontmatter,
	currentTimestamp,
	startTimestamp = currentTimestamp,
	description,
	path,
}: BuildSpecStartTimeTrackingUpdateInput): SpecTaskUpdatePlan {
	const task = specFrontmatterToTaskInfo(frontmatter, path);
	if (getActiveTimeEntry(task)) {
		throw new Error("time_tracking_already_active");
	}
	const plan = buildStartTimeTrackingPlan(
		task,
		currentTimestamp,
		startTimestamp,
		description ?? ""
	);
	if (description === undefined && plan.newEntry.description === "") {
		delete plan.newEntry.description;
		const entries = plan.updatedTask.timeEntries ?? [];
		const lastEntry = entries[entries.length - 1];
		if (lastEntry) delete lastEntry.description;
	}
	return {
		fields: taskInfoToSpecFields({
			timeEntries: plan.updatedTask.timeEntries,
			dateModified: plan.dateModified,
		}),
		updatedTask: plan.updatedTask,
		dateModified: plan.dateModified,
		changed: true,
		metadata: { newEntry: plan.newEntry },
	};
}

export function buildSpecStopTimeTrackingUpdate({
	frontmatter,
	currentTimestamp,
	stopTimestamp = currentTimestamp,
	path,
}: BuildSpecStopTimeTrackingUpdateInput): SpecTaskUpdatePlan {
	const task = specFrontmatterToTaskInfo(frontmatter, path);
	const activeEntry = getActiveTimeEntry(task);
	if (!activeEntry) {
		throw new Error("no_active_time_entry");
	}
	const plan = buildStopTimeTrackingPlan(task, activeEntry, currentTimestamp, stopTimestamp);
	const stoppedEntry = plan.updatedTask.timeEntries?.find(
		(entry) => entry.startTime === activeEntry.startTime
	);
	return {
		fields: taskInfoToSpecFields({
			timeEntries: plan.updatedTask.timeEntries,
			dateModified: plan.dateModified,
		}),
		updatedTask: plan.updatedTask,
		dateModified: plan.dateModified,
		changed: true,
		metadata: { activeEntry, stoppedEntry },
	};
}

function buildSetPatch(frontmatter: Record<string, unknown>): TaskPatchOperation[] {
	return Object.entries(frontmatter)
		.filter(([, value]) => value !== undefined)
		.map(([field, value]) => ({ op: "set", field, value }) satisfies TaskPatchOperation);
}

function applySpecFieldsToTaskInfo(task: TaskInfo, fields: Record<string, unknown>): TaskInfo {
	const updatedTask = { ...task };
	if (Object.prototype.hasOwnProperty.call(fields, "title")) updatedTask.title = readString(fields.title) || updatedTask.title;
	if (Object.prototype.hasOwnProperty.call(fields, "status")) updatedTask.status = readString(fields.status) || updatedTask.status;
	if (Object.prototype.hasOwnProperty.call(fields, "priority")) updatedTask.priority = readString(fields.priority) || updatedTask.priority;
	if (Object.prototype.hasOwnProperty.call(fields, "due")) updatedTask.due = readString(fields.due);
	if (Object.prototype.hasOwnProperty.call(fields, "scheduled")) updatedTask.scheduled = readString(fields.scheduled);
	if (Object.prototype.hasOwnProperty.call(fields, "completedDate")) updatedTask.completedDate = readString(fields.completedDate);
	if (Object.prototype.hasOwnProperty.call(fields, "dateCreated")) updatedTask.dateCreated = readString(fields.dateCreated);
	if (Object.prototype.hasOwnProperty.call(fields, "dateModified")) updatedTask.dateModified = readString(fields.dateModified);
	if (Object.prototype.hasOwnProperty.call(fields, "recurrence")) updatedTask.recurrence = readString(fields.recurrence);
	if (Object.prototype.hasOwnProperty.call(fields, "recurrenceAnchor")) {
		updatedTask.recurrence_anchor = fields.recurrenceAnchor === "completion" ? "completion" : "scheduled";
	}
	if (Object.prototype.hasOwnProperty.call(fields, "completeInstances")) {
		updatedTask.complete_instances = getStringArray(fields.completeInstances);
	}
	if (Object.prototype.hasOwnProperty.call(fields, "skippedInstances")) {
		updatedTask.skipped_instances = getStringArray(fields.skippedInstances);
	}
	if (Object.prototype.hasOwnProperty.call(fields, "timeEntries")) {
		updatedTask.timeEntries = sanitizeTimeEntries(fields.timeEntries as TimeEntry[] | undefined);
	}
	return updatedTask;
}

function addUnsetMappedFieldDeletes(
	patch: TaskPatchOperation[],
	updates: TaskUpdateInput,
	fieldMapping: FieldMapping
): void {
	const deletable: Array<[keyof TaskUpdateInput, FieldMappingKey]> = [
		["due", "due"],
		["scheduled", "scheduled"],
		["contexts", "contexts"],
		["timeEstimate", "timeEstimate"],
		["completedDate", "completedDate"],
		["recurrence", "recurrence"],
		["blockedBy", "blockedBy"],
		["googleCalendarExceptionOriginalScheduled", "googleCalendarExceptionOriginalScheduled"],
	];
	for (const [updateKey, mappingKey] of deletable) {
		if (Object.prototype.hasOwnProperty.call(updates, updateKey) && updates[updateKey] === undefined) {
			patch.push({ op: "delete", field: fieldMapping[mappingKey] });
		}
	}
	if (Object.prototype.hasOwnProperty.call(updates, "projects")) {
		if (!Array.isArray(updates.projects) || updates.projects.length === 0) {
			patch.push({ op: "delete", field: fieldMapping.projects });
		}
	}
	if (
		Object.prototype.hasOwnProperty.call(updates, "googleCalendarMovedOriginalDates") &&
		(!Array.isArray(updates.googleCalendarMovedOriginalDates) ||
			updates.googleCalendarMovedOriginalDates.length === 0)
	) {
		patch.push({ op: "delete", field: fieldMapping.googleCalendarMovedOriginalDates });
	}
}

function fieldNameForTaskProperty(fieldMapping: FieldMapping, property: keyof TaskInfo): string | undefined {
	const explicit: Partial<Record<keyof TaskInfo, FieldMappingKey>> = {
		title: "title",
		status: "status",
		priority: "priority",
		due: "due",
		scheduled: "scheduled",
		contexts: "contexts",
		projects: "projects",
		timeEstimate: "timeEstimate",
		completedDate: "completedDate",
		dateCreated: "dateCreated",
		dateModified: "dateModified",
		recurrence: "recurrence",
		complete_instances: "completeInstances",
		skipped_instances: "skippedInstances",
		timeEntries: "timeEntries",
		blockedBy: "blockedBy",
		reminders: "reminders",
		sortOrder: "sortOrder",
	};
	const mappingKey = explicit[property];
	return mappingKey ? fieldMapping[mappingKey] : undefined;
}

function stripTimeEntryDuration(entry: TimeEntry): TimeEntry {
	const sanitizedEntry = { ...entry };
	delete sanitizedEntry.duration;
	return sanitizedEntry;
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function writeIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
	if (value !== undefined) {
		target[key] = value;
	}
}

function appendUnique(values: string[], value: string): string[] {
	return values.includes(value) ? values : [...values, value];
}

function getStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}
