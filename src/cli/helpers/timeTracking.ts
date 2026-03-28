import type TaskNotesPlugin from "../../main";
import type { TaskInfo } from "../../types";

function getLatestActiveEntry(task: TaskInfo) {
	return pluginGetActiveSession(task);
}

function pluginGetActiveSession(task: TaskInfo) {
	return task.timeEntries?.find((entry) => !entry.endTime) ?? null;
}

export async function startTimeTrackingForTask(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	description?: string
): Promise<TaskInfo> {
	let updatedTask = await plugin.taskService.startTimeTracking(task);

	const trimmedDescription = description?.trim();
	if (trimmedDescription && updatedTask.timeEntries && updatedTask.timeEntries.length > 0) {
		const latestEntry = updatedTask.timeEntries[updatedTask.timeEntries.length - 1];
		if (latestEntry && !latestEntry.endTime) {
			latestEntry.description = trimmedDescription;
			updatedTask = await plugin.taskService.updateTask(updatedTask, {
				timeEntries: updatedTask.timeEntries,
			});
		}
	}

	return updatedTask;
}

export async function resolveTaskForStopTimeTracking(
	plugin: TaskNotesPlugin,
	resolveExplicitTask: () => Promise<TaskInfo | null>
): Promise<TaskInfo> {
	const explicitTask = await resolveExplicitTask();
	if (explicitTask) {
		return explicitTask;
	}

	const allTasks = await plugin.cacheManager.getAllTasks();
	const activeTasks = allTasks.filter((task) => !!getLatestActiveEntry(task));

	if (activeTasks.length === 1) {
		return activeTasks[0];
	}

	if (activeTasks.length > 1) {
		throw new Error(
			"Multiple tasks have active time tracking; pass path, title, or query"
		);
	}

	throw new Error("No active time tracking session found");
}

export function formatTimeTrackingResult(task: TaskInfo): Record<string, unknown> {
	const activeEntry = pluginGetActiveSession(task);

	return {
		title: task.title,
		path: task.path,
		status: task.status,
		priority: task.priority,
		activeTimeEntry: activeEntry
			? {
					startTime: activeEntry.startTime,
					description: activeEntry.description,
				}
			: null,
		totalTimeEntries: task.timeEntries?.length ?? 0,
	};
}
