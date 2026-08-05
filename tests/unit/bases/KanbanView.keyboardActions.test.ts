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
