import type { BasesAllOptions, BasesOptions } from "obsidian";
import { readBasesViewConfigValue, type BasesViewConfigReader } from "./basesViewConfig";

function applyOptionDefault(option: BasesOptions, config: BasesViewConfigReader): BasesOptions {
	const value = readBasesViewConfigValue(config, option.key);
	switch (option.type) {
		case "toggle":
			if (typeof value === "boolean") return { ...option, default: value };
			break;
		case "slider":
			if (typeof value === "number" && Number.isFinite(value)) {
				return { ...option, default: value };
			}
			break;
		case "multitext":
			if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
				return { ...option, default: value };
			}
			break;
		default:
			if (typeof value === "string") return { ...option, default: value };
	}
	return option;
}

/** Show legacy settings in the native options panel without writing to the file. */
export function applyBasesViewOptionDefaults(
	options: BasesAllOptions[],
	config: BasesViewConfigReader
): BasesAllOptions[] {
	return options.map((option) =>
		option.type === "group"
			? { ...option, items: option.items.map((item) => applyOptionDefault(item, config)) }
			: applyOptionDefault(option, config)
	);
}
