import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { installTaskViewKeyboard, revealTaskViewCard } from "../../../src/ui/taskViewKeyboard";
import { openTaskPropertyPicker } from "../../../src/ui/taskPropertyPickers";
import { resolveTaskListKeyboardAction } from "../../../src/bases/taskListKeyboardActions";
import { showCoordinatedMenu } from "../../../src/components/ContextMenuCoordinator";
import type { TaskViewKeyboardOptions } from "../../../src/ui/taskViewKeyboard";

jest.mock("../../../src/ui/taskPropertyPickers", () => ({
	openTaskPropertyPicker: jest.fn(),
	taskPropertyLabel: (property: string) => property,
	archiveTasksWithUndo: jest.fn(),
}));

beforeEach(() => {
	HTMLElement.prototype.scrollIntoView = jest.fn();
});

function harness(selectOnHover = false, resolveTaskShortcut?: TaskViewKeyboardOptions["resolveTaskShortcut"], selectedCount = 0) {
	const root = document.body.createDiv();
	root.tabIndex = 0;
	for (const path of ["first.md", "second.md"]) {
		const card = root.createDiv({ cls: "task-card" });
		card.dataset.taskPath = path;
		card.createEl("button", { cls: "task-card__status-dot" });
		card.createEl("button", { cls: "task-card__priority-dot" });
	}
	const toggleSelection = jest.fn();
	const clearSelection = jest.fn();
	const reveal = jest.fn();
	const plugin = {
		app: { scope: {}, keymap: { pushScope: jest.fn(), popScope: jest.fn() } },
		taskSelectionService: { getSelectedPaths: () => [], getSelectionCount: () => selectedCount, toggleSelection, clearSelection, exitSelectionMode: jest.fn() },
		emitter: { on: jest.fn(), offref: jest.fn() },
	} as unknown as TaskNotesPlugin;
	const dispose = installTaskViewKeyboard({
		plugin, root, paths: () => ["first.md", "second.md"],
		selectOnHover,
		resolveTaskShortcut,
		taskForPath: async path => ({ path, title: path, status: "open", priority: "normal" }) as TaskInfo,
		reveal, create: jest.fn(), search: jest.fn(), refreshSelection: jest.fn(),
	});
	const first = root.querySelector<HTMLElement>('[data-task-path="first.md"]')!;
	return { root, first, dispose, toggleSelection, clearSelection, reveal, keymap: plugin.app.keymap };
}

afterEach(() => { document.body.replaceChildren(); jest.clearAllMocks(); });

it("moves task focus with End and Home and clears selection with Backspace in the installed view", () => {
	const state = harness(false, undefined, 2);
	const second = state.root.querySelector('[data-task-path="second.md"]')!;
	try {
		state.root.focus();
		for (const [key, card, path] of [["End", second, "second.md"], ["Home", state.first, "first.md"]] as const) {
			const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
			state.root.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
			expect(state.reveal).toHaveBeenLastCalledWith(path);
			expect(state.root.querySelector(".tn-task-focused")).toBe(card);
		}
		state.root.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
		expect(state.clearSelection).toHaveBeenCalledTimes(1);
	} finally { state.dispose(); }
});

it.each([
	["+", { shiftKey: true }, "add-project"],
	["@", { shiftKey: true }, "add-context"],
	["#", { shiftKey: true }, "add-tags"],
	["Delete", { ctrlKey: true }, "delete-tasks"],
	["M", { shiftKey: true }, "mark-complete"],
	["T", { shiftKey: true }, "edit-time-estimate"],
] as const)("dispatches %s through the installed task view handler", (key, modifiers, expectedAction) => {
	const dispatch = jest.fn(async (_action: string, _path: string) => {});
	const state = harness(false, (event) => {
		const action = resolveTaskListKeyboardAction(event);
		return action ? (path) => dispatch(action, path) : undefined;
	});
	const reachedView = jest.fn();
	state.root.addEventListener("keydown", reachedView, { capture: true });
	try {
		const control = key === "Delete"
			? state.first.createEl("input", { cls: "task-card__selection-checkbox", type: "checkbox" })
			: state.first.querySelector<HTMLElement>("button")!;
		control.focus();
		const event = new KeyboardEvent("keydown", { key, ...modifiers, bubbles: true, cancelable: true });
		control.dispatchEvent(event);
		expect(reachedView).toHaveBeenCalledWith(event);
		expect(event.defaultPrevented).toBe(true);
		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch).toHaveBeenCalledWith(expectedAction, "first.md");
	} finally {
		state.dispose();
	}
});

it("toggles the task under the pointer through the installed keyboard handler", () => {
	const state = harness(true);
	const second = state.root.querySelector<HTMLElement>('[data-task-path="second.md"]')!;
	const originalHitTest = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
	Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => second });
	try {
		const control = state.first.querySelector<HTMLElement>("button")!;
		control.focus();
		second.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 30, clientY: 60 }));
		control.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true, cancelable: true }));
		expect(state.toggleSelection).toHaveBeenCalledTimes(1);
		expect(state.toggleSelection).toHaveBeenCalledWith("second.md");
	} finally {
		if (originalHitTest) Object.defineProperty(document, "elementFromPoint", originalHitTest);
		else Reflect.deleteProperty(document, "elementFromPoint");
		state.dispose();
	}
});

it("reveals the whole target below stacked sticky headers using their live bounds", () => {
	const root = document.body.createDiv();
	root.style.overflowY = "auto";
	Object.defineProperties(root, { scrollHeight: { value: 1000 }, clientHeight: { value: 400 } });
	root.scrollTop = 200;
	root.getBoundingClientRect = () => ({ top: 100, bottom: 500 }) as DOMRect;
	const pin = root.createDiv({ cls: "task-list-virtual-sticky-header" });
	for (const [top, bottom] of [[100, 140], [140, 172]]) {
		const header = pin.createDiv({ cls: "task-list-virtual-sticky-header__group" });
		header.getBoundingClientRect = () => ({ top, bottom, height: bottom - top, left: 0, right: 400 }) as DOMRect;
	}
	const card = root.createDiv({ cls: "task-card" });
	card.getBoundingClientRect = () => ({ top: 130, bottom: 188, left: 0, right: 400 }) as DOMRect;
	revealTaskViewCard(card, root);
	expect(root.scrollTop).toBe(158);
});

it("does not scroll for a sticky header in a neighbouring board column", () => {
	const root = document.body.createDiv();
	root.style.overflowY = "auto";
	Object.defineProperties(root, { scrollHeight: { value: 1000 }, clientHeight: { value: 400 } });
	root.scrollTop = 200;
	root.getBoundingClientRect = () => ({ top: 100, bottom: 500 }) as DOMRect;
	const header = root.createDiv({ cls: "kanban-view__column-header" });
	header.style.position = "sticky";
	header.getBoundingClientRect = () => ({ top: 100, bottom: 150, height: 50, left: 500, right: 800 }) as DOMRect;
	const card = root.createDiv({ cls: "task-card" });
	card.getBoundingClientRect = () => ({ top: 130, bottom: 188, left: 0, right: 400 }) as DOMRect;
	revealTaskViewCard(card, root);
	expect(root.scrollTop).toBe(200);
});

it("releases the view scope synchronously when a modal begins opening", () => {
	const state = harness();
	try {
		state.first.querySelector<HTMLElement>("button")!.focus();
		expect(state.keymap.pushScope).toHaveBeenCalled();
		document.dispatchEvent(new Event("tn-modal-opening"));
		expect(state.keymap.popScope).toHaveBeenCalled();
		jest.mocked(state.keymap.pushScope).mockClear();
		document.body.createDiv({ cls: "modal-container" });
		state.root.focus();
		expect(state.keymap.pushScope).not.toHaveBeenCalled();
	} finally { state.dispose(); }
});

it("does not open a live picker while an unfocused modal is loading", async () => {
	const state = harness();
	try {
		const control = state.first.querySelector<HTMLElement>("button")!;
		control.focus();
		document.body.createDiv({ cls: "modal-container" });
		control.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true, cancelable: true }));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(openTaskPropertyPicker).not.toHaveBeenCalled();
	} finally { state.dispose(); }
});

it("abandons an in-flight view action when a modal opens during task resolution", async () => {
	const state = harness();
	try {
		const control = state.first.querySelector<HTMLElement>("button")!;
		control.focus();
		control.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true, cancelable: true }));
		document.body.createDiv({ cls: "modal-container" });
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(openTaskPropertyPicker).not.toHaveBeenCalled();
	} finally { state.dispose(); }
});

it("keeps native menu keyboard ownership when a refreshed task control regains focus", async () => {
	const state = harness();
	try {
		state.first.querySelector<HTMLElement>("button")!.focus();
		jest.mocked(state.keymap.pushScope).mockClear();
		const menu = document.body.createDiv({ cls: "menu" });
		state.first.replaceWith(state.first.cloneNode(true));
		await Promise.resolve();
		expect(jest.mocked(state.keymap.pushScope).mock.calls.length).toBe(0);
		menu.remove();
		state.root.focus();
		expect(state.keymap.pushScope).toHaveBeenCalledTimes(1);
	} finally {
		state.dispose();
	}
});

it.each(["ArrowDown", "p", "Escape"])("defers %s to an open native menu while its trigger retains focus", async key => {
	const state = harness();
	const received = jest.fn();
	document.addEventListener("keydown", received);
	try {
		const control = state.first.querySelector<HTMLElement>("button")!;
		control.focus();
		document.body.createDiv({ cls: "menu" });
		const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
		control.dispatchEvent(event);
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(event.defaultPrevented).toBe(false);
		expect(received).toHaveBeenCalledWith(event);
		expect(document.activeElement).toBe(control);
		expect(openTaskPropertyPicker).not.toHaveBeenCalled();
	} finally {
		document.removeEventListener("keydown", received);
		state.dispose();
	}
});

it("preserves selection when Obsidian hides a task menu before the view handles Escape", async () => {
	const state = harness(false, undefined, 2);
	const control = state.first.querySelector<HTMLElement>("button")!;
	const callbacks: Array<() => void> = [];
	const menu = {
		onHide: (callback: () => void) => callbacks.push(callback),
		hide: () => callbacks.forEach((callback) => callback()),
		showAtMouseEvent: jest.fn(),
		showAtPosition: jest.fn(),
	};
	const hideBeforeView = (event: KeyboardEvent) => {
		if (event.key === "Escape") menu.hide();
	};
	try {
		showCoordinatedMenu(menu, new MouseEvent("contextmenu"));
		control.focus();
		document.addEventListener("keydown", hideBeforeView, true);
		const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
		control.dispatchEvent(event);
		expect(state.clearSelection).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
		await Promise.resolve();
		const nextEscape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
		control.dispatchEvent(nextEscape);
		expect(state.clearSelection).toHaveBeenCalledTimes(1);
	} finally {
		document.removeEventListener("keydown", hideBeforeView, true);
		state.dispose();
	}
});

it.each(["status", "priority"])("retains the %s control and task identity when its row is replaced", async property => {
	const state = harness();
	try {
		state.first.querySelector<HTMLElement>(`.task-card__${property}-dot`)!.focus();
		const replacement = state.first.cloneNode(true) as HTMLElement;
		state.first.replaceWith(replacement);
		await Promise.resolve();
		expect(document.activeElement).toBe(replacement.querySelector(`.task-card__${property}-dot`));
		document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(openTaskPropertyPicker).toHaveBeenCalledWith(expect.anything(), "priority", [expect.objectContaining({ path: "first.md" })], replacement.querySelector(".task-card__status-dot"));
	} finally { state.dispose(); }
});

it("does not steal focus from an outside control during a row refresh", async () => {
	const state = harness();
	try {
		state.first.querySelector<HTMLElement>("button")!.focus();
		const outside = document.body.createEl("button");
		outside.focus();
		state.first.replaceWith(state.first.cloneNode(true));
		await Promise.resolve();
		expect(document.activeElement).toBe(outside);
	} finally { state.dispose(); }
});

it("retains pointer-focused controls when a native focusout precedes their removal", async () => {
	const state = harness();
	try {
		const control = state.first.querySelector<HTMLElement>("button")!;
		control.dispatchEvent(new Event("pointerdown", { bubbles: true }));
		control.focus();
		control.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
		const replacement = state.first.cloneNode(true) as HTMLElement;
		state.first.replaceWith(replacement);
		await Promise.resolve();
		expect(document.activeElement).toBe(replacement.querySelector("button"));
	} finally { state.dispose(); }
});

it("does not replace intentional view-root focus with a child control", async () => {
	const state = harness();
	try {
		state.first.querySelector<HTMLElement>("button")!.focus();
		state.root.focus();
		state.first.replaceWith(state.first.cloneNode(true));
		await Promise.resolve();
		expect(document.activeElement).toBe(state.root);
	} finally { state.dispose(); }
});

it("falls back to the view rather than choosing an ambiguous replacement control", async () => {
	const state = harness();
	try {
		state.first.querySelector<HTMLElement>("button")!.focus();
		const replacement = state.first.cloneNode(true) as HTMLElement;
		replacement.createEl("button", { cls: "task-card__status-dot" });
		state.first.replaceWith(replacement);
		await Promise.resolve();
		expect(document.activeElement).toBe(state.root);
	} finally { state.dispose(); }
});

it("retains date-field identity rather than picking another date control", async () => {
	const state = harness();
	try {
		for (const field of ["scheduled", "due"]) {
			const date = state.first.createEl("button", { cls: "task-card__metadata-date" });
			date.dataset.tnDateType = field;
		}
		state.first.querySelector<HTMLElement>('[data-tn-date-type="due"]')!.focus();
		const replacement = state.first.cloneNode(true) as HTMLElement;
		state.first.replaceWith(replacement);
		await Promise.resolve();
		expect(document.activeElement).toBe(replacement.querySelector('[data-tn-date-type="due"]'));
	} finally { state.dispose(); }
});
