import { displayError } from "../../i18n/runtime";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, Notice } from "obsidian";
import type { OccurrenceMaterializationMode, OccurrenceNextTrigger } from "@tasknotes/model";
import TaskNotesPlugin from "../../main";
import { TaskInfo } from "../../types";
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
	addOccurrencePolicyOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const currentMode = task.occurrence_materialization || "manual";
		const currentTrigger = task.occurrence_next_trigger || "completion";

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

}
