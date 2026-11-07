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
	jest.spyOn(nav, "getBoundingClientRect").mockImplementation(() => ({ top: innerHeight - height, bottom: innerHeight, height } as DOMRect));
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
