export function coerceTaskIdentifierPropertyValue(value: string): string | boolean {
	const lower = value.toLowerCase();
	return lower === "true" || lower === "false" ? lower === "true" : value;
}

export function normalizeFrontmatterTag(value: string): string {
	const trimmed = value.trim();
	const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1).trim() : trimmed;
	return withoutHash.replace(/\s+/g, "-");
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
	const tags: string[] = [];
	const seen = new Set<string>();
	const addTag = (tagValue: unknown): void => {
		const normalized = normalizeFrontmatterTag(String(tagValue));
		if (!normalized || seen.has(normalized)) {
			return;
		}
		seen.add(normalized);
		tags.push(normalized);
	};

	if (Array.isArray(value)) {
		value.forEach(addTag);
		return tags;
	}

	if (typeof value === "string" && value.trim().length > 0) {
		addTag(value);
		return tags;
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
		const normalizedIdentifier = normalizeFrontmatterTag(propertyValue);
		const hasIdentifier = tags.some((tag) => normalizeFrontmatterTag(tag) === normalizedIdentifier);
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
