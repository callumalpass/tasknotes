import type TaskNotesPlugin from "../../main";
import type { TaskInfo } from "../../types";

export interface CliTaskLookupInput {
	path?: string;
	title?: string;
	query?: string;
}

function normalizeLookupValue(value?: string): string | undefined {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function formatAmbiguousTaskMatches(tasks: TaskInfo[]): string {
	return tasks
		.slice(0, 5)
		.map((task) => `${task.title} (${task.path})`)
		.join(", ");
}

export async function resolveTaskForCli(
	plugin: TaskNotesPlugin,
	input: CliTaskLookupInput
): Promise<TaskInfo> {
	const path = normalizeLookupValue(input.path);
	const title = normalizeLookupValue(input.title);
	const query = normalizeLookupValue(input.query);

	if (path) {
		const task = await plugin.cacheManager.getTaskInfo(path);
		if (!task) {
			throw new Error(`Task not found for path: ${path}`);
		}

		return task;
	}

	const allTasks = await plugin.cacheManager.getAllTasks();

	if (title) {
		const exactMatches = allTasks.filter((task) => task.title === title);
		if (exactMatches.length === 1) {
			return exactMatches[0];
		}

		if (exactMatches.length > 1) {
			throw new Error(
				`Multiple tasks matched title "${title}": ${formatAmbiguousTaskMatches(exactMatches)}`
			);
		}

		throw new Error(`Task not found for title: ${title}`);
	}

	if (query) {
		const loweredQuery = query.toLowerCase();
		const matches = allTasks.filter((task) => {
			return (
				task.title.toLowerCase().includes(loweredQuery) ||
				task.path.toLowerCase().includes(loweredQuery)
			);
		});

		if (matches.length === 1) {
			return matches[0];
		}

		if (matches.length > 1) {
			throw new Error(
				`Multiple tasks matched query "${query}": ${formatAmbiguousTaskMatches(matches)}`
			);
		}

		throw new Error(`Task not found for query: ${query}`);
	}

	throw new Error("A task reference is required: pass path, title, or query");
}
