import { KanbanView, shouldRenderKanbanColumn } from "../../../src/bases/KanbanView";

function makePlugin() {
	return {
		app: {},
		fieldMapper: {
			toUserField: (field: string) => field,
			isRecognizedProperty: () => true,
		},
		priorityManager: {
			getAllPriorities: () => [],
		},
		settings: {
			customStatuses: [],
			fieldMapping: {
				sortOrder: "sort_order",
			},
		},
	};
}

function makeView(): KanbanView {
	return new KanbanView({}, document.createElement("div"), makePlugin() as any);
}

describe("Issue #1446: Kanban custom columnOrder empty columns", () => {
	it("keeps configured custom columns even when no task currently has that value", () => {
		const view = makeView();
		(view as any).columnOrders = {
			"note.stage": ["todo", "doing", "done"],
		};
		(view as any).hideEmptyColumns = false;
		(view as any).pinnedColumns = [];

		const ordered = (view as any).applyColumnOrder("note.stage", ["doing"]);

		expect(ordered).toEqual(["todo", "doing", "done"]);
	});

	it("does not inject empty configured columns when empty columns are hidden", () => {
		const view = makeView();
		(view as any).columnOrders = {
			"note.stage": ["todo", "doing", "done"],
		};
		(view as any).hideEmptyColumns = true;
		(view as any).pinnedColumns = [];

		const ordered = (view as any).applyColumnOrder("note.stage", ["doing"]);

		expect(ordered).toEqual(["doing"]);
	});

	it("still lets hideEmptyColumns suppress unpinned configured columns", () => {
		expect(shouldRenderKanbanColumn(false, "todo", [], [])).toBe(true);
		expect(shouldRenderKanbanColumn(true, "todo", [], [])).toBe(false);
		expect(shouldRenderKanbanColumn(true, "todo", [], ["todo"])).toBe(true);
	});
});
