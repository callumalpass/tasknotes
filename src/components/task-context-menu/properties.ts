import { configLabel } from "../../i18n/configLabels";
import { changeTaskProperty } from "../../ui/taskPropertyPickers";
import { displayError } from "../../i18n/runtime";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, Notice } from "obsidian";
import TaskNotesPlugin from "../../main";
import { TaskInfo } from "../../types";
import { DateContextMenu } from "../DateContextMenu";
import { DateTimePickerModal } from "../../modals/DateTimePickerModal";
import { createTaskNotesLogger } from "../../utils/tasknotesLogger";
import type { UserMappedField } from "../../types/settings";
import { renderUnconfiguredMenuValue, renderPriorityMenuGlyph } from "../../ui/kit/menu";
import type { TaskContextMenuOptions } from "./types";
import { getSubmenu, getMenuItemElement, toMenuTitle, type TaskStatusOption } from "./helpers";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/TaskContextMenu" });
export class TaskPropertyMenu {
	constructor(
		private options: TaskContextMenuOptions,
		private menu: Menu
	) {}
	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.options.plugin.i18n.translate(key, params);
	}
	addStatusOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const statusOptions = this.getStatusOptions(task, plugin);
		renderUnconfiguredMenuValue(submenu, task.status, statusOptions);

		statusOptions.forEach((option) => {
			submenu.addItem((item) => {
				const label = toMenuTitle(option.label, option.value);

				// Use custom icon if configured, otherwise default to circle
				item.setIcon(option.icon || "circle");

				item.setTitle(label).setChecked(option.value === task.status);

				item.onClick(async () => {
					try {
						await changeTaskProperty(plugin, [task], "status", option.value);
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
							this.t(
								msg({
									message: "Failed to update task status: {message}",
									context: "notices.interface.statusFailed",
								}),
								{
									message: displayError(errorMessage),
								}
							)
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

	addPriorityOptions(submenu: Menu, task: TaskInfo, plugin: TaskNotesPlugin): void {
		const priorityOptions = plugin.priorityManager.getPrioritiesByWeight();
		renderUnconfiguredMenuValue(submenu, task.priority, priorityOptions);

		priorityOptions.forEach((priority) => {
			const value = toMenuTitle(priority.value);
			if (!value) return;
			const label = toMenuTitle(configLabel(priority), value);

			submenu.addItem((item) => {
				// Use consistent icon for all items
				renderPriorityMenuGlyph(item, priority.value, priorityOptions);

				item.setTitle(label).setChecked(value === task.priority);

				item.onClick(async () => {
					try {
						await changeTaskProperty(plugin, [task], "priority", value);
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
							this.t(
								msg({
									message: "Failed to update task: {message}",
									context: "modals.taskEdit.notices.updateFailure",
								}),
								{
									message: displayError(errorMessage),
								}
							)
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

	addDateOptions(
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
					? this.t(msg({ message: "✓ {label}", context: "contextMenus.date.selected" }), {
							label: option.label,
						})
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
				item.setTitle(
					this.t(msg({ message: "Weekdays", context: "contextMenus.date.weekdaysLabel" }))
				);
				item.setIcon("calendar");
				const weekdaySubmenu = getSubmenu(item);
				weekdayOptions.forEach((option) => {
					weekdaySubmenu.addItem((subItem) => {
						const isSelected = option.value === currentValue;
						const title = isSelected
							? this.t(
									msg({
										message: "✓ {label}",
										context: "contextMenus.date.selected",
									}),
									{ label: option.label }
								)
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
			item.setTitle(
				options.pickDateTitle ??
					this.t(
						msg({
							message: "Pick date & time…",
							context: "contextMenus.date.pickDateTime",
						})
					)
			);
			item.setIcon("calendar");
			item.onClick(onCustomDate);
		});

		if (currentValue) {
			submenu.addItem((item) => {
				item.setTitle(
					this.t(msg({ message: "Clear date", context: "contextMenus.date.clearDate" }))
				);
				item.setIcon("x");
				item.onClick(() => {
					void onSelect(null);
				});
			});
		}
	}

	addCustomDateFieldMenuItems(task: TaskInfo, plugin: TaskNotesPlugin): void {
		const dateFields = this.getCustomDateFields(plugin);
		if (dateFields.length === 0) {
			return;
		}

		this.menu.addItem((item) => {
			item.setTitle(
				this.t(msg({ message: "Custom dates", context: "contextMenus.task.customDates" }))
			);
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
							pickDateTitle: this.t(
								msg({
									message: "Pick {field} date",
									context: "modals.task.userFields.pickDate",
								}),
								{
									field: fieldLabel,
								}
							),
						}
					);
				});
			});
		});
	}

	getCustomDateFields(plugin: TaskNotesPlugin): UserMappedField[] {
		return (plugin.settings.userFields || []).filter(
			(field) => field.type === "date" && field.key.trim().length > 0
		);
	}

	getCustomFieldLabel(field: UserMappedField): string {
		return field.displayName.trim() || field.key || field.id;
	}

	getCustomDateFieldValue(task: TaskInfo, field: UserMappedField): string | undefined {
		const taskRecord = task as unknown as Record<string, unknown>;
		const value = taskRecord[field.key] ?? task.customProperties?.[field.key];
		return typeof value === "string" && value.trim().length > 0 ? value : undefined;
	}

	openCustomDateFieldPicker(
		task: TaskInfo,
		plugin: TaskNotesPlugin,
		field: UserMappedField,
		currentValue: string | undefined
	): void {
		this.menu.hide();
		const fieldLabel = this.getCustomFieldLabel(field);
		const modal = new DateTimePickerModal(plugin.app, {
			currentDate: currentValue || null,
			title: this.t(
				msg({ message: "Pick {field} date", context: "modals.task.userFields.pickDate" }),
				{ field: fieldLabel }
			),
			showTime: false,
			plugin,
			onSelect: (date) => {
				void this.updateCustomDateField(task, plugin, field, date);
			},
		});
		modal.open();
	}

	async updateCustomDateField(
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
				this.t(
					msg({
						message: "Failed to update {field}: {message}",
						context: "contextMenus.task.notices.updateCustomDateFailure",
					}),
					{
						field: fieldLabel,
						message: displayError(errorMessage),
					}
				)
			);
		}
	}
	getStatusOptions(task: TaskInfo, plugin: TaskNotesPlugin) {
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
}
