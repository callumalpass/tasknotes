import { Menu, Notice, TFile, setIcon, setTooltip } from "obsidian";
import { TaskContextMenu } from "../components/TaskContextMenu";
import type TaskNotesPlugin from "../main";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { prepareInteractiveControl } from "./taskCardIndicators";

type MenuWithItems = {
	items?: unknown[];
};

export interface TaskCardContextMenuButtonOptions {
	mainRow: HTMLElement;
	taskPath: string;
	plugin: TaskNotesPlugin;
	targetDate: Date;
	promoteOccurrenceControls?: boolean;
}

function tTaskCard(
	plugin: TaskNotesPlugin,
	key: string,
	vars?: Record<string, string | number>
): string {
	return plugin.i18n.translate(`ui.taskCard.${key}`, vars);
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
	const { mainRow, taskPath, plugin, targetDate, promoteOccurrenceControls } = options;
	const taskOptionsLabel = tTaskCard(plugin, "taskOptions");
	const contextIcon = mainRow.createEl("div", {
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
		if (promoteOccurrenceControls === undefined) {
			void showTaskContextMenu(e, taskPath, plugin, targetDate);
			return;
		}
		void showTaskContextMenu(e, taskPath, plugin, targetDate, { promoteOccurrenceControls });
	});

	return contextIcon;
}

/**
 * Show context menu for task card.
 */
export async function showTaskContextMenu(
	event: MouseEvent,
	taskPath: string,
	plugin: TaskNotesPlugin,
	targetDate: Date,
	options: { promoteOccurrenceControls?: boolean } = {}
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

		const contextMenu = new TaskContextMenu({
			task,
			plugin,
			targetDate,
			promoteOccurrenceControls: options.promoteOccurrenceControls,
			onUpdate: () => {
				plugin.app.workspace.trigger("tasknotes:refresh-views");
			},
		});

		contextMenu.show(event);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		getTaskCardContextMenuLogger(plugin).error("Error creating context menu", {
			category: "internal",
			operation: "create-context-menu",
			details: { taskPath, errorMessage },
			error,
		});
		new Notice(`Failed to create context menu: ${errorMessage}`);
		showFileMenuFallback();
	}
}

function showFileContextMenu(event: MouseEvent, file: TFile, plugin: TaskNotesPlugin): void {
	const menu = new Menu();

	let populated = false;
	try {
		plugin.app.workspace.trigger("file-menu", menu, file, "tasknotes-bases-view");
		populated = ((menu as MenuWithItems).items?.length ?? 0) > 0;
	} catch {
		populated = false;
	}

	if (!populated) {
		menu.addItem((item) => {
			item.setTitle("Open");
			item.setIcon("file-text");
			item.onClick(() => {
				void plugin.app.workspace.getLeaf(false).openFile(file);
			});
		});
		menu.addItem((item) => {
			item.setTitle("Open in new tab");
			item.setIcon("external-link");
			item.onClick(() => {
				void plugin.app.workspace.openLinkText(file.path, "", true);
			});
		});
	}

	menu.showAtMouseEvent(event);
}
