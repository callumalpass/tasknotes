import { Notice, TFile, type App } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { showTaskContextMenu } from "../ui/TaskCard";
import { DateContextMenu } from "../components/DateContextMenu";
import { PriorityContextMenu } from "../components/PriorityContextMenu";
import { StatusContextMenu } from "../components/StatusContextMenu";
import { RecurrenceContextMenu } from "../components/RecurrenceContextMenu";
import { addContextToList } from "../components/TaskContextMenu";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { showTextInputModal } from "../modals/TextInputModal";
import { ProjectSelectModal } from "../modals/ProjectSelectModal";
import { TagSuggest } from "../modals/taskModalSuggests";
import { UserFieldEditModal } from "../modals/UserFieldEditModal";
import { getDatePart, getTimePart, parseDateToUTC } from "../utils/dateUtils";
import { addTagsToList, parseTaskTagInput } from "../utils/taskTagList";
import { formatTasksForClipboard } from "../utils/taskClipboard";
import {
	addTaskToProject,
	getTaskProjectFiles,
	removeTaskFromProject,
} from "../services/taskRelationshipActions";
import type { TaskSelectionService } from "../services/TaskSelectionService";
import type { TaskListAction } from "./taskListKeyboardActions";

/**
 * View-supplied hooks that let `executeBasesTaskCardAction` stay view-agnostic.
 * Task List, Kanban, and Calendar (Agenda/list mode) each provide one of these,
 * wired up by `BasesTaskCardKeyboardController`.
 */
export interface BasesTaskCardActionContext {
	plugin: TaskNotesPlugin;
	app: App;
	taskSelectionService: TaskSelectionService | undefined;
	/** Resolves the paths a non-focus-specific action should target (selection, else focused card). */
	getTargetPaths(): string[];
	/** All currently visible task paths, for select-all. */
	getVisibleTaskPaths(): string[];
	/** Whether a path is currently visible/renderable, used to guard focus-only actions. */
	isPathVisible(path: string): boolean;
	/** Anchor element for context menus (usually the focused/hovered card). */
	getAnchor(): HTMLElement | null;
	/**
	 * The view's current date context: used directly for the keyboard-opened task
	 * context menu, and as a fallback when a task has no scheduled/due date to
	 * derive a completion-target date from.
	 */
	getCurrentTargetDate(): Date;
	/** Restores DOM focus to the remembered card; returns true if something was restored. */
	restoreFocus(): boolean;
	rootElement: HTMLElement | null;
	showBatchContextMenu(event: MouseEvent): void;
	createFileForView(): Promise<void>;
	/** Only Task List currently has an inline search box. */
	focusSearch?: () => void;
	/** Runs after a modal/menu opened by an action closes, so callers can resettle focus. */
	onOverlayClosed?: () => void;
}

/**
 * Determine the date to use when completing a recurring task from Bases.
 * Prefers the task's scheduled (or due) date to avoid marking the wrong instance.
 */
export function getTaskActionDate(task: TaskInfo, fallback: Date): Date {
	const dateStr = getDatePart(task.scheduled || task.due || "");
	return dateStr ? parseDateToUTC(dateStr) : fallback;
}

async function getTasksForPaths(
	context: BasesTaskCardActionContext,
	paths: string[]
): Promise<TaskInfo[]> {
	const tasks: TaskInfo[] = [];
	for (const path of paths) {
		const task = await context.plugin.cacheManager.getTaskInfo(path);
		if (task) tasks.push(task);
	}
	return tasks;
}

async function getActionTargets(context: BasesTaskCardActionContext): Promise<TaskInfo[]> {
	return getTasksForPaths(context, context.getTargetPaths());
}

export async function updateTasksProperty(
	context: BasesTaskCardActionContext,
	tasks: readonly TaskInfo[],
	property: keyof TaskInfo,
	value: unknown
): Promise<void> {
	for (const task of tasks) {
		await context.plugin.updateTaskProperty(task, property, value);
	}
}

export async function updateTasksStatus(
	context: BasesTaskCardActionContext,
	tasks: readonly TaskInfo[],
	status: string
): Promise<void> {
	for (const task of tasks) {
		if (task.recurrence && context.plugin.statusManager.isCompletedStatus(status)) {
			await context.plugin.toggleRecurringTaskComplete(
				task,
				getTaskActionDate(task, context.getCurrentTargetDate())
			);
		} else {
			await context.plugin.updateTaskProperty(task, "status", status);
		}
	}
}

/**
 * Executes a resolved Task List keyboard action against whichever tasks a view
 * currently targets. Extracted from `TaskListView.executeTaskListAction` so
 * Kanban and Calendar (Agenda/list mode) can reuse the same edit/menu/modal
 * behavior instead of reimplementing it. `navigate-*`/`jump-*` are intentionally
 * no-ops here: the keyboard controller resolves those against its own focus
 * controller before an action ever reaches this dispatcher.
 */
export async function executeBasesTaskCardAction(
	action: TaskListAction,
	focusedPath: string | null,
	context: BasesTaskCardActionContext
): Promise<void> {
	switch (action) {
		case "navigate-next":
		case "navigate-previous":
		case "jump-first":
		case "jump-last":
			return;
		case "clear-focus-and-selection": {
			context.taskSelectionService?.clearSelection();
			context.taskSelectionService?.exitSelectionMode();
			if (!context.restoreFocus()) {
				context.rootElement?.focus({ preventScroll: true });
			}
			return;
		}
		case "toggle-select": {
			if (!focusedPath || !context.isPathVisible(focusedPath)) return;
			context.taskSelectionService?.toggleSelection(focusedPath);
			return;
		}
		case "select-all": {
			const selectionService = context.taskSelectionService;
			if (!selectionService) return;
			const paths = context.getVisibleTaskPaths();
			selectionService.selectAll(paths);
			if (paths.length > 0) selectionService.enterSelectionMode();
			return;
		}
		case "copy-task-titles": {
			const tasks = await getActionTargets(context);
			if (tasks.length === 0) return;
			try {
				await navigator.clipboard.writeText(formatTasksForClipboard(tasks, "titles"));
				new Notice(`Copied ${tasks.length} task title${tasks.length === 1 ? "" : "s"}`);
			} catch {
				new Notice("Failed to copy task titles");
			}
			return;
		}
		case "toggle-archive": {
			const tasks = await getActionTargets(context);
			if (tasks.length === 0) return;
			const archived = tasks[0].archived === true;
			if (!tasks.every((task) => (task.archived === true) === archived)) {
				new Notice("Select tasks with the same archive state");
				return;
			}
			for (const task of tasks) {
				await context.plugin.taskService.toggleArchive(task);
			}
			new Notice(
				`${archived ? "Unarchived" : "Archived"} ${tasks.length} task${
					tasks.length === 1 ? "" : "s"
				}`
			);
			return;
		}
		case "create-task":
			await context.createFileForView();
			return;
		case "focus-search":
			context.focusSearch?.();
			return;
		case "edit-task": {
			const tasks = await getActionTargets(context);
			if (tasks[0]) await context.plugin.openTaskEditModal(tasks[0]);
			return;
		}
		case "open-context-menu": {
			if (!focusedPath) return;
			const anchor = context.getAnchor();
			const rect = anchor?.getBoundingClientRect();
			const menuEvent = new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				clientX: rect?.right ?? 0,
				clientY: rect?.top ?? 0,
			});
			const selectionService = context.taskSelectionService;
			if (selectionService && selectionService.getSelectionCount() > 1) {
				context.showBatchContextMenu(menuEvent);
				return;
			}
			await showTaskContextMenu(
				menuEvent,
				focusedPath,
				context.plugin,
				context.getCurrentTargetDate()
			);
			return;
		}
		case "open-task-notes": {
			for (const task of await getActionTargets(context)) {
				const file = context.app.vault.getAbstractFileByPath(task.path);
				if (file instanceof TFile) {
					await context.app.workspace.getLeaf("tab").openFile(file);
				}
			}
			return;
		}
		case "edit-due":
		case "edit-scheduled": {
			const dateType = action === "edit-due" ? "due" : "scheduled";
			const tasks = await getActionTargets(context);
			const anchor = context.getAnchor();
			if (tasks.length === 0 || !anchor) return;

			const currentValue = dateType === "due" ? tasks[0].due : tasks[0].scheduled;
			new DateContextMenu({
				currentValue: getDatePart(currentValue || ""),
				currentTime: getTimePart(currentValue || ""),
				onSelect: (dateValue, timeValue) => {
					const value = dateValue
						? timeValue
							? `${dateValue}T${timeValue}`
							: dateValue
						: undefined;
					void updateTasksProperty(context, tasks, dateType, value);
				},
				dateRole: dateType,
				plugin: context.plugin,
				app: context.app,
			}).showAtElement(anchor);
			return;
		}
		case "edit-priority": {
			const tasks = await getActionTargets(context);
			const anchor = context.getAnchor();
			if (tasks.length === 0 || !anchor) return;

			new PriorityContextMenu({
				currentValue: tasks[0].priority,
				onSelect: (value) => void updateTasksProperty(context, tasks, "priority", value),
				plugin: context.plugin,
			}).showAtElement(anchor);
			return;
		}
		case "mark-complete": {
			const tasks = await getActionTargets(context);
			for (const task of tasks) {
				if (task.recurrence) {
					await context.plugin.toggleRecurringTaskComplete(
						task,
						getTaskActionDate(task, context.getCurrentTargetDate())
					);
					continue;
				}

				const completedStatus = context.plugin.statusManager.getCompletedStatuses()[0] || "done";
				if (!context.plugin.statusManager.isCompletedStatus(task.status)) {
					await context.plugin.updateTaskProperty(task, "status", completedStatus);
				}
			}
			return;
		}
		case "edit-status": {
			const tasks = await getActionTargets(context);
			const anchor = context.getAnchor();
			if (tasks.length === 0 || !anchor) return;

			new StatusContextMenu({
				currentValue: tasks[0].status,
				onSelect: (value) => void updateTasksStatus(context, tasks, value),
				plugin: context.plugin,
			}).showAtElement(anchor);
			return;
		}
		case "edit-recurrence": {
			const tasks = await getActionTargets(context);
			const anchor = context.getAnchor();
			if (tasks.length === 0 || !anchor) return;

			new RecurrenceContextMenu({
				currentValue: typeof tasks[0].recurrence === "string" ? tasks[0].recurrence : undefined,
				currentAnchor: tasks[0].recurrence_anchor || "scheduled",
				scheduledDate: tasks[0].scheduled,
				onSelect: (value, recurrenceAnchor) => {
					void (async () => {
						await updateTasksProperty(context, tasks, "recurrence", value || undefined);
						if (recurrenceAnchor !== undefined) {
							await updateTasksProperty(context, tasks, "recurrence_anchor", recurrenceAnchor);
						}
					})();
				},
				app: context.plugin.app,
				plugin: context.plugin,
			}).showAtElement(anchor);
			return;
		}
		case "edit-time-estimate": {
			const tasks = await getActionTargets(context);
			if (tasks.length === 0) return;

			// Time estimate has no specialized quick editor, so reuse the established
			// numeric field modal to preserve keyboard, bulk-edit, and clear semantics.
			new UserFieldEditModal(context.plugin.app, context.plugin, {
				field: {
					id: "builtin-time-estimate",
					displayName: context.plugin.i18n.translate("modals.task.timeEstimateLabel"),
					key: "timeEstimate",
					type: "number",
				},
				tasks,
				onApply: async (value) => {
					const timeEstimate =
						typeof value === "number" && value > 0 ? value : undefined;
					for (const task of tasks) {
						await context.plugin.updateTaskProperty(task, "timeEstimate", timeEstimate, {
							silent: true,
						});
					}
				},
				onClose: () => {
					context.onOverlayClosed?.();
				},
			}).open();
			return;
		}
		case "add-tags": {
			const tasks = await getActionTargets(context);
			if (tasks.length === 0) return;

			const input = await showTextInputModal(context.plugin.app, {
				title: context.plugin.i18n.translate("contextMenus.task.addTag"),
				placeholder: context.plugin.i18n.translate("contextMenus.task.tagPlaceholder"),
				confirmText: context.plugin.i18n.translate("common.confirm"),
				cancelText: context.plugin.i18n.translate("common.cancel"),
				onInputReady: (inputEl) => {
					new TagSuggest(context.plugin.app, inputEl, context.plugin);
				},
			});
			const tags = parseTaskTagInput(input);
			if (tags.length === 0) return;

			for (const task of tasks) {
				await context.plugin.updateTaskProperty(task, "tags", addTagsToList(task.tags, tags));
			}
			return;
		}
		case "add-context": {
			const tasks = await getActionTargets(context);
			if (tasks.length === 0) return;

			const contextValue = await showTextInputModal(context.plugin.app, {
				title: context.plugin.i18n.translate("contextMenus.task.organization.addContext"),
				placeholder: context.plugin.i18n.translate(
					"contextMenus.task.organization.contextPlaceholder"
				),
				confirmText: context.plugin.i18n.translate("common.confirm"),
				cancelText: context.plugin.i18n.translate("common.cancel"),
			});
			if (!contextValue?.trim()) return;

			for (const task of tasks) {
				await context.plugin.updateTaskProperty(
					task,
					"contexts",
					addContextToList(task.contexts, contextValue)
				);
			}
			return;
		}
		case "add-project": {
			const paths = context.getTargetPaths();
			if (paths.length === 0) return;

			const tasks = (
				await Promise.all(paths.map((path) => context.plugin.cacheManager.getTaskInfo(path)))
			).filter((task): task is TaskInfo => task !== null);
			new ProjectSelectModal(
				context.plugin.app,
				context.plugin,
				(projectFile) => {
					if (!(projectFile instanceof TFile)) return;
					void (async () => {
						for (const path of paths) {
							const task = await context.plugin.cacheManager.getTaskInfo(path);
							if (task) await addTaskToProject(context.plugin, task, projectFile);
						}
					})();
				},
				{
					selectedProjects: getTaskProjectFiles(context.plugin, tasks),
					onRemove: async (projectFile) => {
						for (const path of paths) {
							const task = await context.plugin.cacheManager.getTaskInfo(path);
							if (task) {
								await removeTaskFromProject(context.plugin, task, projectFile);
							}
						}
					},
				}
			).open();
			return;
		}
		case "delete-tasks": {
			const tasks = await getActionTargets(context);
			if (tasks.length === 0) return;

			const confirmed = await showConfirmationModal(context.plugin.app, {
				title: tasks.length === 1 ? "Delete task" : "Delete tasks",
				message:
					tasks.length === 1
						? `Are you sure you want to delete "${tasks[0].title}"? This action cannot be undone.`
						: `Are you sure you want to delete ${tasks.length} tasks? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: context.plugin.i18n.translate("common.cancel"),
				isDestructive: true,
			});
			if (!confirmed) return;

			for (const task of tasks) {
				await context.plugin.taskService.deleteTask(task);
			}
			context.taskSelectionService?.clearSelection();
			return;
		}
		default: {
			// Runtime user-field actions share the same visible-target selection
			// path as built-in edits, so filtered-out selected tasks are excluded.
			if (!action.startsWith("edit-user-field:")) return;
			const fieldId = action.slice("edit-user-field:".length);
			const field = context.plugin.settings.userFields?.find(
				(candidate) => candidate.id === fieldId
			);
			if (!field) return;
			const tasks = await getActionTargets(context);
			if (tasks.length === 0) return;

			new UserFieldEditModal(context.plugin.app, context.plugin, {
				field,
				tasks,
				onApply: async (value, listChange) => {
					for (const task of tasks) {
						let taskValue = value;
						if (field.type === "list") {
							const customProperties = task.customProperties ?? {};
							const current = Array.isArray(customProperties[field.key])
								? (customProperties[field.key] as unknown[]).map(String)
								: [];
							const withoutRemoved = current.filter(
								(candidate) => !listChange?.removed?.includes(candidate)
							);
							taskValue = listChange?.added
								? [...withoutRemoved, listChange.added].filter(
										(candidate, index, list) => list.indexOf(candidate) === index
								  )
								: withoutRemoved;
						}
						await context.plugin.updateTaskProperty(
							task,
							field.key as keyof TaskInfo,
							taskValue,
							{ silent: true }
						);
					}
				},
				onClose: () => {
					context.onOverlayClosed?.();
				},
			}).open();
		}
	}
}
