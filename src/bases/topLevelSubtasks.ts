import type { TFile } from "obsidian";
import type { TaskInfo } from "../types";
import { parseLinkToPath } from "../utils/linkUtils";

export type TaskProjectLinkResolver = (
	linkPath: string,
	sourcePath: string
) => Pick<TFile, "path"> | null | undefined;

function isLinkLikeProjectValue(project: string, linkPath: string): boolean {
	return linkPath !== project || project.trim().startsWith("[[");
}

export function taskLinksToTaskInSet(
	task: TaskInfo,
	taskPaths: ReadonlySet<string>,
	resolveProjectLink: TaskProjectLinkResolver
): boolean {
	if (!Array.isArray(task.projects) || task.projects.length === 0) {
		return false;
	}

	for (const project of task.projects) {
		if (typeof project !== "string" || project.trim().length === 0) {
			continue;
		}

		const linkPath = parseLinkToPath(project);
		if (!isLinkLikeProjectValue(project, linkPath)) {
			continue;
		}

		const resolvedFile = resolveProjectLink(linkPath, task.path);
		if (resolvedFile?.path && taskPaths.has(resolvedFile.path)) {
			return true;
		}
	}

	return false;
}

export function filterTopLevelSubtasks(
	tasks: readonly TaskInfo[],
	resolveProjectLink: TaskProjectLinkResolver
): TaskInfo[] {
	const taskPaths = new Set(tasks.map((task) => task.path));

	return tasks.filter((task) => !taskLinksToTaskInSet(task, taskPaths, resolveProjectLink));
}
