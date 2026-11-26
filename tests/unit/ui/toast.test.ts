import { showToast, undoLatest, registerUndoKeyboard, UndoConflictError } from "../../../src/ui/kit/toast";

beforeEach(() => {
	jest.useFakeTimers();
	document.body.empty();
	Object.defineProperty(globalThis, "activeDocument", { configurable: true, value: document });
});
afterEach(() => jest.useRealTimers());

it("measures bottom phone navigation and clears its resize listener when dismissed", () => {
	document.body.classList.add("is-mobile");
	const nav = document.body.createDiv("mobile-navbar");
	let height = 60;
	jest.spyOn(nav, "getBoundingClientRect").mockImplementation(() => ({ top: innerHeight - height, bottom: innerHeight, height, width: 390 } as DOMRect));
	const removed = jest.spyOn(window, "removeEventListener");
	const toast = showToast({ message: "Updated" });
	const element = document.querySelector<HTMLElement>(".tn-toast")!;
	expect(element.style.getPropertyValue("--tn-toast-clearance")).toBe("60px");
	height = 80;
	window.dispatchEvent(new Event("resize"));
	expect(element.style.getPropertyValue("--tn-toast-clearance")).toBe("80px");
	toast.dismiss();
	expect(removed).toHaveBeenCalledWith("resize", expect.any(Function));
	removed.mockRestore();
	document.body.classList.remove("is-mobile");
});

it("separates result text from actions without leaving an empty action gutter", () => {
	showToast({ message: "1 task updated: Due date → Tomorrow", action: { label: "Undo", run: jest.fn() } });
	const toast = document.querySelector(".tn-toast")!;
	expect(toast.querySelector(".tn-toast__message")?.textContent).toBe("1 task updated: Due date → Tomorrow");
	expect(toast.querySelector(".tn-toast__actions")?.textContent).toBe("Undo");
	expect(toast.querySelector(".tn-toast__message button")).toBeNull();
	showToast({ message: "Task saved" });
	expect(document.querySelectorAll(".tn-toast")).toHaveLength(1);
	expect(document.querySelector(".tn-toast__actions")).toBeNull();
});

it("offers recovery without recording it as Undo or losing successful receipts", async () => {
	const scope = {};
	const undo = jest.fn();
	const recover = jest.fn();
	showToast({
		message: "One saved, one failed",
		intent: "error",
		undoScope: scope,
		action: { label: "Undo", run: undo },
		secondaryAction: { label: "Open task", run: recover },
	});
	const buttons = document.querySelectorAll<HTMLButtonElement>(".tn-toast__action");
	expect(Array.from(buttons, button => button.textContent)).toEqual(["Undo", "Open task"]);
	buttons[1].click();
	await jest.advanceTimersByTimeAsync(0);
	expect(recover).toHaveBeenCalledTimes(1);
	expect(undo).not.toHaveBeenCalled();
	await undoLatest(scope);
	expect(undo).toHaveBeenCalledTimes(1);
	expect(recover).toHaveBeenCalledTimes(1);
});

it("keeps an action pending and rejects duplicate clicks until it settles", async () => {
	let settle!: () => void;
	const held = new Promise<void>(resolve => { settle = resolve; });
	const run = jest.fn(() => held);
	showToast({ message: "Changed", action: { label: "Undo", run } });
	const button = document.querySelector<HTMLButtonElement>(".tn-toast__action")!;
	button.click();
	button.click();
	await Promise.resolve();
	expect(run).toHaveBeenCalledTimes(1);
	expect(button.disabled).toBe(true);
	expect(button.getAttribute("aria-busy")).toBe("true");
	button.closest(".tn-toast")!.dispatchEvent(new MouseEvent("mouseleave"));
	button.closest(".tn-toast")!.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
	await Promise.resolve();
	jest.advanceTimersByTime(10000);
	expect(button.isConnected).toBe(true);
	settle();
	await held;
	await jest.advanceTimersByTimeAsync(0);
	expect(document.querySelector(".tn-toast")).toBeNull();
});

it("keeps a rejected action reachable for retry", async () => {
	const run = jest.fn().mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce(undefined);
	showToast({ message: "Changed", action: { label: "Undo", run } });
	const button = document.querySelector<HTMLButtonElement>(".tn-toast__action")!;
	button.click();
	await jest.advanceTimersByTimeAsync(0);
	expect(button.disabled).toBe(false);
	expect(button.closest(".tn-toast")?.classList.contains("is-error")).toBe(true);
	expect(button.closest(".tn-toast")?.getAttribute("aria-live")).toBe("assertive");
	button.click();
	await jest.advanceTimersByTimeAsync(0);
	expect(run).toHaveBeenCalledTimes(2);
});

it("identifies the note that could not be restored", async () => {
	const scope = {};
	showToast({ message: "2 tasks updated", undoScope: scope, action: { label: "Undo", run: () => { throw new UndoConflictError(["Tasks/Alpha.md"]); } } });
	await undoLatest(scope);
	expect(document.querySelector(".tn-toast__message")?.textContent).toContain("Tasks/Alpha.md");
});

it("confirms the undone action without resurfacing an older action", async () => {
	const scope = {};
	const older = jest.fn();
	const latest = jest.fn();
	showToast({ message: "Older status change", undoScope: scope, action: { label: "Undo", run: older } });
	showToast({ message: "Priority → High · 3", undoMessage: "Undid priority change for 3 tasks", undoScope: scope, action: { label: "Undo", run: latest } });
	await undoLatest(scope);
	expect(latest).toHaveBeenCalledTimes(1);
	expect(document.querySelectorAll(".tn-toast")).toHaveLength(1);
	expect(document.querySelector(".tn-toast__message")?.textContent).toBe("Undid priority change for 3 tasks");
	expect(document.querySelector(".tn-toast__action")).toBeNull();
	expect(older).not.toHaveBeenCalled();
	await undoLatest(scope);
	expect(older).toHaveBeenCalledTimes(1);
	expect(document.querySelector(".tn-toast__message")?.textContent).toBe("Change undone.");
});

it("retains twenty entries per vault and serializes rapid keyboard requests", async () => {
	const vault = {};
	const otherVault = {};
	const restored: number[] = [];
	for (let index = 0; index < 25; index++)
		showToast({
			message: String(index),
			undoScope: vault,
			action: {
				label: "Undo",
				run: async () => {
					await Promise.resolve();
					restored.push(index);
				},
			},
		});
	const other = jest.fn();
	showToast({
		message: "Other vault",
		undoScope: otherVault,
		action: { label: "Undo", run: other },
	});
	await Promise.all(Array.from({ length: 25 }, () => undoLatest(vault)));
	expect(restored).toEqual(Array.from({ length: 20 }, (_, index) => 24 - index));
	expect(other).not.toHaveBeenCalled();
	await undoLatest(otherVault);
	expect(other).toHaveBeenCalledTimes(1);
});

it("keeps a rejected receipt available instead of skipping to an older change", async () => {
	const scope = {};
	const older = jest.fn();
	const guarded = jest
		.fn()
		.mockRejectedValueOnce(new Error("Changed"))
		.mockResolvedValueOnce(undefined);
	showToast({ message: "Older", undoScope: scope, action: { label: "Undo", run: older } });
	showToast({ message: "Latest", undoScope: scope, action: { label: "Undo", run: guarded } });
	await undoLatest(scope);
	expect(older).not.toHaveBeenCalled();
	await undoLatest(scope);
	await undoLatest(scope);
	expect(guarded).toHaveBeenCalledTimes(2);
	expect(older).toHaveBeenCalledTimes(1);
});

it("preserves specific failure feedback and the rejected Undo receipt", async () => {
	const scope = {};
	const restore = jest.fn().mockImplementationOnce(() => {
		showToast({ message: "Could not undo the recurring task change." });
		throw new Error("Write failed");
	}).mockResolvedValueOnce(undefined);
	showToast({ message: "Completion", undoScope: scope, action: { label: "Undo", run: restore } });
	await undoLatest(scope);
	expect(document.querySelector(".tn-toast__message")?.textContent).toBe("Could not undo the recurring task change.");
	await undoLatest(scope);
	expect(restore).toHaveBeenCalledTimes(2);
});

it("does not remove a newer entry when an in-flight Undo is evicted from the bounded history", async () => {
	const scope = {};
	let release!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	showToast({ message: "Earlier", undoScope: scope, action: { label: "Undo", run: () => held } });
	const pending = undoLatest(scope);
	await Promise.resolve();
	const restored: number[] = [];
	for (let index = 0; index < 25; index++) showToast({ message: String(index), undoScope: scope, action: { label: "Undo", run: () => { restored.push(index); } } });
	release();
	await pending;
	expect(document.querySelector('.tn-toast__message')?.textContent).toBe('24');
	await Promise.all(Array.from({ length: 20 }, () => undoLatest(scope)));
	expect(restored).toEqual(Array.from({ length: 20 }, (_, index) => 24 - index));
});

it("pauses dismissal while hovered or keyboard-focused", () => {
	showToast({ message: "Changed", action: { label: "Undo", run: jest.fn() }, durationMs: 5000 });
	const toast = document.querySelector<HTMLElement>(".tn-toast")!;
	jest.advanceTimersByTime(2000);
	toast.dispatchEvent(new MouseEvent("mouseenter"));
	jest.advanceTimersByTime(10000);
	expect(toast.isConnected).toBe(true);
	toast.dispatchEvent(new MouseEvent("mouseleave"));
	jest.advanceTimersByTime(2999);
	expect(toast.isConnected).toBe(true);
	jest.advanceTimersByTime(1);
	expect(toast.isConnected).toBe(false);
	showToast({ message: "Changed", action: { label: "Undo", run: jest.fn() } });
	document.querySelector<HTMLButtonElement>(".tn-toast__action")!.focus();
	jest.advanceTimersByTime(10000);
	expect(document.querySelector(".tn-toast")).not.toBeNull();
});

it("returns focus to the task view when a focused toast is replaced", () => {
	const root = document.body.createDiv({ cls: "tn-tasknotesKanban" });
	root.tabIndex = -1;
	root.focus();
	showToast({ message: "Moved", action: { label: "Undo", run: jest.fn() } });
	document.querySelector<HTMLButtonElement>(".tn-toast__action")!.focus();
	showToast({ message: "Change undone." });
	expect(document.activeElement).toBe(root);
	expect(document.querySelector(".tn-toast__message")?.textContent).toBe("Change undone.");
});

it("does not move focus when an unfocused toast is replaced", () => {
	const input = document.body.createEl("input");
	showToast({ message: "Moved", action: { label: "Undo", run: jest.fn() } });
	input.focus();
	showToast({ message: "Another change" });
	expect(document.activeElement).toBe(input);
});

it("leaves native input and editor undo alone and restores mouse focus to the task view", async () => {
	const scope = {};
	const root = document.body.createDiv({ cls: "tn-tasknotesTaskList" });
	root.tabIndex = -1;
	const input = root.createEl("input");
	const restore = jest.fn();
	const dispose = registerUndoKeyboard(root, scope);
	root.focus();
	showToast({ message: "Changed", undoScope: scope, action: { label: "Undo", run: restore } });
	input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
	await Promise.resolve();
	expect(restore).not.toHaveBeenCalled();
	document.querySelector<HTMLButtonElement>(".tn-toast__action")!.click();
	await undoLatest({});
	await Promise.resolve();
	await Promise.resolve();
	expect(restore).toHaveBeenCalledTimes(1);
	expect(document.activeElement).toBe(root);
	dispose();
});

it("handles inline task controls inside an editor without intercepting typing Undo", async () => {
	const scope = {};
	const editor = document.body.createDiv({ cls: "cm-editor" });
	editor.setAttribute("contenteditable", "true");
	const card = editor.createDiv({ cls: "task-card--layout-inline" });
	const control = card.createSpan();
	control.setAttribute("role", "button");
	const restore = jest.fn();
	const dispose = registerUndoKeyboard(document.body, scope);
	showToast({ message: "Changed", undoScope: scope, action: { label: "Undo", run: restore } });
	const typingUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	editor.dispatchEvent(typingUndo);
	await Promise.resolve();
	expect(typingUndo.defaultPrevented).toBe(false);
	expect(restore).not.toHaveBeenCalled();
	const taskUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	control.dispatchEvent(taskUndo);
	await Promise.resolve();
	await Promise.resolve();
	expect(taskUndo.defaultPrevented).toBe(true);
	expect(restore).toHaveBeenCalledTimes(1);
	dispose();
});

it("leaves Ctrl/Cmd+Z untouched in non-TaskNotes views such as Excalidraw or native Bases tables", async () => {
	const scope = {};
	const restore = jest.fn();
	const dispose = registerUndoKeyboard(document.body, scope);
	showToast({ message: "Rescheduled", undoScope: scope, action: { label: "Undo", run: restore } });

	// Inactive TaskNotes Calendar pane alongside an active Excalidraw pane.
	const calendarLeaf = document.body.createDiv({ cls: "workspace-leaf" });
	const calendarContent = calendarLeaf.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "bases" } });
	calendarContent.createDiv({ cls: "view-content" }).createDiv({ cls: "bases-view", attr: { "data-tn-view": "tasknotesCalendar" } });

	const excalidrawLeaf = document.body.createDiv({ cls: "workspace-leaf mod-active" });
	const excalidrawContent = excalidrawLeaf.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "excalidraw" } });
	const canvas = excalidrawContent.createDiv({ cls: "excalidraw" }).createEl("canvas");
	let canvasReceived = false;
	canvas.addEventListener("keydown", (event) => {
		if (!event.defaultPrevented) canvasReceived = true;
	});

	const canvasUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	canvas.dispatchEvent(canvasUndo);
	await Promise.resolve();
	expect(canvasUndo.defaultPrevented).toBe(false);
	expect(canvasReceived).toBe(true);
	expect(restore).not.toHaveBeenCalled();

	// Also untouched when focus falls back to document.body while Excalidraw is active.
	const bodyUndo = new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true, cancelable: true });
	document.body.dispatchEvent(bodyUndo);
	await Promise.resolve();
	expect(bodyUndo.defaultPrevented).toBe(false);
	expect(restore).not.toHaveBeenCalled();

	// Also untouched in a native Bases table leaf (data-type="bases" without a TaskNotes view).
	excalidrawLeaf.removeClass("mod-active");
	const tableLeaf = document.body.createDiv({ cls: "workspace-leaf mod-active" });
	const tableContent = tableLeaf.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "bases" } });
	const tableCell = tableContent.createDiv({ cls: "view-content" }).createDiv({ cls: "bases-view" }).createDiv({ cls: "bases-table" });
	const tableUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	tableCell.dispatchEvent(tableUndo);
	await Promise.resolve();
	expect(tableUndo.defaultPrevented).toBe(false);
	expect(restore).not.toHaveBeenCalled();

	// Focusing the undo toast itself still triggers TaskNotes undo even when another leaf is active.
	const toastButton = document.querySelector<HTMLButtonElement>(".tn-toast__action")!;
	const toastUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	toastButton.dispatchEvent(toastUndo);
	await Promise.resolve();
	await Promise.resolve();
	expect(toastUndo.defaultPrevented).toBe(true);
	expect(restore).toHaveBeenCalledTimes(1);
	dispose();
});

it("handles Ctrl/Cmd+Z when a TaskNotes view is active or focused, but backs off for modals and markdown embeds", async () => {
	const scope = {};
	const restore = jest.fn();
	const dispose = registerUndoKeyboard(document.body, scope);
	for (let i = 0; i < 4; i++) {
		showToast({ message: `Change ${i}`, undoScope: scope, action: { label: "Undo", run: restore } });
	}

	// Active TaskNotes Calendar leaf with focus on document.body (e.g. after mouse drag).
	const calendarLeaf = document.body.createDiv({ cls: "workspace-leaf mod-active" });
	const calendarContent = calendarLeaf.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "bases" } });
	calendarContent.createDiv({ cls: "view-content" }).createDiv({ cls: "bases-view", attr: { "data-tn-view": "tasknotesCalendar" } });

	const dragUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	document.body.dispatchEvent(dragUndo);
	await Promise.resolve();
	await Promise.resolve();
	expect(dragUndo.defaultPrevented).toBe(true);
	expect(restore).toHaveBeenCalledTimes(1);

	// Modal open over active TaskNotes leaf must not trigger TaskNotes undo.
	const modal = document.body.createDiv({ cls: "modal-container" });
	const modalButton = modal.createEl("button");
	const modalUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	modalButton.dispatchEvent(modalUndo);
	await Promise.resolve();
	expect(modalUndo.defaultPrevented).toBe(false);
	expect(restore).toHaveBeenCalledTimes(1);
	modal.remove();

	// Active Pomodoro view leaf triggers TaskNotes undo.
	calendarLeaf.removeClass("mod-active");
	const pomodoroLeaf = document.body.createDiv({ cls: "workspace-leaf mod-active" });
	pomodoroLeaf.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "tasknotes-pomodoro-view" } })
		.createDiv({ cls: "view-content" })
		.createDiv({ cls: "tasknotes-plugin pomodoro-view" });
	const pomodoroUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	document.body.dispatchEvent(pomodoroUndo);
	await Promise.resolve();
	await Promise.resolve();
	expect(pomodoroUndo.defaultPrevented).toBe(true);
	expect(restore).toHaveBeenCalledTimes(2);

	// Markdown leaf containing an embedded TaskNotes relationships widget:
	// reading-view focus outside the widget is left alone; focus inside the widget triggers undo.
	pomodoroLeaf.removeClass("mod-active");
	const mdLeaf = document.body.createDiv({ cls: "workspace-leaf mod-active" });
	const mdView = mdLeaf.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "markdown" } }).createDiv({ cls: "view-content" });
	const readingText = mdView.createDiv({ cls: "markdown-preview-view" });
	const widget = mdView.createDiv({ cls: "tasknotes-plugin tasknotes-relationships-widget" });
	const widgetCard = widget.createDiv({ cls: "task-card" });

	const mdUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	readingText.dispatchEvent(mdUndo);
	await Promise.resolve();
	expect(mdUndo.defaultPrevented).toBe(false);
	expect(restore).toHaveBeenCalledTimes(2);

	const widgetUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	widgetCard.dispatchEvent(widgetUndo);
	await Promise.resolve();
	await Promise.resolve();
	expect(widgetUndo.defaultPrevented).toBe(true);
	expect(restore).toHaveBeenCalledTimes(3);

	dispose();
});

it("allows body-level Ctrl+Z immediately after an inline card change only while its toast stays on that leaf", async () => {
	const scope = {};
	const restore = jest.fn();
	const dispose = registerUndoKeyboard(document.body, scope);

	const mdLeaf = document.body.createDiv({ cls: "workspace-leaf mod-active" });
	const mdView = mdLeaf.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "markdown" } }).createDiv({ cls: "view-content" });
	mdView.createDiv({ cls: "task-card--layout-inline" });

	const otherLeaf = document.body.createDiv({ cls: "workspace-leaf" });
	otherLeaf.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "excalidraw" } });

	showToast({ message: "Status changed", undoScope: scope, action: { label: "Undo", run: restore } });

	// Switching away to Excalidraw while toast is still visible must leave Ctrl+Z untouched.
	mdLeaf.removeClass("mod-active");
	otherLeaf.addClass("mod-active");
	const otherUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	document.body.dispatchEvent(otherUndo);
	await Promise.resolve();
	expect(otherUndo.defaultPrevented).toBe(false);
	expect(restore).not.toHaveBeenCalled();

	// Returning to the origin markdown leaf while toast is still visible allows body-level Ctrl+Z.
	otherLeaf.removeClass("mod-active");
	mdLeaf.addClass("mod-active");
	const inlineUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	document.body.dispatchEvent(inlineUndo);
	await Promise.resolve();
	await Promise.resolve();
	expect(inlineUndo.defaultPrevented).toBe(true);
	expect(restore).toHaveBeenCalledTimes(1);

	// After the toast dismisses, body-level Ctrl+Z in the markdown leaf is left untouched.
	const secondToast = showToast({ message: "Status changed again", undoScope: scope, action: { label: "Undo", run: restore } });
	secondToast.dismiss();
	const lateUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	document.body.dispatchEvent(lateUndo);
	await Promise.resolve();
	expect(lateUndo.defaultPrevented).toBe(false);
	expect(restore).toHaveBeenCalledTimes(1);

	// Switching a Bases leaf from a TaskNotes view to a native table while toast is visible must NOT fire.
	mdLeaf.removeClass("mod-active");
	const basesLeaf = document.body.createDiv({ cls: "workspace-leaf mod-active" });
	const basesView = basesLeaf
		.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "bases" } })
		.createDiv({ cls: "view-content" })
		.createDiv({ cls: "bases-view", attr: { "data-tn-view": "tasknotesTaskList" } });
	showToast({ message: "Moved", undoScope: scope, action: { label: "Undo", run: restore } });
	basesView.removeAttribute("data-tn-view");
	const switchedBasesUndo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
	document.body.dispatchEvent(switchedBasesUndo);
	await Promise.resolve();
	expect(switchedBasesUndo.defaultPrevented).toBe(false);
	expect(restore).toHaveBeenCalledTimes(1);

	dispose();
});
