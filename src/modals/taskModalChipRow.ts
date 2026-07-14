import { setIcon, setTooltip } from "obsidian";

export interface TaskModalChipSpec {
	iconName: string;
	label: string;
	onClick: (chip: HTMLElement, event: UIEvent) => void;
	dataType: string;
}

export function createTaskModalChipRow(container: HTMLElement): HTMLElement {
	return container.createDiv("tn-task-modal__chip-row tn-task-modal__action-bar");
}

export function createTaskModalChipBreak(container: HTMLElement): HTMLElement {
	const breakEl = container.createDiv("tn-task-modal__chip-break");
	breakEl.setAttribute("aria-hidden", "true");
	return breakEl;
}

export function createTaskModalChip(
	container: HTMLElement,
	spec: TaskModalChipSpec
): HTMLElement {
	const chip = container.createDiv("tn-task-modal__chip action-chip");
	chip.setAttribute("aria-label", spec.label);
	chip.setAttribute("data-initial-label", spec.label);
	chip.setAttribute("tabindex", "0");
	chip.setAttribute("role", "button");
	chip.setAttribute("data-type", spec.dataType);

	setTooltip(chip, spec.label, { placement: "top" });

	const iconWrap = chip.createSpan("tn-task-modal__chip-icon");
	setIcon(iconWrap, spec.iconName);

	const labelEl = chip.createSpan("tn-task-modal__chip-label");
	labelEl.textContent = spec.label;

	const activate = (event: UIEvent): void => {
		event.preventDefault();
		event.stopPropagation();
		spec.onClick(chip, event);
	};

	chip.addEventListener("click", activate);
	chip.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			activate(event);
		}
	});

	return chip;
}

export function createTaskModalChips(
	container: HTMLElement,
	specs: readonly TaskModalChipSpec[]
): HTMLElement[] {
	return specs.map((spec) => createTaskModalChip(container, spec));
}

export function getTaskModalChip(
	container: HTMLElement | undefined,
	dataType: string
): HTMLElement | null {
	if (!container) return null;
	return container.querySelector(`[data-type="${dataType}"]`);
}

export function setTaskModalChipLabel(chip: HTMLElement, label: string): void {
	const labelEl = chip.querySelector<HTMLElement>(".tn-task-modal__chip-label");
	if (labelEl) {
		labelEl.textContent = label;
	}
}
