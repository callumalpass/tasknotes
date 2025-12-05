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

	const actualValue = (frontmatter as Record<string, unknown>)[filter.key];

	const expected = normalizePropertyValue(filter.value);
	if (expected.length === 0) {
		return actualValue !== undefined && actualValue !== null;
	}

	const normalizedExpected = expected.toLowerCase();

	const matchesValue = (value: unknown): boolean => {
		if (value === null || value === undefined) {
			return false;
		}
		if (Array.isArray(value)) {
			return value.some((item) => matchesValue(item));
		}
		if (typeof value === "string") {
			return value.trim().toLowerCase() === normalizedExpected;
		}
		if (typeof value === "number" || typeof value === "boolean") {
			return String(value).toLowerCase() === normalizedExpected;
		}
		if (typeof value === "object") {
			try {
				return JSON.stringify(value).toLowerCase() === normalizedExpected;
			} catch {
				return false;
			}
		}
		return String(value).toLowerCase() === normalizedExpected;
	};

	return matchesValue(actualValue);
}
