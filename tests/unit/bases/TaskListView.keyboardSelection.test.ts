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
					getSelectionCount: jest.fn(() => 2),
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
		expect(view.updateSelectionModeUI).toHaveBeenCalledWith(true);
		expect(view.updateSelectionVisuals).toHaveBeenCalled();
		expect(view.updateSelectionIndicator).toHaveBeenCalledWith(2);
		const event = new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
			cancelable: true,
		});

		card.dispatchEvent(event);

		expect(view.inputOwnershipController.canHandleListKeyDown).toHaveBeenCalledWith(event);
		expect(exitSelectionMode).not.toHaveBeenCalled();
	});

	it("restores remembered card focus when its workspace leaf is activated", () => {
		jest.useFakeTimers();
		const leafContainer = document.createElement("div");
		const containerEl = document.createElement("div");
		const rootElement = document.createElement("div");
		leafContainer.append(containerEl);
		containerEl.append(rootElement);
		document.body.appendChild(leafContainer);
		const restoreFocusedElement = jest.fn();
		const view = {
			containerEl,
			rootElement,
			focusController: { restoreFocusedElement },
		};

		(TaskListView.prototype as any).restoreFocusForActivatedLeaf.call(view, {
			view: { containerEl: leafContainer },
		});
		jest.runAllTimers();

		expect(restoreFocusedElement).toHaveBeenCalled();
		jest.useRealTimers();
	});

	it("rehydrates selection visuals after every card render", () => {
		const restoreAfterRender = jest.fn();
		const updateSelectionVisuals = jest.fn();
		const updateSelectionIndicator = jest.fn();
		const view = {
			focusController: { restoreAfterRender },
			plugin: {
				taskSelectionService: {
					getSelectionCount: jest.fn(() => 3),
				},
			},
			updateSelectionVisuals,
			updateSelectionIndicator,
		};

		(TaskListView.prototype as any).restoreInteractionStateAfterRender.call(view);

		expect(restoreAfterRender).toHaveBeenCalled();
		expect(updateSelectionVisuals).toHaveBeenCalled();
		expect(updateSelectionIndicator).toHaveBeenCalledWith(3);
	});
});
