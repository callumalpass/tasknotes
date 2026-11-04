import { msg } from "@lingui/core/macro";
import { Notice, TFile, setIcon } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { configLabel } from "../i18n/configLabels";
import { uiText } from "../i18n/runtime";
import { NaturalLanguageParser } from "../services/NaturalLanguageParser";
import { DateContextMenu } from "../components/DateContextMenu";
import { DateTimePickerModal } from "../modals/DateTimePickerModal";
import {
	addDaysToDateTime,
	getCurrentTimestamp,
	getDatePart,
	getTimePart,
} from "../utils/dateUtils";
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
import { openListPicker, type PickerItem } from "./kit/listPicker";
import type { PopoverHandle, PopoverOptions } from "./kit/popover";
import { showToast } from "./kit/toast";
import {
	renderPriorityGlyph,
	renderStatusGlyph,
	priorityGlyphState,
	statusGlyphState,
	unconfiguredValueLabel,
} from "./kit/glyphs";

export type TaskPickerProperty =
	| "status"
	| "priority"
	| "due"
	| "scheduled"
	| "tags"
	| "contexts"
	| "projects";

type PropertyValue = string | string[] | undefined;
export type TaskPickerValues = Pick<TaskInfo, TaskPickerProperty>;
export type TaskPropertyChoice = PropertyValue | ((task: TaskPickerValues) => PropertyValue);

export function taskPropertyLabel(property: TaskPickerProperty): string {
	switch (property) {
		case "status":
			return uiText(msg({ message: "Status", context: "interaction property" }));
		case "priority":
			return uiText(msg({ message: "Priority", context: "interaction property" }));
		case "due":
			return uiText(msg({ message: "Due date", context: "interaction property" }));
		case "scheduled":
			return uiText(msg({ message: "Scheduled date", context: "interaction property" }));
		case "tags":
			return uiText(msg({ message: "Tags", context: "interaction property" }));
		case "contexts":
			return uiText(msg({ message: "Contexts", context: "interaction property" }));
		case "projects":
			return uiText(msg({ message: "Projects", context: "interaction property" }));
	}
}

function reportFailure(): void {
	new Notice(uiText(msg({ message: "Could not update tasks", context: "interaction failure" })));
}

export function tasksForPropertyAction(
	plugin: TaskNotesPlugin,
	task: TaskInfo
): Promise<TaskInfo[]> {
	const selection = plugin.taskSelectionService;
	const paths = selection?.isSelected(task.path) ? selection.getSelectedPaths() : [task.path];
	return Promise.all(paths.map(async (path) => plugin.cacheManager.getTaskInfo(path))).then(
		(tasks) => tasks.filter((item): item is TaskInfo => !!item)
	);
}

export async function changeTaskProperty(
	plugin: TaskNotesPlugin,
	tasks: readonly TaskInfo[],
	property: TaskPickerProperty,
	value: PropertyValue | ((task: TaskInfo) => PropertyValue)
): Promise<void> {
	const undo: Array<() => Promise<unknown>> = [];
	try {
		for (const task of tasks) {
			const before = await plugin.cacheManager.getTaskInfo(task.path);
			if (!before) throw new Error(`Missing task: ${task.path}`);
			const parent =
				property === "status" && before.recurrence_parent
					? await plugin.taskService.getMaterializedOccurrenceParent(before)
					: null;
			const affected = parent ? [before, parent] : [before];
			const snapshots = await Promise.all(
				affected.map(async (taskInfo) => {
					const file = plugin.app.vault.getAbstractFileByPath(taskInfo.path);
					if (!(file instanceof TFile)) throw new Error(`Missing task: ${taskInfo.path}`);
					return { file, taskInfo, content: await plugin.app.vault.read(file) };
				})
			);
			let parentTransition: { original: TaskInfo; updated: TaskInfo } | undefined;
			const updated = await plugin.updateTaskProperty(
				before,
				property,
				typeof value === "function" ? value(before) : value,
				{
					onRecurringParentUpdated: (original, next) => {
						parentTransition = {
							original: structuredClone(original),
							updated: structuredClone(next),
						};
					},
				}
			);
			const modified = plugin.fieldMapper.toUserField("dateModified");
			const entries = await Promise.all(
				snapshots.map(async (snapshot) => {
					const after = await plugin.app.vault.read(snapshot.file);
					const previous = readCompletionContent(snapshot.content);
					const next = readCompletionContent(after);
					const receipt: CompletionContentUndo = {
						changes: buildTaskMovementUndo(
							previous.frontmatter,
							next.frontmatter,
							modified
						).filter((change) =>
							[
								property,
								"scheduled",
								"due",
								"recurrence",
								"recurrenceAnchor",
								"recurrenceOriginalDate",
								"completeInstances",
								"skippedInstances",
								"completedDate",
								"googleCalendarExceptionEventId",
								"googleCalendarExceptionOriginalScheduled",
								"googleCalendarMovedOriginalDates",
							].some(
								(field) =>
									plugin.fieldMapper.toUserField(
										field as Parameters<
											typeof plugin.fieldMapper.toUserField
										>[0]
									) === change.property
							)
						),
						beforeBody: next.body,
						afterBody: next.body,
					};
					const original =
						snapshot.taskInfo.path === before.path
							? before
							: parentTransition?.original;
					const result =
						snapshot.taskInfo.path === before.path
							? updated
							: parentTransition?.updated;
					const previousValues = plugin.fieldMapper.mapFromFrontmatter(
						previous.frontmatter,
						snapshot.file.path
					);
					const nextValues = plugin.fieldMapper.mapFromFrontmatter(
						next.frontmatter,
						snapshot.file.path
					);
					const changedKeys = [
						...new Set([...Object.keys(previousValues), ...Object.keys(nextValues)]),
					].filter(
						(key) =>
							key !== "dateModified" &&
							JSON.stringify(previousValues[key as keyof TaskInfo]) !==
								JSON.stringify(nextValues[key as keyof TaskInfo])
					);
					const normalize = (candidate: unknown) =>
						candidate == null || (Array.isArray(candidate) && !candidate.length)
							? undefined
							: candidate;
					const safe = changedKeys.every(
						(key) =>
							original &&
							result &&
							JSON.stringify(normalize(previousValues[key as keyof TaskInfo])) ===
								JSON.stringify(normalize(original[key as keyof TaskInfo])) &&
							JSON.stringify(normalize(nextValues[key as keyof TaskInfo])) ===
								JSON.stringify(normalize(result[key as keyof TaskInfo]))
					);
					return { ...snapshot, receipt, original, result, changedKeys, safe };
				})
			);
			if (!entries.some((entry) => entry.receipt.changes.length)) continue;
			undo.push(async () => {
				if (entries.some((entry) => !entry.safe))
					throw new Error("Task changed during update");
				const ordered = [...entries].sort((left, right) =>
					left.file.path.localeCompare(right.file.path)
				);
				const restoredTasks: Array<{ file: TFile; current: TaskInfo; restored: TaskInfo }> =
					[];
				const currentTasks = new Map<string, TaskInfo>();
				const lock = async (index: number): Promise<void> => {
					if (index < ordered.length)
						return withVaultFileMutation(ordered[index].file, () => lock(index + 1));
					const timestamp = getCurrentTimestamp();
					for (const entry of entries) {
						const current = await plugin.cacheManager.getTaskInfo(entry.file.path);
						if (!current) throw new Error(`Missing task: ${entry.file.path}`);
						currentTasks.set(entry.file.path, current);
						if (
							plugin.app.vault.getAbstractFileByPath(entry.file.path) !==
								entry.file ||
							restoreCompletionContent(
								await plugin.app.vault.read(entry.file),
								entry.receipt,
								modified,
								timestamp
							) === null
						)
							throw new Error("Task changed since update");
					}
					const written: typeof entries = [];
					try {
						for (const entry of entries) {
							await processVaultFileWithinMutation(
								plugin.app,
								entry.file,
								(content) => {
									const restored = restoreCompletionContent(
										content,
										entry.receipt,
										modified,
										timestamp
									);
									if (restored === null)
										throw new Error("Task changed during undo");
									return restored;
								}
							);
							written.push(entry);
						}
					} catch (error) {
						for (const entry of written.reverse()) {
							const reverse = {
								...entry.receipt,
								changes: entry.receipt.changes.map((change) => ({
									...change,
									before: change.after,
									after: change.before,
									hadBefore: change.hadAfter,
									hadAfter: change.hadBefore,
								})),
							};
							await processVaultFileWithinMutation(
								plugin.app,
								entry.file,
								(content) => {
									const restored = restoreCompletionContent(
										content,
										reverse,
										modified,
										timestamp
									);
									if (restored === null)
										throw new Error("Task changed during undo recovery");
									return restored;
								}
							);
						}
						throw error;
					}
					for (const entry of entries) {
						const current = currentTasks.get(entry.file.path);
						if (!current) throw new Error(`Missing task: ${entry.file.path}`);
						const restored = { ...current, dateModified: timestamp };
						for (const key of entry.changedKeys)
							Object.assign(restored, {
								[key]: entry.original?.[key as keyof TaskInfo],
							});
						plugin.cacheManager.updateTaskInfoInCache(entry.file.path, restored);
						restoredTasks.push({ file: entry.file, current, restored });
					}
				};
				await lock(0);
				for (const entry of restoredTasks)
					await plugin.taskService.applyPropertyChangeSideEffects(
						entry.file,
						entry.current,
						entry.restored,
						property,
						entry.current[property],
						entry.restored[property],
						undefined,
						true
					);
			});
		}
	} catch {
		reportFailure();
	} finally {
		if (undo.length) showTaskUndo(undo);
	}
}

export function showTaskUndo(undo: Array<() => Promise<unknown>>): void {
	showToast({
		message: uiText(msg({ message: "Tasks updated", context: "interaction feedback" })),
		action: {
			label: uiText(msg({ message: "Undo", context: "interaction undo" })),
			run: () => {
				void (async () => {
					for (const restore of undo.reverse()) {
						try {
							await restore();
						} catch {
							reportFailure();
						}
					}
				})();
			},
		},
	});
}

export async function archiveTasksWithUndo(
	plugin: TaskNotesPlugin,
	tasks: readonly TaskInfo[],
	archived = true
): Promise<void> {
	const undo: Array<() => Promise<unknown>> = [];
	try {
		for (const task of tasks) {
			const before = await plugin.cacheManager.getTaskInfo(task.path);
			if (!before || before.archived === archived) continue;
			const after = await plugin.taskService.toggleArchive(before);
			undo.push(async () => {
				const current = await plugin.cacheManager.getTaskInfo(after.path);
				if (!current) throw new Error(`Missing task: ${after.path}`);
				if (
					current.archived !== after.archived ||
					JSON.stringify(current.tags) !== JSON.stringify(after.tags)
				)
					throw new Error("Task changed since archive");
				const restored =
					current.archived !== before.archived
						? await plugin.taskService.toggleArchive(current)
						: current;
				if (restored.path !== before.path) {
					const file = plugin.app.vault.getAbstractFileByPath(restored.path);
					if (!(file instanceof TFile)) throw new Error(`Missing file: ${restored.path}`);
					await plugin.app.fileManager.renameFile(file, before.path);
				}
				await plugin.taskService.updateTask(
					{ ...restored, path: before.path },
					{ tags: before.tags }
				);
			});
		}
	} catch {
		reportFailure();
	}
	if (undo.length) showTaskUndo(undo);
}

export async function openTaskPropertyPicker(
	plugin: TaskNotesPlugin,
	property: TaskPickerProperty,
	tasks: readonly TaskInfo[],
	anchor: PopoverOptions["anchor"]
): Promise<void> {
	if (!tasks.length) return;
	let changes = Promise.resolve();
	const apply = (value: TaskPropertyChoice) => {
		changes = changes.then(() => changeTaskProperty(plugin, tasks, property, value));
	};
	await openTaskPropertyChoices(plugin, property, tasks, anchor, apply);
}

export async function openTaskPropertyChoices(
	plugin: TaskNotesPlugin,
	property: TaskPickerProperty,
	tasks: readonly TaskPickerValues[],
	anchor: PopoverOptions["anchor"],
	apply: (value: TaskPropertyChoice) => void
): Promise<PopoverHandle | undefined> {
	if (!tasks.length) return;
	const clear = uiText(msg({ message: "Clear", context: "interaction clear" }));
	const label = taskPropertyLabel(property);
	let items: PickerItem[] = [];
	if (property === "status" || property === "priority") {
		const configs =
			property === "status"
				? plugin.statusManager.getAllStatuses()
				: plugin.priorityManager.getAllPriorities();
		items = configs.map((config) => ({
			id: config.value,
			label: configLabel(config),
			selected: tasks.every((task) => task[property] === config.value),
			renderLeading: (host) => {
				if (config.color) host.style.color = config.color;
				if (config.icon) setIcon(host, config.icon);
				else if (property === "status")
					renderStatusGlyph(
						host,
						statusGlyphState(config.value, plugin.statusManager.getAllStatuses())
					);
				else
					renderPriorityGlyph(
						host,
						priorityGlyphState(config.value, plugin.priorityManager.getAllPriorities())
					);
			},
		}));
		for (const task of tasks) {
			const value = task[property];
			if (value && !items.some((item) => item.id === value))
				items.push({
					id: value,
					label: unconfiguredValueLabel(value),
					renderLeading: (host) =>
						property === "priority"
							? renderPriorityGlyph(host, { kind: "unknown" })
							: renderStatusGlyph(host, { kind: "unknown", progress: 0 }),
					selected: tasks.every((candidate) => candidate[property] === value),
				});
		}
		if (property === "priority") items.push({ id: "", label: clear });
		return openListPicker({
			anchor,
			app: plugin.app,
			items,
			placeholder: label,
			emptyText: clear,
			onChoose: (item) => apply(item.id),
		});
	}
	if (property === "due" || property === "scheduled") {
		const parser = NaturalLanguageParser.fromPlugin(plugin);
		const parse = (query: string) => {
			const parsed = parser.parseInput(query);
			const date = parsed.dueDate || parsed.scheduledDate;
			const time = parsed.dueDate ? parsed.dueTime : parsed.scheduledTime;
			return date && time ? `${date}T${time}` : date;
		};
		const currentValue = tasks[0][property];
		const dateOptions = new DateContextMenu({
			plugin,
			currentValue: getDatePart(currentValue ?? ""),
			currentTime: getTimePart(currentValue ?? ""),
			onSelect: () => {},
		}).getDateOptions();
		items = dateOptions.map((option, index) => ({
			id: String(index),
			label: option.label,
			renderLeading: option.icon ? (host) => setIcon(host, option.icon as string) : undefined,
		}));
		items.push(
			{
				id: "custom",
				label: uiText(
					msg({ message: "Pick date & time…", context: "contextMenus.date.pickDateTime" })
				),
			},
			{ id: "clear", label: clear }
		);
		return openListPicker({
			anchor,
			app: plugin.app,
			items,
			placeholder: label,
			emptyText: label,
			createLabel: (query) =>
				parse(query) ??
				uiText(msg({ message: "Enter a valid date", context: "interaction date" })),
			canCreate: (query) => !!parse(query),
			onCreate: (query) => {
				const date = parse(query);
				if (date) apply(date);
			},
			onChoose: (item) => {
				if (item.id === "clear") {
					apply(undefined);
					return;
				}
				if (item.id === "custom") {
					new DateTimePickerModal(plugin.app, {
						plugin,
						currentDate: getDatePart(currentValue ?? ""),
						currentTime: getTimePart(currentValue ?? ""),
						dateRole: property,
						onSelect: (date, time) =>
							apply(date && time ? `${date}T${time}` : (date ?? undefined)),
					}).open();
					return;
				}
				const index = Number(item.id);
				const option = dateOptions[index];
				if (option.category === "increment") {
					const delta = [1, -1, 7, -7][index];
					apply((task) =>
						task[property]
							? (addDaysToDateTime(task[property], delta) ?? undefined)
							: undefined
					);
				} else apply(option.value ?? undefined);
			},
		});
	}
	const allTasks = await plugin.cacheManager.getAllTasks();
	const values = new Set(allTasks.flatMap((task) => task[property] ?? []));
	for (const task of tasks) for (const value of task[property] ?? []) values.add(value);
	const toggle = (value: string, selected: boolean) =>
		apply((task) => {
			const previous = task[property] ?? [];
			return selected
				? [...new Set([...previous, value])]
				: previous.filter((entry) => entry !== value);
		});
	return openListPicker({
		anchor,
		app: plugin.app,
		placeholder: label,
		emptyText: clear,
		multiple: true,
		items: [...values].sort().map((value) => ({
			id: value,
			label: value,
			selected: tasks.every((task) => task[property]?.includes(value)),
		})),
		onChoose: (item) => toggle(item.id, !!item.selected),
		createLabel: (query) => query,
		onCreate: (query) => toggle(query, true),
	});
}
