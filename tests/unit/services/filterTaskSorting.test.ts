import {
	compareFilterTaskDates,
	sortFilterTasks,
	type FilterTaskSortingContext,
} from "../../../src/services/filter-service/filterTaskSorting";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	};
}

function createContext(
	rawValues: Record<string, Record<string, unknown>> = {}
): FilterTaskSortingContext {
	return {
		userFields: [
			{ id: "effort", key: "effort", displayName: "Effort", type: "number" },
			{ id: "flag", key: "flag", displayName: "Flag", type: "boolean" },
		],
		getPriorityWeight: (priority) =>
			({ critical: 4, high: 3, normal: 2, low: 1 })[priority] ?? 0,
		getStatusOrder: (status) => ({ open: 1, doing: 2, done: 3 })[status] ?? 99,
		getUserFieldRawValue: (task, fieldKey) => rawValues[task.path]?.[fieldKey],
	};
}

describe("filterTaskSorting", () => {
	it("applies priority direction only to the primary comparison", () => {
		const tasks = [
			createTask({ title: "High Later", priority: "high", due: "2026-05-20" }),
			createTask({ title: "Low", priority: "low", due: "2026-05-01" }),
			createTask({ title: "High Earlier", priority: "high", due: "2026-05-10" }),
		];

		const ascTitles = sortFilterTasks([...tasks], "priority", "asc", createContext()).map(
			(task) => task.title
		);
		const descTitles = sortFilterTasks([...tasks], "priority", "desc", createContext()).map(
			(task) => task.title
		);

		expect(ascTitles).toEqual(["Low", "High Earlier", "High Later"]);
		expect(descTitles).toEqual(["High Earlier", "High Later", "Low"]);
	});

	it("compares task dates with missing values last and datetime values time-aware", () => {
		expect(compareFilterTaskDates(undefined, undefined)).toBe(0);
		expect(compareFilterTaskDates(undefined, "2026-05-19")).toBe(1);
		expect(compareFilterTaskDates("2026-05-19", undefined)).toBe(-1);
		expect(
			compareFilterTaskDates("2026-05-19T09:00:00", "2026-05-19T14:00:00")
		).toBe(-1);
		expect(
			compareFilterTaskDates("2026-05-19T14:00:00", "2026-05-19T09:00:00")
		).toBe(1);
	});

	it("sorts by the first tag case-insensitively with untagged tasks last", () => {
		const tasks = [
			createTask({ title: "No tags", tags: [] }),
			createTask({ title: "Banana", tags: ["Banana"] }),
			createTask({ title: "Apple", tags: ["apple"] }),
		];

		const sortedTitles = sortFilterTasks([...tasks], "tags", "asc", createContext()).map(
			(task) => task.title
		);

		expect(sortedTitles).toEqual(["Apple", "Banana", "No tags"]);
	});

	it("sorts custom user fields through injected raw frontmatter access", () => {
		const tasks = [
			createTask({ title: "Missing", path: "Tasks/missing.md" }),
			createTask({ title: "Ten", path: "Tasks/ten.md" }),
			createTask({ title: "Two", path: "Tasks/two.md" }),
		];
		const context = createContext({
			"Tasks/ten.md": { effort: "10-High" },
			"Tasks/two.md": { effort: 2 },
		});

		const sortedTitles = sortFilterTasks([...tasks], "user:effort", "asc", context).map(
			(task) => task.title
		);

		expect(sortedTitles).toEqual(["Two", "Ten", "Missing"]);
	});
});
