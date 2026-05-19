import { KanbanView } from "../../../src/bases/KanbanView";
import type { KanbanTaskDropUpdatePlan } from "../../../src/bases/kanbanDragUtils";
import type { SortOrderPlan } from "../../../src/bases/sortOrderUtils";
import type { TaskInfo } from "../../../src/types";

function createTask(path: string, sortOrder: string): TaskInfo {
	return {
		title: path,
		status: "todo",
		priority: "normal",
		path,
		archived: false,
		sortOrder,
	};
}

function makeView(): KanbanView {
	return new KanbanView(
		{},
		document.createElement("div"),
		{
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
		} as any
	);
}

function createStatusDropPlan(
	path: string,
	sourceColumn: string,
	newGroupValue: string
): KanbanTaskDropUpdatePlan {
	return {
		path,
		sourceColumn,
		sourceSwimlane: null,
		needsGroupUpdate: sourceColumn !== newGroupValue,
		needsSwimlaneUpdate: false,
		groupByFrontmatterKey: "status",
		groupByTaskProp: "status",
		swimlaneTaskProp: null,
		changedTaskProp: "status",
		oldPropValue: sourceColumn,
		newPropValue: newGroupValue,
		newGroupValue,
		newSwimLaneValue: null,
		isGroupByListProperty: false,
		isSwimlaneListProperty: false,
	};
}

describe("KanbanView manual-order fast path", () => {
	it("patches sort-order cache and visible scope order after a same-column optimistic drop", () => {
		const view = makeView();
		const taskA = createTask("tasks/a.md", "old-a");
		const taskB = createTask("tasks/b.md", "old-b");
		const taskC = createTask("tasks/c.md", "old-c");
		const plan: SortOrderPlan = {
			sortOrder: "tnmzzzzzzzzz",
			additionalWrites: [
				{ path: "tasks/a.md", sortOrder: "tnaaaaaaaaaa" },
				{ path: "tasks/b.md", sortOrder: "tnzzzzzzzzzz" },
			],
			reason: "rebalance",
		};

		(view as any).taskInfoCache.set(taskA.path, taskA);
		(view as any).taskInfoCache.set(taskB.path, taskB);
		(view as any).taskInfoCache.set(taskC.path, taskC);
		(view as any).sortScopeTaskPaths.set("todo", [
			"tasks/a.md",
			"tasks/b.md",
			"tasks/c.md",
		]);
		(view as any).setCurrentVisibleTaskPaths([taskA, taskB, taskC]);

		const result = (view as any).applyOptimisticSortOrderResult(
			"tasks/c.md",
			"tasks/a.md",
			false,
			"todo",
			null,
			plan
		);

		expect(result).toBe(true);
		expect((view as any).sortScopeTaskPaths.get("todo")).toEqual([
			"tasks/a.md",
			"tasks/c.md",
			"tasks/b.md",
		]);
		expect((view as any).currentVisibleTaskOrder.get("tasks/c.md")).toBe(1);
		expect(taskA.sortOrder).toBe("tnaaaaaaaaaa");
		expect(taskB.sortOrder).toBe("tnzzzzzzzzzz");
		expect(taskC.sortOrder).toBe("tnmzzzzzzzzz");
	});

	it("declines the fast path when the drop scope is not tracked", () => {
		const view = makeView();
		const taskA = createTask("tasks/a.md", "old-a");
		const taskB = createTask("tasks/b.md", "old-b");
		const plan: SortOrderPlan = {
			sortOrder: "tnmzzzzzzzzz",
			additionalWrites: [],
			reason: "midpoint",
		};
		(view as any).setCurrentVisibleTaskPaths([taskA, taskB]);

		expect(
			(view as any).applyOptimisticSortOrderResult(
				"tasks/b.md",
				"tasks/a.md",
				false,
				"todo",
				null,
				plan
			)
		).toBe(false);
	});

	it("allows virtualized columns to fast-patch manual order drops", () => {
		const view = makeView();
		(view as any).columnScrollers.set("todo", { reorderItems: jest.fn() });

		expect(
			(view as any).canFastPatchManualOrderDrop(
				{ draggedPaths: ["tasks/c.md"] },
				{ taskPath: "tasks/a.md", above: false },
				["tasks/c.md"],
				"todo",
				null
			)
			).toBe(true);
	});

	it("only allows single-card cross-column drops to use the local patch path", () => {
		const view = makeView();

		expect((view as any).canFastPatchCrossScopeDrop({}, ["tasks/a.md"])).toBe(true);
		expect(
			(view as any).canFastPatchCrossScopeDrop(
				{ draggedPaths: ["tasks/a.md", "tasks/b.md"] },
				["tasks/a.md", "tasks/b.md"]
			)
		).toBe(false);
	});

	it("uses the virtual scroller reorder API during the fast path", () => {
		const view = makeView();
		const taskA = createTask("tasks/a.md", "old-a");
		const taskB = createTask("tasks/b.md", "old-b");
		const taskC = createTask("tasks/c.md", "old-c");
		const reorderItems = jest.fn().mockReturnValue(true);
		const getItems = jest.fn().mockReturnValue([taskA, taskB, taskC]);
		const invalidateItems = jest.fn();
		const plan: SortOrderPlan = {
			sortOrder: "tnmzzzzzzzzz",
			additionalWrites: [{ path: "tasks/a.md", sortOrder: "tnaaaaaaaaaa" }],
			reason: "rebalance",
		};

		(view as any).taskInfoCache.set(taskA.path, taskA);
		(view as any).taskInfoCache.set(taskB.path, taskB);
		(view as any).taskInfoCache.set(taskC.path, taskC);
		(view as any).sortScopeTaskPaths.set("todo", [
			"tasks/a.md",
			"tasks/b.md",
			"tasks/c.md",
		]);
		(view as any).columnScrollers.set("todo", {
			getItems,
			invalidateItems,
			reorderItems,
		});
		(view as any).setCurrentVisibleTaskPaths([taskA, taskB, taskC]);

		const result = (view as any).applyOptimisticSortOrderResult(
			"tasks/c.md",
			"tasks/a.md",
			false,
			"todo",
			null,
			plan
		);

		expect(result).toBe(true);
		expect(reorderItems).toHaveBeenCalledWith({
			movedKeys: ["tasks/c.md"],
			targetKey: "tasks/a.md",
			position: "after",
		});
		expect(invalidateItems).toHaveBeenCalledWith(["tasks/c.md", "tasks/a.md"]);
		expect(taskA.sortOrder).toBe("tnaaaaaaaaaa");
		expect(taskC.sortOrder).toBe("tnmzzzzzzzzz");
	});

	it("patches cross-column drops through virtual scrollers after a successful write", () => {
		const view = makeView();
		const taskA = createTask("tasks/a.md", "old-a");
		const taskB = createTask("tasks/b.md", "old-b");
		const taskC = createTask("tasks/c.md", "old-c");
		const updatedTaskC = { ...taskC, status: "done" };
		const sourceScroller = {
			canRemoveItems: jest.fn().mockReturnValue(true),
			getItems: jest.fn().mockReturnValue([taskA]),
			invalidateItems: jest.fn(),
			removeItems: jest.fn().mockReturnValue(true),
		};
		const targetScroller = {
			canInsertItems: jest.fn().mockReturnValue(true),
			getItems: jest.fn().mockReturnValue([taskB, updatedTaskC]),
			insertItems: jest.fn().mockReturnValue(true),
			invalidateItems: jest.fn(),
		};
		const plan: SortOrderPlan = {
			sortOrder: "tnmzzzzzzzzz",
			additionalWrites: [{ path: "tasks/b.md", sortOrder: "tnaaaaaaaaaa" }],
			reason: "rebalance",
		};

		(view as any).taskInfoCache.set(taskA.path, taskA);
		(view as any).taskInfoCache.set(taskB.path, taskB);
		(view as any).taskInfoCache.set(taskC.path, taskC);
		(view as any).sortScopeTaskPaths.set("todo", ["tasks/a.md", "tasks/c.md"]);
		(view as any).sortScopeTaskPaths.set("done", ["tasks/b.md"]);
		(view as any).setCurrentVisibleTaskPaths([taskA, taskC, taskB]);
		(view as any).columnScrollers.set("todo", sourceScroller);
		(view as any).columnScrollers.set("done", targetScroller);

		const result = (view as any).applySuccessfulKanbanDropLocally({
			path: "tasks/c.md",
			dropPlan: createStatusDropPlan("tasks/c.md", "todo", "done"),
			dropTarget: { taskPath: "tasks/b.md", above: false },
			sortOrderPlan: plan,
			updatedTask: updatedTaskC,
			optimisticReorderApplied: false,
		});

		expect(result).toBe(true);
		expect(sourceScroller.removeItems).toHaveBeenCalledWith(["tasks/c.md"]);
		expect(targetScroller.insertItems).toHaveBeenCalledWith({
			items: [
				expect.objectContaining({
					path: "tasks/c.md",
					status: "done",
					sortOrder: "tnmzzzzzzzzz",
				}),
			],
			targetKey: "tasks/b.md",
			position: "after",
		});
		expect((view as any).sortScopeTaskPaths.get("todo")).toEqual(["tasks/a.md"]);
		expect((view as any).sortScopeTaskPaths.get("done")).toEqual([
			"tasks/b.md",
			"tasks/c.md",
		]);
		expect((view as any).getCurrentVisibleTaskPathOrder()).toEqual([
			"tasks/a.md",
			"tasks/b.md",
			"tasks/c.md",
		]);
		expect((view as any).taskInfoCache.get("tasks/c.md").status).toBe("done");
		expect((view as any).taskInfoCache.get("tasks/b.md").sortOrder).toBe("tnaaaaaaaaaa");
	});

	it("falls back when a cross-column virtual scroller patch is not safe", () => {
		const view = makeView();
		const taskA = createTask("tasks/a.md", "old-a");
		const taskC = createTask("tasks/c.md", "old-c");
		const sourceScroller = {
			canRemoveItems: jest.fn().mockReturnValue(false),
		};

		(view as any).taskInfoCache.set(taskA.path, taskA);
		(view as any).taskInfoCache.set(taskC.path, taskC);
		(view as any).sortScopeTaskPaths.set("todo", ["tasks/a.md", "tasks/c.md"]);
		(view as any).sortScopeTaskPaths.set("done", []);
		(view as any).setCurrentVisibleTaskPaths([taskA, taskC]);
		(view as any).columnScrollers.set("todo", sourceScroller);

		const result = (view as any).applySuccessfulKanbanDropLocally({
			path: "tasks/c.md",
			dropPlan: createStatusDropPlan("tasks/c.md", "todo", "done"),
			sortOrderPlan: null,
			updatedTask: { ...taskC, status: "done" },
			optimisticReorderApplied: false,
		});

		expect(result).toBe(false);
		expect((view as any).sortScopeTaskPaths.get("todo")).toEqual([
			"tasks/a.md",
			"tasks/c.md",
		]);
		expect((view as any).taskInfoCache.get("tasks/c.md").status).toBe("todo");
	});
});
