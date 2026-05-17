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

function isBlankValue(value: unknown): boolean {
	return typeof value === "string" && value.trim().length === 0;
}

function propertyValuesMatch(left: unknown, right: string | boolean): boolean {
	return left === right;
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

	const identifier = coerceTaskIdentifierPropertyValue(propertyValue);
	const existing = frontmatter[propertyName];

	if (Array.isArray(existing)) {
		if (!existing.some((value) => propertyValuesMatch(value, identifier))) {
			existing.push(identifier);
		}
		frontmatter[propertyName] = existing;
		return;
	}

	if (existing === undefined || existing === null || isBlankValue(existing)) {
		frontmatter[propertyName] = identifier;
		return;
	}

	if (propertyValuesMatch(existing, identifier)) {
		frontmatter[propertyName] = existing;
		return;
	}

	frontmatter[propertyName] = [existing, identifier];
}
