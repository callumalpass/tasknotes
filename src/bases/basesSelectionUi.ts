export type BasesSelectionVisualState = {
	isSelected(path: string): boolean;
	getPrimarySelectedPath(): string | null;
};

export type BasesSelectionClickState = BasesSelectionVisualState & {
	isSelectionModeActive(): boolean;
	enterSelectionMode(): void;
	toggleSelection(path: string): void;
	selectRange(path: string, visiblePaths: string[]): void;
};

export type BasesSelectionKeyboardState = {
	isSelectionModeActive(): boolean;
	exitSelectionMode(clearSelection?: boolean): void;
	selectAll(paths: string[]): void;
	selectAdjacentRange(direction: -1 | 1, paths: string[]): void;
};

type SelectionIndicatorOptions = {
	rootElement: HTMLElement;
	indicatorEl: HTMLElement | null;
	count: number;
	onClearSelection: () => void;
};

type SelectionClickOptions = {
	event: Pick<MouseEvent, "shiftKey" | "ctrlKey" | "metaKey">;
	taskPath: string;
	selectionService: BasesSelectionClickState | null | undefined;
	getVisibleTaskPaths: () => string[];
	updateSelectionVisuals: () => void;
};

type SelectionKeyboardOptions = {
	event: Pick<
		KeyboardEvent,
		"key" | "ctrlKey" | "metaKey" | "shiftKey" | "preventDefault" | "target"
	>;
	selectionService: BasesSelectionKeyboardState | null | undefined;
	getVisibleTaskPaths: () => string[];
	updateSelectionModeUi: (active: boolean) => void;
	updateSelectionVisuals: () => void;
};

const DISPLAY_UTILITY_CLASSES = [
	"tn-static-display-block-2a1b75c9",
	"tn-static-display-flex-4d51fc62",
	"tn-static-display-flex-75816cae",
	"tn-static-display-flex-8bb39979",
	"tn-static-display-inline-block-60e32dcb",
	"tn-static-display-inline-cccfa456",
	"tn-static-display-inline-flex-f984c520",
	"tn-static-display-none-6b99de8b",
	"tn-static-min-height-800px-997b4c8c",
];

export function setBasesSelectionModeUi(rootElement: HTMLElement, active: boolean): void {
	if (active) {
		rootElement.classList.add("tn-selection-mode");
		rootElement.setAttribute("data-selection-mode", "true");
		return;
	}

	rootElement.classList.remove("tn-selection-mode");
	rootElement.removeAttribute("data-selection-mode");
	clearBasesSelectionVisuals(rootElement);
}

export function updateBasesSelectionVisuals(
	rootElement: HTMLElement,
	selectionService: BasesSelectionVisualState | null | undefined
): void {
	if (!selectionService) {
		clearBasesSelectionVisuals(rootElement);
		return;
	}

	const primaryPath = selectionService.getPrimarySelectedPath();
	const cards = rootElement.querySelectorAll<HTMLElement>(".task-card");
	for (const card of cards) {
		updateSelectionClasses({
			element: card,
			path: card.dataset.taskPath,
			selected: card.dataset.taskPath ? selectionService.isSelected(card.dataset.taskPath) : false,
			primary: card.dataset.taskPath === primaryPath,
			selectedClass: "task-card--selected",
			primaryClass: "task-card--selected-primary",
		});
	}

	const cardWrappers = rootElement.querySelectorAll<HTMLElement>(".kanban-view__card-wrapper");
	for (const wrapper of cardWrappers) {
		updateSelectionClasses({
			element: wrapper,
			path: wrapper.dataset.taskPath,
			selected: wrapper.dataset.taskPath
				? selectionService.isSelected(wrapper.dataset.taskPath)
				: false,
			primary: wrapper.dataset.taskPath === primaryPath,
			selectedClass: "kanban-view__card-wrapper--selected",
			primaryClass: "kanban-view__card-wrapper--selected-primary",
		});
	}
}

export function clearBasesSelectionVisuals(rootElement: HTMLElement): void {
	const cards = rootElement.querySelectorAll<HTMLElement>(".task-card--selected");
	for (const card of cards) {
		card.classList.remove("task-card--selected");
		card.classList.remove("task-card--selected-primary");
	}

	const cardWrappers = rootElement.querySelectorAll<HTMLElement>(
		".kanban-view__card-wrapper--selected"
	);
	for (const wrapper of cardWrappers) {
		wrapper.classList.remove("kanban-view__card-wrapper--selected");
		wrapper.classList.remove("kanban-view__card-wrapper--selected-primary");
	}
}

export function updateBasesSelectionIndicator({
	rootElement,
	indicatorEl,
	count,
	onClearSelection,
}: SelectionIndicatorOptions): HTMLElement | null {
	if (count <= 0) {
		if (indicatorEl) {
			setDisplayUtility(indicatorEl, "tn-static-display-none-6b99de8b");
		}
		return indicatorEl;
	}

	const indicator = indicatorEl ?? createSelectionIndicator(rootElement);
	indicator.onclick = () => {
		onClearSelection();
	};
	indicator.onkeydown = (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		onClearSelection();
	};
	indicator.textContent = `${count} selected`;
	indicator.setAttribute("aria-label", `${count} selected. Activate to clear selection.`);
	setDisplayUtility(indicator, "tn-static-display-block-2a1b75c9");
	return indicator;
}

export function handleBasesSelectionClick({
	event,
	taskPath,
	selectionService,
	getVisibleTaskPaths,
	updateSelectionVisuals,
}: SelectionClickOptions): boolean {
	if (!selectionService) return false;

	if (
		!selectionService.isSelectionModeActive() &&
		!event.shiftKey &&
		!event.ctrlKey &&
		!event.metaKey
	) {
		return false;
	}

	if (event.shiftKey && !selectionService.isSelectionModeActive()) {
		selectionService.enterSelectionMode();
	}

	if (event.shiftKey) {
		selectionService.selectRange(taskPath, getVisibleTaskPaths());
	} else if (event.ctrlKey || event.metaKey) {
		selectionService.toggleSelection(taskPath);
	} else if (selectionService.isSelectionModeActive()) {
		selectionService.toggleSelection(taskPath);
	}

	updateSelectionVisuals();
	return true;
}

export function handleBasesSelectionKeyDown({
	event,
	selectionService,
	getVisibleTaskPaths,
	updateSelectionModeUi,
	updateSelectionVisuals,
}: SelectionKeyboardOptions): boolean {
	if (!selectionService?.isSelectionModeActive()) return false;
	if (isEditableKeyboardTarget(event.target)) return false;

	if (event.key === "Escape") {
		selectionService.exitSelectionMode(true);
		updateSelectionModeUi(false);
		return true;
	}

	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
		event.preventDefault();
		selectionService.selectAll(getVisibleTaskPaths());
		updateSelectionVisuals();
		return true;
	}

	const arrowDirection = getSelectionArrowDirection(event);
	if (arrowDirection !== null) {
		event.preventDefault();
		selectionService.selectAdjacentRange(arrowDirection, getVisibleTaskPaths());
		updateSelectionVisuals();
		return true;
	}

	return false;
}

export function getVisibleTaskPathsFromBasesRoot(rootElement: HTMLElement | null): string[] {
	if (!rootElement) return [];

	const cards = rootElement.querySelectorAll<HTMLElement>(".task-card[data-task-path]");
	const paths: string[] = [];
	for (const card of cards) {
		const path = card.dataset.taskPath;
		if (path) {
			paths.push(path);
		}
	}
	return paths;
}

function createSelectionIndicator(rootElement: HTMLElement): HTMLElement {
	const doc = rootElement.ownerDocument;
	const indicator = doc.createElement("div");
	indicator.className = "tn-selection-indicator";
	indicator.setAttribute("role", "button");
	indicator.tabIndex = 0;
	rootElement.appendChild(indicator);
	return indicator;
}

function setDisplayUtility(element: HTMLElement, displayClass: string): void {
	element.classList.remove(...DISPLAY_UTILITY_CLASSES);
	element.classList.add(displayClass);
}

function updateSelectionClasses({
	element,
	path,
	selected,
	primary,
	selectedClass,
	primaryClass,
}: {
	element: HTMLElement;
	path: string | undefined;
	selected: boolean;
	primary: boolean;
	selectedClass: string;
	primaryClass: string;
}): void {
	if (!path || !selected) {
		element.classList.remove(selectedClass);
		element.classList.remove(primaryClass);
		return;
	}

	element.classList.add(selectedClass);
	if (primary) {
		element.classList.add(primaryClass);
	} else {
		element.classList.remove(primaryClass);
	}
}

function getSelectionArrowDirection(
	event: Pick<KeyboardEvent, "key" | "shiftKey">
): -1 | 1 | null {
	if (!event.shiftKey) return null;
	if (event.key === "ArrowUp" || event.key === "ArrowLeft") return -1;
	if (event.key === "ArrowDown" || event.key === "ArrowRight") return 1;
	return null;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;

	const tagName = target.tagName.toLowerCase();
	return tagName === "input" || tagName === "textarea" || tagName === "select";
}
