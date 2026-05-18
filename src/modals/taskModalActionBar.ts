import { setIcon, setTooltip } from "obsidian";

export interface TaskModalActionIconSpec {
	iconName: string;
	tooltip: string;
	onClick: (icon: HTMLElement, event: UIEvent) => void;
	dataType?: string;
}

export function createTaskModalActionIcon(
	container: HTMLElement,
	spec: TaskModalActionIconSpec
): HTMLElement {
	const iconContainer = container.createDiv("action-icon");
	iconContainer.setAttribute("aria-label", spec.tooltip);
	iconContainer.setAttribute("data-initial-tooltip", spec.tooltip);
	iconContainer.setAttribute("tabindex", "0");
	iconContainer.setAttribute("role", "button");
	if (spec.dataType) {
		iconContainer.setAttribute("data-type", spec.dataType);
	}

	setTooltip(iconContainer, spec.tooltip, { placement: "top" });

	const icon = iconContainer.createSpan("icon");
	setIcon(icon, spec.iconName);

	const activate = (event: UIEvent): void => {
		event.preventDefault();
		event.stopPropagation();
		spec.onClick(iconContainer, event);
	};

	iconContainer.addEventListener("click", activate);
	iconContainer.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			activate(event);
		}
	});

	return iconContainer;
}

export function createTaskModalActionIcons(
	container: HTMLElement,
	specs: readonly TaskModalActionIconSpec[]
): HTMLElement[] {
	return specs.map((spec) => createTaskModalActionIcon(container, spec));
}
