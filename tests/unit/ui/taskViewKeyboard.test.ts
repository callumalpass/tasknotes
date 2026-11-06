import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { installTaskViewKeyboard } from "../../../src/ui/taskViewKeyboard";
import { openTaskPropertyPicker } from "../../../src/ui/taskPropertyPickers";

jest.mock("../../../src/ui/taskPropertyPickers", () => ({
	openTaskPropertyPicker: jest.fn(),
	taskPropertyLabel: (property: string) => property,
	archiveTasksWithUndo: jest.fn(),
}));

function harness() {
	const root = document.body.createDiv();
	root.tabIndex = 0;
	for (const path of ["first.md", "second.md"]) {
		const card = root.createDiv({ cls: "task-card" });
		card.dataset.taskPath = path;
		card.createEl("button", { cls: "task-card__status-dot" });
		card.createEl("button", { cls: "task-card__priority-dot" });
	}
	const plugin = {
		app: { scope: {}, keymap: { pushScope: jest.fn(), popScope: jest.fn() } },
		taskSelectionService: { getSelectedPaths: () => [], getSelectionCount: () => 0 },
		emitter: { on: jest.fn(), offref: jest.fn() },
	} as unknown as TaskNotesPlugin;
	const dispose = installTaskViewKeyboard({
		plugin, root, paths: () => ["first.md", "second.md"],
		taskForPath: async path => ({ path, title: path, status: "open", priority: "normal" }) as TaskInfo,
		reveal: jest.fn(), create: jest.fn(), search: jest.fn(), refreshSelection: jest.fn(),
	});
	const first = root.querySelector<HTMLElement>('[data-task-path="first.md"]')!;
	return { root, first, dispose, keymap: plugin.app.keymap };
}

afterEach(() => { document.body.replaceChildren(); jest.clearAllMocks(); });

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
		expect(openTaskPropertyPicker).toHaveBeenCalledWith(expect.anything(), "priority", [expect.objectContaining({ path: "first.md" })], replacement);
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
