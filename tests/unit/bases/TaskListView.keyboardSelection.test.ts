import { TaskListView } from "../../../src/bases/TaskListView";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);

describe("TaskListView keyboard selection", () => {
	it("toggles the focused task through the existing selection service", () => {
		const toggleSelection = jest.fn();
		const view = {
			focusController: {
				getFocusedPathForEvent: jest.fn(() => "focused.md"),
			},
			plugin: {
				taskSelectionService: { toggleSelection },
			},
		};
		const event = new KeyboardEvent("keydown", {
			key: " ",
			cancelable: true,
		});
		const stopPropagation = jest.spyOn(event, "stopPropagation");

		(TaskListView.prototype as any).handleTaskListSelectionKeyDown.call(view, event);

		expect(event.defaultPrevented).toBe(true);
		expect(stopPropagation).toHaveBeenCalled();
		expect(toggleSelection).toHaveBeenCalledWith("focused.md");
	});

	it("leaves Space alone when focus is in an excluded control", () => {
		const toggleSelection = jest.fn();
		const view = {
			focusController: {
				getFocusedPathForEvent: jest.fn(() => null),
			},
			plugin: {
				taskSelectionService: { toggleSelection },
			},
		};
		const event = new KeyboardEvent("keydown", {
			key: " ",
			cancelable: true,
		});

		(TaskListView.prototype as any).handleTaskListSelectionKeyDown.call(view, event);

		expect(event.defaultPrevented).toBe(false);
		expect(toggleSelection).not.toHaveBeenCalled();
	});

	it("clears selection on Escape without handing focus to the Bases root", () => {
		const exitSelectionMode = jest.fn();
		const view = {
			plugin: {
				taskSelectionService: { exitSelectionMode },
			},
		};
		const event = new KeyboardEvent("keydown", {
			key: "Escape",
			cancelable: true,
		});
		const stopPropagation = jest.spyOn(event, "stopPropagation");

		const handled = (TaskListView.prototype as any).handleTaskListEscape.call(view, event);

		expect(handled).toBe(true);
		expect(event.defaultPrevented).toBe(true);
		expect(stopPropagation).toHaveBeenCalled();
		expect(exitSelectionMode).toHaveBeenCalledWith(true);
	});

	it("does not let the inherited selection handler clear selection while a popup owns Escape", () => {
		const exitSelectionMode = jest.fn();
		const rootElement = document.createElement("div");
		const card = document.createElement("div");
		rootElement.appendChild(card);
		document.body.appendChild(rootElement);
		const view = {
			rootElement,
			plugin: {
				taskSelectionService: {
					isSelectionModeActive: jest.fn(() => true),
					exitSelectionMode,
					onSelectionChange: jest.fn(() => jest.fn()),
					onSelectionModeChange: jest.fn(() => jest.fn()),
				},
			},
			inputOwnershipController: {
				canHandleListKeyDown: jest.fn(() => false),
			},
			canHandleSelectionKeyDown: (TaskListView.prototype as any)
				.canHandleSelectionKeyDown,
			getVisibleTaskPaths: jest.fn(() => ["focused.md"]),
			updateSelectionModeUI: jest.fn(),
			updateSelectionVisuals: jest.fn(),
			updateSelectionIndicator: jest.fn(),
			register: jest.fn(),
		};
		(TaskListView.prototype as any).setupSelectionHandling.call(view);
		const event = new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
			cancelable: true,
		});

		card.dispatchEvent(event);

		expect(view.inputOwnershipController.canHandleListKeyDown).toHaveBeenCalledWith(event);
		expect(exitSelectionMode).not.toHaveBeenCalled();
	});
});
