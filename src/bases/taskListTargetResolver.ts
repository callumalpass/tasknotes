export type TaskListSelectionTargetState = {
	getSelectedPaths(): string[];
};

export type TaskListDragSelectionState = TaskListSelectionTargetState & {
	isSelected(taskPath: string): boolean;
};

/**
 * Resolve the paths a task-list action should target.
 * Existing selection always takes precedence over keyboard focus.
 */
export function resolveTaskListTargetPaths(
	selectionState: TaskListSelectionTargetState | null | undefined,
	focusedPath: string | null | undefined
): string[] {
	const selectedPaths = selectionState?.getSelectedPaths() ?? [];
	const uniqueSelectedPaths = Array.from(
		new Set(selectedPaths.filter((path) => path.length > 0))
	);

	if (uniqueSelectedPaths.length > 0) {
		return uniqueSelectedPaths;
	}

	return focusedPath ? [focusedPath] : [];
}

/**
 * Resolve the visible paths moved by a task-list drag.
 * A selected card carries the visible selection; an unselected card moves alone.
 */
export function resolveTaskListDragPaths(
	selectionState: TaskListDragSelectionState | null | undefined,
	draggedPath: string,
	visiblePaths: ReadonlySet<string>
): string[] {
	if (!selectionState?.isSelected(draggedPath)) {
		return [draggedPath];
	}

	const selectedVisiblePaths = Array.from(
		new Set(
			selectionState
				.getSelectedPaths()
				.filter((path) => path.length > 0 && visiblePaths.has(path))
		)
	);

	return selectedVisiblePaths.includes(draggedPath) ? selectedVisiblePaths : [draggedPath];
}
