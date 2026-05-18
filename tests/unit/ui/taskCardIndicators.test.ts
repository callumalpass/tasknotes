import {
	createBadgeIndicator,
	prepareInteractiveControl,
	updateBadgeIndicator,
} from "../../../src/ui/taskCardIndicators";

jest.mock("obsidian");

describe("taskCardIndicators", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("skips hidden badge indicators", () => {
		const container = document.createElement("div");

		expect(
			createBadgeIndicator({
				container,
				className: "task-card__reminder-indicator",
				icon: "bell",
				tooltip: "Reminders",
				visible: false,
			})
		).toBeNull();
		expect(container.childElementCount).toBe(0);
	});

	it("creates interactive badge indicators without letting parent drags swallow clicks", () => {
		const container = document.createElement("div");
		const onClick = jest.fn();

		const indicator = createBadgeIndicator({
			container,
			className: "task-card__reminder-indicator",
			icon: "bell",
			tooltip: "Reminders",
			onClick,
		});

		expect(indicator).not.toBeNull();
		expect(indicator?.classList.contains("task-card__reminder-indicator")).toBe(true);
		expect(indicator?.getAttribute("aria-label")).toBe("Reminders");
		expect(indicator?.getAttribute("role")).toBe("button");
		expect(indicator?.dataset.tnNoDrag).toBe("true");
		expect(indicator?.getAttribute("draggable")).toBe("false");

		const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
		const mouseDownStop = jest.spyOn(mouseDown, "stopPropagation");
		indicator?.dispatchEvent(mouseDown);
		expect(mouseDown.defaultPrevented).toBe(true);
		expect(mouseDownStop).toHaveBeenCalled();

		indicator?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("activates prepared controls with Enter and Space", () => {
		const element = document.createElement("button");
		const click = jest.spyOn(element, "click");

		prepareInteractiveControl(element);
		element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		element.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
		element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

		expect(click).toHaveBeenCalledTimes(2);
	});

	it("updates, creates, and removes badge indicators", () => {
		const card = document.createElement("div");
		const mainRow = card.createDiv({ cls: "task-card__main-row" });
		const badges = mainRow.createDiv({ cls: "task-card__badges" });

		const created = updateBadgeIndicator(card, ".task-card__project-indicator", {
			shouldExist: true,
			className: "task-card__project-indicator",
			icon: "folder",
			tooltip: "Project",
		});

		expect(created).not.toBeNull();
		expect(created?.parentElement).toBe(badges);

		const updated = updateBadgeIndicator(card, ".task-card__project-indicator", {
			shouldExist: true,
			className: "task-card__project-indicator",
			icon: "folder",
			tooltip: "Updated project",
			ariaLabel: "Open project",
		});

		expect(updated).toBe(created);
		expect(updated?.getAttribute("aria-label")).toBe("Open project");

		const removed = updateBadgeIndicator(card, ".task-card__project-indicator", {
			shouldExist: false,
			className: "task-card__project-indicator",
			icon: "folder",
			tooltip: "Project",
		});

		expect(removed).toBeNull();
		expect(card.querySelector(".task-card__project-indicator")).toBeNull();
	});
});
