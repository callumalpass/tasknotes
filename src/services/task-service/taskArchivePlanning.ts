import type { TaskInfo } from "../../types";

export type TaskArchiveOperation = "archiving" | "unarchiving";
export type TaskArchiveDestinationKind = "archive" | "tasks";

export interface TaskArchiveStatePlan {
	updatedTask: TaskInfo;
	isCurrentlyArchived: boolean;
	operation: TaskArchiveOperation;
	dateModified: string;
}

export interface ApplyTaskArchiveFrontmatterChangeInput {
	frontmatter: Record<string, unknown>;
	archiveTag: string;
	isCurrentlyArchived: boolean;
	dateModified: string;
	dateModifiedField: string;
}

export interface TaskArchiveMoveTaskData {
	title?: string;
	priority?: string;
	status?: string;
	contexts?: string[];
	projects?: string[];
}

export interface BuildTaskArchiveMovePlanInput {
	isCurrentlyArchived: boolean;
	moveArchivedTasks: boolean;
	archiveFolderTemplate?: string;
	tasksFolderTemplate?: string;
	fileName: string;
	taskData: TaskArchiveMoveTaskData;
	processFolderTemplate: (folderTemplate: string, taskData: TaskArchiveMoveTaskData) => string;
}

export interface TaskArchiveMovePlan {
	operation: TaskArchiveOperation;
	destinationKind: TaskArchiveDestinationKind;
	destinationFolder: string;
	newPath: string;
}

export function buildTaskArchiveState(
	task: TaskInfo,
	archiveTag: string,
	dateModified: string
): TaskArchiveStatePlan {
	const isCurrentlyArchived = !!task.archived;
	const updatedTask = { ...task };
	updatedTask.archived = !isCurrentlyArchived;
	updatedTask.dateModified = dateModified;

	const tags = Array.isArray(updatedTask.tags) ? updatedTask.tags : [];
	if (isCurrentlyArchived) {
		updatedTask.tags = tags.filter((tag) => tag !== archiveTag);
	} else if (tags.includes(archiveTag)) {
		updatedTask.tags = [...tags];
	} else {
		updatedTask.tags = [...tags, archiveTag];
	}

	return {
		updatedTask,
		isCurrentlyArchived,
		operation: isCurrentlyArchived ? "unarchiving" : "archiving",
		dateModified,
	};
}

export function applyTaskArchiveFrontmatterChange({
	frontmatter,
	archiveTag,
	isCurrentlyArchived,
	dateModified,
	dateModifiedField,
}: ApplyTaskArchiveFrontmatterChangeInput): void {
	if (isCurrentlyArchived) {
		const tags = frontmatter.tags;
		if (Array.isArray(tags)) {
			const updatedTags = tags.filter((tag: string) => tag !== archiveTag);
			if (updatedTags.length === 0) {
				delete frontmatter.tags;
			} else {
				frontmatter.tags = updatedTags;
			}
		}
	} else {
		if (!frontmatter.tags) {
			frontmatter.tags = [];
		} else if (!Array.isArray(frontmatter.tags)) {
			frontmatter.tags = [frontmatter.tags];
		}

		if (!(frontmatter.tags as unknown[]).includes(archiveTag)) {
			(frontmatter.tags as unknown[]).push(archiveTag);
		}
	}

	frontmatter[dateModifiedField] = dateModified;
}

export function buildTaskArchiveMovePlan({
	isCurrentlyArchived,
	moveArchivedTasks,
	archiveFolderTemplate,
	tasksFolderTemplate,
	fileName,
	taskData,
	processFolderTemplate,
}: BuildTaskArchiveMovePlanInput): TaskArchiveMovePlan | null {
	if (!moveArchivedTasks) {
		return null;
	}

	const folderTemplate = isCurrentlyArchived
		? tasksFolderTemplate?.trim()
		: archiveFolderTemplate?.trim();
	if (!folderTemplate) {
		return null;
	}

	const destinationKind: TaskArchiveDestinationKind = isCurrentlyArchived
		? "tasks"
		: "archive";
	const destinationFolder = processFolderTemplate(folderTemplate, {
		title: taskData.title || "",
		priority: taskData.priority,
		status: taskData.status,
		contexts: taskData.contexts,
		projects: taskData.projects,
	});

	return {
		operation: isCurrentlyArchived ? "unarchiving" : "archiving",
		destinationKind,
		destinationFolder,
		newPath: `${destinationFolder}/${fileName}`,
	};
}
