import { DEFAULT_FIELD_MAPPING, DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "./defaults";
import { validateCompleteInstances } from "./date";
import type {
	FieldMapping,
	FieldMappingKey,
	PriorityConfig,
	Reminder,
	StatusConfig,
	TaskDependency,
	TaskDependencyRelType,
	TaskInfo,
	UserMappedField,
} from "./types";

export { DEFAULT_FIELD_MAPPING };

export const DEFAULT_DEPENDENCY_RELTYPE: TaskDependencyRelType = "FINISHTOSTART";
export const VALID_DEPENDENCY_RELTYPES: TaskDependencyRelType[] = [
	"FINISHTOSTART",
	"FINISHTOFINISH",
	"STARTTOSTART",
	"STARTTOFINISH",
];

export function toUserField(mapping: FieldMapping, internalName: FieldMappingKey): string {
	return mapping[internalName];
}

export function normalizeTitleValue(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map((entry) => String(entry)).join(", ");
	if (value === null || value === undefined) return undefined;
	if (typeof value === "object") return "";
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return undefined;
}

export function normalizeStatusConfigValue(
	value: unknown,
	statuses: readonly StatusConfig[] = DEFAULT_STATUSES
): string | undefined {
	return normalizeConfiguredValue(normalizeStringValue(value), statuses);
}

export function normalizePriorityConfigValue(
	value: unknown,
	priorities: readonly PriorityConfig[] = DEFAULT_PRIORITIES
): string | undefined {
	return normalizeConfiguredValue(normalizeStringValue(value), priorities);
}

export function getFrontmatterTags(value: unknown): string[] {
	const tags: string[] = [];
	const seen = new Set<string>();
	const addTag = (entry: unknown): void => {
		const normalized = normalizeFrontmatterTag(String(entry));
		if (!normalized || seen.has(normalized)) return;
		seen.add(normalized);
		tags.push(normalized);
	};

	if (Array.isArray(value)) {
		value.forEach(addTag);
		return tags;
	}

	if (typeof value === "string" && value.trim().length > 0) {
		addTag(value);
	}

	return tags;
}

export function normalizeFrontmatterTag(value: string): string {
	const trimmed = value.trim();
	const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed;
	return withoutHash.replace(/\s+/g, "-");
}

export function mapTaskFromFrontmatter(
	mapping: FieldMapping,
	frontmatter: Record<string, unknown> | undefined | null,
	filePath: string,
	storeTitleInFilename = false,
	userFields: readonly UserMappedField[] = [],
	statuses: readonly StatusConfig[] = DEFAULT_STATUSES,
	priorities: readonly PriorityConfig[] = DEFAULT_PRIORITIES
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
			mapped.title = titleFromFilePath(filePath);
		}
	} else if (storeTitleInFilename || filePath) {
		mapped.title = titleFromFilePath(filePath);
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
		} else if (anchorValue !== null && anchorValue !== undefined && !isBlankString(anchorValue)) {
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
		mapped.timeEntries = Array.isArray(frontmatter[mapping.timeEntries])
			? (frontmatter[mapping.timeEntries] as TaskInfo["timeEntries"])
			: [];
	}
	if (frontmatter[mapping.completeInstances] !== undefined) {
		const value = frontmatter[mapping.completeInstances];
		mapped.complete_instances = validateCompleteInstances(Array.isArray(value) ? value : [value]);
	}
	if (frontmatter[mapping.skippedInstances] !== undefined) {
		const value = frontmatter[mapping.skippedInstances];
		mapped.skipped_instances = validateCompleteInstances(Array.isArray(value) ? value : [value]);
	}
	if (mapping.blockedBy && frontmatter[mapping.blockedBy] !== undefined) {
		mapped.blockedBy = normalizeDependencyList(frontmatter[mapping.blockedBy]);
	}
	if (frontmatter[mapping.icsEventId] !== undefined) {
		mapped.icsEventId = normalizeStringArrayValue(frontmatter[mapping.icsEventId]);
	}
	if (frontmatter[mapping.googleCalendarEventId] !== undefined) {
		mapped.googleCalendarEventId = normalizeStringValue(frontmatter[mapping.googleCalendarEventId]);
	}
	if (frontmatter[mapping.googleCalendarExceptionEventId] !== undefined) {
		mapped.googleCalendarExceptionEventId = normalizeStringValue(
			frontmatter[mapping.googleCalendarExceptionEventId]
		);
	}
	if (frontmatter[mapping.googleCalendarExceptionOriginalScheduled] !== undefined) {
		mapped.googleCalendarExceptionOriginalScheduled = normalizeStringValue(
			frontmatter[mapping.googleCalendarExceptionOriginalScheduled]
		);
	}
	if (frontmatter[mapping.googleCalendarMovedOriginalDates] !== undefined) {
		mapped.googleCalendarMovedOriginalDates = normalizeStringArrayValue(
			frontmatter[mapping.googleCalendarMovedOriginalDates]
		);
	}
	if (frontmatter[mapping.reminders] !== undefined) {
		mapped.reminders = normalizeReminders(frontmatter[mapping.reminders]);
	}
	if (frontmatter[mapping.sortOrder] !== undefined) {
		mapped.sortOrder = normalizeStringValue(frontmatter[mapping.sortOrder]);
	}
	if (frontmatter.tags !== undefined) {
		const tags = getFrontmatterTags(frontmatter.tags);
		mapped.tags = tags;
		mapped.archived = tags.includes(normalizeTagForComparison(mapping.archiveTag));
	}

	if (userFields.length > 0) {
		const customProperties: Record<string, unknown> = {};
		const mappedAny = mapped as Record<string, unknown>;
		for (const field of userFields) {
			if (frontmatter[field.key] !== undefined) {
				mappedAny[field.key] = frontmatter[field.key];
				customProperties[field.key] = frontmatter[field.key];
			}
		}
		if (Object.keys(customProperties).length > 0) {
			mapped.customProperties = { ...mapped.customProperties, ...customProperties };
		}
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
	const frontmatter: Record<string, unknown> = {};

	if (taskData.title !== undefined && !storeTitleInFilename) {
		frontmatter[mapping.title] = taskData.title;
	}
	if (taskData.status !== undefined) {
		frontmatter[mapping.status] = coerceStatusFrontmatterValue(taskData.status);
	}
	if (taskData.priority !== undefined) frontmatter[mapping.priority] = taskData.priority;
	if (taskData.due !== undefined) frontmatter[mapping.due] = taskData.due;
	if (taskData.scheduled !== undefined) frontmatter[mapping.scheduled] = taskData.scheduled;
	if (taskData.contexts !== undefined && (!Array.isArray(taskData.contexts) || taskData.contexts.length > 0)) {
		frontmatter[mapping.contexts] = taskData.contexts;
	}
	if (taskData.projects !== undefined && (!Array.isArray(taskData.projects) || taskData.projects.length > 0)) {
		frontmatter[mapping.projects] = taskData.projects;
	}
	if (taskData.timeEstimate !== undefined) frontmatter[mapping.timeEstimate] = taskData.timeEstimate;
	if (taskData.completedDate !== undefined) frontmatter[mapping.completedDate] = taskData.completedDate;
	if (taskData.recurrence !== undefined) frontmatter[mapping.recurrence] = taskData.recurrence;
	if (taskData.recurrence_anchor !== undefined) frontmatter[mapping.recurrenceAnchor] = taskData.recurrence_anchor;
	if (taskData.dateCreated !== undefined) frontmatter[mapping.dateCreated] = taskData.dateCreated;
	if (taskData.dateModified !== undefined) frontmatter[mapping.dateModified] = taskData.dateModified;
	if (taskData.sortOrder !== undefined) frontmatter[mapping.sortOrder] = taskData.sortOrder;
	if (taskData.timeEntries !== undefined) frontmatter[mapping.timeEntries] = taskData.timeEntries;
	if (taskData.complete_instances !== undefined) frontmatter[mapping.completeInstances] = taskData.complete_instances;
	if (taskData.skipped_instances !== undefined && taskData.skipped_instances.length > 0) {
		frontmatter[mapping.skippedInstances] = taskData.skipped_instances;
	}
	if (taskData.blockedBy !== undefined) {
		const dependencies = Array.isArray(taskData.blockedBy)
			? taskData.blockedBy.map(normalizeDependencyEntry).filter((entry): entry is TaskDependency => !!entry)
			: [];
		if (dependencies.length > 0) {
			frontmatter[mapping.blockedBy] = serializeDependencies(dependencies);
		}
	}
	if (taskData.icsEventId !== undefined && taskData.icsEventId.length > 0) {
		frontmatter[mapping.icsEventId] = taskData.icsEventId;
	}
	if (taskData.googleCalendarEventId !== undefined) {
		frontmatter[mapping.googleCalendarEventId] = taskData.googleCalendarEventId;
	}
	if (taskData.googleCalendarExceptionEventId !== undefined) {
		frontmatter[mapping.googleCalendarExceptionEventId] = taskData.googleCalendarExceptionEventId;
	}
	if (taskData.googleCalendarExceptionOriginalScheduled !== undefined) {
		frontmatter[mapping.googleCalendarExceptionOriginalScheduled] =
			taskData.googleCalendarExceptionOriginalScheduled;
	}
	if (taskData.googleCalendarMovedOriginalDates !== undefined && taskData.googleCalendarMovedOriginalDates.length > 0) {
		frontmatter[mapping.googleCalendarMovedOriginalDates] = taskData.googleCalendarMovedOriginalDates;
	}
	if (taskData.reminders !== undefined && taskData.reminders.length > 0) {
		frontmatter[mapping.reminders] = taskData.reminders;
	}

	let tags = getFrontmatterTags(taskData.tags);
	const taskTagValue = taskTag ? normalizeTagForComparison(taskTag) : "";
	const archiveTag = normalizeTagForComparison(mapping.archiveTag);
	if (taskTagValue && !tags.includes(taskTagValue)) tags.push(taskTagValue);
	if (taskData.archived === true && !tags.includes(archiveTag)) {
		tags.push(archiveTag);
	} else if (taskData.archived === false) {
		tags = tags.filter((tag) => tag !== archiveTag);
	}
	if (tags.length > 0) {
		frontmatter.tags = tags;
	}

	const customProperties = taskData.customProperties;
	const taskAny = taskData as Record<string, unknown>;
	for (const field of userFields) {
		if (Object.prototype.hasOwnProperty.call(taskAny, field.key) && taskAny[field.key] !== undefined) {
			frontmatter[field.key] = taskAny[field.key];
		} else if (
			customProperties &&
			Object.prototype.hasOwnProperty.call(customProperties, field.key) &&
			customProperties[field.key] !== undefined
		) {
			frontmatter[field.key] = customProperties[field.key];
		}
	}

	return frontmatter;
}

export function coerceStatusFrontmatterValue(status: string): string | boolean {
	const lower = status.toLowerCase();
	return lower === "true" || lower === "false" ? lower === "true" : status;
}

export function lookupMappingKey(
	mapping: FieldMapping,
	frontmatterPropertyName: string
): FieldMappingKey | null {
	for (const [mappingKey, propertyName] of Object.entries(mapping)) {
		if (propertyName === frontmatterPropertyName) {
			return mappingKey as FieldMappingKey;
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
	internalField: FieldMappingKey
): boolean {
	return mapping[internalField] === propertyName;
}

export function toUserFields(mapping: FieldMapping, internalFields: FieldMappingKey[]): string[] {
	return internalFields.map((field) => mapping[field]);
}

export function validateFieldMapping(mapping: FieldMapping): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	const fields = Object.keys(mapping) as FieldMappingKey[];
	for (const field of fields) {
		if (!mapping[field] || mapping[field].trim() === "") {
			errors.push(`Field "${field}" cannot be empty`);
		}
	}
	const values = Object.values(mapping);
	if (values.length !== new Set(values).size) {
		errors.push("Field mappings must have unique property names");
	}
	return { valid: errors.length === 0, errors };
}

export function isValidDependencyRelType(value: string): value is TaskDependencyRelType {
	return VALID_DEPENDENCY_RELTYPES.includes(value as TaskDependencyRelType);
}

export function extractDependencyUid(entry: unknown): string {
	if (typeof entry === "string") return entry;
	if (entry && typeof entry === "object") {
		const uid = (entry as Record<string, unknown>).uid;
		return typeof uid === "string" ? uid : "";
	}
	return "";
}

export function normalizeDependencyEntry(value: unknown): TaskDependency | null {
	if (typeof value === "string") {
		const uid = parseLinkToPath(value.trim());
		return uid ? { uid, reltype: DEFAULT_DEPENDENCY_RELTYPE } : null;
	}

	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	const rawUid = typeof raw.uid === "string" ? raw.uid.trim() : "";
	if (!rawUid) return null;
	const reltypeRaw = typeof raw.reltype === "string" ? raw.reltype.trim().toUpperCase() : "";
	const reltype = isValidDependencyRelType(reltypeRaw) ? reltypeRaw : DEFAULT_DEPENDENCY_RELTYPE;
	const gap = typeof raw.gap === "string" && raw.gap.trim().length > 0 ? raw.gap.trim() : undefined;
	return gap ? { uid: parseLinkToPath(rawUid), reltype, gap } : { uid: parseLinkToPath(rawUid), reltype };
}

export function normalizeDependencyList(value: unknown): TaskDependency[] | undefined {
	if (value === null || value === undefined) return undefined;
	const normalized = (Array.isArray(value) ? value : [value])
		.map(normalizeDependencyEntry)
		.filter((entry): entry is TaskDependency => !!entry);
	return normalized.length > 0 ? normalized : undefined;
}

export function serializeDependencies(dependencies: readonly TaskDependency[]): unknown[] {
	return dependencies.map((dependency) => {
		const uid = dependency.uid.startsWith("[[") ? dependency.uid : `[[${dependency.uid}]]`;
		const serialized: Record<string, string> = { uid, reltype: dependency.reltype };
		if (dependency.gap && dependency.gap.trim().length > 0) {
			serialized.gap = dependency.gap;
		}
		return serialized;
	});
}

export function parseLinkToPath(value: string): string {
	const trimmed = value.trim();
	const wikiMatch = trimmed.match(/^\[\[([^|\]#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]$/);
	if (wikiMatch) {
		return wikiMatch[1].trim();
	}
	const markdownMatch = trimmed.match(/^\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)$/);
	if (markdownMatch) {
		return decodeURI(markdownMatch[1].trim());
	}
	return trimmed;
}

function normalizeConfiguredValue(
	rawValue: string | undefined,
	configs: readonly { value: string; label: string }[] = []
): string | undefined {
	if (rawValue === undefined || configs.length === 0) return rawValue;
	const exactValue = configs.find((config) => config.value === rawValue);
	if (exactValue) return exactValue.value;
	const exactLabel = findUniqueConfiguredValue(configs, (config) => config.label === rawValue);
	if (exactLabel) return exactLabel.value;
	const normalized = rawValue.trim().toLocaleLowerCase();
	if (normalized.length === 0) return rawValue;
	const caseValue = findUniqueConfiguredValue(
		configs,
		(config) => config.value.trim().toLocaleLowerCase() === normalized
	);
	if (caseValue) return caseValue.value;
	const caseLabel = findUniqueConfiguredValue(
		configs,
		(config) => config.label.trim().toLocaleLowerCase() === normalized
	);
	return caseLabel ? caseLabel.value : rawValue;
}

function findUniqueConfiguredValue<T extends { value: string; label: string }>(
	configs: readonly T[],
	matches: (config: T) => boolean
): T | undefined {
	const matched = configs.filter(matches);
	return matched.length === 1 ? matched[0] : undefined;
}

function normalizeStringValue(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	if (typeof value === "string") return isBlankString(value) ? undefined : value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return value.length === 1 ? normalizeStringValue(value[0]) : undefined;
	return undefined;
}

function normalizeStringArrayValue(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : [String(value)];
}

function normalizeNumberValue(value: unknown): number | undefined {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
}

function normalizeReminders(value: unknown): Reminder[] | undefined {
	if (Array.isArray(value)) {
		const filtered = value.filter((reminder) => reminder != null) as Reminder[];
		return filtered.length > 0 ? filtered : undefined;
	}
	return value != null ? [value as Reminder] : undefined;
}

function normalizeTagForComparison(tag: string): string {
	return getFrontmatterTags(tag)[0] ?? "";
}

function titleFromFilePath(filePath: string): string | undefined {
	return filePath.split("/").pop()?.replace(/\.md$/i, "").trim() || undefined;
}

function isBlankString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length === 0;
}
