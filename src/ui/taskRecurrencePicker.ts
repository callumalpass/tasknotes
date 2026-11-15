import { msg } from "@lingui/core/macro";
import { setIcon, type App } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { uiText } from "../i18n/runtime";
import { recurrenceDisplayText } from "../i18n/recurrence";
import {
	buildRecurrenceOptions,
	CustomRecurrenceModal,
	getPluginCalendarLocale,
} from "../components/CustomRecurrenceModal";
import { openListPicker } from "./kit/listPicker";
import type { PopoverHandle, PopoverOptions } from "./kit/popover";
import { changeTaskProperty, showTaskUndo, type TaskUndoFeedback } from "./taskPropertyPickers";

export type RecurrenceAnchor = "scheduled" | "completion";

export interface RecurrenceChoiceState {
	recurrence?: string;
	anchor?: RecurrenceAnchor;
	scheduled?: string;
}

export type RecurrenceApply = (value: string | undefined, anchor?: RecurrenceAnchor) => void;

export interface RecurrenceChoice {
	id: string;
	label: string;
	icon?: string;
	selected?: boolean;
	/** Applies the choice; Custom opens the recurrence modal first. */
	choose: () => void;
}

/**
 * The recurrence choices the picker and the task menu's Recurrence submenu
 * both offer: a rule that is not a preset, the presets, Custom and Clear.
 */
export function recurrenceChoices(
	plugin: TaskNotesPlugin,
	app: App,
	state: RecurrenceChoiceState,
	apply: RecurrenceApply
): RecurrenceChoice[] {
	const translate = plugin.i18n.translate.bind(plugin.i18n);
	const current = state.recurrence || undefined;
	const currentAnchor = state.anchor || "scheduled";
	const presets = buildRecurrenceOptions({
		currentValue: current,
		scheduledDate: state.scheduled,
		calendarLocale: getPluginCalendarLocale(plugin),
		translate,
	}).filter((option) => option.value);
	const isCurrent = (option: (typeof presets)[number]) =>
		option.value === current && (option.anchor || "scheduled") === currentAnchor;
	const choices: RecurrenceChoice[] = [];
	if (current && !presets.some(isCurrent)) {
		choices.push({
			id: "current",
			label: recurrenceDisplayText(current),
			icon: "repeat",
			selected: true,
			choose: () => {},
		});
	}
	presets.forEach((option, index) => {
		choices.push({
			id: String(index),
			label: option.label,
			icon: option.icon,
			selected: isCurrent(option),
			choose: () => apply(option.value, option.anchor || "scheduled"),
		});
	});
	choices.push({
		id: "custom",
		label: translate(
			msg({
				message: "Custom recurrence...",
				context: "components.recurrenceContextMenu.customRecurrence",
			})
		),
		icon: "settings",
		choose: () =>
			new CustomRecurrenceModal(
				app,
				current || "",
				currentAnchor,
				state.scheduled,
				plugin,
				(result, nextAnchor) => {
					if (result) apply(result, nextAnchor);
				}
			).open(),
	});
	if (current) {
		choices.push({
			id: "clear",
			label: uiText(msg({ message: "Clear", context: "interaction clear" })),
			icon: "x",
			choose: () => apply(undefined),
		});
	}
	return choices;
}

/**
 * The recurrence picker: the same searchable list as the status, priority and
 * date pickers. Custom opens the recurrence modal; `apply(undefined)` clears
 * the rule.
 */
export function openRecurrenceChoices(
	plugin: TaskNotesPlugin,
	app: App,
	state: RecurrenceChoiceState,
	anchor: PopoverOptions["anchor"],
	apply: RecurrenceApply
): PopoverHandle {
	const choices = recurrenceChoices(plugin, app, state, apply);
	const label = plugin.i18n.translate(
		msg({ message: "Recurrence", context: "contextMenus.task.recurrence" })
	);
	return openListPicker({
		anchor,
		app,
		items: choices.map((choice) => ({
			id: choice.id,
			label: choice.label,
			selected: choice.selected,
			renderLeading: choice.icon
				? (host) => setIcon(host, choice.icon as string)
				: undefined,
		})),
		revealSelected: false,
		placeholder: label,
		emptyText: label,
		onChoose: (item) => choices.find((choice) => choice.id === item.id)?.choose(),
	});
}

/**
 * Writes a recurrence change with the same undo toast as the other property
 * pickers. The anchor is written only when it changes.
 */
export async function applyTaskRecurrence(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	value: string | undefined,
	anchor?: RecurrenceAnchor
): Promise<void> {
	const feedback: TaskUndoFeedback = { undo: [], failed: false };
	const [updated] = await changeTaskProperty(plugin, [task], "recurrence", value, feedback);
	if (updated && anchor !== undefined && (updated.recurrence_anchor || "scheduled") !== anchor) {
		await changeTaskProperty(plugin, [updated], "recurrence_anchor", anchor, feedback);
	}
	const property = plugin.i18n.translate(
		msg({ message: "Recurrence", context: "contextMenus.task.recurrence" })
	);
	showTaskUndo(
		feedback.undo,
		feedback.failed,
		updated ? 1 : 0,
		plugin.app.vault,
		feedback.failed
			? `${property} · ${task.title}`
			: uiText(
					msg({
						message:
							"{count, plural, one {# task updated} other {# tasks updated}}: {property} → {value}",
						context: "interaction property feedback",
					}),
					{
						count: 1,
						property,
						value: value ? recurrenceDisplayText(value) : "—",
					}
				)
	);
}

export async function openTaskRecurrencePicker(
	plugin: TaskNotesPlugin,
	task: TaskInfo,
	anchor: PopoverOptions["anchor"],
	onChange?: () => void
): Promise<void> {
	const latest = (await plugin.cacheManager.getTaskInfo(task.path)) ?? task;
	const doc = "ownerDocument" in anchor ? anchor.ownerDocument : activeDocument;
	if (doc.querySelector(".modal-container") && !("closest" in anchor && anchor.closest(".modal-container"))) return;
	openRecurrenceChoices(
		plugin,
		plugin.app,
		{
			recurrence: typeof latest.recurrence === "string" ? latest.recurrence : undefined,
			anchor: latest.recurrence_anchor,
			scheduled: latest.scheduled,
		},
		anchor,
		(value, nextAnchor) => void applyTaskRecurrence(plugin, latest, value, nextAnchor).then(onChange)
	);
}
