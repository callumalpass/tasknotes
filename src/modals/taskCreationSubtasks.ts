import type { TFile } from "obsidian";
import type { TaskInfo } from "../types";

interface PathLike {
	path: string;
}

type Nullable<T> = T | null;

export interface TaskCreationSubtaskAssignmentContext {
	currentTaskFile: Nullable<TFile>;
	subtaskFiles: readonly PathLike[];
	getTaskInfo: (path: string) => Promise<TaskInfo | null | undefined>;
	buildProjectReference: (currentTaskFile: TFile, subtaskPath: string) => string;
	updateTaskProjects: (task: TaskInfo, projects: string[]) => Promise<unknown>;
	onError?: (error: unknown, subtaskFile: PathLike) => void;
}

export interface TaskCreationSubtaskAssignmentResult {
	updated: number;
	missing: number;
	skipped: number;
	failed: number;
}

export async function applyTaskCreationSubtaskAssignments(
	context: TaskCreationSubtaskAssignmentContext
): Promise<TaskCreationSubtaskAssignmentResult> {
	const result: TaskCreationSubtaskAssignmentResult = {
		updated: 0,
		missing: 0,
		skipped: 0,
		failed: 0,
	};

	if (!context.currentTaskFile) {
		return result;
	}

	for (const subtaskFile of context.subtaskFiles) {
		try {
			const subtaskInfo = await context.getTaskInfo(subtaskFile.path);
			if (!subtaskInfo) {
				result.missing += 1;
				continue;
			}

			const projectReference = context.buildProjectReference(
				context.currentTaskFile,
				subtaskFile.path
			);
			const nextProjects = getSubtaskProjectAssignmentUpdate(
				subtaskInfo.projects,
				projectReference,
				getLegacyProjectReference(context.currentTaskFile)
			);

			if (!nextProjects) {
				result.skipped += 1;
				continue;
			}

			await context.updateTaskProjects(subtaskInfo, nextProjects);
			result.updated += 1;
		} catch (error) {
			result.failed += 1;
			context.onError?.(error, subtaskFile);
		}
	}

	return result;
}

export function getSubtaskProjectAssignmentUpdate(
	currentProjects: unknown,
	projectReference: string,
	legacyReference: string
): string[] | null {
	const projectList = Array.isArray(currentProjects) ? currentProjects : [];
	const stringProjects = projectList.filter(
		(project): project is string => typeof project === "string"
	);

	if (
		stringProjects.includes(projectReference) ||
		stringProjects.includes(legacyReference)
	) {
		return null;
	}

	return [...stringProjects, projectReference];
}

function getLegacyProjectReference(currentTaskFile: TFile): string {
	return `[[${currentTaskFile.basename}]]`;
}
