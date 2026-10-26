import { configLabel } from "../i18n/configLabels";
import { displayError } from "../i18n/runtime";
import type { MessageDescriptor } from "@lingui/core";
import { uiLocale } from "../i18n/runtime";
import { recurrenceMonthlyOn, recurrenceYearlyOn } from "../i18n/recurrence";
import { msg } from "@lingui/core/macro";
import {
	Menu,
	Notice,
	Platform,
	TFile,
	setTooltip,
	type MenuItem,
	type TAbstractFile,
} from "obsidian";
import type { OccurrenceMaterializationMode, OccurrenceNextTrigger } from "@tasknotes/model";
import TaskNotesPlugin from "../main";
import { TaskDependency, TaskInfo } from "../types";
import { formatDateForStorage, getDatePart, parseDateToUTC } from "../utils/dateUtils";
import {
	resolveCompletionDate,
	type CompletionDateContext,
	type CompletionMode,
} from "../ui/completionDateResolver";
import { ReminderModal } from "../modals/ReminderModal";
import {
	addTaskToProject,
	assignTaskAsSubtask,
	buildSubtaskCreationPrePopulatedValues,
} from "../services/taskRelationshipActions";
import { renameVaultFile } from "../services/VaultMutationService";
import { getRecurringTaskActionDate } from "../services/task-service/taskRecurringPlanning";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { DateContextMenu } from "./DateContextMenu";
import { DateTimePickerModal } from "../modals/DateTimePickerModal";
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
import { showCoordinatedMenu, showCoordinatedMenuAtElement } from "./ContextMenuCoordinator";
import { buildTimeblockPrefillForTask } from "../utils/timeblockPrefillUtils";
import { TimeblockCreationModal } from "../modals/TimeblockCreationModal";
import {
	addTagsToList,
	clearEditableTagsFromList,
	getEditableTaskTags,
	parseTaskTagInput,
	removeTagsFromList,
} from "../utils/taskTagList";
import { downloadTaskICSFile, openCalendarURL } from "../ui/calendarExportActions";
import {
	openMaterializedOccurrenceParent,
	openOrCreateOccurrenceNote,
} from "../ui/occurrenceNoteActions";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import type { UserMappedField } from "../types/settings";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/TaskContextMenu" });

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
	/** The clicked occurrence (Calendar); omit to let the service's anchor-aware default resolve the date. */
	occurrenceDate?: Date;
	onUpdate?: () => void;
	promoteOccurrenceControls?: boolean;
}

export class TaskContextMenu {
	private menu: Menu;
	private options: TaskContextMenuOptions;
	private targetDoc: Document = activeDocument;

	constructor(options: TaskContextMenuOptions, menu: Menu = new ContextMenu()) {
		this.menu = menu;
		this.options = options;
		this.buildMenu();
	}

	static addToMenu(menu: Menu, options: TaskContextMenuOptions): void {
		new TaskContextMenu(options, menu);
	}

	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}

	private buildMenu(): void {
		const { task, plugin } = this.options;
		const hasPromotedOccurrenceControls = this.addPromotedOccurrenceControls(task, plugin);

		// Status submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Status", context: "contextMenus.task.status" })));
			item.setIcon("circle");

			const submenu = getSubmenu(item);
			this.addStatusOptions(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Priority submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Priority", context: "contextMenus.task.priority" })));
			item.setIcon("star");

			const submenu = getSubmenu(item);
			this.addPriorityOptions(submenu, task, plugin);
		});

		// Tags submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Tags", context: "contextMenus.task.tags" })));
			item.setIcon("tags");

			const submenu = getSubmenu(item);
			this.addTagOptions(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Due Date submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Due date", context: "contextMenus.task.dueDate" })));
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
						tasknotesLogger.error("Error updating task due date:", {
							category: "validation",
							operation: "updating-task-due-date",
							details: { taskPath: task.path },
							error: errorMessage,
						});
						new Notice(
							this.t(msg({ message: "Failed to update task due date: {message}", context: "contextMenus.task.notices.updateDueDateFailure" }), {
								message: displayError(errorMessage),
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
			item.setTitle(this.t(msg({ message: "Scheduled date", context: "contextMenus.task.scheduledDate" })));
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
						tasknotesLogger.error("Error updating task scheduled date:", {
							category: "validation",
							operation: "updating-task-scheduled-date",
							details: { taskPath: task.path },
							error: errorMessage,
						});
						new Notice(
							this.t(msg({ message: "Failed to update task scheduled date: {message}", context: "contextMenus.task.notices.updateScheduledFailure" }), {
								message: displayError(errorMessage),
							})
						);
					}
				},
				() => {
					void plugin.openScheduledDateModal(task);
				}
			);
		});

		this.addCustomDateFieldMenuItems(task, plugin);

		this.addCompleteOrSkipSection(task, plugin);

		// Occurrence note stays at the top level (it is not a complete/skip action).
		if (task.recurrence && !this.options.promoteOccurrenceControls) {
			this.addOccurrenceNoteMenuItem(task, plugin);
		}

		if (!hasPromotedOccurrenceControls && task.recurrence_parent && task.occurrence_date) {
			this.addMaterializedOccurrenceMenuItems(task, plugin);
		}

		// Reminders submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Reminders", context: "contextMenus.task.reminders" })));
			item.setIcon("bell");

			const submenu = getSubmenu(item);

			// Quick Add sections
			this.addQuickRemindersSection(
				submenu,
				task,
				plugin,
				"due",
				this.t(msg({ message: "Remind before due…", context: "contextMenus.task.remindBeforeDue" }))
			);
			this.addQuickRemindersSection(
				submenu,
				task,
				plugin,
				"scheduled",
				this.t(msg({ message: "Remind before scheduled…", context: "contextMenus.task.remindBeforeScheduled" }))
			);

			submenu.addSeparator();

			// Manage reminders
			submenu.addItem((subItem) => {
				subItem.setTitle(this.t(msg({ message: "Manage all reminders…", context: "contextMenus.task.manageReminders" })));
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
								tasknotesLogger.error("Error updating reminders:", {
									category: "persistence",
									operation: "updating-reminders",
									error: error,
								});
								new Notice(
									this.t(msg({ message: "Failed to update reminders", context: "contextMenus.task.notices.updateRemindersFailure" }))
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
					subItem.setTitle(this.t(msg({ message: "Clear all reminders", context: "contextMenus.task.clearReminders" })));
					subItem.setIcon("trash");
					subItem.onClick(async () => {
						try {
							await plugin.updateTaskProperty(task, "reminders", undefined);
							this.options.onUpdate?.();
						} catch (error) {
							tasknotesLogger.error("Error clearing reminders:", {
								category: "persistence",
								operation: "clearing-reminders",
								error: error,
							});
							new Notice(this.t(msg({ message: "Failed to clear reminders", context: "contextMenus.task.notices.clearRemindersFailure" })));
						}
					});
				});
			}
		});

		this.menu.addSeparator();

		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Dependencies", context: "contextMenus.task.dependencies.title" })));
			item.setIcon("git-branch");

			const submenu = getSubmenu(item);
			this.addDependencyMenuItems(submenu, task, plugin);
		});

		// this.menu.addSeparator();

		// Organization submenu (projects and subtasks)
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Organization", context: "contextMenus.task.organization.title" })));
			item.setIcon("folder-tree");

			const submenu = getSubmenu(item);
			this.addOrganizationMenuItems(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Time Tracking
		this.menu.addItem((item) => {
			const activeSession = plugin.getActiveTimeSession(task);
			item.setTitle(
				activeSession
					? this.t(msg({ message: "Stop time tracking", context: "contextMenus.task.stopTimeTracking" }))
					: this.t(msg({ message: "Start time tracking", context: "contextMenus.task.startTimeTracking" }))
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

		// Edit Time Entries
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Edit time entries", context: "contextMenus.task.editTimeEntries" })));
			item.setIcon("clock");
			item.onClick(() => {
				plugin.openTimeEntryEditor(task);
			});
		});

		// Create timeblock from task
		if (plugin.settings.calendarViewSettings.enableTimeblocking) {
			this.menu.addItem((item) => {
				item.setTitle(this.t(msg({ message: "Create timeblock", context: "modals.timeblockCreation.heading" })));
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
					? this.t(msg({ message: "Unarchive", context: "contextMenus.task.unarchive" }))
					: this.t(msg({ message: "Archive", context: "contextMenus.task.archive" }))
			);
			item.setIcon(task.archived ? "archive-restore" : "archive");
			item.onClick(async () => {
				try {
					await plugin.toggleTaskArchive(task);
					this.options.onUpdate?.();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					tasknotesLogger.error("Error toggling task archive:", {
						category: "persistence",
						operation: "toggling-task-archive",
						details: { taskPath: task.path },
						error: errorMessage,
					});
					new Notice(
						this.t(msg({ message: "Failed to toggle task archive: {message}", context: "contextMenus.task.notices.archiveFailure" }), {
							message: displayError(errorMessage),
						})
					);
				}
			});
		});

		this.menu.addSeparator();

		// Edit Task
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Edit task", context: "modals.taskEdit.title" })));
			item.setIcon("pencil");
			item.onClick(() => {
				void plugin.openTaskEditModal(task, () => {
					this.options.onUpdate?.();
				});
			});
		});

		// Open Note
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Open note", context: "contextMenus.task.openNote" })));
			item.setIcon("file-text");
			item.onClick(() => {
				const file = plugin.app.vault.getAbstractFileByPath(task.path);
				if (file instanceof TFile) {
					void plugin.app.workspace.getLeaf(false).openFile(file);
				}
			});
		});

		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Open note in new tab", context: "contextMenus.task.openNoteInNewTab" })));
			item.setIcon("external-link");
			item.onClick(() => {
				const file = plugin.app.vault.getAbstractFileByPath(task.path);
				if (file instanceof TFile) {
					void plugin.app.workspace.openLinkText(task.path, "", true);
				}
			});
		});

		// Copy Task Title
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Copy task title", context: "contextMenus.task.copyTitle" })));
			item.setIcon("copy");
			item.onClick(async () => {
				try {
					await navigator.clipboard.writeText(task.title);
					new Notice(this.t(msg({ message: "Task title copied to clipboard", context: "contextMenus.task.notices.copyTitleSuccess" })));
				} catch {
					new Notice(this.t(msg({ message: "Failed to copy to clipboard", context: "contextMenus.task.notices.copyFailure" })));
				}
			});
		});

		// Note actions submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Note actions", context: "contextMenus.task.noteActions" })));
			item.setIcon("file-text");

			const submenu = getSubmenu(item);

			// Get the file for the task
			const file = plugin.app.vault.getAbstractFileByPath(task.path);
			if (file instanceof TFile) {
				// Try to populate with Obsidian's native file menu
				try {
					// Trigger the file-menu event to populate with default actions
					plugin.app.workspace.trigger(
						"file-menu",
						submenu,
						file,
						"tasknotes-context-menu"
					);
				} catch {
					tasknotesLogger.debug("Native file menu not available, using fallback", {
						category: "stale-data",
						operation: "native-file-menu-not-using-fallback",
					});
				}

				// Add common file actions (these will either supplement or replace the native menu)
				submenu.addItem((subItem) => {
					subItem.setTitle(this.t(msg({ message: "Rename", context: "contextMenus.task.rename" })));
					subItem.setIcon("pencil");
					subItem.onClick(async () => {
						try {
							// Modal-based rename
							const currentName = file.basename;
							const newName = await showTextInputModal(plugin.app, {
								title: this.t(msg({ message: "Rename file", context: "contextMenus.task.renameTitle" })),
								placeholder: this.t(msg({ message: "Enter new name", context: "contextMenus.task.renamePlaceholder" })),
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
								await renameVaultFile(plugin.app, file, newPath);
								new Notice(
									this.t(msg({ message: "Renamed to \"{name}\"", context: "contextMenus.task.notices.renameSuccess" }), {
										name: finalName,
									})
								);

								// Trigger update callback
								if (this.options.onUpdate) {
									this.options.onUpdate();
								}
							}
						} catch (error) {
							tasknotesLogger.error("Error renaming file:", {
								category: "persistence",
								operation: "renaming-file",
								error: error,
							});
							new Notice(this.t(msg({ message: "Failed to rename file", context: "contextMenus.task.notices.renameFailure" })));
						}
					});
				});

				submenu.addItem((subItem) => {
					subItem.setTitle(this.t(msg({ message: "Delete", context: "contextMenus.task.delete" })));
					subItem.setIcon("trash");
					subItem.onClick(async () => {
						// Show confirmation and delete
						const confirmed = await showConfirmationModal(plugin.app, {
							title: this.t(msg({ message: "Delete file", context: "contextMenus.task.deleteTitle" })),
							message: this.t(msg({ message: "Are you sure you want to delete \"{name}\"?", context: "contextMenus.task.deleteMessage" }), { name: file.name }),
							confirmText: this.t(msg({ message: "Delete", context: "contextMenus.task.deleteConfirm" })),
							cancelText: this.t(msg({ message: "Cancel", context: "common.cancel" })),
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
								tasknotesLogger.error("Error deleting task:", {
									category: "persistence",
									operation: "deleting-task",
									error: error,
								});
								new Notice(
									this.t(msg({ message: "Failed to delete task: {message}", context: "modals.taskEdit.notices.deleteFailure" }), { message: displayError(message) })
								);
							}
						}
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem) => {
					subItem.setTitle(this.t(msg({ message: "Copy path", context: "contextMenus.task.copyPath" })));
					subItem.setIcon("copy");
					subItem.onClick(() => {
						void navigator.clipboard
							.writeText(file.path)
							.then(() => {
								new Notice(this.t(msg({ message: "File path copied to clipboard", context: "contextMenus.task.notices.copyPathSuccess" })));
							})
							.catch(() => {
								new Notice(this.t(msg({ message: "Failed to copy to clipboard", context: "contextMenus.task.notices.copyFailure" })));
							});
					});
				});

				submenu.addItem((subItem) => {
					subItem.setTitle(this.t(msg({ message: "Copy Obsidian URL", context: "contextMenus.task.copyUrl" })));
					subItem.setIcon("link");
					subItem.onClick(() => {
						const url = `obsidian://open?vault=${encodeURIComponent(plugin.app.vault.getName())}&file=${encodeURIComponent(file.path)}`;
						void navigator.clipboard
							.writeText(url)
							.then(() => {
								new Notice(this.t(msg({ message: "Obsidian URL copied to clipboard", context: "contextMenus.task.notices.copyUrlSuccess" })));
							})
							.catch(() => {
								new Notice(this.t(msg({ message: "Failed to copy to clipboard", context: "contextMenus.task.notices.copyFailure" })));
							});
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem) => {
					subItem.setTitle(this.t(msg({ message: "Show in file explorer", context: "contextMenus.task.showInExplorer" })));
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
								tasknotesLogger.warn("Failed to reveal task in file explorer:", {
									category: "persistence",
									operation: "reveal-task-file-explorer",
									error: error,
								});
							});
					});
				});
			}
		});

		this.menu.addSeparator();

		// Add to Calendar submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Add to calendar", context: "contextMenus.task.addToCalendar" })));
			item.setIcon("calendar-plus");

			const submenu = getSubmenu(item);

			// Google Calendar
			submenu.addItem((subItem) => {
				subItem.setTitle(this.t(msg({ message: "Google Calendar", context: "contextMenus.task.calendar.google" })));
				subItem.setIcon("external-link");
				subItem.onClick(() => {
					openCalendarURL(
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
				subItem.setTitle(this.t(msg({ message: "Outlook Calendar", context: "contextMenus.task.calendar.outlook" })));
				subItem.setIcon("external-link");
				subItem.onClick(() => {
					openCalendarURL(
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
				subItem.setTitle(this.t(msg({ message: "Yahoo Calendar", context: "contextMenus.task.calendar.yahoo" })));
				subItem.setIcon("external-link");
				subItem.onClick(() => {
					openCalendarURL(
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
				subItem.setTitle(this.t(msg({ message: "Download .ics file", context: "contextMenus.task.calendar.downloadIcs" })));
				subItem.setIcon("download");
				subItem.onClick(() => {
					downloadTaskICSFile(task, this.t.bind(this), {
						includeObsidianLink: true,
						vaultName: plugin.app.vault.getName(),
					});
				});
			});

			submenu.addSeparator();

			// Sync to Google Calendar (via API)
			submenu.addItem((subItem) => {
				subItem.setTitle(this.t(msg({ message: "Sync to Google Calendar", context: "contextMenus.task.calendar.syncToGoogle" })));
				subItem.setIcon("refresh-cw");
				subItem.onClick(async () => {
					if (!plugin.taskCalendarSyncService?.isEnabled()) {
						new Notice(this.t(msg({ message: "Google Calendar sync not configured", context: "contextMenus.task.calendar.syncToGoogleNotConfigured" })));
						return;
					}
					try {
						await plugin.taskCalendarSyncService.syncTaskToCalendar(task);
						new Notice(this.t(msg({ message: "Task synced to Google Calendar", context: "contextMenus.task.calendar.syncToGoogleSuccess" })));
						this.options.onUpdate?.();
					} catch (error) {
						tasknotesLogger.error("Failed to sync task to Google Calendar:", {
							category: "provider",
							operation: "sync-task-google-calendar",
							error: error,
						});
						new Notice(this.t(msg({ message: "Failed to sync task to Google Calendar", context: "contextMenus.task.calendar.syncToGoogleFailed" })));
					}
				});
			});
		});

		this.menu.addSeparator();

		// Recurrence submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Recurrence", context: "contextMenus.task.recurrence" })));
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
						tasknotesLogger.error("Error updating task recurrence:", {
							category: "persistence",
							operation: "updating-task-recurrence",
							details: { taskPath: task.path },
							error: errorMessage,
						});
						new Notice(
							this.t(msg({ message: "Failed to update task recurrence: {message}", context: "contextMenus.task.notices.updateRecurrenceFailure" }), {
								message: displayError(errorMessage),
							})
						);
					}
				},
				plugin
			);

			if (currentRecurrence) {
				this.addOccurrencePolicyOptions(submenu, task, plugin);
			}
		});

		this.menu.addSeparator();

		// Create subtask
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Create subtask", context: "contextMenus.task.createSubtask" })));
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
			item.setTitle(this.t(msg({ message: "Close", context: "common.close" })));
			item.setIcon("x");
			item.onClick(() => {
				this.menu.hide();
			});
		});
	}

	/** Render the completion and, for recurring tasks, skip actions. */
	private addCompleteOrSkipSection(task: TaskInfo, plugin: TaskNotesPlugin): void {
		const isRecurring = !!task.recurrence;

		// Default to the submenu when the setting is unset (backward compatible).
		if (plugin.settings.completionMenuAsSubmenu === false) {
			this.menu.addSeparator();
			this.addCompletionMenuItems(task, plugin, this.menu);
			if (isRecurring) {
				this.addSkipMenuItem(task, plugin, this.menu);
			}
			this.menu.addSeparator();
			return;
		}

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					isRecurring
						? msg({ message: "Mark complete or skip", context: "contextMenus.task.completion.submenu" })
						: msg({ message: "Mark complete", context: "contextMenus.task.completion.submenuCompleteOnly" })
				)
			);
			item.setIcon("check-check");
			const submenu = getSubmenu(item);
			this.addCompletionMenuItems(task, plugin, submenu);
			if (isRecurring) {
				this.addSkipMenuItem(task, plugin, submenu);
			}
		});
	}

	/**
	 * Render the four completion actions. Un-complete differs by type: recurring
	 * toggles each action's own date; non-recurring collapses to one "Mark incomplete".
	 */
	private addCompletionMenuItems(task: TaskInfo, plugin: TaskNotesPlugin, menu: Menu): void {
		const isRecurring = !!task.recurrence;

		if (!isRecurring && plugin.statusManager.isCompletedStatus(task.status)) {
			menu.addItem((item) => {
				item.setTitle(this.t(msg({ message: "Mark incomplete", context: "contextMenus.task.completion.markIncomplete" })));
				item.setIcon("x");
				item.onClick(async () => {
					await this.uncompleteNonRecurringTask(task, plugin);
				});
			});
			return;
		}

		this.addConcreteCompletionAction(
			task,
			plugin,
			"today",
			msg({ message: "Completed today", context: "contextMenus.task.completion.completeToday" }),
			menu
		);
		this.addConcreteCompletionAction(
			task,
			plugin,
			"asScheduled",
			msg({ message: "Completed on schedule", context: "contextMenus.task.completion.completeAsScheduled" }),
			menu
		);
		this.addConcreteCompletionAction(
			task,
			plugin,
			"onDue",
			msg({ message: "Completed on due date", context: "contextMenus.task.completion.completeOnDue" }),
			menu
		);
		this.addPickCompletionDateAction(task, plugin, menu);
	}

	private addConcreteCompletionAction(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		mode: CompletionMode,
		baseLabelKey: MessageDescriptor,
		menu: Menu
	): void {
		const isRecurring = !!task.recurrence;
		const ctx: CompletionDateContext = { occurrenceDate: this.options.occurrenceDate };
		const resolution = resolveCompletionDate(task, mode, ctx);

		menu.addItem((item) => {
			if (!resolution.available) {
				// Shown disabled (not hidden) with a reason tooltip.
				item.setTitle(this.t(baseLabelKey));
				item.setIcon("check");
				item.setDisabled(true);
				const el = getMenuItemElement(item);
				if (el) {
					setTooltip(el, this.t(resolution.reasonKey));
				}
				return;
			}

			const resolvedDate = resolution.date;
			const alreadyComplete =
				isRecurring &&
				(task.complete_instances?.includes(formatDateForStorage(resolvedDate)) ?? false);
			item.setTitle(
				alreadyComplete
					? this.t(msg({ message: "Mark incomplete", context: "contextMenus.task.completion.markIncomplete" }))
					: this.t(baseLabelKey)
			);
			item.setIcon(alreadyComplete ? "x" : "check");
			item.onClick(async () => {
				await this.dispatchCompletion(task, plugin, resolvedDate);
			});
		});
	}

	private addPickCompletionDateAction(task: TaskInfo, plugin: TaskNotesPlugin, menu: Menu): void {
		menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Completed on (pick date)", context: "contextMenus.task.completion.completeOnPicked" })));
			item.setIcon("calendar-plus");
			item.onClick(() => {
				this.pickCompletionDate(task, plugin);
			});
		});
	}

	/**
	 * Open the shared date picker and record completion date-only (storage keys are
	 * date-only, so the picker offers no time). Cancel is a no-op.
	 */
	private pickCompletionDate(task: TaskInfo, plugin: TaskNotesPlugin): void {
		this.menu.hide();
		const modal = new DateTimePickerModal(plugin.app, {
			currentDate: null,
			title: this.t(msg({ message: "Complete on date", context: "contextMenus.task.completion.pickDateTitle" })),
			showTime: false,
			plugin,
			onSelect: (date) => {
				if (!date) {
					return;
				}
				const picked = parseDateToUTC(getDatePart(date));
				const resolution = resolveCompletionDate(task, "onPicked", { pickedDate: picked });
				if (!resolution.available) {
					return;
				}
				void this.dispatchCompletion(task, plugin, resolution.date);
			},
		});
		modal.open();
	}

	private async dispatchCompletion(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		resolvedDate: Date
	): Promise<void> {
		try {
			if (task.recurrence) {
				// Completion-anchored recurrences re-anchor DTSTART from the recorded date.
				await plugin.toggleRecurringTaskComplete(task, resolvedDate);
			} else {
				const completedStatus = plugin.statusManager.getCompletedStatuses()[0];
				if (!completedStatus) {
					new Notice(this.t(msg({ message: "No completed status configured", context: "contextMenus.task.completion.noCompletedStatus" })));
					return;
				}
				await plugin.updateTaskProperty(task, "status", completedStatus, {
					completionDate: formatDateForStorage(resolvedDate),
				});
			}
			this.options.onUpdate?.();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error completing task:", {
				category: "persistence",
				operation: "completing-task",
				details: { taskPath: task.path },
				error: errorMessage,
			});
			new Notice(
				this.t(msg({ message: "Failed to update task completion: {message}", context: "contextMenus.task.completion.completeFailure" }), {
					message: displayError(errorMessage),
				})
			);
		}
	}

	private async uncompleteNonRecurringTask(
		task: TaskInfo,
		plugin: TaskNotesPlugin
	): Promise<void> {
		try {
			// Revert to the default open status; the status pipeline clears
			// completedDate for a non-completed status (mirrors uncompleteTask).
			const openStatus = plugin.settings.defaultTaskStatus ?? "open";
			await plugin.updateTaskProperty(task, "status", openStatus);
			this.options.onUpdate?.();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error marking task incomplete:", {
				category: "persistence",
				operation: "uncompleting-task",
				details: { taskPath: task.path },
				error: errorMessage,
			});
			new Notice(
				this.t(msg({ message: "Failed to update task completion: {message}", context: "contextMenus.task.completion.completeFailure" }), {
					message: displayError(errorMessage),
				})
			);
		}
	}

	private addSkipMenuItem(task: TaskInfo, plugin: TaskNotesPlugin, menu: Menu): void {
		// Not routed through the four-mode resolver: that would drop the completion-anchor guard.
		const skipOccurrenceDate = this.options.occurrenceDate;
		const skipLabelDate = skipOccurrenceDate ?? getRecurringTaskActionDate(task);
		const skipDateStr = formatDateForStorage(skipLabelDate);
		const isSkippedForDate = task.skipped_instances?.includes(skipDateStr) || false;

		menu.addItem((item) => {
			item.setTitle(
				isSkippedForDate
					? this.t(msg({ message: "Unskip instance", context: "contextMenus.task.unskipInstance" }))
					: this.t(msg({ message: "Skip instance", context: "contextMenus.task.skipInstance" }))
			);
			item.setIcon(isSkippedForDate ? "undo" : "x-circle");
			item.onClick(async () => {
				try {
					await plugin.taskService.toggleRecurringTaskSkipped(task, skipOccurrenceDate);
					this.options.onUpdate?.();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					tasknotesLogger.error("Error toggling recurring task skip:", {
						category: "persistence",
						operation: "toggling-recurring-task-skip",
						details: { taskPath: task.path },
						error: errorMessage,
					});
					new Notice(
						this.t(msg({ message: "Failed to toggle recurring task skip: {message}", context: "contextMenus.task.notices.toggleSkipFailure" }), {
							message: displayError(errorMessage),
						})
					);
				}
			});
		});
	}

	private addPromotedOccurrenceControls(task: TaskInfo, plugin: TaskNotesPlugin): boolean {
		if (!this.options.promoteOccurrenceControls) {
			return false;
		}

		let added = false;
		if (task.recurrence) {
			this.addOccurrenceNoteMenuItem(task, plugin);
			added = true;
		}
		if (task.recurrence_parent && task.occurrence_date) {
			this.addMaterializedOccurrenceMenuItems(task, plugin);
			added = true;
		}

		if (added) {
			this.menu.addSeparator();
		}
		return added;
	}

	private addOccurrenceNoteMenuItem(task: TaskInfo, plugin: TaskNotesPlugin): void {
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Open or create occurrence note", context: "modals.actionPalette.openOccurrence" })));
			item.setIcon("file-plus");
			item.onClick(async () => {
				await openOrCreateOccurrenceNote({
					plugin,
					parentTask: task,
					targetDate: this.getOccurrenceNoteTargetDate(task),
					onUpdate: this.options.onUpdate,
				});
			});
		});
	}

	private getOccurrenceNoteTargetDate(task: TaskInfo): Date {
		if (this.options.promoteOccurrenceControls || task.recurrence_anchor !== "completion") {
			return this.options.targetDate;
		}

		try {
			const scheduledDate = getDatePart(task.scheduled || "");
			return scheduledDate ? parseDateToUTC(scheduledDate) : this.options.targetDate;
		} catch {
			return this.options.targetDate;
		}
	}

	private addMaterializedOccurrenceMenuItems(task: TaskInfo, plugin: TaskNotesPlugin): void {
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Open recurring parent", context: "modals.actionPalette.openParent" })));
			item.setIcon("refresh-ccw");
			item.onClick(async () => {
				await openMaterializedOccurrenceParent({
					plugin,
					occurrenceTask: task,
				});
			});
		});

		const skippedStatus = this.getSkippedStatusValue(plugin);
		const isSkipped = this.isSkippedMaterializedOccurrence(task, plugin);
		if (!skippedStatus && !isSkipped) {
			return;
		}

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					isSkipped
						? msg({ message: "Unskip instance", context: "contextMenus.task.unskipInstance" })
						: msg({ message: "Skip instance", context: "contextMenus.task.skipInstance" })
				)
			);
			item.setIcon(isSkipped ? "undo" : "x-circle");
			item.onClick(async () => {
				try {
					const updatedTask = isSkipped
						? await plugin.taskService.unskipMaterializedOccurrence(task)
						: await plugin.taskService.skipMaterializedOccurrence(task, skippedStatus);
					Object.assign(task, updatedTask);
					this.options.onUpdate?.();
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					tasknotesLogger.error("Error updating materialized occurrence skip state:", {
						category: "persistence",
						operation: "updating-materialized-occurrence-skip-state",
						details: { taskPath: task.path, occurrenceDate: task.occurrence_date },
						error: errorMessage,
					});
					new Notice(
						this.t(msg({ message: "Failed to update task: {message}", context: "modals.taskEdit.notices.updateFailure" }), { message: displayError(errorMessage) })
					);
				}
			});
		});
	}

	private getSkippedStatusValue(plugin: TaskNotesPlugin): string | undefined {
		return plugin.settings.customStatuses?.find((status) => status.isSkipped)?.value;
	}

	private isSkippedMaterializedOccurrence(task: TaskInfo, plugin: TaskNotesPlugin): boolean {
		return (
			plugin.settings.customStatuses?.some(
				(status) => status.isSkipped && status.value === task.status
			) === true
		);
	}

	private addDependencyMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		menu.addItem((subItem) => {
			subItem.setTitle(this.t(msg({ message: "Add “blocked by”…", context: "contextMenus.task.dependencies.addBlockedBy" })));
			subItem.setIcon("link-2");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openBlockedBySelector(task, plugin);
			});
		});

		const blockedByEntries = task.blockedBy ?? [];
		if (blockedByEntries.length > 0) {
			menu.addItem((subItem) => {
				subItem.setTitle(this.t(msg({ message: "Remove blocked-by…", context: "contextMenus.task.dependencies.removeBlockedBy" })));
				subItem.setIcon("unlink");
				const innerMenu = getSubmenu(subItem);
				blockedByEntries.forEach((entry, index) => {
					innerMenu.addItem((item) => {
						const uid = toMenuTitle(
							extractDependencyUid(entry),
							this.t(msg({ message: "Unknown", context: "contextMenus.task.dependencies.unknownDependency" }))
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
										msg({ message: "Dependency removed", context: "contextMenus.task.dependencies.notices.blockedByRemoved" })
									)
								);
								this.options.onUpdate?.();
							} catch (error) {
								tasknotesLogger.error("Failed to remove blocked-by dependency:", {
									category: "persistence",
									operation: "remove-blocked-by-dependency",
									error: error,
								});
								new Notice(
									this.t(msg({ message: "Failed to update dependencies", context: "contextMenus.task.dependencies.notices.updateFailed" }))
								);
							}
						});
					});
				});
			});
		}

		menu.addSeparator();

		menu.addItem((subItem) => {
			subItem.setTitle(this.t(msg({ message: "Add “blocking”…", context: "contextMenus.task.dependencies.addBlocking" })));
			subItem.setIcon("git-branch-plus");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openBlockingSelector(task, plugin);
			});
		});

		const blockingEntries = task.blocking ?? [];
		if (blockingEntries.length > 0) {
			menu.addItem((subItem) => {
				subItem.setTitle(this.t(msg({ message: "Remove blocking…", context: "contextMenus.task.dependencies.removeBlocking" })));
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
									this.t(msg({ message: "Dependent task removed", context: "contextMenus.task.dependencies.notices.blockingRemoved" }))
								);
								this.options.onUpdate?.();
							} catch (error) {
								tasknotesLogger.error("Failed to remove blocking dependency:", {
									category: "persistence",
									operation: "remove-blocking-dependency",
									error: error,
								});
								new Notice(
									this.t(msg({ message: "Failed to update dependencies", context: "contextMenus.task.dependencies.notices.updateFailed" }))
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
				new Notice(this.t(msg({ message: "No matching tasks available", context: "contextMenus.task.dependencies.notices.noEligibleTasks" })));
				return;
			}

			openTaskSelector(plugin, candidates, (task) => {
				if (!task) return;
				void onSelect(task);
			});
		} catch (error) {
			tasknotesLogger.error("Failed to open task selector for dependencies:", {
				category: "persistence",
				operation: "open-task-selector-dependencies",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to update dependencies", context: "contextMenus.task.dependencies.notices.updateFailed" })));
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
				this.t(msg({ message: "{count} dependency added", context: "contextMenus.task.dependencies.notices.blockedByAdded" }), { count: 1 })
			);
			this.options.onUpdate?.();
		} catch (error) {
			tasknotesLogger.error("Failed to add blocked-by dependency via selector:", {
				category: "persistence",
				operation: "add-blocked-by-dependency-via-selector",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to update dependencies", context: "contextMenus.task.dependencies.notices.updateFailed" })));
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
				this.t(msg({ message: "{count} dependent task added", context: "contextMenus.task.dependencies.notices.blockingAdded" }), { count: 1 })
			);
			this.options.onUpdate?.();
		} catch (error) {
			tasknotesLogger.error("Failed to add blocking dependency via selector:", {
				category: "persistence",
				operation: "add-blocking-dependency-via-selector",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to update dependencies", context: "contextMenus.task.dependencies.notices.updateFailed" })));
		}
	}

	private getDependencyKey(entry: TaskDependency): string {
		return `${entry.uid}::${entry.reltype}::${entry.gap ?? ""}`;
	}

	private addOrganizationMenuItems(menu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		// Contexts
		menu.addItem((subItem) => {
			subItem.setTitle(this.t(msg({ message: "Contexts", context: "contextMenus.task.organization.contexts" })));
			subItem.setIcon("at-sign");
			const contextMenu = getSubmenu(subItem);
			this.addContextMenuItems(contextMenu, task, plugin);
		});

		menu.addSeparator();

		// Add to project
		menu.addItem((subItem) => {
			subItem.setTitle(this.t(msg({ message: "Add to project…", context: "contextMenus.task.organization.addToProject" })));
			subItem.setIcon("folder-plus");
			subItem.onClick(() => {
				this.menu.hide();
				void this.openProjectSelector(task, plugin);
			});
		});

		// Add subtasks
		menu.addItem((subItem) => {
			subItem.setTitle(this.t(msg({ message: "Add subtasks…", context: "contextMenus.task.organization.addSubtasks" })));
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
			item.setTitle(this.t(msg({ message: "Add context…", context: "contextMenus.task.organization.addContext" })));
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
							? this.t(msg({ message: "✓ {context}", context: "contextMenus.task.organization.contextSelected" }), {
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
				item.setTitle(this.t(msg({ message: "Clear contexts", context: "contextMenus.task.organization.clearContexts" })));
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
			title: this.t(msg({ message: "Add context…", context: "contextMenus.task.organization.addContext" })),
			placeholder: this.t(msg({ message: "context", context: "contextMenus.task.organization.contextPlaceholder" })),
			confirmText: this.t(msg({ message: "Confirm", context: "common.confirm" })),
			cancelText: this.t(msg({ message: "Cancel", context: "common.cancel" })),
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
			tasknotesLogger.error("Failed to update task contexts:", {
				category: "validation",
				operation: "update-task-contexts",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to update contexts", context: "contextMenus.task.organization.notices.updateContextsFailed" })));
		}
	}

	private addTagOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const editableTags = getEditableTaskTags(task, plugin.settings);

		submenu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Add tag…", context: "contextMenus.task.addTag" })));
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
					item.setTitle(this.t(msg({ message: "Remove {tag}", context: "contextMenus.task.removeTag" }), { tag: `#${tag}` }));
					item.setIcon("x");
					item.onClick(async () => {
						await this.updateTaskTags(
							task,
							plugin,
							removeTagsFromList(task.tags, [tag])
						);
					});
				});
			}

			submenu.addSeparator();
			submenu.addItem((item) => {
				item.setTitle(this.t(msg({ message: "Clear tags", context: "contextMenus.task.clearTags" })));
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
					? this.t(msg({ message: "Add tag…", context: "contextMenus.task.addTag" }))
					: this.t(msg({ message: "Remove tag…", context: "contextMenus.task.removeTagInput" })),
			placeholder: this.t(msg({ message: "Tag or #tag", context: "contextMenus.task.tagPlaceholder" })),
			confirmText: this.t(msg({ message: "Confirm", context: "common.confirm" })),
			cancelText: this.t(msg({ message: "Cancel", context: "common.cancel" })),
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
			tasknotesLogger.error("Failed to update task tags:", {
				category: "validation",
				operation: "update-task-tags",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to update tags", context: "contextMenus.task.notices.updateTagsFailed" })));
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
			tasknotesLogger.error("Failed to open project selector:", {
				category: "persistence",
				operation: "open-project-selector",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to open project selector", context: "contextMenus.task.organization.notices.projectSelectFailed" })));
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
				new Notice(this.t(msg({ message: "No eligible tasks available to assign as subtasks", context: "contextMenus.task.organization.notices.noEligibleSubtasks" })));
				return;
			}

			openTaskSelector(plugin, candidates, (subtask) => {
				if (!subtask) return;
				void this.assignTaskAsSubtask(task, plugin, subtask);
			});
		} catch (error) {
			tasknotesLogger.error("Failed to open subtask assignment selector:", {
				category: "persistence",
				operation: "open-subtask-assignment-selector",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to open subtask selector", context: "contextMenus.task.organization.notices.subtaskSelectFailed" })));
		}
	}

	private async addTaskToProject(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		projectFile: TAbstractFile
	): Promise<void> {
		try {
			if (!(projectFile instanceof TFile)) {
				new Notice(this.t(msg({ message: "Failed to open project selector", context: "contextMenus.task.organization.notices.projectSelectFailed" })));
				return;
			}

			const updatedTask = await addTaskToProject(plugin, task, projectFile);
			if (updatedTask) {
				Object.assign(task, updatedTask);
				this.options.onUpdate?.();
			}
		} catch (error) {
			tasknotesLogger.error("Failed to add task to project:", {
				category: "persistence",
				operation: "add-task-project",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to add task to project", context: "contextMenus.task.organization.notices.addToProjectFailed" })));
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
				new Notice(this.t(msg({ message: "Current task file not found", context: "contextMenus.task.organization.notices.currentTaskNotFound" })));
				return;
			}

			const updatedSubtask = await assignTaskAsSubtask(plugin, currentTaskFile, subtask);
			if (updatedSubtask) {
				Object.assign(subtask, updatedSubtask);
				this.options.onUpdate?.();
			}
		} catch (error) {
			tasknotesLogger.error("Failed to assign task as subtask:", {
				category: "persistence",
				operation: "assign-task-as-subtask",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to add task as subtask", context: "contextMenus.task.organization.notices.addAsSubtaskFailed" })));
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
		const statusTitle = this.t(msg({ message: "Status", context: "contextMenus.task.status" }));
		const priorityTitle = this.t(msg({ message: "Priority", context: "contextMenus.task.priority" }));

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
					title = this.t(msg({ message: "✓ {label}", context: "contextMenus.task.statusSelected" }), { label });
				}

				item.setTitle(title);

				item.onClick(async () => {
					try {
						await plugin.updateTaskProperty(task, "status", option.value);
						this.options.onUpdate?.();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						tasknotesLogger.error("Error updating task status:", {
							category: "persistence",
							operation: "updating-task-status",
							details: { taskPath: task.path },
							error: errorMessage,
						});
						new Notice(
							this.t(msg({ message: "Failed to update task status: {message}", context: "notices.interface.statusFailed" }), {
								message: displayError(errorMessage),
							})
						);
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
			const label = toMenuTitle(configLabel(priority), value);

			submenu.addItem((item) => {
				let title = label;

				// Use consistent icon for all items
				item.setIcon("star");

				// Highlight current selection with visual indicator
				if (value === task.priority) {
					title = this.t(msg({ message: "✓ {label}", context: "contextMenus.task.prioritySelected" }), { label });
				}

				item.setTitle(title);

				item.onClick(async () => {
					try {
						await plugin.updateTaskProperty(task, "priority", value);
						this.options.onUpdate?.();
					} catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						tasknotesLogger.error("Error updating task priority:", {
							category: "persistence",
							operation: "updating-task-priority",
							details: { taskPath: task.path },
							error: errorMessage,
						});
						new Notice(
							this.t(msg({ message: "Failed to update task: {message}", context: "modals.taskEdit.notices.updateFailure" }), {
								message: displayError(errorMessage),
							})
						);
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
		onCustomDate: () => void,
		options: { pickDateTitle?: string } = {}
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

		const incrementOptions = dateOptions.filter((option) => option.category === "increment");
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
					? this.t(msg({ message: "✓ {label}", context: "contextMenus.date.selected" }), { label: option.label })
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
				item.setTitle(this.t(msg({ message: "Weekdays", context: "contextMenus.date.weekdaysLabel" })));
				item.setIcon("calendar");
				const weekdaySubmenu = getSubmenu(item);
				weekdayOptions.forEach((option) => {
					weekdaySubmenu.addItem((subItem) => {
						const isSelected = option.value === currentValue;
						const title = isSelected
							? this.t(msg({ message: "✓ {label}", context: "contextMenus.date.selected" }), { label: option.label })
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
			item.setTitle(options.pickDateTitle ?? this.t(msg({ message: "Pick date & time…", context: "contextMenus.date.pickDateTime" })));
			item.setIcon("calendar");
			item.onClick(onCustomDate);
		});

		if (currentValue) {
			submenu.addItem((item) => {
				item.setTitle(this.t(msg({ message: "Clear date", context: "contextMenus.date.clearDate" })));
				item.setIcon("x");
				item.onClick(() => {
					void onSelect(null);
				});
			});
		}
	}

	private addCustomDateFieldMenuItems(task: TaskInfo, plugin: TaskNotesPlugin): void {
		const dateFields = this.getCustomDateFields(plugin);
		if (dateFields.length === 0) {
			return;
		}

		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Custom dates", context: "contextMenus.task.customDates" })));
			item.setIcon("calendar-days");

			const submenu = getSubmenu(item);
			dateFields.forEach((field) => {
				submenu.addItem((fieldItem) => {
					const fieldLabel = this.getCustomFieldLabel(field);
					fieldItem.setTitle(fieldLabel);
					fieldItem.setIcon("calendar");

					const fieldSubmenu = getSubmenu(fieldItem);
					const currentValue = this.getCustomDateFieldValue(task, field);
					this.addDateOptions(
						fieldSubmenu,
						currentValue,
						async (value) => {
							await this.updateCustomDateField(task, plugin, field, value);
						},
						() => {
							this.openCustomDateFieldPicker(task, plugin, field, currentValue);
						},
						{
							pickDateTitle: this.t(msg({ message: "Pick {field} date", context: "modals.task.userFields.pickDate" }), {
								field: fieldLabel,
							}),
						}
					);
				});
			});
		});
	}

	private getCustomDateFields(plugin: TaskNotesPlugin): UserMappedField[] {
		return (plugin.settings.userFields || []).filter(
			(field) => field.type === "date" && field.key.trim().length > 0
		);
	}

	private getCustomFieldLabel(field: UserMappedField): string {
		return field.displayName.trim() || field.key || field.id;
	}

	private getCustomDateFieldValue(task: TaskInfo, field: UserMappedField): string | undefined {
		const taskRecord = task as unknown as Record<string, unknown>;
		const value = taskRecord[field.key] ?? task.customProperties?.[field.key];
		return typeof value === "string" && value.trim().length > 0 ? value : undefined;
	}

	private openCustomDateFieldPicker(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		field: UserMappedField,
		currentValue: string | undefined
	): void {
		this.menu.hide();
		const fieldLabel = this.getCustomFieldLabel(field);
		const modal = new DateTimePickerModal(plugin.app, {
			currentDate: currentValue || null,
			title: this.t(msg({ message: "Pick {field} date", context: "modals.task.userFields.pickDate" }), { field: fieldLabel }),
			showTime: false,
			plugin,
			onSelect: (date) => {
				void this.updateCustomDateField(task, plugin, field, date);
			},
		});
		modal.open();
	}

	private async updateCustomDateField(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		field: UserMappedField,
		value: string | null
	): Promise<void> {
		const fieldLabel = this.getCustomFieldLabel(field);
		try {
			const updatedTask = await plugin.updateTaskProperty(
				task,
				field.key as keyof TaskInfo,
				value || undefined
			);
			Object.assign(task, updatedTask);
			this.options.onUpdate?.();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error updating custom date field:", {
				category: "persistence",
				operation: "updating-custom-date-field",
				details: { taskPath: task.path, field: field.key },
				error: errorMessage,
			});
			new Notice(
				this.t(msg({ message: "Failed to update {field}: {message}", context: "contextMenus.task.notices.updateCustomDateFailure" }), {
					field: fieldLabel,
					message: displayError(errorMessage),
				})
			);
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
		const currentDay = dayNames[today.getDay()];
		const currentDate = today.getDate();
		const currentMonth = today.getMonth() + 1;
		const calendarLocale = getPluginCalendarLocale(plugin);
		const dayName = today.toLocaleDateString(uiLocale(), { weekday: "long" });

		const formatDateForDTSTART = (date: Date): string => {
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, "0");
			const day = String(date.getDate()).padStart(2, "0");
			return `${year}${month}${day}`;
		};

		let todayDTSTART = formatDateForDTSTART(today);

		const recurrenceOptions = [
			{
				label: this.t(msg({ message: "Daily", context: "modals.task.recurrence.daily" })),
				value: `DTSTART:${todayDTSTART};FREQ=DAILY;INTERVAL=1`,
				icon: "calendar-days",
			},
			{
				label: this.t(msg({ message: "Weekly on {days}", context: "modals.task.recurrence.weeklyOn" }), { days: dayName }),
				value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;INTERVAL=1;BYDAY=${currentDay}`,
				icon: "calendar",
			},
			{
				label: this.t(msg({ message: "Every 2 weeks", context: "modals.task.recurrence.everyTwoWeeks" })),
				value: `DTSTART:${todayDTSTART};FREQ=WEEKLY;INTERVAL=2;BYDAY=${currentDay}`,
				icon: "calendar",
			},
			{
				label: recurrenceMonthlyOn(currentDate),
				value: `DTSTART:${todayDTSTART};FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${currentDate}`,
				icon: "calendar-range",
			},
			{
				label: this.t(msg({ message: "Every 3 months", context: "modals.task.recurrence.everyThreeMonths" })),
				value: `DTSTART:${todayDTSTART};FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=${currentDate}`,
				icon: "calendar-range",
			},
			{
				label: recurrenceYearlyOn(currentMonth, currentDate),
				value: `DTSTART:${todayDTSTART};FREQ=YEARLY;INTERVAL=1;BYMONTH=${currentMonth};BYMONTHDAY=${currentDate}`,
				icon: "calendar-clock",
			},
			{
				label: this.t(msg({ message: "Weekdays", context: "modals.task.recurrence.weekdays" })),
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
			item.setTitle(this.t(msg({ message: "Custom recurrence...", context: "contextMenus.task.customRecurrence" })));
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
				item.setTitle(this.t(msg({ message: "Clear recurrence", context: "contextMenus.task.clearRecurrence" })));
				item.setIcon("x");
				item.onClick(() => {
					void onSelect(null);
				});
			});
		}
	}

	private addOccurrencePolicyOptions(
		submenu: Menu,
		task: TaskInfo,
		plugin: TaskNotesPlugin
	): void {
		const currentMode = task.occurrence_materialization || "manual";
		const currentTrigger = task.occurrence_next_trigger || "completion";

		submenu.addSeparator();
		submenu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Occurrence notes", context: "ui.audit.occurrenceNotes" })));
			item.setIcon("files");

			const policyMenu = getSubmenu(item);
			const addModeOption = (
				mode: Exclude<OccurrenceMaterializationMode, "rolling">,
				label: string,
				icon: string
			) => {
				policyMenu.addItem((modeItem) => {
					modeItem.setTitle(currentMode === mode ? `✓ ${label}` : label);
					modeItem.setIcon(icon);
					modeItem.onClick(async () => {
						await this.updateOccurrenceMaterializationPolicy(task, plugin, mode);
					});
				});
			};

			addModeOption("manual", this.t(msg({ message: "Create manually", context: "ui.audit.manual" })), "file-plus");
			addModeOption("on_completion", this.t(msg({ message: "Create next after completion", context: "ui.audit.afterCompletion" })), "check-circle");

			policyMenu.addItem((modeItem) => {
				modeItem.setTitle(
					currentMode === "rolling"
						? `✓ ${this.t(msg({ message: "Rolling window (not automated yet)", context: "ui.audit.rolling" }))}`
						: this.t(msg({ message: "Rolling window (not automated yet)", context: "ui.audit.rolling" }))
				);
				modeItem.setIcon("calendar-range");
				modeItem.setDisabled(true);
			});

			if (currentMode !== "on_completion") {
				return;
			}

			policyMenu.addSeparator();
			const triggerOptions: Array<{
				value: OccurrenceNextTrigger;
				label: string;
				icon: string;
			}> = [
				{
					value: "completion",
					label: this.t(msg({ message: "Completion only", context: "ui.audit.completionOnly" })),
					icon: "check",
				},
				{
					value: "completion_or_skip",
					label: this.t(msg({ message: "Completion or skip", context: "ui.audit.completionOrSkip" })),
					icon: "check-check",
				},
			];

			triggerOptions.forEach((option) => {
				policyMenu.addItem((triggerItem) => {
					triggerItem.setTitle(
						currentTrigger === option.value ? `✓ ${option.label}` : option.label
					);
					triggerItem.setIcon(option.icon);
					triggerItem.onClick(async () => {
						await this.updateOccurrenceNextTrigger(task, plugin, option.value);
					});
				});
			});
		});
	}

	private async updateOccurrenceMaterializationPolicy(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		mode: Exclude<OccurrenceMaterializationMode, "rolling">
	): Promise<void> {
		try {
			const updatedTask = await plugin.updateTaskProperty(
				task,
				"occurrence_materialization",
				mode === "manual" ? undefined : mode
			);
			Object.assign(task, updatedTask);

			if (mode !== "on_completion" && task.occurrence_next_trigger) {
				const updatedWithoutTrigger = await plugin.updateTaskProperty(
					task,
					"occurrence_next_trigger",
					undefined
				);
				Object.assign(task, updatedWithoutTrigger);
			}

			this.options.onUpdate?.();
			new Notice(
				mode === "manual"
					? this.t(msg({ message: "Occurrence notes: {mode}", context: "notices.audit.occurrencePolicy" }), { mode: this.t(msg({ message: "Create manually", context: "ui.audit.manual" })) })
					: this.t(msg({ message: "Occurrence notes: {mode}", context: "notices.audit.occurrencePolicy" }), {
							mode: this.t(msg({ message: "Create next after completion", context: "ui.audit.afterCompletion" })),
						})
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error updating occurrence materialization policy:", {
				category: "persistence",
				operation: "updating-occurrence-materialization-policy",
				details: { taskPath: task.path, mode },
				error: errorMessage,
			});
			new Notice(this.t(msg({ message: "Failed to update task: {message}", context: "modals.taskEdit.notices.updateFailure" }), { message: displayError(errorMessage) }));
		}
	}

	private async updateOccurrenceNextTrigger(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		trigger: OccurrenceNextTrigger
	): Promise<void> {
		try {
			const updatedTask = await plugin.updateTaskProperty(
				task,
				"occurrence_next_trigger",
				trigger === "completion" ? undefined : trigger
			);
			Object.assign(task, updatedTask);
			this.options.onUpdate?.();
			new Notice(
				trigger === "completion"
					? this.t(msg({ message: "Occurrence notes: {mode}", context: "notices.audit.occurrencePolicy" }), {
							mode: this.t(msg({ message: "Completion only", context: "ui.audit.completionOnly" })),
						})
					: this.t(msg({ message: "Occurrence notes: {mode}", context: "notices.audit.occurrencePolicy" }), {
							mode: this.t(msg({ message: "Completion or skip", context: "ui.audit.completionOrSkip" })),
						})
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error updating occurrence next trigger:", {
				category: "persistence",
				operation: "updating-occurrence-next-trigger",
				details: { taskPath: task.path, trigger },
				error: errorMessage,
			});
			new Notice(this.t(msg({ message: "Failed to update task: {message}", context: "modals.taskEdit.notices.updateFailure" }), { message: displayError(errorMessage) }));
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
					label: toMenuTitle(configLabel(status), value),
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
				{ labelKey: msg({ message: "At time of event", context: "contextMenus.task.quickReminders.atTime" }), offset: "PT0M" },
				{ labelKey: msg({ message: "5 minutes before", context: "contextMenus.task.quickReminders.fiveMinutes" }), offset: "-PT5M" },
				{ labelKey: msg({ message: "15 minutes before", context: "contextMenus.task.quickReminders.fifteenMinutes" }), offset: "-PT15M" },
				{ labelKey: msg({ message: "1 hour before", context: "contextMenus.task.quickReminders.oneHour" }), offset: "-PT1H" },
				{ labelKey: msg({ message: "1 day before", context: "contextMenus.task.quickReminders.oneDay" }), offset: "-P1D" },
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
			tasknotesLogger.error("Error adding reminder:", {
				category: "persistence",
				operation: "adding-reminder",
				error: error,
			});
			new Notice(this.t(msg({ message: "Failed to add reminder", context: "contextMenus.task.notices.addReminderFailure" })));
		}
	}

	public show(event: MouseEvent): void {
		// Store the document reference from the event target to support pop-out windows
		// Use cross-window compatible instanceOf check
		if ((event.target as Node)?.instanceOf?.(HTMLElement)) {
			this.targetDoc = (event.target as HTMLElement).ownerDocument;
		}
		showCoordinatedMenu(this.menu, event);
	}

	public showAtElement(element: HTMLElement): void {
		// Store the document reference from the element to support pop-out windows
		this.targetDoc = element.ownerDocument;
		showCoordinatedMenuAtElement(this.menu, element);
	}
}
