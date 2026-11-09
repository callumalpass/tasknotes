import { setIcon } from "obsidian";
import { createElementInDocument } from "../utils/documentDom";
import { renderKeyHint } from "../ui/kit/keyHint";
import { msg } from "@lingui/core/macro";
import { uiText } from "../i18n/runtime";
import { openPopover, type PopoverHandle } from "../ui/kit/popover";

export type BasesNewTaskButtonInjectionResult =
	| "injected"
	| "missing-bases-view"
	| "missing-parent"
	| "missing-toolbar";

export type InjectBasesNewTaskButtonOptions = {
	containerEl: HTMLElement;
	label: string;
	keyHint?: string;
	onClick: (event: MouseEvent) => void;
};

const TASKNOTES_VIEW_ACTIVE_CLASS = "tasknotes-view-active";
const NEW_TASK_BUTTON_CLASS = "tn-bases-new-task-btn";
const toolbarDisposers = new WeakMap<Element, () => void>();

function installToolbarOverflow(toolbar: Element, newTask: HTMLElement): void {
	toolbarDisposers.get(toolbar)?.();
	const hadTokens = toolbar.classList.contains("tasknotes-plugin");
	toolbar.classList.add("tasknotes-plugin");
	const doc = newTask.ownerDocument;
	const more = createElementInDocument(doc, "button");
	more.className = "tn-bases-toolbar-more clickable-icon";
	more.type = "button";
	const label = uiText(msg({ message: "More actions", context: "modals.task.buttons.moreActions" }));
	more.setAttribute("aria-label", label);
	more.setAttribute("aria-expanded", "false");
	more.setAttribute("aria-haspopup", "dialog");
	setIcon(more, "ellipsis");
	newTask.before(more);
	let popover: PopoverHandle | null = null;
	let restore: (() => void) | undefined;
	more.addEventListener("click", () => {
		if (popover) { popover.close(); return; }
		const controls = [...toolbar.querySelectorAll<HTMLElement>(":scope > :is(.bases-toolbar-results-menu, .bases-toolbar-sort-menu, .bases-toolbar-filter-menu, .bases-toolbar-properties-menu, .bases-toolbar-search, .tn-shortcut-help)")];
		const places = controls.map(element => {
			const place = doc.createComment("");
			element.before(place);
			return { element, place };
		});
		restore = () => {
			for (const { element, place } of places) place.replaceWith(element);
			popover = null;
			more.setAttribute("aria-expanded", "false");
		};
		popover = openPopover({ anchor: more, className: "tn-bases-toolbar-overflow-panel", onClose: () => restore?.() });
		popover.el.setAttribute("role", "dialog");
		popover.el.setAttribute("aria-label", label);
		popover.el.append(...controls);
		more.setAttribute("aria-expanded", "true");
		popover.reposition();
		const first = controls[0];
		(first?.querySelector<HTMLElement>("button, input, [tabindex='0']") ?? first)?.focus();
	});
	const resize = new ResizeObserver(() => { if (popover && more.getBoundingClientRect().width === 0) popover.close(); });
	resize.observe(toolbar);
	toolbarDisposers.set(toolbar, () => {
		popover?.close();
		resize.disconnect();
		more.remove();
		if (!hadTokens) toolbar.classList.remove("tasknotes-plugin");
	});
}

export function cleanupBasesNewTaskButton(containerEl: HTMLElement): void {
	const basesViewEl = containerEl.closest(".bases-view");
	const parentEl = basesViewEl?.parentElement;

	parentEl?.querySelector(`.${NEW_TASK_BUTTON_CLASS}`)?.remove();
	const toolbar = parentEl?.querySelector(".bases-toolbar");
	if (toolbar) { toolbarDisposers.get(toolbar)?.(); toolbarDisposers.delete(toolbar); }
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
	const newTaskBtn = createElementInDocument(doc, "div");
	newTaskBtn.className = `tasknotes-plugin bases-toolbar-item ${NEW_TASK_BUTTON_CLASS}`;

	const innerBtn = createElementInDocument(doc, "button");
	innerBtn.className = "text-icon-button tn-btn tn-btn--ghost";
	innerBtn.type = "button";
	innerBtn.setAttribute("aria-label", options.label);

	const iconSpan = createElementInDocument(doc, "span");
	iconSpan.className = "text-button-icon";
	setIcon(iconSpan, "plus");
	innerBtn.appendChild(iconSpan);

	const labelSpan = createElementInDocument(doc, "span");
	labelSpan.className = "text-button-label";
	labelSpan.textContent = options.label;
	innerBtn.appendChild(labelSpan);
	if (options.keyHint) renderKeyHint(innerBtn, options.keyHint);

	newTaskBtn.appendChild(innerBtn);
	newTaskBtn.addEventListener("click", options.onClick);

	const originalNewBtn = toolbarEl.querySelector<HTMLElement>(".bases-toolbar-new-item-menu");
	if (originalNewBtn) {
		originalNewBtn.before(newTaskBtn);
	} else {
		toolbarEl.appendChild(newTaskBtn);
	}
	installToolbarOverflow(toolbarEl, newTaskBtn);

	return "injected";
}
