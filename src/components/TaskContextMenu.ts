import { TaskCompletionMenu } from "./task-context-menu/completion";
import { TaskRelationshipMenu } from "./task-context-menu/relationships";
import { TaskPropertyMenu } from "./task-context-menu/properties";
import { TaskRecurrenceMenu } from "./task-context-menu/recurrence";
import type { TaskContextMenuOptions } from "./task-context-menu/types";
import { getSubmenu, type FileExplorerView } from "./task-context-menu/helpers";
import { displayError } from "../i18n/runtime";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, Notice, Platform, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { ReminderModal } from "../modals/ReminderModal";
import { buildSubtaskCreationPrePopulatedValues } from "../services/taskRelationshipActions";
import { renameVaultFile } from "../services/VaultMutationService";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { showTextInputModal } from "../modals/TextInputModal";
import { ContextMenu } from "./ContextMenu";
import { showCoordinatedMenu, showCoordinatedMenuAtElement } from "./ContextMenuCoordinator";
import { buildTimeblockPrefillForTask } from "../utils/timeblockPrefillUtils";
import { TimeblockCreationModal } from "../modals/TimeblockCreationModal";
import { downloadTaskICSFile, openCalendarURL } from "../ui/calendarExportActions";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

export type { TaskContextMenuOptions } from "./task-context-menu/types";
export {
	addContextToList,
	removeContextFromList,
	toggleContextInList,
} from "./task-context-menu/helpers";
const tasknotesLogger = createTaskNotesLogger({ tag: "Components/TaskContextMenu" });
export class TaskContextMenu {
	private menu: Menu;
	private options: TaskContextMenuOptions;
	private targetDoc: Document = activeDocument;
	private completion: TaskCompletionMenu;
	private relationships: TaskRelationshipMenu;
	private properties: TaskPropertyMenu;
	private recurrence: TaskRecurrenceMenu;

	constructor(options: TaskContextMenuOptions, menu: Menu = new ContextMenu()) {
		this.menu = menu;
		this.options = options;
		this.completion = new TaskCompletionMenu(options, menu);
		this.relationships = new TaskRelationshipMenu(options, menu);
		this.properties = new TaskPropertyMenu(options, menu);
		this.recurrence = new TaskRecurrenceMenu(options, menu);
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
		const hasPromotedOccurrenceControls = this.completion.addPromotedOccurrenceControls(
			task,
			plugin
		);

		// Status submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Status", context: "contextMenus.task.status" })));
			item.setIcon("circle");

			const submenu = getSubmenu(item);
			this.properties.addStatusOptions(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Priority submenu
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Priority", context: "contextMenus.task.priority" }))
			);
			item.setIcon("star");

			const submenu = getSubmenu(item);
			this.properties.addPriorityOptions(submenu, task, plugin);
		});

		// Tags submenu
		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Tags", context: "contextMenus.task.tags" })));
			item.setIcon("tags");

			const submenu = getSubmenu(item);
			this.relationships.addTagOptions(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Due Date submenu
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Due date", context: "contextMenus.task.dueDate" }))
			);
			item.setIcon("calendar");

			const submenu = getSubmenu(item);
			this.properties.addDateOptions(
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
							this.t(
								msg({
									message: "Failed to update task due date: {message}",
									context: "contextMenus.task.notices.updateDueDateFailure",
								}),
								{
									message: displayError(errorMessage),
								}
							)
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
			item.setTitle(
				this.t(
					msg({ message: "Scheduled date", context: "contextMenus.task.scheduledDate" })
				)
			);
			item.setIcon("calendar-clock");

			const submenu = getSubmenu(item);
			this.properties.addDateOptions(
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
							this.t(
								msg({
									message: "Failed to update task scheduled date: {message}",
									context: "contextMenus.task.notices.updateScheduledFailure",
								}),
								{
									message: displayError(errorMessage),
								}
							)
						);
					}
				},
				() => {
					void plugin.openScheduledDateModal(task);
				}
			);
		});

		this.properties.addCustomDateFieldMenuItems(task, plugin);

		this.completion.addCompleteOrSkipSection(task, plugin);

		// Occurrence note stays at the top level (it is not a complete/skip action).
		if (task.recurrence && !this.options.promoteOccurrenceControls) {
			this.completion.addOccurrenceNoteMenuItem(task, plugin);
		}

		if (!hasPromotedOccurrenceControls && task.recurrence_parent && task.occurrence_date) {
			this.completion.addMaterializedOccurrenceMenuItems(task, plugin);
		}

		// Reminders submenu
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Reminders", context: "contextMenus.task.reminders" }))
			);
			item.setIcon("bell");

			const submenu = getSubmenu(item);

			// Quick Add sections
			this.recurrence.addQuickRemindersSection(
				submenu,
				task,
				plugin,
				"due",
				this.t(
					msg({
						message: "Remind before due…",
						context: "contextMenus.task.remindBeforeDue",
					})
				)
			);
			this.recurrence.addQuickRemindersSection(
				submenu,
				task,
				plugin,
				"scheduled",
				this.t(
					msg({
						message: "Remind before scheduled…",
						context: "contextMenus.task.remindBeforeScheduled",
					})
				)
			);

			submenu.addSeparator();

			// Manage reminders
			submenu.addItem((subItem) => {
				subItem.setTitle(
					this.t(
						msg({
							message: "Manage all reminders…",
							context: "contextMenus.task.manageReminders",
						})
					)
				);
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
									this.t(
										msg({
											message: "Failed to update reminders",
											context:
												"contextMenus.task.notices.updateRemindersFailure",
										})
									)
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
					subItem.setTitle(
						this.t(
							msg({
								message: "Clear all reminders",
								context: "contextMenus.task.clearReminders",
							})
						)
					);
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
							new Notice(
								this.t(
									msg({
										message: "Failed to clear reminders",
										context: "contextMenus.task.notices.clearRemindersFailure",
									})
								)
							);
						}
					});
				});
			}
		});

		this.menu.addSeparator();

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					msg({
						message: "Dependencies",
						context: "contextMenus.task.dependencies.title",
					})
				)
			);
			item.setIcon("git-branch");

			const submenu = getSubmenu(item);
			this.relationships.addDependencyMenuItems(submenu, task, plugin);
		});

		// this.menu.addSeparator();

		// Organization submenu (projects and subtasks)
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					msg({
						message: "Organization",
						context: "contextMenus.task.organization.title",
					})
				)
			);
			item.setIcon("folder-tree");

			const submenu = getSubmenu(item);
			this.relationships.addOrganizationMenuItems(submenu, task, plugin);
		});

		this.menu.addSeparator();

		// Time Tracking
		this.menu.addItem((item) => {
			const activeSession = plugin.getActiveTimeSession(task);
			item.setTitle(
				activeSession
					? this.t(
							msg({
								message: "Stop time tracking",
								context: "contextMenus.task.stopTimeTracking",
							})
						)
					: this.t(
							msg({
								message: "Start time tracking",
								context: "contextMenus.task.startTimeTracking",
							})
						)
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
			item.setTitle(
				this.t(
					msg({
						message: "Edit time entries",
						context: "contextMenus.task.editTimeEntries",
					})
				)
			);
			item.setIcon("clock");
			item.onClick(() => {
				plugin.openTimeEntryEditor(task);
			});
		});

		// Create timeblock from task
		if (plugin.settings.calendarViewSettings.enableTimeblocking) {
			this.menu.addItem((item) => {
				item.setTitle(
					this.t(
						msg({
							message: "Create timeblock",
							context: "modals.timeblockCreation.heading",
						})
					)
				);
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
						this.t(
							msg({
								message: "Failed to toggle task archive: {message}",
								context: "contextMenus.task.notices.archiveFailure",
							}),
							{
								message: displayError(errorMessage),
							}
						)
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
			item.setTitle(
				this.t(msg({ message: "Open note", context: "contextMenus.task.openNote" }))
			);
			item.setIcon("file-text");
			item.onClick(() => {
				const file = plugin.app.vault.getAbstractFileByPath(task.path);
				if (file instanceof TFile) {
					void plugin.app.workspace.getLeaf(false).openFile(file);
				}
			});
		});

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					msg({
						message: "Open note in new tab",
						context: "contextMenus.task.openNoteInNewTab",
					})
				)
			);
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
			item.setTitle(
				this.t(msg({ message: "Copy task title", context: "contextMenus.task.copyTitle" }))
			);
			item.setIcon("copy");
			item.onClick(async () => {
				try {
					await navigator.clipboard.writeText(task.title);
					new Notice(
						this.t(
							msg({
								message: "Task title copied to clipboard",
								context: "contextMenus.task.notices.copyTitleSuccess",
							})
						)
					);
				} catch {
					new Notice(
						this.t(
							msg({
								message: "Failed to copy to clipboard",
								context: "contextMenus.task.notices.copyFailure",
							})
						)
					);
				}
			});
		});

		// Note actions submenu
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Note actions", context: "contextMenus.task.noteActions" }))
			);
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
					subItem.setTitle(
						this.t(msg({ message: "Rename", context: "contextMenus.task.rename" }))
					);
					subItem.setIcon("pencil");
					subItem.onClick(async () => {
						try {
							// Modal-based rename
							const currentName = file.basename;
							const newName = await showTextInputModal(plugin.app, {
								title: this.t(
									msg({
										message: "Rename file",
										context: "contextMenus.task.renameTitle",
									})
								),
								placeholder: this.t(
									msg({
										message: "Enter new name",
										context: "contextMenus.task.renamePlaceholder",
									})
								),
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
									this.t(
										msg({
											message: 'Renamed to "{name}"',
											context: "contextMenus.task.notices.renameSuccess",
										}),
										{
											name: finalName,
										}
									)
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
							new Notice(
								this.t(
									msg({
										message: "Failed to rename file",
										context: "contextMenus.task.notices.renameFailure",
									})
								)
							);
						}
					});
				});

				submenu.addItem((subItem) => {
					subItem.setTitle(
						this.t(msg({ message: "Delete", context: "contextMenus.task.delete" }))
					);
					subItem.setIcon("trash");
					subItem.onClick(async () => {
						// Show confirmation and delete
						const confirmed = await showConfirmationModal(plugin.app, {
							title: this.t(
								msg({
									message: "Delete file",
									context: "contextMenus.task.deleteTitle",
								})
							),
							message: this.t(
								msg({
									message: 'Are you sure you want to delete "{name}"?',
									context: "contextMenus.task.deleteMessage",
								}),
								{ name: file.name }
							),
							confirmText: this.t(
								msg({
									message: "Delete",
									context: "contextMenus.task.deleteConfirm",
								})
							),
							cancelText: this.t(
								msg({ message: "Cancel", context: "common.cancel" })
							),
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
									this.t(
										msg({
											message: "Failed to delete task: {message}",
											context: "modals.taskEdit.notices.deleteFailure",
										}),
										{ message: displayError(message) }
									)
								);
							}
						}
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem) => {
					subItem.setTitle(
						this.t(msg({ message: "Copy path", context: "contextMenus.task.copyPath" }))
					);
					subItem.setIcon("copy");
					subItem.onClick(() => {
						void navigator.clipboard
							.writeText(file.path)
							.then(() => {
								new Notice(
									this.t(
										msg({
											message: "File path copied to clipboard",
											context: "contextMenus.task.notices.copyPathSuccess",
										})
									)
								);
							})
							.catch(() => {
								new Notice(
									this.t(
										msg({
											message: "Failed to copy to clipboard",
											context: "contextMenus.task.notices.copyFailure",
										})
									)
								);
							});
					});
				});

				submenu.addItem((subItem) => {
					subItem.setTitle(
						this.t(
							msg({
								message: "Copy Obsidian URL",
								context: "contextMenus.task.copyUrl",
							})
						)
					);
					subItem.setIcon("link");
					subItem.onClick(() => {
						const url = `obsidian://open?vault=${encodeURIComponent(plugin.app.vault.getName())}&file=${encodeURIComponent(file.path)}`;
						void navigator.clipboard
							.writeText(url)
							.then(() => {
								new Notice(
									this.t(
										msg({
											message: "Obsidian URL copied to clipboard",
											context: "contextMenus.task.notices.copyUrlSuccess",
										})
									)
								);
							})
							.catch(() => {
								new Notice(
									this.t(
										msg({
											message: "Failed to copy to clipboard",
											context: "contextMenus.task.notices.copyFailure",
										})
									)
								);
							});
					});
				});

				submenu.addSeparator();

				submenu.addItem((subItem) => {
					subItem.setTitle(
						this.t(
							msg({
								message: "Show in file explorer",
								context: "contextMenus.task.showInExplorer",
							})
						)
					);
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
			item.setTitle(
				this.t(
					msg({ message: "Add to calendar", context: "contextMenus.task.addToCalendar" })
				)
			);
			item.setIcon("calendar-plus");

			const submenu = getSubmenu(item);

			// Google Calendar
			submenu.addItem((subItem) => {
				subItem.setTitle(
					this.t(
						msg({
							message: "Google Calendar",
							context: "contextMenus.task.calendar.google",
						})
					)
				);
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
				subItem.setTitle(
					this.t(
						msg({
							message: "Outlook Calendar",
							context: "contextMenus.task.calendar.outlook",
						})
					)
				);
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
				subItem.setTitle(
					this.t(
						msg({
							message: "Yahoo Calendar",
							context: "contextMenus.task.calendar.yahoo",
						})
					)
				);
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
				subItem.setTitle(
					this.t(
						msg({
							message: "Download .ics file",
							context: "contextMenus.task.calendar.downloadIcs",
						})
					)
				);
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
				subItem.setTitle(
					this.t(
						msg({
							message: "Sync to Google Calendar",
							context: "contextMenus.task.calendar.syncToGoogle",
						})
					)
				);
				subItem.setIcon("refresh-cw");
				subItem.onClick(async () => {
					if (!plugin.taskCalendarSyncService?.isEnabled()) {
						new Notice(
							this.t(
								msg({
									message: "Google Calendar sync not configured",
									context: "contextMenus.task.calendar.syncToGoogleNotConfigured",
								})
							)
						);
						return;
					}
					try {
						await plugin.taskCalendarSyncService.syncTaskToCalendar(task);
						new Notice(
							this.t(
								msg({
									message: "Task synced to Google Calendar",
									context: "contextMenus.task.calendar.syncToGoogleSuccess",
								})
							)
						);
						this.options.onUpdate?.();
					} catch (error) {
						tasknotesLogger.error("Failed to sync task to Google Calendar:", {
							category: "provider",
							operation: "sync-task-google-calendar",
							error: error,
						});
						new Notice(
							this.t(
								msg({
									message: "Failed to sync task to Google Calendar",
									context: "contextMenus.task.calendar.syncToGoogleFailed",
								})
							)
						);
					}
				});
			});
		});

		this.menu.addSeparator();

		// Recurrence submenu
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Recurrence", context: "contextMenus.task.recurrence" }))
			);
			item.setIcon("refresh-ccw");

			const submenu = getSubmenu(item);
			const currentRecurrence =
				typeof task.recurrence === "string" ? task.recurrence : undefined;
			this.recurrence.addRecurrenceOptions(
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
							this.t(
								msg({
									message: "Failed to update task recurrence: {message}",
									context: "contextMenus.task.notices.updateRecurrenceFailure",
								}),
								{
									message: displayError(errorMessage),
								}
							)
						);
					}
				},
				plugin
			);

			if (currentRecurrence) {
				this.recurrence.addOccurrencePolicyOptions(submenu, task, plugin);
			}
		});

		this.menu.addSeparator();

		// Create subtask
		this.menu.addItem((item) => {
			item.setTitle(
				this.t(
					msg({ message: "Create subtask", context: "contextMenus.task.createSubtask" })
				)
			);
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

	private updateMainMenuIconColors(task: TaskInfo, plugin: TaskNotesPlugin): void {
		const menuEl = this.targetDoc.querySelector(".menu");
		if (!menuEl) return;

		const menuItems = menuEl.querySelectorAll(".menu-item");
		const statusTitle = this.t(msg({ message: "Status", context: "contextMenus.task.status" }));
		const priorityTitle = this.t(
			msg({ message: "Priority", context: "contextMenus.task.priority" })
		);

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
