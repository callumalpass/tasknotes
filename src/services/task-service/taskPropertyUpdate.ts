import type { TaskDependency, TaskInfo } from "../../types";
import { normalizeDependencyEntry, serializeDependencies } from "../../utils/dependencyUtils";
import { assertValidFrontmatterFieldName } from "./taskPropertyFrontmatterField";

export interface TaskPropertyUpdatePlan {
	updatedTask: TaskInfo;
	normalizedValue: unknown;
	dateModified: string;
}

export interface BuildTaskPropertyUpdatePlanInput {
	freshTask: TaskInfo;
	property: keyof TaskInfo;
	value: unknown;
	currentTimestamp: string;
	currentDateString: string;
	normalizeStatusValue: (value: unknown) => string;
	isCompletedStatus: (status: string) => boolean;
}

export interface ApplyTaskPropertyFrontmatterChangeInput {
	frontmatter: Record<string, unknown>;
	property: keyof TaskInfo;
	fieldName: string;
	rawValue: unknown;
	normalizedValue: unknown;
	dateModified: string;
	dateModifiedField: string;
	completedDateField: string;
	isRecurring: boolean;
	normalizeStatusValue: (value: unknown) => string;
	isCompletedStatus: (status: string) => boolean;
	currentDateString: string;
}

export function normalizeTaskPropertyValue(
	property: keyof TaskInfo,
	value: unknown,
	normalizeStatusValue: (value: unknown) => string
): unknown {
	if (property === "status") {
		return normalizeStatusValue(value);
	}

	if (property === "blockedBy") {
		return normalizeBlockedByValue(value);
	}

	return value;
}

export function normalizeBlockedByValue(value: unknown): TaskDependency[] | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}

	const rawEntries = Array.isArray(value) ? value : [value];
	const normalized = rawEntries
		.map((entry) => normalizeDependencyEntry(entry))
		.filter((entry): entry is TaskDependency => !!entry);

	return normalized.length > 0 ? normalized : undefined;
}

export function buildTaskPropertyUpdatePlan({
	freshTask,
	property,
	value,
	currentTimestamp,
	currentDateString,
	normalizeStatusValue,
	isCompletedStatus,
}: BuildTaskPropertyUpdatePlanInput): TaskPropertyUpdatePlan {
	const normalizedValue = normalizeTaskPropertyValue(property, value, normalizeStatusValue);
	const updatedTask = { ...freshTask } as Record<string, unknown>;
	updatedTask[property] = normalizedValue;
	updatedTask.dateModified = currentTimestamp;

	if (property === "status" && !freshTask.recurrence) {
		const normalizedStatus = normalizeStatusValue(normalizedValue);
		if (isCompletedStatus(normalizedStatus)) {
			updatedTask.completedDate = currentDateString;
		} else {
			updatedTask.completedDate = undefined;
		}
	}

	return {
		updatedTask: updatedTask as unknown as TaskInfo,
		normalizedValue,
		dateModified: currentTimestamp,
	};
}

function coerceStatusFrontmatterValue(normalizedStatus: string): string | boolean {
	const lower = normalizedStatus.toLowerCase();
	return lower === "true" || lower === "false" ? lower === "true" : normalizedStatus;
}

export function updateCompletedDateFrontmatter(
	frontmatter: Record<string, unknown>,
	newStatus: string,
	isRecurring: boolean,
	completedDateField: string,
	isCompletedStatus: (status: string) => boolean,
	currentDateString: string
): void {
	if (isRecurring) {
		return;
	}

	if (isCompletedStatus(newStatus)) {
		frontmatter[completedDateField] = currentDateString;
		return;
	}

	if (frontmatter[completedDateField]) {
		delete frontmatter[completedDateField];
	}
}

export function applyTaskPropertyFrontmatterChange({
	frontmatter,
	property,
	fieldName,
	rawValue,
	normalizedValue,
	dateModified,
	dateModifiedField,
	completedDateField,
	isRecurring,
	normalizeStatusValue,
	isCompletedStatus,
	currentDateString,
}: ApplyTaskPropertyFrontmatterChangeInput): void {
	const resolvedFieldName = assertValidFrontmatterFieldName(
		fieldName,
		`task property ${String(property)}`
	);
	const resolvedDateModifiedField = assertValidFrontmatterFieldName(
		dateModifiedField,
		"dateModified field mapping"
	);
	const resolvedCompletedDateField = assertValidFrontmatterFieldName(
		completedDateField,
		"completedDate field mapping"
	);

	if (property === "status") {
		const normalizedStatus = normalizeStatusValue(normalizedValue);
		frontmatter[resolvedFieldName] = coerceStatusFrontmatterValue(normalizedStatus);
		updateCompletedDateFrontmatter(
			frontmatter,
			normalizedStatus,
			isRecurring,
			resolvedCompletedDateField,
			isCompletedStatus,
			currentDateString
		);
	} else if ((property === "due" || property === "scheduled") && !rawValue) {
		delete frontmatter[resolvedFieldName];
	} else if (property === "blockedBy") {
		const dependencies = Array.isArray(normalizedValue)
			? (normalizedValue as TaskDependency[])
			: [];
		if (dependencies.length > 0) {
			frontmatter[resolvedFieldName] = serializeDependencies(dependencies);
		} else {
			delete frontmatter[resolvedFieldName];
		}
	} else {
		frontmatter[resolvedFieldName] = normalizedValue;
	}

	frontmatter[resolvedDateModifiedField] = dateModified;
}
