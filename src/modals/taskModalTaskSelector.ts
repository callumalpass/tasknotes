import { Notice } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";
import { openTaskSelector } from "./TaskSelectorWithCreateModal";

export type TaskModalTaskSelectorStatus = "opened" | "empty" | "error";

export type TaskModalTaskSelectorOpener = (
	plugin: TaskNotesPlugin,
	tasks: TaskInfo[],
	onChooseTask: (task: TaskInfo | null) => void
) => void;

export interface OpenTaskModalTaskSelectorOptions {
	plugin: TaskNotesPlugin;
	getAllTasks?: () => Promise<readonly TaskInfo[] | null | undefined>;
	getCandidates: (allTasks: readonly TaskInfo[]) => readonly TaskInfo[];
	onSelect: (selected: TaskInfo) => void;
	translate: (key: string) => string;
	noEligibleTasksMessageKey: string;
	openFailedMessageKey: string;
	logOperation: string;
	openSelector?: TaskModalTaskSelectorOpener;
	showNotice?: (message: string) => void;
	logger?: Pick<TaskNotesLogger, "error">;
}

const taskSelectorLogger = createTaskNotesLogger({ tag: "TaskModal/TaskSelector" });

export async function openTaskModalTaskSelector({
	plugin,
	getAllTasks = async () => (await plugin.cacheManager.getAllTasks?.()) ?? [],
	getCandidates,
	onSelect,
	translate,
	noEligibleTasksMessageKey,
	openFailedMessageKey,
	logOperation,
	openSelector = openTaskSelector,
	showNotice = (message) => {
		new Notice(message);
	},
	logger = taskSelectorLogger,
}: OpenTaskModalTaskSelectorOptions): Promise<TaskModalTaskSelectorStatus> {
	try {
		const allTasks = (await getAllTasks()) ?? [];
		const candidates = [...getCandidates(allTasks)];

		if (candidates.length === 0) {
			showNotice(translate(noEligibleTasksMessageKey));
			return "empty";
		}

		openSelector(plugin, candidates, (task) => {
			if (!task) {
				return;
			}
			onSelect(task);
		});
		return "opened";
	} catch (error) {
		logger.error("Failed to open task selector", {
			category: "stale-data",
			operation: logOperation,
			error,
		});
		showNotice(translate(openFailedMessageKey));
		return "error";
	}
}
