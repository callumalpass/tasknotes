import type { TaskInfo } from "../../../src/types";
import type { BasesDataItem } from "../../../src/bases/helpers";
import {
	buildTaskListGroupedRenderItems,
	buildTaskListGroupedScopePaths,
	buildTaskListPathProperties,
	buildTaskListSubPropertyRenderItems,
	buildTaskListSubPropertyScopePaths,
	getTaskListPropertyValue,
	groupTasksByTaskListSubProperty,
	stringifyTaskListGroupValue,
	type TaskListGroup,
} from "../../../src/bases/taskListGrouping";

function task(path: string, title = path): TaskInfo {
	return {
		path,
		title,
		status: "todo",
		priority: "normal",
	} as TaskInfo;
}

describe("taskListGrouping", () => {
	it("builds path properties with cached formula outputs", () => {
		const dataItems: BasesDataItem[] = [
			{
				path: "one.md",
				properties: { status: "todo" },
				basesData: {
					formulaResults: {
						cachedFormulaOutputs: {
							score: 12,
						},
					},
				},
			},
			{
				path: "two.md",
				properties: { status: "done" },
			},
			{
				properties: { status: "ignored" },
			},
		];

		expect(buildTaskListPathProperties(dataItems)).toEqual(
			new Map([
				["one.md", { status: "todo", "formula.score": 12 }],
				["two.md", { status: "done" }],
			])
		);
	});

	it("resolves regular, prefixed, and formula property IDs", () => {
		const props = {
			status: "todo",
			name: "Task",
			"formula.score": 42,
		};

		expect(getTaskListPropertyValue(props, "task.status")).toBe("todo");
		expect(getTaskListPropertyValue(props, "note.name")).toBe("Task");
		expect(getTaskListPropertyValue(props, "formula.score")).toBe(42);
		expect(getTaskListPropertyValue(props, "task.missing")).toBeNull();
	});

	it("stringifies group values using Task List display semantics", () => {
		expect(stringifyTaskListGroupValue(null)).toBe("None");
		expect(stringifyTaskListGroupValue("")).toBe("None");
		expect(stringifyTaskListGroupValue(3)).toBe("3");
		expect(stringifyTaskListGroupValue(false)).toBe("False");
		expect(stringifyTaskListGroupValue(["alpha", "", true])).toBe("alpha,,true");
		expect(
			stringifyTaskListGroupValue({
				constructor: { name: "NullValue" },
				isTruthy: () => false,
				toString: () => "not used",
			})
		).toBe("None");
		expect(
			stringifyTaskListGroupValue({
				constructor: { name: "ListValue" },
				value: ["alpha", { toString: () => "beta" }],
				toString: () => "not used",
			})
		).toBe("alpha, beta");
	});

	it("groups tasks by sub-property values", () => {
		const first = task("one.md");
		const second = task("two.md");
		const third = task("three.md");
		const grouped = groupTasksByTaskListSubProperty(
			[first, second, third],
			"task.priority",
			new Map([
				["one.md", { priority: "high" }],
				["two.md", { priority: "low" }],
			])
		);

		expect([...grouped.entries()]).toEqual([
			["high", [first]],
			["low", [second]],
			["None", [third]],
		]);
	});

	it("builds grouped render items with nested sub-groups and collapsed state", () => {
		const first = task("one.md");
		const second = task("two.md");
		const third = task("three.md");
		const groups: TaskListGroup[] = [
			{ key: "todo", entries: [{ file: { path: "one.md" } }, { file: { path: "two.md" } }] },
			{ key: "done", entries: [{ file: { path: "three.md" } }] },
			{ key: "empty", entries: [{ file: { path: "missing.md" } }] },
		];

		const items = buildTaskListGroupedRenderItems({
			groups,
			taskNotes: [first, second, third],
			subGroupPropertyId: "task.priority",
			pathToProps: new Map([
				["one.md", { priority: "high" }],
				["two.md", { priority: "low" }],
				["three.md", { priority: "low" }],
			]),
			collapsedGroups: new Set(["done"]),
			collapsedSubGroups: new Set(["todo:low"]),
			convertGroupKeyToString: String,
		});

		expect(items.map((item) => item.type)).toEqual([
			"primary-header",
			"sub-header",
			"task",
			"sub-header",
			"primary-header",
		]);
		expect(items[0]).toMatchObject({
			type: "primary-header",
			groupKey: "todo",
			taskCount: 2,
			isCollapsed: false,
		});
		expect(items[2]).toMatchObject({
			type: "task",
			task: first,
			groupKey: "todo",
			subGroupKey: "high",
		});
		expect(items[3]).toMatchObject({
			type: "sub-header",
			groupKey: "todo",
			subGroupKey: "low",
			isCollapsed: true,
		});
		expect(items[4]).toMatchObject({
			type: "primary-header",
			groupKey: "done",
			taskCount: 1,
			isCollapsed: true,
		});
	});

	it("builds sub-property-only render items", () => {
		const first = task("one.md");
		const second = task("two.md");
		const items = buildTaskListSubPropertyRenderItems(
			new Map([
				["high", [first]],
				["low", [second]],
			]),
			new Set(["low"])
		);

		expect(items.map((item) => item.type)).toEqual([
			"primary-header",
			"task",
			"primary-header",
		]);
		expect(items[1]).toMatchObject({ type: "task", task: first, groupKey: "high" });
		expect(items[2]).toMatchObject({
			type: "primary-header",
			groupKey: "low",
			isCollapsed: true,
		});
	});

	it("builds grouped and sub-property scope paths", () => {
		const first = task("one.md");
		const groups: TaskListGroup[] = [
			{ key: "todo", entries: [{ file: { path: "one.md" } }, { file: { path: "missing.md" } }] },
		];

		expect(buildTaskListGroupedScopePaths(groups, [first], String)).toEqual(
			new Map([["todo", ["one.md"]]])
		);
		expect(buildTaskListSubPropertyScopePaths(new Map([["high", [first]]]))).toEqual(
			new Map([["high", ["one.md"]]])
		);
	});
});
