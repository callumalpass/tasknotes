const COLLAPSED_CLASS = "tn-task-modal__section--collapsed";

export interface TaskModalLayoutElements {
	detailsContainer: HTMLElement;
	splitRightColumn?: HTMLElement;
}

export function setTaskModalDetailsCollapsed(
	{ detailsContainer, splitRightColumn }: TaskModalLayoutElements,
	collapsed: boolean
): void {
	detailsContainer.classList.toggle(COLLAPSED_CLASS, collapsed);
	splitRightColumn?.classList.remove(COLLAPSED_CLASS);
}
