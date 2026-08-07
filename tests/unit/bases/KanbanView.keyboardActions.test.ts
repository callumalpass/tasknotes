import { KanbanView } from "../../../src/bases/KanbanView";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);

describe("KanbanView keyboard actions", () => {
	it("wires the shared keyboard controller to Kanban board state and callbacks", () => {
		const showBatchContextMenu = jest.fn();
		const createFileForView = jest.fn();
		const boardEl = document.createElement("div");
		const rootElement = document.createElement("div");
		const mockThis = {
			plugin: { taskSelectionService: {} },
			app: undefined,
			boardEl,
			rootElement,
			currentVisibleTaskPaths: new Set(["a.md"]),
			searchBox: null,
			enableSearch: false,
			setupSearch: jest.fn(function (this: { searchBox: { focus: () => void } | null }) {
				this.searchBox = { focus: jest.fn() };
			}),
			showBatchContextMenu,
			createFileForView,
		};

		const config = (KanbanView.prototype as any).getTaskCardActionsConfig.call(mockThis);
		expect(config.isActionSupported("delete-tasks")).toBe(true);
		expect(config.cardAreaElement).toBe(boardEl);

		const viewContext = config.buildViewContext();
		expect(viewContext.plugin).toBe(mockThis.plugin);
		expect(viewContext.taskSelectionService).toBe(mockThis.plugin.taskSelectionService);
		expect(viewContext.rootElement).toBe(rootElement);
		expect(viewContext.fallbackAnchor).toBe(boardEl);
		expect(viewContext.isPathVisible("a.md")).toBe(true);
		expect(viewContext.isPathVisible("b.md")).toBe(false);
		expect(viewContext.getVisibleTaskPaths()).toEqual(["a.md"]);

		const targetDate = viewContext.getCurrentTargetDate();
		expect(targetDate.getUTCHours()).toBe(0);

		viewContext.showBatchContextMenu({} as any);
		expect(showBatchContextMenu).toHaveBeenCalled();
		viewContext.createFileForView();
		expect(createFileForView).toHaveBeenCalled();

		viewContext.focusSearch?.();
		expect(mockThis.setupSearch).toHaveBeenCalledWith(rootElement);
		expect(mockThis.enableSearch).toBe(true);
	});
});

describe("KanbanView.getVisibleTaskPaths", () => {
	it("returns the full board in true visual order via getCurrentVisibleTaskPathOrder", () => {
		const view = {
			currentVisibleTaskOrder: new Map([
				["a.md", 0],
				["b.md", 1],
				["c.md", 2],
			]),
			getCurrentVisibleTaskPathOrder: (KanbanView.prototype as any)
				.getCurrentVisibleTaskPathOrder,
		};

		const result = (KanbanView.prototype as any).getVisibleTaskPaths.call(view);

		expect(result).toEqual(["a.md", "b.md", "c.md"]);
	});
});

describe("KanbanView.setVisibleTaskPathOrder", () => {
	it("updates only currentVisibleTaskPaths/currentVisibleTaskOrder, leaving subtask-expansion scope untouched", () => {
		const view = {
			currentVisibleTaskPaths: new Set(["stale.md"]),
			currentVisibleTaskOrder: new Map([["stale.md", 0]]),
			expandedRelationshipTaskPaths: new Set(["kept.md"]),
			expandedRelationshipTaskOrder: new Map([["kept.md", 0]]),
		};

		(KanbanView.prototype as any).setVisibleTaskPathOrder.call(view, ["a.md", "b.md"]);

		expect([...view.currentVisibleTaskPaths]).toEqual(["a.md", "b.md"]);
		expect([...view.currentVisibleTaskOrder.entries()]).toEqual([
			["a.md", 0],
			["b.md", 1],
		]);
		expect([...view.expandedRelationshipTaskPaths]).toEqual(["kept.md"]);
		expect([...view.expandedRelationshipTaskOrder.entries()]).toEqual([["kept.md", 0]]);
	});
});
