import {
	coerceStatusFrontmatterValue,
	DEFAULT_DEPENDENCY_RELTYPE,
	extractDependencyUid,
	getFrontmatterTags,
	isRecognizedProperty as modelIsRecognizedProperty,
	isValidDependencyRelType,
	lookupMappingKey as modelLookupMappingKey,
	mapTaskFromFrontmatter as modelMapTaskFromFrontmatter,
	mapTaskToFrontmatter as modelMapTaskToFrontmatter,
	normalizeDependencyEntry,
	normalizeDependencyList,
	normalizeFrontmatterTag,
	normalizePriorityConfigValue,
	normalizeStatusConfigValue,
	normalizeTitleValue,
	parseLinkToPath,
	serializeDependencies,
	validateFieldMapping as modelValidateFieldMapping,
	VALID_DEPENDENCY_RELTYPES,
} from "@tasknotes/model/mapping";
import { validateDateString } from "@tasknotes/model/date";
import type {
	FieldMapping,
	FieldMappingKey,
	PriorityConfig,
	StatusConfig,
	TaskInfo,
} from "../types";
import type { UserMappedField } from "../types/settings";
import { DEFAULT_RECURRENCE_ORIGINAL_DATE_PROPERTY } from "./defaultFieldMapping";

export {
	coerceStatusFrontmatterValue,
	DEFAULT_DEPENDENCY_RELTYPE,
	extractDependencyUid,
	getFrontmatterTags,
	isValidDependencyRelType,
	normalizeDependencyEntry,
	normalizeDependencyList,
	normalizeFrontmatterTag,
	normalizePriorityConfigValue,
	normalizeStatusConfigValue,
	normalizeTitleValue,
	parseLinkToPath,
	serializeDependencies,
	VALID_DEPENDENCY_RELTYPES,
};

// The shared model mapping does not know about `recurrenceOriginalDate`, and settings saved
// before the field existed do not contain it. These wrappers resolve the property name
// (falling back to the default) and handle the field around the model functions.

type ResolvedFieldMapping = FieldMapping & { recurrenceOriginalDate: string };

function withResolvedMapping(mapping: FieldMapping): ResolvedFieldMapping {
	if (typeof mapping.recurrenceOriginalDate === "string") {
		return mapping as ResolvedFieldMapping;
	}
	return { ...mapping, recurrenceOriginalDate: DEFAULT_RECURRENCE_ORIGINAL_DATE_PROPERTY };
}

/**
 * Normalize a stored recurrence_original_date value. Only strict, real YYYY-MM-DD dates are
 * accepted; anything else is dropped so a malformed value can never become an occurrence identity.
 */
export function normalizeRecurrenceOriginalDate(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
	try {
		return validateDateString(trimmed);
	} catch {
		return undefined;
	}
}

export function toUserField(mapping: FieldMapping, internalName: FieldMappingKey): string {
	return withResolvedMapping(mapping)[internalName];
}

export function toUserFields(mapping: FieldMapping, internalFields: FieldMappingKey[]): string[] {
	const resolved = withResolvedMapping(mapping);
	return internalFields.map((field) => resolved[field]);
}

export function isPropertyForField(
	mapping: FieldMapping,
	propertyName: string,
	internalField: FieldMappingKey
): boolean {
	return withResolvedMapping(mapping)[internalField] === propertyName;
}

export function lookupMappingKey(
	mapping: FieldMapping,
	frontmatterPropertyName: string
): FieldMappingKey | null {
	return modelLookupMappingKey(withResolvedMapping(mapping), frontmatterPropertyName);
}

export function isRecognizedProperty(
	mapping: FieldMapping,
	frontmatterPropertyName: string
): boolean {
	return modelIsRecognizedProperty(withResolvedMapping(mapping), frontmatterPropertyName);
}

export function validateFieldMapping(mapping: FieldMapping): { valid: boolean; errors: string[] } {
	return modelValidateFieldMapping(withResolvedMapping(mapping));
}

export function mapTaskFromFrontmatter(
	mapping: FieldMapping,
	frontmatter: Record<string, unknown> | undefined | null,
	filePath: string,
	storeTitleInFilename = false,
	userFields: readonly UserMappedField[] = [],
	statuses?: readonly StatusConfig[],
	priorities?: readonly PriorityConfig[]
): Partial<TaskInfo> {
	const resolved = withResolvedMapping(mapping);
	const mapped: Partial<TaskInfo> = modelMapTaskFromFrontmatter(
		resolved,
		frontmatter,
		filePath,
		storeTitleInFilename,
		userFields,
		statuses,
		priorities
	);
	const originalDate = normalizeRecurrenceOriginalDate(
		frontmatter?.[resolved.recurrenceOriginalDate]
	);
	if (originalDate) {
		mapped.recurrence_original_date = originalDate;
	}
	return mapped;
}

export function mapTaskToFrontmatter(
	mapping: FieldMapping,
	taskData: Partial<TaskInfo>,
	taskTag?: string,
	storeTitleInFilename = false,
	userFields: readonly UserMappedField[] = []
): Record<string, unknown> {
	const resolved = withResolvedMapping(mapping);
	const frontmatter = modelMapTaskToFrontmatter(
		resolved,
		taskData,
		taskTag,
		storeTitleInFilename,
		userFields
	);
	const originalDate = normalizeRecurrenceOriginalDate(taskData.recurrence_original_date);
	if (originalDate) {
		frontmatter[resolved.recurrenceOriginalDate] = originalDate;
	}
	return frontmatter;
}
