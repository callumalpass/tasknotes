import { TASK_PATH_DRAG_TYPE } from "../utils/DragDropManager";

/** Whether a native drag carries a TaskNotes task path the calendar can schedule. */
export function acceptsExternalTaskDrop(dataTransfer: DataTransfer): boolean {
	return Array.from(dataTransfer.types).includes(TASK_PATH_DRAG_TYPE);
}

export function getExternalTaskDropPath(dataTransfer: DataTransfer | null): string | undefined {
	const taskPath = dataTransfer?.getData(TASK_PATH_DRAG_TYPE).trim();
	return taskPath ? taskPath : undefined;
}
