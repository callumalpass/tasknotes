import { FilterUtils } from "./FilterUtils";

interface TaskTagFilteringSettings {
	taskIdentificationMethod: string;
	taskTag: string;
	hideIdentifyingTagsInCards?: boolean;
}

export function normalizeTagName(tag: string): string {
	const trimmed = tag.trim();
	return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

export function isTaskIdentificationTag(tag: string, taskTag: string): boolean {
	const normalizedTag = normalizeTagName(tag);
	const normalizedTaskTag = normalizeTagName(taskTag);
	return FilterUtils.matchesHierarchicalTagExact(normalizedTag, normalizedTaskTag);
}

export function filterTaskIdentificationTags(tags: readonly string[], taskTag: string): string[] {
	return tags.filter((tag) => !isTaskIdentificationTag(tag, taskTag));
}

export function shouldHideTaskIdentificationTags(settings: TaskTagFilteringSettings): boolean {
	return (
		settings.taskIdentificationMethod === "tag" &&
		Boolean(settings.hideIdentifyingTagsInCards) &&
		Boolean(settings.taskTag)
	);
}

export function filterTagsForTaskModalSuggestions(
	tags: readonly string[],
	settings: TaskTagFilteringSettings
): string[] {
	if (!shouldHideTaskIdentificationTags(settings)) {
		return [...tags];
	}

	return filterTaskIdentificationTags(tags, settings.taskTag);
}

export function appendMissingTaskIdentificationTags(
	tags: readonly string[],
	existingTags: readonly string[],
	taskTag: string
): string[] {
	const nextTags = [...tags];
	const identifyingTags = existingTags
		.filter((tag) => isTaskIdentificationTag(tag, taskTag))
		.map(normalizeTagName);
	const tagsToPreserve = identifyingTags.length > 0 ? identifyingTags : [normalizeTagName(taskTag)];

	for (const tag of tagsToPreserve) {
		if (!tag) continue;
		if (!nextTags.some((existingTag) => normalizeTagName(existingTag) === tag)) {
			nextTags.push(tag);
		}
	}

	return nextTags;
}
