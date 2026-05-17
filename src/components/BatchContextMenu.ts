import { Menu, Notice, TFile, type MenuItem } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { DateContextMenu, type DateOption } from "./DateContextMenu";
import { ContextMenu } from "./ContextMenu";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import {
	formatTasksForClipboard,
	type ClipboardTask,
	type TaskCopyFormat,
} from "../utils/taskClipboard";

type SubmenuMenuItem = {
	setSubmenu(): Menu;
	dom?: HTMLElement;
	domEl?: HTMLElement;
};

function getSubmenu(item: MenuItem): Menu {
	return (item as unknown as SubmenuMenuItem).setSubmenu();
}

function getMenuItemElement(item: MenuItem): HTMLElement | null {
	const menuItem = item as unknown as SubmenuMenuItem;
	return menuItem.dom ?? menuItem.domEl ?? null;
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
		this.options = options;
		this.buildMenu();
	}

	private t(key: string, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}

	private buildMenu(): void {
		const { selectedPaths } = this.options;
		const count = selectedPaths.length;

		// Header showing selection count
		this.menu.addItem((item) => {
			item.setTitle(`${count} tasks selected`);
			item.setIcon("check-square");
			item.setDisabled(true);
		});

		this.menu.addSeparator();

		// Status submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.status"));
			item.setIcon("circle");

			const submenu = getSubmenu(item);
			this.addStatusOptions(submenu);
		});

		// Priority submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.priority"));
			item.setIcon("star");

			const submenu = getSubmenu(item);
			this.addPriorityOptions(submenu);
		});

		this.menu.addSeparator();

		// Due Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.dueDate"));
			item.setIcon("calendar");

			const submenu = getSubmenu(item);
			this.addDateOptions(submenu, "due");
		});

		// Scheduled Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.scheduledDate"));
			item.setIcon("calendar-clock");

			const submenu = getSubmenu(item);
			this.addDateOptions(submenu, "scheduled");
		});

		this.menu.addSeparator();

		// Archive/Unarchive
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.archive"));
			item.setIcon("archive");
			item.onClick(async () => {
				await this.batchArchive(true);
			});
		});

		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.unarchive"));
			item.setIcon("archive-restore");
			item.onClick(async () => {
				await this.batchArchive(false);
			});
		});

		this.menu.addSeparator();

		// Copy selected tasks
		this.menu.addItem((item) => {
			item.setTitle("Copy selected tasks");
			item.setIcon("copy");

			const submenu = getSubmenu(item);
			this.addCopyOptions(submenu);
		});

		this.menu.addSeparator();

		// Clear selection
		this.menu.addItem((item) => {
			item.setTitle("Clear selection");
			item.setIcon("x");
			item.onClick(() => {
				this.options.plugin.taskSelectionService?.clearSelection();
				this.options.plugin.taskSelectionService?.exitSelectionMode();
			});
		});

		// Delete (dangerous)
		this.menu.addSeparator();

		this.menu.addItem((item) => {
			item.setTitle(`Delete ${count} tasks`);
			item.setIcon("trash");
			item.onClick(async () => {
				await this.batchDelete();
			});
		});
	}

	private addCopyOptions(submenu: Menu): void {
		const options: Array<{ title: string; icon: string; format: TaskCopyFormat }> = [
			{ title: "Copy filenames", icon: "file-text", format: "filenames" },
			{ title: "Copy Markdown links", icon: "link", format: "markdown-links" },
			{ title: "Copy titles", icon: "text", format: "titles" },
			{ title: "Copy paths", icon: "copy", format: "paths" },
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

	private addStatusOptions(submenu: Menu): void {
		const statusConfigs = this.options.plugin.settings.customStatuses;
		const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);

		for (const status of sortedStatuses) {
			submenu.addItem((item) => {
				item.setTitle(status.label);
				// Use custom icon if configured, otherwise default to circle
				item.setIcon(status.icon || "circle");
				item.onClick(async () => {
					await this.batchUpdateProperty("status", status.value);
				});

				// Apply color to icon
				if (status.color) {
					window.setTimeout(() => {
						const itemEl = getMenuItemElement(item);
						if (itemEl) {
							const iconEl = itemEl.querySelector(".menu-item-icon");
							if (iconEl) {
								(iconEl as HTMLElement).style.color = status.color;
							}
						}
					}, 10);
				}
			});
		}
	}

	private addPriorityOptions(submenu: Menu): void {
		const priorityOptions = this.options.plugin.priorityManager.getPrioritiesByWeight();

		for (const priority of priorityOptions) {
			submenu.addItem((item) => {
				item.setTitle(priority.label);
				item.setIcon("star");
				item.onClick(async () => {
					await this.batchUpdateProperty("priority", priority.value);
				});

				// Apply color to icon
				if (priority.color) {
					window.setTimeout(() => {
						const itemEl = getMenuItemElement(item);
						if (itemEl) {
							const iconEl = itemEl.querySelector(".menu-item-icon");
							if (iconEl) {
								(iconEl as HTMLElement).style.color = priority.color;
							}
						}
					}, 10);
				}
			});
		}

		// Add option to clear priority
		submenu.addSeparator();
		submenu.addItem((item) => {
			item.setTitle(this.t("contextMenus.priority.clearPriority"));
			item.setIcon("x");
			item.onClick(async () => {
				await this.batchUpdateProperty("priority", undefined);
			});
		});
	}

	private addDateOptions(submenu: Menu, dateType: "due" | "scheduled"): void {
		const dateContextMenu = new DateContextMenu({
			currentValue: undefined,
			onSelect: () => {},
			plugin: this.options.plugin,
			app: this.options.plugin.app,
		});

		const dateOptions = dateContextMenu.getDateOptions();

		// Basic date options only (skip increment options as they don't work correctly for batch)
		const basicOptions = dateOptions.filter(
			(option: DateOption) => option.category === "basic"
		);
		for (const option of basicOptions) {
			submenu.addItem((item) => {
				if (option.icon) item.setIcon(option.icon);
				item.setTitle(option.label);
				item.onClick(async () => {
					await this.batchUpdateProperty(dateType, option.value);
				});
			});
		}

		// Clear date option
		submenu.addSeparator();
		submenu.addItem((item) => {
			item.setTitle(this.t("contextMenus.date.clearDate"));
			item.setIcon("x");
			item.onClick(async () => {
				await this.batchUpdateProperty(dateType, undefined);
			});
		});
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
		new Notice(`Copied ${tasks.length} tasks`);
	}

	private getMarkdownLinkText(path: string): string {
		const file = this.options.plugin.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			return this.options.plugin.app.metadataCache.fileToLinktext(file, "");
		}
		return path;
	}

	private async batchUpdateProperty(property: keyof TaskInfo, value: unknown): Promise<void> {
		const { plugin, selectedPaths, onUpdate } = this.options;
		const count = selectedPaths.length;

		try {
			new Notice(`Updating ${count} tasks...`);

			let successCount = 0;
			let failCount = 0;

			for (const path of selectedPaths) {
				try {
					const task = await plugin.cacheManager.getTaskInfo(path);
					if (task) {
						await plugin.taskService.updateProperty(task, property, value);
						successCount++;
					} else {
						failCount++;
					}
				} catch (e) {
					console.error(`[BatchContextMenu] Failed to update task ${path}:`, e);
					failCount++;
				}
			}

			if (failCount === 0) {
				new Notice(`Updated ${successCount} tasks`);
			} else {
				new Notice(`Updated ${successCount} tasks, ${failCount} failed`);
			}

			// Clear selection after successful batch operation
			plugin.taskSelectionService?.clearSelection();
			plugin.taskSelectionService?.exitSelectionMode();

			onUpdate?.();
		} catch (error) {
			console.error("[BatchContextMenu] Batch update failed:", error);
			new Notice("Failed to update tasks");
		}
	}

	private async batchArchive(archive: boolean): Promise<void> {
		const { plugin, selectedPaths, onUpdate } = this.options;
		const count = selectedPaths.length;

		try {
			new Notice(`${archive ? "Archiving" : "Unarchiving"} ${count} tasks...`);

			let successCount = 0;
			let failCount = 0;

			for (const path of selectedPaths) {
				try {
					const task = await plugin.cacheManager.getTaskInfo(path);
					if (task && task.archived !== archive) {
						await plugin.toggleTaskArchive(task);
						successCount++;
					} else if (task) {
						// Task already in desired state
						successCount++;
					} else {
						failCount++;
					}
				} catch (e) {
					console.error(`[BatchContextMenu] Failed to archive task ${path}:`, e);
					failCount++;
				}
			}

			if (failCount === 0) {
				new Notice(`${archive ? "Archived" : "Unarchived"} ${successCount} tasks`);
			} else {
				new Notice(
					`${archive ? "Archived" : "Unarchived"} ${successCount} tasks, ${failCount} failed`
				);
			}

			// Clear selection after successful batch operation
			plugin.taskSelectionService?.clearSelection();
			plugin.taskSelectionService?.exitSelectionMode();

			onUpdate?.();
		} catch (error) {
			console.error("[BatchContextMenu] Batch archive failed:", error);
			new Notice("Failed to archive tasks");
		}
	}

	private async batchDelete(): Promise<void> {
		const { plugin, selectedPaths, onUpdate } = this.options;
		const count = selectedPaths.length;

		// Show confirmation dialog
		const confirmed = await showConfirmationModal(plugin.app, {
			title: "Delete tasks",
			message: `Are you sure you want to delete ${count} tasks? This action cannot be undone.`,
			confirmText: "Delete",
			cancelText: this.t("common.cancel"),
			isDestructive: true,
		});

		if (!confirmed) return;

		try {
			new Notice(`Deleting ${count} tasks...`);

			let successCount = 0;
			let failCount = 0;

			for (const path of selectedPaths) {
				try {
					const task = await plugin.cacheManager.getTaskInfo(path);
					if (task) {
						await plugin.taskService.deleteTask(task);
						successCount++;
					} else {
						failCount++;
					}
				} catch (e) {
					console.error(`[BatchContextMenu] Failed to delete task ${path}:`, e);
					failCount++;
				}
			}

			if (failCount === 0) {
				new Notice(`Deleted ${successCount} tasks`);
			} else {
				new Notice(`Deleted ${successCount} tasks, ${failCount} failed`);
			}

			// Clear selection after successful batch operation
			plugin.taskSelectionService?.clearSelection();
			plugin.taskSelectionService?.exitSelectionMode();

			onUpdate?.();
		} catch (error) {
			console.error("[BatchContextMenu] Batch delete failed:", error);
			new Notice("Failed to delete tasks");
		}
	}

	public show(event: MouseEvent): void {
		this.menu.showAtMouseEvent(event);
	}

	public showAtPosition(x: number, y: number): void {
		this.menu.showAtPosition({ x, y });
	}
}
