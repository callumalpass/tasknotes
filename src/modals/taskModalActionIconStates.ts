import { setTooltip } from "obsidian";
import type { PriorityConfig, StatusConfig } from "../types";
import { formatDateTimeForDisplay } from "../utils/dateUtils";
import { getTaskModalChip, setTaskModalChipLabel } from "./taskModalChipRow";
import { parseTaskModalCommaList } from "./taskModalOrgCounts";

const STATIC_COLOR_CLASSES = [
	"tn-static-color-var-color-accent-d2cad743",
	"tn-static-color-var-text-accent-65b47ee3",
	"tn-static-color-var-text-muted-5872de20",
	"tn-static-color-var-text-on-accent-f3e1679d",
	"tn-static-color-var-text-warning-783d5f03",
	"tn-static-color-var-tn-text-muted-a90fb6f3",
	"tn-static-color-white-0a43e56a",
	"tn-static-cursor-pointer-2723efcc",
	"tn-static-font-size-12px-65574819",
	"tn-static-font-weight-bold-0fe8c30d",
	"tn-static-font-weight-bold-e0b452bd",
	"tn-static-margin-2px-0-edce9b14",
	"tn-static-padding-20px-7a035d95",
	"tn-static-padding-20px-ebe8e48c",
];

export interface TaskModalActionIconStateContext {
	translate: (key: string, params?: Record<string, string | number>) => string;
}

export interface TaskModalActionIconState {
	dueDate: string;
	scheduledDate: string;
	status: string;
	priority: string;
	recurrenceRule: string;
	recurrenceDisplayText: string;
	reminderCount: number;
	contexts: string;
	tags: string;
	timeEstimate: number;
	defaultStatus: string;
	defaultPriority: string;
	statusConfigs: readonly StatusConfig[];
	priorityConfigs: readonly PriorityConfig[];
}

export function updateTaskModalActionIconStates(
	actionBar: HTMLElement | undefined,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	if (!actionBar) return;

	updateDateChip(actionBar, context, "due-date", state.dueDate, {
		activeTooltipKey: "modals.task.tooltips.dueValue",
		defaultLabelKey: "modals.task.actions.due",
	});
	updateDateChip(actionBar, context, "scheduled-date", state.scheduledDate, {
		activeTooltipKey: "modals.task.tooltips.scheduledValue",
		defaultLabelKey: "modals.task.actions.scheduled",
	});
	updateStatusChip(actionBar, context, state);
	updatePriorityChip(actionBar, context, state);
	updateRecurrenceChip(actionBar, context, state);
	updateReminderChip(actionBar, context, state.reminderCount);
	updateContextsChip(actionBar, context, state.contexts);
	updateTagsChip(actionBar, context, state.tags);
	updateTimeEstimateChip(actionBar, context, state.timeEstimate);
}

function updateDateChip(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	dataType: string,
	value: string,
	options: {
		activeTooltipKey: string;
		defaultLabelKey: string;
	}
): void {
	const chip = getActionChip(actionBar, dataType);
	if (!chip) return;

	if (value) {
		const displayValue = formatDateTimeForDisplay(value, {
			showTime: value.includes("T") || value.includes(":"),
		});
		chip.classList.add("has-value");
		setTaskModalChipLabel(chip, displayValue);
		setTooltip(chip, context.translate(options.activeTooltipKey, { value: displayValue }), {
			placement: "top",
		});
		return;
	}

	chip.classList.remove("has-value");
	const defaultLabel = context.translate(options.defaultLabelKey);
	setTaskModalChipLabel(chip, defaultLabel);
	setTooltip(chip, defaultLabel, { placement: "top" });
}

function updateStatusChip(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	const chip = getActionChip(actionBar, "status");
	if (!chip) return;

	const statusConfig = state.statusConfigs.find((config) => config.value === state.status);
	const statusLabel = statusConfig ? statusConfig.label : state.status;
	updateConfiguredValueChip(chip, context, {
		isActive: Boolean(
			state.status && statusConfig && statusConfig.value !== state.defaultStatus
		),
		activeTooltipKey: "modals.task.tooltips.statusValue",
		defaultLabelKey: "modals.task.actions.status",
		label: statusLabel,
		color: statusConfig?.color,
	});
}

function updatePriorityChip(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	const chip = getActionChip(actionBar, "priority");
	if (!chip) return;

	const priorityConfig = state.priorityConfigs.find(
		(config) => config.value === state.priority
	);
	const priorityLabel = priorityConfig ? priorityConfig.label : state.priority;
	updateConfiguredValueChip(chip, context, {
		isActive: Boolean(
			state.priority && priorityConfig && priorityConfig.value !== state.defaultPriority
		),
		activeTooltipKey: "modals.task.tooltips.priorityValue",
		defaultLabelKey: "modals.task.actions.priority",
		label: priorityLabel,
		color: priorityConfig?.color,
	});
}

function updateConfiguredValueChip(
	chip: HTMLElement,
	context: TaskModalActionIconStateContext,
	options: {
		isActive: boolean;
		activeTooltipKey: string;
		defaultLabelKey: string;
		label: string;
		color?: string;
	}
): void {
	if (options.isActive) {
		chip.classList.add("has-value");
		setTaskModalChipLabel(chip, options.label);
		setTooltip(chip, context.translate(options.activeTooltipKey, { value: options.label }), {
			placement: "top",
		});
	} else {
		chip.classList.remove("has-value");
		const defaultLabel = context.translate(options.defaultLabelKey);
		setTaskModalChipLabel(chip, defaultLabel);
		setTooltip(chip, defaultLabel, { placement: "top" });
	}

	const iconElement = chip.querySelector<HTMLElement>(".tn-task-modal__chip-icon .icon, .icon");
	if (!iconElement) return;

	if (options.color) {
		iconElement.style.color = options.color;
		return;
	}

	iconElement.classList.remove(...STATIC_COLOR_CLASSES);
	iconElement.style.removeProperty("color");
}

function updateRecurrenceChip(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	const chip = getActionChip(actionBar, "recurrence");
	if (!chip) return;

	if (state.recurrenceRule.trim()) {
		chip.classList.add("has-value");
		setTaskModalChipLabel(chip, state.recurrenceDisplayText);
		setTooltip(
			chip,
			context.translate("modals.task.tooltips.recurrenceValue", {
				value: state.recurrenceDisplayText,
			}),
			{ placement: "top" }
		);
		return;
	}

	chip.classList.remove("has-value");
	const defaultLabel = context.translate("modals.task.actions.recurrence");
	setTaskModalChipLabel(chip, defaultLabel);
	setTooltip(chip, defaultLabel, { placement: "top" });
}

function updateReminderChip(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	reminderCount: number
): void {
	const chip = getActionChip(actionBar, "reminders");
	if (!chip) return;

	if (reminderCount > 0) {
		chip.classList.add("has-value");
		const label =
			reminderCount === 1
				? context.translate("modals.task.chips.remindersSingle")
				: context.translate("modals.task.chips.remindersPlural", { count: reminderCount });
		setTaskModalChipLabel(chip, label);
		const tooltip =
			reminderCount === 1
				? context.translate("modals.task.tooltips.remindersSingle")
				: context.translate("modals.task.tooltips.remindersPlural", {
						count: reminderCount,
					});
		setTooltip(chip, tooltip, { placement: "top" });
		return;
	}

	chip.classList.remove("has-value");
	const defaultLabel = context.translate("modals.task.actions.reminders");
	setTaskModalChipLabel(chip, defaultLabel);
	setTooltip(chip, defaultLabel, { placement: "top" });
}

function updateContextsChip(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	contexts: string
): void {
	const chip = getActionChip(actionBar, "contexts");
	if (!chip) return;

	const values = parseTaskModalCommaList(contexts);
	if (values.length > 0) {
		chip.classList.add("has-value");
		const label =
			values.length === 1
				? values[0]
				: context.translate("modals.task.chips.contextsPlural", { count: values.length });
		setTaskModalChipLabel(chip, label);
		setTooltip(chip, contexts, { placement: "top" });
		return;
	}

	chip.classList.remove("has-value");
	const defaultLabel = context.translate("modals.task.contextsLabel");
	setTaskModalChipLabel(chip, defaultLabel);
	setTooltip(chip, defaultLabel, { placement: "top" });
}

function updateTagsChip(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	tags: string
): void {
	const chip = getActionChip(actionBar, "tags");
	if (!chip) return;

	const values = parseTaskModalCommaList(tags);
	if (values.length > 0) {
		chip.classList.add("has-value");
		const label =
			values.length === 1
				? `#${values[0]}`
				: context.translate("modals.task.chips.tagsPlural", { count: values.length });
		setTaskModalChipLabel(chip, label);
		setTooltip(chip, tags, { placement: "top" });
		return;
	}

	chip.classList.remove("has-value");
	const defaultLabel = context.translate("modals.task.tagsLabel");
	setTaskModalChipLabel(chip, defaultLabel);
	setTooltip(chip, defaultLabel, { placement: "top" });
}

function updateTimeEstimateChip(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	timeEstimate: number
): void {
	const chip = getActionChip(actionBar, "time-estimate");
	if (!chip) return;

	if (timeEstimate > 0) {
		chip.classList.add("has-value");
		const label = context.translate("modals.task.chips.timeEstimateValue", {
			minutes: timeEstimate,
		});
		setTaskModalChipLabel(chip, label);
		setTooltip(chip, label, { placement: "top" });
		return;
	}

	chip.classList.remove("has-value");
	const defaultLabel = context.translate("modals.task.chips.timeEstimate");
	setTaskModalChipLabel(chip, defaultLabel);
	setTooltip(chip, defaultLabel, { placement: "top" });
}

function getActionChip(actionBar: HTMLElement, dataType: string): HTMLElement | null {
	return getTaskModalChip(actionBar, dataType);
}
