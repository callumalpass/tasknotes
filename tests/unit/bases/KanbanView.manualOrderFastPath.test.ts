import { KanbanView } from "../../../src/bases/KanbanView";
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

	it("does not fast-patch manual order drops for virtualized columns", () => {
		const view = makeView();
		(view as any).columnScrollers.set("todo", { updateItems: jest.fn() });

		expect(
			(view as any).canFastPatchManualOrderDrop(
				{ optimisticReorderApplied: true, draggedPaths: ["tasks/c.md"] },
				{ taskPath: "tasks/a.md", above: false },
				["tasks/c.md"],
				"todo",
				null
			)
		).toBe(false);
	});

	it("does not force virtual scroller item updates during the fast path", () => {
		const view = makeView();
		const taskA = createTask("tasks/a.md", "old-a");
		const taskB = createTask("tasks/b.md", "old-b");
		const taskC = createTask("tasks/c.md", "old-c");
		const updateItems = jest.fn();
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
		(view as any).columnScrollers.set("todo", { updateItems });
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
		expect(updateItems).not.toHaveBeenCalled();
		expect(taskA.sortOrder).toBe("tnaaaaaaaaaa");
		expect(taskC.sortOrder).toBe("tnmzzzzzzzzz");
	});
});
