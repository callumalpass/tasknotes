import { showToast, undoLatest, registerUndoKeyboard } from "../../../src/ui/kit/toast";

beforeEach(() => {
	jest.useFakeTimers();
	document.body.empty();
	Object.defineProperty(globalThis, "activeDocument", { configurable: true, value: document });
});
afterEach(() => jest.useRealTimers());

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
