import { msg } from "@lingui/core/macro";
import { normalizePath, TFile, TFolder, type App } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { uiText } from "../i18n/runtime";
import { UndoConflictError } from "./kit/toast";
import { showTaskUndo } from "./taskPropertyPickers";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { createVaultBinaryFile, createVaultFolder } from "../services/VaultMutationService";

const tasknotesLogger = createTaskNotesLogger({ tag: "UI/NoteDeletion" });

export interface NoteDeletionTarget {
	file: TFile;
	/** Set for a task note, so its calendar links and webhooks are handled. */
	task?: TaskInfo;
}

async function ensureFolder(app: App, path: string): Promise<void> {
	const parent = path.split("/").slice(0, -1).join("/");
	if (!parent || app.vault.getAbstractFileByPath(parent) instanceof TFolder) return;
	await ensureFolder(app, parent);
	await createVaultFolder(app, parent);
}

/** Recreates a deleted note from its saved bytes, unless something else now uses the path. */
function restoreNote(app: App, path: string, data: ArrayBuffer): () => Promise<void> {
	return async () => {
		if (app.vault.getAbstractFileByPath(path)) throw new UndoConflictError([path]);
		await ensureFolder(app, path);
		await createVaultBinaryFile(app, normalizePath(path), data);
	};
}

/**
 * Deletes notes straight away and offers Undo, in place of a confirmation
 * dialog. Each note's bytes are kept so Undo can recreate it at its path; the
 * deleted file still goes to the trash Obsidian is set to use.
 */
export async function deleteNotesWithUndo(
	plugin: TaskNotesPlugin,
	targets: readonly NoteDeletionTarget[],
	onUpdate?: () => void
): Promise<number> {
	const { app } = plugin;
	const undo: Array<() => Promise<void>> = [];
	const failedTitles: string[] = [];
	for (const { file, task } of targets) {
		try {
			const data = await app.vault.readBinary(file);
			const path = file.path;
			if (task) await plugin.taskService.deleteTask(task);
			else await app.fileManager.trashFile(file);
			undo.push(restoreNote(app, path, data));
		} catch (error) {
			tasknotesLogger.error("Failed to delete note:", {
				category: "persistence",
				operation: "delete-note",
				details: { path: file.path },
				error,
			});
			failedTitles.push(task?.title ?? file.basename);
		}
	}
	const count = undo.length;
	const allTasks = targets.every((target) => target.task);
	const message = failedTitles.length
		? failedTitles.join(", ")
		: uiText(
				allTasks
					? msg({ message: "{count, plural, one {# task deleted} other {# tasks deleted}}", context: "interaction feedback delete task" })
					: msg({ message: "{count, plural, one {# note deleted} other {# notes deleted}}", context: "interaction feedback delete note" }),
				{ count }
			) + (count === 1 && targets.length === 1 ? ` · ${targets[0].task?.title ?? targets[0].file.basename}` : "");
	showTaskUndo(undo, failedTitles.length > 0, count, app.vault, message);
	if (count) onUpdate?.();
	return count;
}
