import type { TaskInfo } from "../types";

export function applyParentNoteProjectDefault(
	prePopulatedValues?: Partial<TaskInfo>,
	parentNote?: string | null
): Partial<TaskInfo> | undefined {
	const values: Partial<TaskInfo> = prePopulatedValues ? { ...prePopulatedValues } : {};
	const hasValues = Object.keys(values).length > 0;
	const existingProjects = Array.isArray(values.projects) ? values.projects : [];

	if (!parentNote || existingProjects.length > 0) {
		return hasValues ? values : undefined;
	}

	values.projects = [parentNote];
	return values;
}
