import { setIcon, setTooltip } from "obsidian";

export interface BadgeIndicatorConfig {
	container: HTMLElement;
	className: string;
	icon: string;
	tooltip: string;
	ariaLabel?: string;
	onClick?: (e: MouseEvent) => void;
	visible?: boolean;
}

export type UpdateBadgeIndicatorConfig = Omit<BadgeIndicatorConfig, "container"> & {
	shouldExist: boolean;
};

/**
 * Mark interactive task-card controls so draggable parent cards do not swallow clicks.
 */
export function prepareInteractiveControl(element: HTMLElement): void {
	element.setAttribute("role", "button");
	element.tabIndex = 0;

	if (element.dataset.tnNoDrag === "true") {
		element.setAttribute("draggable", "false");
		return;
	}

	element.dataset.tnNoDrag = "true";
	element.setAttribute("draggable", "false");
	element.addEventListener("mousedown", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});
	element.addEventListener("keydown", (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		e.preventDefault();
		e.stopPropagation();
		element.click();
	});
}

/**
 * Creates a badge indicator element with icon, tooltip, and optional click handler.
 * Returns the element, or null if visible is false.
 */
export function createBadgeIndicator(config: BadgeIndicatorConfig): HTMLElement | null {
	const { container, className, icon, tooltip, ariaLabel, onClick, visible = true } = config;

	if (!visible) return null;

	const indicator = container.createEl("div", {
		cls: className,
		attr: { "aria-label": ariaLabel || tooltip },
	});

	setIcon(indicator, icon);
	setTooltip(indicator, tooltip, { placement: "top" });

	if (onClick) {
		prepareInteractiveControl(indicator);
		indicator.addEventListener("click", (e) => {
			e.stopPropagation();
			onClick(e);
		});
	}

	return indicator;
}

/**
 * Updates or creates a badge indicator, returning the element.
 * If the indicator should not exist, removes any existing one and returns null.
 */
export function updateBadgeIndicator(
	container: HTMLElement,
	selector: string,
	config: UpdateBadgeIndicatorConfig
): HTMLElement | null {
	const existing = container.querySelector<HTMLElement>(selector);

	if (!config.shouldExist) {
		existing?.remove();
		return null;
	}

	if (existing) {
		existing.setAttribute("aria-label", config.ariaLabel || config.tooltip);
		setTooltip(existing, config.tooltip, { placement: "top" });
		if (config.onClick) {
			prepareInteractiveControl(existing);
		}
		return existing;
	}

	const badgesContainer = container.querySelector(".task-card__badges") as HTMLElement;
	const targetContainer =
		badgesContainer || (container.querySelector(".task-card__main-row") as HTMLElement);

	if (!targetContainer) return null;

	return createBadgeIndicator({
		container: targetContainer,
		...config,
	});
}
