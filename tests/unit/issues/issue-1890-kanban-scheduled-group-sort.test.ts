import { KanbanView } from "../../../src/bases/KanbanView";
import type { TaskInfo } from "../../../src/types";

describe("Issue #1890: Kanban scheduled grouping with time-based sorting", () => {
	const makeTask = (path: string, scheduled: string): TaskInfo => ({
		title: path.split("/").pop() || path,
		status: "open",
		path,
		scheduled,
	});

	const makeDateValue = (year: number, month: number, day: number, hour = 0) => ({
		constructor: { name: "DateValue" },
		date: new Date(year, month - 1, day, hour, 0, 0),
	});

	const makePlugin = () => ({
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
	});

	it("merges Bases date-time groups that normalize to the same scheduled day", () => {
		const tasks = [
			makeTask("tasks/time-0900.md", "2026-05-20T09:00:00"),
			makeTask("tasks/time-1500.md", "2026-05-20T15:00:00"),
			makeTask("tasks/date-only.md", "2026-05-20"),
			makeTask("tasks/next-day.md", "2026-05-21"),
		];

		const view = new KanbanView({}, document.createElement("div"), makePlugin() as any);
		(view as any).data = {
			groupedData: [
				{
					key: makeDateValue(2026, 5, 20, 9),
					entries: [
						{ file: { path: "tasks/time-0900.md" } },
						{ file: { path: "tasks/date-only.md" } },
					],
				},
				{
					key: makeDateValue(2026, 5, 20, 15),
					entries: [{ file: { path: "tasks/time-1500.md" } }],
				},
				{
					key: makeDateValue(2026, 5, 21),
					entries: [{ file: { path: "tasks/next-day.md" } }],
				},
			],
		};
		(view as any).config = {
			getSort: () => [{ property: "formula.scheduledSortTime" }],
		};

		const groups = (view as any).groupTasks(tasks, "scheduled", new Map());

		expect(groups.get("2026-05-20")?.map((task: TaskInfo) => task.path)).toEqual([
			"tasks/time-0900.md",
			"tasks/time-1500.md",
			"tasks/date-only.md",
		]);
		expect(groups.get("2026-05-21")?.map((task: TaskInfo) => task.path)).toEqual([
			"tasks/next-day.md",
		]);
	});
});
