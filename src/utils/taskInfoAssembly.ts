import type { TaskInfo } from "../types";
import { calculateTotalTimeSpent } from "./helpers";

export interface BuildTaskInfoFromMappedTaskInput {
	path: string;
	mappedTask: Partial<TaskInfo>;
	defaultTaskStatus: string;
	isBlocked: boolean;
	blockingTasks: string[];
}

export function buildTaskInfoFromMappedTask({
	path,
	mappedTask,
	defaultTaskStatus,
	isBlocked,
	blockingTasks,
}: BuildTaskInfoFromMappedTaskInput): TaskInfo {
	const totalTrackedTime = mappedTask.timeEntries
		? calculateTotalTimeSpent(mappedTask.timeEntries)
		: 0;

	return {
		...mappedTask,
		id: path,
		path,
		title: mappedTask.title || "Untitled task",
		status: mappedTask.status || defaultTaskStatus,
		priority: mappedTask.priority || "normal",
		archived: mappedTask.archived || false,
		tags: Array.isArray(mappedTask.tags) ? mappedTask.tags : [],
		contexts: Array.isArray(mappedTask.contexts) ? mappedTask.contexts : [],
		projects: Array.isArray(mappedTask.projects) ? mappedTask.projects : [],
		totalTrackedTime,
		isBlocked,
		isBlocking: blockingTasks.length > 0,
		blocking: blockingTasks.length > 0 ? blockingTasks : undefined,
	};
}
