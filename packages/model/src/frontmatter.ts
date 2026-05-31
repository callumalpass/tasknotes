import YAML from "yaml";
import { DEFAULT_FIELD_MAPPING, DEFAULT_PRIORITIES, DEFAULT_STATUSES } from "./defaults";
import { mapTaskFromFrontmatter, mapTaskToFrontmatter } from "./mapping";
import type {
	FieldMapping,
	PriorityConfig,
	StatusConfig,
	TaskDocument,
	TaskInfo,
	UserMappedField,
} from "./types";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export interface ParseTaskDocumentOptions {
	path?: string;
	fieldMapping?: FieldMapping;
	storeTitleInFilename?: boolean;
	userFields?: readonly UserMappedField[];
	statuses?: readonly StatusConfig[];
	priorities?: readonly PriorityConfig[];
}

export interface SerializeTaskDocumentOptions {
	fieldMapping?: FieldMapping;
	taskTag?: string;
	storeTitleInFilename?: boolean;
	userFields?: readonly UserMappedField[];
	sortKeys?: boolean;
}

export function parseFrontmatter(markdown: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const match = markdown.match(FRONTMATTER_RE);
	if (!match) {
		return { frontmatter: {}, body: markdown };
	}
	const parsed = YAML.parse(match[1]) as unknown;
	const frontmatter =
		parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	return {
		frontmatter,
		body: markdown.slice(match[0].length),
	};
}

export function stringifyFrontmatter(
	frontmatter: Record<string, unknown>,
	options: { sortKeys?: boolean } = {}
): string {
	const normalized = options.sortKeys ? sortObjectKeys(frontmatter) : frontmatter;
	return YAML.stringify(normalized).trimEnd();
}

export function parseTaskDocument(
	markdown: string,
	options: ParseTaskDocumentOptions = {}
): TaskDocument {
	const { frontmatter, body } = parseFrontmatter(markdown);
	const task = mapTaskFromFrontmatter(
		options.fieldMapping ?? DEFAULT_FIELD_MAPPING,
		frontmatter,
		options.path ?? "",
		options.storeTitleInFilename ?? false,
		options.userFields ?? [],
		options.statuses ?? DEFAULT_STATUSES,
		options.priorities ?? DEFAULT_PRIORITIES
	);
	return {
		frontmatter,
		body,
		task,
		path: options.path,
	};
}

export function serializeTaskDocument(
	task: Partial<TaskInfo>,
	body = "",
	options: SerializeTaskDocumentOptions = {}
): string {
	const frontmatter = mapTaskToFrontmatter(
		options.fieldMapping ?? DEFAULT_FIELD_MAPPING,
		task,
		options.taskTag,
		options.storeTitleInFilename ?? false,
		options.userFields ?? []
	);
	return serializeMarkdownDocument(frontmatter, body, { sortKeys: options.sortKeys });
}

export function serializeMarkdownDocument(
	frontmatter: Record<string, unknown>,
	body = "",
	options: { sortKeys?: boolean } = {}
): string {
	const yaml = stringifyFrontmatter(frontmatter, options);
	const normalizedBody = body.replace(/\r\n/g, "\n");
	return `---\n${yaml}\n---\n${normalizedBody}`;
}

export function mergeFrontmatter(
	base: Record<string, unknown>,
	patch: Record<string, unknown | null>
): Record<string, unknown> {
	const result = { ...base };
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) {
			delete result[key];
		} else {
			result[key] = value;
		}
	}
	return result;
}

function sortObjectKeys(value: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}
