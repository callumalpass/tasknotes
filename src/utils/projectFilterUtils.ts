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

	const expectedValues = normalizePropertyValues(filter.value);
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

	return matchesValue(actualValue);
}
