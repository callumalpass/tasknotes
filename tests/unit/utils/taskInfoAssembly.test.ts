import { describe, expect, it } from "@jest/globals";
import type { TaskInfo } from "../../../src/types";
import { buildTaskInfoFromMappedTask } from "../../../src/utils/taskInfoAssembly";

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Mapped task",
		status: "open",
		priority: "normal",
		path: "Mapped/original.md",
		archived: false,
		tags: ["task"],
		contexts: ["work"],
		projects: ["Project"],
		...overrides,
	};
}

describe("buildTaskInfoFromMappedTask", () => {
	it("adds path identity and computed blocking state", () => {
		const task = buildTaskInfoFromMappedTask({
			path: "Tasks/current.md",
			mappedTask: makeTask({ id: "old-id", path: "Mapped/original.md" }),
			defaultTaskStatus: "open",
			isBlocked: true,
			blockingTasks: ["Tasks/dependent.md"],
		});

		expect(task).toMatchObject({
			id: "Tasks/current.md",
			path: "Tasks/current.md",
			isBlocked: true,
			isBlocking: true,
			blocking: ["Tasks/dependent.md"],
		});
	});

	it("defaults missing display fields and list fields", () => {
		const task = buildTaskInfoFromMappedTask({
			path: "Tasks/defaults.md",
			mappedTask: makeTask({
				title: "",
				status: "",
				priority: "",
				tags: undefined,
				contexts: undefined,
				projects: undefined,
			}),
			defaultTaskStatus: "todo",
			isBlocked: false,
			blockingTasks: [],
		});

		expect(task.title).toBe("Untitled task");
		expect(task.status).toBe("todo");
		expect(task.priority).toBe("normal");
		expect(task.archived).toBe(false);
		expect(task.tags).toEqual([]);
		expect(task.contexts).toEqual([]);
		expect(task.projects).toEqual([]);
		expect(task.blocking).toBeUndefined();
		expect(task.isBlocking).toBe(false);
	});

	it("calculates total tracked time from completed time entries", () => {
		const task = buildTaskInfoFromMappedTask({
			path: "Tasks/timed.md",
			mappedTask: makeTask({
				timeEntries: [
					{
						startTime: "2026-05-19T00:00:00.000Z",
						endTime: "2026-05-19T00:30:00.000Z",
					},
					{
						startTime: "2026-05-19T01:00:00.000Z",
						endTime: "2026-05-19T01:45:00.000Z",
					},
					{
						startTime: "2026-05-19T02:00:00.000Z",
					},
				],
			}),
			defaultTaskStatus: "open",
			isBlocked: false,
			blockingTasks: [],
		});

		expect(task.totalTrackedTime).toBe(75);
	});
});
