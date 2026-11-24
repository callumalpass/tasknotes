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

function startNativeDrag(view: ReturnType<typeof makeView>) {
	jest.useFakeTimers();
	const board = document.createElement("div");
	view.boardEl = board;
	view.draggedTaskPath = "tasks/source.md";
	const autoScroll = jest.spyOn(view, "handleAutoScroll").mockImplementation(() => {});
	view.registerBoardListeners();
	return { board, autoScroll };
}

function dispatchDrag(target: HTMLElement, type: string, clientY = 120) {
	const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 100, clientY });
	const dataTransfer = { dropEffect: "copy" };
	Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
	target.dispatchEvent(event);
	return { event, dataTransfer };
}

describe("Kanban drag feedback", () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});
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
		const { board, autoScroll } = startNativeDrag(view);
		const column = board.createDiv("kanban-view__column");
		jest.spyOn(view, "getGroupByPropertyId").mockReturnValue("formula.status");
		const preview = jest.spyOn(view.dragPreview, "setInvalid");
		const onDragOver = jest.fn();
		const onDrop = jest.fn();
		column.addEventListener("dragover", onDragOver);
		column.addEventListener("drop", onDrop);
		const { event, dataTransfer } = dispatchDrag(column, "dragover");
		expect(event.defaultPrevented).toBe(true);
		expect(dataTransfer.dropEffect).toBe("none");
		expect(onDragOver).not.toHaveBeenCalled();
		expect(autoScroll).not.toHaveBeenCalled();
		expect(preview).not.toHaveBeenCalled();

		jest.advanceTimersByTime(16);
		expect(board.classList.contains("kanban-view__board--invalid-drop")).toBe(true);
		expect(preview).toHaveBeenCalledWith(expect.stringContaining("Formula values are computed"));

		dispatchDrag(column, "dragover");
		expect(dispatchDrag(column, "drop").event.defaultPrevented).toBe(true);
		expect(onDrop).not.toHaveBeenCalled();
		jest.advanceTimersByTime(16);
		expect(autoScroll).toHaveBeenCalledTimes(1);
		view.unload();
	});

	it("clears stale target and insertion feedback on leaving a cell", () => {
		const view = makeView();
		const { board } = startNativeDrag(view);
		const preview = jest.spyOn(view.dragPreview, "setInvalid");
		const column = board.createDiv("kanban-view__column");
		const cards = column.createDiv("kanban-view__cards");
		jest.spyOn(view, "getGroupByPropertyId").mockReturnValue("note.status");
		jest.spyOn(view.dataAdapter, "getSortConfig").mockReturnValue([{ property: "manual_order" }]);
		dispatchDrag(column, "dragenter");
		jest.advanceTimersByTime(16);
		expect(column.classList.contains("kanban-view__column--dragover")).toBe(true);
		expect(cards.classList.contains("kanban-view__cards--drop-marker-end")).toBe(true);

		const { event, dataTransfer } = dispatchDrag(board, "dragover");
		expect(event.defaultPrevented).toBe(false);
		expect(dataTransfer.dropEffect).toBe("none");
		jest.advanceTimersByTime(16);
		expect(column.classList.contains("kanban-view__column--dragover")).toBe(false);
		expect(cards.classList.contains("kanban-view__cards--drop-marker-end")).toBe(false);
		expect(view.dragContainer).toBeNull();
		expect(board.classList.contains("kanban-view__board--invalid-drop")).toBe(true);
		expect(preview).toHaveBeenCalledWith("Drop on a task row or group destination.");
		view.unload();
	});

	it.each(["kanban-view__column", "kanban-view__swimlane-column"])("updates %s feedback on nested dragenter without waiting for dragover", columnClass => {
		const view = makeView();
		const { board } = startNativeDrag(view);
		const previous = board.createDiv(columnClass);
		const destination = board.createDiv(columnClass);
		const card = destination.createDiv("kanban-view__card-wrapper");
		const content = card.createDiv("task-card__main-row");
		jest.spyOn(view, "getGroupByPropertyId").mockReturnValue("note.status");
		card.addEventListener("dragenter", event => event.stopPropagation());
		dispatchDrag(previous, "dragenter");
		jest.advanceTimersByTime(16);
		expect(previous.classList.contains(`${columnClass}--dragover`)).toBe(true);

		const { event, dataTransfer } = dispatchDrag(content, "dragenter");
		expect(event.defaultPrevented).toBe(true);
		expect(dataTransfer.dropEffect).toBe("move");
		expect(destination.classList.contains(`${columnClass}--dragover`)).toBe(false);
		jest.advanceTimersByTime(16);
		expect(previous.classList.contains(`${columnClass}--dragover`)).toBe(false);
		expect(destination.classList.contains(`${columnClass}--dragover`)).toBe(true);
		view.unload();
	});

	it("uses only the last dragover in a frame while accepting every valid event immediately", () => {
		const view = makeView();
		const { board, autoScroll } = startNativeDrag(view);
		jest.spyOn(view, "getGroupByPropertyId").mockReturnValue("note.status");
		const firstColumn = board.createDiv("kanban-view__column");
		const lastColumn = board.createDiv("kanban-view__column");
		for (let index = 0; index < 100; index++) {
			const { event, dataTransfer } = dispatchDrag(firstColumn, "dragover", index);
			expect(event.defaultPrevented).toBe(true);
			expect(dataTransfer.dropEffect).toBe("move");
		}
		expect(dispatchDrag(lastColumn, "dragover", 200).event.defaultPrevented).toBe(true);
		expect(autoScroll).not.toHaveBeenCalled();

		jest.advanceTimersByTime(16);
		expect(autoScroll).toHaveBeenCalledTimes(1);
		expect(autoScroll).toHaveBeenCalledWith(100, 200);
		expect(firstColumn.classList.contains("kanban-view__column--dragover")).toBe(false);
		expect(lastColumn.classList.contains("kanban-view__column--dragover")).toBe(true);
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
