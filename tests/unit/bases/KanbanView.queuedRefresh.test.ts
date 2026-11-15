import { KanbanView } from "../../../src/bases/KanbanView";

describe("Kanban queued refresh during drag", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("defers an already queued refresh and renders after the drag ends", async () => {
		const view = Object.assign(Object.create(KanbanView.prototype), {
			containerEl: document.createElement("div"),
			updateDebounceTimer: null,
			draggedTaskPath: null as string | null,
			pendingRender: false,
			activeDropCount: 0,
			suppressRenderUntil: 0,
			debugLog: jest.fn(),
			getEphemeralState: jest.fn(() => ({ scrollTop: 25 })),
			setEphemeralState: jest.fn(),
			render: jest.fn().mockResolvedValue(undefined),
		});
		view.debouncedRefresh();
		view.draggedTaskPath = "tasks/Dragged.md";
		jest.advanceTimersByTime(150);
		expect(view.render).not.toHaveBeenCalled();
		expect(view.pendingRender).toBe(true);
		expect(view.updateDebounceTimer).toBeNull();
		view.draggedTaskPath = null;
		view.pendingRender = false;
		view.debouncedRefresh();
		jest.advanceTimersByTime(150);
		await Promise.resolve();
		expect(view.render).toHaveBeenCalledTimes(1);
		expect(view.getEphemeralState).not.toHaveBeenCalled();
		expect(view.setEphemeralState).not.toHaveBeenCalled();
	});
});
