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

function normalizePropertyValue(value?: string): string {
	return value != null ? value.trim() : "";
}

function normalizePropertyValues(value?: string): string[] {
	const normalized = normalizePropertyValue(value);
	return normalized.length > 0
		? normalized
				.split(",")
				.map((item) => item.trim())
				.filter(Boolean)
		: [];
}

/**
 * Only explicit containsAny calls opt in to expression parsing. Legacy values
 * such as "not started" and quoted statuses retain their literal meaning.
 * Malformed calls fail closed rather than accidentally suggesting every project.
 */
function parsePropertyValueExpression(value: string): { values: string[]; negate: boolean } | null {
	const prefix = /^(?:![ \t]*|not\s+)?containsAny\s*\(/i.exec(value);
	if (!prefix) return { values: normalizePropertyValues(value), negate: false };
	if (!value.endsWith(")")) return null;
	const args = value.slice(prefix[0].length, -1);
	const values: string[] = [];
	let token = "";
	let quote = "";
	let quoted = false;
	let closedQuote = false;
	for (let i = 0; i < args.length; i++) {
		const char = args[i];
		if (quote) {
			if (char === "\\") {
				i++;
				if (i >= args.length) return null;
				token += args[i];
			} else if (char === quote) {
				quote = "";
				closedQuote = true;
			} else token += char;
		} else if (char === ",") {
			if (!token.trim() && !quoted) return null;
			values.push(quoted ? token : token.trim());
			token = "";
			quoted = false;
			closedQuote = false;
		} else if (char === '"' || char === "'") {
			if (token.trim() || quoted) return null;
			token = "";
			quote = char;
			quoted = true;
		} else if (closedQuote) {
			if (char.trim()) return null;
		} else {
			if (char === "(" || char === ")") return null;
			token += char;
		}
	}
	if (quote || (!token.trim() && !quoted)) return null;
	values.push(quoted ? token : token.trim());
	return { values, negate: /^(?:!|not\s)/i.test(value) };
}

export function normalizeProjectPropertyKey(key?: string): string {
	return key ? key.trim() : "";
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

export function matchesProjectProperty(
	frontmatter: Record<string, unknown> | undefined | null,
	filter: ProjectPropertyFilter
): boolean {
	if (!filter.enabled) {
		return true;
	}

	if (!frontmatter || typeof frontmatter !== "object") {
		return false;
	}

	if (!(filter.key in frontmatter)) {
		return false;
	}

	const actualValue = (frontmatter)[filter.key];

	const parsed = parsePropertyValueExpression(normalizePropertyValue(filter.value));
	if (!parsed) return false;
	const expectedValues = parsed.values;
	if (expectedValues.length === 0) {
		return actualValue !== undefined && actualValue !== null;
	}

	const normalizedExpectedValues = new Set(
		expectedValues.map((expectedValue) => expectedValue.toLowerCase())
	);

	const matchesValue = (value: unknown): boolean => {
		if (value === null || value === undefined) {
			return false;
		}
		if (Array.isArray(value)) {
			return value.some((item) => matchesValue(item));
		}
		if (typeof value === "string") {
			return normalizedExpectedValues.has(value.trim().toLowerCase());
		}
		if (typeof value === "number" || typeof value === "boolean") {
			return normalizedExpectedValues.has(String(value).toLowerCase());
		}
		if (typeof value === "object") {
			try {
				return normalizedExpectedValues.has(JSON.stringify(value).toLowerCase());
			} catch {
				return false;
			}
		}
		return normalizedExpectedValues.has(stringifyUnknown(value).toLowerCase());
	};

	// A value filter never admits missing/empty properties, even under negation.
	if (actualValue == null || (typeof actualValue === "string" && !actualValue.trim()) ||
		(Array.isArray(actualValue) && actualValue.length === 0)) return false;
	const matched = matchesValue(actualValue);
	return parsed.negate ? !matched : matched;
}
