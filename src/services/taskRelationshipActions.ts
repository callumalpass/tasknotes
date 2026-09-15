import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { generateLink, parseLinkToPath } from "../utils/linkUtils";
import { filterTaskIdentificationTags } from "../utils/taskTagFiltering";
import { publishUserNotice } from "../core/userNotices";

function translate(
	plugin: TaskNotesPlugin,
	key: string,
	params?: Record<string, string | number>
): string {
	return plugin.i18n.translate(key, params);
}

function uniqueNonEmptyStrings(values: string[]): string[] {
	const seen = new Set<string>();
	const uniqueValues: string[] = [];

	for (const value of values) {
		const trimmedValue = value.trim();
		if (!trimmedValue || seen.has(trimmedValue)) {
			continue;
		}

		seen.add(trimmedValue);
		uniqueValues.push(trimmedValue);
	}

	return uniqueValues;
}

function buildStableFileLink(
	plugin: TaskNotesPlugin,
	file: TFile,
	sourcePath: string
): string {
	return generateLink(
		plugin.app,
		file,
		sourcePath,
		"",
		"",
		plugin.settings.useFrontmatterMarkdownLinks
	);
}

function resolveProjectReference(
	plugin: TaskNotesPlugin,
	projectReference: string,
	sourcePath: string
): string {
	const trimmedReference = projectReference.trim();
	if (!trimmedReference) {
		return "";
	}

	const linkPath = parseLinkToPath(trimmedReference);
	const resolvedFile = plugin.app.metadataCache.getFirstLinkpathDest?.(linkPath, sourcePath);
	if (resolvedFile instanceof TFile) {
		return buildStableFileLink(plugin, resolvedFile, sourcePath);
	}

	return trimmedReference;
}

function projectReferenceMatchesFile(
	plugin: TaskNotesPlugin,
	projectReference: string,
	projectFile: TFile,
	sourcePath: string
): boolean {
	const stableReference = buildStableFileLink(plugin, projectFile, sourcePath);
	if (resolveProjectReference(plugin, projectReference, sourcePath) === stableReference) {
		return true;
	}

	const unresolvedPath = parseLinkToPath(projectReference.trim()).replace(/\.md$/i, "");
	if (unresolvedPath.includes("/")) {
		return false;
	}
	const unresolvedBasename = unresolvedPath.split("/").pop();
	return unresolvedBasename === projectFile.basename;
}

export async function addTaskToProject(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	projectFile: TFile
): Promise<TaskInfo | null> {
	const projectReference = generateLink(
		plugin.app,
		projectFile,
		task.path,
		"",
		"",
		plugin.settings.useFrontmatterMarkdownLinks
	);
	const legacyReference = `[[${projectFile.basename}]]`;
	const currentProjects = Array.isArray(task.projects) ? task.projects : [];

	if (currentProjects.includes(projectReference) || currentProjects.includes(legacyReference)) {
		publishUserNotice(
			plugin.emitter,
			translate(plugin, "contextMenus.task.organization.notices.alreadyInProject")
		);
		return null;
	}

	const sanitizedProjects = currentProjects.filter((entry) => entry !== legacyReference);
	const updatedProjects = [...sanitizedProjects, projectReference];
	const updatedTask = await plugin.updateTaskProperty(task, "projects", updatedProjects);

	publishUserNotice(
		plugin.emitter,
		translate(plugin, "contextMenus.task.organization.notices.addedToProject", {
			project: projectFile.basename,
		})
	);
	return updatedTask;
}

export function getTaskProjectFiles(
	plugin: TaskNotesPlugin,
	tasks: TaskInfo[]
): TFile[] {
	const filesByPath = new Map<string, TFile>();
	for (const task of tasks) {
		for (const project of task.projects ?? []) {
			const linkPath = parseLinkToPath(project.trim());
			const file = plugin.app.metadataCache.getFirstLinkpathDest?.(linkPath, task.path);
			if (file instanceof TFile) {
				filesByPath.set(file.path, file);
			}
		}
	}
	return [...filesByPath.values()].sort((left, right) =>
		left.basename.localeCompare(right.basename)
	);
}

export async function removeTaskFromProject(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	projectFile: TFile
): Promise<TaskInfo | null> {
	const currentProjects = Array.isArray(task.projects) ? task.projects : [];
	const updatedProjects = currentProjects.filter(
		(entry) => !projectReferenceMatchesFile(plugin, entry, projectFile, task.path)
	);
	if (updatedProjects.length === currentProjects.length) {
		return null;
	}
	return plugin.updateTaskProperty(task, "projects", updatedProjects);
}

export async function assignTaskAsSubtask(
	plugin: TaskNotesPlugin,
	parentFile: TFile,
	subtask: TaskInfo
): Promise<TaskInfo | null> {
	const projectReference = generateLink(
		plugin.app,
		parentFile,
		subtask.path,
		"",
		"",
		plugin.settings.useFrontmatterMarkdownLinks
	);
	const legacyReference = `[[${parentFile.basename}]]`;
	const subtaskProjects = Array.isArray(subtask.projects) ? subtask.projects : [];

	if (subtaskProjects.includes(projectReference) || subtaskProjects.includes(legacyReference)) {
		publishUserNotice(
			plugin.emitter,
			translate(plugin, "contextMenus.task.organization.notices.alreadySubtask")
		);
		return null;
	}

	const sanitizedProjects = subtaskProjects.filter((entry) => entry !== legacyReference);
	const updatedProjects = [...sanitizedProjects, projectReference];
	const updatedSubtask = await plugin.updateTaskProperty(subtask, "projects", updatedProjects);

	publishUserNotice(
		plugin.emitter,
		translate(plugin, "contextMenus.task.organization.notices.addedAsSubtask", {
			subtask: subtask.title,
			parent: parentFile.basename,
		})
	);
	return updatedSubtask;
}

export function buildSubtaskCreationPrePopulatedValues(
	plugin: TaskNotesPlugin,
	parentTask: TaskInfo,
	parentFile: TFile
): Partial<TaskInfo> {
	const shouldInheritParentProperties = Boolean(
		plugin.settings.taskCreationDefaults?.inheritParentTaskProperties
	);
	const projectReference = buildStableFileLink(plugin, parentFile, parentTask.path);
	const parentTags = Array.isArray(parentTask.tags) ? parentTask.tags : [];
	const parentProjects = shouldInheritParentProperties
		? Array.isArray(parentTask.projects)
			? parentTask.projects.map((project) =>
					resolveProjectReference(plugin, project, parentTask.path)
				)
			: []
		: [];
	const inheritedTags =
		shouldInheritParentProperties
			? plugin.settings.taskIdentificationMethod === "tag"
				? filterTaskIdentificationTags(
						parentTags,
						plugin.settings.taskTag,
						plugin.settings.hideIdentifyingTagsMode
					)
				: [...parentTags]
			: [];
	const values: Partial<TaskInfo> = {
		projects: uniqueNonEmptyStrings([...parentProjects, projectReference]),
	};

	if (inheritedTags.length > 0) {
		values.tags = inheritedTags;
	}
	if (
		shouldInheritParentProperties &&
		Array.isArray(parentTask.contexts) &&
		parentTask.contexts.length > 0
	) {
		values.contexts = [...parentTask.contexts];
	}
	if (shouldInheritParentProperties && parentTask.priority) {
		values.priority = parentTask.priority;
	}

	return values;
}
