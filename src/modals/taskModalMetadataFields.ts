import { App, Setting } from "obsidian";
import TaskNotesPlugin from "../main";
import { sanitizeTags } from "../utils/helpers";
import { ContextSuggest, TagSuggest } from "./taskModalSuggests";

export interface TaskModalMetadataFieldContext {
	app: App;
	plugin: TaskNotesPlugin;
	translate: (key: string) => string;
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
	onChange: (value: number) => void;
}

export function parseTaskModalTimeEstimate(value: string): number {
	return parseInt(value) || 0;
}

export function createTaskModalContextsField(
	context: TaskModalMetadataFieldContext,
	options: CreateTaskModalTextFieldOptions
): HTMLInputElement {
	let inputEl: HTMLInputElement | null = null;
	const setting = new Setting(options.container);
	setting.settingEl.addClass("tn-task-modal__wide-text-setting");
	setting.setName(context.translate("modals.task.contextsLabel")).addText((text) => {
		text.setPlaceholder(context.translate("modals.task.contextsPlaceholder"))
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
	setting.settingEl.addClass("tn-task-modal__wide-text-setting");
	setting.setName(context.translate("modals.task.tagsLabel")).addText((text) => {
		text.setPlaceholder(context.translate("modals.task.tagsPlaceholder"))
			.setValue(options.value)
			.onChange((value) => {
				options.onChange(sanitizeTags(value));
			});

		inputEl = text.inputEl;
		context.attachMobileKeyboardScrollGuard(text.inputEl);
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
		.setName(context.translate("modals.task.timeEstimateLabel"))
		.addText((text) => {
			text.setPlaceholder(context.translate("modals.task.timeEstimatePlaceholder"))
				.setValue(options.value.toString())
				.onChange((value) => {
					options.onChange(parseTaskModalTimeEstimate(value));
				});

			inputEl = text.inputEl;
			context.attachMobileKeyboardScrollGuard(text.inputEl);
		});

	if (!inputEl) {
		throw new Error("Failed to create time estimate input");
	}
	return inputEl;
}
