import { TaskListView } from "../../../src/bases/TaskListView";

function dispatch(element: HTMLElement, type: string, y: number) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		touches: { value: type === "touchend" ? [] : [{ clientX: 50, clientY: y }] },
		changedTouches: { value: [{ clientX: 50, clientY: y }] },
	});
	element.dispatchEvent(event);
}

describe("list touch reorder handle (#2032)", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => { jest.useRealTimers(); document.body.classList.remove("tn-drag-active"); });
	it("routes a held handle drop through the existing queued sort writer and cleans up", async () => {
		const view = Object.create(TaskListView.prototype) as any;
		const container = document.createElement("div");
		const card = document.createElement("div");
		const handle = document.createElement("div");
		handle.dataset.tnDragHandle = "true";
		card.appendChild(handle);
		container.appendChild(card);
		Object.assign(view, {
			containerEl: container, rootElement: container, itemsContainer: container,
			CARD_DRAG_HANDLE_SELECTOR: '[data-tn-drag-handle="true"]',
			captureDropBaseline: jest.fn(), cleanupDragShift: jest.fn(), updateResolvedInsertionSlot: jest.fn(),
			flushPendingInsertionSlot: jest.fn(), getCurrentInsertionTarget: () => ({ taskPath: "second.md", above: false }),
			currentInsertionGroupKey: "target", getVisibleSortScopePathsForDrag: () => ["second.md"],
			handleSortOrderDrop: jest.fn().mockResolvedValue(undefined),
		});
		jest.spyOn(container, "getBoundingClientRect").mockReturnValue({ left: 0, right: 200, top: 0, bottom: 300 } as DOMRect);
		view.setupCardTouchDrag(card, { path: "first.md" }, "source");
		dispatch(handle, "touchstart", 100);
		jest.advanceTimersByTime(350);
		expect(view.draggedTaskPath).toBe("first.md");
		expect(document.body.querySelector(".task-list-view__touch-ghost")).not.toBeNull();
		dispatch(handle, "touchmove", 220);
		dispatch(handle, "touchend", 220);
		await Promise.resolve();
		await Promise.resolve();
		expect(view.handleSortOrderDrop).toHaveBeenCalledWith("first.md", "second.md", false, "target", "source", ["second.md"]);
		expect(view.draggedTaskPath).toBeNull();
		expect(document.body.querySelector(".task-list-view__touch-ghost")).toBeNull();
		expect(document.body.classList.contains("tn-drag-active")).toBe(false);
	});
});
