import type { TaskInfo } from "../types";
import { parseDateToUTC } from "../utils/dateUtils";
import { normalizeDateValueForCalendar } from "./calendarPropertyEvents";
import type { CalendarRecreateNavigationState } from "./calendarRecreateUtils";

export type CalendarInitialDateStrategy = "first" | "earliest" | "latest";

export type CalendarInitialDateOptions = {
	initialDate: string;
	initialDateProperty: string | null;
	initialDateStrategy: CalendarInitialDateStrategy;
};

export type CalendarInitialDateCandidate = {
	compare: Date;
	value: string | Date;
};

export type DetermineCalendarInitialDateInput = {
	viewOptions: CalendarInitialDateOptions;
	taskNotes: readonly TaskInfo[];
	entries?: readonly unknown[] | null;
	getEntryPropertyValue?: (entry: unknown, propertyId: string) => unknown;
	getContextPropertyValue?: (propertyId: string) => unknown;
	mapPropertyToTaskField: (propertyId: string) => string;
};

export function determineCalendarInitialDate({
	viewOptions,
	taskNotes,
	entries,
	getEntryPropertyValue,
	getContextPropertyValue,
	mapPropertyToTaskField,
}: DetermineCalendarInitialDateInput): Date | string | undefined {
	if (viewOptions.initialDate) {
		const normalized = normalizeDateValueForCalendar(viewOptions.initialDate);
		return normalized?.value ?? viewOptions.initialDate;
	}

	if (!viewOptions.initialDateProperty) {
		return undefined;
	}

	const dates = collectCalendarInitialDateCandidates({
		propertyId: viewOptions.initialDateProperty,
		taskNotes,
		entries,
		getEntryPropertyValue,
		mapPropertyToTaskField,
	});

	if (dates.length === 0) {
		const contextCandidate = getContextPropertyValue
			? toCalendarInitialDateCandidate(getContextPropertyValue(viewOptions.initialDateProperty))
			: null;
		return contextCandidate?.value;
	}

	if (viewOptions.initialDateStrategy === "earliest") {
		return dates.reduce((prev, curr) =>
			curr.compare.getTime() < prev.compare.getTime() ? curr : prev
		).value;
	}

	if (viewOptions.initialDateStrategy === "latest") {
		return dates.reduce((prev, curr) =>
			curr.compare.getTime() > prev.compare.getTime() ? curr : prev
		).value;
	}

	return dates[0].value;
}

export function collectCalendarInitialDateCandidates({
	propertyId,
	taskNotes,
	entries,
	getEntryPropertyValue,
	mapPropertyToTaskField,
}: Omit<DetermineCalendarInitialDateInput, "viewOptions"> & {
	propertyId: string;
}): CalendarInitialDateCandidate[] {
	const dates: CalendarInitialDateCandidate[] = [];

	if (entries && getEntryPropertyValue) {
		for (const entry of entries) {
			const candidate = toCalendarInitialDateCandidate(
				getEntryPropertyValue(entry, propertyId)
			);
			if (candidate) {
				dates.push(candidate);
			}
		}
	}

	if (dates.length > 0) {
		return dates;
	}

	const internalFieldName = mapPropertyToTaskField(propertyId);
	for (const task of taskNotes) {
		const taskRecord = task as unknown as Record<string, unknown>;
		const customProperties = task.customProperties;
		const value =
			taskRecord[internalFieldName] ??
			customProperties?.[internalFieldName] ??
			customProperties?.[propertyId];
		const candidate = toCalendarInitialDateCandidate(value);
		if (candidate) {
			dates.push(candidate);
		}
	}

	return dates;
}

export function toCalendarInitialDateCandidate(
	value: unknown
): CalendarInitialDateCandidate | null {
	const normalized = normalizeDateValueForCalendar(value);
	if (!normalized) return null;

	const compareDate = normalized.isAllDay
		? parseDateToUTC(normalized.value as string)
		: new Date(normalized.value);
	if (Number.isNaN(compareDate.getTime())) return null;

	return { compare: compareDate, value: normalized.value };
}

export function getCalendarRecreateNavigationState(
	viewOptions: CalendarInitialDateOptions
): CalendarRecreateNavigationState {
	return {
		initialDate: viewOptions.initialDate,
		initialDateProperty: viewOptions.initialDateProperty,
		initialDateStrategy: viewOptions.initialDateStrategy,
	};
}
