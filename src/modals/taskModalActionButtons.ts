import { setIcon, setTooltip } from "obsidian";

export interface TaskModalActionButtonContext {
	translate: (key: string) => string;
}

export interface TaskModalLeadingIconButton {
	className?: string;
	iconName: string;
	label: string;
	onClick: () => void;
	isWarning?: boolean;
}

export interface CreateTaskModalActionButtonsOptions {
	container: HTMLElement;
	leadingButtons?: readonly TaskModalLeadingIconButton[];
	onSave: () => Promise<void>;
	onSaved: () => void;
	onCancel: () => void;
}

export function createTaskModalIconButton(
	parent: HTMLElement,
	options: {
		className?: string;
		iconName: string;
		label: string;
		isWarning?: boolean;
		isPrimary?: boolean;
	}
): HTMLButtonElement {
	const button = parent.createEl("button", {
		cls: [
			"tn-task-modal__icon-button",
			options.className,
			options.isWarning ? "mod-warning" : "",
			options.isPrimary ? "mod-cta" : "",
		]
			.filter(Boolean)
			.join(" "),
		attr: {
			"aria-label": options.label,
			type: "button",
		},
	});
	setIcon(button.createSpan("tn-task-modal__icon-button-icon"), options.iconName);
	button.createSpan({ cls: "tn-task-modal__icon-button-label", text: options.label });
	setTooltip(button, options.label, { placement: "top" });
	return button;
}

export function createTaskModalActionButtons(
	context: TaskModalActionButtonContext,
	options: CreateTaskModalActionButtonsOptions
): HTMLElement {
	const buttonContainer = options.container.createDiv(
		"modal-button-container tn-task-modal__button-bar tn-task-modal__icon-button-bar"
	);

	const leadingGroup = buttonContainer.createDiv("tn-task-modal__icon-button-leading");

	for (const buttonConfig of options.leadingButtons ?? []) {
		const button = createTaskModalIconButton(leadingGroup, {
			className: buttonConfig.className,
			iconName: buttonConfig.iconName,
			label: buttonConfig.label,
			isWarning: buttonConfig.isWarning,
		});
		button.addEventListener("click", buttonConfig.onClick);
	}

	const trailingGroup = buttonContainer.createDiv("tn-task-modal__icon-button-trailing");

	const cancelButton = createTaskModalIconButton(trailingGroup, {
		iconName: "x",
		label: context.translate("common.cancel"),
	});
	cancelButton.addEventListener("click", options.onCancel);

	const saveButton = createTaskModalIconButton(trailingGroup, {
		iconName: "check",
		label: context.translate("modals.task.buttons.save"),
		isPrimary: true,
	});

	saveButton.addEventListener("click", () => {
		void runTaskModalSaveAction(saveButton, options.onSave, options.onSaved);
	});

	return buttonContainer;
}

export async function runTaskModalSaveAction(
	saveButton: HTMLButtonElement,
	onSave: () => Promise<void>,
	onSaved: () => void
): Promise<void> {
	saveButton.disabled = true;
	try {
		await onSave();
		onSaved();
	} finally {
		saveButton.disabled = false;
	}
}
