import type { TaskInfo, TimeEntry } from "../../types";

export interface StartTimeTrackingPlan {
	updatedTask: TaskInfo;
	newEntry: TimeEntry;
	dateModified: string;
}

export interface StopTimeTrackingPlan {
	updatedTask: TaskInfo;
	stopTimestamp: string;
	dateModified: string;
}

export interface DeleteTimeEntryPlan {
	updatedTask: TaskInfo;
	timeEntryIndex: number;
	dateModified: string;
}

export interface ApplyStartTimeTrackingFrontmatterInput {
	frontmatter: Record<string, unknown>;
	timeEntriesField: string;
	dateModifiedField: string;
	newEntry: TimeEntry;
	dateModified: string;
}

export interface ApplyStopTimeTrackingFrontmatterInput {
	frontmatter: Record<string, unknown>;
	timeEntriesField: string;
	dateModifiedField: string;
	activeSession: TimeEntry;
	stopTimestamp: string;
	dateModified: string;
}

export interface ApplyDeleteTimeEntryFrontmatterInput {
	frontmatter: Record<string, unknown>;
	timeEntriesField: string;
	dateModifiedField: string;
	timeEntryIndex: number;
	dateModified: string;
}

export function removeTimeEntryDuration(entry: TimeEntry): TimeEntry {
	const sanitizedEntry = { ...entry };
	delete sanitizedEntry.duration;
	return sanitizedEntry;
}

export function sanitizeTimeEntries(entries: TimeEntry[] | undefined): TimeEntry[] {
	return Array.isArray(entries) ? entries.map(removeTimeEntryDuration) : [];
}

export function buildStartTimeTrackingPlan(
	task: TaskInfo,
	currentTimestamp: string,
	startTimestamp: string
): StartTimeTrackingPlan {
	const newEntry: TimeEntry = {
		startTime: startTimestamp,
		description: "Work session",
	};
	const updatedTask = {
		...task,
		dateModified: currentTimestamp,
		timeEntries: [...sanitizeTimeEntries(task.timeEntries), newEntry],
	};

	return {
		updatedTask,
		newEntry,
		dateModified: currentTimestamp,
	};
}

export function buildStopTimeTrackingPlan(
	task: TaskInfo,
	activeSession: TimeEntry,
	currentTimestamp: string,
	stopTimestamp: string
): StopTimeTrackingPlan {
	const updatedTask = {
		...task,
		dateModified: currentTimestamp,
	};

	if (Array.isArray(task.timeEntries)) {
		const timeEntries = sanitizeTimeEntries(task.timeEntries);
		const entryIndex = timeEntries.findIndex(
			(entry) => entry.startTime === activeSession.startTime && !entry.endTime
		);
		if (entryIndex !== -1) {
			timeEntries[entryIndex] = {
				...timeEntries[entryIndex],
				endTime: stopTimestamp,
			};
		}
		updatedTask.timeEntries = timeEntries;
	}

	return {
		updatedTask,
		stopTimestamp,
		dateModified: currentTimestamp,
	};
}

export function applyStartTimeTrackingFrontmatterChange({
	frontmatter,
	timeEntriesField,
	dateModifiedField,
	newEntry,
	dateModified,
}: ApplyStartTimeTrackingFrontmatterInput): void {
	if (!frontmatter[timeEntriesField]) {
		frontmatter[timeEntriesField] = [];
	}
	if (Array.isArray(frontmatter[timeEntriesField])) {
		frontmatter[timeEntriesField] = (
			frontmatter[timeEntriesField] as TimeEntry[]
		).map(removeTimeEntryDuration);
	}

	(frontmatter[timeEntriesField] as TimeEntry[]).push(newEntry);
	frontmatter[dateModifiedField] = dateModified;
}

export function buildDeleteTimeEntryPlan(
	task: TaskInfo,
	timeEntryIndex: number,
	currentTimestamp: string
): DeleteTimeEntryPlan {
	if (!Array.isArray(task.timeEntries)) {
		throw new Error("Task has no time entries");
	}

	if (timeEntryIndex < 0 || timeEntryIndex >= task.timeEntries.length) {
		throw new Error("Invalid time entry index");
	}

	return {
		updatedTask: {
			...task,
			dateModified: currentTimestamp,
			timeEntries: task.timeEntries.filter((_, index) => index !== timeEntryIndex),
		},
		timeEntryIndex,
		dateModified: currentTimestamp,
	};
}

export function applyDeleteTimeEntryFrontmatterChange({
	frontmatter,
	timeEntriesField,
	dateModifiedField,
	timeEntryIndex,
	dateModified,
}: ApplyDeleteTimeEntryFrontmatterInput): void {
	if (frontmatter[timeEntriesField] && Array.isArray(frontmatter[timeEntriesField])) {
		frontmatter[timeEntriesField] = (frontmatter[timeEntriesField] as TimeEntry[]).filter(
			(_, index) => index !== timeEntryIndex
		);
	}

	frontmatter[dateModifiedField] = dateModified;
}

export function applyStopTimeTrackingFrontmatterChange({
	frontmatter,
	timeEntriesField,
	dateModifiedField,
	activeSession,
	stopTimestamp,
	dateModified,
}: ApplyStopTimeTrackingFrontmatterInput): void {
	if (frontmatter[timeEntriesField] && Array.isArray(frontmatter[timeEntriesField])) {
		const timeEntries = (frontmatter[timeEntriesField] as TimeEntry[]).map(
			removeTimeEntryDuration
		);
		const entryIndex = timeEntries.findIndex(
			(entry) => entry.startTime === activeSession.startTime && !entry.endTime
		);

		if (entryIndex !== -1) {
			timeEntries[entryIndex].endTime = stopTimestamp;
		}
		frontmatter[timeEntriesField] = timeEntries;
	}
	frontmatter[dateModifiedField] = dateModified;
}
