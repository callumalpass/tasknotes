import type { App } from "obsidian";
import type { UserMappedField } from "../types/settings";
import { getObsidianPropertyType } from "./basesViewAdapters";

type PropertyTypeSource = Pick<UserMappedField, "key" | "type">;

const BOOLEAN_PROPERTY_TYPES = new Set(["boolean", "checkbox"]);
const NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function getTaskNotesPropertyType(
	userFields: readonly PropertyTypeSource[] | undefined,
	propertyName: string
): string | null {
	const exactMatch = userFields?.find((field) => field.key === propertyName);
	if (exactMatch) {
		return exactMatch.type;
	}

	const normalizedPropertyName = propertyName.toLowerCase();
	const caseInsensitiveMatch = userFields?.find(
		(field) => field.key.toLowerCase() === normalizedPropertyName
	);
	return caseInsensitiveMatch?.type ?? null;
}

export function getPropertyTypeForFrontmatterKey(
	app: App,
	propertyName: string,
	userFields: readonly PropertyTypeSource[] | undefined
): string | null {
	return (
		getTaskNotesPropertyType(userFields, propertyName) ??
		getObsidianPropertyType(app, propertyName)
	);
}

export function coerceGroupKeyToPropertyType(
	groupKey: string,
	propertyType: string | null | undefined
): string | number | boolean {
	if (!propertyType) {
		return groupKey;
	}

	const normalizedType = propertyType.toLowerCase();
	const trimmedValue = groupKey.trim();

	if (normalizedType === "number" && NUMBER_PATTERN.test(trimmedValue)) {
		const parsed = Number(trimmedValue);
		return Number.isFinite(parsed) ? parsed : groupKey;
	}

	if (BOOLEAN_PROPERTY_TYPES.has(normalizedType)) {
		if (trimmedValue.toLowerCase() === "true") {
			return true;
		}
		if (trimmedValue.toLowerCase() === "false") {
			return false;
		}
	}

	return groupKey;
}

export function coerceGroupKeyForFrontmatter(
	app: App,
	propertyName: string,
	groupKey: string,
	userFields: readonly PropertyTypeSource[] | undefined
): string | number | boolean {
	const propertyType = getPropertyTypeForFrontmatterKey(app, propertyName, userFields);
	return coerceGroupKeyToPropertyType(groupKey, propertyType);
}
