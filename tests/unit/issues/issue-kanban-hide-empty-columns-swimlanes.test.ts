import {
	buildKanbanSwimlaneColumns,
	getVisibleKanbanSwimLaneColumnKeys,
} from "../../../src/bases/kanbanGrouping";

type TestTask = {
	path: string;
	swimlanes: string[];
};

function task(path: string, swimlanes: string[]): TestTask {
	return { path, swimlanes };
}

describe("Kanban: hide empty columns with swimlanes enabled", () => {
	it("drops a column that is empty across all swimlanes after filtering", () => {
		// Simulates a board grouped by status (columns) with swimlanes by priority,
		// where the "done" column has been filtered down to zero tasks.
		const todoA = task("todo-a.md", ["High"]);
		const todoB = task("todo-b.md", ["Low"]);
		const groups = new Map<string, TestTask[]>([
			["todo", [todoA, todoB]],
			["done", []],
		]);

		const swimLanes = buildKanbanSwimlaneColumns([todoA, todoB], groups, (item) => item.swimlanes);

		const orderedKeys = ["todo", "done"];

		expect(getVisibleKanbanSwimLaneColumnKeys(orderedKeys, swimLanes, true, [])).toEqual(["todo"]);

		// With the option off, both columns remain visible.
		expect(getVisibleKanbanSwimLaneColumnKeys(orderedKeys, swimLanes, false, [])).toEqual([
			"todo",
			"done",
		]);
	});

	it("keeps a column that has tasks in at least one swimlane", () => {
		const todoA = task("todo-a.md", ["High"]);
		const doneA = task("done-a.md", ["Low"]);
		const groups = new Map<string, TestTask[]>([
			["todo", [todoA]],
			["done", [doneA]],
		]);

		const swimLanes = buildKanbanSwimlaneColumns([todoA, doneA], groups, (item) => item.swimlanes);

		expect(getVisibleKanbanSwimLaneColumnKeys(["todo", "done"], swimLanes, true, [])).toEqual([
			"todo",
			"done",
		]);
	});
});
