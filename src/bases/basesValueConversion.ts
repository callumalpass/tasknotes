import { stringifyUnknown } from "../utils/stringUtils";

type BasesFileLike = {
	path?: string;
};

type BasesValueInternals = {
	data?: unknown;
	date?: Date;
	display?: unknown;
	file?: BasesFileLike;
	icon?: string;
	label?: unknown;
	value?: unknown;
	get?: (index: number) => unknown;
	at?: (index: number) => unknown;
	length?: () => number;
	toISOString?: () => string;
	constructor?: {
		name?: string;
	};
};

export function convertBasesValueToNative(value: unknown): unknown {
	if (value === null || value === undefined) {
		return null;
	}

	const basesValue = value as BasesValueInternals;
	if (basesValue.constructor?.name === "NullValue") {
		return null;
	}

	if (isBasesEmptyPlaceholderValue(basesValue)) {
		return null;
	}

	if (typeof basesValue.data !== "undefined") {
		return basesValue.data;
	}

	const listValue = convertBasesListValueToNative(basesValue);
	if (listValue) {
		return listValue;
	}

	const scalarValue = extractBasesScalarValue(basesValue);
	if (scalarValue !== undefined) {
		return scalarValue;
	}

	if (basesValue.date instanceof Date) {
		return basesValue.date.toISOString();
	}

	if (basesValue.constructor?.name === "DateValue" && basesValue.toISOString) {
		return basesValue.toISOString();
	}

	if (basesValue.file) {
		return basesValue.file.path;
	}

	const toString = Reflect.get(basesValue, "toString");
	if (typeof toString === "function" && toString !== Object.prototype.toString) {
		const stringValue = Reflect.apply(toString, basesValue, []);
		if (stringValue !== "[object Object]") {
			return stringValue;
		}
	}

	return value;
}

export function convertBasesGroupKeyToString(key: unknown): string {
	if (key === null || key === undefined) {
		return "Unknown";
	}

	const basesKey = key as BasesValueInternals;
	if (basesKey.constructor?.name === "NullValue") {
		return "Unknown";
	}

	if (isBasesEmptyPlaceholderValue(basesKey)) {
		return "None";
	}

	const actualValue = extractBasesGroupKeyValue(basesKey);
	return formatBasesGroupKeyValue(actualValue);
}

export function convertBasesListGroupKeyToString(key: unknown): string {
	if (key === null || key === undefined) {
		return convertBasesGroupKeyToString(key);
	}

	const basesKey = key as BasesValueInternals;
	const actualValue = extractBasesGroupKeyValue(basesKey);
	if (!Array.isArray(actualValue)) {
		return formatBasesGroupKeyValue(actualValue);
	}

	const sortedValues = actualValue.map(stringifyUnknown).sort((left, right) => {
		if (left < right) return -1;
		if (left > right) return 1;
		return 0;
	});
	return sortedValues.length > 0 ? sortedValues.join(", ") : "None";
}

function extractBasesGroupKeyValue(basesKey: BasesValueInternals): unknown {
	if (basesKey.file && typeof basesKey.file === "object") {
		return basesKey.file.path;
	}

	if (basesKey.date instanceof Date) {
		return basesKey.date;
	}

	const listValue = convertBasesListValueToNative(basesKey);
	if (listValue) {
		return listValue;
	}

	if (typeof basesKey.data !== "undefined") {
		return basesKey.data;
	}

	const scalarValue = extractBasesScalarValue(basesKey);
	if (scalarValue !== undefined) {
		return scalarValue;
	}

	return basesKey;
}

function isBasesEmptyPlaceholderValue(value: BasesValueInternals): boolean {
	return (
		value.icon === "lucide-file-question" &&
		typeof value.data === "undefined" &&
		typeof value.display === "undefined" &&
		typeof value.label === "undefined" &&
		!(value.date instanceof Date) &&
		!value.file &&
		!Array.isArray(value.value) &&
		typeof value.get !== "function" &&
		typeof value.at !== "function" &&
		typeof value.length !== "function" &&
		typeof value.toISOString !== "function"
	);
}

function extractBasesScalarValue(value: BasesValueInternals): string | number | boolean | undefined {
	for (const candidate of [value.value, value.display, value.label]) {
		if (
			typeof candidate === "string" ||
			typeof candidate === "number" ||
			typeof candidate === "boolean"
		) {
			return candidate;
		}
	}

	return undefined;
}

function formatBasesGroupKeyValue(actualValue: unknown): string {
	if (actualValue === null || actualValue === undefined) {
		return "None";
	}

	if (actualValue instanceof Date) {
		const year = actualValue.getFullYear();
		const month = String(actualValue.getMonth() + 1).padStart(2, "0");
		const day = String(actualValue.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	if (typeof actualValue === "string") {
		return actualValue || "None";
	}
	if (typeof actualValue === "number") return String(actualValue);
	if (typeof actualValue === "boolean") return actualValue ? "True" : "False";
	if (Array.isArray(actualValue)) {
		return actualValue.length > 0
			? actualValue.map(stringifyUnknown).join(", ")
			: "None";
	}

	return stringifyUnknown(actualValue) || "None";
}

function convertBasesListValueToNative(basesValue: BasesValueInternals): unknown[] | null {
	const getListItem =
		typeof basesValue.get === "function"
			? basesValue.get.bind(basesValue)
			: typeof basesValue.at === "function"
				? basesValue.at.bind(basesValue)
				: null;

	if (typeof basesValue.length === "function" && getListItem) {
		const len = basesValue.length();
		const result = [];
		for (let i = 0; i < len; i++) {
			const item = getListItem(i);
			result.push(convertBasesValueToNative(item));
		}
		return result;
	}

	if (Array.isArray(basesValue.value)) {
		return basesValue.value.map((item) => convertBasesValueToNative(item));
	}

	return null;
}
