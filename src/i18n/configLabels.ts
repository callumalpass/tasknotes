import { msg } from "@lingui/core/macro";
import { uiText } from "./runtime";
import type { StatusConfig, PriorityConfig } from "../types";

// Existing English seeds are recognized only by BOTH stable ID/value and exact
// original label. Edited or already-localized user labels pass through untouched.
// Rendering never writes a translated label back into settings.
const seeds = {
	"none": { english: "None", descriptor: msg({ message: "None", context: "settings/defaults: defaults label" }) },
	"open": { english: "Open", descriptor: msg({ message: "Open", context: "settings/defaults: defaults label" }) },
	"in-progress": { english: "In progress", descriptor: msg({ message: "In progress", context: "settings/defaults: defaults label" }) },
	"done": { english: "Done", descriptor: msg({ message: "Done", context: "settings/defaults: defaults label" }) },
	"low": { english: "Low", descriptor: msg({ message: "Low", context: "settings/defaults: defaults label" }) },
	"normal": { english: "Normal", descriptor: msg({ message: "Normal", context: "settings/defaults: defaults label" }) },
	"high": { english: "High", descriptor: msg({ message: "High", context: "settings/defaults: defaults label" }) },
};
export function configLabel(config: StatusConfig | PriorityConfig | undefined): string {
	if (!config) return "";
	if (config.id === config.value && Object.prototype.hasOwnProperty.call(seeds, config.id)) {
		const seed = seeds[config.id as keyof typeof seeds];
		if (config.label === seed.english) return uiText(seed.descriptor);
	}
	return config.label;
}
