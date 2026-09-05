import type { Menu } from "obsidian";
import {
	closeActiveContextMenu,
	getContextMenuTrigger,
	showCoordinatedMenu,
	showCoordinatedMenuAtElement,
} from "../../../src/components/ContextMenuCoordinator";

interface MockMenu {
	showAtMouseEvent: jest.Mock;
	showAtPosition: jest.Mock;
	hide: jest.Mock;
	onHide: jest.Mock;
	hideCallbacks: Array<() => void>;
}

function createMockMenu(): MockMenu {
	const hideCallbacks: Array<() => void> = [];
	const menu = {
		showAtMouseEvent: jest.fn(),
		showAtPosition: jest.fn(),
		hide: jest.fn(() => {
			hideCallbacks.forEach((callback) => callback());
		}),
		onHide: jest.fn((callback: () => void) => {
			hideCallbacks.push(callback);
		}),
		hideCallbacks,
	};
	return menu;
}

function asMenu(menu: MockMenu): Menu {
	return menu as unknown as Menu;
}

function createTrigger(selector = "div"): HTMLElement {
	const trigger = document.createElement(selector);
	trigger.dataset.tnAction = "edit-date";
	document.body.appendChild(trigger);
	return trigger;
}

describe("ContextMenuCoordinator", () => {
	afterEach(() => {
		closeActiveContextMenu();
		document.body.innerHTML = "";
	});

	describe("showCoordinatedMenu", () => {
		it("shows the menu at the mouse position on first activation", () => {
			const menu = createMockMenu();
			const trigger = createTrigger();
			const event = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(event, "target", { value: trigger });

			showCoordinatedMenu(asMenu(menu), event);

			expect(menu.showAtMouseEvent).toHaveBeenCalledWith(event);
			expect(menu.showAtMouseEvent).toHaveBeenCalledTimes(1);
		});

		it("toggles the menu closed when the same trigger is activated again", () => {
			const first = createMockMenu();
			const second = createMockMenu();
			const trigger = createTrigger();

			const firstEvent = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(firstEvent, "target", { value: trigger });
			showCoordinatedMenu(asMenu(first), firstEvent);

			const secondEvent = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(secondEvent, "target", { value: trigger });
			showCoordinatedMenu(asMenu(second), secondEvent);

			expect(first.showAtMouseEvent).toHaveBeenCalledTimes(1);
			expect(first.hide).toHaveBeenCalledTimes(1);
			expect(second.showAtMouseEvent).not.toHaveBeenCalled();
		});

		it("uses the same trigger when clicking nested elements of a control", () => {
			const first = createMockMenu();
			const second = createMockMenu();
			const trigger = createTrigger("button");
			const icon = document.createElement("span");
			trigger.appendChild(icon);

			const firstEvent = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(firstEvent, "target", { value: trigger });
			showCoordinatedMenu(asMenu(first), firstEvent);

			// Click lands on an inner element of the same control.
			const innerEvent = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(innerEvent, "target", { value: icon });
			showCoordinatedMenu(asMenu(second), innerEvent);

			expect(first.hide).toHaveBeenCalledTimes(1);
			expect(second.showAtMouseEvent).not.toHaveBeenCalled();
		});;

		it("replaces the active menu when another trigger is activated", () => {
			const first = createMockMenu();
			const second = createMockMenu();
			const firstTrigger = createTrigger();
			const secondTrigger = createTrigger();

			showCoordinatedMenu(asMenu(first), new MouseEvent("click"));
			const secondEvent = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(secondEvent, "target", { value: secondTrigger });
			showCoordinatedMenu(asMenu(second), secondEvent);

			expect(first.hide).toHaveBeenCalledTimes(1);
			expect(second.showAtMouseEvent).toHaveBeenCalledTimes(1);
		});

		it("allows reopening a menu after it was hidden externally", () => {
			const menu = createMockMenu();
			const trigger = createTrigger();

			showCoordinatedMenu(asMenu(menu), new MouseEvent("click"));
			menu.hide();

			const reopened = createMockMenu();
			const event = new MouseEvent("click", { bubbles: true });
			Object.defineProperty(event, "target", { value: trigger });
			showCoordinatedMenu(asMenu(reopened), event);

			expect(reopened.showAtMouseEvent).toHaveBeenCalledTimes(1);
		});

		it("anchors the menu below the current target for keyboard events", () => {
			const menu = createMockMenu();
			const trigger = createTrigger();
			jest.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
				left: 20,
				bottom: 100,
			} as DOMRect);

			const event = new KeyboardEvent("keydown", { bubbles: true });
			Object.defineProperty(event, "currentTarget", { value: trigger });
			showCoordinatedMenu(asMenu(menu), event);

			expect(menu.showAtPosition).toHaveBeenCalledWith(
				expect.objectContaining({ x: 20, y: 104 }),
				trigger.ownerDocument
			);
		});

		it("does not show keyboard menus without an element target", () => {
			const menu = createMockMenu();

			const event = new KeyboardEvent("keydown");
			Object.defineProperty(event, "currentTarget", { value: null });
			showCoordinatedMenu(asMenu(menu), event);

			expect(menu.showAtPosition).not.toHaveBeenCalled();
		});
	});

	describe("showCoordinatedMenuAtElement", () => {
		it("anchors the menu below the element", () => {
			const menu = createMockMenu();
			const element = createTrigger();
			jest.spyOn(element, "getBoundingClientRect").mockReturnValue({
				left: 5,
				bottom: 50,
			} as DOMRect);

			showCoordinatedMenuAtElement(asMenu(menu), element);

			expect(menu.showAtPosition).toHaveBeenCalledWith(
				expect.objectContaining({ x: 5, y: 54 }),
				element.ownerDocument
			);
		});

		it("toggles the menu closed when shown at the same element again", () => {
			const first = createMockMenu();
			const second = createMockMenu();
			const element = createTrigger();

			showCoordinatedMenuAtElement(asMenu(first), element);
			showCoordinatedMenuAtElement(asMenu(second), element);

			expect(first.hide).toHaveBeenCalledTimes(1);
			expect(second.showAtPosition).not.toHaveBeenCalled();
		});

		it("replaces the active menu when shown at another element", () => {
			const first = createMockMenu();
			const second = createMockMenu();

			showCoordinatedMenuAtElement(asMenu(first), createTrigger());
			showCoordinatedMenuAtElement(asMenu(second), createTrigger());

			expect(first.hide).toHaveBeenCalledTimes(1);
			expect(second.showAtPosition).toHaveBeenCalledTimes(1);
		});
	});

	describe("closeActiveContextMenu", () => {
		it("hides the active menu and clears coordination state", () => {
			const first = createMockMenu();
			const second = createMockMenu();

			showCoordinatedMenu(asMenu(first), new MouseEvent("click"));
			closeActiveContextMenu();
			showCoordinatedMenu(asMenu(second), new MouseEvent("click"));

			expect(first.hide).toHaveBeenCalledTimes(1);
			expect(second.showAtMouseEvent).toHaveBeenCalledTimes(1);
		});
	});

	describe("getContextMenuTrigger", () => {
		it("resolves interactive-control attributes before falling back to the target", () => {
			const control = document.createElement("div");
			control.setAttribute("data-type", "priority");
			const inner = document.createElement("span");
			control.appendChild(inner);

			const event = new MouseEvent("click");
			Object.defineProperty(event, "target", { value: inner });

			expect(getContextMenuTrigger(event)).toBe(control);
		});

		it("falls back to the event target when no control ancestor matches", () => {
			const plain = document.createElement("td");
			const event = new MouseEvent("click");
			Object.defineProperty(event, "target", { value: plain });

			expect(getContextMenuTrigger(event)).toBe(plain);
		});

		it("returns null for non-element targets", () => {
			const event = new MouseEvent("click");
			Object.defineProperty(event, "target", { value: null });

			expect(getContextMenuTrigger(event)).toBeNull();
		});
	});
});
