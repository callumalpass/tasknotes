import {
	addPinnedColumnGroups,
	normalizePinnedColumnConfig,
	orderColumnsWithPinnedColumns,
	shouldRenderKanbanColumn,
} from "../../../src/bases/KanbanView";
import type { TaskInfo } from "../../../src/types";

function task(path: string): TaskInfo {
	return {
		title: path,
		status: "open",
		priority: "normal",
		path,
		archived: false,
	};
}

describe("issue #1784 Kanban pinned columns", () => {
	it("normalizes comma-separated pinned column values", () => {
		expect(normalizePinnedColumnConfig("to-do, in-progress, done, done, ")).toEqual([
			"to-do",
			"in-progress",
			"done",
		]);
	});

	it("normalizes array and JSON-array pinned column values", () => {
		expect(normalizePinnedColumnConfig(["backlog", "to-do", "backlog", ""])).toEqual([
			"backlog",
			"to-do",
		]);
		expect(normalizePinnedColumnConfig('["backlog","done","backlog"]')).toEqual([
			"backlog",
			"done",
		]);
	});

	it("adds empty groups for missing pinned columns", () => {
		const groups = new Map<string, TaskInfo[]>([["to-do", [task("a.md")]]]);

		addPinnedColumnGroups(groups, ["to-do", "done"]);

		expect(Array.from(groups.keys())).toEqual(["to-do", "done"]);
		expect(groups.get("done")).toEqual([]);
	});

	it("orders pinned columns first when there is no saved drag order", () => {
		expect(
			orderColumnsWithPinnedColumns(
				["review", "done", "to-do", "backlog"],
				["to-do", "done"]
			)
		).toEqual(["to-do", "done", "backlog", "review"]);
	});

	it("keeps pinned empty columns visible when empty columns are hidden", () => {
		expect(shouldRenderKanbanColumn(true, "done", [], ["done"])).toBe(true);
		expect(shouldRenderKanbanColumn(true, "review", [], ["done"])).toBe(false);
		expect(shouldRenderKanbanColumn(true, "review", [task("a.md")], ["done"])).toBe(true);
	});
});
