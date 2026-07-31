import type { TaskCreationData } from "../../types";
import type {
	JiraBuiltInFieldId,
	JiraEnumRemap,
	JiraFieldMappingSettings,
	JiraValueSource,
	JiraValueSourceMode,
	UserMappedField,
} from "../../types/settings";
import type { JiraIssue } from "./JiraIssueAdapter";

const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const SOURCE_MODES = new Set<JiraValueSourceMode>(["path", "template", "fixed", "off"]);
const LIST_FIELDS = new Set<JiraBuiltInFieldId>(["tags", "projects", "contexts"]);
const BUILT_IN_FIELDS: JiraBuiltInFieldId[] = [
	"id",
	"title",
	"details",
	"status",
	"priority",
	"due",
	"scheduled",
	"timeEstimate",
	"dateCreated",
	"dateModified",
	"completedDate",
	"recurrence",
	"tags",
	"projects",
	"contexts",
];

export interface JiraMappingTargetDefinition {
	id: JiraBuiltInFieldId;
	kind: "text" | "number" | "date" | "list";
}

export interface JiraMappingPreviewEntry {
	id: string;
	label: string;
	status: "value" | "empty" | "missing" | "invalid";
	value?: unknown;
}

export const JIRA_MAPPING_TARGETS: readonly JiraMappingTargetDefinition[] = [
	{ id: "id", kind: "text" },
	{ id: "title", kind: "text" },
	{ id: "details", kind: "text" },
	{ id: "status", kind: "text" },
	{ id: "priority", kind: "text" },
	{ id: "due", kind: "date" },
	{ id: "scheduled", kind: "date" },
	{ id: "timeEstimate", kind: "number" },
	{ id: "dateCreated", kind: "date" },
	{ id: "dateModified", kind: "date" },
	{ id: "completedDate", kind: "date" },
	{ id: "recurrence", kind: "text" },
	{ id: "tags", kind: "list" },
	{ id: "projects", kind: "list" },
	{ id: "contexts", kind: "list" },
] as const;

export function createDefaultJiraMappingSettings(): JiraFieldMappingSettings {
	return {
		version: 1,
		fields: {
			id: [{ mode: "path", value: "key" }],
			title: [{ mode: "template", value: "$key $fields.summary" }],
			details: [{ mode: "path", value: "fields.description" }],
			status: [{ mode: "path", value: "fields.status.name" }],
			priority: [{ mode: "path", value: "fields.priority.name" }],
			due: [{ mode: "path", value: "fields.duedate" }],
			scheduled: [{ mode: "off", value: "" }],
			timeEstimate: [{ mode: "path", value: "fields.timeestimate" }],
			dateCreated: [{ mode: "path", value: "fields.created" }],
			dateModified: [{ mode: "path", value: "fields.updated" }],
			completedDate: [{ mode: "path", value: "fields.resolutiondate" }],
			recurrence: [{ mode: "off", value: "" }],
			tags: [{ mode: "path", value: "fields.labels" }],
			projects: [],
			contexts: [],
		},
		userFields: {},
		enumRemaps: {
			status: [],
			priority: [],
			contexts: [],
		},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function readOwnProperty(value: unknown, key: string): unknown {
	if (!isRecord(value) || UNSAFE_PATH_SEGMENTS.has(key)) return undefined;
	return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}

interface ParsedPathSegment {
	key: string;
	array: boolean;
	index?: number;
}

function parsePathSegment(segment: string): ParsedPathSegment | null {
	const match = /^([A-Za-z0-9_]+)(?:\[(\d*)\])?$/.exec(segment);
	if (!match || UNSAFE_PATH_SEGMENTS.has(match[1])) return null;
	if (match[2] === undefined) return { key: match[1], array: false };
	if (match[2] === "") return { key: match[1], array: true };
	return { key: match[1], array: false, index: Number(match[2]) };
}

/**
 * Resolves Jira paths using own properties only. Empty brackets project across arrays,
 * for example `fields.components[].name`.
 */
export function getJiraValueByPath(root: unknown, path: string): unknown {
	const segments = path
		.trim()
		.split(".")
		.map(parsePathSegment);
	if (!segments.length || segments.some((segment) => !segment)) return undefined;

	let values: unknown[] = [root];
	let projected = false;
	for (const parsed of segments) {
		const segment = parsed as ParsedPathSegment;
		const nextValues: unknown[] = [];
		for (const value of values) {
			const property = readOwnProperty(value, segment.key);
			if (segment.array) {
				if (Array.isArray(property)) {
					nextValues.push(...property);
					projected = true;
				}
			} else if (segment.index !== undefined) {
				if (Array.isArray(property) && segment.index < property.length) {
					nextValues.push(property[segment.index]);
				}
			} else if (property !== undefined) {
				nextValues.push(property);
			}
		}
		values = nextValues;
		if (!values.length) return undefined;
	}

	return projected || values.length > 1 ? values.flat(Infinity) : values[0];
}

function stringifyTemplateValue(value: unknown): string {
	if (Array.isArray(value)) return flattenList(value).join(", ");
	if (value === null || value === undefined) return "";
	if (typeof value === "object") return jiraRichTextToMarkdown(value) ?? "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return `${value}`;
	return "";
}

export function renderJiraTemplate(template: string, issue: JiraIssue): string {
	return template
		.replace(
			/\$([A-Za-z0-9_]+(?:\[(?:\d*)\])?(?:\.[A-Za-z0-9_]+(?:\[(?:\d*)\])?)*)/g,
			(_match, path: string) =>
				stringifyTemplateValue(
					getJiraValueByPath(
						issue,
						path === "summary"
							? "fields.summary"
							: path === "description"
								? "fields.description"
								: path
					)
				)
		)
		.replace(/\\n/g, "\n")
		.trim();
}

function readSource(source: JiraValueSource, issue: JiraIssue): unknown {
	switch (source.mode) {
		case "off":
			return undefined;
		case "fixed":
			return source.value;
		case "template":
			return renderJiraTemplate(source.value, issue);
		case "path":
			return getJiraValueByPath(issue, source.value);
	}
}

function flattenList(value: unknown): string[] {
	const values = Array.isArray(value) ? value.flat(Infinity) : [value];
	const strings = values
		.filter(
			(item): item is string | number | boolean =>
				typeof item === "string" ||
				typeof item === "number" ||
				typeof item === "boolean"
		)
		.map((item) => String(item).trim())
		.filter(Boolean);
	return [...new Set(strings)];
}

export function jiraRichTextToMarkdown(value: unknown): string | undefined {
	if (typeof value === "string") return value.trim() || undefined;
	if (!isRecord(value)) return undefined;

	const output: string[] = [];
	const visit = (node: unknown): void => {
		if (!isRecord(node)) return;
		if (typeof node.text === "string") output.push(node.text);
		if (Array.isArray(node.content)) {
			for (const child of node.content) visit(child);
			if (node.type === "paragraph" || node.type === "heading") output.push("\n");
		}
	};
	visit(value);
	return output.join("").trim() || undefined;
}

function firstResolvedSource(sources: JiraValueSource[], issue: JiraIssue): unknown {
	for (const source of sources) {
		const value = readSource(source, issue);
		if (value !== undefined && value !== null && value !== "") return value;
	}
	return undefined;
}

function remapEnum(value: string | undefined, remaps: JiraEnumRemap[]): string | undefined {
	if (!value) return undefined;
	const normalized = value.toLocaleLowerCase();
	const match = remaps.find((entry) =>
		entry.jiraValues.some((incoming) => incoming.toLocaleLowerCase() === normalized)
	);
	return match?.taskValue || value;
}

function coerceText(value: unknown): string | undefined {
	if (typeof value === "object" && value !== null) return jiraRichTextToMarkdown(value);
	if (!["string", "number", "boolean"].includes(typeof value)) return undefined;
	const text = String(value).trim();
	return text || undefined;
}

function coerceNumber(value: unknown): number | undefined {
	const number = typeof value === "number" ? value : Number(coerceText(value));
	return Number.isFinite(number) ? number : undefined;
}

function coerceDate(value: unknown): string | undefined {
	const text = coerceText(value);
	if (!text || Number.isNaN(Date.parse(text))) return undefined;
	return text;
}

function coerceBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	const text = coerceText(value)?.toLocaleLowerCase();
	if (text === "true" || text === "yes" || text === "1") return true;
	if (text === "false" || text === "no" || text === "0") return false;
	return undefined;
}

function coerceUserField(value: unknown, field: UserMappedField): unknown {
	switch (field.type) {
		case "number":
			return coerceNumber(value);
		case "date":
			return coerceDate(value);
		case "boolean":
			return coerceBoolean(value);
		case "list":
			return flattenList(value);
		default:
			return coerceText(value);
	}
}

function getJiraIssueUrl(issue: JiraIssue): string | undefined {
	const host =
		typeof issue.account?.host === "string" ? issue.account.host.trim() : "";
	const self = typeof issue.self === "string" ? issue.self.trim() : "";
	const candidate = host || self;
	if (!candidate) return undefined;

	try {
		const base = new URL(
			/^[a-z][a-z\d+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`
		);
		if (base.protocol !== "https:" && base.protocol !== "http:") return undefined;
		base.username = "";
		base.password = "";
		return new URL(`/browse/${encodeURIComponent(issue.key)}`, base.origin).toString();
	} catch {
		return undefined;
	}
}

/**
 * Creates the companion Jira plugin's macro backlink, or a direct browser URL when
 * the fetched issue includes a trustworthy HTTP(S) account host.
 */
export function buildJiraIssueBacklink(issue: JiraIssue): string {
	const url = getJiraIssueUrl(issue);
	return url ? `[Jira ${issue.key}](<${url}>)` : `JIRA:${issue.key}`;
}

export function prependJiraIssueBacklink(
	details: string | undefined,
	issue: JiraIssue
): string {
	const existing = details?.trim() ?? "";
	const url = getJiraIssueUrl(issue);
	const escapedKey = issue.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const hasReference =
		new RegExp(`\\bJIRA\\s*:\\s*${escapedKey}\\b`, "i").test(existing) ||
		new RegExp(`/browse/${escapedKey}(?:[)>\\s]|$)`, "i").test(existing) ||
		(!!url && existing.toLocaleLowerCase().includes(url.toLocaleLowerCase()));
	if (hasReference) return existing;

	const backlink = buildJiraIssueBacklink(issue);
	return existing ? `${backlink}\n\n${existing}` : backlink;
}

function normalizeSource(value: unknown): JiraValueSource | null {
	if (!isRecord(value) || !SOURCE_MODES.has(value.mode as JiraValueSourceMode)) return null;
	return {
		mode: value.mode as JiraValueSourceMode,
		value: typeof value.value === "string" ? value.value : "",
	};
}

function normalizeSources(value: unknown, fallback: JiraValueSource[]): JiraValueSource[] {
	if (!Array.isArray(value)) return fallback.map((source) => ({ ...source }));
	const normalized = value
		.map(normalizeSource)
		.filter((source): source is JiraValueSource => !!source);
	return value.length > 0 && normalized.length === 0
		? fallback.map((source) => ({ ...source }))
		: normalized;
}

function normalizeRemaps(value: unknown): JiraEnumRemap[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter(isRecord)
		.map((entry) => ({
			taskValue: typeof entry.taskValue === "string" ? entry.taskValue.trim() : "",
			jiraValues: flattenList(entry.jiraValues),
		}))
		.filter((entry) => entry.taskValue && entry.jiraValues.length);
}

function legacyFieldSources(
	value: Record<string, unknown>,
	field: JiraBuiltInFieldId
): unknown {
	const legacy = value[field];
	if (Array.isArray(legacy)) return legacy;
	return legacy === undefined ? undefined : [legacy];
}

/**
 * Validates persisted settings and upgrades the unversioned legacy Jira mapping shape.
 */
export function normalizeJiraMappingSettings(value: unknown): JiraFieldMappingSettings {
	const defaults = createDefaultJiraMappingSettings();
	if (!isRecord(value)) return defaults;
	const fieldsValue = isRecord(value.fields) ? value.fields : value;
	const fields: JiraFieldMappingSettings["fields"] = {};

	for (const field of BUILT_IN_FIELDS) {
		const raw = isRecord(value.fields)
			? fieldsValue[field]
			: legacyFieldSources(fieldsValue, field);
		fields[field] = normalizeSources(raw, defaults.fields[field] ?? []);
	}

	const rawUserFields = isRecord(value.userFields) ? value.userFields : {};
	const userFields: Record<string, JiraValueSource[]> = {};
	for (const [fieldId, sources] of Object.entries(rawUserFields)) {
		if (fieldId && !UNSAFE_PATH_SEGMENTS.has(fieldId)) {
			userFields[fieldId] = normalizeSources(sources, []);
		}
	}

	const rawRemaps = isRecord(value.enumRemaps) ? value.enumRemaps : value;
	return {
		version: 1,
		fields,
		userFields,
		enumRemaps: {
			status: normalizeRemaps(rawRemaps.status ?? value.statusMap),
			priority: normalizeRemaps(rawRemaps.priority ?? value.priorityMap),
			contexts: normalizeRemaps(rawRemaps.contexts ?? value.contextsMap),
		},
	};
}

export function mapJiraIssueWithSettings(
	issue: JiraIssue,
	settings: JiraFieldMappingSettings,
	userFields: readonly UserMappedField[]
): TaskCreationData {
	const config = normalizeJiraMappingSettings(settings);
	const output: TaskCreationData = { creationContext: "import" };
	const read = (field: JiraBuiltInFieldId): unknown =>
		LIST_FIELDS.has(field)
			? (config.fields[field] ?? []).flatMap((source) => flattenList(readSource(source, issue)))
			: firstResolvedSource(config.fields[field] ?? [], issue);

	output.id = coerceText(read("id"));
	output.title =
		coerceText(read("title")) || `${issue.key.trim()} ${issue.fields.summary.trim()}`;
	const mappedDetails =
		jiraRichTextToMarkdown(read("details")) ?? coerceText(read("details"));
	output.details = prependJiraIssueBacklink(mappedDetails, issue);
	output.status = remapEnum(
		coerceText(read("status")),
		config.enumRemaps.status
	);
	output.priority = remapEnum(
		coerceText(read("priority"))?.toLocaleLowerCase(),
		config.enumRemaps.priority
	);
	output.due = coerceDate(read("due"));
	output.scheduled = coerceDate(read("scheduled"));
	const estimateSeconds = coerceNumber(read("timeEstimate"));
	output.timeEstimate =
		estimateSeconds !== undefined && estimateSeconds >= 0
			? Math.floor(estimateSeconds / 60)
			: undefined;
	output.dateCreated = coerceDate(read("dateCreated"));
	output.dateModified = coerceDate(read("dateModified"));
	output.completedDate = coerceDate(read("completedDate"));
	output.recurrence = coerceText(read("recurrence"));
	const tags = flattenList(read("tags"));
	const projects = flattenList(read("projects"));
	const contexts = flattenList(read("contexts")).map(
		(value) => remapEnum(value, config.enumRemaps.contexts) ?? value
	);
	if (tags.length) output.tags = tags;
	if (projects.length) output.projects = projects;
	if (contexts.length) output.contexts = contexts;

	const customFrontmatter: Record<string, unknown> = {};
	for (const field of userFields) {
		const sources = config.userFields[field.id] ?? [];
		const rawValue =
			field.type === "list"
				? sources.flatMap((source) => flattenList(readSource(source, issue)))
				: firstResolvedSource(sources, issue);
		const value = coerceUserField(rawValue, field);
		if (
			value !== undefined &&
			(!Array.isArray(value) || value.length > 0)
		) {
			customFrontmatter[field.key] = value;
		}
	}
	if (Object.keys(customFrontmatter).length) output.customFrontmatter = customFrontmatter;

	return output;
}

/**
 * Resolves every configured destination through the production mapper while retaining
 * enough source information for the settings UI to distinguish empty and invalid values.
 */
export function buildJiraMappingPreview(
	issue: JiraIssue,
	settings: JiraFieldMappingSettings,
	userFields: readonly UserMappedField[]
): JiraMappingPreviewEntry[] {
	const config = normalizeJiraMappingSettings(settings);
	const mapped = mapJiraIssueWithSettings(issue, config, userFields);
	const mappedFields = mapped as unknown as Record<string, unknown>;
	const entries: JiraMappingPreviewEntry[] = [];

	for (const target of JIRA_MAPPING_TARGETS) {
		const sources = config.fields[target.id] ?? [];
		const resolvedSources = sources
			.map((source) => readSource(source, issue))
			.filter((value) => value !== undefined && value !== null && value !== "");
		const value = mappedFields[target.id];

		if (value !== undefined) {
			entries.push({
				id: target.id,
				label: target.id,
				status: Array.isArray(value) && value.length === 0 ? "empty" : "value",
				value,
			});
		} else if (target.kind === "list" && resolvedSources.length > 0) {
			entries.push({ id: target.id, label: target.id, status: "empty", value: [] });
		} else {
			entries.push({
				id: target.id,
				label: target.id,
				status: resolvedSources.length > 0 ? "invalid" : "missing",
			});
		}
	}

	for (const field of userFields) {
		const sources = config.userFields[field.id] ?? [];
		const resolvedSources = sources
			.map((source) => readSource(source, issue))
			.filter((value) => value !== undefined && value !== null && value !== "");
		const value = mapped.customFrontmatter?.[field.key];
		if (value !== undefined) {
			entries.push({
				id: field.id,
				label: field.displayName,
				status: Array.isArray(value) && value.length === 0 ? "empty" : "value",
				value,
			});
		} else if (field.type === "list" && resolvedSources.length > 0) {
			entries.push({ id: field.id, label: field.displayName, status: "empty", value: [] });
		} else {
			entries.push({
				id: field.id,
				label: field.displayName,
				status: resolvedSources.length > 0 ? "invalid" : "missing",
			});
		}
	}

	return entries;
}
