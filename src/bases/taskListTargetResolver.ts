export type TaskListSelectionTargetState = {
	getSelectedPaths(): string[];
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
