/**
 * Issue #935: Priority sorting direction and date fallback order.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/935
 */

import { FilterService } from "../../../src/services/FilterService";
import { PriorityManager } from "../../../src/services/PriorityManager";
import type { PriorityConfig, SortDirection, TaskInfo, TaskSortKey } from "../../../src/types";

const priorities: PriorityConfig[] = [
	{ id: "critical", value: "critical", label: "Critical", color: "#ff0000", weight: 4 },
	{ id: "high", value: "high", label: "High", color: "#ff6600", weight: 3 },
	{ id: "normal", value: "normal", label: "Normal", color: "#ffaa00", weight: 2 },
	{ id: "low", value: "low", label: "Low", color: "#00aa00", weight: 1 },
];

function createTask(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	} as TaskInfo;
}

function createFilterService(): FilterService {
	const cacheManager = {} as never;
	const statusManager = {
		getStatusOrder: jest.fn(() => 0),
	} as never;
	const priorityManager = new PriorityManager(priorities);
	const plugin = { settings: { userFields: [] } } as never;

	return new FilterService(cacheManager, statusManager, priorityManager, plugin);
}

function sortTasks(
	tasks: TaskInfo[],
	sortKey: TaskSortKey,
	direction: SortDirection
): TaskInfo[] {
	const service = createFilterService() as unknown as {
		sortTasks: (tasks: TaskInfo[], sortKey: TaskSortKey, direction: SortDirection) => TaskInfo[];
	};

	return service.sortTasks([...tasks], sortKey, direction);
}

describe("Issue #935: Sort Order for Priorities, Due and Scheduled", () => {
	it("sorts highest weighted priority first when priority sort is descending", () => {
		const tasks = [
			createTask({ title: "Low", priority: "low", path: "Tasks/low.md" }),
			createTask({ title: "High", priority: "high", path: "Tasks/high.md" }),
			createTask({ title: "Critical", priority: "critical", path: "Tasks/critical.md" }),
			createTask({ title: "Normal", priority: "normal", path: "Tasks/normal.md" }),
		];

		const sortedPriorities = sortTasks(tasks, "priority", "desc").map((task) => task.priority);

		expect(sortedPriorities).toEqual(["critical", "high", "normal", "low"]);
	});

	it("sorts lowest weighted priority first when priority sort is ascending", () => {
		const tasks = [
			createTask({ title: "Low", priority: "low", path: "Tasks/low.md" }),
			createTask({ title: "High", priority: "high", path: "Tasks/high.md" }),
			createTask({ title: "Critical", priority: "critical", path: "Tasks/critical.md" }),
			createTask({ title: "Normal", priority: "normal", path: "Tasks/normal.md" }),
		];

		const sortedPriorities = sortTasks(tasks, "priority", "asc").map((task) => task.priority);

		expect(sortedPriorities).toEqual(["low", "normal", "high", "critical"]);
	});

	it("uses due date before scheduled date when priority values tie", () => {
		const tasks = [
			createTask({
				title: "Scheduled Earlier",
				priority: "normal",
				path: "Tasks/scheduled-earlier.md",
				due: "2025-01-10",
				scheduled: "2025-01-01",
			}),
			createTask({
				title: "Due Earlier",
				priority: "normal",
				path: "Tasks/due-earlier.md",
				due: "2025-01-05",
				scheduled: "2025-01-20",
			}),
		];

		const sortedTitles = sortTasks(tasks, "priority", "asc").map((task) => task.title);

		expect(sortedTitles).toEqual(["Due Earlier", "Scheduled Earlier"]);
	});

	it("keeps due-date fallback earliest-first for same-priority descending priority sorts", () => {
		const tasks = [
			createTask({
				title: "High Later",
				priority: "high",
				path: "Tasks/high-later.md",
				due: "2025-01-20",
			}),
			createTask({
				title: "High Earlier",
				priority: "high",
				path: "Tasks/high-earlier.md",
				due: "2025-01-05",
			}),
			createTask({
				title: "Critical",
				priority: "critical",
				path: "Tasks/critical.md",
				due: "2025-01-15",
			}),
			createTask({
				title: "Low",
				priority: "low",
				path: "Tasks/low.md",
				due: "2025-01-01",
			}),
		];

		const sortedTitles = sortTasks(tasks, "priority", "desc").map((task) => task.title);

		expect(sortedTitles).toEqual(["Critical", "High Earlier", "High Later", "Low"]);
	});
});
