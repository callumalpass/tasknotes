export function coerceTaskIdentifierPropertyValue(value: string): string | boolean {
	const lower = value.toLowerCase();
	return lower === "true" || lower === "false" ? lower === "true" : value;
}

function normalizeTag(value: string): string {
	return value.startsWith("#") ? value.slice(1) : value;
}

export function isTagsTaskIdentifierProperty(propertyName: string): boolean {
	return propertyName.trim().toLowerCase() === "tags";
}

export function getFrontmatterTags(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map(String).filter((tag) => tag.trim().length > 0);
	}

	if (typeof value === "string" && value.trim().length > 0) {
		return [value.trim()];
	}

	return [];
}

export function applyPropertyTaskIdentifier(
	frontmatter: Record<string, unknown>,
	propertyName: string,
	propertyValue: string
): void {
	if (!propertyName || !propertyValue) {
		return;
	}

	if (isTagsTaskIdentifierProperty(propertyName)) {
		const tags = getFrontmatterTags(frontmatter.tags);
		const normalizedIdentifier = normalizeTag(propertyValue);
		const hasIdentifier = tags.some((tag) => normalizeTag(tag) === normalizedIdentifier);
		if (!hasIdentifier) {
			tags.push(normalizedIdentifier);
		}
		frontmatter.tags = tags;
		return;
	}

	frontmatter[propertyName] = coerceTaskIdentifierPropertyValue(propertyValue);
}
