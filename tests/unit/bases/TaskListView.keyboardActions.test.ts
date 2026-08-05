import { TaskListView } from "../../../src/bases/TaskListView";

jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);

describe("TaskListView keyboard actions", () => {
	it("creates search controls on demand before focusing them", () => {
		const rootElement = document.createElement("div");
		const focus = jest.fn();
		const view = {
			rootElement,
			searchBox: null,
			searchOpenedByShortcut: false,
			enableSearch: false,
			setupSearch: jest.fn(function (this: { searchBox: { focus: () => void } | null }) {
				this.searchBox = { focus };
			}),
		};

		(TaskListView.prototype as any).focusTaskListSearch.call(view);

		expect(view.searchOpenedByShortcut).toBe(true);
		expect(view.enableSearch).toBe(true);
		expect(view.setupSearch).toHaveBeenCalledWith(rootElement);
		expect(focus).toHaveBeenCalled();
	});

	it("wires the shared keyboard controller to Task List state and callbacks", () => {
		const showBatchContextMenu = jest.fn();
		const createFileForView = jest.fn();
		const focusTaskListSearch = jest.fn();
		const itemsContainer = document.createElement("div");
		const rootElement = document.createElement("div");
		const currentTargetDate = new Date("2026-08-02T00:00:00.000Z");
		const mockThis = {
			plugin: { taskSelectionService: {} },
			app: undefined,
			currentTargetDate,
			rootElement,
			itemsContainer,
			currentVisibleTaskPaths: new Set(["a.md"]),
			showBatchContextMenu,
			createFileForView,
			focusTaskListSearch,
		};

		const config = (TaskListView.prototype as any).getTaskCardActionsConfig.call(mockThis);
		expect(config.autoFocusInitial).toBe(true);
		expect(config.isActionSupported("delete-tasks")).toBe(true);

		const viewContext = config.buildViewContext();
		expect(viewContext.plugin).toBe(mockThis.plugin);
		expect(viewContext.taskSelectionService).toBe(mockThis.plugin.taskSelectionService);
		expect(viewContext.rootElement).toBe(rootElement);
		expect(viewContext.fallbackAnchor).toBe(itemsContainer);
		expect(viewContext.getCurrentTargetDate()).toBe(currentTargetDate);
		expect(viewContext.isPathVisible("a.md")).toBe(true);
		expect(viewContext.isPathVisible("b.md")).toBe(false);
		expect(viewContext.getVisibleTaskPaths()).toEqual(["a.md"]);

		viewContext.showBatchContextMenu({} as any);
		expect(showBatchContextMenu).toHaveBeenCalled();
		viewContext.createFileForView();
		expect(createFileForView).toHaveBeenCalled();
		viewContext.focusSearch?.();
		expect(focusTaskListSearch).toHaveBeenCalled();
	});
});
