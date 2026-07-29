import { TaskListFocusController } from "../../../src/bases/TaskListFocusController";
import { TaskListInputOwnershipController } from "../../../src/bases/TaskListInputOwnershipController";

function card(path: string): HTMLElement {
	const element = document.createElement("div");
	element.className = "task-card";
	element.dataset.taskPath = path;
	return element;
}

describe("TaskListInputOwnershipController", () => {
	let viewRoot: HTMLElement;
	let items: HTMLElement;
	let taskCard: HTMLElement;
	let focusController: TaskListFocusController;
	let controller: TaskListInputOwnershipController;

	beforeEach(() => {
		jest.useFakeTimers();
		viewRoot = document.createElement("div");
		items = document.createElement("div");
		taskCard = card("focused.md");
		items.appendChild(taskCard);
		viewRoot.appendChild(items);
		document.body.appendChild(viewRoot);
		focusController = new TaskListFocusController(items);
		controller = new TaskListInputOwnershipController(viewRoot, focusController);
		items.addEventListener("focusin", (event) => focusController.handleFocusIn(event));
		HTMLElement.prototype.scrollIntoView = jest.fn();
		focusController.restoreAfterRender();
		taskCard.focus();
	});

	afterEach(() => {
		controller.destroy();
		jest.useRealTimers();
		jest.restoreAllMocks();
		document.body.innerHTML = "";
	});

	it("allows list keys from a task card and suppresses editable targets", () => {
		const cardEvent = new KeyboardEvent("keydown", { key: "d" });
		Object.defineProperty(cardEvent, "target", { value: taskCard });
		expect(controller.canHandleListKeyDown(cardEvent)).toBe(true);

		const input = document.createElement("input");
		viewRoot.appendChild(input);
		const inputEvent = new KeyboardEvent("keydown", { key: "d" });
		Object.defineProperty(inputEvent, "target", { value: input });
		expect(controller.canHandleListKeyDown(inputEvent)).toBe(false);
	});

	it("suppresses list shortcuts while a menu is open", () => {
		const menu = document.createElement("div");
		menu.className = "menu";
		document.body.appendChild(menu);
		const event = new KeyboardEvent("keydown", { key: "d" });
		Object.defineProperty(event, "target", { value: taskCard });

		expect(controller.canHandleListKeyDown(event)).toBe(false);
	});

	it("restores the originating task after an overlay closes", () => {
		controller.noteOverlayOpening();
		const menu = document.createElement("div");
		menu.className = "menu";
		document.body.appendChild(menu);
		const menuItem = document.createElement("div");
		menuItem.tabIndex = 0;
		menu.appendChild(menuItem);
		menuItem.focus();
		const event = new MouseEvent("pointerdown", { bubbles: true });
		Object.defineProperty(event, "target", { value: menuItem });
		controller.handleOverlayInteraction(event);

		menu.remove();
		document.body.focus();
		jest.runAllTimers();

		expect(document.activeElement).toBe(taskCard);
	});

	it("restores a rerendered task after an overlay closes without a captured close interaction", () => {
		controller.noteOverlayOpening();
		const menu = document.createElement("div");
		menu.className = "menu";
		document.body.appendChild(menu);
		const menuItem = document.createElement("div");
		menuItem.tabIndex = 0;
		menu.appendChild(menuItem);
		menuItem.focus();

		focusController.prepareForRender();
		const replacement = card("focused.md");
		items.replaceChildren(replacement);
		focusController.restoreAfterRender();
		menu.remove();
		jest.runAllTimers();

		expect(document.activeElement).toBe(replacement);
		const event = new KeyboardEvent("keydown", { key: " " });
		Object.defineProperty(event, "target", { value: replacement });
		expect(controller.canHandleListKeyDown(event)).toBe(true);
	});

	it("keeps Escape overlay-owned after the menu is synchronously removed", () => {
		controller.noteOverlayOpening();
		const menu = document.createElement("div");
		menu.className = "menu";
		document.body.appendChild(menu);
		const event = new KeyboardEvent("keydown", { key: "Escape" });
		Object.defineProperty(event, "target", { value: taskCard });

		controller.handleOverlayInteraction(event);
		menu.remove();

		expect(controller.canHandleListKeyDown(event)).toBe(false);
		jest.runAllTimers();
		expect(controller.canHandleListKeyDown(event)).toBe(true);
	});

	it("does not steal focus when the user moved to another control", () => {
		controller.noteOverlayOpening();
		const outsideInput = document.createElement("input");
		document.body.appendChild(outsideInput);
		outsideInput.focus();

		controller.scheduleRestoreAfterOverlayClose();
		jest.runAllTimers();

		expect(document.activeElement).toBe(outsideInput);
	});

	it("suppresses IME composition", () => {
		const event = new KeyboardEvent("keydown", {
			key: "Process",
			isComposing: true,
		});
		Object.defineProperty(event, "target", { value: taskCard });

		expect(controller.canHandleListKeyDown(event)).toBe(false);
	});
});
