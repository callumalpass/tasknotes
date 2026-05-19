import {
	applySortOrderUpdatesToItems,
	applySortOrderUpdatesToTaskCache,
	buildSortOrderUpdateMap,
	moveItemsRelativeToTarget,
	movePathsRelativeToTarget,
} from "../../../src/bases/manualOrderState";
import type { TaskInfo } from "../../../src/types";

function createTask(path: string, sortOrder?: string): TaskInfo {
	return {
		title: path,
		status: "open",
		priority: "normal",
		path,
		sortOrder,
		archived: false,
	};
}

describe("manualOrderState", () => {
	it("builds sort-order updates for dragged and additional writes", () => {
		const updates = buildSortOrderUpdateMap("Tasks/a.md", {
			sortOrder: "tn0000000001",
			additionalWrites: [
				{ path: "Tasks/b.md", sortOrder: "tn0000000002" },
				{ path: "Tasks/c.md", sortOrder: "tn0000000003" },
			],
			reason: "rebalance",
		});

		expect(Array.from(updates.entries())).toEqual([
			["Tasks/a.md", "tn0000000001"],
			["Tasks/b.md", "tn0000000002"],
			["Tasks/c.md", "tn0000000003"],
		]);
	});

	it("applies sort-order updates to cached tasks and item tasks", () => {
		const first = createTask("Tasks/a.md");
		const second = createTask("Tasks/b.md");
		const cache = new Map([
			[first.path, first],
			[second.path, second],
		]);
		const updates = new Map([
			[first.path, "tn0000000010"],
			[second.path, "tn0000000020"],
		]);
		const cacheUpdates: string[] = [];
		const itemUpdates: string[] = [];

		applySortOrderUpdatesToTaskCache(cache, updates, (task) => {
			cacheUpdates.push(task.path);
		});
		applySortOrderUpdatesToItems(
			[{ task: first }, { task: second }],
			(item) => item.task,
			updates,
			(task) => {
				itemUpdates.push(task.path);
			}
		);

		expect(first.sortOrder).toBe("tn0000000010");
		expect(second.sortOrder).toBe("tn0000000020");
		expect(cacheUpdates).toEqual(["Tasks/a.md", "Tasks/b.md"]);
		expect(itemUpdates).toEqual(["Tasks/a.md", "Tasks/b.md"]);
	});

	it("moves paths relative to a target while preserving dragged path order", () => {
		expect(
			movePathsRelativeToTarget(
				["Tasks/a.md", "Tasks/b.md", "Tasks/c.md", "Tasks/d.md"],
				["Tasks/a.md", "Tasks/c.md"],
				"Tasks/d.md",
				true
			)
		).toEqual(["Tasks/b.md", "Tasks/a.md", "Tasks/c.md", "Tasks/d.md"]);
		expect(
			movePathsRelativeToTarget(["Tasks/a.md", "Tasks/b.md"], ["Tasks/a.md"], "Tasks/a.md", true)
		).toBeNull();
	});

	it("moves items relative to a target by item path", () => {
		const items = [
			{ path: "Tasks/a.md" },
			{ path: "Tasks/b.md" },
			{ path: "Tasks/c.md" },
			{ path: "Tasks/d.md" },
		];

		const moved = moveItemsRelativeToTarget(
			items,
			(item) => item.path,
			["Tasks/b.md", "Tasks/c.md"],
			"Tasks/d.md",
			false
		);

		expect(moved?.map((item) => item.path)).toEqual([
			"Tasks/a.md",
			"Tasks/d.md",
			"Tasks/b.md",
			"Tasks/c.md",
		]);
		expect(
			moveItemsRelativeToTarget(items, (item) => item.path, ["Tasks/b.md"], "Tasks/missing.md", true)
		).toBeNull();
	});
});
