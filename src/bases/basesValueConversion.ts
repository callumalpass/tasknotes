import { stringifyUnknown } from "../utils/stringUtils";

type BasesFileLike = {
	path?: string;
};

type BasesValueInternals = {
	data?: unknown;
	date?: Date;
	file?: BasesFileLike;
	value?: unknown[];
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

	if (typeof basesValue.data !== "undefined") {
		return basesValue.data;
	}

	const listValue = convertBasesListValueToNative(basesValue);
	if (listValue) {
		return listValue;
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

	const actualValue = extractBasesGroupKeyValue(basesKey);
	return formatBasesGroupKeyValue(actualValue);
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

	return basesKey;
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
