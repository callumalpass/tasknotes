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

// A frontmatter value counts as "present" only when it holds a real value:
// non-empty/non-whitespace string, non-empty array, or any non-null scalar.
// Mirrors the Bases filter (`prop != "" && prop != null`) so an empty `status:`
// is not treated as a task when identifying by key-existence alone.
function hasNonEmptyValue(value: unknown): boolean {
	if (value === undefined || value === null) {
		return false;
	}
	if (typeof value === "string") {
		return value.trim().length > 0;
	}
	if (Array.isArray(value)) {
		return value.some((item) => hasNonEmptyValue(item));
	}
	return true;
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
		if (!propName) return false;

		const frontmatterValue = frontmatter[propName];

		// Empty configured value means "match any value": the note is a task as
		// long as the property key exists with a non-empty value, regardless of
		// what that value is (e.g. identify by `status` alone).
		if (propValue.trim().length === 0) {
			return hasNonEmptyValue(frontmatterValue);
		}

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
