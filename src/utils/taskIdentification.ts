import type { TaskNotesSettings } from "../types/settings";
import { FilterUtils } from "./FilterUtils";

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
		if (!propName || !propValue) return false;

		const frontmatterValue = frontmatter[propName];
		if (frontmatterValue === undefined) return false;

		if (Array.isArray(frontmatterValue)) {
			return frontmatterValue.some((val: unknown) =>
				compareTaskPropertyIdentifierValue(val, propValue)
			);
		}

		return compareTaskPropertyIdentifierValue(frontmatterValue, propValue);
	}

	if (!Array.isArray(frontmatter.tags)) return false;
	return frontmatter.tags.some((tag: unknown) => {
		if (typeof tag !== "string") return false;
		// Obsidian metadata cache prepends "#" to frontmatter tags.
		const cleanTag = tag.startsWith("#") ? tag.slice(1) : tag;
		return FilterUtils.matchesHierarchicalTagExact(cleanTag, settings.taskTag);
	});
}
