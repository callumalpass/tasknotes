 
import { FieldMapping, PriorityConfig, Reminder, StatusConfig, TaskInfo, TimeEntry } from "../types";
import type { UserMappedField } from "../types/settings";
import {
	normalizeDependencyEntry,
	normalizeDependencyList,
	serializeDependencies,
} from "../utils/dependencyUtils";
import { validateCompleteInstances } from "../utils/dateUtils";
import { stringifyUnknown } from "../utils/stringUtils";

export function toUserField(mapping: FieldMapping, internalName: keyof FieldMapping): string {
	return mapping[internalName];
}

export function normalizeTitleValue(val: unknown): string | undefined {
	if (typeof val === "string") return val;
	if (Array.isArray(val)) return val.map((v) => String(v)).join(", ");
	if (val === null || val === undefined) return undefined;
	if (typeof val === "object") return "";
	if (typeof val === "number" || typeof val === "boolean") return String(val);
	return undefined;
}

function titleFromFilePath(filePath: string): string | undefined {
	const filename = filePath.split("/").pop()?.replace(/\.md$/i, "").trim();
	return filename || undefined;
}

function normalizeStringValue(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}

type ConfiguredValue = {
	value: string;
	label: string;
};

function findUniqueConfiguredValue<T extends ConfiguredValue>(
	configs: readonly T[],
	matches: (config: T) => boolean
): T | undefined {
	const matched = configs.filter(matches);
	return matched.length === 1 ? matched[0] : undefined;
}

function normalizeConfiguredValue(
	rawValue: string | undefined,
	configs: readonly ConfiguredValue[] = []
): string | undefined {
	if (rawValue === undefined || configs.length === 0) {
		return rawValue;
	}

	const exactValue = configs.find((config) => config.value === rawValue);
	if (exactValue) {
		return exactValue.value;
	}

	const exactLabel = findUniqueConfiguredValue(configs, (config) => config.label === rawValue);
	if (exactLabel) {
		return exactLabel.value;
	}

	const normalized = rawValue.trim().toLocaleLowerCase();
	if (normalized.length === 0) {
		return rawValue;
	}

	const caseInsensitiveValue = findUniqueConfiguredValue(
		configs,
		(config) => config.value.trim().toLocaleLowerCase() === normalized
	);
	if (caseInsensitiveValue) {
		return caseInsensitiveValue.value;
	}

	const caseInsensitiveLabel = findUniqueConfiguredValue(
		configs,
		(config) => config.label.trim().toLocaleLowerCase() === normalized
	);
	if (caseInsensitiveLabel) {
		return caseInsensitiveLabel.value;
	}

	return rawValue;
}

export function normalizeStatusConfigValue(
	value: unknown,
	statuses: readonly StatusConfig[] = []
): string | undefined {
	return normalizeConfiguredValue(normalizeStringValue(value), statuses);
}

export function normalizePriorityConfigValue(
	value: unknown,
	priorities: readonly PriorityConfig[] = []
): string | undefined {
	return normalizeConfiguredValue(normalizeStringValue(value), priorities);
}

function normalizeStringArrayValue(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	return [String(value)];
}

function normalizeNumberValue(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function normalizeTimeEntries(value: unknown): TimeEntry[] {
	return Array.isArray(value) ? (value as TimeEntry[]) : [];
}

function normalizeReminders(value: unknown): Reminder[] | undefined {
	if (Array.isArray(value)) {
		const filtered = value.filter((reminder) => reminder != null) as Reminder[];
		return filtered.length > 0 ? filtered : undefined;
	}
	return value != null ? [value as Reminder] : undefined;
}

export function mapTaskFromFrontmatter(
	mapping: FieldMapping,
	frontmatter: Record<string, unknown> | undefined | null,
	filePath: string,
	storeTitleInFilename?: boolean,
	userFields: UserMappedField[] = [],
	statuses: readonly StatusConfig[] = [],
	priorities: readonly PriorityConfig[] = []
): Partial<TaskInfo> {
	if (!frontmatter) return {};

	const mapped: Partial<TaskInfo> = {
		path: filePath,
	};

	if (frontmatter[mapping.title] !== undefined) {
		const normalized = normalizeTitleValue(frontmatter[mapping.title]);
		if (normalized !== undefined && normalized.trim().length > 0) {
			mapped.title = normalized;
		} else {
			const fallbackTitle = titleFromFilePath(filePath);
			if (fallbackTitle) {
				mapped.title = fallbackTitle;
			}
		}
	} else {
		const fallbackTitle = titleFromFilePath(filePath);
		if (fallbackTitle) {
			mapped.title = fallbackTitle;
		}
	}

	if (frontmatter[mapping.status] !== undefined) {
		mapped.status = normalizeStatusConfigValue(frontmatter[mapping.status], statuses);
	}

	if (frontmatter[mapping.priority] !== undefined) {
		mapped.priority = normalizePriorityConfigValue(frontmatter[mapping.priority], priorities);
	}

	if (frontmatter[mapping.due] !== undefined) {
		mapped.due = normalizeStringValue(frontmatter[mapping.due]);
	}

	if (frontmatter[mapping.scheduled] !== undefined) {
		mapped.scheduled = normalizeStringValue(frontmatter[mapping.scheduled]);
	}

	if (frontmatter[mapping.contexts] !== undefined) {
		mapped.contexts = normalizeStringArrayValue(frontmatter[mapping.contexts]);
	}

	if (frontmatter[mapping.projects] !== undefined) {
		mapped.projects = normalizeStringArrayValue(frontmatter[mapping.projects]);
	}

	if (frontmatter[mapping.timeEstimate] !== undefined) {
		mapped.timeEstimate = normalizeNumberValue(frontmatter[mapping.timeEstimate]);
	}

	if (frontmatter[mapping.completedDate] !== undefined) {
		mapped.completedDate = normalizeStringValue(frontmatter[mapping.completedDate]);
	}

	if (frontmatter[mapping.recurrence] !== undefined) {
		mapped.recurrence = normalizeStringValue(frontmatter[mapping.recurrence]);
	}

	if (frontmatter[mapping.recurrenceAnchor] !== undefined) {
		const anchorValue = frontmatter[mapping.recurrenceAnchor];
		if (anchorValue === "scheduled" || anchorValue === "completion") {
			mapped.recurrence_anchor = anchorValue;
		} else {
			console.warn(
				`Invalid recurrence_anchor value: ${stringifyUnknown(anchorValue)}, defaulting to 'scheduled'`
			);
			mapped.recurrence_anchor = "scheduled";
		}
	}

	if (frontmatter[mapping.dateCreated] !== undefined) {
		mapped.dateCreated = normalizeStringValue(frontmatter[mapping.dateCreated]);
	}

	if (frontmatter[mapping.dateModified] !== undefined) {
		mapped.dateModified = normalizeStringValue(frontmatter[mapping.dateModified]);
	}

	if (frontmatter[mapping.timeEntries] !== undefined) {
		mapped.timeEntries = normalizeTimeEntries(frontmatter[mapping.timeEntries]);
	}

	if (frontmatter[mapping.completeInstances] !== undefined) {
		const completeInstances = frontmatter[mapping.completeInstances];
		mapped.complete_instances = validateCompleteInstances(
			Array.isArray(completeInstances) ? completeInstances : [completeInstances]
		);
	}

	if (frontmatter[mapping.skippedInstances] !== undefined) {
		const skippedInstances = frontmatter[mapping.skippedInstances];
		mapped.skipped_instances = validateCompleteInstances(
			Array.isArray(skippedInstances) ? skippedInstances : [skippedInstances]
		);
	}

	if (mapping.blockedBy && frontmatter[mapping.blockedBy] !== undefined) {
		const dependencies = normalizeDependencyList(frontmatter[mapping.blockedBy]);
		if (dependencies) {
			mapped.blockedBy = dependencies;
		}
	}

	if (frontmatter[mapping.icsEventId] !== undefined) {
		mapped.icsEventId = normalizeStringArrayValue(frontmatter[mapping.icsEventId]);
	}

	if (frontmatter[mapping.googleCalendarEventId] !== undefined) {
		mapped.googleCalendarEventId = normalizeStringValue(frontmatter[mapping.googleCalendarEventId]);
	}

	if (frontmatter[mapping.reminders] !== undefined) {
		mapped.reminders = normalizeReminders(frontmatter[mapping.reminders]);
	}

	if (frontmatter[mapping.sortOrder] !== undefined) {
		const val = frontmatter[mapping.sortOrder];
		mapped.sortOrder = typeof val === "string" ? val : String(val);
	}

	if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
		mapped.tags = frontmatter.tags.map(String);
		mapped.archived = frontmatter.tags.includes(mapping.archiveTag);
	}

	if (userFields.length > 0) {
		const mappedAny = mapped as Record<string, unknown>;
		const customProperties: Record<string, unknown> = {};
		for (const field of userFields) {
			if (frontmatter[field.key] !== undefined) {
				const value = frontmatter[field.key];
				mappedAny[field.key] = value;
				customProperties[field.key] = value;
			}
		}
		if (Object.keys(customProperties).length > 0) {
			mapped.customProperties = {
				...mapped.customProperties,
				...customProperties,
			};
		}
	}

	return mapped;
}

export function mapTaskToFrontmatter(
	mapping: FieldMapping,
	taskData: Partial<TaskInfo>,
	taskTag?: string,
	storeTitleInFilename?: boolean,
	userFields: UserMappedField[] = []
): Record<string, unknown> {
	const frontmatter: Record<string, unknown> = {};

	if (taskData.title !== undefined && !storeTitleInFilename) {
		frontmatter[mapping.title] = taskData.title;
	}

	if (taskData.status !== undefined) {
		const lower = taskData.status.toLowerCase();
		const coercedValue =
			lower === "true" || lower === "false" ? lower === "true" : taskData.status;
		frontmatter[mapping.status] = coercedValue;
	}

	if (taskData.priority !== undefined) {
		frontmatter[mapping.priority] = taskData.priority;
	}

	if (taskData.due !== undefined) {
		frontmatter[mapping.due] = taskData.due;
	}

	if (taskData.scheduled !== undefined) {
		frontmatter[mapping.scheduled] = taskData.scheduled;
	}

	if (
		taskData.contexts !== undefined &&
		(!Array.isArray(taskData.contexts) || taskData.contexts.length > 0)
	) {
		frontmatter[mapping.contexts] = taskData.contexts;
	}

	if (
		taskData.projects !== undefined &&
		(!Array.isArray(taskData.projects) || taskData.projects.length > 0)
	) {
		frontmatter[mapping.projects] = taskData.projects;
	}

	if (taskData.timeEstimate !== undefined) {
		frontmatter[mapping.timeEstimate] = taskData.timeEstimate;
	}

	if (taskData.completedDate !== undefined) {
		frontmatter[mapping.completedDate] = taskData.completedDate;
	}

	if (taskData.recurrence !== undefined) {
		frontmatter[mapping.recurrence] = taskData.recurrence;
	}

	if (taskData.recurrence_anchor !== undefined) {
		frontmatter[mapping.recurrenceAnchor] = taskData.recurrence_anchor;
	}

	if (taskData.dateCreated !== undefined) {
		frontmatter[mapping.dateCreated] = taskData.dateCreated;
	}

	if (taskData.dateModified !== undefined) {
		frontmatter[mapping.dateModified] = taskData.dateModified;
	}

	if (taskData.sortOrder !== undefined) {
		frontmatter[mapping.sortOrder] = taskData.sortOrder;
	}

	if (taskData.timeEntries !== undefined) {
		frontmatter[mapping.timeEntries] = taskData.timeEntries;
	}

	if (taskData.complete_instances !== undefined) {
		frontmatter[mapping.completeInstances] = taskData.complete_instances;
	}

	if (taskData.skipped_instances !== undefined && taskData.skipped_instances.length > 0) {
		frontmatter[mapping.skippedInstances] = taskData.skipped_instances;
	}

	if (taskData.blockedBy !== undefined) {
		if (Array.isArray(taskData.blockedBy)) {
			const normalized = taskData.blockedBy
				.map((item) => normalizeDependencyEntry(item))
				.filter((item): item is NonNullable<ReturnType<typeof normalizeDependencyEntry>> => !!item);
			if (normalized.length > 0) {
				frontmatter[mapping.blockedBy] = serializeDependencies(normalized);
			}
		} else {
			frontmatter[mapping.blockedBy] = taskData.blockedBy;
		}
	}

	if (taskData.icsEventId !== undefined && taskData.icsEventId.length > 0) {
		frontmatter[mapping.icsEventId] = taskData.icsEventId;
	}

	if (taskData.reminders !== undefined && taskData.reminders.length > 0) {
		frontmatter[mapping.reminders] = taskData.reminders;
	}

	let tags = taskData.tags ? [...taskData.tags] : [];

	if (taskTag && !tags.includes(taskTag)) {
		tags.push(taskTag);
	}

	if (taskData.archived === true && !tags.includes(mapping.archiveTag)) {
		tags.push(mapping.archiveTag);
	} else if (taskData.archived === false) {
		tags = tags.filter((tag) => tag !== mapping.archiveTag);
	}

	if (tags.length > 0) {
		frontmatter.tags = tags;
	}

	if (userFields.length > 0) {
		const taskAny = taskData as Record<string, unknown>;
		const customProperties = taskData.customProperties;
		for (const field of userFields) {
			const hasTopLevelUserField =
				Object.prototype.hasOwnProperty.call(taskAny, field.key) &&
				taskAny[field.key] !== undefined;
			const hasCustomProperty =
				customProperties &&
				Object.prototype.hasOwnProperty.call(customProperties, field.key) &&
				customProperties[field.key] !== undefined;

			if (hasTopLevelUserField) {
				frontmatter[field.key] = taskAny[field.key];
			} else if (hasCustomProperty) {
				frontmatter[field.key] = customProperties[field.key];
			}
		}
	}

	return frontmatter;
}

export function lookupMappingKey(
	mapping: FieldMapping,
	frontmatterPropertyName: string
): keyof FieldMapping | null {
	for (const [mappingKey, propertyName] of Object.entries(mapping)) {
		if (propertyName === frontmatterPropertyName) {
			return mappingKey as keyof FieldMapping;
		}
	}
	return null;
}

export function isRecognizedProperty(mapping: FieldMapping, frontmatterPropertyName: string): boolean {
	return lookupMappingKey(mapping, frontmatterPropertyName) !== null;
}

export function isPropertyForField(
	mapping: FieldMapping,
	propertyName: string,
	internalField: keyof FieldMapping
): boolean {
	return mapping[internalField] === propertyName;
}

export function toUserFields(
	mapping: FieldMapping,
	internalFields: (keyof FieldMapping)[]
): string[] {
	return internalFields.map((field) => mapping[field]);
}

export function validateFieldMapping(mapping: FieldMapping): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	const fields = Object.keys(mapping) as (keyof FieldMapping)[];
	for (const field of fields) {
		if (!mapping[field] || mapping[field].trim() === "") {
			errors.push(`Field "${field}" cannot be empty`);
		}
	}

	const values = Object.values(mapping);
	const uniqueValues = new Set(values);
	if (values.length !== uniqueValues.size) {
		errors.push("Field mappings must have unique property names");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}
