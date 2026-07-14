import type TaskNotesPlugin from "../../../src/main";
import {
	countTaskModalCompletion,
	formatTaskModalCompletionCount,
	parseTaskModalCommaList,
} from "../../../src/modals/taskModalOrgCounts";

function createPlugin(taskStatuses: Record<string, string>): TaskNotesPlugin {
	return {
		cacheManager: {
			getCachedTaskInfoSync: (path: string) =>
				taskStatuses[path]
					? {
							path,
							status: taskStatuses[path],
						}
					: null,
		},
		statusManager: {
			isCompletedStatus: (status: string) => status === "done",
		},
	} as unknown as TaskNotesPlugin;
}

describe("taskModalOrgCounts", () => {
	it("parses comma-separated lists", () => {
		expect(parseTaskModalCommaList(" home , work ")).toEqual(["home", "work"]);
	});

	it("counts completed tasks and includes unresolved/non-task entries in the total", () => {
		const plugin = createPlugin({
			"a.md": "done",
			"b.md": "open",
		});

		expect(
			countTaskModalCompletion(plugin, ["a.md", "b.md", "note.md", undefined])
		).toEqual({
			completed: 1,
			total: 4,
		});
	});

	it("formats completion counts for organization headers", () => {
		expect(
			formatTaskModalCompletionCount(
				(key, params) => `${key}:${params?.completed}/${params?.total}`,
				2,
				5
			)
		).toBe("modals.task.organization.completionCount:2/5");
	});
});
