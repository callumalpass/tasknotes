import { buildTaskEditFormState } from "../../../src/modals/taskEditFormState";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Look for ping pong table on facebook marketplace",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Look for ping pong table on facebook marketplace.md",
		archived: false,
		contexts: [],
		projects: [],
		tags: [],
		...overrides,
	};
}

describe("issue #2140 edit modal identifying tags", () => {
	it("keeps saved task-identification tags visible when hiding is disabled", () => {
		const state = buildTaskEditFormState({
			task: createTask({
				tags: ["health", "task", "task/context/onscreen", "task/context/research"],
			}),
			details: "",
			frontmatter: {},
			settings: {
				taskIdentificationMethod: "tag",
				taskTag: "task",
				hideIdentifyingTagsMode: "all",
			},
			normalizeDetails: (value) => value,
		});

		expect(state.tags).toBe(
			"health, task, task/context/onscreen, task/context/research"
		);
		expect(state.initialTags).toBe(
			"health, task, task/context/onscreen, task/context/research"
		);
	});
});
