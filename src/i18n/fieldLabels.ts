import { msg } from "@lingui/core/macro";
import { uiText } from "./runtime";
import type { FieldGroupConfig, ModalFieldConfig } from "../types/settings";

// Persist English seeds unchanged; recover the original authored message IDs.
const groups = {
	basic: { english: "Basic Information", descriptor: msg({ message: "Basic Information", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	metadata: { english: "Metadata", descriptor: msg({ message: "Metadata", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	organization: { english: "Organization", descriptor: msg({ message: "Organization", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	dependencies: { english: "Dependencies", descriptor: msg({ message: "Dependencies", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	custom: { english: "Custom Fields", descriptor: msg({ message: "Custom Fields", context: "utils/fieldConfigDefaults: defaults displayName" }) },
};
const fields = {
	title: { english: "Title", descriptor: msg({ message: "Title", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	details: { english: "Details", descriptor: msg({ message: "Details", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	contexts: { english: "Contexts", descriptor: msg({ message: "Contexts", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	tags: { english: "Tags", descriptor: msg({ message: "Tags", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	"time-estimate": { english: "Time Estimate", descriptor: msg({ message: "Time Estimate", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	projects: { english: "Projects", descriptor: msg({ message: "Projects", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	subtasks: { english: "Subtasks", descriptor: msg({ message: "Subtasks", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	"blocked-by": { english: "Blocked By", descriptor: msg({ message: "Blocked By", context: "utils/fieldConfigDefaults: defaults displayName" }) },
	blocking: { english: "Blocking", descriptor: msg({ message: "Blocking", context: "utils/fieldConfigDefaults: defaults displayName" }) },
};
export function fieldGroupLabel(group: FieldGroupConfig): string {
	const seed = Object.prototype.hasOwnProperty.call(groups, group.id) ? groups[group.id] : undefined;
	return seed && group.displayName === seed.english ? uiText(seed.descriptor) : group.displayName;
}
export function fieldLabel(field: ModalFieldConfig): string {
	const seed = field.fieldType !== "user" && Object.prototype.hasOwnProperty.call(fields, field.id) ? fields[field.id as keyof typeof fields] : undefined;
	return seed && field.displayName === seed.english ? uiText(seed.descriptor) : field.displayName;
}
