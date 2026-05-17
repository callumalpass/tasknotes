import { describe, expect, it, jest } from "@jest/globals";

import { AutoArchiveService } from "../../../src/services/AutoArchiveService";
import type { PendingAutoArchive, StatusConfig } from "../../../src/types";
import { TaskFactory } from "../../helpers/mock-factories";

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

function createPluginWithQueue(initialQueue: PendingAutoArchive[]) {
	const data = { autoArchiveQueue: [...initialQueue] };
	return {
		data,
		plugin: {
			settings: {},
			loadData: jest.fn(async () => data),
			saveData: jest.fn(async (updatedData: { autoArchiveQueue: PendingAutoArchive[] }) => {
				data.autoArchiveQueue = updatedData.autoArchiveQueue;
			}),
		},
	};
}

describe("Issue #1370: recurring task auto-archive", () => {
	it("does not queue recurring task series for auto-archive", async () => {
		const recurringTask = TaskFactory.createTask({
			path: "TaskNotes/Tasks/daily-review.md",
			recurrence: "FREQ=DAILY",
			status: "done",
		});
		const unrelatedQueueItem: PendingAutoArchive = {
			taskPath: "TaskNotes/Tasks/one-off.md",
			statusChangeTimestamp: 1000,
			archiveAfterTimestamp: 2000,
			statusValue: "done",
		};
		const staleRecurringQueueItem: PendingAutoArchive = {
			taskPath: recurringTask.path,
			statusChangeTimestamp: 3000,
			archiveAfterTimestamp: 4000,
			statusValue: "done",
		};
		const { data, plugin } = createPluginWithQueue([
			unrelatedQueueItem,
			staleRecurringQueueItem,
		]);
		const service = new AutoArchiveService(plugin as any);

		await service.scheduleAutoArchive(recurringTask, doneStatus);

		expect(data.autoArchiveQueue).toEqual([unrelatedQueueItem]);
		expect(plugin.saveData).toHaveBeenCalledWith({
			autoArchiveQueue: [unrelatedQueueItem],
		});
	});

	it("still queues non-recurring tasks for auto-archive", async () => {
		const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1000);
		const task = TaskFactory.createTask({
			path: "TaskNotes/Tasks/one-off.md",
			recurrence: undefined,
			status: "done",
		});
		const { data, plugin } = createPluginWithQueue([]);
		const service = new AutoArchiveService(plugin as any);

		try {
			await service.scheduleAutoArchive(task, doneStatus);
		} finally {
			nowSpy.mockRestore();
		}

		expect(data.autoArchiveQueue).toEqual([
			{
				taskPath: task.path,
				statusChangeTimestamp: 1000,
				archiveAfterTimestamp: 301000,
				statusValue: "done",
			},
		]);
	});
});
