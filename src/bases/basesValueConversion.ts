import { NONE_GROUP_KEY, TRUE_GROUP_KEY, FALSE_GROUP_KEY } from "./groupKeys";
import { isBasesEmptyPlaceholderValue } from "./basesValueKinds";
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
		return NONE_GROUP_KEY;
	}

	const basesKey = key as BasesValueInternals;
	if (basesKey.constructor?.name === "NullValue") {
		return NONE_GROUP_KEY;
	}

	if (isBasesEmptyPlaceholderValue(basesKey)) {
		return NONE_GROUP_KEY;
	}

	const actualValue = extractBasesGroupKeyValue(basesKey);
	return formatBasesGroupKeyValue(actualValue);
}

const LINK_MARKUP = /^(?:\[\[[^\]]+\]\]|\[[^\]]*\]\([^)]+\))$/;

function basesLinkMarkup(value: unknown): string | null {
	if (value === null || typeof value !== "object") return null;
	const data = (value as BasesValueInternals).data;
	if (typeof data !== "string") return null;
	const toString = Reflect.get(value, "toString");
	if (typeof toString !== "function" || toString === Object.prototype.toString) return null;
	const markup: unknown = Reflect.apply(toString, value, []);
	return typeof markup === "string" && markup !== data && LINK_MARKUP.test(markup) ? markup : null;
}

/**
 * Link markup for a Bases group key whose value is a link or a list of links.
 * Group key strings drop link syntax ("[[Project]]" becomes "Project"), so headers use
 * this to keep rendering links without resolving every bare name as a note.
 */
export function convertBasesGroupKeyToLinkTitle(key: unknown): string | null {
	const single = basesLinkMarkup(key);
	if (single) return single;
	if (key === null || typeof key !== "object") return null;

	const basesKey = key as BasesValueInternals;
	const getListItem =
		typeof basesKey.get === "function"
			? basesKey.get.bind(basesKey)
			: typeof basesKey.at === "function"
				? basesKey.at.bind(basesKey)
				: null;
	if (typeof basesKey.length !== "function" || !getListItem) return null;

	const links: string[] = [];
	for (let i = 0; i < basesKey.length(); i++) {
		const markup = basesLinkMarkup(getListItem(i));
		if (!markup) return null;
		links.push(markup);
	}
	return links.length > 0 ? links.join(", ") : null;
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
		return NONE_GROUP_KEY;
	}

	if (actualValue instanceof Date) {
		const year = actualValue.getFullYear();
		const month = String(actualValue.getMonth() + 1).padStart(2, "0");
		const day = String(actualValue.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	if (typeof actualValue === "string") {
		return actualValue || NONE_GROUP_KEY;
	}
	if (typeof actualValue === "number") return String(actualValue);
	if (typeof actualValue === "boolean") return actualValue ? TRUE_GROUP_KEY : FALSE_GROUP_KEY;
	if (Array.isArray(actualValue)) {
		return actualValue.length > 0
			? actualValue.map(stringifyUnknown).join(", ")
			: NONE_GROUP_KEY;
	}

	return stringifyUnknown(actualValue) || NONE_GROUP_KEY;
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
