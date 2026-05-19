import {
	groupFilterTasks,
	type FilterTaskGroupingContext,
} from "../../../src/services/filter-service/filterTaskGrouping";
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
	overrides: Partial<FilterTaskGroupingContext> = {}
): FilterTaskGroupingContext {
	const rawValues = new Map<string, Record<string, unknown>>();
	for (const task of overridesRawTasks) {
		rawValues.set(task.path, task.raw);
	}

	return {
		userFields: [],
		hideCompletedFromOverdue: true,
		currentSortKey: undefined,
		currentSortDirection: undefined,
		isCompletedStatus: (status) => status === "done",
		getPriorityWeight: (priority) =>
			({ highest: 5, high: 4, normal: 3, low: 2, lowest: 1 })[priority] ?? 0,
		getStatusOrder: (status) => ({ open: 1, doing: 2, done: 3 })[status] ?? 99,
		getUserFieldRawValue: (task, fieldKey) => rawValues.get(task.path)?.[fieldKey],
		resolveProjectToAbsolutePath: (projectValue) => projectValue.replace(/\[\[|\]\]/g, ""),
		translate: (_key, fallback) => fallback,
		getLocale: () => "en",
		...overrides,
	};
}

let overridesRawTasks: Array<{ path: string; raw: Record<string, unknown> }> = [];

describe("filterTaskGrouping", () => {
	beforeEach(() => {
		overridesRawTasks = [];
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-05-19T12:00:00"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("fans tasks out across project groups and keeps the fallback project group last", () => {
		const alpha = createTask({
			path: "Tasks/a.md",
			projects: ["[[Projects/Beta]]", "[[Projects/Alpha]]"],
		});
		const none = createTask({ path: "Tasks/b.md", projects: [] });

		const groups = groupFilterTasks([none, alpha], "project", createContext());

		expect(Array.from(groups.keys())).toEqual([
			"Projects/Alpha",
			"Projects/Beta",
			"No project",
		]);
		expect(groups.get("Projects/Alpha")).toEqual([alpha]);
		expect(groups.get("Projects/Beta")).toEqual([alpha]);
		expect(groups.get("No project")).toEqual([none]);
	});

	it("orders due-date buckets by semantic date group", () => {
		const tasks = [
			createTask({ path: "Tasks/later.md", due: "2026-06-10" }),
			createTask({ path: "Tasks/none.md" }),
			createTask({ path: "Tasks/tomorrow.md", due: "2026-05-20" }),
			createTask({ path: "Tasks/overdue.md", due: "2026-05-18" }),
			createTask({ path: "Tasks/today.md", due: "2026-05-19" }),
			createTask({ path: "Tasks/week.md", due: "2026-05-25" }),
		];

		const groups = groupFilterTasks(tasks, "due", createContext());

		expect(Array.from(groups.keys())).toEqual([
			"Overdue",
			"Today",
			"Tomorrow",
			"Next seven days",
			"Later",
			"No due date",
		]);
	});

	it("uses status and priority ordering callbacks for group order", () => {
		const tasks = [
			createTask({ path: "Tasks/done.md", status: "done", priority: "low" }),
			createTask({ path: "Tasks/open.md", status: "open", priority: "high" }),
			createTask({ path: "Tasks/doing.md", status: "doing", priority: "normal" }),
		];
		const context = createContext();

		expect(Array.from(groupFilterTasks(tasks, "status", context).keys())).toEqual([
			"open",
			"doing",
			"done",
		]);
		expect(Array.from(groupFilterTasks(tasks, "priority", context).keys())).toEqual([
			"high",
			"normal",
			"low",
		]);
	});

	it("groups custom user fields from injected raw frontmatter access", () => {
		const first = createTask({ path: "Tasks/a.md" });
		const second = createTask({ path: "Tasks/b.md" });
		const missing = createTask({ path: "Tasks/c.md" });
		overridesRawTasks = [
			{ path: first.path, raw: { effort: 2 } },
			{ path: second.path, raw: { effort: "10-High" } },
		];
		const context = createContext({
			userFields: [{ id: "effort", key: "effort", displayName: "Effort", type: "number" }],
		});

		const groups = groupFilterTasks([first, second, missing], "user:effort", context);

		expect(Array.from(groups.keys())).toEqual(["10", "2", "no-value"]);
		expect(groups.get("10")).toEqual([second]);
		expect(groups.get("2")).toEqual([first]);
		expect(groups.get("no-value")).toEqual([missing]);
	});
});
