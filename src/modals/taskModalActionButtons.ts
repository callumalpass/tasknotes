import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, setIcon, setTooltip } from "obsidian";
import { renderKeyHint, TASK_KEYBOARD_MAP } from "../ui/kit/keyHint";

export interface TaskModalActionButtonContext {
	translate: (key: MessageDescriptor) => string;
}

export interface TaskModalLeadingButton {
	className?: string;
	text: string;
	onClick: () => void;
}

export interface TaskModalOverflowAction {
	title: string;
	icon: string;
	warning?: boolean;
	onClick: () => void;
}

export interface CreateTaskModalActionButtonsOptions {
	container: HTMLElement;
	leadingButtons?: readonly TaskModalLeadingButton[];
	overflowActions?: readonly TaskModalOverflowAction[];
	onSave: () => void;
	onCancel: () => void;
	saveLabel?: string;
	createMore?: boolean;
	onCreateMoreChange?: (checked: boolean) => void;
}

export function createTaskModalActionButtons(
	context: TaskModalActionButtonContext,
	options: CreateTaskModalActionButtonsOptions
): HTMLElement {
	const buttonContainer = options.container.createDiv(
		"modal-button-container tn-task-modal__button-bar"
	);
	const leadingContainer = options.onCreateMoreChange || options.leadingButtons?.length || options.overflowActions?.length
		? buttonContainer.createDiv("tn-task-modal__leading-actions")
		: buttonContainer;
	if (options.onCreateMoreChange) {
		const label = leadingContainer.createEl("label", { cls: "tn-modal__create-more" });
		const checkbox = label.createEl("input", { attr: { type: "checkbox" } });
		checkbox.checked = options.createMore ?? false;
		label.createSpan({
			text: context.translate(
				msg({ message: "Create more", context: "task modal repeat creation" })
			),
		});
		checkbox.addEventListener("change", () => options.onCreateMoreChange?.(checkbox.checked));
		renderKeyHint(label, TASK_KEYBOARD_MAP.createMore);
	}

	for (const buttonConfig of options.leadingButtons ?? []) {
		const button = leadingContainer.createEl("button", {
			cls: buttonConfig.className,
			text: buttonConfig.text,
		});
		button.addEventListener("click", buttonConfig.onClick);
	}

	if (options.overflowActions?.length) {
		createOverflowButton(leadingContainer, context, options.overflowActions);
	}

	const submitContainer = buttonContainer.createDiv("tn-task-modal__submit-actions");
	// A plain button, like Cancel in Obsidian's own dialogs
	const cancelButton = submitContainer.createEl("button", {
		text: context.translate(msg({ message: "Cancel", context: "common.cancel" })),
	});
	cancelButton.addEventListener("click", options.onCancel);
	const saveButton = submitContainer.createEl("button", {
		cls: "mod-cta tn-btn tn-btn--primary",
	});
	saveButton.setAttribute(
		"aria-label",
		options.saveLabel ??
			context.translate(msg({ message: "Save", context: "modals.task.buttons.save" }))
	);
	saveButton.createSpan({
		text:
			options.saveLabel ??
			context.translate(msg({ message: "Save", context: "modals.task.buttons.save" })),
	});
	renderKeyHint(saveButton, TASK_KEYBOARD_MAP.save);
	saveButton.addEventListener("click", options.onSave);

	return buttonContainer;
}

function createOverflowButton(
	container: HTMLElement,
	context: TaskModalActionButtonContext,
	actions: readonly TaskModalOverflowAction[]
): void {
	const label = context.translate(
		msg({ message: "More actions", context: "modals.task.buttons.moreActions" })
	);
	const button = container.createEl("button", {
		cls: "clickable-icon tn-task-modal__overflow-button",
		attr: { "aria-label": label, "aria-haspopup": "menu" },
	});
	setIcon(button, "more-horizontal");
	setTooltip(button, label, { placement: "top" });

	button.addEventListener("click", () => {
		const menu = new Menu();
		for (const action of actions) {
			menu.addItem((item) => {
				item.setTitle(action.title).setIcon(action.icon).onClick(action.onClick);
				if (action.warning) item.setWarning(true);
			});
		}
		const rect = button.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom });
	});
}
