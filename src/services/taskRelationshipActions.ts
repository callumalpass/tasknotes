import { Notice, TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { generateLink } from "../utils/linkUtils";

function translate(
	plugin: TaskNotesPlugin,
	key: string,
	params?: Record<string, string | number>
): string {
	return plugin.i18n.translate(key, params);
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
		new Notice(translate(plugin, "contextMenus.task.organization.notices.alreadyInProject"));
		return null;
	}

	const sanitizedProjects = currentProjects.filter((entry) => entry !== legacyReference);
	const updatedProjects = [...sanitizedProjects, projectReference];
	const updatedTask = await plugin.updateTaskProperty(task, "projects", updatedProjects);

	new Notice(
		translate(plugin, "contextMenus.task.organization.notices.addedToProject", {
			project: projectFile.basename,
		})
	);
	return updatedTask;
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
		new Notice(translate(plugin, "contextMenus.task.organization.notices.alreadySubtask"));
		return null;
	}

	const sanitizedProjects = subtaskProjects.filter((entry) => entry !== legacyReference);
	const updatedProjects = [...sanitizedProjects, projectReference];
	const updatedSubtask = await plugin.updateTaskProperty(subtask, "projects", updatedProjects);

	new Notice(
		translate(plugin, "contextMenus.task.organization.notices.addedAsSubtask", {
			subtask: subtask.title,
			parent: parentFile.basename,
		})
	);
	return updatedSubtask;
}
