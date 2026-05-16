import { KanbanView } from "../../../src/bases/KanbanView";
import type { TaskInfo } from "../../../src/types";

describe("Issue #1889: Kanban swimlanes with list-valued properties", () => {
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

	it("uses each tag as an individual swimlane key instead of a comma-joined label", () => {
		const task: TaskInfo = {
			title: "Tagged task",
			status: "open",
			path: "tasks/tagged.md",
			tags: ["work", "task"],
		};
		const view = new KanbanView({}, document.createElement("div"), makePlugin() as any);
		(view as any).swimLanePropertyId = "tags";

		const keys = (view as any).getSwimLaneKeys(task, new Map());

		expect(keys).toEqual(["work", "task"]);
		expect(keys).not.toContain("work, task");
	});

	it("keeps empty list-valued swimlanes in the None bucket", () => {
		const task: TaskInfo = {
			title: "Untagged task",
			status: "open",
			path: "tasks/untagged.md",
			tags: [],
		};
		const view = new KanbanView({}, document.createElement("div"), makePlugin() as any);
		(view as any).swimLanePropertyId = "tags";

		expect((view as any).getSwimLaneKeys(task, new Map())).toEqual(["None"]);
	});
});
