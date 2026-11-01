import type { TaskNotesSettings } from "../types/settings";
import { FilterUtils } from "./FilterUtils";
import { getFrontmatterTags } from "./taskIdentificationFrontmatter";

export type TaskIdentificationSettings = Pick<
	TaskNotesSettings,
	"taskIdentificationMethod" | "taskPropertyName" | "taskPropertyValue" | "taskTag"
>;

function isFrontmatterRecord(frontmatter: unknown): frontmatter is Record<string, unknown> {
	return Boolean(frontmatter) && typeof frontmatter === "object" && !Array.isArray(frontmatter);
}

export function compareTaskPropertyIdentifierValue(
	frontmatterValue: unknown,
	settingValue: string
): boolean {
	// Handle boolean frontmatter values compared to string settings (e.g., true vs "true").
	if (typeof frontmatterValue === "boolean") {
		const lower = settingValue.toLowerCase();
		if (lower === "true" || lower === "false") {
			return frontmatterValue === (lower === "true");
		}
	}

	return frontmatterValue === settingValue;
}

/**
 * Property identification needs a property name. Without a value, a note is a task
 * whenever it has the property, whatever its value (including empty or null). This is
 * the same rule as mdbase `exists: true` and Bases `file.hasProperty()`.
 */
export function hasUsablePropertyTaskIdentification(settings: TaskIdentificationSettings): boolean {
	return Boolean(settings.taskPropertyName?.trim());
}

export function isPropertyPresenceTaskIdentification(
	settings: Pick<TaskIdentificationSettings, "taskPropertyValue">
): boolean {
	return !settings.taskPropertyValue?.trim();
}

export function isTaskFrontmatter(
	frontmatter: unknown,
	settings: TaskIdentificationSettings
): boolean {
	if (!isFrontmatterRecord(frontmatter)) {
		return false;
	}

	if (settings.taskIdentificationMethod === "property") {
		const propName = settings.taskPropertyName;
		const propValue = settings.taskPropertyValue;
		if (!hasUsablePropertyTaskIdentification(settings)) return false;
		if (isPropertyPresenceTaskIdentification(settings)) {
			return Object.prototype.hasOwnProperty.call(frontmatter, propName);
		}

		const frontmatterValue = frontmatter[propName];
		if (frontmatterValue === undefined) return false;

		if (Array.isArray(frontmatterValue)) {
			return frontmatterValue.some((val: unknown) =>
				compareTaskPropertyIdentifierValue(val, propValue)
			);
		}

		return compareTaskPropertyIdentifierValue(frontmatterValue, propValue);
	}

	const tags = getFrontmatterTags(frontmatter.tags);
	return tags.some((tag) => {
		return FilterUtils.matchesHierarchicalTagExact(tag, settings.taskTag);
	});
}
