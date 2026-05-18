/**
 * Issue #353: filter tasks by whether they have subtasks.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/353
 */

import { FilterService } from "../../../src/services/FilterService";
import { FILTER_PROPERTIES, FilterQuery, TaskInfo } from "../../../src/types";
import { FilterUtils } from "../../../src/utils/FilterUtils";

function createTask(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		tags: ["task"],
		...overrides,
	};
}

function createFilterService(tasks: TaskInfo[], projectPaths: string[]): FilterService {
	const taskByPath = new Map(tasks.map((task) => [task.path, task]));
	const cacheManager = {
		getAllTaskPaths: jest.fn(() => new Set(taskByPath.keys())),
		getCachedTaskInfo: jest.fn(async (path: string) => taskByPath.get(path) || null),
	} as never;
	const statusManager = {
		isCompletedStatus: jest.fn(() => false),
		getCompletedStatuses: jest.fn(() => ["done"]),
		getStatusOrder: jest.fn(() => 0),
	} as never;
	const priorityManager = {
		getPriorityWeight: jest.fn(() => 0),
		getPriorityOrder: jest.fn(() => 0),
	} as never;
	const plugin = {
		settings: { userFields: [] },
		projectSubtasksService: {
			isTaskUsedAsProjectSync: jest.fn((path: string) => projectPaths.includes(path)),
		},
	} as never;

	return new FilterService(cacheManager, statusManager, priorityManager, plugin);
}

async function filterByHasSubtasks(
	tasks: TaskInfo[],
	projectPaths: string[],
	checked: boolean
): Promise<string[]> {
	const filterService = createFilterService(tasks, projectPaths);
	const query: FilterQuery = {
		type: "group",
		id: "root",
		conjunction: "and",
		children: [
			{
				type: "condition",
				id: "has-subtasks",
				property: "hasSubtasks",
				operator: checked ? "is-checked" : "is-not-checked",
				value: null,
			},
		],
		groupKey: "none",
		sortKey: "title",
		sortDirection: "asc",
	};

	const groups = await filterService.getGroupedTasks(query);
	return Array.from(groups.values())
		.flat()
		.map((task) => task.path);
}

describe("Issue #353: Has Subtasks filter", () => {
	it("exposes Has Subtasks as a boolean filter property", () => {
		const property = FILTER_PROPERTIES.find((definition) => definition.id === "hasSubtasks");

		expect(property).toMatchObject({
			label: "Has Subtasks",
			category: "boolean",
			supportedOperators: ["is-checked", "is-not-checked"],
			valueInputType: "none",
		});
	});

	it("supports boolean operators for stored TaskInfo hasSubtasks values", () => {
		expect(
			FilterUtils.applyOperator(
				FilterUtils.getTaskPropertyValue(createTask({ hasSubtasks: true }), "hasSubtasks"),
				"is-checked",
				null,
				"condition",
				"hasSubtasks"
			)
		).toBe(true);

		expect(
			FilterUtils.applyOperator(
				FilterUtils.getTaskPropertyValue(createTask({ hasSubtasks: false }), "hasSubtasks"),
				"is-not-checked",
				null,
				"condition",
				"hasSubtasks"
			)
		).toBe(true);
	});

	it("matches tasks that are used as projects by subtasks", async () => {
		const tasks = [
			createTask({ title: "Project", path: "Tasks/project.md" }),
			createTask({ title: "Direct task", path: "Tasks/direct.md" }),
		];

		await expect(filterByHasSubtasks(tasks, ["Tasks/project.md"], true)).resolves.toEqual([
			"Tasks/project.md",
		]);
		await expect(filterByHasSubtasks(tasks, ["Tasks/project.md"], false)).resolves.toEqual([
			"Tasks/direct.md",
		]);
	});
});
