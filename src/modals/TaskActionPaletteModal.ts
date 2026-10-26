import { displayError } from "../i18n/runtime";
import { configLabel } from "../i18n/configLabels";
import { uiText } from "../i18n/runtime";
import { messageForKey } from "../i18n/messages";
import { msg } from "@lingui/core/macro";
import {
	App,
	FuzzySuggestModal,
	FuzzyMatch,
	setIcon,
	Notice,
	TAbstractFile,
	TFile,
	moment as obsidianMoment,
} from "obsidian";
import { TaskInfo } from "../types";
import TaskNotesPlugin from "../main";
import { getDatePart, parseDateToUTC } from "../utils/dateUtils";
import { getRecurringMoveOriginalDate } from "../services/task-service/recurringMoveIdentity";
import {
	openMaterializedOccurrenceParent,
	openOrCreateOccurrenceNote,
} from "../ui/occurrenceNoteActions";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { ProjectSelectModal } from "./ProjectSelectModal";
import { addTaskToProject } from "../services/taskRelationshipActions";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/TaskActionPaletteModal" });

export interface TaskAction {
	id: string;
	title: string;
	description: string;
	icon: string;
	category: "status" | "priority" | "dates" | "tracking" | "organization" | "other";
	keywords: string[];
	isApplicable: (task: TaskInfo, plugin: TaskNotesPlugin, targetDate: Date) => boolean;
	execute: (task: TaskInfo, plugin: TaskNotesPlugin, targetDate: Date) => Promise<void>;
}

type DateActionProperty = "due" | "scheduled";

interface QuickDatePreset {
	id: string;
	label: string;
	value: string;
	icon: string;
	keywords: string[];
}

type MomentLike = {
	format(format: string): string;
	clone(): MomentLike;
	add(amount: number, unit: string): MomentLike;
	day(day: number): MomentLike;
	isBefore(other: MomentLike): boolean;
	isSame(other: MomentLike, unit: string): boolean;
	startOf(unit: string): MomentLike;
};

function getMoment(): MomentLike {
	return (obsidianMoment as unknown as () => MomentLike)();
}

export class TaskActionPaletteModal extends FuzzySuggestModal<TaskAction> {
	private task: TaskInfo;
	private plugin: TaskNotesPlugin;
	private targetDate: Date;
	private actions: TaskAction[];

	constructor(app: App, task: TaskInfo, plugin: TaskNotesPlugin, targetDate: Date) {
		super(app);
		this.task = task;
		this.plugin = plugin;
		this.targetDate = targetDate;
		this.actions = this.buildActionsList();

		this.setPlaceholder(this.plugin.i18n.translate(msg({ message: "Type to search for an action...", context: "modals.actionPalette.placeholder" })));
		this.setInstructions([
			{
				command: "↑↓",
				purpose: this.plugin.i18n.translate(
					msg({ message: "to navigate", context: "modals.unscheduledTasksSelector.instructions.navigate" })
				),
			},
			{ command: "↵", purpose: this.plugin.i18n.translate(msg({ message: "To execute", context: "modals.actionPalette.execute" })) },
			{
				command: "esc",
				purpose: this.plugin.i18n.translate(
					msg({ message: "to dismiss", context: "modals.unscheduledTasksSelector.instructions.dismiss" })
				),
			},
		]);

		// Set modal title for accessibility
		this.titleEl.setText(
			this.plugin.i18n.translate(msg({ message: "Quick actions: {title}", context: "modals.actionPalette.title" }), { title: task.title })
		);
		this.titleEl.setAttribute("id", "task-action-palette-title");

		// Set aria attributes on the modal
		this.containerEl.setAttribute("aria-labelledby", "task-action-palette-title");
		this.containerEl.setAttribute("role", "dialog");
		this.containerEl.setAttribute("aria-modal", "true");
		this.containerEl.addClass("task-action-palette-modal");
	}

	private buildActionsList(): TaskAction[] {
		const actions: TaskAction[] = [];

		// Status actions
		const availableStatuses = this.task.recurrence
			? this.plugin.statusManager.getNonCompletionStatuses()
			: this.plugin.statusManager.getAllStatuses();

		availableStatuses.forEach((statusConfig) => {
			const isCurrentStatus = this.task.status === statusConfig.value;
			actions.push({
				id: `status-${statusConfig.value}`,
				title: this.plugin.i18n.translate(msg({ message: "Change status to \"{label}\"", context: "modals.actionPalette.statusAction" }), {
					label: configLabel(statusConfig),
				}),
				description: this.plugin.i18n.translate(msg({ message: "Set task status to {label}", context: "modals.actionPalette.statusDesc" }), {
					label: configLabel(statusConfig),
				}),
				icon: isCurrentStatus ? "check" : "circle",
				category: "status",
				keywords: ["status", statusConfig.value, configLabel(statusConfig), "change", "set"],
				isApplicable: () => !isCurrentStatus,
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, "status", statusConfig.value);
					new Notice(
						this.plugin.i18n.translate(msg({ message: "Status changed to {label}", context: "modals.actionPalette.statusChanged" }), {
							label: configLabel(statusConfig),
						})
					);
				},
			});
		});

		// Priority actions
		this.plugin.priorityManager.getAllPriorities().forEach((priorityConfig) => {
			const isCurrentPriority = this.task.priority === priorityConfig.value;
			actions.push({
				id: `priority-${priorityConfig.value}`,
				title: this.plugin.i18n.translate(msg({ message: "Set priority to \"{label}\"", context: "modals.actionPalette.priorityAction" }), {
					label: configLabel(priorityConfig),
				}),
				description: this.plugin.i18n.translate(msg({ message: "Change task priority to {label}", context: "modals.actionPalette.priorityDesc" }), {
					label: configLabel(priorityConfig),
				}),
				icon: isCurrentPriority ? "check" : "flag",
				category: "priority",
				keywords: ["priority", priorityConfig.value, configLabel(priorityConfig), "change", "set"],
				isApplicable: () => !isCurrentPriority,
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, "priority", priorityConfig.value);
					new Notice(
						this.plugin.i18n.translate(msg({ message: "Priority changed to {label}", context: "modals.actionPalette.priorityChanged" }), {
							label: configLabel(priorityConfig),
						})
					);
				},
			});
		});

		// Date actions
		actions.push(
			{
				id: "set-due-date",
				title: this.plugin.i18n.translate(msg({ message: "Set due date", context: "modals.task.actions.due" })),
				description: this.plugin.i18n.translate(msg({ message: "Set when this task should be completed", context: "modals.dueDate.descriptions.dateTime" })),
				icon: "calendar",
				category: "dates",
				keywords: ["due", "date", "deadline", "set", "change"],
				isApplicable: () => true,
				execute: async (task) => {
					void this.plugin.openDueDateModal(task);
				},
			},
			{
				id: "set-scheduled-date",
				title: this.plugin.i18n.translate(msg({ message: "Set scheduled date", context: "modals.task.actions.scheduled" })),
				description: this.plugin.i18n.translate(
					msg({ message: "Set when you plan to work on this task", context: "modals.scheduledDate.descriptions.dateTime" })
				),
				icon: "calendar-clock",
				category: "dates",
				keywords: ["scheduled", "date", "schedule", "set", "change"],
				isApplicable: () => true,
				execute: async (task) => {
					void this.plugin.openScheduledDateModal(task);
				},
			},
			{
				id: "clear-due-date",
				title: this.plugin.i18n.translate(msg({ message: "Clear due date", context: "modals.dueDate.quickOptions.clearAriaLabel" })),
				description: this.plugin.i18n.translate(msg({ message: "Remove the due date from this task", context: "modals.actionPalette.clearDueDesc" })),
				icon: "calendar-x",
				category: "dates",
				keywords: ["clear", "remove", "due", "date"],
				isApplicable: (task) => !!task.due,
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, "due", undefined);
					new Notice(this.plugin.i18n.translate(msg({ message: "Due date cleared", context: "modals.actionPalette.dueCleared" })));
				},
			},
			{
				id: "clear-scheduled-date",
				title: this.plugin.i18n.translate(
					msg({ message: "Clear scheduled date", context: "modals.scheduledDate.quickOptions.clearAriaLabel" })
				),
				description: this.plugin.i18n.translate(msg({ message: "Remove the scheduled date from this task", context: "modals.actionPalette.clearScheduledDesc" })),
				icon: "calendar-x",
				category: "dates",
				keywords: ["clear", "remove", "scheduled", "date"],
				isApplicable: (task) => !!task.scheduled,
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, "scheduled", undefined);
					new Notice(this.plugin.i18n.translate(msg({ message: "Scheduled date cleared", context: "modals.actionPalette.scheduledCleared" })));
				},
			}
		);
		this.addQuickDatePresetActions(actions, "scheduled");
		this.addQuickDatePresetActions(actions, "due");

		// Time tracking actions
		const activeSession = this.plugin.getActiveTimeSession(this.task);
		actions.push({
			id: "toggle-time-tracking",
			title: activeSession
				? this.plugin.i18n.translate(msg({ message: "Stop time tracking", context: "contextMenus.task.stopTimeTracking" }))
				: this.plugin.i18n.translate(msg({ message: "Start time tracking", context: "contextMenus.task.startTimeTracking" })),
			description: activeSession
				? this.plugin.i18n.translate(msg({ message: "Stop tracking time for this task", context: "modals.actionPalette.stopTrackingDesc" }))
				: this.plugin.i18n.translate(msg({ message: "Start tracking time for this task", context: "modals.actionPalette.startTrackingDesc" })),
			icon: activeSession ? "pause" : "play",
			category: "tracking",
			keywords: ["time", "tracking", "timer", activeSession ? "stop" : "start"],
			isApplicable: () => true,
			execute: async (task) => {
				const currentSession = this.plugin.getActiveTimeSession(task);
				if (currentSession) {
					await this.plugin.stopTimeTracking(task);
					new Notice(this.plugin.i18n.translate(msg({ message: "Time tracking stopped", context: "modals.actionPalette.trackingStopped" })));
				} else {
					await this.plugin.startTimeTracking(task);
					new Notice(this.plugin.i18n.translate(msg({ message: "Time tracking started", context: "modals.actionPalette.trackingStarted" })));
				}
			},
		});

		// Edit time entries action (only show if task has time entries)
		if (this.task.timeEntries && this.task.timeEntries.length > 0) {
			actions.push({
				id: "edit-time-entries",
				title: this.plugin.i18n.translate(msg({ message: "Edit time entries", context: "contextMenus.task.editTimeEntries" })),
				description: this.plugin.i18n.translate(msg({ message: "View, edit, or add time entries for this task", context: "modals.actionPalette.editTimeDesc" })),
				icon: "clock",
				category: "tracking",
				keywords: ["time", "entries", "edit", "tracking", "history"],
				isApplicable: () => true,
				execute: async (task) => {
					this.plugin.openTimeEntryEditor(task);
					this.close();
				},
			});
		}

		// Organization actions
		actions.push(
			{
				id: "add-project",
				title: this.plugin.i18n.translate(msg({ message: "Add project", context: "modals.task.projectsAdd" })),
				description: this.plugin.i18n.translate(msg({ message: "Select a project note and add it to this task", context: "modals.actionPalette.addProjectDesc" })),
				icon: "folder-plus",
				category: "organization",
				keywords: ["project", "organization", "add", "link"],
				isApplicable: () => true,
				execute: async (task) => {
					this.openProjectSelector(task);
				},
			},
			{
				id: "toggle-archive",
				title: this.task.archived ? uiText(msg({ message: "Unarchive task", context: "modals/TaskActionPaletteModal: TaskActionPaletteModal.buildActionsList title" })) : uiText(msg({ message: "Archive task", context: "modals/TaskActionPaletteModal: TaskActionPaletteModal.buildActionsList title" })),
				description: this.task.archived
					? this.plugin.i18n.translate(msg({ message: "Move task back to active tasks", context: "modals.actionPalette.unarchiveDesc" }))
					: this.plugin.i18n.translate(msg({ message: "Archive this task", context: "modals.actionPalette.archiveDesc" })),
				icon: this.task.archived ? "archive-restore" : "archive",
				category: "organization",
				keywords: ["archive", this.task.archived ? "unarchive" : "archive", "organize"],
				isApplicable: () => true,
				execute: async (task) => {
					await this.plugin.toggleTaskArchive(task);
					new Notice(
						task.archived
							? this.plugin.i18n.translate(msg({ message: "Task unarchived", context: "notices.commands.unarchived" }))
							: this.plugin.i18n.translate(msg({ message: "Task archived", context: "notices.commands.archived" }))
					);
				},
			}
		);

		// Recurring task actions (only for recurring tasks)
		if (this.task.recurrence) {
			actions.push({
				id: "complete-recurring-instance",
				title: this.plugin.i18n.translate(msg({ message: "Complete this occurrence", context: "modals.actionPalette.completeOccurrence" })),
				description: this.plugin.i18n.translate(
					msg({ message: "Mark this specific instance of the recurring task as complete", context: "modals.actionPalette.completeOccurrenceDesc" })
				),
				icon: "check-circle",
				category: "dates",
				keywords: ["complete", "done", "finish", "recurring", "instance", "occurrence"],
				isApplicable: (task, plugin, targetDate) => {
					return !plugin.statusManager.isCompletedStatus(task.status);
				},
				execute: async (task, plugin, targetDate) => {
					await plugin.toggleRecurringTaskComplete(task, targetDate);
					new Notice(
						this.plugin.i18n.translate(msg({ message: "Recurring task instance completed", context: "modals.actionPalette.occurrenceCompleted" }))
					);
				},
			});

			actions.push({
				id: "open-or-create-occurrence-note",
				title: this.plugin.i18n.translate(msg({ message: "Open or create occurrence note", context: "modals.actionPalette.openOccurrence" })),
				description: this.plugin.i18n.translate(msg({ message: "Open the note for this occurrence, creating it if needed", context: "modals.actionPalette.openOccurrenceDesc" })),
				icon: "file-plus",
				category: "dates",
				keywords: [
					"open",
					"create",
					"materialize",
					"note",
					"recurring",
					"instance",
					"occurrence",
				],
				isApplicable: () => true,
				execute: async (task, plugin, targetDate) => {
					await openOrCreateOccurrenceNote({
						plugin,
						parentTask: task,
						targetDate: this.getOccurrenceNoteTargetDate(task, targetDate),
						openInNewLeaf: true,
					});
				},
			});
		}

		if (this.task.recurrence_parent && this.task.occurrence_date) {
			actions.push({
				id: "open-recurring-parent",
				title: this.plugin.i18n.translate(msg({ message: "Open recurring parent", context: "modals.actionPalette.openParent" })),
				description: this.plugin.i18n.translate(msg({ message: "Open the recurring task that generated this occurrence", context: "modals.actionPalette.openParentDesc" })),
				icon: "refresh-ccw",
				category: "other",
				keywords: ["open", "parent", "recurring", "materialized", "occurrence"],
				isApplicable: () => true,
				execute: async (task, plugin) => {
					await openMaterializedOccurrenceParent({
						plugin,
						occurrenceTask: task,
						openInNewLeaf: true,
					});
				},
			});
		}

		// Other actions
		actions.push(
			{
				id: "edit-task",
				title: this.plugin.i18n.translate(msg({ message: "Edit task details", context: "modals.actionPalette.editTask" })),
				description: this.plugin.i18n.translate(msg({ message: "Open the full task editor", context: "modals.actionPalette.editTaskDesc" })),
				icon: "edit",
				category: "other",
				keywords: ["edit", "modify", "details", "properties"],
				isApplicable: () => true,
				execute: async (task) => {
					await this.plugin.openTaskEditModal(task);
				},
			},
			{
				id: "open-task-file",
				title: this.plugin.i18n.translate(msg({ message: "Open task file", context: "modals.actionPalette.openFile" })),
				description: this.plugin.i18n.translate(msg({ message: "Open the task file in the editor", context: "modals.actionPalette.openFileDesc" })),
				icon: "file-text",
				category: "other",
				keywords: ["open", "file", "editor", "edit"],
				isApplicable: () => true,
				execute: async (task) => {
					const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
					if (file instanceof TFile) {
						await this.plugin.app.workspace.getLeaf(true).openFile(file);
					}
				},
			},
			{
				id: "copy-task-title",
				title: this.plugin.i18n.translate(msg({ message: "Copy task title", context: "contextMenus.task.copyTitle" })),
				description: this.plugin.i18n.translate(msg({ message: "Copy the task title to clipboard", context: "modals.actionPalette.copyTitleDesc" })),
				icon: "copy",
				category: "other",
				keywords: ["copy", "clipboard", "title"],
				isApplicable: () => true,
				execute: async (task) => {
					try {
						await navigator.clipboard.writeText(task.title);
						new Notice(
							this.plugin.i18n.translate(msg({ message: "Task title copied to clipboard", context: "contextMenus.task.notices.copyTitleSuccess" }))
						);
					} catch {
						new Notice(
							this.plugin.i18n.translate(msg({ message: "Failed to copy to clipboard", context: "contextMenus.task.notices.copyFailure" }))
						);
					}
				},
			},
			{
				id: "copy-task-link",
				title: this.plugin.i18n.translate(msg({ message: "Copy task link", context: "modals.actionPalette.copyLink" })),
				description: this.plugin.i18n.translate(msg({ message: "Copy a wikilink to this task", context: "modals.actionPalette.copyLinkDesc" })),
				icon: "link",
				category: "other",
				keywords: ["copy", "link", "wikilink", "reference"],
				isApplicable: () => true,
				execute: async (task) => {
					try {
						const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
						if (file instanceof TFile) {
							const linkText = this.plugin.app.metadataCache.fileToLinktext(file, "");
							await navigator.clipboard.writeText(`[[${linkText}]]`);
							new Notice(
								this.plugin.i18n.translate(msg({ message: "Task link copied to clipboard", context: "modals.actionPalette.linkCopied" }))
							);
						}
					} catch {
						new Notice(
							this.plugin.i18n.translate(msg({ message: "Failed to copy to clipboard", context: "contextMenus.task.notices.copyFailure" }))
						);
					}
				},
			},
			{
				id: "delete-task",
				title: this.plugin.i18n.translate(msg({ message: "Delete task", context: "modals.taskEdit.deleteConfirmation.title" })),
				description: this.plugin.i18n.translate(msg({ message: "Permanently delete this task", context: "modals.actionPalette.deleteDesc" })),
				icon: "trash",
				category: "other",
				keywords: ["delete", "remove", "trash"],
				isApplicable: () => true,
				execute: async (task) => {
					// Close the action palette first
					this.close();

					// Show confirmation and delete if confirmed
					const { showDeleteConfirmationModal } = await import("../ui/TaskCard");
					await showDeleteConfirmationModal(task, this.plugin);
				},
			}
		);

		return actions;
	}

	private getOccurrenceNoteTargetDate(task: TaskInfo, targetDate: Date): Date {
		try {
			const scheduledDate =
				getRecurringMoveOriginalDate(task) || getDatePart(task.scheduled || "");
			return scheduledDate ? parseDateToUTC(scheduledDate) : targetDate;
		} catch {
			return targetDate;
		}
	}

	private getQuickDatePresets(): QuickDatePreset[] {
		const today = getMoment();
		const nextSaturday = today.clone().day(6);
		if (nextSaturday.isBefore(today) || nextSaturday.isSame(today, "day")) {
			nextSaturday.add(1, "week");
		}

		return [
			{
				id: "today",
				label: this.plugin.i18n.translate(msg({ message: "today", context: "modals.actionPalette.presets.today" })),
				value: today.format("YYYY-MM-DD"),
				icon: "calendar-check",
				keywords: ["today"],
			},
			{
				id: "tomorrow",
				label: this.plugin.i18n.translate(msg({ message: "tomorrow", context: "modals.actionPalette.presets.tomorrow" })),
				value: today.clone().add(1, "day").format("YYYY-MM-DD"),
				icon: "calendar-plus",
				keywords: ["tomorrow"],
			},
			{
				id: "this-weekend",
				label: this.plugin.i18n.translate(msg({ message: "This weekend", context: "modals.actionPalette.presets.weekend" })),
				value: nextSaturday.format("YYYY-MM-DD"),
				icon: "calendar-days",
				keywords: ["weekend", "saturday"],
			},
			{
				id: "next-week",
				label: this.plugin.i18n.translate(msg({ message: "Next week", context: "modals.actionPalette.presets.nextWeek" })),
				value: today.clone().day(1).add(1, "week").format("YYYY-MM-DD"),
				icon: "calendar-plus",
				keywords: ["next", "week", "monday"],
			},
			{
				id: "next-month",
				label: this.plugin.i18n.translate(msg({ message: "Next month", context: "modals.actionPalette.presets.nextMonth" })),
				value: today.clone().add(1, "month").startOf("month").format("YYYY-MM-DD"),
				icon: "calendar-range",
				keywords: ["next", "month"],
			},
		];
	}

	private addQuickDatePresetActions(actions: TaskAction[], property: DateActionProperty): void {
		this.getQuickDatePresets().forEach((preset) => {
			// These are catalogue-owned sentence fragments, never user-authored labels.
			const dateLabel =
				preset.label.charAt(0).toLocaleLowerCase(this.plugin.i18n.getCurrentLocale()) +
				preset.label.slice(1);
			actions.push({
				id: `set-${property}-${preset.id}`,
				title: this.plugin.i18n.translate(
					property === "scheduled"
						? msg({ message: "Schedule for {date}", context: "modals.actionPalette.scheduleFor" })
						: msg({ message: "Set due for {date}", context: "modals.actionPalette.dueFor" }),
					{ date: dateLabel }
				),
				description: this.plugin.i18n.translate(
					property === "scheduled"
						? msg({ message: "Set the scheduled date to {date}", context: "modals.actionPalette.scheduleDesc" })
						: msg({ message: "Set the due date to {date}", context: "modals.actionPalette.dueDesc" }),
					{ date: dateLabel }
				),
				icon: preset.icon,
				category: "dates",
				keywords: [property, "date", "set", "change", ...preset.keywords],
				isApplicable: (task) => {
					const currentDate = task[property] ? getDatePart(task[property]) : undefined;
					return currentDate !== preset.value;
				},
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, property, preset.value);
					new Notice(
						this.plugin.i18n.translate(
							property === "scheduled"
								? msg({ message: "Scheduled date set", context: "modals.actionPalette.scheduledSet" })
								: msg({ message: "Due date set", context: "modals.actionPalette.dueSet" })
						)
					);
				},
			});
		});
	}

	private openProjectSelector(task: TaskInfo): void {
		const selector = new ProjectSelectModal(this.plugin.app, this.plugin, (projectFile) => {
			void this.addSelectedProjectToTask(task, projectFile);
		});
		this.close();
		selector.open();
	}

	private async addSelectedProjectToTask(
		task: TaskInfo,
		projectFile: TAbstractFile
	): Promise<void> {
		try {
			if (!(projectFile instanceof TFile)) {
				new Notice(
					this.plugin.i18n.translate(
						msg({ message: "Failed to open project selector", context: "contextMenus.task.organization.notices.projectSelectFailed" })
					)
				);
				return;
			}

			await addTaskToProject(this.plugin, task, projectFile);
		} catch (error) {
			tasknotesLogger.error("Failed to add task to project:", {
				category: "persistence",
				operation: "add-task-project",
				details: { taskPath: task.path },
				error: error instanceof Error ? error.message : String(error),
			});
			new Notice(
				this.plugin.i18n.translate(
					msg({ message: "Failed to add task to project", context: "contextMenus.task.organization.notices.addToProjectFailed" })
				)
			);
		}
	}

	private getCategoryLabel(category: TaskAction["category"]): string {
		const key =
			category === "status"
				? msg({ message: "Status", context: "contextMenus.task.status" })
				: category === "priority"
					? msg({ message: "Priority", context: "contextMenus.task.priority" })
					: messageForKey(`modals.actionPalette.categories.${category}`);
		return this.plugin.i18n.translate(key);
	}

	getItems(): TaskAction[] {
		// Filter to only applicable actions and sort by category and title
		return this.actions
			.filter((action) => action.isApplicable(this.task, this.plugin, this.targetDate))
			.sort((a, b) => {
				// Sort by category first
				const categoryOrder = {
					status: 0,
					priority: 1,
					dates: 2,
					tracking: 3,
					organization: 4,
					other: 5,
				};

				const categoryA = categoryOrder[a.category] ?? 999;
				const categoryB = categoryOrder[b.category] ?? 999;

				if (categoryA !== categoryB) {
					return categoryA - categoryB;
				}

				// Then by title
				return a.title.localeCompare(b.title);
			});
	}

	getItemText(action: TaskAction): string {
		// Include title, description, and keywords in searchable text
		return [
			action.title,
			action.description,
			this.getCategoryLabel(action.category),
			...action.keywords,
		].join(" ");
	}

	renderSuggestion(item: FuzzyMatch<TaskAction>, el: HTMLElement) {
		const action = item.item;
		const container = el.createDiv({ cls: "task-action-palette__suggestion" });

		// Icon
		const iconEl = container.createDiv({ cls: "task-action-palette__icon" });
		setIcon(iconEl, action.icon);

		// Content
		const contentEl = container.createDiv({ cls: "task-action-palette__content" });

		// Title
		contentEl.createDiv({
			cls: "task-action-palette__title",
			text: action.title,
		});

		// Description
		contentEl.createDiv({
			cls: "task-action-palette__description",
			text: action.description,
		});

		// Category badge
		const badgeEl = container.createDiv({ cls: "task-action-palette__badge" });
		badgeEl.createSpan({
			cls: `task-action-palette__category task-action-palette__category--${action.category}`,
			text: this.getCategoryLabel(action.category),
		});
	}

	onChooseItem(action: TaskAction, evt: MouseEvent | KeyboardEvent): void {
		void this.executeAction(action, evt);
	}

	private async executeAction(
		action: TaskAction,
		evt: MouseEvent | KeyboardEvent
	): Promise<void> {
		try {
			// Refresh task data to ensure we have the latest information
			const freshTask = await this.plugin.cacheManager.getTaskInfo(this.task.path);
			if (!freshTask) {
				new Notice(this.plugin.i18n.translate(msg({ message: "Task not found", context: "modals.actionPalette.taskNotFound" })));
				return;
			}

			await action.execute(freshTask, this.plugin, this.targetDate);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error executing action:", {
				category: "persistence",
				operation: "executing-action",
				details: { actionId: action.id, taskPath: this.task.path },
				error: errorMessage,
			});
			new Notice(
				this.plugin.i18n.translate(msg({ message: "Failed to execute action: {message}", context: "modals.actionPalette.actionFailed" }), {
					message: displayError(errorMessage),
				})
			);
		}
	}
}
