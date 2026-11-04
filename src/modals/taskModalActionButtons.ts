import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Menu, setIcon, setTooltip } from "obsidian";

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
}

export function createTaskModalActionButtons(
	context: TaskModalActionButtonContext,
	options: CreateTaskModalActionButtonsOptions
): HTMLElement {
	const buttonContainer = options.container.createDiv(
		"modal-button-container tn-task-modal__button-bar"
	);

	for (const buttonConfig of options.leadingButtons ?? []) {
		const button = buttonContainer.createEl("button", {
			cls: buttonConfig.className,
			text: buttonConfig.text,
		});
		button.addEventListener("click", buttonConfig.onClick);
	}

	if (options.overflowActions?.length) {
		createOverflowButton(buttonContainer, context, options.overflowActions);
	}

	const saveButton = buttonContainer.createEl("button", {
		cls: "mod-cta",
		text: context.translate(msg({ message: "Save", context: "modals.task.buttons.save" })),
	});
	saveButton.addEventListener("click", options.onSave);

	const cancelButton = buttonContainer.createEl("button", {
		text: context.translate(msg({ message: "Cancel", context: "common.cancel" })),
	});
	cancelButton.addEventListener("click", options.onCancel);

	return buttonContainer;
}

function createOverflowButton(
	container: HTMLElement,
	context: TaskModalActionButtonContext,
	actions: readonly TaskModalOverflowAction[]
): void {
	const label = context.translate(msg({ message: "More actions", context: "modals.task.buttons.moreActions" }));
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
