import type { UserMappedField } from "../types/settings";

export function userFieldValueToString(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return value.map(userFieldValueToString).join(", ");
	return "";
}

export function userFieldValueToInputString(value: unknown): string {
	return Array.isArray(value)
		? value.map(userFieldValueToString).join(", ")
		: userFieldValueToString(value);
}

export function parseListUserFieldInput(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export function parseNullableListUserFieldInput(value: string): string[] | null {
	const items = parseListUserFieldInput(value);
	return items.length > 0 ? items : null;
}

export function parseNumberUserFieldInput(value: string): number | null {
	const numberValue = parseFloat(value);
	return isNaN(numberValue) ? null : numberValue;
}

export function parseNullableTextUserFieldInput(value: string | null | undefined): string | null {
	return value || null;
}

export function isTruthyUserFieldValue(value: unknown): boolean {
	return value === true || value === "true";
}

export function buildCustomFrontmatter(
	userFields: Record<string, unknown>
): Record<string, unknown> {
	const customFrontmatter: Record<string, unknown> = {};

	for (const [fieldKey, fieldValue] of Object.entries(userFields)) {
		if (fieldValue !== null && fieldValue !== undefined && fieldValue !== "") {
			customFrontmatter[fieldKey] = fieldValue;
		}
	}

	return customFrontmatter;
}

export function getUserFieldChanges(
	userFields: Record<string, unknown>,
	frontmatter: Record<string, unknown>,
	userFieldConfigs: readonly Pick<UserMappedField, "key">[]
): Record<string, unknown> {
	const userFieldsChanges: Record<string, unknown> = {};

	for (const field of userFieldConfigs) {
		if (!field?.key) continue;

		const newValue = userFields[field.key];
		const oldValue = frontmatter[field.key];

		if (isUserFieldValueDifferent(newValue, oldValue)) {
			userFieldsChanges[field.key] =
				newValue === null || newValue === undefined || newValue === ""
					? null
					: newValue;
		}
	}

	return userFieldsChanges;
}

export function isUserFieldValueDifferent(newValue: unknown, oldValue: unknown): boolean {
	const normalizedNew = normalizeEmptyUserFieldValue(newValue);
	const normalizedOld = normalizeEmptyUserFieldValue(oldValue);

	if (Array.isArray(normalizedNew) || Array.isArray(normalizedOld)) {
		return JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOld);
	}

	return normalizedNew !== normalizedOld;
}

function normalizeEmptyUserFieldValue(value: unknown): unknown {
	if (value === null || value === undefined || value === "") {
		return null;
	}
	return value;
}
