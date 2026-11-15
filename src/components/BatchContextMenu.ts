import { renderPriorityMenuGlyph, renderTaskMenuKeyHint } from "../ui/kit/menu";
import { archiveTasksWithUndo, openTaskPropertyPicker, type TaskPickerProperty } from "../ui/taskPropertyPickers";
import { menuItemAnchor } from "./task-context-menu/helpers";
import { uiText } from "../i18n/runtime";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, Notice, TFile, type MenuItem } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { ContextMenu } from "./ContextMenu";
import { closeActiveContextMenu, showCoordinatedMenu } from "./ContextMenuCoordinator";
import { deleteNotesWithUndo } from "../ui/noteDeletion";
import {
	formatTasksForClipboard,
	type ClipboardTask,
	type TaskCopyFormat,
} from "../utils/taskClipboard";

type SubmenuMenuItem = {
	setSubmenu(): Menu;
};

function getSubmenu(item: MenuItem): Menu {
	return (item as unknown as SubmenuMenuItem).setSubmenu();
}


export interface BatchContextMenuOptions {
	plugin: TaskNotesPlugin;
	selectedPaths: string[];
	onUpdate?: () => void;
}

/**
 * Context menu for batch operations on multiple selected tasks.
 */
export class BatchContextMenu {
	private menu: ContextMenu;
	private options: BatchContextMenuOptions;

	constructor(options: BatchContextMenuOptions) {
		this.menu = new ContextMenu();
		// Keep the target set stable while a date picker is open.
		this.options = { ...options, selectedPaths: [...options.selectedPaths] };
		this.buildMenu();
	}

	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}

	private buildMenu(): void {
		const { selectedPaths } = this.options;
		const count = selectedPaths.length;

		// Header showing selection count
		this.menu.addItem((item) => {
			item.setTitle(uiText(msg({ message: "{count, plural, one {# task selected} other {# tasks selected}}", context: "components/BatchContextMenu: BatchContextMenu.buildMenu display" }), { count: count }));
			item.setIcon("check-square");
			item.setDisabled(true);
		});

		this.menu.addSeparator();

		const pickerItem = (
			property: Exclude<TaskPickerProperty, "contexts" | "projects">,
			title: string,
			icon: string | null
		) =>
			this.menu.addItem((item) => {
				item.setTitle(title);
				renderTaskMenuKeyHint(item, property);
				if (icon) item.setIcon(icon);
				else renderPriorityMenuGlyph(item, {}, this.options.plugin.priorityManager.getPrioritiesByWeight());
				item.onClick((event) => {
					const anchor = menuItemAnchor(item, event);
					void this.selectedTasks().then((tasks) =>
						openTaskPropertyPicker(this.options.plugin, property, tasks, anchor, () => this.finishBatch())
					);
				});
			});

		pickerItem("status", this.t(msg({ message: "Status", context: "contextMenus.task.status" })), "circle");
		pickerItem("priority", this.t(msg({ message: "Priority", context: "contextMenus.task.priority" })), null);
		pickerItem("tags", this.t(msg({ message: "Tags", context: "contextMenus.task.tags" })), "tags");
		this.menu.addSeparator();
		pickerItem("due", this.t(msg({ message: "Due date", context: "contextMenus.task.dueDate" })), "calendar");
		pickerItem("scheduled", this.t(msg({ message: "Scheduled date", context: "contextMenus.task.scheduledDate" })), "calendar-clock");

		this.menu.addSeparator();

		// Archive/Unarchive
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Archive", context: "contextMenus.task.archive" })));
			item.setIcon("archive");
			item.onClick(async () => {
				await this.batchArchive(true);
			});
		});

		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Unarchive", context: "contextMenus.task.unarchive" })));
			item.setIcon("archive-restore");
			item.onClick(async () => {
				await this.batchArchive(false);
			});
		});

		this.menu.addSeparator();

		// Copy selected tasks
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Copy selected tasks", context: "ui.audit.copySelected" })));
			item.setIcon("copy");

			const submenu = getSubmenu(item);
			this.addCopyOptions(submenu);
		});

		this.menu.addSeparator();

		// Clear selection
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Clear selection", context: "ui.audit.clearSelection" })));
			item.setIcon("x");
			item.onClick(() => {
				this.options.plugin.taskSelectionService?.clearSelection();
				this.options.plugin.taskSelectionService?.exitSelectionMode();
			});
		});

		// Delete (dangerous)
		this.menu.addSeparator();

		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Delete tasks", context: "notices.audit.deleteTitle" })) + ` (${count})`);
			item.setIcon("trash");
			item.onClick(async () => {
				await this.batchDelete();
			});
		});
	}

	private addCopyOptions(submenu: Menu): void {
		const options: Array<{ title: string; icon: string; format: TaskCopyFormat }> = [
			{ title: uiText(msg({ message: "Copy filenames", context: "components/BatchContextMenu: BatchContextMenu.addCopyOptions title" })), icon: "file-text", format: "filenames" },
			{ title: uiText(msg({ message: "Copy Markdown links", context: "components/BatchContextMenu: BatchContextMenu.addCopyOptions title" })), icon: "link", format: "markdown-links" },
			{ title: uiText(msg({ message: "Copy titles", context: "components/BatchContextMenu: BatchContextMenu.addCopyOptions title" })), icon: "text", format: "titles" },
			{ title: uiText(msg({ message: "Copy paths", context: "components/BatchContextMenu: BatchContextMenu.addCopyOptions title" })), icon: "copy", format: "paths" },
		];

		for (const option of options) {
			submenu.addItem((item) => {
				item.setTitle(option.title);
				item.setIcon(option.icon);
				item.onClick(async () => {
					await this.copySelectedTasks(option.format);
				});
			});
		}
	}

	private async copySelectedTasks(format: TaskCopyFormat): Promise<void> {
		const { plugin, selectedPaths } = this.options;
		const tasks: ClipboardTask[] = [];

		for (const path of selectedPaths) {
			const task = await plugin.cacheManager.getTaskInfo(path);
			tasks.push({
				path,
				title: task?.title,
			});
		}

		const text = formatTasksForClipboard(tasks, format, (task) =>
			this.getMarkdownLinkText(task.path)
		);
		await navigator.clipboard.writeText(text);
		new Notice(this.t(msg({ message: "Tasks copied: {count}", context: "notices.audit.copiedTasks" }), { count: tasks.length }));
	}

	private getMarkdownLinkText(path: string): string {
		const file = this.options.plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return this.options.plugin.app.metadataCache.fileToLinktext(file, "");
		}
		return path;
	}

	private async selectedTasks(): Promise<TaskInfo[]> {
		const { plugin, selectedPaths } = this.options;
		const tasks = await Promise.all(selectedPaths.map((path) => plugin.cacheManager.getTaskInfo(path)));
		if (tasks.some((task) => !task)) {
			new Notice(uiText(msg({ message: "Could not update tasks", context: "interaction failure" })));
			return [];
		}
		return tasks.filter((task): task is TaskInfo => !!task);
	}

	private finishBatch(): void {
		this.options.plugin.taskSelectionService?.clearSelection();
		this.options.plugin.taskSelectionService?.exitSelectionMode();
		this.options.onUpdate?.();
	}

	private async batchArchive(archive: boolean): Promise<void> {
		await archiveTasksWithUndo(this.options.plugin, await this.selectedTasks(), archive);
		this.finishBatch();
	}

	private async batchDelete(): Promise<void> {
		const { plugin } = this.options;
		const tasks = await this.selectedTasks();
		const targets = tasks.flatMap((task) => {
			const file = plugin.app.vault.getAbstractFileByPath(task.path);
			return file instanceof TFile ? [{ file, task }] : [];
		});
		if (!targets.length) return;
		await deleteNotesWithUndo(plugin, targets);
		this.finishBatch();
	}

	public show(event: MouseEvent): void {
		showCoordinatedMenu(this.menu, event);
	}

	public showAtPosition(x: number, y: number): void {
		closeActiveContextMenu();
		this.menu.showAtPosition({ x, y });
	}
}
