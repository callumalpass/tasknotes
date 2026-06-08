import type { TaskInfo } from "../types";
import type { TaskCreationDefaults } from "../types/settings";

export type ParentNoteProjectDefaultContext = "task-creation" | "inline-creation";

export function shouldApplyParentNoteProjectDefault(
	defaults: Pick<
		TaskCreationDefaults,
		"useParentNoteForTaskCreation" | "useParentNoteAsProject"
	>,
	context: ParentNoteProjectDefaultContext
): boolean {
	if (context === "task-creation") {
		return defaults.useParentNoteForTaskCreation;
	}

	return defaults.useParentNoteAsProject;
}

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
