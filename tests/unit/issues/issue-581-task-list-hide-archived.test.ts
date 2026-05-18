/**
 * Issue #581: Task List views should be able to hide archived tasks without
 * requiring every Bases view to repeat an archived=false filter.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/581
 */

import { describe, expect, it } from "@jest/globals";
import { filterTaskListArchivedTasks } from "../../../src/bases/TaskListView";
import type { TaskInfo } from "../../../src/types";

function task(path: string, archived: boolean): TaskInfo {
	return {
		path,
		title: path,
		status: "open",
		priority: "normal",
		archived,
		tags: [],
		contexts: [],
		projects: [],
		timeEntries: [],
		complete_instances: [],
		skipped_instances: [],
	} as TaskInfo;
}

describe("Issue #581: Task List archived visibility option", () => {
	it("preserves archived tasks by default for backward-compatible Task List views", () => {
		const tasks = [task("Tasks/active.md", false), task("Tasks/archived.md", true)];

		expect(filterTaskListArchivedTasks(tasks, true)).toEqual(tasks);
	});

	it("hides archived tasks when the Task List view option is disabled", () => {
		const active = task("Tasks/active.md", false);
		const archived = task("Tasks/archived.md", true);

		expect(filterTaskListArchivedTasks([active, archived], false)).toEqual([active]);
	});
});
