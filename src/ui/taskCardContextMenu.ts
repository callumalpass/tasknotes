import { displayError } from "../i18n/runtime";
import type { MessageSuffix } from "../i18n/concepts";
import { messageForKey } from "../i18n/messages";
import { msg } from "@lingui/core/macro";
import { Notice, TFile, setIcon, setTooltip } from "obsidian";
import { BatchContextMenu } from "../components/BatchContextMenu";
import { showNoteContextMenu } from "../components/noteFileMenu";
import { TaskContextMenu } from "../components/TaskContextMenu";
import type TaskNotesPlugin from "../main";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { prepareInteractiveControl } from "./taskCardIndicators";

export interface TaskCardContextMenuButtonOptions {
	mainRow: HTMLElement;
	taskPath: string;
	plugin: TaskNotesPlugin;
	targetDate: Date;
	promoteOccurrenceControls?: boolean;
	occurrenceDate?: Date;
}

function tTaskCard(
	plugin: TaskNotesPlugin,
	key: MessageSuffix<"ui.taskCard.">,
	vars?: Record<string, string | number>
): string {
	return plugin.i18n.translate(messageForKey(`ui.taskCard.${key}`), vars);
}

function getTaskCardContextMenuLogger(plugin: TaskNotesPlugin) {
	return createTaskNotesLogger({
		tag: "TaskCard/ContextMenu",
		isDebugEnabled: () => plugin.settings.enableDebugLogging,
	});
}

export function createTaskCardContextMenuButton(
	options: TaskCardContextMenuButtonOptions
): HTMLElement {
	const { mainRow, taskPath, plugin, targetDate, promoteOccurrenceControls, occurrenceDate } = options;
	const taskOptionsLabel = tTaskCard(plugin, "taskOptions");
	const contextIcon = mainRow.createDiv({
		cls: "task-card__context-menu",
		attr: {
			"aria-label": taskOptionsLabel,
		},
	});

	setIcon(contextIcon, "ellipsis-vertical");
	setTooltip(contextIcon, taskOptionsLabel, { placement: "top" });
	prepareInteractiveControl(contextIcon);

	contextIcon.addEventListener("click", (e) => {
		e.stopPropagation();
		e.preventDefault();
		void showTaskContextMenu(e, taskPath, plugin, targetDate, {
			promoteOccurrenceControls,
			occurrenceDate,
		});
	});

	return contextIcon;
}

export interface TaskMenuOptions {
	promoteOccurrenceControls?: boolean;
	occurrenceDate?: Date;
	/** Runs after a menu action changes the task; refreshes the TaskNotes views by default. */
	onUpdate?: () => void;
}

export interface OpenTaskMenuOptions extends TaskMenuOptions {
	/** Whether the task can join a batch menu; calendar events that are not plain dates cannot. */
	canBatch?: boolean;
	/** The view's own batch menu; by default a batch menu that refreshes the TaskNotes views. */
	showBatchMenu?: (event: MouseEvent) => void;
}

/**
 * Opens the menu for a right-clicked task, the same way in every view: the
 * batch menu for Shift+right-click or a task in a multi-selection, otherwise
 * the task menu for `targetDate`, which leaves selection mode. A task that
 * cannot join a batch gets its own menu and leaves the selection alone.
 */
export async function openTaskMenu(
	event: MouseEvent,
	taskPath: string,
	plugin: TaskNotesPlugin,
	targetDate: Date,
	options: OpenTaskMenuOptions = {}
): Promise<void> {
	event.preventDefault();
	event.stopPropagation();
	const selection = plugin.taskSelectionService;
	if (selection && options.canBatch !== false) {
		// A keyboard context menu (Shift+F10) reports Shift but no mouse button.
		const extend = event.shiftKey && event.button === 2;
		if (extend || selection.getSelectionCount() > 1) {
			if (extend && !selection.isSelectionModeActive()) selection.enterSelectionMode();
			if (!selection.isSelected(taskPath)) selection.addToSelection(taskPath);
			if (options.showBatchMenu) options.showBatchMenu(event);
			else
				new BatchContextMenu({
					plugin,
					selectedPaths: selection.getSelectedPaths(),
					onUpdate: () => plugin.app.workspace.trigger("tasknotes:refresh-views"),
				}).show(event);
			return;
		}
		if (selection.isSelectionModeActive()) {
			selection.clearSelection();
			selection.exitSelectionMode();
		}
	}
	const target = event.target as HTMLElement | null;
	const card = target && typeof target.closest === "function" ? target.closest<HTMLElement>(".task-card") : null;
	if (card?.ownerDocument.body.classList.contains("is-mobile")) {
		if (!card.hasAttribute("tabindex")) card.tabIndex = -1;
		card.focus({ preventScroll: true });
	}
	await showTaskContextMenu(event, taskPath, plugin, targetDate, options);
}

/**
 * Show the task menu for a task, without batch handling; right-clicks go
 * through `openTaskMenu`.
 */
export async function showTaskContextMenu(
	event: MouseEvent,
	taskPath: string,
	plugin: TaskNotesPlugin,
	targetDate: Date,
	options: TaskMenuOptions = {}
): Promise<void> {
	const file = plugin.app.vault.getAbstractFileByPath(taskPath);
	const showFileMenuFallback = () => {
		if (file instanceof TFile) {
			showFileContextMenu(event, file, plugin);
		}
	};

	try {
		const task = await plugin.cacheManager.getTaskInfo(taskPath);
		if (!task) {
			showFileMenuFallback();
			return;
		}

		const contextOptions = {
			task,
			plugin,
			targetDate,
			occurrenceDate: options.occurrenceDate,
			promoteOccurrenceControls: options.promoteOccurrenceControls,
			onUpdate:
				options.onUpdate ??
				(() => {
					plugin.app.workspace.trigger("tasknotes:refresh-views");
				}),
		};
		const target = event.target as HTMLElement | null;
		const row = target && typeof target.closest === "function"
			? target.closest<HTMLElement>(".tn-tasknotesTaskList .task-card")
			: null;
		let onHide: (() => void) | undefined;
		if (row?.ownerDocument.body.classList.contains("is-mobile")) {
			const list = row.closest(".tn-tasknotesTaskList");
			onHide = () => {
				const document = row.ownerDocument;
				document.defaultView?.requestAnimationFrame(() => {
					if (
						!row.isConnected ||
						(document.activeElement !== document.body && document.activeElement !== list) ||
						document.querySelector(".menu")
					) return;
					if (!row.hasAttribute("tabindex")) row.tabIndex = -1;
					row.focus({ preventScroll: true });
				});
			};
		}
		const contextMenu = new TaskContextMenu({ ...contextOptions, onHide });

		contextMenu.show(event);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		getTaskCardContextMenuLogger(plugin).error("Error creating context menu", {
			category: "internal",
			operation: "create-context-menu",
			details: { taskPath, errorMessage },
			error,
		});
		new Notice(
			plugin.i18n.translate(msg({ message: "Failed to create context menu: {message}", context: "notices.interface.contextMenuFailed" }), { message: displayError(errorMessage) })
		);
		showFileMenuFallback();
	}
}

function showFileContextMenu(event: MouseEvent, file: TFile, plugin: TaskNotesPlugin): void {
	showNoteContextMenu({ x: event.clientX, y: event.clientY }, file, plugin, "tasknotes-bases-view");
}
