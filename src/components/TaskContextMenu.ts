import { Menu, Notice, Platform, TFile, type MenuItem, type TAbstractFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskDependency, TaskInfo } from "../types";
import { formatDateForStorage } from "../utils/dateUtils";
import { ReminderModal } from "../modals/ReminderModal";
import { CalendarExportService } from "../services/CalendarExportService";
import {
	addTaskToProject,
	assignTaskAsSubtask,
	buildSubtaskCreationPrePopulatedValues,
} from "../services/taskRelationshipActions";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { DateContextMenu } from "./DateContextMenu";
import {
	buildWeekdaysOnlyRecurrenceRule,
	getPluginCalendarLocale,
	RecurrenceContextMenu,
} from "./RecurrenceContextMenu";
import { showTextInputModal } from "../modals/TextInputModal";
import { TagSuggest } from "../modals/taskModalSuggests";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal";
import { ProjectSelectModal } from "../modals/ProjectSelectModal";
import {
	DEFAULT_DEPENDENCY_RELTYPE,
	extractDependencyUid,
	formatDependencyLink,
	normalizeDependencyEntry,
} from "../utils/dependencyUtils";
import { generateLink } from "../utils/linkUtils";
import { ContextMenu } from "./ContextMenu";
import { buildTimeblockPrefillForTask } from "../utils/timeblockPrefillUtils";
import { TimeblockCreationModal } from "../modals/TimeblockCreationModal";
import {
	addTagsToList,
	clearEditableTagsFromList,
	getEditableTaskTags,
	parseTaskTagInput,
	removeTagsFromList,
} from "../utils/taskTagList";

type SubmenuMenuItem = {
	setSubmenu(): Menu;
	dom?: HTMLElement;
	domEl?: HTMLElement;
};

type FileExplorerView = {
	revealInFolder(file: TFile): void;
};

type TaskStatusOption = {
	label: string;
	value: string;
	color?: string;
	icon?: string;
};

function normalizeContextValue(value: string): string {
	return value.trim();
}

function normalizeContextList(contexts: string[] | undefined): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const context of contexts ?? []) {
		if (typeof context !== "string") continue;
		const value = normalizeContextValue(context);
		if (!value || seen.has(value)) continue;
		seen.add(value);
		normalized.push(value);
	}

	return normalized;
}

export function addContextToList(
	contexts: string[] | undefined,
	context: string
): string[] | undefined {
	const value = normalizeContextValue(context);
	const current = normalizeContextList(contexts);
	if (!value) return current.length > 0 ? current : undefined;
	if (current.includes(value)) return current;
	return [...current, value];
}

export function removeContextFromList(
	contexts: string[] | undefined,
	context: string
): string[] | undefined {
	const value = normalizeContextValue(context);
	const remaining = normalizeContextList(contexts).filter((entry) => entry !== value);
	return remaining.length > 0 ? remaining : undefined;
}

export function toggleContextInList(
	contexts: string[] | undefined,
	context: string
): string[] | undefined {
	const value = normalizeContextValue(context);
	const current = normalizeContextList(contexts);
	if (!value) return current.length > 0 ? current : undefined;
	return current.includes(value)
		? removeContextFromList(current, value)
		: addContextToList(current, value);
}

function getSubmenu(item: MenuItem): Menu {
	return (item as unknown as SubmenuMenuItem).setSubmenu();
}

function getMenuItemElement(item: MenuItem): HTMLElement | null {
	const menuItem = item as unknown as SubmenuMenuItem;
	return menuItem.dom ?? menuItem.domEl ?? null;
}

function toMenuTitle(value: unknown, fallback = ""): string {
	const text =
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
			? String(value)
			: "";
	const trimmed = text.trim();
	return trimmed.length > 0 ? trimmed : fallback;
}

export interface TaskContextMenuOptions {
	task: TaskInfo;
	plugin: TaskNotesPlugin;
	targetDate: Date;
	onUpdate?: () => void;
}

export class TaskContextMenu {
	private menu: ContextMenu;
	private options: TaskContextMenuOptions;
	private targetDoc: Document = activeDocument;

	constructor(options: TaskContextMenuOptions) {
		this.menu = new ContextMenu();
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

			const submenu = getSubmenu(item);
			this.addStatusOptions(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Priority submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.priority"));
			item.setIcon("star");

			const submenu = getSubmenu(item);
			this.addPriorityOptions(submenu, task, plugin);
		});

		// Tags submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.tags"));
			item.setIcon("tags");

			const submenu = getSubmenu(item);
			this.addTagOptions(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Due Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.dueDate"));
			item.setIcon("calendar");

			const submenu = getSubmenu(item);
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
					void plugin.openDueDateModal(task);
				}
			);
		});

		// Scheduled Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.scheduledDate"));
			item.setIcon("calendar-clock");

			const submenu = getSubmenu(item);
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
					void plugin.openScheduledDateModal(task);
				}
			);
		});

		if (task.recurrence) {
			this.addRecurringInstanceMenuItems(task, plugin);
		}

		// Reminders submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.reminders"));
			item.setIcon("bell");

			const submenu = getSubmenu(item);

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
			submenu.addItem((subItem) => {
				subItem.setTitle(this.t("contextMenus.task.manageReminders"));
				subItem.setIcon("settings");
				subItem.onClick(() => {
					const modal = new ReminderModal(plugin.app, plugin, task, (reminders) => {
						void (async () => {
							try {
								await plugin.updateTaskProperty(
									task,
									"reminders",
									reminders.length > 0 ? reminders : undefined
								);
								this.options.onUpdate?.();
							} catch (error) {
								console.error("Error updating reminders:", error);
								new Notice(
									this.t("contextMenus.task.notices.updateRemindersFailure")
								);
							}
						})();
					});
					modal.open();
				});
			});

			// Clear reminders (if any exist)
			if (task.reminders && task.reminders.length > 0) {
				submenu.addItem((subItem) => {
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

			const submenu = getSubmenu(item);
			this.addDependencyMenuItems(submenu, task, plugin);
		});

		// this.menu.addSeparator();

		// Organization submenu (projects and subtasks)
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.organization.title"));
			item.setIcon("folder-tree");

			const submenu = getSubmenu(item);
			this.addOrganizationMenuItems(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Time Tracking
		this.menu.addItem((item) => {
			const activeSession = plugin.getActiveTimeSession(task, this.options.targetDate);
			item.setTitle(
				activeSession
					? this.t("contextMenus.task.stopTimeTracking")
					: this.t("contextMenus.task.startTimeTracking")
			);
			item.setIcon(activeSession ? "pause" : "play");
			item.onClick(async () => {
				const activeSession = plugin.getActiveTimeSession(task, this.options.targetDate);
				if (activeSession) {
					await plugin.stopTimeTracking(task, this.options.targetDate);
				} else {
					await plugin.startTimeTracking(task, undefined, this.options.targetDate);
				}
				this.options.onUpdate?.();
			});
		});

		// Edit Time Entries
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.editTimeEntries"));
			item.setIcon("clock");
			item.onClick(() => {
				plugin.openTimeEntryEditor(task);
			});
		});

		// Create timeblock from task
		if (plugin.settings.calendarViewSettings.enableTimeblocking) {
			this.menu.addItem((item) => {
				item.setTitle("Create timeblock");
				item.setIcon("calendar-plus");
				item.onClick(() => {
					const prefill = buildTimeblockPrefillForTask(task, this.options.targetDate);
					const modal = new TimeblockCreationModal(plugin.app, plugin, {
						date: prefill.date,
						startTime: prefill.startTime,
						endTime: prefill.endTime,
						prefilledTitle: task.title,
						prefilledAttachmentPaths: [task.path],
					});
					modal.open();
				});
			});
		}

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
					void plugin.app.workspace.getLeaf(false).openFile(file);
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
				} catch {
					new Notice(this.t("contextMenus.task.notices.copyFailure"));
				}
			});
		});

		// Note actions submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.noteActions"));
			item.setIcon("file-text");

			const submenu = getSubmenu(item);

			// Get the file for the task
			const file = plugin.app.vault.getAbstractFileByPath(task.path);
			if (file instanceof TFile) {
				// Try to populate with Obsidian's native file menu
				try {
					// Trigger the file-menu event to populate with default actions
					plugin.app.workspace.trigger("file-menu", submenu, file, "file-explorer");
				} catch {
					console.debug("Native file menu not available, using fallback");
				}

				// Add common file actions (these will either supplement or replace the native menu)
				submenu.addItem((subItem) => {
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

				submenu.addItem((subItem) => {
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
							try {
								await plugin.taskService.deleteTask(task);
								if (this.options.onUpdate) {
									this.options.onUpdate();
								}
							} catch (error) {
								const message =
									error instanceof Error ? error.message : String(error);
								console.error("Error deleting task:", error);
								new Notice(`Failed to delete task: ${message}`);
							}
						}
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem) => {
					subItem.setTitle(this.t("contextMenus.task.copyPath"));
					subItem.setIcon("copy");
					subItem.onClick(() => {
						void navigator.clipboard
							.writeText(file.path)
							.then(() => {
								new Notice(this.t("contextMenus.task.notices.copyPathSuccess"));
							})
							.catch(() => {
								new Notice(this.t("contextMenus.task.notices.copyFailure"));
							});
					});
				});

				submenu.addItem((subItem) => {
					subItem.setTitle(this.t("contextMenus.task.copyUrl"));
					subItem.setIcon("link");
					subItem.onClick(() => {
						const url = `obsidian://open?vault=${encodeURIComponent(plugin.app.vault.getName())}&file=${encodeURIComponent(file.path)}`;
						void navigator.clipboard
							.writeText(url)
							.then(() => {
								new Notice(this.t("contextMenus.task.notices.copyUrlSuccess"));
							})
							.catch(() => {
								new Notice(this.t("contextMenus.task.notices.copyFailure"));
							});
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem) => {
					subItem.setTitle(this.t("contextMenus.task.showInExplorer"));
					subItem.setIcon("folder-open");
					subItem.onClick(() => {
						// Reveal file in file explorer
						void plugin.app.workspace
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
									(fileExplorer.view as FileExplorerView).revealInFolder(file);
								}
							})
							.catch((error) => {
								console.warn("Failed to reveal task in file explorer:", error);
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

			const submenu = getSubmenu(item);

			// Google Calendar
			submenu.addItem((subItem) => {
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
			submenu.addItem((subItem) => {
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
			submenu.addItem((subItem) => {
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
			submenu.addItem((subItem) => {
				subItem.setTitle(this.t("contextMenus.task.calendar.downloadIcs"));
				subItem.setIcon("download");
				subItem.onClick(() => {
					CalendarExportService.downloadICSFile(task, this.t.bind(this), {
						includeObsidianLink: true,
						vaultName: plugin.app.vault.getName(),
					});
				});
			});

			submenu.addSeparator();

			// Sync to Google Calendar (via API)
			submenu.addItem((subItem) => {
				subItem.setTitle(this.t("contextMenus.task.calendar.syncToGoogle"));
				subItem.setIcon("refresh-cw");
				subItem.onClick(async () => {
					if (!plugin.taskCalendarSyncService?.isEnabled()) {
						new Notice(this.t("contextMenus.task.calendar.syncToGoogleNotConfigured"));
						return;
					}
					try {
						await plugin.taskCalendarSyncService.syncTaskToCalendar(task);
						new Notice(this.t("contextMenus.task.calendar.syncToGoogleSuccess"));
						this.options.onUpdate?.();
					} catch (error) {
						console.error("Failed to sync task to Google Calendar:", error);
						new Notice(this.t("contextMenus.task.calendar.syncToGoogleFailed"));
					}
				});
			});
		});

		this.menu.addSeparator();

		// Recurrence submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.recurrence"));
			item.setIcon("refresh-ccw");

			const submenu = getSubmenu(item);
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
					plugin.openTaskCreationModal({
						...buildSubtaskCreationPrePopulatedValues(plugin, task, taskFile),
					});
				}
			});
		});

		this.addMobileDismissOption();

		// Apply main menu icon colors after menu is built
		window.setTimeout(() => {
			this.updateMainMenuIconColors(task, plugin);
		}, 10);
	}

	private addMobileDismissOption(): void {
		if (!Platform.isMobile) {
			return;
		}

		this.menu.addSeparator();
		this.menu.addItem((item) => {
			item.setTitle(this.t("common.close"));
			item.setIcon("x");
			item.onClick(() => {
				this.menu.hide();
			});
		});
	}

	private addRecurringInstanceMenuItems(task: TaskInfo, plugin: TaskNotesPlugin): void {
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

		const isSkippedForDate = task.skipped_instances?.includes(dateStr) || false;

		this.menu.addItem((item) => {
			item.setTitle(
				isSkippedForDate
					? this.t("contextMenus.task.unskipInstance")
					: this.t("contextMenus.task.skipInstance")
			);
			item.setIcon(isSkippedForDate ? "undo" : "x-circle");
			item.onClick(async () => {
				try {
					await plugin.taskService.toggleRecurringTaskSkipped(
						task,
						this.options.targetDate
					);
					this.options.onUpdate?.();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error("Error toggling recurring task skip:", {
						error: errorMessage,
						taskPath: task.path,
					});
					new Notice(
						this.t("contextMenus.task.notices.toggleSkipFailure", {
							message: errorMessage,
						})
					);
				}
			});
		});
	}

	private addDependencyMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		menu.addItem((subItem) => {
			subItem.setTitle(this.t("contextMenus.task.dependencies.addBlockedBy"));
			subItem.setIcon("link-2");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openBlockedBySelector(task, plugin);
			});
		});

		const blockedByEntries = task.blockedBy ?? [];
		if (blockedByEntries.length > 0) {
			menu.addItem((subItem) => {
				subItem.setTitle(this.t("contextMenus.task.dependencies.removeBlockedBy"));
				subItem.setIcon("unlink");
				const innerMenu = getSubmenu(subItem);
				blockedByEntries.forEach((entry, index) => {
					innerMenu.addItem((item) => {
						const uid = toMenuTitle(
							extractDependencyUid(entry),
							this.t("contextMenus.task.dependencies.unknownDependency")
						);
						item.setTitle(uid);
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

		menu.addItem((subItem) => {
			subItem.setTitle(this.t("contextMenus.task.dependencies.addBlocking"));
			subItem.setIcon("git-branch-plus");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openBlockingSelector(task, plugin);
			});
		});

		const blockingEntries = task.blocking ?? [];
		if (blockingEntries.length > 0) {
			menu.addItem((subItem) => {
				subItem.setTitle(this.t("contextMenus.task.dependencies.removeBlocking"));
				subItem.setIcon("git-branch-minus");
				const innerMenu = getSubmenu(subItem);
				blockingEntries.forEach((path) => {
					const file = plugin.app.vault.getAbstractFileByPath(path);
					const label =
						file instanceof TFile
							? plugin.app.metadataCache.fileToLinktext(file, task.path, false)
							: path.split("/").pop() || path;
					innerMenu.addItem((item) => {
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
			(Array.isArray(task.blockedBy) ? task.blockedBy : []).map(
				(dependency) => dependency.uid
			)
		);
		await this.openTaskDependencySelector(
			plugin,
			(candidate) => {
				if (candidate.path === task.path) return false;
				const candidateUid = formatDependencyLink(
					plugin.app,
					task.path,
					candidate.path,
					plugin.settings.useFrontmatterMarkdownLinks
				);
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
			const allTasks = await plugin.cacheManager.getAllTasks();
			const candidates = allTasks.filter(filter);

			if (candidates.length === 0) {
				new Notice(this.t("contextMenus.task.dependencies.notices.noEligibleTasks"));
				return;
			}

			openTaskSelector(plugin, candidates, (task) => {
				if (!task) return;
				void onSelect(task);
			});
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
				uid: formatDependencyLink(
					plugin.app,
					task.path,
					selectedTask.path,
					plugin.settings.useFrontmatterMarkdownLinks
				),
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
				uid: formatDependencyLink(
					plugin.app,
					blockedPath,
					task.path,
					plugin.settings.useFrontmatterMarkdownLinks
				),
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

	private addOrganizationMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		// Contexts
		menu.addItem((subItem) => {
			subItem.setTitle(this.t("contextMenus.task.organization.contexts"));
			subItem.setIcon("at-sign");
			const contextMenu = getSubmenu(subItem);
			this.addContextMenuItems(contextMenu, task, plugin);
		});

		menu.addSeparator();

		// Add to project
		menu.addItem((subItem) => {
			subItem.setTitle(this.t("contextMenus.task.organization.addToProject"));
			subItem.setIcon("folder-plus");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openProjectSelector(task, plugin);
			});
		});

		// Add subtasks
		menu.addItem((subItem) => {
			subItem.setTitle(this.t("contextMenus.task.organization.addSubtasks"));
			subItem.setIcon("indent");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openSubtaskAssignmentSelector(task, plugin);
			});
		});
	}

	private addContextMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const currentContexts = normalizeContextList(task.contexts);
		const contextOptions = this.getContextOptions(task, plugin);

		menu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.organization.addContext"));
			item.setIcon("plus");
			item.onClick(() => {
				this.menu.hide();
				void this.openContextInput(task, plugin);
			});
		});

		if (contextOptions.length > 0) {
			menu.addSeparator();
			for (const context of contextOptions) {
				menu.addItem((item) => {
					const selected = currentContexts.includes(context);
					item.setTitle(
						selected
							? this.t("contextMenus.task.organization.contextSelected", {
									context,
								})
							: context
					);
					item.setIcon(selected ? "check" : "at-sign");
					item.onClick(async () => {
						await this.updateTaskContexts(
							task,
							plugin,
							toggleContextInList(task.contexts, context)
						);
					});
				});
			}
		}

		if (currentContexts.length > 0) {
			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle(this.t("contextMenus.task.organization.clearContexts"));
				item.setIcon("x");
				item.onClick(async () => {
					await this.updateTaskContexts(task, plugin, undefined);
				});
			});
		}
	}

	private getContextOptions(task: TaskInfo, plugin: TaskNotesPlugin): string[] {
		const knownContexts = plugin.cacheManager.getAllContexts?.() ?? [];
		const options = normalizeContextList([...knownContexts, ...(task.contexts ?? [])]);
		return options.sort((a, b) => a.localeCompare(b));
	}

	private async openContextInput(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		const context = await showTextInputModal(plugin.app, {
			title: this.t("contextMenus.task.organization.addContext"),
			placeholder: this.t("contextMenus.task.organization.contextPlaceholder"),
			confirmText: this.t("common.confirm"),
			cancelText: this.t("common.cancel"),
		});

		if (!context) return;
		await this.updateTaskContexts(task, plugin, addContextToList(task.contexts, context));
	}

	private async updateTaskContexts(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		contexts: string[] | undefined
	): Promise<void> {
		try {
			const updatedTask = await plugin.updateTaskProperty(task, "contexts", contexts);
			Object.assign(task, updatedTask);
			this.options.onUpdate?.();
		} catch (error) {
			console.error("Failed to update task contexts:", error);
			new Notice(this.t("contextMenus.task.organization.notices.updateContextsFailed"));
		}
	}

	private addTagOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const editableTags = getEditableTaskTags(task, plugin.settings);

		submenu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.addTag"));
			item.setIcon("plus");
			item.onClick(() => {
				this.menu.hide();
				void this.openTagInput(task, plugin, "add");
			});
		});

		if (editableTags.length > 0) {
			submenu.addSeparator();
			for (const tag of editableTags) {
				submenu.addItem((item) => {
					item.setTitle(this.t("contextMenus.task.removeTag", { tag: `#${tag}` }));
					item.setIcon("x");
					item.onClick(async () => {
						await this.updateTaskTags(task, plugin, removeTagsFromList(task.tags, [tag]));
					});
				});
			}

			submenu.addSeparator();
			submenu.addItem((item) => {
				item.setTitle(this.t("contextMenus.task.clearTags"));
				item.setIcon("eraser");
				item.onClick(async () => {
					await this.updateTaskTags(
						task,
						plugin,
						clearEditableTagsFromList(task.tags, plugin.settings)
					);
				});
			});
		}
	}

	private async openTagInput(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		mode: "add" | "remove"
	): Promise<void> {
		const input = await showTextInputModal(plugin.app, {
			title:
				mode === "add"
					? this.t("contextMenus.task.addTag")
					: this.t("contextMenus.task.removeTagInput"),
			placeholder: this.t("contextMenus.task.tagPlaceholder"),
			confirmText: this.t("common.confirm"),
			cancelText: this.t("common.cancel"),
			onInputReady: (inputEl) => {
				new TagSuggest(plugin.app, inputEl, plugin);
			},
		});

		const tags = parseTaskTagInput(input);
		if (tags.length === 0) return;

		const nextTags =
			mode === "add" ? addTagsToList(task.tags, tags) : removeTagsFromList(task.tags, tags);
		await this.updateTaskTags(task, plugin, nextTags);
	}

	private async updateTaskTags(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		tags: string[] | undefined
	): Promise<void> {
		try {
			const updatedTask = await plugin.updateTaskProperty(task, "tags", tags);
			Object.assign(task, updatedTask);
			this.options.onUpdate?.();
		} catch (error) {
			console.error("Failed to update task tags:", error);
			new Notice(this.t("contextMenus.task.notices.updateTagsFailed"));
		}
	}

	private async openProjectSelector(task: TaskInfo, plugin: TaskNotesPlugin): Promise<void> {
		try {
			const selector = new ProjectSelectModal(plugin.app, plugin, (projectFile) => {
				if (!projectFile) return;
				void this.addTaskToProject(task, plugin, projectFile);
			});
			selector.open();
		} catch (error) {
			console.error("Failed to open project selector:", error);
			new Notice(this.t("contextMenus.task.organization.notices.projectSelectFailed"));
		}
	}

	private async openSubtaskAssignmentSelector(
		task: TaskInfo,
		plugin: TaskNotesPlugin
	): Promise<void> {
		try {
			const allTasks = await plugin.cacheManager.getAllTasks();

			// Filter out the current task
			const candidates = allTasks.filter((candidate) => candidate.path !== task.path);

			if (candidates.length === 0) {
				new Notice(this.t("contextMenus.task.organization.notices.noEligibleSubtasks"));
				return;
			}

			openTaskSelector(plugin, candidates, (subtask) => {
				if (!subtask) return;
				void this.assignTaskAsSubtask(task, plugin, subtask);
			});
		} catch (error) {
			console.error("Failed to open subtask assignment selector:", error);
			new Notice(this.t("contextMenus.task.organization.notices.subtaskSelectFailed"));
		}
	}

	private async addTaskToProject(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		projectFile: TAbstractFile
	): Promise<void> {
		try {
			if (!(projectFile instanceof TFile)) {
				new Notice(this.t("contextMenus.task.organization.notices.projectSelectFailed"));
				return;
			}

			const updatedTask = await addTaskToProject(plugin, task, projectFile);
			if (updatedTask) {
				Object.assign(task, updatedTask);
				this.options.onUpdate?.();
			}
		} catch (error) {
			console.error("Failed to add task to project:", error);
			new Notice(this.t("contextMenus.task.organization.notices.addToProjectFailed"));
		}
	}

	private async assignTaskAsSubtask(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		subtask: TaskInfo
	): Promise<void> {
		try {
			const currentTaskFile = plugin.app.vault.getAbstractFileByPath(task.path);
			if (!(currentTaskFile instanceof TFile)) {
				new Notice(this.t("contextMenus.task.organization.notices.currentTaskNotFound"));
				return;
			}

			const updatedSubtask = await assignTaskAsSubtask(plugin, currentTaskFile, subtask);
			if (updatedSubtask) {
				Object.assign(subtask, updatedSubtask);
				this.options.onUpdate?.();
			}
		} catch (error) {
			console.error("Failed to assign task as subtask:", error);
			new Notice(this.t("contextMenus.task.organization.notices.addAsSubtaskFailed"));
		}
	}

	private buildProjectReference(
		targetFile: TFile,
		sourcePath: string,
		plugin: TaskNotesPlugin
	): string {
		return generateLink(
			plugin.app,
			targetFile,
			sourcePath,
			"",
			"",
			plugin.settings.useFrontmatterMarkdownLinks
		);
	}

	private updateMainMenuIconColors(task: TaskInfo, plugin: TaskNotesPlugin): void {
		const menuEl = this.targetDoc.querySelector(".menu");
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

	private addStatusOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const statusOptions = this.getStatusOptions(task, plugin);

		statusOptions.forEach((option, index) => {
			submenu.addItem((item) => {
				const label = toMenuTitle(option.label, option.value);
				let title = label;

				// Use custom icon if configured, otherwise default to circle
				item.setIcon(option.icon || "circle");

				// Highlight current selection with visual indicator
				if (option.value === task.status) {
					title = this.t("contextMenus.task.statusSelected", { label });
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
				const optionColor = option.color;
				if (optionColor) {
					window.setTimeout(() => {
						const itemEl = getMenuItemElement(item);
						if (itemEl) {
							const iconEl = itemEl.querySelector(".menu-item-icon");
							if (iconEl) {
								(iconEl as HTMLElement).style.color = optionColor;
							}
						}
					}, 10);
				}
			});
		});
	}

	private addPriorityOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const priorityOptions = plugin.priorityManager.getPrioritiesByWeight();

		priorityOptions.forEach((priority) => {
			const value = toMenuTitle(priority.value);
			if (!value) return;
			const label = toMenuTitle(priority.label, value);

			submenu.addItem((item) => {
				let title = label;

				// Use consistent icon for all items
				item.setIcon("star");

				// Highlight current selection with visual indicator
				if (value === task.priority) {
					title = this.t("contextMenus.task.prioritySelected", { label });
				}

				item.setTitle(title);

				item.onClick(async () => {
					try {
						await plugin.updateTaskProperty(task, "priority", value);
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
		});
	}

	private addDateOptions(
		submenu: Menu,
		currentValue: string | undefined,
		onSelect: (value: string | null) => Promise<void>,
		onCustomDate: () => void
	): void {
		const dateContextMenu = new DateContextMenu({
			currentValue: currentValue,
			onSelect: (value: string | null) => {
				void onSelect(value);
			},
			onCustomDate: onCustomDate,
			plugin: this.options.plugin,
			app: this.options.plugin.app,
		});

		const dateOptions = dateContextMenu.getDateOptions();

		const incrementOptions = dateOptions.filter(
			(option) => option.category === "increment"
		);
		if (incrementOptions.length > 0) {
			incrementOptions.forEach((option) => {
				submenu.addItem((item) => {
					if (option.icon) item.setIcon(option.icon);
					item.setTitle(option.label);
					item.onClick(() => {
						void onSelect(option.value);
					});
				});
			});
			submenu.addSeparator();
		}

		const basicOptions = dateOptions.filter((option) => option.category === "basic");
		basicOptions.forEach((option) => {
			submenu.addItem((item) => {
				if (option.icon) item.setIcon(option.icon);
				const isSelected = option.value === currentValue;
				const title = isSelected
					? this.t("contextMenus.date.selected", { label: option.label })
					: option.label;
				item.setTitle(title);
				item.onClick(() => {
					void onSelect(option.value);
				});
			});
		});

		const weekdayOptions = dateOptions.filter((option) => option.category === "weekday");
		if (weekdayOptions.length > 0) {
			submenu.addSeparator();
			submenu.addItem((item) => {
				item.setTitle(this.t("contextMenus.date.weekdaysLabel"));
				item.setIcon("calendar");
				const weekdaySubmenu = getSubmenu(item);
				weekdayOptions.forEach((option) => {
					weekdaySubmenu.addItem((subItem) => {
						const isSelected = option.value === currentValue;
						const title = isSelected
							? this.t("contextMenus.date.selected", { label: option.label })
							: option.label;
						subItem.setTitle(title);
						subItem.setIcon("calendar");
						subItem.onClick(() => {
							void onSelect(option.value);
						});
					});
				});
			});
		}

		submenu.addSeparator();

		submenu.addItem((item) => {
			item.setTitle(this.t("contextMenus.date.pickDateTime"));
			item.setIcon("calendar");
			item.onClick(onCustomDate);
		});

		if (currentValue) {
			submenu.addItem((item) => {
				item.setTitle(this.t("contextMenus.date.clearDate"));
				item.setIcon("x");
				item.onClick(() => {
					void onSelect(null);
				});
			});
		}
	}

	private addRecurrenceOptions(
		submenu: Menu,
		currentValue: string | undefined,
		onSelect: (value: string | null) => Promise<void>,
		plugin: TaskNotesPlugin
	): void {
		const today = new Date();
		const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
		const monthNames = [
			plugin.i18n.translate("common.months.january"),
			plugin.i18n.translate("common.months.february"),
			plugin.i18n.translate("common.months.march"),
			plugin.i18n.translate("common.months.april"),
			plugin.i18n.translate("common.months.may"),
			plugin.i18n.translate("common.months.june"),
			plugin.i18n.translate("common.months.july"),
			plugin.i18n.translate("common.months.august"),
			plugin.i18n.translate("common.months.september"),
			plugin.i18n.translate("common.months.october"),
			plugin.i18n.translate("common.months.november"),
			plugin.i18n.translate("common.months.december"),
		];
		const currentDay = dayNames[today.getDay()];
		const currentDate = today.getDate();
		const currentMonth = today.getMonth() + 1;
		const currentMonthName = monthNames[today.getMonth()];
		const calendarLocale = getPluginCalendarLocale(plugin);
		const dayName = today.toLocaleDateString(calendarLocale || undefined, { weekday: "long" });

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
				value: buildWeekdaysOnlyRecurrenceRule(todayDTSTART, calendarLocale),
				icon: "briefcase",
			},
		];

		recurrenceOptions.forEach((option) => {
			submenu.addItem((item) => {
				const isSelected = option.value === currentValue;
				item.setTitle(isSelected ? `✓ ${option.label}` : option.label);
				item.setIcon(option.icon);
				item.onClick(() => {
					void onSelect(option.value);
				});
			});
		});

		submenu.addSeparator();

		// Custom recurrence option
		submenu.addItem((item) => {
			item.setTitle(this.t("contextMenus.task.customRecurrence"));
			item.setIcon("settings");
			item.onClick(() => {
				const recurrenceMenu = new RecurrenceContextMenu({
					currentValue: typeof currentValue === "string" ? currentValue : undefined,
					currentAnchor: this.options.task.recurrence_anchor || "scheduled",
					scheduledDate: this.options.task.scheduled,
					onSelect: (value) => {
						void onSelect(value);
					},
					app: plugin.app,
					plugin: plugin,
				});
				recurrenceMenu["showCustomRecurrenceModal"]();
			});
		});

		// Clear option if there's a current value
		if (currentValue) {
			submenu.addItem((item) => {
				item.setTitle(this.t("contextMenus.task.clearRecurrence"));
				item.setIcon("x");
				item.onClick(() => {
					void onSelect(null);
				});
			});
		}
	}

	private getStatusOptions(task: TaskInfo, plugin: TaskNotesPlugin) {
		const statusConfigs = plugin.settings.customStatuses;
		const statusOptions: TaskStatusOption[] = [];

		// Use only the user-defined statuses from settings
		if (statusConfigs && statusConfigs.length > 0) {
			// Sort by order property
			const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);

			// Show all statuses for all tasks (including recurring tasks)
			sortedStatuses.forEach((status) => {
				const value = toMenuTitle(status.value);
				if (!value) return;
				statusOptions.push({
					label: toMenuTitle(status.label, value),
					value,
					color: typeof status.color === "string" ? status.color : undefined,
					icon: typeof status.icon === "string" ? status.icon : undefined,
				});
			});
		}

		return statusOptions;
	}

	private addQuickRemindersSection(
		submenu: Menu,
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		anchor: "due" | "scheduled",
		title: string
	): void {
		const anchorDate = anchor === "due" ? task.due : task.scheduled;

		if (!anchorDate) {
			// If no anchor date, show disabled option
			submenu.addItem((subItem) => {
				subItem.setTitle(title);
				subItem.setIcon("bell");
				subItem.setDisabled(true);
			});
			return;
		}

		// Add submenu for quick reminder options
		submenu.addItem((subItem) => {
			subItem.setTitle(title);
			subItem.setIcon("bell");

			const reminderSubmenu = getSubmenu(subItem);

			const quickOptions = [
				{ labelKey: "contextMenus.task.quickReminders.atTime", offset: "PT0M" },
				{ labelKey: "contextMenus.task.quickReminders.fiveMinutes", offset: "-PT5M" },
				{ labelKey: "contextMenus.task.quickReminders.fifteenMinutes", offset: "-PT15M" },
				{ labelKey: "contextMenus.task.quickReminders.oneHour", offset: "-PT1H" },
				{ labelKey: "contextMenus.task.quickReminders.oneDay", offset: "-P1D" },
			];

			quickOptions.forEach((option) => {
				reminderSubmenu.addItem((reminderItem) => {
					const label = this.t(option.labelKey);
					reminderItem.setTitle(label);
					reminderItem.onClick(() => {
						void this.addQuickReminder(task, plugin, anchor, option.offset, label);
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
		// Store the document reference from the event target to support pop-out windows
		// Use cross-window compatible instanceOf check
		if ((event.target as Node)?.instanceOf?.(HTMLElement)) {
			this.targetDoc = (event.target as HTMLElement).ownerDocument;
		}
		this.menu.showAtMouseEvent(event);
	}

	public showAtElement(element: HTMLElement): void {
		// Store the document reference from the element to support pop-out windows
		this.targetDoc = element.ownerDocument;
		this.menu.showAtPosition({
			x: element.getBoundingClientRect().left,
			y: element.getBoundingClientRect().bottom + 4,
		});
	}
}
