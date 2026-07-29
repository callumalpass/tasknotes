import { TaskListView } from "../../../src/bases/TaskListView";
import { TaskListFocusController } from "../../../src/bases/TaskListFocusController";

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
				getFocusedIdentity: jest.fn(() => ({ path: "focused.md", occurrence: 0 })),
			},
			currentVisibleTaskPaths: new Set(["focused.md"]),
			plugin: {
				taskSelectionService: { toggleSelection },
			},
		};

		(TaskListView.prototype as any).toggleFocusedTaskSelection.call(view);

		expect(toggleSelection).toHaveBeenCalledWith("focused.md");
	});

	it("toggles the mouse-focused task after hover moves DOM focus to it", () => {
		const items = document.createElement("div");
		const first = document.createElement("div");
		first.className = "task-card";
		first.dataset.taskPath = "first.md";
		const hovered = document.createElement("div");
		hovered.className = "task-card";
		hovered.dataset.taskPath = "hovered.md";
		items.append(first, hovered);
		document.body.appendChild(items);
		const focusController = new TaskListFocusController(items);
		items.addEventListener("focusin", (event) => focusController.handleFocusIn(event));
		focusController.restoreAfterRender();
		first.focus();
		const mouseEvent = new MouseEvent("mousemove");
		Object.defineProperty(mouseEvent, "target", { value: hovered });
		focusController.handleMouseMove(mouseEvent);
		const toggleSelection = jest.fn();
		const view = {
			currentVisibleTaskPaths: new Set(["first.md", "hovered.md"]),
			focusController,
			plugin: {
				taskSelectionService: { toggleSelection },
			},
		};

		(TaskListView.prototype as any).toggleFocusedTaskSelection.call(view);

		expect(document.activeElement).toBe(hovered);
		expect(toggleSelection).toHaveBeenCalledWith("hovered.md");
	});

	it("does not toggle a remembered task that is filtered out", () => {
		const toggleSelection = jest.fn();
		const view = {
			focusController: {
				getFocusedIdentity: jest.fn(() => ({ path: "hidden.md", occurrence: 0 })),
			},
			currentVisibleTaskPaths: new Set(["visible.md"]),
			plugin: {
				taskSelectionService: { toggleSelection },
			},
		};

		(TaskListView.prototype as any).toggleFocusedTaskSelection.call(view);

		expect(toggleSelection).not.toHaveBeenCalled();
	});

	it("clears selection while preserving task focus for subsequent shortcuts", () => {
		const clearSelection = jest.fn();
		const exitSelectionMode = jest.fn();
		const restoreFocusedElement = jest.fn(() => true);
		const rootElement = document.createElement("div");
		rootElement.tabIndex = -1;
		document.body.appendChild(rootElement);
		const view = {
			rootElement,
			focusController: { restoreFocusedElement },
			plugin: {
				taskSelectionService: { clearSelection, exitSelectionMode },
			},
		};

		(TaskListView.prototype as any).clearTaskListFocusAndSelection.call(view);

		expect(clearSelection).toHaveBeenCalled();
		expect(exitSelectionMode).toHaveBeenCalled();
		expect(restoreFocusedElement).toHaveBeenCalled();
		expect(document.activeElement).not.toBe(rootElement);
	});

	it("focuses the task-list root when no task focus can be restored after clearing selection", () => {
		const rootElement = document.createElement("div");
		rootElement.tabIndex = -1;
		document.body.appendChild(rootElement);
		const view = {
			rootElement,
			focusController: { restoreFocusedElement: jest.fn(() => false) },
			plugin: {
				taskSelectionService: {
					clearSelection: jest.fn(),
					exitSelectionMode: jest.fn(),
				},
			},
		};

		(TaskListView.prototype as any).clearTaskListFocusAndSelection.call(view);

		expect(document.activeElement).toBe(rootElement);
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
			isTaskListLeaf: (TaskListView.prototype as any).isTaskListLeaf,
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
