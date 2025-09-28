import { Menu, Notice, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskDependency, TaskInfo } from "../types";
import { formatDateForStorage } from "../utils/dateUtils";
import { ReminderModal } from "../modals/ReminderModal";
import { CalendarExportService } from "../services/CalendarExportService";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { DateContextMenu } from "./DateContextMenu";
import { RecurrenceContextMenu } from "./RecurrenceContextMenu";
import { showTextInputModal } from "../modals/TextInputModal";
import { TaskSelectorModal } from "../modals/TaskSelectorModal";
import {
	DEFAULT_DEPENDENCY_RELTYPE,
	formatDependencyLink,
	normalizeDependencyEntry,
} from "../utils/dependencyUtils";

export interface TaskContextMenuOptions {
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	targetDate: Date;
	onUpdate?: () => void;
}

export class TaskContextMenu {
	private menu: Menu;
	private options: TaskContextMenuOptions;

	constructor(options: TaskContextMenuOptions) {
		this.menu = new Menu();
		this.options = options;
		this.buildMenu();
	}

	private t(key: string, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}

	private buildMenu(): void {
		const { task, plugin } = this.options;

		// Status submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.status"));
			item.setIcon("circle");

			const submenu = (item as any).setSubmenu();
			this.addStatusOptions(submenu, task, plugin);
		});

		// Add completion toggle for recurring tasks
		if (task.recurrence) {
			this.menu.addSeparator();

			const dateStr = formatDateForStorage(this.options.targetDate);
			const isCompletedForDate = task.complete_instances?.includes(dateStr) || false;

			this.menu.addItem((item) => {
				item.setTitle(
					isCompletedForDate
						? this.t("contextMenus.task.markIncomplete")
						: this.t("contextMenus.task.markComplete")
				);
				item.setIcon(isCompletedForDate ? "x" : "check");
				item.onClick(async () => {
					try {
						await plugin.toggleRecurringTaskComplete(task, this.options.targetDate);
						this.options.onUpdate?.();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.error("Error toggling recurring task completion:", {
							error: errorMessage,
							taskPath: task.path,
						});
						new Notice(
							this.t("contextMenus.task.notices.toggleCompletionFailure", {
								message: errorMessage,
							})
						);
					}
				});
			});
		}

		this.menu.addSeparator();

		// Priority submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.priority"));
			item.setIcon("star");

			const submenu = (item as any).setSubmenu();
			this.addPriorityOptions(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Due Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.dueDate"));
			item.setIcon("calendar");

			const submenu = (item as any).setSubmenu();
			this.addDateOptions(
				submenu,
				task.due,
				async (value: string | null) => {
					try {
						await plugin.updateTaskProperty(task, "due", value || undefined);
						this.options.onUpdate?.();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.error("Error updating task due date:", {
							error: errorMessage,
							taskPath: task.path,
						});
						new Notice(
							this.t("contextMenus.task.notices.updateDueDateFailure", {
								message: errorMessage,
							})
						);
					}
				},
				() => {
					plugin.openDueDateModal(task);
				}
			);
		});

		// Scheduled Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.scheduledDate"));
			item.setIcon("calendar-clock");

			const submenu = (item as any).setSubmenu();
			this.addDateOptions(
				submenu,
				task.scheduled,
				async (value: string | null) => {
					try {
						await plugin.updateTaskProperty(task, "scheduled", value || undefined);
						this.options.onUpdate?.();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.error("Error updating task scheduled date:", {
							error: errorMessage,
							taskPath: task.path,
						});
						new Notice(
							this.t("contextMenus.task.notices.updateScheduledFailure", {
								message: errorMessage,
							})
						);
					}
				},
				() => {
					plugin.openScheduledDateModal(task);
				}
			);
		});

		// Reminders submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.reminders"));
			item.setIcon("bell");

			const submenu = (item as any).setSubmenu();

			// Quick Add sections
			this.addQuickRemindersSection(
				submenu,
				task,
				plugin,
				"due",
				this.t("contextMenus.task.remindBeforeDue")
			);
			this.addQuickRemindersSection(
				submenu,
				task,
				plugin,
				"scheduled",
				this.t("contextMenus.task.remindBeforeScheduled")
			);

			submenu.addSeparator();

			// Manage reminders
			submenu.addItem((subItem: any) => {
				subItem.setTitle(this.t("contextMenus.task.manageReminders"));
				subItem.setIcon("settings");
				subItem.onClick(() => {
					const modal = new ReminderModal(plugin.app, plugin, task, async (reminders) => {
						try {
							await plugin.updateTaskProperty(
								task,
								"reminders",
								reminders.length > 0 ? reminders : undefined
							);
							this.options.onUpdate?.();
						} catch (error) {
							console.error("Error updating reminders:", error);
							new Notice(this.t("contextMenus.task.notices.updateRemindersFailure"));
						}
					});
					modal.open();
				});
			});

			// Clear reminders (if any exist)
			if (task.reminders && task.reminders.length > 0) {
				submenu.addItem((subItem: any) => {
					subItem.setTitle(this.t("contextMenus.task.clearReminders"));
					subItem.setIcon("trash");
					subItem.onClick(async () => {
						try {
							await plugin.updateTaskProperty(task, "reminders", undefined);
							this.options.onUpdate?.();
						} catch (error) {
							console.error("Error clearing reminders:", error);
							new Notice(this.t("contextMenus.task.notices.clearRemindersFailure"));
						}
					});
				});
			}
		});

		this.menu.addSeparator();

		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.dependencies.title"));
			item.setIcon("git-branch");

			const submenu = (item as any).setSubmenu();
			this.addDependencyMenuItems(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Time Tracking
		this.menu.addItem((item) => {
			const activeSession = plugin.getActiveTimeSession(task);
			item.setTitle(
				activeSession
					? this.t("contextMenus.task.stopTimeTracking")
					: this.t("contextMenus.task.startTimeTracking")
			);
			item.setIcon(activeSession ? "pause" : "play");
			item.onClick(async () => {
				const activeSession = plugin.getActiveTimeSession(task);
				if (activeSession) {
					await plugin.stopTimeTracking(task);
				} else {
					await plugin.startTimeTracking(task);
				}
				this.options.onUpdate?.();
			});
		});

		// Archive/Unarchive
		this.menu.addItem((item) => {
			item.setTitle(
				task.archived
					? this.t("contextMenus.task.unarchive")
					: this.t("contextMenus.task.archive")
			);
			item.setIcon(task.archived ? "archive-restore" : "archive");
			item.onClick(async () => {
				try {
					await plugin.toggleTaskArchive(task);
					this.options.onUpdate?.();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error("Error toggling task archive:", {
						error: errorMessage,
						taskPath: task.path,
					});
					new Notice(
						this.t("contextMenus.task.notices.archiveFailure", {
							message: errorMessage,
						})
					);
				}
			});
		});

		this.menu.addSeparator();

		// Open Note
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.openNote"));
			item.setIcon("file-text");
			item.onClick(() => {
				const file = plugin.app.vault.getAbstractFileByPath(task.path);
				if (file instanceof TFile) {
					plugin.app.workspace.getLeaf(false).openFile(file);
				}
			});
		});

		// Copy Task Title
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.copyTitle"));
			item.setIcon("copy");
			item.onClick(async () => {
				try {
					await navigator.clipboard.writeText(task.title);
					new Notice(this.t("contextMenus.task.notices.copyTitleSuccess"));
				} catch (error) {
					new Notice(this.t("contextMenus.task.notices.copyFailure"));
				}
			});
		});

		// Note actions submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.noteActions"));
			item.setIcon("file-text");

			const submenu = (item as any).setSubmenu();

			// Get the file for the task
			const file = plugin.app.vault.getAbstractFileByPath(task.path);
			if (file instanceof TFile) {
				// Try to populate with Obsidian's native file menu
				try {
					// Trigger the file-menu event to populate with default actions
					plugin.app.workspace.trigger("file-menu", submenu, file, "file-explorer");
				} catch (error) {
					console.debug("Native file menu not available, using fallback");
				}

				// Add common file actions (these will either supplement or replace the native menu)
				submenu.addItem((subItem: any) => {
					subItem.setTitle(this.t("contextMenus.task.rename"));
					subItem.setIcon("pencil");
					subItem.onClick(async () => {
						try {
							// Modal-based rename
							const currentName = file.basename;
							const newName = await showTextInputModal(plugin.app, {
								title: this.t("contextMenus.task.renameTitle"),
								placeholder: this.t("contextMenus.task.renamePlaceholder"),
								initialValue: currentName,
							});

							if (newName && newName.trim() !== "" && newName !== currentName) {
								// Ensure the new name has the correct extension
								const extension = file.extension;
								const finalName = newName.endsWith(`.${extension}`)
									? newName
									: `${newName}.${extension}`;

								// Construct the new path
								const newPath = file.parent
									? `${file.parent.path}/${finalName}`
									: finalName;

								// Rename the file
								await plugin.app.vault.rename(file, newPath);
								new Notice(
									this.t("contextMenus.task.notices.renameSuccess", {
										name: finalName,
									})
								);

								// Trigger update callback
								if (this.options.onUpdate) {
									this.options.onUpdate();
								}
							}
						} catch (error) {
							console.error("Error renaming file:", error);
							new Notice(this.t("contextMenus.task.notices.renameFailure"));
						}
					});
				});

				submenu.addItem((subItem: any) => {
					subItem.setTitle(this.t("contextMenus.task.delete"));
					subItem.setIcon("trash");
					subItem.onClick(async () => {
						// Show confirmation and delete
						const confirmed = await showConfirmationModal(plugin.app, {
							title: this.t("contextMenus.task.deleteTitle"),
							message: this.t("contextMenus.task.deleteMessage", { name: file.name }),
							confirmText: this.t("contextMenus.task.deleteConfirm"),
							cancelText: this.t("common.cancel"),
							isDestructive: true,
						});
						if (confirmed) {
							plugin.app.vault.trash(file, true);
						}
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem: any) => {
					subItem.setTitle(this.t("contextMenus.task.copyPath"));
					subItem.setIcon("copy");
					subItem.onClick(async () => {
						try {
							await navigator.clipboard.writeText(file.path);
							new Notice(this.t("contextMenus.task.notices.copyPathSuccess"));
						} catch (error) {
							new Notice(this.t("contextMenus.task.notices.copyFailure"));
						}
					});
				});

				submenu.addItem((subItem: any) => {
					subItem.setTitle(this.t("contextMenus.task.copyUrl"));
					subItem.setIcon("link");
					subItem.onClick(async () => {
						try {
							const url = `obsidian://open?vault=${encodeURIComponent(plugin.app.vault.getName())}&file=${encodeURIComponent(file.path)}`;
							await navigator.clipboard.writeText(url);
							new Notice(this.t("contextMenus.task.notices.copyUrlSuccess"));
						} catch (error) {
							new Notice(this.t("contextMenus.task.notices.copyFailure"));
						}
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem: any) => {
					subItem.setTitle(this.t("contextMenus.task.showInExplorer"));
					subItem.setIcon("folder-open");
					subItem.onClick(() => {
						// Reveal file in file explorer
						plugin.app.workspace
							.getLeaf()
							.setViewState({
								type: "file-explorer",
								state: {},
							})
							.then(() => {
								// Focus the file in the explorer
								const fileExplorer =
									plugin.app.workspace.getLeavesOfType("file-explorer")[0];
								if (fileExplorer?.view && "revealInFolder" in fileExplorer.view) {
									(fileExplorer.view as any).revealInFolder(file);
								}
							});
					});
				});
			}
		});

		this.menu.addSeparator();

		// Add to Calendar submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.addToCalendar"));
			item.setIcon("calendar-plus");

			const submenu = (item as any).setSubmenu();

			// Google Calendar
			submenu.addItem((subItem: any) => {
				subItem.setTitle(this.t("contextMenus.task.calendar.google"));
				subItem.setIcon("external-link");
				subItem.onClick(() => {
					CalendarExportService.openCalendarURL(
						{
							type: "google",
							task: task,
							useScheduledAsDue: true,
						},
						this.t.bind(this)
					);
				});
			});

			// Outlook Calendar
			submenu.addItem((subItem: any) => {
				subItem.setTitle(this.t("contextMenus.task.calendar.outlook"));
				subItem.setIcon("external-link");
				subItem.onClick(() => {
					CalendarExportService.openCalendarURL(
						{
							type: "outlook",
							task: task,
							useScheduledAsDue: true,
						},
						this.t.bind(this)
					);
				});
			});

			// Yahoo Calendar
			submenu.addItem((subItem: any) => {
				subItem.setTitle(this.t("contextMenus.task.calendar.yahoo"));
				subItem.setIcon("external-link");
				subItem.onClick(() => {
					CalendarExportService.openCalendarURL(
						{
							type: "yahoo",
							task: task,
							useScheduledAsDue: true,
						},
						this.t.bind(this)
					);
				});
			});

			submenu.addSeparator();

			// Download ICS file
			submenu.addItem((subItem: any) => {
				subItem.setTitle(this.t("contextMenus.task.calendar.downloadIcs"));
				subItem.setIcon("download");
				subItem.onClick(() => {
					CalendarExportService.downloadICSFile(task, this.t.bind(this));
				});
			});
		});

		this.menu.addSeparator();

		// Recurrence submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.recurrence"));
			item.setIcon("refresh-ccw");

			const submenu = (item as any).setSubmenu();
			const currentRecurrence =
				typeof task.recurrence === "string" ? task.recurrence : undefined;
			this.addRecurrenceOptions(
				submenu,
				currentRecurrence,
				async (value: string | null) => {
					try {
						await plugin.updateTaskProperty(task, "recurrence", value || undefined);
						this.options.onUpdate?.();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.error("Error updating task recurrence:", {
							error: errorMessage,
							taskPath: task.path,
						});
						new Notice(
							this.t("contextMenus.task.notices.updateRecurrenceFailure", {
								message: errorMessage,
							})
						);
					}
				},
				plugin
			);
		});

		this.menu.addSeparator();

		// Create subtask
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.createSubtask"));
			item.setIcon("plus");
			item.onClick(() => {
				const taskFile = plugin.app.vault.getAbstractFileByPath(task.path);
				if (taskFile instanceof TFile) {
					const projectReference = `[[${taskFile.basename}]]`;
					plugin.openTaskCreationModal({
						projects: [projectReference],
					});
				}
			});
		});

		// Apply main menu icon colors after menu is built
		setTimeout(() => {
			this.updateMainMenuIconColors(task, plugin);
		}, 10);
	}

	private addDependencyMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		menu.addItem((subItem: any) => {
			subItem.setTitle(this.t("contextMenus.task.dependencies.addBlockedBy"));
			subItem.setIcon("link-2");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openBlockedBySelector(task, plugin);
			});
		});

		const blockedByEntries = task.blockedBy ?? [];
		if (blockedByEntries.length > 0) {
			menu.addItem((subItem: any) => {
				subItem.setTitle(this.t("contextMenus.task.dependencies.removeBlockedBy"));
				subItem.setIcon("unlink");
				const innerMenu = (subItem as any).setSubmenu();
				blockedByEntries.forEach((entry, index) => {
					innerMenu.addItem((item: any) => {
						item.setTitle(entry.uid);
						item.onClick(async () => {
							try {
								const remaining = blockedByEntries.filter((_, i) => i !== index);
								const updatedTask = await plugin.updateTaskProperty(
									task,
									"blockedBy",
									remaining.length > 0 ? remaining : undefined
								);
								Object.assign(task, updatedTask);
								new Notice(
									this.t(
										"contextMenus.task.dependencies.notices.blockedByRemoved"
									)
								);
								this.options.onUpdate?.();
							} catch (error) {
								console.error("Failed to remove blocked-by dependency:", error);
								new Notice(
									this.t("contextMenus.task.dependencies.notices.updateFailed")
								);
							}
						});
					});
				});
			});
		}

		menu.addSeparator();

		menu.addItem((subItem: any) => {
			subItem.setTitle(this.t("contextMenus.task.dependencies.addBlocking"));
			subItem.setIcon("git-branch-plus");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openBlockingSelector(task, plugin);
			});
		});

		const blockingEntries = task.blocking ?? [];
		if (blockingEntries.length > 0) {
			menu.addItem((subItem: any) => {
				subItem.setTitle(this.t("contextMenus.task.dependencies.removeBlocking"));
				subItem.setIcon("git-branch-minus");
				const innerMenu = (subItem as any).setSubmenu();
				blockingEntries.forEach((path) => {
					const file = plugin.app.vault.getAbstractFileByPath(path);
					const label =
						file instanceof TFile
							? plugin.app.metadataCache.fileToLinktext(file, task.path, false)
							: path.split("/").pop() || path;
					innerMenu.addItem((item: any) => {
						item.setTitle(label);
						item.onClick(async () => {
							try {
								await plugin.taskService.updateBlockingRelationships(
									task,
									[],
									[path],
									{}
								);
								const refreshed = await plugin.cacheManager.getTaskInfo(task.path);
								if (refreshed) {
									Object.assign(task, refreshed);
								}
								new Notice(
									this.t("contextMenus.task.dependencies.notices.blockingRemoved")
								);
								this.options.onUpdate?.();
							} catch (error) {
								console.error("Failed to remove blocking dependency:", error);
								new Notice(
									this.t("contextMenus.task.dependencies.notices.updateFailed")
								);
							}
						});
					});
				});
			});
		}
	}

	private dedupeDependencyEntries(entries: Array<TaskDependency | string>): TaskDependency[] {
		const seen = new Map<string, TaskDependency>();
		for (const entry of entries) {
			const normalized = normalizeDependencyEntry(entry);
			if (!normalized) {
				continue;
			}
			const key = this.getDependencyKey(normalized);
			if (!seen.has(key)) {
				seen.set(key, normalized);
			}
		}
		return Array.from(seen.values());
	}

	private async openBlockedBySelector(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		const existingUids = new Set(
			(Array.isArray(task.blockedBy) ? task.blockedBy : []).map((dependency) => dependency.uid)
		);
		await this.openTaskDependencySelector(
			plugin,
			(candidate) => {
				if (candidate.path === task.path) return false;
				const candidateUid = formatDependencyLink(plugin.app, task.path, candidate.path);
				return !existingUids.has(candidateUid);
			},
			async (selected) => {
				await this.handleBlockedBySelection(task, plugin, selected);
			}
		);
	}

	private async openBlockingSelector(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		const existingPaths = new Set(task.blocking ?? []);
		await this.openTaskDependencySelector(
			plugin,
			(candidate) => {
				if (candidate.path === task.path) return false;
				return !existingPaths.has(candidate.path);
			},
			async (selected) => {
				await this.handleBlockingSelection(task, plugin, selected);
			}
		);
	}

	private async openTaskDependencySelector(
		plugin: TaskNotesPlugin,
		filter: (candidate: TaskInfo) => boolean,
		onSelect: (selected: TaskInfo) => Promise<void>
	): Promise<void> {
		try {
			const cacheManager: any = plugin.cacheManager;
			const allTasks: TaskInfo[] = (await cacheManager?.getAllTasks?.()) ?? [];
			const candidates = allTasks.filter(filter);

			if (candidates.length === 0) {
				new Notice(
					this.t("contextMenus.task.dependencies.notices.noEligibleTasks")
				);
				return;
			}

			const selector = new TaskSelectorModal(plugin.app, plugin, candidates, async (task) => {
				if (!task) return;
				await onSelect(task);
			});
			selector.open();
		} catch (error) {
			console.error("Failed to open task selector for dependencies:", error);
			new Notice(this.t("contextMenus.task.dependencies.notices.updateFailed"));
		}
	}

	private async handleBlockedBySelection(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		selectedTask: TaskInfo
	): Promise<void> {
		if (selectedTask.path === task.path) {
			return;
		}

		try {
			const dependency: TaskDependency = {
				uid: formatDependencyLink(plugin.app, task.path, selectedTask.path),
				reltype: DEFAULT_DEPENDENCY_RELTYPE,
			};
			const existing = Array.isArray(task.blockedBy) ? task.blockedBy : [];
			const combined = this.dedupeDependencyEntries([...existing, dependency]);
			if (combined.length === existing.length) {
				return;
			}

			const updatedTask = await plugin.updateTaskProperty(task, "blockedBy", combined);
			Object.assign(task, updatedTask);

			new Notice(
				this.t("contextMenus.task.dependencies.notices.blockedByAdded", { count: 1 })
			);
			this.options.onUpdate?.();
		} catch (error) {
			console.error("Failed to add blocked-by dependency via selector:", error);
			new Notice(this.t("contextMenus.task.dependencies.notices.updateFailed"));
		}
	}

	private async handleBlockingSelection(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		selectedTask: TaskInfo
	): Promise<void> {
		const blockedPath = selectedTask.path;
		if (blockedPath === task.path) {
			return;
		}
		if (task.blocking?.includes(blockedPath)) {
			return;
		}

		try {
			const rawEntry: TaskDependency = {
				uid: formatDependencyLink(plugin.app, blockedPath, task.path),
				reltype: DEFAULT_DEPENDENCY_RELTYPE,
			};
			await plugin.taskService.updateBlockingRelationships(task, [blockedPath], [], {
				[blockedPath]: rawEntry,
			});

			const refreshed = await plugin.cacheManager.getTaskInfo(task.path);
			if (refreshed) {
				Object.assign(task, refreshed);
			} else if (Array.isArray(task.blocking)) {
				task.blocking = Array.from(new Set([...task.blocking, blockedPath]));
			} else {
				task.blocking = [blockedPath];
			}

			new Notice(
				this.t("contextMenus.task.dependencies.notices.blockingAdded", { count: 1 })
			);
			this.options.onUpdate?.();
		} catch (error) {
			console.error("Failed to add blocking dependency via selector:", error);
			new Notice(this.t("contextMenus.task.dependencies.notices.updateFailed"));
		}
	}

	private getDependencyKey(entry: TaskDependency): string {
		return `${entry.uid}::${entry.reltype}::${entry.gap ?? ""}`;
	}

	private updateMainMenuIconColors(task: TaskInfo, plugin: TaskNotesPlugin): void {
		const menuEl = document.querySelector(".menu");
		if (!menuEl) return;

		const menuItems = menuEl.querySelectorAll(".menu-item");
		const statusTitle = this.t("contextMenus.task.status");
		const priorityTitle = this.t("contextMenus.task.priority");

		// Find status and priority menu items and apply colors
		menuItems.forEach((menuItem: Element) => {
			const titleEl = menuItem.querySelector(".menu-item-title");
			const iconEl = menuItem.querySelector(".menu-item-icon");

			if (titleEl && iconEl) {
				const title = titleEl.textContent;

				// Apply status color
				if (title === statusTitle) {
					const statusConfig = plugin.settings.customStatuses.find(
						(s) => s.value === task.status
					);
					if (statusConfig && statusConfig.color) {
						(iconEl as HTMLElement).style.color = statusConfig.color;
					}
				}

				// Apply priority color
				else if (title === priorityTitle) {
					const priorityConfig = plugin.settings.customPriorities.find(
						(p) => p.value === task.priority
					);
					if (priorityConfig && priorityConfig.color) {
						(iconEl as HTMLElement).style.color = priorityConfig.color;
					}
				}
			}
		});
	}

	private addStatusOptions(submenu: any, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const statusOptions = this.getStatusOptions(task, plugin);

		statusOptions.forEach((option, index) => {
			submenu.addItem((item: any) => {
				let title = option.label;

				// Use consistent icon for all items
				item.setIcon("circle");

				// Highlight current selection with visual indicator
				if (option.value === task.status) {
					title = this.t("contextMenus.task.statusSelected", { label: option.label });
				}

				item.setTitle(title);

				item.onClick(async () => {
					try {
						await plugin.updateTaskProperty(task, "status", option.value);
						this.options.onUpdate?.();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.error("Error updating task status:", {
							error: errorMessage,
							taskPath: task.path,
						});
						new Notice(`Failed to update task status: ${errorMessage}`);
					}
				});

				// Apply color directly to this item
				if (option.color) {
					setTimeout(() => {
						const itemEl = item.dom || item.domEl;
						if (itemEl) {
							const iconEl = itemEl.querySelector(".menu-item-icon");
							if (iconEl) {
								(iconEl as HTMLElement).style.color = option.color;
							}
						}
					}, 10);
				}
			});
		});
	}

	private addPriorityOptions(submenu: any, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const priorityOptions = plugin.priorityManager.getPrioritiesByWeight();

		priorityOptions.forEach((priority) => {
			submenu.addItem((item: any) => {
				let title = priority.label;

				// Use consistent icon for all items
				item.setIcon("star");

				// Highlight current selection with visual indicator
				if (priority.value === task.priority) {
					title = this.t("contextMenus.task.prioritySelected", { label: priority.label });
				}

				item.setTitle(title);

				item.onClick(async () => {
					try {
						await plugin.updateTaskProperty(task, "priority", priority.value);
						this.options.onUpdate?.();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						console.error("Error updating task priority:", {
							error: errorMessage,
							taskPath: task.path,
						});
						new Notice(`Failed to update task priority: ${errorMessage}`);
					}
				});

				// Apply color directly to this item
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
		});
	}

	private addDateOptions(
		submenu: any,
		currentValue: string | undefined,
		onSelect: (value: string | null) => Promise<void>,
		onCustomDate: () => void
	): void {
		const dateContextMenu = new DateContextMenu({
			currentValue: currentValue,
			onSelect: (value: string | null) => {
				onSelect(value);
			},
			onCustomDate: onCustomDate,
			plugin: this.options.plugin,
		});

		const dateOptions = dateContextMenu.getDateOptions();

		const incrementOptions = dateOptions.filter(
			(option: any) => option.category === "increment"
		);
		if (incrementOptions.length > 0) {
			incrementOptions.forEach((option: any) => {
				submenu.addItem((item: any) => {
					if (option.icon) item.setIcon(option.icon);
					item.setTitle(option.label);
					item.onClick(() => onSelect(option.value));
				});
			});
			submenu.addSeparator();
		}

		const basicOptions = dateOptions.filter((option: any) => option.category === "basic");
		basicOptions.forEach((option: any) => {
			submenu.addItem((item: any) => {
				if (option.icon) item.setIcon(option.icon);
				const isSelected = option.value === currentValue;
				const title = isSelected
					? this.t("contextMenus.date.selected", { label: option.label })
					: option.label;
				item.setTitle(title);
				item.onClick(() => onSelect(option.value));
			});
		});

		const weekdayOptions = dateOptions.filter((option: any) => option.category === "weekday");
		if (weekdayOptions.length > 0) {
			submenu.addSeparator();
			submenu.addItem((item: any) => {
				item.setTitle(this.t("contextMenus.date.weekdaysLabel"));
				item.setIcon("calendar");
				const weekdaySubmenu = (item as any).setSubmenu();
				weekdayOptions.forEach((option: any) => {
					weekdaySubmenu.addItem((subItem: any) => {
						const isSelected = option.value === currentValue;
						const title = isSelected
							? this.t("contextMenus.date.selected", { label: option.label })
							: option.label;
						subItem.setTitle(title);
						subItem.setIcon("calendar");
						subItem.onClick(() => onSelect(option.value));
					});
				});
			});
		}

		submenu.addSeparator();

		submenu.addItem((item: any) => {
			item.setTitle(this.t("contextMenus.date.pickDateTime"));
			item.setIcon("calendar");
			item.onClick(() => onCustomDate());
		});

		if (currentValue) {
			submenu.addItem((item: any) => {
				item.setTitle(this.t("contextMenus.date.clearDate"));
				item.setIcon("x");
				item.onClick(() => onSelect(null));
			});
		}
	}

	private addRecurrenceOptions(
		submenu: any,
		currentValue: string | undefined,
		onSelect: (value: string | null) => Promise<void>,
		plugin: TaskNotesPlugin
	): void {
		const today = new Date();
		const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
		const monthNames = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		];
		const currentDay = dayNames[today.getDay()];
		const currentDate = today.getDate();
		const currentMonth = today.getMonth() + 1;
		const currentMonthName = monthNames[today.getMonth()];
		const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

		const formatDateForDTSTART = (date: Date): string => {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			return `${year}${month}${day}`;
		};

		const getOrdinal = (n: number): string => {
			const s = ["th", "st", "nd", "rd"];
			const v = n % 100;
			return n + (s[(v - 20) % 10] || s[v] || s[0]);
		};

		let todayDTSTART = formatDateForDTSTART(today);

		const recurrenceOptions = [
			{
				label: this.t("modals.task.recurrence.daily"),
				value: `DTSTART:${todayDTSTART};FREQ=DAILY;INTERVAL=1`,
				icon: "calendar-days",
			},
			{
				label: this.t("modals.task.recurrence.weeklyOn", { days: dayName }),
				value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;INTERVAL=1;BYDAY=${currentDay}`,
				icon: "calendar",
			},
			{
				label: this.t("modals.task.recurrence.everyTwoWeeks"),
				value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;INTERVAL=2;BYDAY=${currentDay}`,
				icon: "calendar",
			},
			{
				label: this.t("modals.task.recurrence.monthlyOnOrdinal", {
					ordinal: getOrdinal(currentDate),
				}),
				value: `DTSTART:${todayDTSTART};FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${currentDate}`,
				icon: "calendar-range",
			},
			{
				label: this.t("modals.task.recurrence.everyThreeMonths"),
				value: `DTSTART:${todayDTSTART};FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=${currentDate}`,
				icon: "calendar-range",
			},
			{
				label: this.t("modals.task.recurrence.yearlyOn", {
					month: currentMonthName,
					day: getOrdinal(currentDate),
				}),
				value: `DTSTART:${todayDTSTART};FREQ=YEARLY;INTERVAL=1;BYMONTH=${currentMonth};BYMONTHDAY=${currentDate}`,
				icon: "calendar-clock",
			},
			{
				label: this.t("modals.task.recurrence.weekdays"),
				value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`,
				icon: "briefcase",
			},
		];

		recurrenceOptions.forEach((option) => {
			submenu.addItem((item: any) => {
				const isSelected = option.value === currentValue;
				item.setTitle(isSelected ? `✓ ${option.label}` : option.label);
				item.setIcon(option.icon);
				item.onClick(() => {
					onSelect(option.value);
				});
			});
		});

		submenu.addSeparator();

		// Custom recurrence option
		submenu.addItem((item: any) => {
			item.setTitle(this.t("contextMenus.task.customRecurrence"));
			item.setIcon("settings");
			item.onClick(() => {
				const recurrenceMenu = new RecurrenceContextMenu({
					currentValue: typeof currentValue === "string" ? currentValue : undefined,
					onSelect: onSelect,
					app: plugin.app,
					plugin: plugin,
				});
				recurrenceMenu["showCustomRecurrenceModal"]();
			});
		});

		// Clear option if there's a current value
		if (currentValue) {
			submenu.addItem((item: any) => {
				item.setTitle(this.t("contextMenus.task.clearRecurrence"));
				item.setIcon("x");
				item.onClick(() => {
					onSelect(null);
				});
			});
		}
	}

	private getStatusOptions(task: TaskInfo, plugin: TaskNotesPlugin) {
		const statusConfigs = plugin.settings.customStatuses;
		const statusOptions: any[] = [];

		// Use only the user-defined statuses from settings
		if (statusConfigs && statusConfigs.length > 0) {
			// Sort by order property
			const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);

			// Filter for recurring tasks if needed
			const availableStatuses = task.recurrence
				? sortedStatuses.filter((status) => status.value !== "completed")
				: sortedStatuses;

			availableStatuses.forEach((status) => {
				statusOptions.push({
					label: status.label,
					value: status.value,
					color: status.color,
				});
			});
		}

		return statusOptions;
	}

	private addQuickRemindersSection(
		submenu: any,
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		anchor: "due" | "scheduled",
		title: string
	): void {
		const anchorDate = anchor === "due" ? task.due : task.scheduled;

		if (!anchorDate) {
			// If no anchor date, show disabled option
			submenu.addItem((subItem: any) => {
				subItem.setTitle(title);
				subItem.setIcon("bell");
				subItem.setDisabled(true);
			});
			return;
		}

		// Add submenu for quick reminder options
		submenu.addItem((subItem: any) => {
			subItem.setTitle(title);
			subItem.setIcon("bell");

			const reminderSubmenu = (subItem as any).setSubmenu();

			const quickOptions = [
				{ labelKey: "contextMenus.task.quickReminders.atTime", offset: "PT0M" },
				{ labelKey: "contextMenus.task.quickReminders.fiveMinutes", offset: "-PT5M" },
				{ labelKey: "contextMenus.task.quickReminders.fifteenMinutes", offset: "-PT15M" },
				{ labelKey: "contextMenus.task.quickReminders.oneHour", offset: "-PT1H" },
				{ labelKey: "contextMenus.task.quickReminders.oneDay", offset: "-P1D" },
			];

			quickOptions.forEach((option) => {
				reminderSubmenu.addItem((reminderItem: any) => {
					const label = this.t(option.labelKey);
					reminderItem.setTitle(label);
					reminderItem.onClick(async () => {
						await this.addQuickReminder(task, plugin, anchor, option.offset, label);
					});
				});
			});
		});
	}

	private async addQuickReminder(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		anchor: "due" | "scheduled",
		offset: string,
		description: string
	): Promise<void> {
		const reminder = {
			id: `rem_${Date.now()}`,
			type: "relative" as const,
			relatedTo: anchor,
			offset,
			description,
		};

		const updatedReminders = [...(task.reminders || []), reminder];
		try {
			await plugin.updateTaskProperty(task, "reminders", updatedReminders);
			this.options.onUpdate?.();
		} catch (error) {
			console.error("Error adding reminder:", error);
			new Notice("Failed to add reminder");
		}
	}

	public show(event: MouseEvent): void {
		this.menu.showAtMouseEvent(event);
	}

	public showAtElement(element: HTMLElement): void {
		this.menu.showAtPosition({
			x: element.getBoundingClientRect().left,
			y: element.getBoundingClientRect().bottom + 4,
		});
	}
}
