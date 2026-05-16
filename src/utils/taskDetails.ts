import type { App } from "obsidian";
import { TFile } from "obsidian";

import type { TaskInfo } from "../types";
import { splitFrontmatterAndBody } from "./helpers";

export async function hydrateTaskDetailsFromFile(
	app: App,
	task: TaskInfo
): Promise<TaskInfo> {
	const file = app.vault.getAbstractFileByPath(task.path);
	if (!(file instanceof TFile)) {
		return task;
	}

	const content = await app.vault.read(file);
	const { body } = splitFrontmatterAndBody(content);

	return {
		...task,
		details: body.replace(/\r\n/g, "\n").trimEnd(),
	};
}
