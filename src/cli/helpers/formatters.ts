import type { TaskInfo } from "../../types";

export function formatCliJson(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

export function formatTaskSummary(
	task: Pick<TaskInfo, "title" | "path" | "status" | "priority">
): Record<string, string> {
	return {
		title: task.title,
		path: task.path,
		status: task.status,
		priority: task.priority,
	};
}
