/**
 * Dragging swimlane row labels to reorder rows. Superseded PR #1862 (issue #2285).
 */

import { KanbanView } from "../../../src/bases/KanbanView";
import { reorderKanbanSwimLaneKeys } from "../../../src/bases/kanbanGrouping";

const SWIMLANE_TYPE = "text/x-kanban-swimlane";
const COLUMN_TYPE = "text/x-kanban-column";

describe("reorderKanbanSwimLaneKeys", () => {
	it("keeps rows hidden by a filter in place on the first reorder", () => {
		expect(
			reorderKanbanSwimLaneKeys({
				currentOrder: ["a", "hidden", "b", "c"],
				visibleOrder: ["a", "b", "c"],
				draggedKey: "c",
				targetKey: "a",
			})
		).toEqual(["c", "hidden", "a", "b"]);
	});

	it("removes duplicate keys", () => {
		expect(
			reorderKanbanSwimLaneKeys({
				currentOrder: ["a", "b", "a", "c"],
				visibleOrder: ["a", "b", "c"],
				draggedKey: "a",
				targetKey: "c",
			})
		).toEqual(["b", "c", "a"]);
	});

	it("appends visible rows missing from the current order", () => {
		expect(
			reorderKanbanSwimLaneKeys({
				currentOrder: ["a", "b"],
				visibleOrder: ["a", "b", "new"],
				draggedKey: "new",
				targetKey: "a",
			})
		).toEqual(["new", "a", "b"]);
	});

	it("returns null for drops that change nothing", () => {
		const base = { currentOrder: ["a", "b"], visibleOrder: ["a", "b"] };
		expect(reorderKanbanSwimLaneKeys({ ...base, draggedKey: "a", targetKey: "a" })).toBeNull();
		expect(reorderKanbanSwimLaneKeys({ ...base, draggedKey: "x", targetKey: "a" })).toBeNull();
	});
});

function makeConfig(initial: Record<string, unknown>) {
	const values: Record<string, unknown> = { ...initial };
	return {
		values,
		get: jest.fn((key: string) => values[key]),
		set: jest.fn((key: string, value: unknown) => {
			values[key] = value;
		}),
		getAsPropertyId: jest.fn((key: string) => (values[key] as string) ?? null),
	};
}

function makeView(config: ReturnType<typeof makeConfig>) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const view = new KanbanView({}, container, {
		app: {},
		fieldMapper: { toUserField: (field: string) => field, isRecognizedProperty: () => true },
		priorityManager: { getAllPriorities: () => [], getPriorityWeight: () => 0 },
		statusManager: { getStatusOrder: () => 0 },
		settings: { customStatuses: [], fieldMapping: { sortOrder: "sort_order" } },
	} as any);
	const state = view as any;
	state.config = config;
	state.readViewOptions();
	state.boardEl = container;
	state.render = jest.fn(async () => undefined);
	return { state, container };
}

function dragEvent(type: string, dataType: string, data = "") {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, "dataTransfer", {
		value: { types: [dataType], getData: () => data, dropEffect: "none" },
	});
	return event;
}

function addLabel(state: any, container: HTMLElement, key: string) {
	const label = container.createDiv({
		cls: "kanban-view__swimlane-label",
		attr: { "data-swimlane-key": key },
	});
	state.setupSwimLaneLabelDragHandlers(label, key);
	return label;
}

describe("KanbanView swimlane row drag", () => {
	it("saves the new row order and restores it when the view reloads", async () => {
		const config = makeConfig({ swimLane: "note.project" });
		const { state, container } = makeView(config);
		state.currentSwimLaneOrder = ["alpha", "hidden", "beta", "gamma"];
		addLabel(state, container, "alpha");
		addLabel(state, container, "beta");
		const gamma = addLabel(state, container, "gamma");

		const alpha = container.querySelector<HTMLElement>('[data-swimlane-key="alpha"]')!;
		alpha.dispatchEvent(dragEvent("drop", SWIMLANE_TYPE, "gamma"));
		await Promise.resolve();

		expect(config.set).toHaveBeenCalledWith(
			"swimLaneOrder",
			JSON.stringify({ "note.project": ["gamma", "hidden", "alpha", "beta"] })
		);
		expect(state.render).toHaveBeenCalled();
		expect(gamma.classList.contains("kanban-view__swimlane-label--dragover")).toBe(false);

		const reloaded = makeView(config).state;
		expect(
			reloaded.applySwimLaneOrder("note.project", ["alpha", "beta", "gamma", "hidden"])
		).toEqual(["gamma", "hidden", "alpha", "beta"]);
	});

	it("ignores card and column drags on row labels", () => {
		const config = makeConfig({ swimLane: "note.project" });
		const { state, container } = makeView(config);
		const label = addLabel(state, container, "alpha");

		const columnDrop = dragEvent("drop", COLUMN_TYPE, "todo");
		label.dispatchEvent(columnDrop);
		const cardOver = dragEvent("dragover", "text/plain");
		label.dispatchEvent(cardOver);

		expect(columnDrop.defaultPrevented).toBe(false);
		expect(cardOver.defaultPrevented).toBe(false);
		expect(config.set).not.toHaveBeenCalled();
	});

	it("does not treat row drags as task drops on swimlane cells", () => {
		const config = makeConfig({ swimLane: "note.project" });
		const { state, container } = makeView(config);
		const cell = container.createDiv("kanban-view__swimlane-column");
		state.setupSwimLaneCellDragDrop(cell, "todo", "alpha");

		const over = dragEvent("dragover", SWIMLANE_TYPE, "beta");
		cell.dispatchEvent(over);
		const drop = dragEvent("drop", SWIMLANE_TYPE, "beta");
		cell.dispatchEvent(drop);

		expect(over.defaultPrevented).toBe(false);
		expect(drop.defaultPrevented).toBe(false);
		expect(cell.classList.contains("kanban-view__swimlane-column--dragover")).toBe(false);
	});
});

describe("KanbanView swimlane row drag during a search", () => {
	const lanes = ["A", "B", "C", "D"];
	const tasks = lanes.map((lane) => ({
		path: `Tasks/${lane}.md`,
		title: lane,
		status: "open",
		priority: "normal",
		archived: false,
		lane,
	}));

	async function renderLanes(state: any, visibleLanes: string[]) {
		const visible = tasks.filter((task) => visibleLanes.includes(task.lane));
		state.renderSwimLaneTable = jest.fn(async () => undefined);
		state.getSwimLaneKeys = (task: { lane: string }) => [task.lane];
		await state.renderWithSwimLanes(
			new Map([["open", visible]]),
			visible,
			new Map([["open", tasks]]),
			tasks,
			new Map(),
			"note.status"
		);
		return Array.from(state.renderSwimLaneTable.mock.calls[0][0].keys());
	}

	it("keeps search-hidden lanes hidden and in place after a drag", async () => {
		const config = makeConfig({ swimLane: "note.lane" });
		const { state, container } = makeView(config);
		state.findStatusConfigForGroupKey = () => undefined;

		expect(await renderLanes(state, ["B", "D"])).toEqual(["B", "D"]);
		addLabel(state, container, "B");
		addLabel(state, container, "D");
		container
			.querySelector<HTMLElement>('[data-swimlane-key="B"]')!
			.dispatchEvent(dragEvent("drop", SWIMLANE_TYPE, "D"));
		await Promise.resolve();

		expect(JSON.parse(config.values.swimLaneOrder as string)).toEqual({
			"note.lane": ["A", "D", "C", "B"],
		});
		expect(await renderLanes(state, ["B", "D"])).toEqual(["D", "B"]);
		expect(await renderLanes(state, lanes)).toEqual(["A", "D", "C", "B"]);
	});
});
