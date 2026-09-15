import { TaskListView } from "../../../src/bases/TaskListView";
import { TaskListFocusController } from "../../../src/bases/TaskListFocusController";
import { executeBasesTaskCardAction } from "../../../src/bases/basesTaskCardActions";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);

describe("TaskListView keyboard selection", () => {
	it("toggles the focused task through the existing selection service", async () => {
		const toggleSelection = jest.fn();
		const context = {
			taskSelectionService: { toggleSelection },
			isPathVisible: (path: string) => path === "focused.md",
		};

		await executeBasesTaskCardAction("toggle-select", "focused.md", context as any);

		expect(toggleSelection).toHaveBeenCalledWith("focused.md");
	});

	it("toggles the mouse-focused task after hover moves DOM focus to it", async () => {
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
		const focusedPath = focusController.getFocusedIdentity()?.path ?? null;
		const context = {
			taskSelectionService: { toggleSelection },
			isPathVisible: (path: string) => ["first.md", "hovered.md"].includes(path),
		};

		await executeBasesTaskCardAction("toggle-select", focusedPath, context as any);

		expect(document.activeElement).toBe(hovered);
		expect(toggleSelection).toHaveBeenCalledWith("hovered.md");
	});

	it("does not toggle a remembered task that is filtered out", async () => {
		const toggleSelection = jest.fn();
		const context = {
			taskSelectionService: { toggleSelection },
			isPathVisible: (path: string) => path === "visible.md",
		};

		await executeBasesTaskCardAction("toggle-select", "hidden.md", context as any);

		expect(toggleSelection).not.toHaveBeenCalled();
	});

	it("clears selection while preserving task focus for subsequent shortcuts", async () => {
		const clearSelection = jest.fn();
		const exitSelectionMode = jest.fn();
		const restoreFocus = jest.fn(() => true);
		const rootElement = document.createElement("div");
		rootElement.tabIndex = -1;
		document.body.appendChild(rootElement);
		const context = {
			taskSelectionService: { clearSelection, exitSelectionMode },
			restoreFocus,
			rootElement,
		};

		await executeBasesTaskCardAction("clear-focus-and-selection", null, context as any);

		expect(clearSelection).toHaveBeenCalled();
		expect(exitSelectionMode).toHaveBeenCalled();
		expect(restoreFocus).toHaveBeenCalled();
		expect(document.activeElement).not.toBe(rootElement);
	});

	it("focuses the task-list root when no task focus can be restored after clearing selection", async () => {
		const rootElement = document.createElement("div");
		rootElement.tabIndex = -1;
		document.body.appendChild(rootElement);
		const context = {
			taskSelectionService: {
				clearSelection: jest.fn(),
				exitSelectionMode: jest.fn(),
			},
			restoreFocus: jest.fn(() => false),
			rootElement,
		};

		await executeBasesTaskCardAction("clear-focus-and-selection", null, context as any);

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
			taskCardKeyboardController: {
				canHandleSelectionKeyDown: jest.fn(() => false),
			},
			canHandleSelectionKeyDown: (TaskListView.prototype as any).canHandleSelectionKeyDown,
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

		expect(view.taskCardKeyboardController.canHandleSelectionKeyDown).toHaveBeenCalledWith(
			event
		);
		expect(exitSelectionMode).not.toHaveBeenCalled();
	});

	it("rehydrates selection visuals after every card render", () => {
		const restoreAfterRender = jest.fn();
		const updateSelectionVisuals = jest.fn();
		const updateSelectionIndicator = jest.fn();
		const view = {
			taskCardKeyboardController: { restoreAfterRender },
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
