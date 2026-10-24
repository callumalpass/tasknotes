export interface TaskModalActionButtonContext {
	translate: (key: string) => string;
}

export interface TaskModalLeadingButton {
	className?: string;
	text: string;
	onClick: () => void;
}

export interface CreateTaskModalActionButtonsOptions {
	container: HTMLElement;
	leadingButtons?: readonly TaskModalLeadingButton[];
	/** Resolves false when validation or saving failed and the modal must stay open. */
	onSave: () => Promise<boolean | void>;
	onSaved: () => void;
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

	const saveButton = buttonContainer.createEl("button", {
		cls: "mod-cta",
		text: context.translate("modals.task.buttons.save"),
	});

	saveButton.addEventListener("click", () => {
		void runTaskModalSaveAction(saveButton, options.onSave, options.onSaved);
	});

	const cancelButton = buttonContainer.createEl("button", {
		text: context.translate("common.cancel"),
	});

	cancelButton.addEventListener("click", options.onCancel);

	return buttonContainer;
}

export async function runTaskModalSaveAction(
	saveButton: HTMLButtonElement,
	onSave: () => Promise<boolean | void>,
	onSaved: () => void
): Promise<void> {
	saveButton.disabled = true;
	try {
		if ((await onSave()) !== false) {
			onSaved();
		}
	} finally {
		saveButton.disabled = false;
	}
}
