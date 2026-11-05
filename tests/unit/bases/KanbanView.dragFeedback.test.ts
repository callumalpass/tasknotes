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
});
