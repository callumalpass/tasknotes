import type { FieldMappingKey, TaskInfo, TimeEntry } from "../../types";
import {
	addDTSTARTToRecurrenceRule,
	updateToNextScheduledOccurrence,
} from "../../core/recurrence";
import {
	applyGoogleCalendarRecurringExceptionCleanup,
	applyGoogleCalendarRecurringExceptionForScheduledChange,
} from "./googleCalendarRecurringExceptions";
import {
	applyPropertyTaskIdentifier,
	getFrontmatterTags,
} from "../../utils/taskIdentificationFrontmatter";

export type TaskUpdateInput = Partial<TaskInfo> & {
	details?: string;
	customFrontmatter?: Record<string, unknown>;
};

export interface TaskUpdateFieldMapper {
	mapToFrontmatter: (
		taskData: Partial<TaskInfo>,
		taskTag?: string,
		storeTitleInFilename?: boolean
	) => Record<string, unknown>;
	toUserField: (field: FieldMappingKey) => string;
}

export interface TaskIdentificationSettings {
	method: string;
	tag: string;
	propertyName: string;
	propertyValue: string;
}

export interface BuildTaskUpdateRecurrenceUpdatesInput {
	originalTask: TaskInfo;
	updates: TaskUpdateInput;
	maintainDueDateOffsetInRecurring: boolean;
	updateToNextScheduledOccurrenceFn?: typeof updateToNextScheduledOccurrence;
	addDTSTARTToRecurrenceRuleFn?: typeof addDTSTARTToRecurrenceRule;
}

export interface ApplyTaskUpdateFrontmatterChangeInput {
	frontmatter: Record<string, unknown>;
	originalTask: TaskInfo;
	updates: TaskUpdateInput;
	recurrenceUpdates: Partial<TaskInfo>;
	dateModified: string;
	fieldMapper: TaskUpdateFieldMapper;
	taskIdentification: TaskIdentificationSettings;
	storeTitleInFilename: boolean;
	updateCompletedDateInFrontmatter: (
		frontmatter: Record<string, unknown>,
		newStatus: string,
		isRecurring: boolean
	) => void;
}

export interface ApplyTaskUpdateFrontmatterChangeResult {
	finalTags: string[];
}

export interface BuildUpdatedTaskFromPlanInput {
	originalTask: TaskInfo;
	updates: TaskUpdateInput;
	recurrenceUpdates: Partial<TaskInfo>;
	newPath: string;
	dateModified: string;
	currentDateString: string;
	normalizedDetails: string | null;
	finalTags?: string[];
	isCompletedStatus: (status: string) => boolean;
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

function stripTimeEntryDuration(entry: TimeEntry): TimeEntry {
	const sanitizedEntry = { ...entry };
	delete sanitizedEntry.duration;
	return sanitizedEntry;
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
	updateToNextScheduledOccurrenceFn = updateToNextScheduledOccurrence,
	addDTSTARTToRecurrenceRuleFn = addDTSTARTToRecurrenceRule,
}: BuildTaskUpdateRecurrenceUpdatesInput): Partial<TaskInfo> {
	const recurrenceUpdates: Partial<TaskInfo> = {};

	if (updates.recurrence !== undefined && updates.recurrence !== originalTask.recurrence) {
		const tempTask: TaskInfo = { ...originalTask, ...updates };
		const nextDates = updateToNextScheduledOccurrenceFn(
			tempTask,
			maintainDueDateOffsetInRecurring
		);
		if (nextDates.scheduled) {
			recurrenceUpdates.scheduled = nextDates.scheduled;
		}
		if (nextDates.due) {
			recurrenceUpdates.due = nextDates.due;
		}
		if (
			typeof updates.recurrence === "string" &&
			updates.recurrence &&
			!updates.recurrence.includes("DTSTART:")
		) {
			const tempTaskWithRecurrence: TaskInfo = {
				...originalTask,
				...updates,
				...recurrenceUpdates,
			};
			const updatedRecurrence = addDTSTARTToRecurrenceRuleFn(tempTaskWithRecurrence);
			if (updatedRecurrence) {
				recurrenceUpdates.recurrence = updatedRecurrence;
			}
		}
	} else if (
		updates.recurrence !== undefined &&
		!originalTask.recurrence &&
		updates.recurrence
	) {
		if (
			typeof updates.recurrence === "string" &&
			!updates.recurrence.includes("DTSTART:")
		) {
			const tempTask: TaskInfo = { ...originalTask, ...updates };
			const updatedRecurrence = addDTSTARTToRecurrenceRuleFn(tempTask);
			if (updatedRecurrence) {
				recurrenceUpdates.recurrence = updatedRecurrence;
			}
		}
	}

	if (
		updates.scheduled !== undefined &&
		updates.scheduled !== originalTask.scheduled &&
		originalTask.recurrence &&
		typeof originalTask.recurrence === "string" &&
		!originalTask.recurrence.includes("DTSTART:")
	) {
		const tempTask: TaskInfo = { ...originalTask, ...updates };
		const updatedRecurrence = addDTSTARTToRecurrenceRuleFn(tempTask);
		if (updatedRecurrence) {
			recurrenceUpdates.recurrence = updatedRecurrence;
		}
	}

	if (Object.prototype.hasOwnProperty.call(updates, "scheduled")) {
		const nextTask: TaskInfo = { ...originalTask, ...updates, ...recurrenceUpdates };
		applyGoogleCalendarRecurringExceptionForScheduledChange(
			originalTask,
			updates.scheduled,
			nextTask
		);
		recurrenceUpdates.googleCalendarExceptionOriginalScheduled =
			nextTask.googleCalendarExceptionOriginalScheduled;
	}

	const nextTask: TaskInfo = { ...originalTask, ...updates, ...recurrenceUpdates };
	applyGoogleCalendarRecurringExceptionCleanup(nextTask);
	recurrenceUpdates.googleCalendarExceptionOriginalScheduled =
		nextTask.googleCalendarExceptionOriginalScheduled;
	recurrenceUpdates.googleCalendarMovedOriginalDates = nextTask.googleCalendarMovedOriginalDates;

	return recurrenceUpdates;
}

export function applyTaskUpdateFrontmatterChange({
	frontmatter,
	originalTask,
	updates,
	recurrenceUpdates,
	dateModified,
	fieldMapper,
	taskIdentification,
	storeTitleInFilename,
	updateCompletedDateInFrontmatter,
}: ApplyTaskUpdateFrontmatterChangeInput): ApplyTaskUpdateFrontmatterChangeResult {
	const completeTaskData: Partial<TaskInfo> = {
		...originalTask,
		...updates,
		...recurrenceUpdates,
		dateModified,
	};

	const mappedFrontmatter = fieldMapper.mapToFrontmatter(
		completeTaskData,
		taskIdentification.method === "tag" ? taskIdentification.tag : undefined,
		storeTitleInFilename
	);

	Object.entries(mappedFrontmatter).forEach(([key, value]) => {
		if (value !== undefined) {
			frontmatter[key] = value;
		}
	});

	if (updates.status !== undefined) {
		updateCompletedDateInFrontmatter(frontmatter, updates.status, !!originalTask.recurrence);
	}

	if (taskIdentification.method === "property") {
		applyConfiguredPropertyTaskIdentifier(frontmatter, taskIdentification);
	}

	if (updates.customFrontmatter) {
		Object.entries(updates.customFrontmatter).forEach(([key, value]) => {
			if (value === null) {
				delete frontmatter[key];
			} else {
				frontmatter[key] = value;
			}
		});
	}

	removeUnsetMappedFields(frontmatter, { ...updates, ...recurrenceUpdates }, fieldMapper);

	if (storeTitleInFilename) {
		delete frontmatter[fieldMapper.toUserField("title")];
	}

	if (Object.prototype.hasOwnProperty.call(updates, "tags")) {
		const tagsToSet = Array.isArray(updates.tags) ? [...updates.tags] : [];
		if (tagsToSet.length > 0) {
			frontmatter.tags = tagsToSet;
		} else {
			delete frontmatter.tags;
		}
	}

	if (taskIdentification.method === "property") {
		applyPropertyTaskIdentifier(
			frontmatter,
			taskIdentification.propertyName,
			taskIdentification.propertyValue
		);
	}

	return {
		finalTags: getFrontmatterTags(frontmatter.tags),
	};
}

function applyConfiguredPropertyTaskIdentifier(
	frontmatter: Record<string, unknown>,
	taskIdentification: TaskIdentificationSettings
): void {
	if (taskIdentification.propertyName && taskIdentification.propertyValue) {
		applyPropertyTaskIdentifier(
			frontmatter,
			taskIdentification.propertyName,
			taskIdentification.propertyValue
		);
	}
}

function removeUnsetMappedFields(
	frontmatter: Record<string, unknown>,
	updates: TaskUpdateInput,
	fieldMapper: TaskUpdateFieldMapper
): void {
	if (Object.prototype.hasOwnProperty.call(updates, "due") && updates.due === undefined) {
		delete frontmatter[fieldMapper.toUserField("due")];
	}
	if (
		Object.prototype.hasOwnProperty.call(updates, "scheduled") &&
		updates.scheduled === undefined
	) {
		delete frontmatter[fieldMapper.toUserField("scheduled")];
	}
	if (
		Object.prototype.hasOwnProperty.call(updates, "contexts") &&
		updates.contexts === undefined
	) {
		delete frontmatter[fieldMapper.toUserField("contexts")];
	}
	if (Object.prototype.hasOwnProperty.call(updates, "projects")) {
		const projectsField = fieldMapper.toUserField("projects");
		const projectsToSet = Array.isArray(updates.projects) ? updates.projects : [];
		if (projectsToSet.length > 0) {
			frontmatter[projectsField] = projectsToSet;
		} else {
			delete frontmatter[projectsField];
		}
	}
	if (
		Object.prototype.hasOwnProperty.call(updates, "timeEstimate") &&
		updates.timeEstimate === undefined
	) {
		delete frontmatter[fieldMapper.toUserField("timeEstimate")];
	}
	if (
		Object.prototype.hasOwnProperty.call(updates, "completedDate") &&
		updates.completedDate === undefined
	) {
		delete frontmatter[fieldMapper.toUserField("completedDate")];
	}
	if (
		Object.prototype.hasOwnProperty.call(updates, "recurrence") &&
		updates.recurrence === undefined
	) {
		delete frontmatter[fieldMapper.toUserField("recurrence")];
	}
	if (
		Object.prototype.hasOwnProperty.call(
			updates,
			"googleCalendarExceptionOriginalScheduled"
		) &&
		updates.googleCalendarExceptionOriginalScheduled === undefined
	) {
		delete frontmatter[fieldMapper.toUserField("googleCalendarExceptionOriginalScheduled")];
	}
	if (
		Object.prototype.hasOwnProperty.call(updates, "googleCalendarMovedOriginalDates") &&
		(!Array.isArray(updates.googleCalendarMovedOriginalDates) ||
			updates.googleCalendarMovedOriginalDates.length === 0)
	) {
		delete frontmatter[fieldMapper.toUserField("googleCalendarMovedOriginalDates")];
	}
	if (
		Object.prototype.hasOwnProperty.call(updates, "blockedBy") &&
		updates.blockedBy === undefined
	) {
		delete frontmatter[fieldMapper.toUserField("blockedBy")];
	}
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
	isCompletedStatus,
}: BuildUpdatedTaskFromPlanInput): TaskInfo {
	const updatedTask: TaskInfo = {
		...originalTask,
		...updates,
		...recurrenceUpdates,
		path: newPath,
		dateModified,
	};

	if (finalTags) {
		updatedTask.tags = finalTags;
	}

	if (normalizedDetails !== null) {
		updatedTask.details = normalizedDetails;
	}

	if (updates.status !== undefined && !originalTask.recurrence) {
		if (isCompletedStatus(updates.status)) {
			if (!originalTask.completedDate) {
				updatedTask.completedDate = currentDateString;
			}
		} else {
			updatedTask.completedDate = undefined;
		}
	}

	return updatedTask;
}
