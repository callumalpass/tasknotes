import { KanbanView } from "../../../src/bases/KanbanView";

function makeView() {
	return new KanbanView({}, document.createElement("div"), {
		app: {},
		fieldMapper: { toUserField: (field: string) => field, isRecognizedProperty: () => true },
		priorityManager: { getAllPriorities: () => [] },
		settings: { customStatuses: [], fieldMapping: { sortOrder: "manual_order" } },
		i18n: { translate: (descriptor: { message: string }) => descriptor.message },
	} as any) as any;
}

describe("Kanban drag feedback", () => {
	afterEach(() => jest.restoreAllMocks());
	it("restores both board axes synchronously without snapping the column navigator", () => {
		const view = makeView();
		view.rootElement = document.body.createDiv();
		view.boardEl = view.rootElement.createDiv();
		view.boardEl.scrollLeft = 2164;
		view.boardEl.scrollTop = 76;
		const saved = view.getEphemeralState();
		view.boardEl.scrollLeft = 0;
		view.boardEl.scrollTop = 0;
		view.setEphemeralState(saved);
		expect(view.boardEl.scrollLeft).toBe(2164);
		expect(view.boardEl.scrollTop).toBe(76);
	});

	it.each(["draggedTaskPath", "structureDragActive", "touchDragActive"])("defers direct renders during %s", async state => {
		const view = makeView();
		view.boardEl = document.createElement("div");
		view.rootElement = document.createElement("div");
		view.data = { data: [] };
		view[state] = state === "draggedTaskPath" ? "tasks/a.md" : true;
		await view.render();
		expect(view.pendingRender).toBe(true);
	});

	it("rejects formula targets before accepting a native drop", () => {
		const view = makeView();
		view.boardEl = document.createElement("div");
		jest.spyOn(view, "getGroupByPropertyId").mockReturnValue("formula.status");
		const preview = jest.spyOn(view.dragPreview, "setInvalid");
		const event = { dataTransfer: { dropEffect: "move" }, preventDefault: jest.fn(), stopImmediatePropagation: jest.fn() };
		view.updateNativeDropFeedback(event);
		expect(event.dataTransfer.dropEffect).toBe("none");
		expect(event.stopImmediatePropagation).toHaveBeenCalled();
		expect(view.boardEl.classList.contains("kanban-view__board--invalid-drop")).toBe(true);
		expect(preview).toHaveBeenCalledWith(expect.stringContaining("Formula values are computed"));
	});

	it("clears stale target and insertion feedback on leaving a cell", () => {
		const view = makeView();
		const preview = jest.spyOn(view.dragPreview, "setInvalid");
		view.boardEl = document.createElement("div");
		const column = document.createElement("div");
		column.className = "kanban-view__column kanban-view__column--dragover";
		const cards = document.createElement("div");
		cards.className = "kanban-view__cards kanban-view__cards--drop-marker-end";
		column.appendChild(cards);
		view.boardEl.appendChild(column);
		view.dragContainer = cards;
		jest.spyOn(view, "getGroupByPropertyId").mockReturnValue("note.status");
		view.updateNativeDropFeedback({ target: view.boardEl });
		expect(column.classList.contains("kanban-view__column--dragover")).toBe(false);
		expect(cards.classList.contains("kanban-view__cards--drop-marker-end")).toBe(false);
		expect(view.dragContainer).toBeNull();
		expect(view.boardEl.classList.contains("kanban-view__board--invalid-drop")).toBe(true);
		expect(preview).toHaveBeenCalledWith("Drop on a task row or group destination.");
	});

	it.each(["kanban-view__column", "kanban-view__swimlane-column"])("updates %s feedback on nested dragenter without waiting for dragover", columnClass => {
		const view = makeView();
		view.boardEl = document.createElement("div");
		view.draggedTaskPath = "tasks/source.md";
		const previous = document.createElement("div");
		previous.className = `${columnClass} ${columnClass}--dragover`;
		const destination = document.createElement("div");
		destination.className = columnClass;
		const card = document.createElement("div");
		card.className = "kanban-view__card-wrapper";
		const content = document.createElement("div");
		content.className = "task-card__main-row";
		card.appendChild(content);
		destination.appendChild(card);
		view.boardEl.append(previous, destination);
		jest.spyOn(view, "handleAutoScroll").mockImplementation(() => {});
		jest.spyOn(view, "getGroupByPropertyId").mockReturnValue("note.status");
		card.addEventListener("dragenter", event => event.stopPropagation());
		view.registerBoardListeners();

		const event = new MouseEvent("dragenter", { bubbles: true, cancelable: true, clientX: 100, clientY: 120 });
		const dataTransfer = { dropEffect: "none" };
		Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
		content.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(dataTransfer.dropEffect).toBe("move");
		expect(previous.classList.contains(`${columnClass}--dragover`)).toBe(false);
		expect(destination.classList.contains(`${columnClass}--dragover`)).toBe(true);
		view.unload();
	});

	it("touch previews never duplicate live task identities or selection rings", () => {
		const view = makeView();
		const source = document.createElement("div");
		source.className = "kanban-view__card-wrapper kanban-view__card--dragging kanban-view__touch-drag-source kanban-view__card-wrapper--selected-primary";
		source.dataset.taskPath = "tasks/a.md";
		const card = document.createElement("div");
		card.className = "task-card tn-task-focused task-card--selected";
		card.dataset.taskPath = "tasks/a.md";
		source.appendChild(card);
		view.draggedTaskPaths = ["tasks/a.md", "tasks/b.md"];
		const ghost = view.createTouchDragGhost(source, 100, 150);
		expect(ghost.dataset.dragCount).toBe("2");
		expect(ghost.querySelector("[data-task-path], .kanban-view__touch-drag-source, .tn-task-focused, .task-card--selected")).toBeNull();
		expect(ghost.getAttribute("aria-hidden")).toBe("true");
		ghost.remove();
	});

	it("does not restore a stale snapshot over scroll input received during a delayed refresh", async () => {
		jest.useFakeTimers();
		const view = makeView();
		view.rootElement = document.createElement("div");
		view.boardEl = document.createElement("div");
		let finish!: () => void;
		view.render = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
		const restore = jest.spyOn(view, "setEphemeralState");
		try {
			view.debouncedRefresh();
			jest.advanceTimersByTime(150);
			view.boardEl.scrollLeft = 90;
			finish();
			await Promise.resolve();
			expect(view.boardEl.scrollLeft).toBe(90);
			expect(restore).not.toHaveBeenCalled();
		} finally {
			view.unload();
			jest.useRealTimers();
		}
	});
});
