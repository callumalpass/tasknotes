import { readFileSync } from "fs";
import { resolve } from "path";
import { KanbanView } from "../../../src/bases/KanbanView";
import type { TaskInfo } from "../../../src/types";

const marker = "kanban-view__touch-drag-source";
const cardDragging = "kanban-view__card--dragging";

function makeView() {
	const selectionService = {
		isSelected: jest.fn(() => false),
		getSelectionCount: jest.fn(() => 0),
		getSelectedPaths: jest.fn((): string[] => []),
	};
	const container = document.createElement("div");
	document.body.appendChild(container);
	const view = new KanbanView({}, container, {
		app: {},
		fieldMapper: { toUserField: (field: string) => field, isRecognizedProperty: () => true },
		priorityManager: { getAllPriorities: () => [] },
		settings: { customStatuses: [], fieldMapping: { sortOrder: "sort_order" } },
		taskSelectionService: selectionService,
	} as any);
	const state = view as any;
	state.boardEl = container;
	state.debugLog = jest.fn();
	state.showFloatingDragPreview = jest.fn();
	return { view, state, container, selectionService };
}

function card(container: HTMLElement, path = "tasks/a.md") {
	const element = container.createDiv("kanban-view__card-wrapper");
	element.dataset.taskPath = path;
	return element;
}

function task(path = "tasks/a.md"): TaskInfo {
	return { path, title: path, status: "open", priority: "normal", archived: false };
}

function touch(element: HTMLElement, type: string, points = [{ clientX: 50, clientY: 50 }]) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		touches: { value: type === "touchend" ? [] : points },
		changedTouches: { value: points },
	});
	element.dispatchEvent(event);
}

function mouseDrag(element: HTMLElement) {
	const event = new Event("dragstart", { bubbles: true });
	Object.defineProperties(event, {
		clientX: { value: 50 },
		clientY: { value: 50 },
		dataTransfer: { value: { setData: jest.fn(), setDragImage: jest.fn() } },
	});
	element.dispatchEvent(event);
}

async function settle() {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("issue #2414 input-specific Kanban drag sources", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 10 });
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		Reflect.deleteProperty(navigator, "maxTouchPoints");
		document.body.replaceChildren();
	});

	it("keeps all shared dragging CSS visual-only", () => {
		const css = readFileSync(resolve(__dirname, "../../../styles/kanban-view.css"), "utf8");
		for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
			if (rule[1].includes("--dragging")) expect(rule[2]).not.toContain("pointer-events");
		}
		expect(css).toMatch(
			/\.tasknotes-plugin \.kanban-view__touch-drag-source\s*\{\s*pointer-events: none;/
		);
	});

	it("never marks a native mouse card drag even on a touch-capable desktop", () => {
		const { view, state, container } = makeView();
		const source = card(container);
		state.setupCardDragHandlers(source, task());
		mouseDrag(source);
		expect(source.classList.contains(cardDragging)).toBe(true);
		expect(source.classList.contains(marker)).toBe(false);
		expect(state.touchDragSources.size).toBe(0);
		view.onunload();
	});

	it.each(["kanban-view__column-header", "kanban-view__column-header-cell"])(
		"marks %s only after a touch hold, and restores a detached header on cancel",
		(className) => {
			const { view, state, container } = makeView();
			const header = container.createDiv(className);
			header.dataset.columnKey = "open";
			state.setupColumnHeaderDragHandlers(header);
			mouseDrag(header);
			expect(header.classList.contains(marker)).toBe(false);
			header.dispatchEvent(new Event("dragend"));
			touch(header, "touchstart");
			jest.advanceTimersByTime(349);
			expect(header.classList.contains(marker)).toBe(false);
			jest.advanceTimersByTime(1);
			expect(header.classList.contains(marker)).toBe(true);
			expect(header.classList.contains(`${className}--dragging`)).toBe(true);
			header.remove();
			touch(header, "touchcancel");
			expect(header.classList.contains(marker)).toBe(false);
			expect(header.classList.contains(`${className}--dragging`)).toBe(false);
			expect(state.touchDragSources.size).toBe(0);
			view.onunload();
		}
	);

	it.each(["tap", "scroll"])("does not mark a card during a %s", (gesture) => {
		const { view, state, container } = makeView();
		const source = card(container);
		state.setupCardTouchHandlers(source, task());
		touch(source, "touchstart");
		jest.advanceTimersByTime(100);
		touch(source, gesture === "tap" ? "touchend" : "touchmove", [{ clientX: 80, clientY: 50 }]);
		jest.advanceTimersByTime(500);
		expect(source.classList.contains(marker)).toBe(false);
		expect(state.touchDragGhost).toBeNull();
		view.onunload();
	});

	it("tracks batch sources by reference and cleans them even after the task map changes", () => {
		const { view, state, container, selectionService } = makeView();
		const sources = [card(container), card(container, "tasks/b.md")];
		selectionService.isSelected.mockReturnValue(true);
		selectionService.getSelectionCount.mockReturnValue(2);
		selectionService.getSelectedPaths.mockReturnValue(["tasks/a.md", "tasks/b.md"]);
		sources.forEach((source) => state.currentTaskElements.set(source.dataset.taskPath, source));
		state.setupCardTouchHandlers(sources[0], task());
		touch(sources[0], "touchstart");
		jest.advanceTimersByTime(350);
		sources.forEach((source) => expect(source.classList.contains(marker)).toBe(true));
		expect(state.touchDragSources.size).toBe(2);
		state.currentTaskElements.clear();
		sources[1].remove();
		touch(sources[0], "touchcancel");
		state.clearTouchDragState();
		sources.forEach((source) => {
			expect(source.classList.contains(marker)).toBe(false);
			expect(source.classList.contains(cardDragging)).toBe(false);
		});
		expect(document.querySelector(".kanban-view__touch-ghost")).toBeNull();
		view.onunload();
	});

	it("marks the actual nested source, not its enclosing parent card", () => {
		const { view, state, container } = makeView();
		const parent = card(container);
		const nested = parent.createDiv("task-card");
		state.initiateTouchDrag(parent, task(), 50, 50, {
			taskPath: "tasks/child.md",
			sourceElement: nested,
		});
		expect(nested.classList.contains(marker)).toBe(true);
		expect(parent.classList.contains(marker)).toBe(false);
		nested.remove();
		view.onunload();
		expect(nested.classList.contains(marker)).toBe(false);
	});

	it.each(["success", "failure", "outside", "missing touch"])(
		"cleans a card drop on %s, including asynchronous persistence failure",
		async (outcome) => {
			jest.spyOn(console, "error").mockImplementation(() => {});
			const { view, state, container } = makeView();
			const source = card(container);
			state.setupCardTouchHandlers(source, task());
			state.findDropTargetAt = jest.fn(() => ({
				type: "column",
				groupKey: outcome === "outside" ? null : "waiting",
				swimLaneKey: null,
			}));
			state.performOptimisticReorder = jest.fn(() => false);
			let finish!: () => void;
			state.handleTaskDrop = jest.fn(
				() =>
					new Promise<void>((resolve, reject) => {
						finish = () =>
							outcome === "failure" ? reject(new Error("save failed")) : resolve();
					})
			);
			touch(source, "touchstart");
			jest.advanceTimersByTime(350);
			expect(source.classList.contains(marker)).toBe(true);
			touch(source, "touchend", outcome === "missing touch" ? [] : undefined);
			if (outcome === "success" || outcome === "failure") {
				expect(source.classList.contains(marker)).toBe(true);
				finish();
			}
			await settle();
			expect(source.classList.contains(marker)).toBe(false);
			expect(source.classList.contains(cardDragging)).toBe(false);
			expect(state.touchDragActive).toBe(false);
			expect(state.touchDragGhost).toBeNull();
			view.onunload();
		}
	);

	it.each(["success", "save failure", "render failure"])(
		"cleans a swimlane column-header drop after %s",
		async (outcome) => {
			jest.spyOn(console, "error").mockImplementation(() => {});
			const { view, state, container } = makeView();
			const source = container.createDiv("kanban-view__column-header-cell");
			source.dataset.columnKey = "open";
			const target = container.createDiv("kanban-view__column-header-cell");
			target.dataset.columnKey = "waiting";
			state.setupColumnHeaderDragHandlers(source);
			state.getGroupByPropertyId = jest.fn(() => "note.status");
			state.findDropTargetAt = jest.fn(() => ({ type: "columnHeader", groupKey: "waiting" }));
			state.saveColumnOrder =
				outcome === "save failure"
					? jest.fn().mockRejectedValue(new Error("save failed"))
					: jest.fn().mockResolvedValue(undefined);
			state.render =
				outcome === "render failure"
					? jest.fn().mockRejectedValue(new Error("render failed"))
					: jest.fn().mockResolvedValue(undefined);
			touch(source, "touchstart");
			jest.advanceTimersByTime(350);
			touch(source, "touchend");
			await settle();
			expect(state.saveColumnOrder).toHaveBeenCalledWith("note.status", ["waiting", "open"]);
			expect(source.classList.contains(marker)).toBe(false);
			expect(source.classList.contains("kanban-view__column-header-cell--dragging")).toBe(
				false
			);
			expect(state.touchDragGhost).toBeNull();
			view.onunload();
		}
	);

	it("disposes an active touch session without affecting another view", () => {
		const { view, state, container } = makeView();
		const other = makeView();
		const source = card(container);
		const otherSource = card(other.container);
		state.initiateTouchDrag(source, task(), 50, 50);
		other.state.initiateTouchDrag(otherSource, task(), 50, 50);
		const ghost = state.touchDragGhost;
		state.autoScrollTimer = window.setInterval(() => {}, 16);
		const removeListener = jest.spyOn(container.ownerDocument, "removeEventListener");
		view.onunload();
		view.onunload();
		expect(source.classList.contains(marker)).toBe(false);
		expect(ghost.isConnected).toBe(false);
		expect(state.autoScrollTimer).toBeNull();
		expect(removeListener).toHaveBeenCalledWith(
			"contextmenu",
			state.boundContextMenuBlocker,
			true
		);
		expect(otherSource.classList.contains(marker)).toBe(true);
		other.view.onunload();
	});

	it("cancels a pending long press when the view is disposed", () => {
		const { view, state, container } = makeView();
		const source = card(container);
		state.setupCardTouchHandlers(source, task());
		touch(source, "touchstart");
		view.onunload();
		jest.advanceTimersByTime(500);
		expect(source.classList.contains(marker)).toBe(false);
		expect(state.longPressTimer).toBeNull();
		expect(state.touchDragGhost).toBeNull();
	});
});
