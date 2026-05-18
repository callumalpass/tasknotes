import { setTooltip } from "obsidian";
import type { PriorityConfig, StatusConfig } from "../types";

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

	updateDateIcon(actionBar, context, "due-date", state.dueDate, {
		activeTooltipKey: "modals.task.tooltips.dueValue",
		defaultTooltipKey: "modals.task.actions.due",
	});
	updateDateIcon(actionBar, context, "scheduled-date", state.scheduledDate, {
		activeTooltipKey: "modals.task.tooltips.scheduledValue",
		defaultTooltipKey: "modals.task.actions.scheduled",
	});
	updateStatusIcon(actionBar, context, state);
	updatePriorityIcon(actionBar, context, state);
	updateRecurrenceIcon(actionBar, context, state);
	updateReminderIcon(actionBar, context, state.reminderCount);
}

function updateDateIcon(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	dataType: string,
	value: string,
	tooltipKeys: {
		activeTooltipKey: string;
		defaultTooltipKey: string;
	}
): void {
	const icon = getActionIcon(actionBar, dataType);
	if (!icon) return;

	if (value) {
		icon.classList.add("has-value");
		setTooltip(icon, context.translate(tooltipKeys.activeTooltipKey, { value }), {
			placement: "top",
		});
		return;
	}

	icon.classList.remove("has-value");
	setTooltip(icon, context.translate(tooltipKeys.defaultTooltipKey), { placement: "top" });
}

function updateStatusIcon(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	const icon = getActionIcon(actionBar, "status");
	if (!icon) return;

	const statusConfig = state.statusConfigs.find((config) => config.value === state.status);
	const statusLabel = statusConfig ? statusConfig.label : state.status;
	updateConfiguredValueIcon(icon, context, {
		isActive: Boolean(
			state.status && statusConfig && statusConfig.value !== state.defaultStatus
		),
		activeTooltipKey: "modals.task.tooltips.statusValue",
		defaultTooltipKey: "modals.task.actions.status",
		label: statusLabel,
		color: statusConfig?.color,
	});
}

function updatePriorityIcon(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	const icon = getActionIcon(actionBar, "priority");
	if (!icon) return;

	const priorityConfig = state.priorityConfigs.find(
		(config) => config.value === state.priority
	);
	const priorityLabel = priorityConfig ? priorityConfig.label : state.priority;
	updateConfiguredValueIcon(icon, context, {
		isActive: Boolean(
			state.priority && priorityConfig && priorityConfig.value !== state.defaultPriority
		),
		activeTooltipKey: "modals.task.tooltips.priorityValue",
		defaultTooltipKey: "modals.task.actions.priority",
		label: priorityLabel,
		color: priorityConfig?.color,
	});
}

function updateConfiguredValueIcon(
	icon: HTMLElement,
	context: TaskModalActionIconStateContext,
	options: {
		isActive: boolean;
		activeTooltipKey: string;
		defaultTooltipKey: string;
		label: string;
		color?: string;
	}
): void {
	if (options.isActive) {
		icon.classList.add("has-value");
		setTooltip(icon, context.translate(options.activeTooltipKey, { value: options.label }), {
			placement: "top",
		});
	} else {
		icon.classList.remove("has-value");
		setTooltip(icon, context.translate(options.defaultTooltipKey), { placement: "top" });
	}

	const iconElement = icon.querySelector<HTMLElement>(".icon");
	if (!iconElement) return;

	if (options.color) {
		iconElement.style.color = options.color;
		return;
	}

	iconElement.classList.remove(...STATIC_COLOR_CLASSES);
	iconElement.style.removeProperty("color");
}

function updateRecurrenceIcon(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	const icon = getActionIcon(actionBar, "recurrence");
	if (!icon) return;

	if (state.recurrenceRule.trim()) {
		icon.classList.add("has-value");
		setTooltip(
			icon,
			context.translate("modals.task.tooltips.recurrenceValue", {
				value: state.recurrenceDisplayText,
			}),
			{ placement: "top" }
		);
		return;
	}

	icon.classList.remove("has-value");
	setTooltip(icon, context.translate("modals.task.actions.recurrence"), {
		placement: "top",
	});
}

function updateReminderIcon(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	reminderCount: number
): void {
	const icon = getActionIcon(actionBar, "reminders");
	if (!icon) return;

	if (reminderCount > 0) {
		icon.classList.add("has-value");
		const tooltip =
			reminderCount === 1
				? context.translate("modals.task.tooltips.remindersSingle")
				: context.translate("modals.task.tooltips.remindersPlural", {
						count: reminderCount,
					});
		setTooltip(icon, tooltip, { placement: "top" });
		return;
	}

	icon.classList.remove("has-value");
	setTooltip(icon, context.translate("modals.task.actions.reminders"), {
		placement: "top",
	});
}

function getActionIcon(actionBar: HTMLElement, dataType: string): HTMLElement | null {
	return actionBar.querySelector(`[data-type="${dataType}"]`);
}
