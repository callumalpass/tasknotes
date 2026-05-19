import { setIcon } from "obsidian";

export type BasesNewTaskButtonInjectionResult =
	| "injected"
	| "missing-bases-view"
	| "missing-parent"
	| "missing-toolbar";

export type InjectBasesNewTaskButtonOptions = {
	containerEl: HTMLElement;
	label: string;
	onClick: (event: MouseEvent) => void;
};

const TASKNOTES_VIEW_ACTIVE_CLASS = "tasknotes-view-active";
const NEW_TASK_BUTTON_CLASS = "tn-bases-new-task-btn";

export function cleanupBasesNewTaskButton(containerEl: HTMLElement): void {
	const basesViewEl = containerEl.closest(".bases-view");
	const parentEl = basesViewEl?.parentElement;

	parentEl?.querySelector(`.${NEW_TASK_BUTTON_CLASS}`)?.remove();
	parentEl?.classList.remove(TASKNOTES_VIEW_ACTIVE_CLASS);
}

export function injectBasesNewTaskButton(
	options: InjectBasesNewTaskButtonOptions
): BasesNewTaskButtonInjectionResult {
	const basesViewEl = options.containerEl.closest(".bases-view");
	if (!basesViewEl) {
		return "missing-bases-view";
	}

	const parentEl = basesViewEl.parentElement;
	if (!parentEl) {
		return "missing-parent";
	}

	parentEl.classList.add(TASKNOTES_VIEW_ACTIVE_CLASS);

	const toolbarEl = parentEl.querySelector(".bases-toolbar");
	if (!toolbarEl) {
		return "missing-toolbar";
	}

	toolbarEl.querySelector(`.${NEW_TASK_BUTTON_CLASS}`)?.remove();

	const doc = options.containerEl.ownerDocument;
	const newTaskBtn = doc.createElement("div");
	newTaskBtn.className = `bases-toolbar-item ${NEW_TASK_BUTTON_CLASS}`;

	const innerBtn = doc.createElement("button");
	innerBtn.className = "text-icon-button";
	innerBtn.type = "button";
	innerBtn.setAttribute("aria-label", options.label);

	const iconSpan = doc.createElement("span");
	iconSpan.className = "text-button-icon";
	setIcon(iconSpan, "plus");
	innerBtn.appendChild(iconSpan);

	const labelSpan = doc.createElement("span");
	labelSpan.className = "text-button-label";
	labelSpan.textContent = options.label;
	innerBtn.appendChild(labelSpan);

	newTaskBtn.appendChild(innerBtn);
	newTaskBtn.addEventListener("click", options.onClick);

	const originalNewBtn = toolbarEl.querySelector<HTMLElement>(".bases-toolbar-new-item-menu");
	if (originalNewBtn) {
		originalNewBtn.before(newTaskBtn);
	} else {
		toolbarEl.appendChild(newTaskBtn);
	}

	return "injected";
}
