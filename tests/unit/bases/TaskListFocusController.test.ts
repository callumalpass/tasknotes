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
		root.addEventListener("keydown", (event) => controller.handleKeyDown(event));
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
});
