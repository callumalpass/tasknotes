import { App, TFile } from "obsidian";
import type { TaskInfo } from "../types";
import {
	formatTasksForClipboard,
	type ClipboardTask,
	type TaskCopyFormat,
} from "../utils/taskClipboard";
import type { BasesDataItem } from "./helpers";

export type BasesViewAction = {
	name: string;
	icon?: string;
	callback: () => void;
};

type CopyBasesCurrentViewTasksOptions = {
	dataItems: BasesDataItem[];
	format: TaskCopyFormat;
	identifyTaskNotes: (dataItems: BasesDataItem[]) => Promise<TaskInfo[]>;
	filterTasks: (tasks: TaskInfo[]) => TaskInfo[];
	resolveLinkText: (task: ClipboardTask) => string;
	writeText: (text: string) => Promise<void>;
};

export type CopyBasesCurrentViewTasksResult =
	| {
			status: "empty";
	  }
	| {
			status: "copied";
			count: number;
	  };

export function buildBasesTaskCopyActions(
	copyTasks: (format: TaskCopyFormat) => void
): BasesViewAction[] {
	return [
		{
			name: "Copy task filenames",
			icon: "lucide-file-text",
			callback: () => copyTasks("filenames"),
		},
		{
			name: "Copy task links",
			icon: "lucide-link",
			callback: () => copyTasks("markdown-links"),
		},
		{
			name: "Copy task titles",
			icon: "lucide-text",
			callback: () => copyTasks("titles"),
		},
	];
}

export async function copyBasesCurrentViewTasks({
	dataItems,
	format,
	identifyTaskNotes,
	filterTasks,
	resolveLinkText,
	writeText,
}: CopyBasesCurrentViewTasksOptions): Promise<CopyBasesCurrentViewTasksResult> {
	const taskNotes = await identifyTaskNotes(dataItems);
	const filteredTasks = filterTasks(taskNotes);
	const clipboardTasks = filteredTasks.map((task) => ({
		path: task.path,
		title: task.title,
	}));

	if (clipboardTasks.length === 0) {
		return { status: "empty" };
	}

	const text = formatTasksForClipboard(clipboardTasks, format, resolveLinkText);
	await writeText(text);
	return {
		status: "copied",
		count: clipboardTasks.length,
	};
}

export function resolveBasesTaskLinkText(app: App, path: string): string {
	const file = app.vault.getAbstractFileByPath(path);
	if (file instanceof TFile) {
		return app.metadataCache.fileToLinktext(file, "");
	}
	return path;
}
