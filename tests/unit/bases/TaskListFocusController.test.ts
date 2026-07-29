import { TaskListFocusController } from "../../../src/bases/TaskListFocusController";

function createCard(path: string): HTMLElement {
	const card = document.createElement("div");
	card.className = "task-card";
	card.dataset.taskPath = path;
	return card;
}

function dispatchKey(target: HTMLElement, key: string): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

describe("TaskListFocusController", () => {
	let root: HTMLElement;
	let controller: TaskListFocusController;

	beforeEach(() => {
		root = document.createElement("div");
		document.body.appendChild(root);
		controller = new TaskListFocusController(root);
		root.addEventListener("focusin", (event) => controller.handleFocusIn(event));
		root.addEventListener("keydown", (event) => {
			if (event.key === "ArrowDown") controller.moveFocus(event, "next");
			else if (event.key === "ArrowUp") controller.moveFocus(event, "previous");
			else if (event.key === "Home") controller.moveFocus(event, "first");
			else if (event.key === "End") controller.moveFocus(event, "last");
		});
		HTMLElement.prototype.scrollIntoView = jest.fn();
	});

	afterEach(() => {
		document.body.innerHTML = "";
		jest.restoreAllMocks();
	});

	it("uses a roving tabindex and moves focus with arrows and boundaries", () => {
		const cards = [createCard("a.md"), createCard("b.md"), createCard("c.md")];
		root.append(...cards);
		controller.restoreAfterRender();

		expect(cards.map((card) => card.tabIndex)).toEqual([0, -1, -1]);

		cards[0].focus();
		expect(dispatchKey(cards[0], "ArrowDown").defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(cards[1]);
		expect(dispatchKey(cards[1], "End").defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(cards[2]);
		expect(dispatchKey(cards[2], "ArrowDown").defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(cards[2]);
		expect(dispatchKey(cards[2], "Home").defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(cards[0]);
	});

	it("can focus the first rendered task immediately on initial view load", () => {
		const initialRoot = document.createElement("div");
		const cards = [createCard("first.md"), createCard("second.md")];
		initialRoot.append(...cards);
		document.body.appendChild(initialRoot);
		const initialController = new TaskListFocusController(initialRoot, true);
		initialRoot.addEventListener("focusin", (event) =>
			initialController.handleFocusIn(event)
		);

		initialController.restoreAfterRender();

		expect(document.activeElement).toBe(cards[0]);
		expect(initialController.getFocusedIdentity()).toEqual({
			path: "first.md",
			occurrence: 0,
		});
	});

	it("moves focus through the same path for configurable navigation keys", () => {
		const cards = [createCard("a.md"), createCard("b.md")];
		root.append(...cards);
		controller.restoreAfterRender();
		cards[0].focus();
		const event = new KeyboardEvent("keydown", {
			key: "j",
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "target", { value: cards[0] });

		controller.moveFocus(event, "next");

		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(cards[1]);
	});

	it("updates task focus from mouse movement without stealing DOM focus", () => {
		const cards = [createCard("a.md"), createCard("b.md")];
		root.append(...cards);
		controller.restoreAfterRender();
		cards[0].focus();
		const event = new MouseEvent("mousemove", { bubbles: true });
		Object.defineProperty(event, "target", { value: cards[1] });

		expect(controller.handleMouseMove(event)).toBe(true);

		expect(controller.getFocusedIdentity()).toEqual({ path: "b.md", occurrence: 0 });
		expect(cards[1].classList.contains("task-card--keyboard-focused")).toBe(true);
		expect(document.activeElement).toBe(cards[0]);
	});

	it("keeps the hovered task focused when the mouse moves over empty list space", () => {
		const card = createCard("hovered.md");
		root.appendChild(card);
		controller.restoreAfterRender();
		const cardEvent = new MouseEvent("mousemove", { bubbles: true });
		Object.defineProperty(cardEvent, "target", { value: card });
		controller.handleMouseMove(cardEvent);
		const emptyEvent = new MouseEvent("mousemove", { bubbles: true });
		Object.defineProperty(emptyEvent, "target", { value: root });

		expect(controller.handleMouseMove(emptyEvent)).toBe(false);
		expect(controller.getFocusedIdentity()).toEqual({
			path: "hovered.md",
			occurrence: 0,
		});
	});

	it("continues keyboard navigation from mouse focus and switches back to DOM focus", () => {
		const cards = [createCard("a.md"), createCard("b.md"), createCard("c.md")];
		root.append(...cards);
		controller.restoreAfterRender();
		cards[0].focus();
		const mouseEvent = new MouseEvent("mousemove", { bubbles: true });
		Object.defineProperty(mouseEvent, "target", { value: cards[1] });
		controller.handleMouseMove(mouseEvent);
		const keyEvent = new KeyboardEvent("keydown", {
			key: "ArrowDown",
			cancelable: true,
		});
		Object.defineProperty(keyEvent, "target", { value: cards[0] });

		controller.moveFocus(keyEvent, "next");

		expect(document.activeElement).toBe(cards[2]);
		expect(controller.getFocusedIdentity()).toEqual({ path: "c.md", occurrence: 0 });
	});

	it("supports configurable first and last navigation through the same path", () => {
		const cards = [createCard("a.md"), createCard("b.md"), createCard("c.md")];
		root.append(...cards);
		controller.restoreAfterRender();
		cards[1].focus();
		const firstEvent = new KeyboardEvent("keydown", { key: "g", cancelable: true });
		Object.defineProperty(firstEvent, "target", { value: cards[1] });
		controller.moveFocus(firstEvent, "first");
		expect(document.activeElement).toBe(cards[0]);

		const lastEvent = new KeyboardEvent("keydown", { key: "G", cancelable: true });
		Object.defineProperty(lastEvent, "target", { value: cards[0] });
		controller.moveFocus(lastEvent, "last");
		expect(document.activeElement).toBe(cards[2]);
	});

	it("handles navigation when a Bases capture listener already prevented the default", () => {
		const cards = [createCard("a.md"), createCard("b.md")];
		root.append(...cards);
		controller.restoreAfterRender();
		cards[0].focus();
		const event = new KeyboardEvent("keydown", {
			key: "ArrowDown",
			bubbles: true,
			cancelable: true,
		});
		root.addEventListener("keydown", (capturedEvent) => capturedEvent.preventDefault(), {
			capture: true,
			once: true,
		});

		cards[0].dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(cards[1]);
	});

	it("tracks repeated task paths by rendered occurrence", () => {
		const first = createCard("same.md");
		const middle = createCard("other.md");
		const second = createCard("same.md");
		root.append(first, middle, second);
		controller.restoreAfterRender();

		second.focus();
		expect(controller.getFocusedIdentity()).toEqual({ path: "same.md", occurrence: 1 });

		expect(dispatchKey(second, "ArrowUp").defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(middle);
	});

	it("navigates across rendered group boundaries and skips collapsed group contents", () => {
		const firstGroup = document.createElement("section");
		const secondGroup = document.createElement("section");
		const first = createCard("first.md");
		const collapsed = createCard("collapsed.md");
		const last = createCard("last.md");
		firstGroup.append(first);
		secondGroup.append(last);
		root.append(firstGroup, secondGroup);
		controller.restoreAfterRender();

		first.focus();
		expect(dispatchKey(first, "ArrowDown").defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(last);

		firstGroup.appendChild(collapsed);
		controller.restoreAfterRender();
		last.focus();
		expect(dispatchKey(last, "ArrowUp").defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(collapsed);
	});

	it("restores the focused occurrence after cards are rerendered", () => {
		const first = createCard("same.md");
		const second = createCard("same.md");
		root.append(first, second);
		controller.restoreAfterRender();
		second.focus();
		controller.prepareForRender();

		const replacements = [createCard("same.md"), createCard("same.md")];
		root.replaceChildren(...replacements);
		controller.restoreAfterRender();

		expect(document.activeElement).toBe(replacements[1]);
		expect(replacements[1].classList.contains("task-card--keyboard-focused")).toBe(true);
		expect(replacements.map((card) => card.tabIndex)).toEqual([-1, 0]);
	});

	it("falls back predictably when the focused task disappears", () => {
		const first = createCard("first.md");
		const removed = createCard("removed.md");
		root.append(first, removed);
		controller.restoreAfterRender();
		removed.focus();
		controller.prepareForRender();

		const replacement = createCard("replacement.md");
		root.replaceChildren(replacement);
		controller.restoreAfterRender();

		expect(document.activeElement).toBe(replacement);
		expect(controller.getFocusedIdentity()).toEqual({
			path: "replacement.md",
			occurrence: 0,
		});
	});

	it("does not capture keys from interactive card content", () => {
		const card = createCard("a.md");
		const button = document.createElement("button");
		card.appendChild(button);
		root.appendChild(card);
		controller.restoreAfterRender();
		button.focus();

		const event = dispatchKey(button, "ArrowDown");

		expect(event.defaultPrevented).toBe(false);
		expect(document.activeElement).toBe(button);
	});

	it("exposes the focused task for an unmodified Space key", () => {
		const card = createCard("focused.md");
		root.appendChild(card);
		controller.restoreAfterRender();
		card.focus();
		const event = new KeyboardEvent("keydown", {
			key: " ",
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "target", { value: card });

		expect(controller.getFocusedPathForEvent(event)).toBe("focused.md");
	});

	it("allows a shifted action chord when modifiers were already validated", () => {
		const card = createCard("focused.md");
		root.appendChild(card);
		controller.restoreAfterRender();
		card.focus();
		const event = new KeyboardEvent("keydown", {
			key: "Enter",
			shiftKey: true,
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(event, "target", { value: card });

		expect(controller.getFocusedPathForEvent(event)).toBeNull();
		expect(controller.getFocusedPathForEvent(event, true)).toBe("focused.md");
	});

	it("resolves a modified chord after an upstream handler prevented its browser default", () => {
		const card = createCard("focused.md");
		root.appendChild(card);
		controller.restoreAfterRender();
		card.focus();
		const event = new KeyboardEvent("keydown", {
			key: "k",
			ctrlKey: true,
			cancelable: true,
		});
		Object.defineProperty(event, "target", { value: card });
		event.preventDefault();

		expect(event.defaultPrevented).toBe(true);
		expect(controller.getFocusedPathForEvent(event, true)).toBe("focused.md");
	});

	it("uses remembered focus for non-interactive events from the view shell", () => {
		const card = createCard("remembered.md");
		root.appendChild(card);
		controller.restoreAfterRender();
		card.focus();
		const shell = document.createElement("div");
		shell.appendChild(root);
		document.body.appendChild(shell);
		const event = new KeyboardEvent("keydown", { key: "j" });
		Object.defineProperty(event, "target", { value: shell });

		expect(controller.getFocusedPathForEvent(event, false, false)).toBeNull();
		expect(controller.getFocusedPathForEvent(event, false, true)).toBe("remembered.md");
	});

	it("clears the remembered identity and keyboard-focus styling", () => {
		const cards = [createCard("first.md"), createCard("second.md")];
		root.append(...cards);
		controller.restoreAfterRender();
		cards[1].focus();

		controller.clear();

		expect(controller.getFocusedIdentity()).toBeNull();
		expect(cards[1].classList.contains("task-card--keyboard-focused")).toBe(false);
		expect(cards.map((card) => card.tabIndex)).toEqual([0, -1]);
	});
});
