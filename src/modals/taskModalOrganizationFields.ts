import { Setting } from "obsidian";

interface TaskModalListFieldOptions {
	label: string;
	buttonText: string;
	buttonTooltip: string;
	onButtonClick: () => void;
	listElement?: HTMLElement;
}

export function createTaskModalListField(
	container: HTMLElement,
	options: TaskModalListFieldOptions
): HTMLElement {
	new Setting(container).setName(options.label).addButton((button) => {
		button
			.setButtonText(options.buttonText)
			.setTooltip(options.buttonTooltip)
			.onClick(options.onButtonClick);
		button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
	});

	return options.listElement ?? container.createDiv({ cls: "task-projects-list" });
}
