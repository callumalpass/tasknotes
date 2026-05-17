import type { TaskInfo } from "../types";
import type { HideIdentifyingTagsMode } from "../types/settings";
import {
	filterTaskIdentificationTags,
	isTaskIdentificationTag,
	normalizeTagName,
} from "./taskTagFiltering";

export interface TaskTagListSettings {
	taskIdentificationMethod: string;
	taskTag: string;
	hideIdentifyingTagsMode?: HideIdentifyingTagsMode;
}

export function normalizeTaskTagList(tags: readonly string[] | undefined): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const tag of tags ?? []) {
		if (typeof tag !== "string") continue;
		const value = normalizeTagName(tag);
		if (!value || seen.has(value)) continue;
		seen.add(value);
		normalized.push(value);
	}

	return normalized;
}

export function parseTaskTagInput(input: string | null | undefined): string[] {
	if (!input || typeof input !== "string") {
		return [];
	}

	return normalizeTaskTagList(input.split(","));
}

export function getEditableTaskTags(
	task: Pick<TaskInfo, "tags">,
	settings: TaskTagListSettings
): string[] {
	const tags = normalizeTaskTagList(task.tags);
	if (settings.taskIdentificationMethod !== "tag") {
		return tags;
	}

	return filterTaskIdentificationTags(tags, settings.taskTag, settings.hideIdentifyingTagsMode);
}

export function addTagsToList(
	tags: readonly string[] | undefined,
	tagsToAdd: readonly string[]
): string[] | undefined {
	const current = normalizeTaskTagList(tags);
	const seen = new Set(current);

	for (const tag of tagsToAdd) {
		const value = normalizeTagName(tag);
		if (!value || seen.has(value)) continue;
		seen.add(value);
		current.push(value);
	}

	return current.length > 0 ? current : undefined;
}

export function removeTagsFromList(
	tags: readonly string[] | undefined,
	tagsToRemove: readonly string[]
): string[] | undefined {
	const removeSet = new Set(parseTaskTagInput(tagsToRemove.join(",")));
	if (removeSet.size === 0) {
		const current = normalizeTaskTagList(tags);
		return current.length > 0 ? current : undefined;
	}

	const remaining = normalizeTaskTagList(tags).filter((tag) => !removeSet.has(tag));
	return remaining.length > 0 ? remaining : undefined;
}

export function clearEditableTagsFromList(
	tags: readonly string[] | undefined,
	settings: TaskTagListSettings
): string[] | undefined {
	const current = normalizeTaskTagList(tags);
	if (settings.taskIdentificationMethod !== "tag") {
		return undefined;
	}

	const remaining = current.filter((tag) =>
		isTaskIdentificationTag(tag, settings.taskTag, settings.hideIdentifyingTagsMode)
	);
	return remaining.length > 0 ? remaining : undefined;
}
