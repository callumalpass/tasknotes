import { TFile } from "obsidian";
import { createTaskClickHandler } from "../../../src/utils/clickHandlers";
import type TaskNotesPlugin from "../../../src/main";
import { TaskFactory } from "../../helpers/mock-factories";

function harness(onSelectionClick?: (event: MouseEvent) => boolean) {
	const task = TaskFactory.createTask({ path: "Tasks/Selection.md" });
	const openLinkText = jest.fn(), openTaskEditModal = jest.fn();
	const plugin = {
		app: { vault: { getAbstractFileByPath: () => new TFile() }, workspace: { openLinkText } },
		settings: { singleClickAction: "edit", doubleClickAction: "openNote" }, openTaskEditModal,
	} as unknown as TaskNotesPlugin;
	const el = document.createElement("div");
	const inner = el.appendChild(document.createElement("span"));
	const handlers = createTaskClickHandler({ task, plugin, onSelectionClick });
	el.addEventListener("click", handlers.clickHandler);
	return { el, inner, openLinkText, openTaskEditModal };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it.each(["ctrlKey", "metaKey", "shiftKey"])("lets the view consume %s before card navigation", key => {
	const consume = jest.fn(() => true);
	const h = harness(consume);
	const event = new MouseEvent("click", { bubbles: true, cancelable: true, [key]: true });
	h.inner.dispatchEvent(event); jest.runAllTimers();
	expect(consume).toHaveBeenCalledTimes(1);
	expect(event.defaultPrevented).toBe(true);
	expect(h.openLinkText).not.toHaveBeenCalled();
	expect(h.openTaskEditModal).not.toHaveBeenCalled();
});

it("cancels a pending ordinary click when the next click starts selection", () => {
	const h = harness(event => event.ctrlKey);
	h.inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	h.inner.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
	jest.runAllTimers(); expect(h.openTaskEditModal).not.toHaveBeenCalled();
});

it("keeps ordinary clicking and standalone Ctrl-click source navigation unchanged", async () => {
	const h = harness();
	h.inner.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
	jest.runAllTimers(); await Promise.resolve();
	expect(h.openLinkText).toHaveBeenCalledWith("Tasks/Selection.md", "", true);
	const normal = harness(() => false);
	normal.inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	jest.runAllTimers(); await Promise.resolve();
	expect(normal.openTaskEditModal).toHaveBeenCalledTimes(1);
});

it.each(["a", "button", "input", "select"])("does not hijack %s controls or links", tag => {
	const consume = jest.fn(() => true), h = harness(consume);
	const control = h.el.appendChild(document.createElement(tag));
	control.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
	jest.runAllTimers(); expect(consume).not.toHaveBeenCalled();
	expect(h.openLinkText).not.toHaveBeenCalled();
});
