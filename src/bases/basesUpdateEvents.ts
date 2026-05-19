import type { TaskInfo } from "../types";

type TaskUpdateEventData = {
	path?: string;
	originalTask?: TaskInfo;
	updatedTask?: TaskInfo;
	task?: TaskInfo;
	taskInfo?: TaskInfo;
};

type TaskDeletedEventData = {
	path?: string;
	deletedTask?: Pick<TaskInfo, "path" | "projects">;
	prevCache?: {
		frontmatter?: Record<string, unknown>;
	};
};

export type BasesTaskUpdatePlan =
	| {
			action: "ignore";
	  }
	| {
			action: "refresh-view";
	  }
	| {
			action: "handle-task";
			task: TaskInfo;
	  }
	| {
			action: "refresh-renamed-task";
			removePath: string;
			addPath: string;
	  };

export type BasesTaskDeletionPlan = {
	deletedPath?: string;
	shouldRefresh: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function planBasesTaskUpdatedEvent(
	eventData: unknown,
	relevantPaths: ReadonlySet<string>
): BasesTaskUpdatePlan {
	const taskEvent: TaskUpdateEventData = isRecord(eventData) ? eventData : {};
	const updatedTask = taskEvent.updatedTask ?? taskEvent.task ?? taskEvent.taskInfo;
	if (!updatedTask?.path) {
		return { action: "ignore" };
	}

	const updatedPath = updatedTask.path;
	const originalPath =
		taskEvent.originalTask?.path ??
		(typeof taskEvent.path === "string" ? taskEvent.path : undefined);
	const isRelevant =
		relevantPaths.has(updatedPath) ||
		(originalPath ? relevantPaths.has(originalPath) : false);

	if (!isRelevant) {
		if (shouldRefreshForUntrackedTaskChange(taskEvent)) {
			return { action: "refresh-view" };
		}
		return { action: "ignore" };
	}

	if (originalPath && originalPath !== updatedPath) {
		return {
			action: "refresh-renamed-task",
			removePath: originalPath,
			addPath: updatedPath,
		};
	}

	return {
		action: "handle-task",
		task: updatedTask,
	};
}

function shouldRefreshForUntrackedTaskChange(taskEvent: TaskUpdateEventData): boolean {
	if (taskEvent.originalTask) {
		return true;
	}

	const hasMetadataCacheAliases = taskEvent.task !== undefined || taskEvent.taskInfo !== undefined;
	return !hasMetadataCacheAliases;
}

export function planBasesTaskDeletedEvent(
	eventData: unknown,
	options: {
		projectsField: string;
		renderedTaskPaths: ReadonlySet<string>;
	}
): BasesTaskDeletionPlan {
	const taskEvent: TaskDeletedEventData = isRecord(eventData) ? eventData : {};
	const deletedPath =
		typeof taskEvent.path === "string" ? taskEvent.path : taskEvent.deletedTask?.path;
	const deletedTaskWasRendered =
		typeof deletedPath === "string" && options.renderedTaskPaths.has(deletedPath);
	const deletedTaskHadProjects =
		(taskEvent.deletedTask?.projects?.length ?? 0) > 0 ||
		deletedCacheHasProjects(taskEvent.prevCache, options.projectsField);

	return {
		deletedPath,
		shouldRefresh: deletedTaskWasRendered || deletedTaskHadProjects,
	};
}

export function getRenderedTaskPaths(rootElement: ParentNode | null): Set<string> {
	const paths = new Set<string>();
	if (!rootElement) {
		return paths;
	}

	const cards = rootElement.querySelectorAll<HTMLElement>(".task-card[data-task-path]");
	for (const card of Array.from(cards)) {
		if (card.dataset.taskPath) {
			paths.add(card.dataset.taskPath);
		}
	}
	return paths;
}

function deletedCacheHasProjects(
	prevCache: TaskDeletedEventData["prevCache"],
	projectsField: string
): boolean {
	const frontmatter = prevCache?.frontmatter;
	if (!frontmatter) {
		return false;
	}

	const projects = frontmatter[projectsField];
	if (Array.isArray(projects)) {
		return projects.length > 0;
	}
	return typeof projects === "string" && projects.trim().length > 0;
}
