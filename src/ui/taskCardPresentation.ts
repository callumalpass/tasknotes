import type { RenderContext, Value } from "obsidian";
import { stringifyUnknown } from "../utils/stringUtils";

export interface TaskCardPresentationOptions {
	propertyLabels?: Record<string, string>;
}

const NULLISH_DISPLAY_STRINGS = new Set(["null", "undefined"]);

function isNullishDisplayString(value: string): boolean {
	return NULLISH_DISPLAY_STRINGS.has(value.trim().toLowerCase());
}

export function isBasesValue(value: unknown): value is Value {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { renderTo?: unknown }).renderTo === "function" &&
		typeof (value as { toString?: unknown }).toString === "function"
	);
}

export function isNullBasesValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return true;
	}

	const basesValue = value as { constructor?: { name?: string }; toString?: () => string };
	if (basesValue.constructor?.name === "NullValue") {
		return true;
	}

	return isBasesValue(value) && isNullishDisplayString(value.toString());
}

export function isEmptyCardDisplayValue(value: unknown): boolean {
	if (isNullBasesValue(value)) {
		return true;
	}

	if (Array.isArray(value)) {
		return value.every(isEmptyCardDisplayValue);
	}

	if (typeof value === "string") {
		return value.trim() === "" || isNullishDisplayString(value);
	}

	if (isBasesValue(value)) {
		return value.toString().trim() === "";
	}

	return false;
}

export function renderBasesValue(
	container: HTMLElement,
	value: unknown,
	renderContext: RenderContext
): boolean {
	if (!isBasesValue(value) || isNullBasesValue(value)) {
		return false;
	}

	try {
		value.renderTo(container, renderContext);
		if (!container.hasChildNodes() && !container.textContent) {
			container.textContent = value.toString();
		}
	} catch (error) {
		console.debug("[TaskNotes] Error rendering Bases value:", error);
		container.textContent = value.toString();
	}

	return true;
}

/**
 * Normalize older Bases-like wrapper objects. Official Bases Value instances are
 * returned intact so TaskCard can render them with Value.renderTo().
 */
export function extractBasesValue(value: unknown): unknown {
	if (isNullBasesValue(value)) {
		return "";
	}

	if (isBasesValue(value)) {
		return value;
	}

	if (value && typeof value === "object" && "icon" in value) {
		const v = value as Record<string, unknown>;

		if (v.icon === "lucide-link" && "data" in v && v.data !== null && v.data !== undefined) {
			const linkPath = stringifyUnknown(v.data);
			if (!linkPath.match(/^[a-z]+:\/\//i)) {
				const display = "display" in v && v.display ? stringifyUnknown(v.display) : null;
				if (display && display !== linkPath) {
					return `[[${linkPath}|${display}]]`;
				}
				return `[[${linkPath}]]`;
			}
			const display = "display" in v && v.display ? stringifyUnknown(v.display) : null;
			if (display) {
				return `[${display}](${linkPath})`;
			}
			return linkPath;
		}

		if ("display" in v && v.display !== null && v.display !== undefined) {
			return v.display;
		}
		if ("date" in v && v.date !== null && v.date !== undefined) {
			return v.date;
		}
		if ("data" in v && v.data !== null && v.data !== undefined) {
			return v.data;
		}
		if (v.icon === "lucide-file-question" || v.icon === "lucide-help-circle") {
			return "";
		}
		return v.icon ? stringifyUnknown(v.icon).replace("lucide-", "") : "";
	}
	return value;
}

export function resolveTaskCardPropertyLabel(
	propertyId: string,
	options: TaskCardPresentationOptions = {},
	fallbackLabel?: string
): string {
	const override = options.propertyLabels?.[propertyId];
	if (override && override.trim() !== "") {
		return override;
	}
	if (fallbackLabel && fallbackLabel.trim() !== "") {
		return fallbackLabel;
	}
	if (propertyId.startsWith("formula.")) {
		return propertyId.substring(8);
	}
	return propertyId.charAt(0).toUpperCase() + propertyId.slice(1);
}
