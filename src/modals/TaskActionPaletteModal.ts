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

		this.setPlaceholder(this.plugin.i18n.translate("modals.actionPalette.placeholder"));
		this.setInstructions([
			{
				command: "↑↓",
				purpose: this.plugin.i18n.translate(
					"modals.unscheduledTasksSelector.instructions.navigate"
				),
			},
			{ command: "↵", purpose: this.plugin.i18n.translate("modals.actionPalette.execute") },
			{
				command: "esc",
				purpose: this.plugin.i18n.translate(
					"modals.unscheduledTasksSelector.instructions.dismiss"
				),
			},
		]);

		// Set modal title for accessibility
		this.titleEl.setText(
			this.plugin.i18n.translate("modals.actionPalette.title", { title: task.title })
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
				title: this.plugin.i18n.translate("modals.actionPalette.statusAction", {
					label: statusConfig.label,
				}),
				description: this.plugin.i18n.translate("modals.actionPalette.statusDesc", {
					label: statusConfig.label,
				}),
				icon: isCurrentStatus ? "check" : "circle",
				category: "status",
				keywords: ["status", statusConfig.value, statusConfig.label, "change", "set"],
				isApplicable: () => !isCurrentStatus,
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, "status", statusConfig.value);
					new Notice(
						this.plugin.i18n.translate("modals.actionPalette.statusChanged", {
							label: statusConfig.label,
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
				title: this.plugin.i18n.translate("modals.actionPalette.priorityAction", {
					label: priorityConfig.label,
				}),
				description: this.plugin.i18n.translate("modals.actionPalette.priorityDesc", {
					label: priorityConfig.label,
				}),
				icon: isCurrentPriority ? "check" : "flag",
				category: "priority",
				keywords: ["priority", priorityConfig.value, priorityConfig.label, "change", "set"],
				isApplicable: () => !isCurrentPriority,
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, "priority", priorityConfig.value);
					new Notice(
						this.plugin.i18n.translate("modals.actionPalette.priorityChanged", {
							label: priorityConfig.label,
						})
					);
				},
			});
		});

		// Date actions
		actions.push(
			{
				id: "set-due-date",
				title: this.plugin.i18n.translate("modals.task.actions.due"),
				description: this.plugin.i18n.translate("modals.dueDate.descriptions.dateTime"),
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
				title: this.plugin.i18n.translate("modals.task.actions.scheduled"),
				description: this.plugin.i18n.translate(
					"modals.scheduledDate.descriptions.dateTime"
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
				title: this.plugin.i18n.translate("modals.dueDate.quickOptions.clearAriaLabel"),
				description: this.plugin.i18n.translate("modals.actionPalette.clearDueDesc"),
				icon: "calendar-x",
				category: "dates",
				keywords: ["clear", "remove", "due", "date"],
				isApplicable: (task) => !!task.due,
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, "due", undefined);
					new Notice(this.plugin.i18n.translate("modals.actionPalette.dueCleared"));
				},
			},
			{
				id: "clear-scheduled-date",
				title: this.plugin.i18n.translate(
					"modals.scheduledDate.quickOptions.clearAriaLabel"
				),
				description: this.plugin.i18n.translate("modals.actionPalette.clearScheduledDesc"),
				icon: "calendar-x",
				category: "dates",
				keywords: ["clear", "remove", "scheduled", "date"],
				isApplicable: (task) => !!task.scheduled,
				execute: async (task) => {
					await this.plugin.updateTaskProperty(task, "scheduled", undefined);
					new Notice(this.plugin.i18n.translate("modals.actionPalette.scheduledCleared"));
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
				? this.plugin.i18n.translate("contextMenus.task.stopTimeTracking")
				: this.plugin.i18n.translate("contextMenus.task.startTimeTracking"),
			description: activeSession
				? this.plugin.i18n.translate("modals.actionPalette.stopTrackingDesc")
				: this.plugin.i18n.translate("modals.actionPalette.startTrackingDesc"),
			icon: activeSession ? "pause" : "play",
			category: "tracking",
			keywords: ["time", "tracking", "timer", activeSession ? "stop" : "start"],
			isApplicable: () => true,
			execute: async (task) => {
				const currentSession = this.plugin.getActiveTimeSession(task);
				if (currentSession) {
					await this.plugin.stopTimeTracking(task);
					new Notice(this.plugin.i18n.translate("modals.actionPalette.trackingStopped"));
				} else {
					await this.plugin.startTimeTracking(task);
					new Notice(this.plugin.i18n.translate("modals.actionPalette.trackingStarted"));
				}
			},
		});

		// Edit time entries action (only show if task has time entries)
		if (this.task.timeEntries && this.task.timeEntries.length > 0) {
			actions.push({
				id: "edit-time-entries",
				title: this.plugin.i18n.translate("contextMenus.task.editTimeEntries"),
				description: this.plugin.i18n.translate("modals.actionPalette.editTimeDesc"),
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
				title: this.plugin.i18n.translate("modals.task.projectsAdd"),
				description: this.plugin.i18n.translate("modals.actionPalette.addProjectDesc"),
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
				title: this.task.archived ? "Unarchive task" : "Archive task",
				description: this.task.archived
					? this.plugin.i18n.translate("modals.actionPalette.unarchiveDesc")
					: this.plugin.i18n.translate("modals.actionPalette.archiveDesc"),
				icon: this.task.archived ? "archive-restore" : "archive",
				category: "organization",
				keywords: ["archive", this.task.archived ? "unarchive" : "archive", "organize"],
				isApplicable: () => true,
				execute: async (task) => {
					await this.plugin.toggleTaskArchive(task);
					new Notice(
						task.archived
							? this.plugin.i18n.translate("notices.commands.unarchived")
							: this.plugin.i18n.translate("notices.commands.archived")
					);
				},
			}
		);

		// Recurring task actions (only for recurring tasks)
		if (this.task.recurrence) {
			actions.push({
				id: "complete-recurring-instance",
				title: this.plugin.i18n.translate("modals.actionPalette.completeOccurrence"),
				description: this.plugin.i18n.translate(
					"modals.actionPalette.completeOccurrenceDesc"
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
						this.plugin.i18n.translate("modals.actionPalette.occurrenceCompleted")
					);
				},
			});

			actions.push({
				id: "open-or-create-occurrence-note",
				title: this.plugin.i18n.translate("modals.actionPalette.openOccurrence"),
				description: this.plugin.i18n.translate("modals.actionPalette.openOccurrenceDesc"),
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
				title: this.plugin.i18n.translate("modals.actionPalette.openParent"),
				description: this.plugin.i18n.translate("modals.actionPalette.openParentDesc"),
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
				title: this.plugin.i18n.translate("modals.actionPalette.editTask"),
				description: this.plugin.i18n.translate("modals.actionPalette.editTaskDesc"),
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
				title: this.plugin.i18n.translate("modals.actionPalette.openFile"),
				description: this.plugin.i18n.translate("modals.actionPalette.openFileDesc"),
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
				title: this.plugin.i18n.translate("contextMenus.task.copyTitle"),
				description: this.plugin.i18n.translate("modals.actionPalette.copyTitleDesc"),
				icon: "copy",
				category: "other",
				keywords: ["copy", "clipboard", "title"],
				isApplicable: () => true,
				execute: async (task) => {
					try {
						await navigator.clipboard.writeText(task.title);
						new Notice(
							this.plugin.i18n.translate("contextMenus.task.notices.copyTitleSuccess")
						);
					} catch {
						new Notice(
							this.plugin.i18n.translate("contextMenus.task.notices.copyFailure")
						);
					}
				},
			},
			{
				id: "copy-task-link",
				title: this.plugin.i18n.translate("modals.actionPalette.copyLink"),
				description: this.plugin.i18n.translate("modals.actionPalette.copyLinkDesc"),
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
								this.plugin.i18n.translate("modals.actionPalette.linkCopied")
							);
						}
					} catch {
						new Notice(
							this.plugin.i18n.translate("contextMenus.task.notices.copyFailure")
						);
					}
				},
			},
			{
				id: "delete-task",
				title: this.plugin.i18n.translate("modals.taskEdit.deleteConfirmation.title"),
				description: this.plugin.i18n.translate("modals.actionPalette.deleteDesc"),
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
			const scheduledDate = getDatePart(task.scheduled || "");
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
				label: this.plugin.i18n.translate("modals.actionPalette.presets.today"),
				value: today.format("YYYY-MM-DD"),
				icon: "calendar-check",
				keywords: ["today"],
			},
			{
				id: "tomorrow",
				label: this.plugin.i18n.translate("modals.actionPalette.presets.tomorrow"),
				value: today.clone().add(1, "day").format("YYYY-MM-DD"),
				icon: "calendar-plus",
				keywords: ["tomorrow"],
			},
			{
				id: "this-weekend",
				label: this.plugin.i18n.translate("modals.actionPalette.presets.weekend"),
				value: nextSaturday.format("YYYY-MM-DD"),
				icon: "calendar-days",
				keywords: ["weekend", "saturday"],
			},
			{
				id: "next-week",
				label: this.plugin.i18n.translate("modals.actionPalette.presets.nextWeek"),
				value: today.clone().day(1).add(1, "week").format("YYYY-MM-DD"),
				icon: "calendar-plus",
				keywords: ["next", "week", "monday"],
			},
			{
				id: "next-month",
				label: this.plugin.i18n.translate("modals.actionPalette.presets.nextMonth"),
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
						? "modals.actionPalette.scheduleFor"
						: "modals.actionPalette.dueFor",
					{ date: dateLabel }
				),
				description: this.plugin.i18n.translate(
					property === "scheduled"
						? "modals.actionPalette.scheduleDesc"
						: "modals.actionPalette.dueDesc",
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
								? "modals.actionPalette.scheduledSet"
								: "modals.actionPalette.dueSet"
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
						"contextMenus.task.organization.notices.projectSelectFailed"
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
					"contextMenus.task.organization.notices.addToProjectFailed"
				)
			);
		}
	}

	private getCategoryLabel(category: TaskAction["category"]): string {
		const key =
			category === "status"
				? "contextMenus.task.status"
				: category === "priority"
					? "contextMenus.task.priority"
					: `modals.actionPalette.categories.${category}`;
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
				new Notice(this.plugin.i18n.translate("modals.actionPalette.taskNotFound"));
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
				this.plugin.i18n.translate("modals.actionPalette.actionFailed", {
					message: errorMessage,
				})
			);
		}
	}
}
