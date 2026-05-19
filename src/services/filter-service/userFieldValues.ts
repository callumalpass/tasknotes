import type { UserMappedField } from "../../types/settings";
import type { TaskPropertyValue } from "../../utils/FilterUtils";
import { splitListPreservingLinksAndQuotes } from "../../utils/stringSplit";
import { stringifyUnknown } from "../../utils/stringUtils";

type UserFieldDefinition = Pick<UserMappedField, "id" | "key" | "displayName" | "type">;

interface UserFieldGroupLabels {
	unknownField: string;
	noValue: string;
	noDate: string;
	empty: string;
	nonNumeric: string;
	error: string;
}

const DEFAULT_GROUP_LABELS: UserFieldGroupLabels = {
	unknownField: "unknown-field",
	noValue: "no-value",
	noDate: "no-date",
	empty: "empty",
	nonNumeric: "non-numeric",
	error: "error",
};

function getPrimaryUserFieldId(field: UserFieldDefinition): string {
	return field.id || field.key;
}

function compareStringsWithMissingLast(
	a: string | null | undefined,
	b: string | null | undefined
): number {
	if (a == null) return 1;
	if (b == null) return -1;
	return a.localeCompare(b);
}

function parseBooleanLike(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value;
	if (value == null) return undefined;

	const normalized = stringifyUnknown(value).trim().toLowerCase();
	if (normalized === "true") return true;
	if (normalized === "false") return false;
	return undefined;
}

function parseLeadingNumber(value: unknown): string | undefined {
	if (typeof value === "number") return String(value);
	if (typeof value !== "string") return undefined;

	const match = value.match(/^(\d+(?:\.\d+)?)/);
	return match ? match[1] : undefined;
}

function firstNormalizedListToken(value: unknown): string | undefined {
	if (Array.isArray(value)) {
		return normalizeUserListValue(value)[0];
	}
	if (typeof value === "string") {
		if (value.trim().length === 0) return "";
		return normalizeUserListValue(value)[0];
	}
	return undefined;
}

/**
 * Normalize list-type user field values from frontmatter into comparable tokens.
 *
 * Wikilinks produce both their display token and raw token so filters can match
 * either the human text or exact frontmatter value.
 */
export function normalizeUserListValue(raw: unknown): string[] {
	const tokens: string[] = [];
	const pushToken = (s: string) => {
		if (!s) return;
		const trimmed = String(s).trim();
		if (!trimmed) return;
		const match = trimmed.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
		if (match) {
			const target = match[1] || "";
			const alias = match[2];
			const base = alias || target.split("#")[0].split("/").pop() || target;
			if (base) tokens.push(base);
			tokens.push(trimmed);
			return;
		}
		tokens.push(trimmed);
	};

	if (Array.isArray(raw)) {
		for (const value of raw) pushToken(stringifyUnknown(value));
	} else if (typeof raw === "string") {
		const parts = splitListPreservingLinksAndQuotes(raw);
		for (const part of parts) pushToken(part);
	} else if (raw != null) {
		pushToken(stringifyUnknown(raw));
	}

	const seen = new Set<string>();
	const output: string[] = [];
	for (const token of tokens) {
		if (!seen.has(token)) {
			seen.add(token);
			output.push(token);
		}
	}
	return output;
}

export function findUserFieldById(
	userFields: readonly UserFieldDefinition[] | undefined,
	fieldId: string
): UserFieldDefinition | undefined {
	return userFields?.find((field) => getPrimaryUserFieldId(field) === fieldId);
}

export function findUserFieldByIdOrKey(
	userFields: readonly UserFieldDefinition[] | undefined,
	fieldIdOrKey: string
): UserFieldDefinition | undefined {
	return userFields?.find(
		(field) => getPrimaryUserFieldId(field) === fieldIdOrKey || field.key === fieldIdOrKey
	);
}

export function coerceUserFieldTaskValue(
	field: UserFieldDefinition,
	rawValue: unknown
): TaskPropertyValue {
	switch (field.type) {
		case "boolean":
			return typeof rawValue === "boolean"
				? rawValue
				: stringifyUnknown(rawValue).toLowerCase() === "true";
		case "number":
			return typeof rawValue === "number"
				? rawValue
				: rawValue != null
					? parseFloat(stringifyUnknown(rawValue))
					: undefined;
		case "list":
			return normalizeUserListValue(rawValue);
		case "date":
		case "text":
		default:
			return rawValue != null ? stringifyUnknown(rawValue) : undefined;
	}
}

export function compareUserFieldValues(
	field: UserFieldDefinition,
	rawA: unknown,
	rawB: unknown
): number {
	switch (field.type) {
		case "number": {
			const numA =
				typeof rawA === "number"
					? rawA
					: rawA != null
						? parseFloat(stringifyUnknown(rawA))
						: NaN;
			const numB =
				typeof rawB === "number"
					? rawB
					: rawB != null
						? parseFloat(stringifyUnknown(rawB))
						: NaN;
			const isNumA = !isNaN(numA);
			const isNumB = !isNaN(numB);
			if (isNumA && isNumB) return numA - numB;
			if (isNumA && !isNumB) return -1;
			if (!isNumA && isNumB) return 1;
			return 0;
		}
		case "boolean": {
			const boolA = parseBooleanLike(rawA);
			const boolB = parseBooleanLike(rawB);
			if (boolA === boolB) return 0;
			if (boolA === true) return -1;
			if (boolB === true) return 1;
			if (boolA === false) return -1;
			if (boolB === false) return 1;
			return 0;
		}
		case "date": {
			const timeA = rawA ? Date.parse(stringifyUnknown(rawA)) : NaN;
			const timeB = rawB ? Date.parse(stringifyUnknown(rawB)) : NaN;
			const isValidA = !isNaN(timeA);
			const isValidB = !isNaN(timeB);
			if (isValidA && isValidB) return timeA - timeB;
			if (isValidA && !isValidB) return -1;
			if (!isValidA && isValidB) return 1;
			return 0;
		}
		case "list": {
			const textA = firstNormalizedListToken(rawA);
			const textB = firstNormalizedListToken(rawB);
			if ((textA == null || textA === "") && (textB == null || textB === "")) return 0;
			if (textA == null || textA === "") return 1;
			if (textB == null || textB === "") return -1;
			return textA.localeCompare(textB);
		}
		case "text":
		default: {
			const textA = rawA != null ? stringifyUnknown(rawA) : "";
			const textB = rawB != null ? stringifyUnknown(rawB) : "";
			return textA.localeCompare(textB);
		}
	}
}

export function getUserFieldGroupValue(
	field: UserFieldDefinition | undefined,
	rawValue: unknown,
	labels: UserFieldGroupLabels = DEFAULT_GROUP_LABELS
): string {
	if (!field) return labels.unknownField;

	try {
		switch (field.type) {
			case "boolean": {
				const boolValue = parseBooleanLike(rawValue);
				return boolValue == null ? labels.noValue : boolValue ? "true" : "false";
			}
			case "number":
				return (
					parseLeadingNumber(rawValue) ??
					(typeof rawValue === "string" ? labels.nonNumeric : labels.noValue)
				);
			case "date":
				return rawValue ? stringifyUnknown(rawValue) : labels.noDate;
			case "list": {
				if (Array.isArray(rawValue)) {
					const tokens = normalizeUserListValue(rawValue);
					return tokens.length > 0 ? tokens[0] : labels.empty;
				}
				if (typeof rawValue === "string") {
					if (rawValue.trim().length === 0) return labels.empty;
					const tokens = normalizeUserListValue(rawValue);
					return tokens.length > 0 ? tokens[0] : labels.empty;
				}
				return labels.noValue;
			}
			case "text":
			default:
				return rawValue ? stringifyUnknown(rawValue).trim() || labels.empty : labels.noValue;
		}
	} catch {
		return labels.error;
	}
}

export function getHierarchicalUserFieldGroupValues(
	field: UserFieldDefinition | undefined,
	rawValue: unknown,
	missingLabel: string
): string[] {
	if (!field) return [missingLabel];

	switch (field.type) {
		case "boolean": {
			const boolValue = parseBooleanLike(rawValue);
			return boolValue == null ? [missingLabel] : [boolValue ? "true" : "false"];
		}
		case "number": {
			const numberToken = parseLeadingNumber(rawValue);
			return numberToken ? [numberToken] : [missingLabel];
		}
		case "date":
			return rawValue ? [stringifyUnknown(rawValue)] : [missingLabel];
		case "list": {
			const tokens = normalizeUserListValue(rawValue).filter((token) => !/^\[\[/.test(token));
			return tokens.length > 0 ? tokens : [missingLabel];
		}
		case "text":
		default: {
			const textValue = stringifyUnknown(rawValue).trim();
			return textValue ? [textValue] : [missingLabel];
		}
	}
}

export function sortUserFieldGroupKeys(
	groupKeys: readonly string[],
	field: UserFieldDefinition | undefined
): string[] {
	const keys = [...groupKeys];
	if (!field) return keys.sort();

	switch (field.type) {
		case "number":
			return keys.sort((a, b) => {
				const numA = parseFloat(a);
				const numB = parseFloat(b);
				const isNumA = !isNaN(numA);
				const isNumB = !isNaN(numB);
				if (isNumA && isNumB) return numB - numA;
				if (isNumA && !isNumB) return -1;
				if (!isNumA && isNumB) return 1;
				return compareStringsWithMissingLast(a, b);
			});
		case "boolean":
			return keys.sort((a, b) => {
				if (a === "true" && b === "false") return -1;
				if (a === "false" && b === "true") return 1;
				return compareStringsWithMissingLast(a, b);
			});
		case "date":
			return keys.sort((a, b) => {
				const timeA = Date.parse(a);
				const timeB = Date.parse(b);
				const isValidA = !isNaN(timeA);
				const isValidB = !isNaN(timeB);
				if (isValidA && isValidB) return timeA - timeB;
				if (isValidA && !isValidB) return -1;
				if (!isValidA && isValidB) return 1;
				return compareStringsWithMissingLast(a, b);
			});
		case "text":
		case "list":
		default:
			return keys.sort(compareStringsWithMissingLast);
	}
}
