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
		const resolveOffscreenTaskCard = jest.fn(() => null);
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
			resolveOffscreenTaskCard,
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

		config.resolveOffscreenCard("a.md", "next");
		expect(resolveOffscreenTaskCard).toHaveBeenCalledWith("a.md", "next");
	});
});

describe("TaskListView.resolveOffscreenTaskCard", () => {
	function makeView(items: unknown[], ensureIndexRendered: jest.Mock) {
		return {
			virtualScroller: {
				getItems: () => items,
				ensureIndexRendered,
			},
			getVirtualItemPath: (item: any) =>
				"type" in item ? (item.type === "task" ? item.task.path : null) : item.path,
		};
	}

	it("mounts and returns the next item beyond the current path", () => {
		const items = [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }];
		const element = document.createElement("div");
		const ensureIndexRendered = jest.fn(() => element);
		const view = makeView(items, ensureIndexRendered);

		const result = (TaskListView.prototype as any).resolveOffscreenTaskCard.call(
			view,
			"b.md",
			"next"
		);

		expect(ensureIndexRendered).toHaveBeenCalledWith(2);
		expect(result).toBe(element);
	});

	it("mounts and returns the previous item before the current path", () => {
		const items = [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }];
		const element = document.createElement("div");
		const ensureIndexRendered = jest.fn(() => element);
		const view = makeView(items, ensureIndexRendered);

		const result = (TaskListView.prototype as any).resolveOffscreenTaskCard.call(
			view,
			"b.md",
			"previous"
		);

		expect(ensureIndexRendered).toHaveBeenCalledWith(0);
		expect(result).toBe(element);
	});

	it("returns null when there is no virtual scroller", () => {
		const view = { virtualScroller: null };

		const result = (TaskListView.prototype as any).resolveOffscreenTaskCard.call(
			view,
			"a.md",
			"next"
		);

		expect(result).toBeNull();
	});

	it("returns null when the current path can't be located and direction isn't first/last", () => {
		const items = [{ path: "a.md" }];
		const ensureIndexRendered = jest.fn();
		const view = makeView(items, ensureIndexRendered);

		const result = (TaskListView.prototype as any).resolveOffscreenTaskCard.call(
			view,
			"missing.md",
			"next"
		);

		expect(result).toBeNull();
		expect(ensureIndexRendered).not.toHaveBeenCalled();
	});

	it("skips over group-header pseudo-items when searching forward", () => {
		const items = [
			{ type: "task", task: { path: "a.md" } },
			{ type: "primary-header", groupKey: "g2" },
			{ type: "task", task: { path: "b.md" } },
		];
		const element = document.createElement("div");
		const ensureIndexRendered = jest.fn(() => element);
		const view = makeView(items, ensureIndexRendered);

		const result = (TaskListView.prototype as any).resolveOffscreenTaskCard.call(
			view,
			"a.md",
			"next"
		);

		expect(ensureIndexRendered).toHaveBeenCalledWith(2);
		expect(result).toBe(element);
	});

	it("jumps to the true first item for the 'first' direction regardless of current path", () => {
		const items = [{ path: "a.md" }, { path: "b.md" }];
		const element = document.createElement("div");
		const ensureIndexRendered = jest.fn(() => element);
		const view = makeView(items, ensureIndexRendered);

		const result = (TaskListView.prototype as any).resolveOffscreenTaskCard.call(
			view,
			"b.md",
			"first"
		);

		expect(ensureIndexRendered).toHaveBeenCalledWith(0);
		expect(result).toBe(element);
	});

	it("returns null when already at the true edge for the requested direction", () => {
		const items = [{ path: "a.md" }, { path: "b.md" }];
		const ensureIndexRendered = jest.fn();
		const view = makeView(items, ensureIndexRendered);

		const result = (TaskListView.prototype as any).resolveOffscreenTaskCard.call(
			view,
			"a.md",
			"first"
		);

		expect(result).toBeNull();
		expect(ensureIndexRendered).not.toHaveBeenCalled();
	});
});

describe("TaskListView.getVisibleTaskPaths", () => {
	it("returns the full flattened virtual item order when virtualization is active", () => {
		const view = {
			useVirtualScrolling: true,
			lastVirtualItems: [{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }],
			getVirtualItemPath: (item: any) => item.path,
		};

		const result = (TaskListView.prototype as any).getVisibleTaskPaths.call(view);

		expect(result).toEqual(["a.md", "b.md", "c.md"]);
	});

	it("falls back to the DOM query when virtualization is not active", () => {
		const rootElement = document.createElement("div");
		const card = document.createElement("div");
		card.className = "task-card";
		card.dataset.taskPath = "dom-only.md";
		rootElement.appendChild(card);
		const view = {
			useVirtualScrolling: false,
			lastVirtualItems: [],
			rootElement,
		};

		const result = (TaskListView.prototype as any).getVisibleTaskPaths.call(view);

		expect(result).toEqual(["dom-only.md"]);
	});
});
