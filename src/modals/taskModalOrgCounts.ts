import type TaskNotesPlugin from "../main";

export interface TaskModalCompletionCount {
	completed: number;
	total: number;
}

export function parseTaskModalCommaList(value: string): string[] {
	if (!value.trim()) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export function formatTaskModalCommaList(values: readonly string[]): string {
	return values.join(", ");
}

export function countTaskModalCompletion(
	plugin: TaskNotesPlugin,
	paths: readonly (string | undefined)[]
): TaskModalCompletionCount {
	let completed = 0;
	// Every entry counts toward the total, including unresolved dependencies
	// that have no linked path, so this matches the number of items actually
	// rendered in the list.
	const total = paths.length;

	for (const path of paths) {
		if (!path) continue;

		const taskInfo = plugin.cacheManager.getCachedTaskInfoSync(path);
		if (!taskInfo) continue;

		if (plugin.statusManager.isCompletedStatus(taskInfo.status)) {
			completed++;
		}
	}

	return { completed, total };
}

export function formatTaskModalCompletionCount(
	translate: (key: string, params?: Record<string, string | number>) => string,
	completed: number,
	total: number
): string {
	return translate("modals.task.organization.completionCount", {
		completed,
		total,
	});
}
