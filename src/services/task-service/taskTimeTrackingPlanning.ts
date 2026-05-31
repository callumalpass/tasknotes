import {
	buildDeleteTimeEntryPlan,
	buildStartTimeTrackingPlan,
	buildStopTimeTrackingPlan,
	removeTimeEntryDuration,
	sanitizeTimeEntries,
} from "@tasknotes/model/time";
import type { TimeEntry } from "../../types";

export type {
	DeleteTimeEntryPlan,
	StartTimeTrackingPlan,
	StopTimeTrackingPlan,
} from "@tasknotes/model/time";

export {
	buildDeleteTimeEntryPlan,
	buildStartTimeTrackingPlan,
	buildStopTimeTrackingPlan,
	removeTimeEntryDuration,
	sanitizeTimeEntries,
};

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
