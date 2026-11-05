import { msg } from "@lingui/core/macro";
import { TFile, setIcon } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { configLabel } from "../i18n/configLabels";
import { captureTaskUndo } from "./taskMutationUndo";
import { uiText } from "../i18n/runtime";
import { taskDateLabel } from "./kit/dateLabel";
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

export interface TaskUndoFeedback {
	undo: Array<() => Promise<unknown>>;
	failed: boolean;
	failedTitles?: string[];
}

export function updateTaskProjectsWithUndo(
	plugin: TaskNotesPlugin
): (task: TaskInfo, projects: string[]) => Promise<TaskInfo | null> {
	return async (task, projects) =>
		(await changeTaskProperty(plugin, [task], "projects", projects))[0] ?? null;
}

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

export async function changeTaskProperty<Property extends keyof TaskInfo>(
	plugin: TaskNotesPlugin,
	tasks: readonly TaskInfo[],
	property: Property,
	value: TaskInfo[Property] | ((task: TaskInfo) => TaskInfo[Property]),
	feedback?: TaskUndoFeedback
): Promise<TaskInfo[]> {
	const undo: Array<() => Promise<unknown>> = [];
	const updatedTasks: TaskInfo[] = [];
	const failedTitles: string[] = [];
	let failed = false;
	for (const task of tasks) {
		try {
			const cached = await plugin.cacheManager.getTaskInfo(task.path);
			const before = cached ? structuredClone(cached) : null;
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
				typeof value === "function"
					? (value as (task: TaskInfo) => TaskInfo[Property])(before)
					: value,
				{
					suppressNotice: true,
					onRecurringParentUpdated: (original, next) => {
						parentTransition = {
							original: structuredClone(original),
							updated: structuredClone(next),
						};
					},
				}
			);
			const modified = plugin.fieldMapper.toUserField("dateModified");
			updatedTasks.push(updated);
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
						).filter(
							(change) =>
								(change.property === property &&
									plugin.settings.userFields?.some(
										(field) => field.key === property
									)) ||
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
										(field === "tags" ? "tags" : plugin.fieldMapper.toUserField(
											field as Parameters<
												typeof plugin.fieldMapper.toUserField
											>[0]
										)) === change.property
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
							key !== "customProperties" &&
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
						const restoredContent = readCompletionContent(
							await plugin.app.vault.read(entry.file)
						);
						restored.customProperties = plugin.fieldMapper.mapFromFrontmatter(
							restoredContent.frontmatter,
							entry.file.path
						).customProperties;
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
		} catch {
			failed = true;
			failedTitles.push(task.title);
		}
	}
	if (feedback) {
		feedback.undo.push(...undo);
		feedback.failed ||= failed;
		feedback.failedTitles = [...(feedback.failedTitles ?? []), ...failedTitles];
	} else {
		const values = updatedTasks.map(task => {
			const configs = property === "status" ? plugin.statusManager.getAllStatuses() : property === "priority" ? plugin.priorityManager.getAllPriorities() : [];
			const config = configs.find(config => config.value === task[property]);
			return config ? configLabel(config) : String(task[property] ?? "—");
		});
		showTaskUndo(undo, failed, undo.length, plugin.app.vault, failed ? failedTitles.join(", ") : `${taskPropertyLabel(property as TaskPickerProperty)} → ${[...new Set(values)].join(", ")}${tasks.length > 1 ? ` · ${updatedTasks.length}` : ""}`,
			uiText(msg({ message: "Undid {property} change for {count, plural, one {# task} other {# tasks}}", context: "interaction property undo confirmation" }), { property: taskPropertyLabel(property as TaskPickerProperty), count: undo.length }));
	}
	return updatedTasks;
}

export function showTaskUndo(
	undo: Array<() => Promise<unknown>>,
	failed = false,
	count = undo.length,
	scope?: object,
	message?: string,
	undoMessage?: string
): void {
	if (!count && !failed) return;
	const updated = uiText(
		msg({
			message: "{count, plural, one {# task updated} other {# tasks updated}}",
			context: "interaction feedback",
		}),
		{ count }
	);
	const failure = uiText(
		msg({ message: "Could not update tasks", context: "interaction failure" })
	);
	const pending = [...undo];
	showToast({
		message: failed ? `${failure} · ${message ?? updated}${message && count ? ` · ${updated}` : ""}` : (message ?? updated),
		undoScope: scope,
		undoMessage,
		action: undo.length
			? {
					label: uiText(msg({ message: "Undo", context: "interaction undo" })),
					run: async () => {
						while (pending.length) {
							await pending[pending.length - 1]();
							pending.pop();
						}
					},
				}
			: undefined,
	});
}

export async function archiveTasksWithUndo(
	plugin: TaskNotesPlugin,
	tasks: readonly TaskInfo[],
	archived = true
): Promise<void> {
	const undo: Array<() => Promise<unknown>> = [];
	const failedTitles: string[] = [];
	let failed = false;
	for (const task of tasks) {
		try {
			const before = await plugin.cacheManager.getTaskInfo(task.path);
			if (!before || before.archived === archived) continue;
			const receipt = await captureTaskUndo(plugin, before, () => plugin.taskService.toggleArchive(before));
			if (receipt.undo) undo.push(receipt.undo);
		} catch {
			failed = true;
			failedTitles.push(task.title);
		}
	}
	showTaskUndo(undo, failed, undo.length, plugin.app.vault, failed ? failedTitles.join(", ") : uiText(archived
		? msg({ message: "{count, plural, one {# task archived} other {# tasks archived}}", context: "interaction feedback archive" })
		: msg({ message: "{count, plural, one {# task unarchived} other {# tasks unarchived}}", context: "interaction feedback unarchive" }), { count: undo.length }));
}

export async function openTaskPropertyPicker(
	plugin: TaskNotesPlugin,
	property: TaskPickerProperty,
	tasks: readonly TaskInfo[],
	anchor: PopoverOptions["anchor"]
): Promise<void> {
	if (!tasks.length) return;
	let changes = Promise.resolve();
	const multiple = ["tags", "contexts", "projects"].includes(property);
	const feedback: TaskUndoFeedback = { undo: [], failed: false };
	const previous = await Promise.all(tasks.map(async task => (await plugin.cacheManager.getTaskInfo(task.path))?.[property]));
	const apply = (value: TaskPropertyChoice) => {
		changes = changes.then(async () => { await changeTaskProperty(plugin, tasks, property, value, multiple ? feedback : undefined); });
	};
	await openTaskPropertyChoices(plugin, property, tasks, anchor, apply, () => {
		if (!multiple) return;
		void changes.then(async () => {
			const current = await Promise.all(tasks.map(async task => (await plugin.cacheManager.getTaskInfo(task.path))?.[property]));
			const count = current.filter((value, index) => JSON.stringify(value) !== JSON.stringify(previous[index])).length;
			if (count || feedback.failed) showTaskUndo(feedback.undo, feedback.failed, count, plugin.app.vault, feedback.failed ? feedback.failedTitles?.join(", ") : `${taskPropertyLabel(property)} → ${[...new Set(current.flatMap(value => Array.isArray(value) ? value : []))].join(", ") || "—"}`);
		});
	});
}

export async function openTaskPropertyChoices(
	plugin: TaskNotesPlugin,
	property: TaskPickerProperty,
	tasks: readonly TaskPickerValues[],
	anchor: PopoverOptions["anchor"],
	apply: (value: TaskPropertyChoice) => void,
	onClose?: () => void
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
			selected: tasks.every((task) => task[property] === config.value || (property === "priority" && !task.priority && "weight" in config && config.weight === 0)),
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
		if (property === "priority" && (configs.length || tasks.some((task) => !!task.priority)) && !configs.some((config) => "weight" in config && config.weight === 0)) items.push({ id: "", label: clear, selected: tasks.every((task) => !task.priority) });
		const needsSettings = !configs.length || tasks.some((task) => task[property] && !configs.some((config) => config.value === task[property]));
		let settingsId = "\u0000settings";
		while (items.some((item) => item.id === settingsId)) settingsId += "\u0000";
		if (needsSettings) items.push({ id: settingsId, label: uiText(msg({ message: "Task settings", context: "picker recovery action" })), renderLeading: (host) => setIcon(host, "settings") });
		return openListPicker({
			anchor,
			app: plugin.app,
			items,
			placeholder: label,
			emptyText: property === "priority"
				? uiText(msg({ message: "No matching priorities", context: "interaction picker" }))
				: uiText(msg({ message: "No matching statuses", context: "interaction picker" })),
			unfilteredEmptyText: property === "priority"
				? uiText(msg({ message: "No priorities configured", context: "interaction picker" }))
				: uiText(msg({ message: "No statuses configured", context: "interaction picker" })),
			showUnfilteredEmptyText: !configs.length,
			onChoose: (item) => {
				if (item.id === settingsId) {
					plugin.app.setting.open();
					plugin.app.setting.openTabById(plugin.manifest.id);
				} else apply(item.id);
			},
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
			group: option.category === "weekday"
				? uiText(msg({ message: "Weekdays", context: "contextMenus.date.weekdaysLabel" }))
				: undefined,
		}));
		if (currentValue) items.unshift({
			id: "current",
			label: taskDateLabel(currentValue, plugin.settings.calendarViewSettings.timeFormat),
			selected: true,
			renderLeading: (host) => setIcon(host, "calendar"),
		});
		items.unshift(
			{
				id: "custom",
				label: uiText(
					msg({ message: "Pick date & time…", context: "contextMenus.date.pickDateTime" })
				),
			}
		);
		items.push({ id: "clear", label: clear, selected: !currentValue });
		return openListPicker({
			anchor,
			app: plugin.app,
			items,
			revealSelected: false,
			placeholder: label,
			emptyText: label,
			createLabel: (query) => {
				const date = parse(query);
				return date ? taskDateLabel(date, plugin.settings.calendarViewSettings.timeFormat) :
					uiText(msg({ message: "Enter a valid date", context: "interaction date" }));
			},
			canCreate: (query) => !!parse(query),
			onCreate: (query) => {
				const date = parse(query);
				if (date) apply(date);
			},
			onChoose: (item) => {
				if (item.id === "current") return;
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
		onClose,
		items: [...values].sort((left, right) =>
			Number(tasks.every((task) => task[property]?.includes(right))) -
			Number(tasks.every((task) => task[property]?.includes(left))) || left.localeCompare(right)
		).map((value) => ({
			id: value,
			label: value,
			selected: tasks.every((task) => task[property]?.includes(value)),
		})),
		onChoose: (item) => toggle(item.id, !!item.selected),
		createLabel: (query) => query,
		onCreate: (query) => toggle(query, true),
	});
}
