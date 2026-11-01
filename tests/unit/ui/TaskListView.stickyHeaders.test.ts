import { App, MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskListView } from "../../../src/bases/TaskListView";
import { VirtualScroller } from "../../../src/utils/VirtualScroller";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

jest.mock("tasknotes-nlp-core", () => ({ NaturalLanguageParserCore: class {} }), { virtual: true });
jest.mock("../../../src/bases/groupTitleRenderer", () => ({
	renderGroupTitle: (container: HTMLElement, title: string) => { container.textContent = title; },
}));

function setup() {
	const container = document.body.createDiv();
	const view: any = new TaskListView({}, container, {
		app: new App(), fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
		settings: { fieldMapping: DEFAULT_FIELD_MAPPING },
	} as any);
	view.itemsContainer = container.createDiv();
	view.groupDisplayLabel = (title: string) => title;
	view.renderGroupTitle = (container: HTMLElement, title: string) => { container.textContent = title; };
	const primary = (key: string) => ({
		type: "primary-header", groupKey: key, groupTitle: key,
		taskCount: 10, groupEntries: [], isCollapsed: false,
	});
	view.lastVirtualItems = [primary("A"), {
		type: "sub-header", groupKey: "A", subGroupKey: "one", subGroupTitle: "One",
		parentKey: "A", taskCount: 5, isCollapsed: false,
	}, {
		type: "sub-header", groupKey: "A", subGroupKey: "two", subGroupTitle: "Two",
		parentKey: "A", taskCount: 5, isCollapsed: false,
	}, primary("B")];
	view.virtualStickyHeaderIndices = [0, 1, 2, 3];
	let scrollTop = 150;
	view.virtualScroller = { getScrollTop: () => scrollTop, getItemOffset: (index: number) => index * 100 };
	view.ensureVirtualStickyHeaderPin();
	return { view, scroll: (top: number) => { scrollTop = top; view.updateVirtualStickyHeader(); } };
}

describe("sticky grouped Task List headers", () => {
	beforeEach(() => { MockObsidian.reset(); document.body.innerHTML = ""; });

	it("keeps the parent above the active subgroup, and replaces both at a parent boundary", () => {
		const { view, scroll } = setup();
		scroll(150);
		expect(view.virtualStickyHeaderPin.querySelectorAll(".task-group")).toHaveLength(2);
		expect(view.virtualStickyHeaderPin.textContent).toContain("One");
		scroll(250);
		expect(view.virtualStickyHeaderPin.textContent).toContain("Two");
		expect(view.virtualStickyHeaderPin.textContent).not.toContain("One");
		scroll(350);
		expect(view.virtualStickyHeaderPin.querySelectorAll(".task-group")).toHaveLength(1);
		expect(view.virtualStickyHeaderPin.textContent).toContain("B");
		scroll(0);
		expect(view.virtualStickyHeaderPin.classList.contains("is-empty")).toBe(true);
	});

	it("refreshes same-key titles, counts and collapsed state without a duplicate tab stop", () => {
		const { view, scroll } = setup();
		scroll(150);
		view.lastVirtualItems[1] = { ...view.lastVirtualItems[1], subGroupTitle: "Renamed", taskCount: 3, isCollapsed: true };
		scroll(150);
		const pin: HTMLElement = view.virtualStickyHeaderPin;
		expect(pin.textContent).toContain("Renamed");
		expect(pin.textContent).toContain("(3)");
		expect(pin.querySelectorAll("button")[1].getAttribute("aria-expanded")).toBe("false");
		expect(pin.getAttribute("aria-hidden")).toBe("true");
		expect([...pin.querySelectorAll("button")].every(button => button.tabIndex === -1)).toBe(true);
	});

	it("subtracts the embedded list offset from a parent note's scroll position", () => {
		const scroller: any = Object.create(VirtualScroller.prototype);
		scroller.container = document.createElement("div");
		scroller.scrollContainer = document.createElement("div");
		scroller.scrollContainer.getBoundingClientRect = () => ({ top: 50 });
		scroller.container.getBoundingClientRect = () => ({ top: -125 });
		expect(scroller.getScrollTop()).toBe(175);
	});
});
