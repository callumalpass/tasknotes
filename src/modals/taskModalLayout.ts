const TASK_MODAL_VISIBLE_DISPLAY_CLASSES = [
	"tn-static-display-block-2a1b75c9",
	"tn-static-display-flex-4d51fc62",
	"tn-static-display-flex-75816cae",
	"tn-static-display-flex-8bb39979",
	"tn-static-display-inline-block-60e32dcb",
	"tn-static-display-inline-cccfa456",
	"tn-static-display-inline-flex-f984c520",
	"tn-static-min-height-800px-997b4c8c",
] as const;

const TASK_MODAL_HIDDEN_CLASS = "tn-static-display-none-6b99de8b";
const TASK_MODAL_VISIBLE_BLOCK_CLASS = "tn-static-display-block-2a1b75c9";
const TASK_MODAL_OPACITY_ZERO_CLASS = "tn-static-opacity-0-8d919cb5";
const TASK_MODAL_OPACITY_LEGACY_ZERO_CLASS = "tn-static-opacity-0-6-d95b59ac";
const TASK_MODAL_OPACITY_ONE_CLASS = "tn-static-opacity-1-c6e7979d";
const TASK_MODAL_TRANSLATE_START_CLASS = "tn-static-transform-translatey-10px-5b91bf02";
const TASK_MODAL_TRANSLATE_END_CLASS = "tn-static-transform-translatey-0-1b976432";

export interface TaskModalLayoutElements {
	containerEl: HTMLElement;
	detailsContainer: HTMLElement;
	splitRightColumn?: HTMLElement;
	timerWindow?: Pick<Window, "setTimeout">;
}

export function collapseTaskModalDetailsLayout({
	detailsContainer,
	splitRightColumn,
}: Pick<TaskModalLayoutElements, "detailsContainer" | "splitRightColumn">): void {
	removeVisibleDisplayClasses(detailsContainer);
	detailsContainer.classList.add(TASK_MODAL_HIDDEN_CLASS);

	if (!splitRightColumn) {
		return;
	}

	removeVisibleDisplayClasses(splitRightColumn);
	splitRightColumn.classList.add(TASK_MODAL_HIDDEN_CLASS);
}

export function expandTaskModalDetailsLayout({
	containerEl,
	detailsContainer,
	splitRightColumn,
	timerWindow,
}: TaskModalLayoutElements): void {
	removeVisibleDisplayClasses(detailsContainer, TASK_MODAL_HIDDEN_CLASS);
	detailsContainer.classList.add(TASK_MODAL_VISIBLE_BLOCK_CLASS);
	containerEl.classList.add("expanded");

	if (splitRightColumn) {
		removeVisibleDisplayClasses(splitRightColumn, TASK_MODAL_HIDDEN_CLASS);
		splitRightColumn.style.removeProperty("display");
	}

	detailsContainer.classList.remove(
		TASK_MODAL_OPACITY_LEGACY_ZERO_CLASS,
		TASK_MODAL_OPACITY_ONE_CLASS
	);
	detailsContainer.classList.add(TASK_MODAL_OPACITY_ZERO_CLASS);
	detailsContainer.classList.remove(TASK_MODAL_TRANSLATE_END_CLASS);
	detailsContainer.classList.add(TASK_MODAL_TRANSLATE_START_CLASS);

	const win = timerWindow ?? detailsContainer.ownerDocument.defaultView ?? window;
	win.setTimeout(() => {
		detailsContainer.classList.remove(
			TASK_MODAL_OPACITY_LEGACY_ZERO_CLASS,
			TASK_MODAL_OPACITY_ZERO_CLASS
		);
		detailsContainer.classList.add(TASK_MODAL_OPACITY_ONE_CLASS);
		detailsContainer.classList.remove(TASK_MODAL_TRANSLATE_START_CLASS);
		detailsContainer.classList.add(TASK_MODAL_TRANSLATE_END_CLASS);
	}, 50);
}

function removeVisibleDisplayClasses(element: HTMLElement, ...extraClasses: string[]): void {
	element.classList.remove(...TASK_MODAL_VISIBLE_DISPLAY_CLASSES, ...extraClasses);
}
