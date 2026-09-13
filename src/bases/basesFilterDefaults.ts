import type { FieldMappingKey } from "../types";
import type { UserMappedField } from "../types/settings";
import type {
	BasesCreateFileFrontmatter,
	TaskCreationFieldMapper,
} from "./basesTaskCreation";

type BasesFilterLike = {
	conjunction?: unknown;
	filters?: unknown;
	rule?: {
		text?: unknown;
	};
};

export type BasesFilterDefaultOptions = {
	config: unknown;
	fieldMapper: TaskCreationFieldMapper;
	taskTag: string;
	userFields?: readonly Pick<UserMappedField, "key">[];
	currentFileLink?: string | null | (() => string | null);
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decodeQuotedValue(value: string): string {
	try {
		return JSON.parse(`"${value}"`) as string;
	} catch {
		return value;
	}
}

export function extractBasesFilterDefaults(
	options: BasesFilterDefaultOptions
): BasesCreateFileFrontmatter {
	const defaults: BasesCreateFileFrontmatter = {};
	const configRecord = isRecord(options.config) ? options.config : {};
	const query = isRecord(configRecord.query) ? configRecord.query : undefined;

	collectFilterDefaults(query?.filters, defaults, options);
	collectFilterDefaults(configRecord.filters, defaults, options);

	return defaults;
}

function collectFilterDefaults(
	filter: unknown,
	defaults: BasesCreateFileFrontmatter,
	options: BasesFilterDefaultOptions
): void {
	if (!isRecord(filter)) return;

	const filterGroup = filter as BasesFilterLike;
	const children = Array.isArray(filterGroup.filters) ? filterGroup.filters : [];
	if (children.length > 0) {
		if (filterGroup.conjunction !== undefined && filterGroup.conjunction !== "and") {
			return;
		}

		for (const child of children) {
			collectFilterDefaults(child, defaults, options);
		}
		return;
	}

	const ruleText = isRecord(filterGroup.rule) ? filterGroup.rule.text : undefined;
	if (typeof ruleText === "string") {
		applyFilterRuleDefault(ruleText, defaults, options);
	}
}

function applyFilterRuleDefault(
	ruleText: string,
	defaults: BasesCreateFileFrontmatter,
	options: BasesFilterDefaultOptions
): void {
	const trimmedRule = ruleText.trim();

	const tagMatch = trimmedRule.match(/^file\.hasTag\("((?:\\.|[^"\\])*)"\)$/);
	if (tagMatch) {
		const tag = decodeQuotedValue(tagMatch[1]);
		if (tag !== options.taskTag) {
			addFrontmatterDefault(defaults, "tags", tag, options.fieldMapper);
		}
		return;
	}

	const equalityMatch = trimmedRule.match(/^(.+?)\s*==\s*"((?:\\.|[^"\\])*)"$/);
	if (equalityMatch) {
		const property = normalizeFilterProperty(equalityMatch[1], options);
		if (property) {
			addFrontmatterDefault(
				defaults,
				property,
				decodeQuotedValue(equalityMatch[2]),
				options.fieldMapper
			);
		}
		return;
	}

	const containsMatch = trimmedRule.match(/^(.+?)\.contains\("((?:\\.|[^"\\])*)"\)$/);
	if (containsMatch) {
		const property = normalizeFilterProperty(containsMatch[1], options);
		if (property) {
			addFrontmatterDefault(
				defaults,
				property,
				decodeQuotedValue(containsMatch[2]),
				options.fieldMapper
			);
		}
		return;
	}

	const currentFileContainsMatch = trimmedRule.match(
		/^(.+?)\.contains\(this\.file\.asLink\(\)\)$/
	);
	if (currentFileContainsMatch) {
		const property = normalizeFilterProperty(currentFileContainsMatch[1], options);
		const currentFileLink = resolveCurrentFileLink(options.currentFileLink);
		if (property && currentFileLink) {
			addFrontmatterDefault(defaults, property, currentFileLink, options.fieldMapper);
		}
	}
}

function resolveCurrentFileLink(
	currentFileLink: BasesFilterDefaultOptions["currentFileLink"]
): string | null {
	return typeof currentFileLink === "function" ? currentFileLink() : currentFileLink ?? null;
}

function normalizeFilterProperty(
	propertyExpression: string,
	options: BasesFilterDefaultOptions
): string | null {
	let property = propertyExpression.trim();

	// Strip a leading `&&`-joined left side. The generated default-relationships
	// filter (see `formatProjectEntryLinkExpression` in `defaultBasesFiles.ts`,
	// issue #2043) concatenates `file.hasLink(this.file) &&` before the
	// `list(note.PROP).map(...)` expression so the regex above matches the
	// whole conjunction. Keep only the right-hand operand.
	const conjunctionIndex = property.lastIndexOf("&&");
	if (conjunctionIndex !== -1) {
		property = property.slice(conjunctionIndex + 2).trim();
	}

	// Strip generated `.map(...)` chains emitted by the relationship templates
	// in `defaultBasesFiles.ts`. These wrap `list(note.PROP)` to normalize link
	// formats (markdown links, `%20`, paths). The wrapper closes one balanced
	// call, so find the last `.map(` and strip up to its matching `)`.
	const mapStart = property.lastIndexOf(".map(");
	if (mapStart !== -1) {
		let depth = 0;
		let endIndex = -1;
		for (let i = mapStart + 5; i < property.length; i++) {
			const ch = property[i];
			if (ch === "(") {
				depth++;
			} else if (ch === ")") {
				if (depth === 0) {
					endIndex = i;
					break;
				}
				depth--;
			}
		}
		if (endIndex !== -1) {
			property = property.slice(0, mapStart).trim();
		}
	}

	const listMatch = property.match(/^list\((.+)\)$/);
	if (listMatch) {
		property = listMatch[1].trim();
	}
	property = property.replace(/^(note|task|this\.note)\./, "");

	if (property === "tags" || property === "file.tags") {
		return "tags";
	}

	for (const field of CORE_FILTER_DEFAULT_FIELDS) {
		const userField = options.fieldMapper.toUserField(field);
		if (property === field || property === userField) {
			return userField;
		}
	}

	if (options.userFields?.some((field) => field.key === property)) {
		return property;
	}

	return null;
}

const CORE_FILTER_DEFAULT_FIELDS = [
	"title",
	"status",
	"priority",
	"due",
	"scheduled",
	"contexts",
	"projects",
	"timeEstimate",
	"completedDate",
	"dateCreated",
	"recurrence",
	"blockedBy",
] as const satisfies readonly FieldMappingKey[];

function addFrontmatterDefault(
	defaults: BasesCreateFileFrontmatter,
	property: string,
	value: string,
	fieldMapper: TaskCreationFieldMapper
): void {
	const listFields = new Set([
		"tags",
		fieldMapper.toUserField("contexts"),
		fieldMapper.toUserField("projects"),
		fieldMapper.toUserField("blockedBy"),
	]);

	if (!listFields.has(property)) {
		if (defaults[property] === undefined) {
			defaults[property] = value;
		}
		return;
	}

	const existing = defaults[property];
	const values = Array.isArray(existing)
		? existing.filter((item): item is string => typeof item === "string")
		: typeof existing === "string"
			? [existing]
			: [];
	if (!values.includes(value)) {
		defaults[property] = [...values, value];
	}
}
