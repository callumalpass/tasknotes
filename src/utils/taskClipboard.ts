export type TaskCopyFormat = "filenames" | "markdown-links" | "titles" | "paths";

export interface ClipboardTask {
	path: string;
	title?: string;
}

export function formatTasksForClipboard(
	tasks: ClipboardTask[],
	format: TaskCopyFormat,
	resolveLinkText: (task: ClipboardTask) => string = (task) => task.path
): string {
	return tasks
		.map((task) => {
			switch (format) {
				case "filenames":
					return getTaskFilename(task.path);
				case "markdown-links":
					return `[[${resolveLinkText(task)}]]`;
				case "titles":
					return task.title || getTaskFilename(task.path);
				case "paths":
					return task.path;
			}
		})
		.join("\n");
}

export function getTaskFilename(path: string): string {
	const filename = path.split("/").pop() || path;
	return filename.replace(/\.md$/i, "");
}
