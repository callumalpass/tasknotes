import { KanbanView } from "../../../src/bases/KanbanView";
import * as helpers from "../../../src/bases/helpers";
import type { TaskInfo } from "../../../src/types";

function setupBoard() {
	const task: TaskInfo = {
		path: "tasks/a.md",
		title: "Prepare the presentation",
		status: "open",
		priority: "normal",
		archived: false,
	};
	// Bases entries hold references into the query engine; they are not render data.
	const entry: Record<string, unknown> = {};
	entry.query = entry;
	task.basesData = entry;
	const cachedTasks = new Map<string, TaskInfo>();
	const plugin = {
		app: {},
		fieldMapper: { toUserField: (field: string) => field },
		priorityManager: { getAllPriorities: () => [] },
		cacheManager: { getCachedTaskInfoSync: (path: string) => cachedTasks.get(path) },
		settings: { customStatuses: [], fieldMapping: { sortOrder: "sort_order" } },
	};
	const view = new KanbanView({}, document.createElement("div"), plugin as any);
	const internals = view as any;
	const board = document.createElement("div");
	document.body.appendChild(board);
	internals.rootElement = board;
	internals.boardEl = board;
	internals.data = { data: [] };
	internals.config = {
		getOrder: jest.fn(() => ["note.status", "formula.progress"]),
		getSort: jest.fn(() => []),
	};
	internals.dataAdapter.extractDataItems = jest.fn(() => [
		{ path: task.path, properties: { status: task.status }, basesData: entry },
	]);
	internals.dataAdapter.getComputedProperty = jest.fn(() => null);
	internals.readViewOptions = jest.fn();
	internals.setupSearch = jest.fn();
	internals.applySearchFilter = (tasks: TaskInfo[]) => tasks;
	internals.getGroupByPropertyId = () => "note.status";
	internals.getCardOptions = jest.fn(() => ({ propertyLabels: { status: "Status" } }));
	internals.groupTasks = jest.fn(() => new Map([["open", [task]]]));
	internals.renderError = jest.fn();
	internals.renderFlat = jest.fn(async () => {
		const card = board.createDiv({ cls: "task-card", attr: { "data-task-path": task.path } });
		card.textContent = task.title;
		card.createEl("button", { text: "Menu" });
	});
	jest.spyOn(helpers, "identifyTaskNotesFromBasesData").mockImplementation(async () => [
		{ ...task },
	]);
	return { view, internals, board, task, cachedTasks };
}

describe("Kanban render stability", () => {
	beforeEach(() => {
		jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		document.body.empty();
	});

	it("keeps cards and keyboard focus through repeated updates with unchanged board data", async () => {
		const { view, board, internals } = setupBoard();
		await view.render();
		const card = board.firstElementChild;
		const menu = board.querySelector("button")!;
		menu.focus();

		await view.render();
		await view.render();

		expect(internals.renderFlat).toHaveBeenCalledTimes(1);
		expect(board.firstElementChild).toBe(card);
		expect(document.activeElement).toBe(menu);
	});

	it("renders task edits and updated computed properties even when membership is unchanged", async () => {
		const { view, board, internals, task } = setupBoard();
		await view.render();
		const original = board.firstElementChild;
		task.title = "Present the revised proposal";
		await view.render();
		expect(board.firstElementChild).not.toBe(original);
		expect(board.textContent).toContain(task.title);

		internals.dataAdapter.getComputedProperty.mockReturnValue("75%");
		await view.render();
		expect(internals.renderFlat).toHaveBeenCalledTimes(3);
	});

	it("applies changed property labels, sorting and plugin presentation settings", async () => {
		const { view, internals } = setupBoard();
		await view.render();
		internals.getCardOptions.mockReturnValue({ propertyLabels: { status: "Stage" } });
		await view.render();
		internals.config.getSort.mockReturnValue([
			{ property: "note.priority", direction: "DESC" },
		]);
		await view.render();
		internals.plugin.settings.customStatuses = [{ value: "open", label: "Ready" }];
		await view.render();
		expect(internals.renderFlat).toHaveBeenCalledTimes(4);
	});

	it("refreshes an expanded related task that is outside the Bases results", async () => {
		const { view, board, task, cachedTasks, internals } = setupBoard();
		cachedTasks.set("tasks/child.md", {
			...task,
			path: "tasks/child.md",
			title: "Draft slides",
		});
		const render = internals.renderFlat.getMockImplementation();
		internals.renderFlat.mockImplementation(async () => {
			await render();
			board.firstElementChild!.createDiv({
				cls: "task-card",
				attr: { "data-task-path": "tasks/child.md" },
				text: cachedTasks.get("tasks/child.md")!.title,
			});
		});
		await view.render();
		await view.render();
		const previous = board.firstElementChild;
		await view.render();
		expect(board.firstElementChild).toBe(previous);
		cachedTasks.get("tasks/child.md")!.title = "Revised slides";
		await view.render();
		expect(board.textContent).toContain("Revised slides");
	});

	it("compares real Bases view configs, which link back to their query", async () => {
		const { view, internals, board } = setupBoard();
		const query: { views: Array<Record<string, unknown>> } = { views: [] };
		const boardConfig = {
			query,
			type: "tasknotesKanban",
			name: "Board",
			groupBy: { property: "note.status", direction: "ASC" },
			data: { columnWidth: 280 },
		};
		query.views.push(boardConfig);
		internals.basesController = { query, viewName: "Board" };

		await view.render();
		const card = board.firstElementChild;
		await view.render();
		expect(internals.renderFlat).toHaveBeenCalledTimes(1);
		expect(board.firstElementChild).toBe(card);

		boardConfig.data = { columnWidth: 320 };
		await view.render();
		boardConfig.groupBy = { property: "note.priority", direction: "ASC" };
		await view.render();
		expect(internals.renderFlat).toHaveBeenCalledTimes(3);
	});

	it("repaints after a drop even when the drop left the data unchanged", async () => {
		const { view, internals } = setupBoard();
		await view.render();

		jest.useFakeTimers({ doNotFake: ["Date"] });
		try {
			internals.schedulePostDropRender();
			await jest.advanceTimersByTimeAsync(1000);
		} finally {
			jest.useRealTimers();
		}

		expect(internals.renderFlat).toHaveBeenCalledTimes(2);
	});

	it("retries a failed render instead of treating the board as current", async () => {
		const { view, internals, board } = setupBoard();
		await view.render();
		jest.spyOn(helpers, "identifyTaskNotesFromBasesData").mockRejectedValueOnce(
			new Error("Temporary data failure")
		);
		internals.renderError.mockImplementation(() => board.empty());
		await view.render();
		expect(internals.renderError).toHaveBeenCalledTimes(1);
		await view.render();
		expect(board.querySelector(".task-card")).not.toBeNull();
		expect(internals.renderFlat).toHaveBeenCalledTimes(2);
	});
});
