import { configLabel } from "../i18n/configLabels";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { setIcon, setTooltip } from "obsidian";
import type { PriorityConfig, StatusConfig } from "../types";
import {
	priorityGlyphState,
	renderPriorityGlyph,
	renderStatusGlyph,
	statusGlyphState,
	hasVisiblePriority,
} from "../ui/kit/glyphs";
import { taskDateLabel, taskDueUrgency } from "../ui/kit/dateLabel";
import { formatDateTimeForDisplay } from "../utils/dateUtils";

export interface TaskModalActionIconStateContext {
	translate: (key: MessageDescriptor, params?: Record<string, string | number>) => string;
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
	timeFormat: "12" | "24";
	hideCompletedFromOverdue?: boolean;
}

export function updateTaskModalActionIconStates(
	actionBar: HTMLElement | undefined,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	if (!actionBar) return;

	updateDateIcon(actionBar, context, state, "due-date", state.dueDate, {
		activeKey: msg({ message: "Due: {value}", context: "modals.task.tooltips.dueValue" }),
		defaultTooltipKey: msg({ message: "Set due date", context: "modals.task.actions.due" }),
		emptyLabelKey: msg({ message: "Due date", context: "contextMenus.task.dueDate" }),
	});
	updateDateIcon(actionBar, context, state, "scheduled-date", state.scheduledDate, {
		activeKey: msg({
			message: "Scheduled: {value}",
			context: "modals.task.tooltips.scheduledValue",
		}),
		defaultTooltipKey: msg({
			message: "Set scheduled date",
			context: "modals.task.actions.scheduled",
		}),
		emptyLabelKey: msg({
			message: "Scheduled date",
			context: "contextMenus.task.scheduledDate",
		}),
	});
	updateStatusIcon(actionBar, context, state);
	updatePriorityIcon(actionBar, context, state);
	updateRecurrenceIcon(actionBar, context, state);
	updateReminderIcon(actionBar, context, state.reminderCount);
}

function setChipLabel(icon: HTMLElement, label: string): void {
	const labelEl = icon.querySelector<HTMLElement>(".action-icon__label");
	if (labelEl) {
		labelEl.textContent = label;
		labelEl.title = label;
	}
}

function updateDateIcon(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState,
	dataType: string,
	value: string,
	keys: {
		activeKey: MessageDescriptor;
		defaultTooltipKey: MessageDescriptor;
		emptyLabelKey: MessageDescriptor;
	}
): void {
	const icon = getActionIcon(actionBar, dataType);
	if (!icon) return;
	icon.classList.add("tn-task-date");
	icon.dataset.tnDateUrgency =
		dataType === "due-date"
			? taskDueUrgency(
					value,
					state.statusConfigs.some(
						(config) => config.value === state.status && config.isCompleted
					),
					state.hideCompletedFromOverdue ?? true
				)
			: "neutral";

	if (value) {
		icon.classList.add("has-value");
		setChipLabel(icon, taskDateLabel(value, state.timeFormat));
		const fullDate = formatDateTimeForDisplay(value, { userTimeFormat: state.timeFormat });
		setTooltip(icon, context.translate(keys.activeKey, { value: fullDate }), {
			placement: "top",
		});
		return;
	}

	icon.classList.remove("has-value");
	setChipLabel(icon, context.translate(keys.emptyLabelKey));
	setTooltip(icon, context.translate(keys.defaultTooltipKey), { placement: "top" });
}

function updateStatusIcon(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	const icon = getActionIcon(actionBar, "status");
	if (!icon) return;

	const statusConfig = state.statusConfigs.find((config) => config.value === state.status);
	const statusLabel = statusConfig ? configLabel(statusConfig) : state.status;
	const statusGlyph = statusGlyphState(state.status, state.statusConfigs);
	renderConfiguredGlyph(icon, statusConfig?.icon, statusGlyph, (host) =>
		renderStatusGlyph(host, statusGlyph)
	);
	updateConfiguredValueIcon(icon, context, {
		isActive: Boolean(state.status && state.status !== state.defaultStatus),
		activeTooltipKey: msg({
			message: "Status: {value}",
			context: "modals.task.tooltips.statusValue",
		}),
		defaultTooltipKey: msg({ message: "Set status", context: "modals.task.actions.status" }),
		label: statusLabel,
		color: statusConfig?.color,
	});
}

function renderConfiguredGlyph(
	icon: HTMLElement,
	customIcon: string | undefined,
	state: unknown,
	render: (host: HTMLElement) => void
): void {
	const iconElement = icon.querySelector<HTMLElement>(".icon");
	const signature = customIcon ?? JSON.stringify(state);
	if (!iconElement || iconElement.dataset.glyphSignature === signature) return;
	iconElement.empty();
	if (customIcon) setIcon(iconElement, customIcon);
	else render(iconElement);
	iconElement.dataset.glyphSignature = signature;
}

function updatePriorityIcon(
	actionBar: HTMLElement,
	context: TaskModalActionIconStateContext,
	state: TaskModalActionIconState
): void {
	const icon = getActionIcon(actionBar, "priority");
	if (!icon) return;

	const priorityConfig = state.priorityConfigs.find((config) => config.value === state.priority);
	const priorityLabel = priorityConfig ? configLabel(priorityConfig) : state.priority;
	const priorityGlyph = priorityGlyphState(state.priority, state.priorityConfigs);
	renderConfiguredGlyph(icon, priorityConfig?.icon, priorityGlyph, (host) =>
		renderPriorityGlyph(host, priorityGlyph)
	);
	const glyphElement = icon.querySelector<HTMLElement>(".icon");
	if (glyphElement)
		glyphElement.hidden = !hasVisiblePriority(state.priority, state.priorityConfigs);
	updateConfiguredValueIcon(icon, context, {
		isActive: Boolean(state.priority && state.priority !== state.defaultPriority),
		activeTooltipKey: msg({
			message: "Priority: {value}",
			context: "modals.task.tooltips.priorityValue",
		}),
		defaultTooltipKey: msg({
			message: "Set priority",
			context: "modals.task.actions.priority",
		}),
		label: priorityLabel,
		color: priorityConfig?.color,
	});
}

function updateConfiguredValueIcon(
	icon: HTMLElement,
	context: TaskModalActionIconStateContext,
	options: {
		isActive: boolean;
		activeTooltipKey: MessageDescriptor;
		defaultTooltipKey: MessageDescriptor;
		label: string;
		color?: string;
	}
): void {
	const label = context.translate(options.activeTooltipKey, { value: options.label });
	setChipLabel(icon, options.label);
	icon.setAttribute("aria-label", label);
	icon.dataset.valueState = options.isActive ? "set" : "default";

	if (options.isActive) {
		icon.classList.add("has-value");
		setTooltip(icon, context.translate(options.activeTooltipKey, { value: options.label }), {
			placement: "top",
		});
	} else {
		icon.classList.remove("has-value");
		setTooltip(icon, label, { placement: "top" });
	}

	const iconElement = icon.querySelector<HTMLElement>(".icon");
	if (!iconElement) return;

	if (options.color) {
		iconElement.style.color = options.color;
		return;
	}

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
		setChipLabel(icon, state.recurrenceDisplayText);
		setTooltip(
			icon,
			context.translate(
				msg({
					message: "Recurrence: {value}",
					context: "modals.task.tooltips.recurrenceValue",
				}),
				{
					value: state.recurrenceDisplayText,
				}
			),
			{ placement: "top" }
		);
		return;
	}

	icon.classList.remove("has-value");
	setChipLabel(
		icon,
		context.translate(msg({ message: "Recurrence", context: "contextMenus.task.recurrence" }))
	);
	setTooltip(
		icon,
		context.translate(
			msg({ message: "Set recurrence", context: "modals.task.actions.recurrence" })
		),
		{
			placement: "top",
		}
	);
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
		const tooltip = context.translate(
			msg({
				message: "{count, plural, one {# reminder set} other {# reminders set}}",
				context: "task modal reminder count",
			}),
			{ count: reminderCount }
		);
		setChipLabel(icon, tooltip);
		setTooltip(icon, tooltip, { placement: "top" });
		return;
	}

	icon.classList.remove("has-value");
	setChipLabel(
		icon,
		context.translate(msg({ message: "Reminders", context: "contextMenus.task.reminders" }))
	);
	setTooltip(
		icon,
		context.translate(
			msg({ message: "Set reminders", context: "modals.task.actions.reminders" })
		),
		{
			placement: "top",
		}
	);
}

function getActionIcon(actionBar: HTMLElement, dataType: string): HTMLElement | null {
	return actionBar.querySelector(`[data-type="${dataType}"]`);
}
