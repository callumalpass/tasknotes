import { parseYaml, stringifyYaml, TFile } from "obsidian";
import type TaskNotesPlugin from "../../main";
import { EVENT_TASK_UPDATED, type TaskInfo, type FieldMapping } from "../../types";
import { getCurrentTimestamp, formatDateForStorage } from "../../utils/dateUtils";
import { splitFrontmatterAndBody, resetMarkdownCheckboxes } from "../../utils/helpers";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "RecurringCompletionUndo" });
import {
	applyTaskMovementUndo,
	type TaskMovementUndoChange,
} from "../../bases/taskMovementUndo";
import {
	withVaultFileMutation,
	processVaultFileWithinMutation,
} from "../VaultMutationService";

// Only completion-owned fields are reversible. Never capture unrelated edits made
// while the completion is awaiting metadata or an external integration.
const completionFields = [
	"scheduled", "due", "recurrence", "recurrence_anchor", "complete_instances",
	"skipped_instances", "status", "completedDate", "timeEntries",
	"googleCalendarExceptionEventId", "googleCalendarExceptionOriginalScheduled",
	"googleCalendarMovedOriginalDates", "recurrence_parent", "occurrence_date",
] as const;

function mappingKey(field: typeof completionFields[number]): keyof FieldMapping {
	if (field === "recurrence_anchor") return "recurrenceAnchor";
	if (field === "complete_instances") return "completeInstances";
	if (field === "skipped_instances") return "skippedInstances";
	if (field === "recurrence_parent") return "recurrenceParent";
	if (field === "occurrence_date") return "occurrenceDate";
	return field;
}

export function readCompletionContent(content: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const { frontmatter, body } = splitFrontmatterAndBody(content);
	const parsed: unknown = frontmatter === null ? {} : parseYaml(frontmatter);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Invalid task frontmatter");
	}
	return { frontmatter: parsed as Record<string, unknown>, body };
}

export interface CompletionContentUndo {
	changes: TaskMovementUndoChange[];
	beforeBody: string;
	afterBody: string;
}

export function buildCompletionContentUndo(
	before: string,
	after: string,
	properties: readonly string[],
	modifiedProperty: string
): CompletionContentUndo {
	const previous = readCompletionContent(before);
	const next = readCompletionContent(after);
	return {
		changes: properties.filter(property => property !== modifiedProperty).map(property => ({
			property,
			before: structuredClone(previous.frontmatter[property]),
			after: structuredClone(next.frontmatter[property]),
			hadBefore: Object.prototype.hasOwnProperty.call(previous.frontmatter, property),
			hadAfter: Object.prototype.hasOwnProperty.call(next.frontmatter, property),
		})),
		beforeBody: previous.body,
		afterBody: next.body,
	};
}

/** Validate and restore only this operation's writes, retaining later unrelated edits. */
export function restoreCompletionContent(
	content: string,
	undo: CompletionContentUndo,
	modifiedProperty: string,
	timestamp: string
): string | null {
	const current = readCompletionContent(content);
	if (undo.beforeBody !== undo.afterBody && current.body !== undo.afterBody) return null;
	if (!applyTaskMovementUndo(current.frontmatter, undo.changes)) return null;
	current.frontmatter[modifiedProperty] = timestamp;
	const body = undo.beforeBody !== undo.afterBody ? undo.beforeBody : current.body;
	return `---\n${stringifyYaml(current.frontmatter)}---\n${body}`;
}

/**
 * A receipt is bound to the files/occurrence acted upon, never to the parent's
 * newly advanced scheduled date. Newly materialized notes are retained on undo,
 * just as when an occurrence is uncompleted from its own note.
 */
export async function completeRecurringTaskWithUndo(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	date: Date
): Promise<{ updatedTask: TaskInfo; completed: boolean; undo: () => Promise<boolean> }> {
	const service = plugin.taskService;
	const parent = (await plugin.cacheManager.getTaskInfo(task.path)) || task;
	let occurrence = await service.findMaterializedOccurrence(parent, date);
	if (!occurrence && parent.occurrence_materialization === "on_completion" &&
		!parent.complete_instances?.includes(formatDateForStorage(date))) {
		occurrence = await service.materializeOccurrence(parent, date);
	}
	const tasks = occurrence ? [parent, occurrence] : [parent];
	const before = await Promise.all(tasks.map(async taskInfo => {
		const file = plugin.app.vault.getAbstractFileByPath(taskInfo.path);
		if (!(file instanceof TFile)) throw new Error("Task file no longer exists");
		return { file, taskInfo: structuredClone(taskInfo), content: await plugin.app.vault.read(file) };
	}));
	const parentTransition: { original?: TaskInfo; updated?: TaskInfo } = {};
	const result = await service.toggleRecurringTaskCompleteWithOccurrenceNotes(parent, date,
		(original, updated) => {
			parentTransition.original = structuredClone(original);
			parentTransition.updated = structuredClone(updated);
		});
	const updatedTask = result.path === parent.path ? result : parentTransition.updated || parent;
	const modifiedProperty = plugin.fieldMapper.toUserField("dateModified");
	const properties = completionFields.map(field => plugin.fieldMapper.toUserField(mappingKey(field)));
	const entries = await Promise.all(before.map(async previous => {
		const nextTask = previous.file.path === result.path ? result : updatedTask;
		const afterContent = await plugin.app.vault.read(previous.file);
		const undo = buildCompletionContentUndo(previous.content, afterContent, properties, modifiedProperty);
		// A receipt must match the operation's authoritative task state, not any
		// edits arriving while it awaited metadata/webhooks. Otherwise fail closed.
		const matchesTask = (content: string, expected: TaskInfo): boolean => {
			const actual = plugin.fieldMapper.mapFromFrontmatter(
				readCompletionContent(content).frontmatter, previous.file.path);
			return completionFields.every(field => {
				const normalize = (value: unknown) => value == null ||
					(Array.isArray(value) && value.length === 0) ? undefined : value;
				return JSON.stringify(normalize(actual[field])) === JSON.stringify(normalize(expected[field]));
			});
		};
		const originalTask = previous.file.path === parent.path && occurrence
			? parentTransition.original : previous.taskInfo;
		let safe = !!originalTask && matchesTask(previous.content, originalTask) && matchesTask(afterContent, nextTask);
		if (undo.beforeBody !== undo.afterBody) {
			// Only the known checkbox-reset transformation belongs to completion.
			// An intervening arbitrary body edit must never be rolled back.
			safe = safe && plugin.settings.resetCheckboxesOnRecurrence &&
				resetMarkdownCheckboxes(undo.beforeBody).content.trimEnd() === undo.afterBody.trimEnd();
		}
		return { ...previous, nextTask, undo, safe };
	}));
	const completed = occurrence
		? plugin.statusManager.isCompletedStatus(result.status)
		: (updatedTask.complete_instances ?? []).some(day => !parent.complete_instances?.includes(day));
	let used = false;
	return {
		updatedTask,
		completed,
		undo: async () => {
			if (used || entries.some(entry => !entry.safe)) return false;
			used = true;
			const syncUpdates: { current: TaskInfo; restored: TaskInfo }[] = [];
			// Lock both parent and occurrence in stable order. Validate every receipt
			// before writing either file so stale notices cannot undo later actions.
			const ordered = [...entries].sort((a, b) => a.file.path.localeCompare(b.file.path));
			const lock = async (index: number): Promise<boolean> => {
				if (index < ordered.length) {
					return withVaultFileMutation(ordered[index].file, () => lock(index + 1));
				}
				const timestamp = getCurrentTimestamp();
				for (const entry of entries) {
					if (plugin.app.vault.getAbstractFileByPath(entry.file.path) !== entry.file) return false;
					if (restoreCompletionContent(await plugin.app.vault.read(entry.file),
						entry.undo, modifiedProperty, timestamp) === null) return false;
				}
				const written: typeof entries = [];
				try {
					for (const entry of entries) {
						await processVaultFileWithinMutation(plugin.app, entry.file, content => {
							const restored = restoreCompletionContent(content, entry.undo, modifiedProperty, timestamp);
							if (restored === null) throw new Error("Task changed during undo");
							return restored;
						});
						written.push(entry);
					}
				} catch (error) {
					// Obsidian has no multi-file transaction. Compensate earlier writes
					// if a later file fails, without replacing any intervening edits.
					for (const entry of written.reverse()) {
						const reverse: CompletionContentUndo = {
							changes: entry.undo.changes.map(change => ({
								...change, before: change.after, after: change.before,
								hadBefore: change.hadAfter, hadAfter: change.hadBefore,
							})),
							beforeBody: entry.undo.afterBody, afterBody: entry.undo.beforeBody,
						};
						await processVaultFileWithinMutation(plugin.app, entry.file, content => {
							const restored = restoreCompletionContent(content, reverse, modifiedProperty, getCurrentTimestamp());
							if (restored === null) throw new Error("Task changed during Undo rollback");
							return restored;
						});
					}
					throw error;
				}
				for (const entry of entries) {
					const current = (await plugin.cacheManager.getTaskInfo(entry.file.path)) || entry.nextTask;
					const restoredContent = readCompletionContent(await plugin.app.vault.read(entry.file));
					const restoredTask = {
						...current,
						...plugin.fieldMapper.mapFromFrontmatter(restoredContent.frontmatter, entry.file.path),
						dateModified: timestamp,
						details: restoredContent.body.trimEnd(),
					};
					// mapFromFrontmatter may omit absent fields. Clear only those that
					// this receipt restored to absence in the persisted frontmatter.
					for (const field of completionFields) {
						if (!Object.prototype.hasOwnProperty.call(restoredContent.frontmatter,
							plugin.fieldMapper.toUserField(mappingKey(field)))) {
							Object.assign(restoredTask, { [field]: undefined });
						}
					}
					plugin.cacheManager.updateTaskInfoInCache(entry.file.path, restoredTask);
					syncUpdates.push({ current, restored: restoredTask });
				}
				return true;
			};
			const restored = await lock(0);
			for (const update of syncUpdates) {
				plugin.emitter.trigger(EVENT_TASK_UPDATED, {
					path: update.restored.path, originalTask: update.current, updatedTask: update.restored,
				});
			}
			// Calendar sync can itself write metadata through the mutation queue.
			// Never await it while holding either task file's lock.
			if (restored && plugin.taskCalendarSyncService?.isEnabled()) {
				for (const update of syncUpdates) {
					void plugin.taskCalendarSyncService.updateTaskInCalendar(update.restored, update.current)
						.catch(error => tasknotesLogger.warn("Calendar sync after Undo failed", {
							category: "provider", operation: "recurring-completion-undo-calendar", error,
						}));
				}
			}
			return restored;
		},
	};
}
