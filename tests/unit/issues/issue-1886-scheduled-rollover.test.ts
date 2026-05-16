import {
	buildRolledOverScheduledDate,
	getOverdueScheduledRolloverCandidates,
} from "../../../src/utils/scheduledRollover";
import type { TaskInfo } from "../../../src/types";

function task(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		title: overrides.title ?? "Task",
		path: overrides.path ?? "Tasks/task.md",
		status: overrides.status ?? "open",
		priority: overrides.priority ?? "normal",
		archived: overrides.archived ?? false,
		tags: overrides.tags ?? [],
		dateCreated: overrides.dateCreated ?? "2026-05-01T00:00:00.000Z",
		dateModified: overrides.dateModified ?? "2026-05-01T00:00:00.000Z",
		...overrides,
	};
}

describe("Issue #1886: overdue scheduled task rollover", () => {
	const isCompletedStatus = (status: string) => status === "done" || status === "cancelled";

	it("finds active overdue scheduled tasks", () => {
		const candidates = getOverdueScheduledRolloverCandidates(
			[
				task({
					title: "Overdue",
					path: "Tasks/overdue.md",
					scheduled: "2026-05-15",
				}),
				task({
					title: "Today",
					path: "Tasks/today.md",
					scheduled: "2026-05-16",
				}),
				task({
					title: "Future",
					path: "Tasks/future.md",
					scheduled: "2026-05-17",
				}),
			],
			isCompletedStatus,
			"2026-05-16"
		);

		expect(candidates).toHaveLength(1);
		expect(candidates[0]).toMatchObject({
			nextScheduled: "2026-05-16",
			task: { path: "Tasks/overdue.md" },
		});
	});

	it("skips completed and archived overdue scheduled tasks", () => {
		const candidates = getOverdueScheduledRolloverCandidates(
			[
				task({
					title: "Completed",
					path: "Tasks/completed.md",
					status: "done",
					scheduled: "2026-05-15",
				}),
				task({
					title: "Archived",
					path: "Tasks/archived.md",
					archived: true,
					scheduled: "2026-05-15",
				}),
			],
			isCompletedStatus,
			"2026-05-16"
		);

		expect(candidates).toHaveLength(0);
	});

	it("preserves the time component when rolling a datetime forward", () => {
		expect(buildRolledOverScheduledDate("2026-05-15T09:30:00", "2026-05-16")).toBe(
			"2026-05-16T09:30:00"
		);
	});
});
