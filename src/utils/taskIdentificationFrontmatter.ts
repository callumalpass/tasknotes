import { getFrontmatterTags } from "../core/fieldMapping";

export { getFrontmatterTags };

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
		const hasIdentifier = tags.some(
			(tag) => normalizeFrontmatterTag(tag) === normalizedIdentifier
		);
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
