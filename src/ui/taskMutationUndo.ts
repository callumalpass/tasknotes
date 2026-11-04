import { TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import { EVENT_DATA_CHANGED, EVENT_TASK_UPDATED, type TaskInfo } from "../types";
import { buildTaskMovementUndo } from "../bases/taskMovementUndo";
import {
	readCompletionContent,
	restoreCompletionContent,
	type CompletionContentUndo,
} from "../services/task-service/recurringCompletionUndo";
import {
	processVaultFileWithinMutation,
	withVaultFileMutation,
} from "../services/VaultMutationService";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { normalizeDependencyEntry } from "../utils/dependencyUtils";

export interface FileUndoReceipt {
	file: TFile;
	content: CompletionContentUndo;
	beforePath?: string;
	afterPath?: string;
}

function taskProperty(plugin: TaskNotesPlugin, property: string): keyof TaskInfo | undefined {
	const key =
		plugin.fieldMapper.lookupMappingKey(property) ??
		plugin.settings.userFields?.find((field) => field.key === property)?.key;
	const aliases: Record<string, keyof TaskInfo> = {
		recurrenceAnchor: "recurrence_anchor",
		recurrenceOriginalDate: "recurrence_original_date",
		completeInstances: "complete_instances",
		skippedInstances: "skipped_instances",
		recurrenceParent: "recurrence_parent",
		occurrenceDate: "occurrence_date",
	};
	return key
		? (aliases[key] ?? (key as keyof TaskInfo))
		: property === "tags"
			? "tags"
			: undefined;
}

export function collectFileUndo(plugin: TaskNotesPlugin, receipts: FileUndoReceipt[]) {
	return (file: TFile, before: Record<string, unknown>, after: Record<string, unknown>): void => {
		const changes = buildTaskMovementUndo(
			before,
			after,
			plugin.fieldMapper.toUserField("dateModified")
		);
		if (changes.length)
			receipts.push({ file, content: { changes, beforeBody: "", afterBody: "" } });
	};
}

export function createFileUndo(
	plugin: TaskNotesPlugin,
	receipts: FileUndoReceipt[]
): () => Promise<void> {
	let diskRestored = false;
	return async () => {
		const ordered = [...receipts].sort((left, right) =>
			left.file.path.localeCompare(right.file.path)
		);
		if (new Set(ordered.map((entry) => entry.file)).size !== ordered.length)
			throw new Error("Duplicate note in Undo receipt");
		const modified = plugin.fieldMapper.toUserField("dateModified");
		const timestamp = getCurrentTimestamp();
		const lock = async (index: number): Promise<void> => {
			if (index < ordered.length) {
				const entry = ordered[index];
				if (plugin.app.vault.getAbstractFileByPath(entry.file.path) !== entry.file)
					throw new Error(`Missing note: ${entry.file.path}`);
				return withVaultFileMutation(entry.file, () => lock(index + 1));
			}
			for (const entry of ordered) {
				if (
					entry.afterPath &&
					(entry.file.path !== entry.afterPath ||
						(entry.beforePath &&
							plugin.app.vault.getAbstractFileByPath(entry.beforePath)))
				)
					throw new Error(`Note path changed: ${entry.file.path}`);
				if (
					restoreCompletionContent(
						await plugin.app.vault.read(entry.file),
						entry.content,
						modified,
						timestamp
					) === null
				)
					throw new Error(`Note changed: ${entry.file.path}`);
			}
			const written: FileUndoReceipt[] = [];
			try {
				for (const entry of ordered) {
					await processVaultFileWithinMutation(plugin.app, entry.file, (content) => {
						const restored = restoreCompletionContent(
							content,
							entry.content,
							modified,
							timestamp
						);
						if (restored === null) throw new Error(`Note changed: ${entry.file.path}`);
						return restored;
					});
					written.push(entry);
					if (entry.beforePath)
						await plugin.app.fileManager.renameFile(entry.file, entry.beforePath);
				}
			} catch (error) {
				for (const entry of written.reverse()) {
					if (entry.afterPath && entry.file.path !== entry.afterPath) {
						if (plugin.app.vault.getAbstractFileByPath(entry.afterPath))
							throw new Error(`Undo recovery path conflict: ${entry.afterPath}`);
						await plugin.app.fileManager.renameFile(entry.file, entry.afterPath);
					}
					const reverse: CompletionContentUndo = {
						beforeBody: entry.content.afterBody,
						afterBody: entry.content.beforeBody,
						changes: entry.content.changes.map((change) => ({
							...change,
							before: change.after,
							after: change.before,
							hadBefore: change.hadAfter,
							hadAfter: change.hadBefore,
						})),
					};
					await processVaultFileWithinMutation(plugin.app, entry.file, (content) => {
						const restored = restoreCompletionContent(
							content,
							reverse,
							modified,
							timestamp
						);
						if (restored === null)
							throw new Error(`Undo recovery conflict: ${entry.file.path}`);
						return restored;
					});
				}
				throw error;
			}
		};
		if (!diskRestored) {
			await lock(0);
			diskRestored = true;
		}
		for (const entry of ordered) {
			const current = await plugin.cacheManager.getTaskInfo(entry.file.path);
			if (!current) continue;
			const parsed = readCompletionContent(await plugin.app.vault.read(entry.file));
			const restored = {
				...current,
				...plugin.fieldMapper.mapFromFrontmatter(
					parsed.frontmatter,
					entry.file.path,
					plugin.settings.storeTitleInFilename
				),
				dateModified: timestamp,
			};
			for (const change of entry.content.changes) {
				const key = taskProperty(plugin, change.property);
				if (key && !change.hadBefore) Object.assign(restored, { [key]: undefined });
			}
			plugin.cacheManager.updateTaskInfoInCache(entry.file.path, restored);
			plugin.emitter.trigger(EVENT_TASK_UPDATED, {
				path: entry.file.path,
				originalTask: current,
				updatedTask: restored,
			});
			for (const change of entry.content.changes) {
				const key = taskProperty(plugin, change.property);
				if (key)
					await plugin.taskService.applyPropertyChangeSideEffects(
						entry.file,
						current,
						restored,
						key,
						current[key],
						restored[key],
						undefined,
						true
					);
			}
		}
		plugin.emitter.trigger(EVENT_DATA_CHANGED);
	};
}

export async function captureTaskUndo(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	operation: () => Promise<TaskInfo | null>,
	properties?: readonly string[]
): Promise<{ task: TaskInfo | null; undo?: () => Promise<void> }> {
	const file = plugin.app.vault.getAbstractFileByPath(task.path);
	if (!(file instanceof TFile)) throw new Error(`Missing task: ${task.path}`);
	const originalPath = file.path;
	const before = readCompletionContent(await plugin.app.vault.read(file));
	const updated = await operation();
	if (!updated) return { task: null };
	const after = readCompletionContent(await plugin.app.vault.read(file));
	const changes = buildTaskMovementUndo(
		before.frontmatter,
		after.frontmatter,
		plugin.fieldMapper.toUserField("dateModified")
	).filter((change) => !properties || properties.includes(change.property));
	const content = {
		changes,
		beforeBody: properties ? after.body : before.body,
		afterBody: after.body,
	};
	const normalize = (value: unknown) =>
		value == null || (Array.isArray(value) && !value.length) ? undefined : value;
	const taskValue = (key: keyof TaskInfo, value: unknown) =>
		normalize(key === "blockedBy" && Array.isArray(value)
			? value.map(entry => normalizeDependencyEntry(entry) ?? entry)
			: value);
	const persistedBefore = plugin.fieldMapper.mapFromFrontmatter(
		before.frontmatter,
		originalPath,
		plugin.settings.storeTitleInFilename
	);
	const persistedAfter = plugin.fieldMapper.mapFromFrontmatter(
		after.frontmatter,
		file.path,
		plugin.settings.storeTitleInFilename
	);
	const safe =
		changes.every((change) => {
			const key = taskProperty(plugin, change.property);
			if (key)
				return (
					JSON.stringify(taskValue(key, persistedBefore[key])) ===
						JSON.stringify(taskValue(key, task[key])) &&
					JSON.stringify(taskValue(key, persistedAfter[key])) ===
						JSON.stringify(taskValue(key, updated[key]))
				);
			return (
				JSON.stringify(normalize(persistedBefore.customProperties?.[change.property])) ===
					JSON.stringify(normalize(task.customProperties?.[change.property])) &&
				JSON.stringify(normalize(persistedAfter.customProperties?.[change.property])) ===
					JSON.stringify(normalize(updated.customProperties?.[change.property])) &&
				Object.prototype.hasOwnProperty.call(
					updated.customProperties ?? {},
					change.property
				)
			);
		}) &&
		(content.beforeBody === content.afterBody ||
			(updated.details !== undefined &&
				content.afterBody ===
					`\n${updated.details.trimEnd() ? `${updated.details.trimEnd()}\n` : ""}`));
	const renamed = file.path !== originalPath;
	const restore = createFileUndo(plugin, [
		{ file, content, ...(renamed ? { beforePath: originalPath, afterPath: file.path } : {}) },
	]);
	return {
		task: updated,
		undo:
			changes.length || content.beforeBody !== content.afterBody || renamed
				? async () => {
						if (!safe) throw new Error(`Task changed during update: ${file.path}`);
						await restore();
					}
				: undefined,
	};
}
