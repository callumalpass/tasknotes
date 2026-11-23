import { describe, expect, it, jest } from "@jest/globals";

import { hasRecurringSeriesEnded } from "../../../src/core/recurrence";
import { AutoArchiveService } from "../../../src/services/AutoArchiveService";
import {
	buildRecurringTaskCompletePlan,
	buildRecurringTaskSkippedPlan,
	type RecurringSeriesEndStatuses,
} from "../../../src/services/task-service/taskRecurringPlanning";
import type { PendingAutoArchive, StatusConfig, TaskInfo } from "../../../src/types";

// COUNT and UNTIL bounds need the real rule engine, not the shared rrule mock.
jest.unmock("rrule");
jest.mock("rrule", () => jest.requireActual("../../../node_modules/rrule/dist/es5/rrule.js"));

const FIRST_FOUR = ["2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
const ALL_FIVE = [...FIRST_FOUR, "2026-11-08"];

function series(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Bounded series",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Bounded series.md",
		archived: false,
		recurrence: "DTSTART:20261104T190000;FREQ=DAILY;COUNT=5",
		scheduled: "2026-11-08",
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	} as TaskInfo;
}

const statuses: RecurringSeriesEndStatuses = {
	completedStatus: "done",
	reopenedStatus: "open",
	isCompletedStatus: (status) => status === "done",
};

const planInput = (freshTask: TaskInfo, date: string) => ({
	freshTask,
	targetDate: new Date(`${date}T00:00:00.000Z`),
	currentTimestamp: "2026-11-08T20:00:00+10:00",
	maintainDueDateOffsetInRecurring: true,
	seriesEndStatuses: statuses,
});

describe("Issue #2608: a bounded recurring series that has ended", () => {
	describe("hasRecurringSeriesEnded", () => {
		it("ends a COUNT series once every occurrence is completed or skipped", () => {
			expect(hasRecurringSeriesEnded(series({ complete_instances: ALL_FIVE }))).toBe(true);
			expect(
				hasRecurringSeriesEnded(
					series({ complete_instances: FIRST_FOUR, skipped_instances: ["2026-11-08"] })
				)
			).toBe(true);
			expect(hasRecurringSeriesEnded(series({ complete_instances: FIRST_FOUR }))).toBe(false);
		});

		it("does not count recorded dates outside the rule", () => {
			expect(
				hasRecurringSeriesEnded(
					series({
						complete_instances: [...FIRST_FOUR.slice(1), "2026-11-11", "2026-11-12"],
					})
				)
			).toBe(false);
		});

		it("ends an UNTIL series and never an open-ended one", () => {
			expect(
				hasRecurringSeriesEnded(
					series({
						recurrence: "DTSTART:20261104;FREQ=DAILY;UNTIL=20261108",
						complete_instances: ALL_FIVE,
					})
				)
			).toBe(true);
			expect(
				hasRecurringSeriesEnded(
					series({
						recurrence: "DTSTART:20261104;FREQ=DAILY",
						complete_instances: ALL_FIVE,
					})
				)
			).toBe(false);
		});
	});

	describe("status", () => {
		it("completes the task when its last occurrence is completed or skipped", () => {
			const fresh = series({ complete_instances: FIRST_FOUR });

			expect(
				buildRecurringTaskCompletePlan(planInput(fresh, "2026-11-08")).updatedTask.status
			).toBe("done");
			expect(
				buildRecurringTaskSkippedPlan(planInput(fresh, "2026-11-08")).updatedTask.status
			).toBe("done");
		});

		it("leaves the status alone while occurrences remain", () => {
			const plan = buildRecurringTaskCompletePlan(
				planInput(series({ complete_instances: FIRST_FOUR.slice(0, 3) }), "2026-11-07")
			);
			expect(plan.updatedTask.status).toBe("open");
		});

		it("reopens the task when an occurrence of the ended series is reopened", () => {
			const plan = buildRecurringTaskCompletePlan(
				planInput(series({ status: "done", complete_instances: ALL_FIVE }), "2026-11-08")
			);
			expect(plan.newComplete).toBe(false);
			expect(plan.updatedTask.status).toBe("open");
		});
	});

	describe("auto-archive", () => {
		const doneStatus: StatusConfig = {
			id: "done",
			value: "done",
			label: "Done",
			color: "#22c55e",
			isCompleted: true,
			order: 2,
			autoArchive: true,
			autoArchiveDelay: 5,
		};

		function serviceWithQueue() {
			const data = { autoArchiveQueue: [] as PendingAutoArchive[] };
			const plugin = {
				settings: {},
				loadData: jest.fn(async () => data),
				loadPluginDataForSafeWrite: jest.fn(async () => data),
				saveData: jest.fn(async (updated: { autoArchiveQueue: PendingAutoArchive[] }) => {
					data.autoArchiveQueue = updated.autoArchiveQueue;
				}),
			};
			return { data, service: new AutoArchiveService(plugin as never) };
		}

		it("queues an ended series like a completed task", async () => {
			const { data, service } = serviceWithQueue();
			await service.scheduleAutoArchive(
				series({ status: "done", complete_instances: ALL_FIVE }),
				doneStatus
			);
			expect(data.autoArchiveQueue.map((item) => item.taskPath)).toEqual([
				"TaskNotes/Bounded series.md",
			]);
		});

		it("does not queue a bounded series with occurrences left", async () => {
			const { data, service } = serviceWithQueue();
			await service.scheduleAutoArchive(
				series({ status: "done", complete_instances: FIRST_FOUR }),
				doneStatus
			);
			expect(data.autoArchiveQueue).toEqual([]);
		});
	});
});
