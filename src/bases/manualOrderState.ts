import type { TaskInfo } from "../types";
import type { SortOrderPlan } from "./sortOrderUtils";

export function buildSortOrderUpdateMap(
	draggedPath: string,
	sortOrderPlan: SortOrderPlan
): Map<string, string> {
	const updates = new Map<string, string>();
	if (sortOrderPlan.sortOrder) {
		updates.set(draggedPath, sortOrderPlan.sortOrder);
	}
	for (const write of sortOrderPlan.additionalWrites) {
		updates.set(write.path, write.sortOrder);
	}
	return updates;
}

export function applySortOrderUpdatesToTaskCache(
	taskInfoCache: Map<string, TaskInfo>,
	sortOrdersByPath: ReadonlyMap<string, string>,
	onTaskUpdated?: (task: TaskInfo) => void
): void {
	for (const [path, sortOrder] of sortOrdersByPath) {
		const cachedTask = taskInfoCache.get(path);
		if (!cachedTask) continue;

		cachedTask.sortOrder = sortOrder;
		onTaskUpdated?.(cachedTask);
	}
}

export function applySortOrderUpdatesToItems<T>(
	items: readonly T[],
	getTask: (item: T) => TaskInfo | null,
	sortOrdersByPath: ReadonlyMap<string, string>,
	onTaskUpdated?: (task: TaskInfo) => void
): void {
	for (const item of items) {
		const task = getTask(item);
		if (!task) continue;

		const sortOrder = sortOrdersByPath.get(task.path);
		if (sortOrder === undefined) continue;

		task.sortOrder = sortOrder;
		onTaskUpdated?.(task);
	}
}

export function movePathsRelativeToTarget(
	paths: readonly string[],
	draggedPaths: readonly string[],
	targetPath: string,
	above: boolean
): string[] | null {
	if (draggedPaths.length === 0 || draggedPaths.includes(targetPath)) {
		return null;
	}

	const pathSet = new Set(paths);
	const draggedSet = new Set(draggedPaths);
	if (!draggedPaths.every((path) => pathSet.has(path))) {
		return null;
	}

	const remaining = paths.filter((path) => !draggedSet.has(path));
	const targetIndex = remaining.indexOf(targetPath);
	if (targetIndex === -1) {
		return null;
	}

	const insertAt = above ? targetIndex : targetIndex + 1;
	return [
		...remaining.slice(0, insertAt),
		...draggedPaths,
		...remaining.slice(insertAt),
	];
}

export function moveItemsRelativeToTarget<T>(
	items: readonly T[],
	getPath: (item: T) => string | null,
	draggedPaths: readonly string[],
	targetPath: string,
	above: boolean
): T[] | null {
	if (draggedPaths.length === 0 || draggedPaths.includes(targetPath)) {
		return null;
	}

	const draggedSet = new Set(draggedPaths);
	const draggedItems = new Map<string, T>();
	const remaining: T[] = [];

	for (const item of items) {
		const path = getPath(item);
		if (path && draggedSet.has(path)) {
			draggedItems.set(path, item);
		} else {
			remaining.push(item);
		}
	}

	if (!draggedPaths.every((path) => draggedItems.has(path))) {
		return null;
	}

	const targetIndex = remaining.findIndex((item) => getPath(item) === targetPath);
	if (targetIndex === -1) {
		return null;
	}

	const movingItems: T[] = [];
	for (const path of draggedPaths) {
		const item = draggedItems.get(path);
		if (!item) {
			return null;
		}
		movingItems.push(item);
	}
	const insertAt = above ? targetIndex : targetIndex + 1;
	return [
		...remaining.slice(0, insertAt),
		...movingItems,
		...remaining.slice(insertAt),
	];
}
