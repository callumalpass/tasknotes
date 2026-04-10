export interface TaskCardPresentationOptions {
	propertyLabels?: Record<string, string>;
}

/**
 * Extract raw value from a Bases Value object.
 * Bases API may return objects like {icon: "...", data: ...} or {icon: "...", link: "..."}
 * instead of raw primitive values. This function extracts the actual value.
 *
 * For link values (icon: "lucide-link"), Bases strips the [[]] from wikilinks,
 * so we need to restore them to ensure proper rendering.
 */
export function extractBasesValue(value: unknown): unknown {
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
