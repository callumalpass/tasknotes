import type { RenderContext, Value } from "obsidian";

export interface TaskCardPresentationOptions {
	propertyLabels?: Record<string, string>;
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
	return value === null || (value as { constructor?: { name?: string } } | undefined)?.constructor?.name === "NullValue";
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
			const linkPath = String(v.data);
			if (!linkPath.match(/^[a-z]+:\/\//i)) {
				const display = "display" in v && v.display ? String(v.display) : null;
				if (display && display !== linkPath) {
					return `[[${linkPath}|${display}]]`;
				}
				return `[[${linkPath}]]`;
			}
			const display = "display" in v && v.display ? String(v.display) : null;
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
		return v.icon ? String(v.icon).replace("lucide-", "") : "";
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
