import {
	applyDeleteTimeEntryFrontmatterChange,
	applyStartTimeTrackingFrontmatterChange,
	applyStopTimeTrackingFrontmatterChange,
	buildDeleteTimeEntryPlan,
	buildStartTimeTrackingPlan,
	buildStopTimeTrackingPlan,
	removeTimeEntryDuration,
} from "../../../src/services/task-service/taskTimeTrackingPlanning";
import type { TaskInfo, TimeEntry } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Tracked task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Tracked task.md",
		archived: false,
		...overrides,
	} as TaskInfo;
}

describe("taskTimeTrackingPlanning", () => {
	it("removes legacy duration fields without mutating the original entry", () => {
		const entry: TimeEntry = {
			startTime: "2026-05-19T06:00:00.000Z",
			endTime: "2026-05-19T06:20:00.000Z",
			duration: 20,
		};

		expect(removeTimeEntryDuration(entry)).toEqual({
			startTime: "2026-05-19T06:00:00.000Z",
			endTime: "2026-05-19T06:20:00.000Z",
		});
		expect(entry.duration).toBe(20);
	});

	it("builds a start plan with sanitized existing entries and a new active entry", () => {
		const plan = buildStartTimeTrackingPlan(
			createTask({
				timeEntries: [
					{
						startTime: "2026-05-19T05:00:00.000Z",
						endTime: "2026-05-19T05:30:00.000Z",
						duration: 30,
					},
				],
			}),
			"2026-05-19T06:45:00+10:00",
			"2026-05-19T06:45:00.000Z"
		);

		expect(plan.newEntry).toEqual({
			startTime: "2026-05-19T06:45:00.000Z",
			description: "Work session",
		});
		expect(plan.updatedTask.timeEntries).toEqual([
			{
				startTime: "2026-05-19T05:00:00.000Z",
				endTime: "2026-05-19T05:30:00.000Z",
			},
			{
				startTime: "2026-05-19T06:45:00.000Z",
				description: "Work session",
			},
		]);
		expect(plan.updatedTask.dateModified).toBe("2026-05-19T06:45:00+10:00");
	});

	it("applies start frontmatter changes with sanitized existing entries", () => {
		const frontmatter: Record<string, unknown> = {
			timeEntries: [
				{
					startTime: "2026-05-19T05:00:00.000Z",
					endTime: "2026-05-19T05:30:00.000Z",
					duration: 30,
				},
			],
		};

		applyStartTimeTrackingFrontmatterChange({
			frontmatter,
			timeEntriesField: "timeEntries",
			dateModifiedField: "dateModified",
			newEntry: { startTime: "2026-05-19T06:45:00.000Z", description: "Work session" },
			dateModified: "2026-05-19T06:45:00+10:00",
		});

		expect(frontmatter.timeEntries).toEqual([
			{
				startTime: "2026-05-19T05:00:00.000Z",
				endTime: "2026-05-19T05:30:00.000Z",
			},
			{
				startTime: "2026-05-19T06:45:00.000Z",
				description: "Work session",
			},
		]);
		expect(frontmatter.dateModified).toBe("2026-05-19T06:45:00+10:00");
	});

	it("builds a stop plan that closes the matching active entry", () => {
		const activeSession: TimeEntry = { startTime: "2026-05-19T06:00:00.000Z" };
		const plan = buildStopTimeTrackingPlan(
			createTask({
				timeEntries: [
					{
						startTime: "2026-05-19T05:00:00.000Z",
						endTime: "2026-05-19T05:30:00.000Z",
						duration: 30,
					},
					activeSession,
				],
			}),
			activeSession,
			"2026-05-19T06:45:00+10:00",
			"2026-05-19T06:45:00.000Z"
		);

		expect(plan.updatedTask.timeEntries).toEqual([
			{
				startTime: "2026-05-19T05:00:00.000Z",
				endTime: "2026-05-19T05:30:00.000Z",
			},
			{
				startTime: "2026-05-19T06:00:00.000Z",
				endTime: "2026-05-19T06:45:00.000Z",
			},
		]);
		expect(plan.updatedTask.dateModified).toBe("2026-05-19T06:45:00+10:00");
	});

	it("applies stop frontmatter changes to the matching active entry", () => {
		const frontmatter: Record<string, unknown> = {
			timeEntries: [
				{
					startTime: "2026-05-19T05:00:00.000Z",
					endTime: "2026-05-19T05:30:00.000Z",
					duration: 30,
				},
				{ startTime: "2026-05-19T06:00:00.000Z" },
			],
		};

		applyStopTimeTrackingFrontmatterChange({
			frontmatter,
			timeEntriesField: "timeEntries",
			dateModifiedField: "dateModified",
			activeSession: { startTime: "2026-05-19T06:00:00.000Z" },
			stopTimestamp: "2026-05-19T06:45:00.000Z",
			dateModified: "2026-05-19T06:45:00+10:00",
		});

		expect(frontmatter.timeEntries).toEqual([
			{
				startTime: "2026-05-19T05:00:00.000Z",
				endTime: "2026-05-19T05:30:00.000Z",
			},
			{
				startTime: "2026-05-19T06:00:00.000Z",
				endTime: "2026-05-19T06:45:00.000Z",
			},
		]);
		expect(frontmatter.dateModified).toBe("2026-05-19T06:45:00+10:00");
	});

	it("builds a delete plan that removes the requested time entry", () => {
		const plan = buildDeleteTimeEntryPlan(
			createTask({
				timeEntries: [
					{ startTime: "2026-05-19T05:00:00.000Z" },
					{ startTime: "2026-05-19T06:00:00.000Z" },
				],
			}),
			0,
			"2026-05-19T06:45:00+10:00"
		);

		expect(plan.updatedTask.timeEntries).toEqual([
			{ startTime: "2026-05-19T06:00:00.000Z" },
		]);
		expect(plan.updatedTask.dateModified).toBe("2026-05-19T06:45:00+10:00");
	});

	it("rejects delete plans for missing or invalid time entry indexes", () => {
		expect(() =>
			buildDeleteTimeEntryPlan(createTask(), 0, "2026-05-19T06:45:00+10:00")
		).toThrow("Task has no time entries");

		expect(() =>
			buildDeleteTimeEntryPlan(
				createTask({ timeEntries: [{ startTime: "2026-05-19T05:00:00.000Z" }] }),
				1,
				"2026-05-19T06:45:00+10:00"
			)
		).toThrow("Invalid time entry index");
	});

	it("applies delete frontmatter changes to the requested time entry", () => {
		const frontmatter: Record<string, unknown> = {
			timeEntries: [
				{ startTime: "2026-05-19T05:00:00.000Z" },
				{ startTime: "2026-05-19T06:00:00.000Z" },
			],
		};

		applyDeleteTimeEntryFrontmatterChange({
			frontmatter,
			timeEntriesField: "timeEntries",
			dateModifiedField: "dateModified",
			timeEntryIndex: 1,
			dateModified: "2026-05-19T06:45:00+10:00",
		});

		expect(frontmatter.timeEntries).toEqual([
			{ startTime: "2026-05-19T05:00:00.000Z" },
		]);
		expect(frontmatter.dateModified).toBe("2026-05-19T06:45:00+10:00");
	});
});
