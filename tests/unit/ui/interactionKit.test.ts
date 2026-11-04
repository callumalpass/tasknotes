import { openListPicker } from "../../../src/ui/kit/listPicker";
import { placePopover, closeActivePopover } from "../../../src/ui/kit/popover";
import { renderKeyHint } from "../../../src/ui/kit/keyHint";

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

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
