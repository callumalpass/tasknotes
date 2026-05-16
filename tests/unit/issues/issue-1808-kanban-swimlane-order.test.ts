import { KanbanView } from "../../../src/bases/KanbanView";
import type { TaskInfo } from "../../../src/types";

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

describe("Issue #1808: Kanban swimlane order", () => {
	it("pins configured swimlanes before unlisted values", () => {
		const view = makeView();
		(view as any).swimLaneOrders = {
			"note.contexts": ["transitcal", "bill", "cycles-research"],
		};
		(view as any).hideEmptySwimLanes = false;

		const ordered = (view as any).applySwimLaneOrder("note.contexts", [
			"astrolabe",
			"bill",
			"transitcal",
		]);

		expect(ordered).toEqual(["transitcal", "bill", "cycles-research", "astrolabe"]);
	});

	it("can hide configured swimlanes that currently have no tasks", () => {
		const view = makeView();
		(view as any).swimLaneOrders = {
			"note.contexts": ["transitcal", "bill", "cycles-research"],
		};
		(view as any).hideEmptySwimLanes = true;

		const ordered = (view as any).applySwimLaneOrder("note.contexts", ["astrolabe", "bill"]);

		expect(ordered).toEqual(["bill", "astrolabe"]);
	});

	it("creates empty swimlane rows for configured values when empty rows are visible", () => {
		const view = makeView();
		const task = { title: "Bill task", path: "Tasks/bill.md", status: "todo" } as TaskInfo;
		const billColumns = new Map<string, TaskInfo[]>([["todo", [task]]]);
		const swimLanes = new Map<string, Map<string, TaskInfo[]>>([["bill", billColumns]]);

		(view as any).swimLaneOrders = {
			"note.contexts": ["transitcal", "bill"],
		};
		(view as any).hideEmptySwimLanes = false;

		const ordered = (view as any).applySwimLaneOrderToMap(
			"note.contexts",
			swimLanes,
			["todo", "done"]
		);

		expect(Array.from(ordered.keys())).toEqual(["transitcal", "bill"]);
		expect(ordered.get("transitcal")?.get("todo")).toEqual([]);
		expect(ordered.get("transitcal")?.get("done")).toEqual([]);
		expect(ordered.get("bill")).toBe(billColumns);
	});

	it("reads JSON and object swimlane order configs", () => {
		const view = makeView();
		const configValues: Record<string, unknown> = {
			swimLane: "note.contexts",
			swimLaneOrder: '{"note.contexts":["transitcal","bill"]}',
			columnOrder: {
				"task.status": ["open", "done"],
			},
			hideEmptySwimLanes: true,
		};
		(view as any).config = {
			get: (key: string) => configValues[key],
			getAsPropertyId: (key: string) => configValues[key],
		};

		(view as any).readViewOptions();

		expect((view as any).swimLaneOrders).toEqual({
			"note.contexts": ["transitcal", "bill"],
		});
		expect((view as any).columnOrders).toEqual({
			"task.status": ["open", "done"],
		});
		expect((view as any).hideEmptySwimLanes).toBe(true);
	});
});
