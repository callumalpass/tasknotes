import { Setting, setIcon, type App, type TextComponent } from "obsidian";
import { DateContextMenu } from "../components/DateContextMenu";
import type TaskNotesPlugin from "../main";
import type { UserMappedField } from "../types/settings";
import { attachDateInputBehavior } from "../ui/dateInputBehavior";
import { stringifyUnknown } from "../utils/stringUtils";
import { UserFieldSuggest } from "./taskModalSuggests";
import {
	isTruthyUserFieldValue,
	parseListUserFieldInput,
	parseNullableListUserFieldInput,
	parseNullableTextUserFieldInput,
	parseNumberUserFieldInput,
	userFieldValueToInputString,
	userFieldValueToString,
} from "./taskModalUserFields";

export interface TaskModalUserFieldToggleControl {
	setValue(value: boolean): unknown;
}

export interface TaskModalUserFieldContext {
	app: App;
	plugin: TaskNotesPlugin;
	translate: (key: string, params?: Record<string, string | number>) => string;
	attachMobileKeyboardScrollGuard: (input: HTMLInputElement) => void;
}

export interface TaskModalUserFieldControlOptions {
	container: HTMLElement;
	field: UserMappedField;
	values: Record<string, unknown>;
	inputRefs: Map<string, HTMLInputElement>;
	toggleRefs: Map<string, TaskModalUserFieldToggleControl>;
	onValueChange: (key: string, value: unknown) => void;
}

export interface TaskModalUserFieldsSectionOptions {
	container: HTMLElement;
	fields: readonly UserMappedField[];
	values: Record<string, unknown>;
	inputRefs: Map<string, HTMLInputElement>;
	toggleRefs: Map<string, TaskModalUserFieldToggleControl>;
	onValueChange: (key: string, value: unknown) => void;
}

export interface UpdateTaskModalUserFieldControlsOptions {
	fields: readonly Pick<UserMappedField, "key">[];
	values: Record<string, unknown>;
	inputRefs: Map<string, HTMLInputElement>;
	toggleRefs: Map<string, TaskModalUserFieldToggleControl>;
}

export function createTaskModalConfiguredUserField(
	context: TaskModalUserFieldContext,
	options: TaskModalUserFieldControlOptions
): void {
	const { container, field, values, inputRefs, toggleRefs, onValueChange } = options;
	const setting = new Setting(container).setName(field.displayName);

	switch (field.type) {
		case "text":
		case "list": {
			setting.addText((text) => {
				const currentValue = values[field.key];
				const displayValue = Array.isArray(currentValue)
					? currentValue.map(userFieldValueToString).join(", ")
					: userFieldValueToString(currentValue);

				text.setValue(displayValue).onChange((value) => {
					onValueChange(
						field.key,
						field.type === "list" ? parseListUserFieldInput(value) : value
					);
				});
				registerTextInput(context, inputRefs, field, text.inputEl);
			});
			break;
		}
		case "number": {
			setting.addText((text) => {
				const currentValue = values[field.key];
				text.setValue(userFieldValueToString(currentValue)).onChange((value) => {
					onValueChange(field.key, parseNumberUserFieldInput(value));
				});
				text.inputEl.type = "number";
				registerTextInput(context, inputRefs, field, text.inputEl, {
					attachSuggest: false,
				});
			});
			break;
		}
		case "date": {
			setting.addText((text) => {
				const currentValue = values[field.key];
				text.setValue(userFieldValueToString(currentValue)).onChange((value) => {
					onValueChange(field.key, value);
				});
				text.inputEl.type = "date";
				attachDateInputBehavior(text.inputEl, {
					onCommit: (value) => {
						onValueChange(field.key, value);
					},
				});
				registerTextInput(context, inputRefs, field, text.inputEl, {
					attachSuggest: false,
				});
			});
			break;
		}
		case "boolean": {
			setting.addToggle((toggle) => {
				const currentValue = values[field.key];
				toggle.setValue(currentValue === true).onChange((value) => {
					onValueChange(field.key, value);
				});
				toggleRefs.set(field.key, toggle);
			});
			break;
		}
	}
}

export function createTaskModalUserFieldsSection(
	context: TaskModalUserFieldContext,
	options: TaskModalUserFieldsSectionOptions
): void {
	const { container, fields } = options;

	if (fields.length > 0) {
		const separator = container.createDiv({ cls: "tn-task-modal__user-fields" });
		separator.createDiv({
			text: context.translate("modals.task.customFieldsLabel"),
			cls: "tn-task-modal__section-label",
		});
	}

	for (const field of fields) {
		if (!field || !field.key || !field.displayName) continue;
		createTaskModalUserFieldSectionControl(context, options, field);
	}
}

export function updateTaskModalUserFieldControls(
	options: UpdateTaskModalUserFieldControlsOptions
): void {
	for (const field of options.fields) {
		const currentValue = options.values[field.key];
		const input = options.inputRefs.get(field.key);
		if (input) {
			input.value = userFieldValueToInputString(currentValue);
		}

		const toggle = options.toggleRefs.get(field.key);
		if (toggle) {
			toggle.setValue(isTruthyUserFieldValue(currentValue));
		}
	}
}

function createTaskModalUserFieldSectionControl(
	context: TaskModalUserFieldContext,
	options: TaskModalUserFieldsSectionOptions,
	field: UserMappedField
): void {
	const currentValue = options.values[field.key] || "";

	switch (field.type) {
		case "boolean":
			new Setting(options.container).setName(field.displayName).addToggle((toggle) => {
				toggle.setValue(isTruthyUserFieldValue(currentValue)).onChange((value) => {
					options.onValueChange(field.key, value);
				});
				options.toggleRefs.set(field.key, toggle);
			});
			break;

		case "number":
			new Setting(options.container).setName(field.displayName).addText((text) => {
				text.setPlaceholder(context.translate("modals.task.userFields.numberPlaceholder"))
					.setValue(currentValue ? stringifyUnknown(currentValue) : "")
					.onChange((value) => {
						options.onValueChange(field.key, parseNumberUserFieldInput(value));
					});
				registerTextInput(context, options.inputRefs, field, text.inputEl, {
					attachSuggest: false,
				});
			});
			break;

		case "date":
			createTaskModalDateUserField(context, options, field, currentValue);
			break;

		case "list":
			new Setting(options.container).setName(field.displayName).addText((text) => {
				const displayValue = Array.isArray(currentValue)
					? currentValue.join(", ")
					: currentValue
						? stringifyUnknown(currentValue)
						: "";

				text.setPlaceholder(context.translate("modals.task.userFields.listPlaceholder"))
					.setValue(displayValue)
					.onChange((value) => {
						options.onValueChange(field.key, parseNullableListUserFieldInput(value));
					});
				registerTextInput(context, options.inputRefs, field, text.inputEl);

				const oldPreview = options.container.querySelector(".user-field-link-preview");
				if (oldPreview) oldPreview.detach?.();
			});
			break;

		case "text":
		default:
			new Setting(options.container).setName(field.displayName).addText((text) => {
				text.setPlaceholder(
					context.translate("modals.task.userFields.textPlaceholder", {
						field: field.displayName,
					})
				)
					.setValue(currentValue ? stringifyUnknown(currentValue) : "")
					.onChange((value) => {
						options.onValueChange(field.key, parseNullableTextUserFieldInput(value));
					});
				registerTextInput(context, options.inputRefs, field, text.inputEl);
			});
			break;
	}
}

function createTaskModalDateUserField(
	context: TaskModalUserFieldContext,
	options: TaskModalUserFieldsSectionOptions,
	field: UserMappedField,
	currentValue: unknown
): void {
	new Setting(options.container).setName(field.displayName).addText((text) => {
		text.setPlaceholder(context.translate("modals.task.userFields.datePlaceholder"))
			.setValue(currentValue ? stringifyUnknown(currentValue) : "")
			.onChange((value) => {
				options.onValueChange(field.key, parseNullableTextUserFieldInput(value));
			});
		registerTextInput(context, options.inputRefs, field, text.inputEl, {
			attachSuggest: false,
		});

		const parent = text.inputEl.parentElement;
		if (parent) parent.addClass("tn-date-control");
		attachDateInputBehavior(text.inputEl, {
			onCommit: (value) => {
				options.onValueChange(field.key, value);
			},
		});
		const button = parent?.createEl("button", {
			cls: "user-field-date-picker-btn",
		});
		if (button) {
			button.setAttribute(
				"aria-label",
				context.translate("modals.task.userFields.pickDate", {
					field: field.displayName,
				})
			);
			setIcon(button, "calendar");
			button.addEventListener("click", (event) => {
				event.preventDefault();
				const menu = new DateContextMenu({
					currentValue: getTextValue(text) || undefined,
					onSelect: (value) => {
						text.setValue(value || "");
						options.onValueChange(field.key, parseNullableTextUserFieldInput(value));
					},
					plugin: context.plugin,
					app: context.app,
				});
				menu.showAtElement(button);
			});
		}
	});
}

function registerTextInput(
	context: TaskModalUserFieldContext,
	inputRefs: Map<string, HTMLInputElement>,
	field: UserMappedField,
	input: HTMLInputElement,
	options: { attachSuggest?: boolean } = {}
): void {
	inputRefs.set(field.key, input);
	context.attachMobileKeyboardScrollGuard(input);

	if (options.attachSuggest !== false) {
		new UserFieldSuggest(context.app, input, context.plugin, field);
	}
}

function getTextValue(text: TextComponent): string {
	return typeof text.getValue === "function" ? text.getValue() : text.inputEl.value;
}
