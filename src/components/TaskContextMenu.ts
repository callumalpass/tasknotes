import { renderPriorityMenuGlyph, renderTaskMenuKeyHint } from "../ui/kit/menu";
import { archiveTasksWithUndo, openTaskPropertyPicker, type TaskPickerProperty } from "../ui/taskPropertyPickers";
import { openTaskRecurrencePicker } from "../ui/taskRecurrencePicker";
import { openTaskReminderPicker } from "../ui/taskReminderPicker";
import { TaskCompletionMenu } from "./task-context-menu/completion";
import { TaskRelationshipMenu } from "./task-context-menu/relationships";
import { TaskPropertyMenu } from "./task-context-menu/properties";
import { TaskRecurrenceMenu } from "./task-context-menu/recurrence";
import type { TaskContextMenuOptions } from "./task-context-menu/types";
import { getSubmenu, menuItemAnchor } from "./task-context-menu/helpers";
import { displayError } from "../i18n/runtime";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, Notice, Platform, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import { buildSubtaskCreationPrePopulatedValues } from "../services/taskRelationshipActions";
import { addNoteFileActions } from "./noteFileMenu";
import { ContextMenu } from "./ContextMenu";
import { showCoordinatedMenu, showCoordinatedMenuAtElement } from "./ContextMenuCoordinator";
import { buildTimeblockPrefillForTask } from "../utils/timeblockPrefillUtils";
import { TimeblockCreationModal } from "../modals/TimeblockCreationModal";
import { downloadTaskICSFile, openCalendarURL } from "../ui/calendarExportActions";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { getModifierPaneType, openTaskNote } from "../utils/clickHandlers";

export type { TaskContextMenuOptions } from "./task-context-menu/types";
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

		this.menu.addItem((item) => {
			renderTaskMenuKeyHint(item, "edit");
			item.setTitle(this.t(msg({ message: "Edit task", context: "modals.taskEdit.title" })));
			item.setIcon("pencil");
			item.onClick(() => {
				void plugin.openTaskEditModal(task, () => {
					this.options.onUpdate?.();
				});
			});
		});

		this.menu.addItem((item) => {
			renderTaskMenuKeyHint(item, "open");
			item.setTitle(
				this.t(msg({ message: "Open note", context: "contextMenus.task.openNote" }))
			);
			item.setIcon("file-text");
			// Ctrl/Cmd+click on the item opens a new tab, as on an Obsidian link.
			item.onClick((event) =>
				openTaskNote(plugin.app, task.path, getModifierPaneType(event))
			);
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
			item.onClick(() => openTaskNote(plugin.app, task.path, "tab"));
		});

		this.menu.addSeparator();

		const pickerItem = (
			hint: Parameters<typeof renderTaskMenuKeyHint>[1],
			title: string,
			icon: string | null,
			open: (anchor: { x: number; y: number }) => void
		) =>
			this.menu.addItem((item) => {
				renderTaskMenuKeyHint(item, hint);
				item.setTitle(title);
				if (icon) item.setIcon(icon);
				else
					renderPriorityMenuGlyph(
						item,
						plugin.settings.customPriorities.find((priority) => priority.value === task.priority) ?? {
							value: task.priority,
						},
						plugin.settings.customPriorities
					);
				item.onClick((event) => open(menuItemAnchor(item, event)));
			});
		const propertyPicker = (property: TaskPickerProperty) => (anchor: { x: number; y: number }) =>
			void openTaskPropertyPicker(plugin, property, [task], anchor, this.options.onUpdate);

		pickerItem("status", this.statusTitle(task), "circle", propertyPicker("status"));
		pickerItem("priority", this.t(msg({ message: "Priority", context: "contextMenus.task.priority" })), null, propertyPicker("priority"));
		pickerItem("tags", this.t(msg({ message: "Tags", context: "contextMenus.task.tags" })), "tags", propertyPicker("tags"));
		pickerItem("due", this.t(msg({ message: "Due date", context: "contextMenus.task.dueDate" })), "calendar", propertyPicker("due"));
		pickerItem("scheduled", this.t(msg({ message: "Scheduled date", context: "contextMenus.task.scheduledDate" })), "calendar-clock", propertyPicker("scheduled"));

		this.properties.addCustomDateFieldMenuItems(task, plugin);

		this.completion.addCompleteOrSkipSection(task, plugin);

		if (task.recurrence && !this.options.promoteOccurrenceControls) {
			this.completion.addOccurrenceNoteMenuItem(task, plugin);
		}

		if (!hasPromotedOccurrenceControls && task.recurrence_parent && task.occurrence_date) {
			this.completion.addMaterializedOccurrenceMenuItems(task, plugin);
		}

		this.menu.addSeparator();

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Recurrence", context: "contextMenus.task.recurrence" }))
			);
			item.setIcon("refresh-ccw");
			item.onClick((event) =>
				void openTaskRecurrencePicker(plugin, task, menuItemAnchor(item, event), this.options.onUpdate)
			);
		});
		if (typeof task.recurrence === "string" && task.recurrence) {
			this.recurrence.addOccurrencePolicyOptions(this.menu, task, plugin);
		}

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Reminders", context: "contextMenus.task.reminders" }))
			);
			item.setIcon("bell");
			item.onClick((event) =>
				void openTaskReminderPicker(plugin, task, menuItemAnchor(item, event), this.options.onUpdate)
			);
		});

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
			submenu.addSeparator();
			submenu.addItem((item) => {
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
			submenu.addItem((item) => {
				item.setTitle(
					this.t(
						msg({
							message: "Create subtask",
							context: "contextMenus.task.createSubtask",
						})
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
		});

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Time tracking", context: "task menu time tracking group" }))
			).setIcon("timer");
			const trackingMenu = getSubmenu(item);
			trackingMenu.addItem((item) => {
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
			trackingMenu.addItem((item) => {
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
			if (plugin.settings.calendarViewSettings.enableTimeblocking) {
				trackingMenu.addItem((item) => {
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
		});

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

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Note actions", context: "contextMenus.task.noteActions" }))
			);
			item.setIcon("file-text");

			const submenu = getSubmenu(item);
			const file = plugin.app.vault.getAbstractFileByPath(task.path);
			if (file instanceof TFile) {
				addNoteFileActions(submenu, file, plugin, {
					task,
					includeOpenInNewTab: false,
					source: "tasknotes-context-menu",
					onUpdate: this.options.onUpdate,
				});
			}
		});

		this.menu.addItem((item) => {
			item.setTitle(
				task.archived
					? this.t(msg({ message: "Unarchive", context: "contextMenus.task.unarchive" }))
					: this.t(msg({ message: "Archive", context: "contextMenus.task.archive" }))
			);
			item.setIcon(task.archived ? "archive-restore" : "archive");
			item.onClick(async () => {
				try {
					await archiveTasksWithUndo(plugin, [task], !task.archived);
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

		const shortcutHelp = this.targetDoc.querySelector<HTMLElement>(".workspace-leaf.mod-active .tn-shortcut-help");
		if (shortcutHelp) this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Keyboard shortcuts", context: "interaction help" })));
			item.setIcon("keyboard");
			item.onClick(() => shortcutHelp.click());
		});
		this.addMobileDismissOption();

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

	/** On a recurring task, Status sets the series' own status (#2632). */
	private statusTitle(task: TaskInfo): string {
		return task.recurrence
			? this.t(msg({ message: "Series status", context: "contextMenus.task.seriesStatus" }))
			: this.t(msg({ message: "Status", context: "contextMenus.task.status" }));
	}

	private updateMainMenuIconColors(task: TaskInfo, plugin: TaskNotesPlugin): void {
		const menuEl = this.targetDoc.querySelector(".menu");
		if (!menuEl) return;

		const menuItems = menuEl.querySelectorAll(".menu-item");
		const statusTitle = this.statusTitle(task);
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
		showCoordinatedMenu(this.menu, event, this.options.onHide);
	}

	public showAtElement(element: HTMLElement): void {
		// Store the document reference from the element to support pop-out windows
		this.targetDoc = element.ownerDocument;
		showCoordinatedMenuAtElement(this.menu, element, this.options.onHide);
	}
}
