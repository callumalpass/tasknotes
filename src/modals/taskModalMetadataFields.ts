import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { App, Setting } from "obsidian";
import TaskNotesPlugin from "../main";
import { sanitizeTags } from "../utils/helpers";
import { ContextSuggest, TagSuggest } from "./taskModalSuggests";

export interface TaskModalMetadataFieldContext {
	app: App;
	plugin: TaskNotesPlugin;
	translate: (key: MessageDescriptor) => string;
	attachMobileKeyboardScrollGuard: (input: HTMLInputElement) => void;
}

export interface CreateTaskModalTextFieldOptions {
	container: HTMLElement;
	value: string;
	onChange: (value: string) => void;
}

export interface CreateTaskModalTimeEstimateFieldOptions {
	container: HTMLElement;
	value: number;
	/** Receives null when the text is not a duration. */
	onChange: (value: number | null) => void;
}

const TIME_ESTIMATE_PART = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)(?![a-z])/gi;

/** Minutes for "45", "1h", "1.5h", "1h 30m" or "1:30"; null when the text is not a duration. */
export function parseTaskModalTimeEstimate(value: string): number | null {
	const text = value.trim();
	if (!text) return 0;
	if (/^\d+$/.test(text)) return parseInt(text, 10);

	const clock = /^(\d+):([0-5]\d)$/.exec(text);
	if (clock) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10);

	let minutes = 0;
	const unparsed = text.replace(TIME_ESTIMATE_PART, (_match, amount: string, unit: string) => {
		minutes += parseFloat(amount) * (unit.toLowerCase().startsWith("h") ? 60 : 1);
		return "";
	});
	return unparsed.trim() || minutes === 0 ? null : Math.round(minutes);
}

export function formatTaskModalTimeEstimate(minutes: number): string {
	return minutes > 0 ? minutes.toString() : "";
}

export function createTaskModalContextsField(
	context: TaskModalMetadataFieldContext,
	options: CreateTaskModalTextFieldOptions
): HTMLInputElement {
	let inputEl: HTMLInputElement | null = null;
	const setting = new Setting(options.container);
	setting.setName(context.translate(msg({ message: "Contexts", context: "modals.task.contextsLabel" }))).addText((text) => {
		text.setPlaceholder(context.translate(msg({ message: "context1, context2", context: "modals.task.contextsPlaceholder" })))
			.setValue(options.value)
			.onChange(options.onChange);

		inputEl = text.inputEl;
		context.attachMobileKeyboardScrollGuard(text.inputEl);
		new ContextSuggest(context.app, text.inputEl, context.plugin);
	});

	if (!inputEl) {
		throw new Error("Failed to create contexts input");
	}
	return inputEl;
}

export function createTaskModalTagsField(
	context: TaskModalMetadataFieldContext,
	options: CreateTaskModalTextFieldOptions
): HTMLInputElement {
	let inputEl: HTMLInputElement | null = null;
	const setting = new Setting(options.container);
	setting.setName(context.translate(msg({ message: "Tags", context: "modals.task.tagsLabel" }))).addText((text) => {
		text.setPlaceholder(context.translate(msg({ message: "tag1, tag2", context: "modals.task.tagsPlaceholder" })))
			.setValue(options.value)
			.onChange((value) => {
				options.onChange(sanitizeTags(value));
			});

		inputEl = text.inputEl;
		context.attachMobileKeyboardScrollGuard(text.inputEl);
		// Show what will be saved once the field is left.
		text.inputEl.addEventListener("blur", () => {
			text.inputEl.value = sanitizeTags(text.inputEl.value);
		});
		new TagSuggest(context.app, text.inputEl, context.plugin);
	});

	if (!inputEl) {
		throw new Error("Failed to create tags input");
	}
	return inputEl;
}

export function createTaskModalTimeEstimateField(
	context: TaskModalMetadataFieldContext,
	options: CreateTaskModalTimeEstimateFieldOptions
): HTMLInputElement {
	let inputEl: HTMLInputElement | null = null;
	new Setting(options.container)
		.setName(context.translate(msg({ message: "Time estimate (minutes)", context: "modals.task.timeEstimateLabel" })))
		.addText((text) => {
			text.setPlaceholder(context.translate(msg({ message: "30", context: "modals.task.timeEstimatePlaceholder" })))
				.setValue(formatTaskModalTimeEstimate(options.value))
				.onChange((value) => {
					options.onChange(parseTaskModalTimeEstimate(value));
				});

			inputEl = text.inputEl;
			context.attachMobileKeyboardScrollGuard(text.inputEl);
			// Show what will be saved: "1h" becomes "60" once the field is left.
			text.inputEl.addEventListener("blur", () => {
				const minutes = parseTaskModalTimeEstimate(text.inputEl.value);
				if (minutes !== null) text.inputEl.value = formatTaskModalTimeEstimate(minutes);
			});
		});

	if (!inputEl) {
		throw new Error("Failed to create time estimate input");
	}
	return inputEl;
}
