import { DEFAULT_FIELD_MAPPING, DEFAULT_MODEL_CONFIG } from "./defaults";
import type {
	FieldRole,
	PriorityConfig,
	SpecFieldMapping,
	StatusConfig,
	TaskIdentificationConfig,
	TaskNotesModelConfig,
} from "./types";

export const ALL_FIELD_ROLES: FieldRole[] = [
	"title",
	"status",
	"priority",
	"due",
	"scheduled",
	"completedDate",
	"tags",
	"contexts",
	"projects",
	"timeEstimate",
	"dateCreated",
	"dateModified",
	"recurrence",
	"recurrenceAnchor",
	"completeInstances",
	"skippedInstances",
	"timeEntries",
	"blockedBy",
	"reminders",
];

export function resolveModelConfig(input: Partial<TaskNotesModelConfig> = {}): TaskNotesModelConfig {
	return {
		...DEFAULT_MODEL_CONFIG,
		...input,
		fieldMapping: { ...DEFAULT_FIELD_MAPPING, ...input.fieldMapping },
		statuses: input.statuses ? input.statuses.map((status) => ({ ...status })) : DEFAULT_MODEL_CONFIG.statuses.map((status) => ({ ...status })),
		priorities: input.priorities ? input.priorities.map((priority) => ({ ...priority })) : DEFAULT_MODEL_CONFIG.priorities.map((priority) => ({ ...priority })),
		defaults: { ...DEFAULT_MODEL_CONFIG.defaults, ...input.defaults },
		taskIdentification: {
			...DEFAULT_MODEL_CONFIG.taskIdentification,
			...input.taskIdentification,
		},
		userFields: input.userFields ? input.userFields.map((field) => ({ ...field })) : [],
		recurrence: { ...DEFAULT_MODEL_CONFIG.recurrence, ...input.recurrence },
		timeTracking: { ...DEFAULT_MODEL_CONFIG.timeTracking, ...input.timeTracking },
	};
}

export function isCompletedStatus(
	status: string | undefined,
	statuses: readonly StatusConfig[] = DEFAULT_MODEL_CONFIG.statuses
): boolean {
	if (!status) return false;
	return statuses.some((entry) => entry.value === status && entry.isCompleted);
}

export function getDefaultCompletedStatus(
	statuses: readonly StatusConfig[] = DEFAULT_MODEL_CONFIG.statuses
): string {
	return statuses.find((entry) => entry.isCompleted)?.value || "done";
}

export function getStatusConfig(
	status: string | undefined,
	statuses: readonly StatusConfig[] = DEFAULT_MODEL_CONFIG.statuses
): StatusConfig | undefined {
	return statuses.find((entry) => entry.value === status);
}

export function getPriorityConfig(
	priority: string | undefined,
	priorities: readonly PriorityConfig[] = DEFAULT_MODEL_CONFIG.priorities
): PriorityConfig | undefined {
	return priorities.find((entry) => entry.value === priority);
}

export function defaultSpecFieldMapping(): SpecFieldMapping {
	const roleToField = {} as Record<FieldRole, string>;
	const fieldToRole = {} as Record<string, FieldRole>;
	for (const role of ALL_FIELD_ROLES) {
		roleToField[role] = role;
		fieldToRole[role] = role;
	}
	return {
		roleToField,
		fieldToRole,
		displayNameKey: "title",
		completedStatuses: ["done", "cancelled"],
	};
}

export function buildSpecFieldMapping(
	fields: Record<string, unknown> = {},
	displayNameKey?: string
): SpecFieldMapping {
	const roleToField = {} as Record<FieldRole, string>;
	const fieldToRole = {} as Record<string, FieldRole>;
	const roles = new Set<string>(ALL_FIELD_ROLES);

	for (const [fieldName, definition] of Object.entries(fields)) {
		if (!isRecord(definition) || typeof definition.tn_role !== "string") {
			continue;
		}
		const role = definition.tn_role as FieldRole;
		if (!roles.has(role) || roleToField[role] !== undefined) {
			continue;
		}
		roleToField[role] = fieldName;
		fieldToRole[fieldName] = role;
	}

	for (const role of ALL_FIELD_ROLES) {
		if (roleToField[role] === undefined) {
			roleToField[role] = fields[role] !== undefined ? role : role;
			if (fields[role] !== undefined && fieldToRole[role] === undefined) {
				fieldToRole[role] = role;
			}
		}
	}

	const completedStatuses = inferCompletedStatuses(fields, roleToField.status);
	return {
		roleToField,
		fieldToRole,
		displayNameKey: displayNameKey && displayNameKey.trim().length > 0 ? displayNameKey : roleToField.title,
		completedStatuses,
	};
}

export function normalizeSpecFrontmatter(
	raw: Record<string, unknown>,
	mapping: SpecFieldMapping
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(raw)) {
		const role = mapping.fieldToRole[key];
		result[role ?? key] = value;
	}
	return result;
}

export function denormalizeSpecFrontmatter(
	roleData: Record<string, unknown>,
	mapping: SpecFieldMapping
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const roles = new Set<string>(ALL_FIELD_ROLES);
	for (const [key, value] of Object.entries(roleData)) {
		result[roles.has(key) ? mapping.roleToField[key as FieldRole] : key] = value;
	}
	return result;
}

export function isSpecCompletedStatus(mapping: SpecFieldMapping, status: string | undefined): boolean {
	return !!status && mapping.completedStatuses.includes(status);
}

export function getDefaultSpecCompletedStatus(mapping: SpecFieldMapping): string {
	return mapping.completedStatuses[0] || "done";
}

export function resolveDisplayTitle(
	frontmatter: Record<string, unknown>,
	mapping: SpecFieldMapping,
	taskPath?: string
): string | undefined {
	const candidates = [mapping.displayNameKey, "title"];
	const seen = new Set<string>();
	for (const key of candidates) {
		if (seen.has(key)) continue;
		seen.add(key);
		const value = frontmatter[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}

	if (typeof taskPath === "string" && taskPath.trim().length > 0) {
		const basename = taskPath.split(/[\\/]/).pop()?.replace(/\.md$/i, "").trim();
		if (basename) {
			return basename;
		}
	}

	return undefined;
}

export function normalizeExcludedFolders(value: unknown): string[] {
	const normalizePath = (entry: unknown): string =>
		String(entry || "")
			.replace(/\\/g, "/")
			.replace(/^\/+/, "")
			.replace(/\/+$/, "")
			.trim();
	if (Array.isArray(value)) {
		return value.map(normalizePath).filter(Boolean);
	}
	if (typeof value === "string") {
		return value.split(",").map(normalizePath).filter(Boolean);
	}
	return [];
}

export function detectTaskFile(input: {
	taskDetection?: Partial<TaskIdentificationConfig> & { methods?: string[]; combine?: "and" | "or" };
	frontmatter?: Record<string, unknown>;
	body?: string;
	filePath?: string;
}): boolean {
	const detection = input.taskDetection ?? {};
	const frontmatter = input.frontmatter ?? {};
	const body = input.body ?? "";
	const filePath = input.filePath ?? "";

	if (filePath && pathExcluded(filePath, normalizeExcludedFolders(detection.excludedFolders))) {
		return false;
	}

	const methods = Array.isArray(detection.methods)
		? detection.methods
		: detection.method
			? [detection.method]
			: detection.tag
				? ["tag"]
				: [];
	const effectiveMethods = methods.length > 0 ? methods : ["tag"];
	const evaluations = effectiveMethods.map((method) => {
		if (method === "tag") {
			const tag = normalizeTagForComparison(detection.tag || "task");
			return frontmatterHasTag(frontmatter, tag) || bodyHasTag(body, tag);
		}
		if (method === "property") {
			const propertyName = detection.propertyName || "";
			const propertyValue = detection.propertyValue || "";
			if (!propertyName || !Object.prototype.hasOwnProperty.call(frontmatter, propertyName)) {
				return false;
			}
			return propertyValue.length === 0 || String(frontmatter[propertyName]) === propertyValue;
		}
		return false;
	});

	return detection.combine === "and" ? evaluations.every(Boolean) : evaluations.some(Boolean);
}

export function mapTasknotesPluginConfig(source: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (isRecord(source.fieldMapping)) {
		const mapping: Record<string, unknown> = {};
		for (const [role, fieldName] of Object.entries(source.fieldMapping)) {
			if (typeof fieldName === "string" && fieldName.trim().length > 0) {
				mapping[mapPluginRoleToSpecRole(role)] = fieldName;
			}
		}
		out.mapping = mapping;
	}

	if (typeof source.defaultTaskStatus === "string" || typeof source.defaultTaskPriority === "string") {
		out.defaults = {
			...(typeof source.defaultTaskStatus === "string" ? { status: source.defaultTaskStatus } : {}),
			...(typeof source.defaultTaskPriority === "string" ? { priority: source.defaultTaskPriority } : {}),
		};
	}

	if (Array.isArray(source.customStatuses)) {
		const values = source.customStatuses
			.filter(isRecord)
			.map((entry) => entry.value)
			.filter((value): value is string => typeof value === "string");
		const completedValues = source.customStatuses
			.filter((entry) => isRecord(entry) && entry.isCompleted === true && typeof entry.value === "string")
			.map((entry) => String((entry as Record<string, unknown>).value));
		out.status = { values, completed_values: completedValues };
	}

	if (typeof source.taskIdentificationMethod === "string") {
		out.task_detection = {
			method: source.taskIdentificationMethod,
			...(typeof source.taskTag === "string" ? { tag: source.taskTag } : {}),
			...(typeof source.taskPropertyName === "string" ? { property_name: source.taskPropertyName } : {}),
			...(typeof source.taskPropertyValue === "string" ? { property_value: source.taskPropertyValue } : {}),
		};
	}

	if (typeof source.tasksFolder === "string") {
		out.collection = { default_folder: source.tasksFolder };
	}

	if (typeof source.autoStopTimeTrackingOnComplete === "boolean") {
		out.time_tracking = { auto_stop_on_complete: source.autoStopTimeTrackingOnComplete };
	}

	return out;
}

function inferCompletedStatuses(fields: Record<string, unknown>, statusFieldName: string): string[] {
	const statusDef = fields[statusFieldName];
	if (!isRecord(statusDef)) {
		return ["done", "cancelled"];
	}

	if (Array.isArray(statusDef.tn_completed_values)) {
		const explicit = statusDef.tn_completed_values
			.filter((value): value is string => typeof value === "string")
			.map((value) => value.trim())
			.filter(Boolean);
		if (explicit.length > 0) return explicit;
	}

	if (Array.isArray(statusDef.values)) {
		const inferred = statusDef.values
			.filter((value): value is string => typeof value === "string")
			.filter((value) => {
				const lower = value.toLowerCase();
				return (
					lower.includes("done") ||
					lower.includes("complete") ||
					lower.includes("cancel") ||
					lower.includes("finish")
				);
			});
		if (inferred.length > 0) return inferred;
	}

	return ["done", "cancelled"];
}

function normalizeTagForComparison(value: string): string {
	const trimmed = value.trim();
	const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed;
	return withoutHash.replace(/\s+/g, "-").toLowerCase();
}

function frontmatterHasTag(frontmatter: Record<string, unknown>, normalizedTag: string): boolean {
	const tags = frontmatter.tags;
	const entries = Array.isArray(tags) ? tags : typeof tags === "string" ? [tags] : [];
	return entries.some((entry) => normalizeTagForComparison(String(entry)) === normalizedTag);
}

function bodyHasTag(body: string, normalizedTag: string): boolean {
	const stripped = body.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
	const regex = /(^|[^\w])#([A-Za-z0-9][A-Za-z0-9/_-]*)/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(stripped)) !== null) {
		if (match[2].toLowerCase() === normalizedTag) {
			return true;
		}
	}
	return false;
}

function pathExcluded(filePath: string, excludedFolders: string[]): boolean {
	const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
	return excludedFolders.some(
		(folder) => normalizedPath === folder || normalizedPath.startsWith(`${folder}/`)
	);
}

function mapPluginRoleToSpecRole(roleKey: string): string {
	const explicit: Record<string, string> = {
		completedDate: "completed_date",
		dateCreated: "date_created",
		dateModified: "date_modified",
		recurrenceAnchor: "recurrence_anchor",
		completeInstances: "complete_instances",
		skippedInstances: "skipped_instances",
		timeEntries: "time_entries",
		timeEstimate: "time_estimate",
		blockedBy: "blocked_by",
	};
	return explicit[roleKey] ?? roleKey.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
