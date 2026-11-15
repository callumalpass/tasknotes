import { displayError } from "../../i18n/runtime";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, Notice } from "obsidian";
import type { OccurrenceMaterializationMode, OccurrenceNextTrigger } from "@tasknotes/model";
import TaskNotesPlugin from "../../main";
import { TaskInfo } from "../../types";
import { applyTaskRecurrence, recurrenceChoices } from "../../ui/taskRecurrencePicker";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";
import type { TaskContextMenuOptions } from "./types";
import { getSubmenu } from "./helpers";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/TaskContextMenu" });
export class TaskRecurrenceMenu {
	constructor(
		private options: TaskContextMenuOptions,
		private menu: Menu
	) {}
	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}
	/** The recurrence picker's choices, as a submenu. */
	addRecurrenceOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const choices = recurrenceChoices(
			plugin,
			plugin.app,
			{
				recurrence: typeof task.recurrence === "string" ? task.recurrence : undefined,
				anchor: task.recurrence_anchor,
				scheduled: task.scheduled,
			},
			(value, anchor) => {
				void applyTaskRecurrence(plugin, task, value, anchor).then(() =>
					this.options.onUpdate?.()
				);
			}
		);
		for (const choice of choices) {
			if (choice.id === "custom") submenu.addSeparator();
			submenu.addItem((item) => {
				item.setTitle(
					choice.id === "clear"
						? this.t(
								msg({
									message: "Clear recurrence",
									context: "contextMenus.task.clearRecurrence",
								})
							)
						: choice.selected
							? `✓ ${choice.label}`
							: choice.label
				);
				if (choice.icon) item.setIcon(choice.icon);
				if (choice.id !== "current") item.onClick(choice.choose);
			});
		}
	}

	addOccurrencePolicyOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const currentMode = task.occurrence_materialization || "manual";
		const currentTrigger = task.occurrence_next_trigger || "completion";

		submenu.addSeparator();
		submenu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Occurrence notes", context: "ui.audit.occurrenceNotes" }))
			);
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

			addModeOption(
				"manual",
				this.t(msg({ message: "Create manually", context: "ui.audit.manual" })),
				"file-plus"
			);
			addModeOption(
				"on_completion",
				this.t(
					msg({
						message: "Create next after completion",
						context: "ui.audit.afterCompletion",
					})
				),
				"check-circle"
			);

			policyMenu.addItem((modeItem) => {
				modeItem.setTitle(
					currentMode === "rolling"
						? `✓ ${this.t(msg({ message: "Rolling window (not automated yet)", context: "ui.audit.rolling" }))}`
						: this.t(
								msg({
									message: "Rolling window (not automated yet)",
									context: "ui.audit.rolling",
								})
							)
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
					label: this.t(
						msg({ message: "Completion only", context: "ui.audit.completionOnly" })
					),
					icon: "check",
				},
				{
					value: "completion_or_skip",
					label: this.t(
						msg({ message: "Completion or skip", context: "ui.audit.completionOrSkip" })
					),
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

	async updateOccurrenceMaterializationPolicy(
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
					? this.t(
							msg({
								message: "Occurrence notes: {mode}",
								context: "notices.audit.occurrencePolicy",
							}),
							{
								mode: this.t(
									msg({ message: "Create manually", context: "ui.audit.manual" })
								),
							}
						)
					: this.t(
							msg({
								message: "Occurrence notes: {mode}",
								context: "notices.audit.occurrencePolicy",
							}),
							{
								mode: this.t(
									msg({
										message: "Create next after completion",
										context: "ui.audit.afterCompletion",
									})
								),
							}
						)
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error updating occurrence materialization policy:", {
				category: "persistence",
				operation: "updating-occurrence-materialization-policy",
				details: { taskPath: task.path, mode },
				error: errorMessage,
			});
			new Notice(
				this.t(
					msg({
						message: "Failed to update task: {message}",
						context: "modals.taskEdit.notices.updateFailure",
					}),
					{ message: displayError(errorMessage) }
				)
			);
		}
	}

	async updateOccurrenceNextTrigger(
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
					? this.t(
							msg({
								message: "Occurrence notes: {mode}",
								context: "notices.audit.occurrencePolicy",
							}),
							{
								mode: this.t(
									msg({
										message: "Completion only",
										context: "ui.audit.completionOnly",
									})
								),
							}
						)
					: this.t(
							msg({
								message: "Occurrence notes: {mode}",
								context: "notices.audit.occurrencePolicy",
							}),
							{
								mode: this.t(
									msg({
										message: "Completion or skip",
										context: "ui.audit.completionOrSkip",
									})
								),
							}
						)
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			tasknotesLogger.error("Error updating occurrence next trigger:", {
				category: "persistence",
				operation: "updating-occurrence-next-trigger",
				details: { taskPath: task.path, trigger },
				error: errorMessage,
			});
			new Notice(
				this.t(
					msg({
						message: "Failed to update task: {message}",
						context: "modals.taskEdit.notices.updateFailure",
					}),
					{ message: displayError(errorMessage) }
				)
			);
		}
	}

	addQuickRemindersSection(
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
				{
					labelKey: msg({
						message: "At time of event",
						context: "contextMenus.task.quickReminders.atTime",
					}),
					offset: "PT0M",
				},
				{
					labelKey: msg({
						message: "5 minutes before",
						context: "contextMenus.task.quickReminders.fiveMinutes",
					}),
					offset: "-PT5M",
				},
				{
					labelKey: msg({
						message: "15 minutes before",
						context: "contextMenus.task.quickReminders.fifteenMinutes",
					}),
					offset: "-PT15M",
				},
				{
					labelKey: msg({
						message: "1 hour before",
						context: "contextMenus.task.quickReminders.oneHour",
					}),
					offset: "-PT1H",
				},
				{
					labelKey: msg({
						message: "1 day before",
						context: "contextMenus.task.quickReminders.oneDay",
					}),
					offset: "-P1D",
				},
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

	async addQuickReminder(
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
			new Notice(
				this.t(
					msg({
						message: "Failed to add reminder",
						context: "contextMenus.task.notices.addReminderFailure",
					})
				)
			);
		}
	}
}
