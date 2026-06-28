import { stringifyUnknown } from "./stringUtils";

export interface ProjectPropertyFilter {
	key: string;
	value: string;
	enabled: boolean;
}

/**
 * Common interface for settings that contain property filter configuration.
 * Both ProjectAutosuggestSettings and FileFilterConfig satisfy this interface.
 */
export interface PropertyFilterSettings {
	propertyKey?: string;
	propertyValue?: string;
}

/**
 * Result of parsing a "Required property value" expression.
 *
 * The value field supports three forms:
 *  - A plain comma-separated allow-list:  `project, area`
 *  - A `containsAny(...)` function call:   `containsAny("project", "area")`
 *  - A negated form using a leading `!` or `not `:
 *      `!containsAny("completed", "archived")`  /  `not project, area`
 */
interface ParsedPropertyValueExpression {
	negate: boolean;
	values: string[];
}

/** Function names understood in the property value expression (lower-cased). */
const KNOWN_FUNCTIONS = new Set(["containsany"]);

function normalizePropertyValue(value?: string): string {
	return value != null ? value.trim() : "";
}

export function normalizeProjectPropertyKey(key?: string): string {
	return key ? key.trim() : "";
}

function stripQuotes(value: string): string {
	if (value.length >= 2) {
		const first = value[0];
		const last = value[value.length - 1];
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			return value.slice(1, -1);
		}
	}
	return value;
}

/** Split a comma-separated argument list, trimming and unquoting each entry. */
function splitArguments(input: string): string[] {
	const trimmed = input.trim();
	if (trimmed.length === 0) {
		return [];
	}
	return trimmed
		.split(",")
		.map((item) => stripQuotes(item.trim()))
		.filter((item) => item.length > 0);
}

/**
 * Parse the raw "Required property value" string into an expression.
 *
 * Backwards compatible: a plain comma-separated list (the historical format)
 * parses to `{ negate: false, values: [...] }`, preserving existing behavior.
 */
export function parsePropertyValueExpression(rawValue?: string): ParsedPropertyValueExpression {
	let expr = normalizePropertyValue(rawValue);
	let negate = false;

	// Leading negation: "!" or "not " (case-insensitive).
	if (expr.startsWith("!")) {
		negate = true;
		expr = expr.slice(1).trim();
	} else {
		const notMatch = /^not\s+/i.exec(expr);
		if (notMatch) {
			negate = true;
			expr = expr.slice(notMatch[0].length).trim();
		}
	}

	// Function-call form: name( ... ).
	const fnMatch = /^([a-zA-Z][\w]*)\s*\(([\s\S]*)\)$/.exec(expr);
	if (fnMatch && KNOWN_FUNCTIONS.has(fnMatch[1].toLowerCase())) {
		return { negate, values: splitArguments(fnMatch[2]) };
	}

	// Fallback: legacy comma-separated allow-list.
	return { negate, values: splitArguments(expr) };
}

export function getProjectPropertyFilter(
	settings?: PropertyFilterSettings
): ProjectPropertyFilter {
	const key = normalizeProjectPropertyKey(settings?.propertyKey);
	const value = normalizePropertyValue(settings?.propertyValue);
	return {
		key,
		value,
		enabled: key.length > 0,
	};
}

/** True when a property value is absent or carries no meaningful content. */
function isEmptyValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}
	if (typeof value === "string") {
		return value.trim().length === 0;
	}
	if (Array.isArray(value)) {
		return value.length === 0;
	}
	return false;
}

/** True when `value` (a scalar, array, or object) equals any of the expected values. */
function matchesAnyValue(value: unknown, expected: Set<string>): boolean {
	if (value === null || value === undefined) {
		return false;
	}
	if (Array.isArray(value)) {
		return value.some((item) => matchesAnyValue(item, expected));
	}
	if (typeof value === "string") {
		return expected.has(value.trim().toLowerCase());
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return expected.has(String(value).toLowerCase());
	}
	if (typeof value === "object") {
		try {
			return expected.has(JSON.stringify(value).toLowerCase());
		} catch {
			return false;
		}
	}
	return expected.has(stringifyUnknown(value).toLowerCase());
}

export function matchesProjectProperty(
	frontmatter: Record<string, unknown> | undefined | null,
	filter: ProjectPropertyFilter
): boolean {
	if (!filter.enabled) {
		return true;
	}

	const parsed = parsePropertyValueExpression(filter.value);

	const hasFrontmatter = !!frontmatter && typeof frontmatter === "object";
	const hasKey = hasFrontmatter && filter.key in frontmatter;
	const actualValue = hasKey ? frontmatter[filter.key] : undefined;

	// Honor the "Required property key" contract: the property must exist with a
	// non-empty value. Notes lacking it are never suggested, whether the value
	// expression is an allow-list or a negation.
	if (!hasKey || isEmptyValue(actualValue)) {
		return false;
	}

	// Only a key was configured (or a bare "!"/"not"): existence is enough.
	if (parsed.values.length === 0) {
		return true;
	}

	const expectedValues = new Set(parsed.values.map((value) => value.toLowerCase()));
	const matched = matchesAnyValue(actualValue, expectedValues);

	// A negation shows notes whose (existing) value is none of the listed values.
	return parsed.negate ? !matched : matched;
}
