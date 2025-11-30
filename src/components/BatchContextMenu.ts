import { Menu, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { DateContextMenu } from "./DateContextMenu";
import { ContextMenu } from "./ContextMenu";
import { showConfirmationModal } from "../modals/ConfirmationModal";

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
		const { plugin, selectedPaths } = this.options;
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

			const submenu = (item as any).setSubmenu();
			this.addStatusOptions(submenu);
		});

		// Priority submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.priority"));
			item.setIcon("star");

			const submenu = (item as any).setSubmenu();
			this.addPriorityOptions(submenu);
		});

		this.menu.addSeparator();

		// Due Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.dueDate"));
			item.setIcon("calendar");

			const submenu = (item as any).setSubmenu();
			this.addDateOptions(submenu, "due");
		});

		// Scheduled Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.scheduledDate"));
			item.setIcon("calendar-clock");

			const submenu = (item as any).setSubmenu();
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

	private addStatusOptions(submenu: Menu): void {
		const statusConfigs = this.options.plugin.settings.customStatuses;
		const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);

		for (const status of sortedStatuses) {
			submenu.addItem((item: any) => {
				item.setTitle(status.label);
				// Use custom icon if configured, otherwise default to circle
				item.setIcon(status.icon || "circle");
				item.onClick(async () => {
					await this.batchUpdateProperty("status", status.value);
				});

				// Apply color to icon
				if (status.color) {
					setTimeout(() => {
						const itemEl = item.dom || item.domEl;
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
			submenu.addItem((item: any) => {
				item.setTitle(priority.label);
				item.setIcon("star");
				item.onClick(async () => {
					await this.batchUpdateProperty("priority", priority.value);
				});

				// Apply color to icon
				if (priority.color) {
					setTimeout(() => {
						const itemEl = item.dom || item.domEl;
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
		submenu.addItem((item: any) => {
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
		const basicOptions = dateOptions.filter((option: any) => option.category === "basic");
		for (const option of basicOptions) {
			submenu.addItem((item: any) => {
				if (option.icon) item.setIcon(option.icon);
				item.setTitle(option.label);
				item.onClick(async () => {
					await this.batchUpdateProperty(dateType, option.value);
				});
			});
		}

		// Clear date option
		submenu.addSeparator();
		submenu.addItem((item: any) => {
			item.setTitle(this.t("contextMenus.date.clearDate"));
			item.setIcon("x");
			item.onClick(async () => {
				await this.batchUpdateProperty(dateType, undefined);
			});
		});
	}

	private async batchUpdateProperty(property: keyof TaskInfo, value: any): Promise<void> {
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
				new Notice(`${archive ? "Archived" : "Unarchived"} ${successCount} tasks, ${failCount} failed`);
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
					const file = plugin.app.vault.getAbstractFileByPath(path);
					if (file) {
						await plugin.app.vault.trash(file, true);
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
