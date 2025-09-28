import type { FilterOperator } from "../types";
import type { UserFieldMapping } from "../types/settings";

export type UserFieldType = UserFieldMapping["type"];

const OPERATOR_MAP: Record<UserFieldType, readonly FilterOperator[]> = {
	text: ["is", "is-not", "contains", "does-not-contain", "is-empty", "is-not-empty"],
	number: ["is", "is-not", "is-greater-than", "is-less-than", "is-empty", "is-not-empty"],
	date: [
		"is",
		"is-not",
		"is-before",
		"is-after",
		"is-on-or-before",
		"is-on-or-after",
		"is-empty",
		"is-not-empty",
	],
	boolean: ["is-checked", "is-not-checked"],
	list: ["contains", "does-not-contain", "is-empty", "is-not-empty"],
} as const;

export function getOperatorsForUserField(type: UserFieldType): readonly FilterOperator[] {
	return OPERATOR_MAP[type] || [];
}

export function isOperatorValidForUserField(op: FilterOperator, type: UserFieldType): boolean {
	return getOperatorsForUserField(type).includes(op);
}
