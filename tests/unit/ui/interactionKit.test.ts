import { openListPicker } from "../../../src/ui/kit/listPicker";
import { placePopover, closeActivePopover } from "../../../src/ui/kit/popover";
import { renderKeyHint } from "../../../src/ui/kit/keyHint";

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

it("reveals Home and End options, including the free-value row, without writing", () => {
	const scroll = jest.fn();
	Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
	const anchor = document.body.createEl("button");
	const onChoose = jest.fn();
	const onCreate = jest.fn();
	const picker = openListPicker({ anchor, placeholder: "Tags", emptyText: "No matches",
		items: Array.from({ length: 30 }, (_, index) => ({ id: String(index), label: `Option ${index}` })),
		createLabel: query => `Create ${query}`, onChoose, onCreate });
	const input = picker.el.querySelector("input")!;
	input.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
	expect(picker.el.querySelector(".is-active")?.getAttribute("data-picker-id")).toBe("29");
	expect(scroll).toHaveBeenLastCalledWith({ block: "nearest" });
	input.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
	expect(picker.el.querySelector(".is-active")?.getAttribute("data-picker-id")).toBe("0");
	input.value = "Option";
	input.dispatchEvent(new Event("input"));
	input.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
	expect(picker.el.querySelector(".is-active")?.textContent).toContain("Create Option");
	expect(onChoose).not.toHaveBeenCalled();
	expect(onCreate).not.toHaveBeenCalled();
});

afterEach(() => {
	closeActivePopover();
	document.body.classList.remove("is-mobile");
	document.body.replaceChildren();
	jest.restoreAllMocks();
	if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
	else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

it("clamps help when neither side fits and flips bottom-anchored pickers above", () => {
	expect(placePopover({ left: 390, top: 300, bottom: 330 }, { width: 320, height: 700 }, { width: 400, height: 800 })).toEqual({ left: 72, top: 92 });
	expect(placePopover({ left: 16, top: 760, bottom: 790 }, { width: 320, height: 360 }, { width: 400, height: 800 })).toEqual({ left: 16, top: 396 });
});

it("checks and highlights the applied choice so an accidental Enter never writes", () => {
	Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() });
	const anchor = document.createElement("button");
	document.body.append(anchor);
	const onChoose = jest.fn();
	const picker = openListPicker({ anchor, placeholder: "Status", emptyText: "No matches", items: [
		{ id: "none", label: "None" },
		{ id: "current", label: "Current", selected: true },
	], onChoose });
	expect(picker.el.querySelector(".is-active.is-selected")?.getAttribute("data-picker-id")).toBe("current");
	expect(picker.el.querySelector(".is-selected .tn-picker__check")?.getAttribute("data-icon")).toBe("check");
	picker.el.querySelector("input")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
	expect(onChoose).not.toHaveBeenCalled();
	expect(picker.el.isConnected).toBe(false);
});

it("omits keycaps on mobile rather than leaving misleading desktop commands", () => {
	document.body.classList.add("is-mobile");
	const hint = renderKeyHint(document.body, "Mod+Enter");
	expect(hint.hidden).toBe(true);
	expect(hint.querySelectorAll("kbd")).toHaveLength(0);
});

it("restores a view root rather than a disconnected or inert row button", () => {
	Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() });
	const base = document.body.createDiv({ cls: "bases-view" });
	const root = base.createDiv({ cls: "tasknotes-plugin" });
	root.tabIndex = -1;
	const anchor = root.createEl("button");
	anchor.focus();
	const picker = openListPicker({ anchor, placeholder: "Status", emptyText: "No matches", items: [], onChoose: jest.fn() });
	anchor.remove();
	picker.close();
	expect(document.activeElement).toBe(root);
});
