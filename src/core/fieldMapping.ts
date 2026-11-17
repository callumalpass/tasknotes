import {
	coerceStatusFrontmatterValue,
	DEFAULT_DEPENDENCY_RELTYPE,
	extractDependencyUid,
	getFrontmatterTags as modelGetFrontmatterTags,
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
import { DEFAULT_ID_PROPERTY, DEFAULT_RECURRENCE_ORIGINAL_DATE_PROPERTY } from "./defaultFieldMapping";
import { normalizeStringArrayValue } from "./nullableListNormalization";

export {
	coerceStatusFrontmatterValue,
	DEFAULT_DEPENDENCY_RELTYPE,
	extractDependencyUid,
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

// Settings saved before `id` and `recurrenceOriginalDate` were mappable do not contain
// them. These wrappers resolve both property names (falling back to the defaults) and
// handle `recurrenceOriginalDate` around the model functions.

type ResolvedFieldMapping = FieldMapping & { id: string; recurrenceOriginalDate: string };

function withResolvedMapping(mapping: FieldMapping): ResolvedFieldMapping {
	const hasId = typeof mapping.id === "string" && mapping.id.trim().length > 0;
	if (hasId && typeof mapping.recurrenceOriginalDate === "string") {
		return mapping as ResolvedFieldMapping;
	}
	return {
		...mapping,
		id: hasId ? (mapping.id as string) : DEFAULT_ID_PROPERTY,
		recurrenceOriginalDate:
			mapping.recurrenceOriginalDate ?? DEFAULT_RECURRENCE_ORIGINAL_DATE_PROPERTY,
	};
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

// Backport model ea97ac46 (consumed by v5 in 02950c14) without taking
// rc.16's unrelated model/recurrence changes. Normalize read copies only;
// absent properties and custom fields must retain their original meaning.
function normalizeNullableLists(
	mapping: FieldMapping,
	frontmatter: Record<string, unknown> | undefined | null
): Record<string, unknown> | undefined | null {
	if (!frontmatter) return frontmatter;

	const normalized = { ...frontmatter };
	for (const property of [
		mapping.contexts,
		mapping.projects,
		mapping.icsEventId,
		mapping.googleCalendarMovedOriginalDates,
	]) {
		if (frontmatter[property] !== undefined) {
			normalized[property] = normalizeStringArrayValue(frontmatter[property]);
		}
	}
	if (frontmatter.tags !== undefined) normalized.tags = getFrontmatterTags(frontmatter.tags);
	return normalized;
}

export function getFrontmatterTags(value: unknown): string[] {
	return modelGetFrontmatterTags(Array.isArray(value) ? normalizeStringArrayValue(value) : value);
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
		normalizeNullableLists(resolved, frontmatter),
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
		{ ...taskData, tags: getFrontmatterTags(taskData.tags) },
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
