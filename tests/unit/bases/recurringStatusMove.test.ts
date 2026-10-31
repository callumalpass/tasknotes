import { Notice } from "obsidian";
import {
	completeOccurrenceForStatusMove,
	getShownOccurrence,
} from "../../../src/bases/recurringStatusMove";
import type { TaskInfo } from "../../../src/types";
import { parseDateToUTC } from "../../../src/utils/dateUtils";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Recurring task",
		status: "open",
		priority: "normal",
		path: "tasks/recurring.md",
		archived: false,
		recurrence: "DTSTART:20261019;FREQ=WEEKLY",
		scheduled: "2026-10-19",
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	};
}

const getOccurrenceDate = (task: TaskInfo): Date => parseDateToUTC(task.scheduled as string);

function moveWith(task: TaskInfo | null, overrides: { status?: string | null } = {}) {
	const plugin = {
		cacheManager: { getTaskInfo: jest.fn().mockResolvedValue(task) },
		statusManager: {
			isCompletedStatus: (status: string) => status === "done" || status === "cancelled",
		},
		toggleRecurringTaskComplete: jest.fn().mockResolvedValue(task),
	};
	return {
		plugin,
		move: () =>
			completeOccurrenceForStatusMove({
				plugin: plugin as any,
				path: "tasks/recurring.md",
				status: "status" in overrides ? (overrides.status as string | null) : "done",
				shownOccurrence: getShownOccurrence(createTask(), getOccurrenceDate),
				getOccurrenceDate,
			}),
	};
}

describe("recurring status moves", () => {
	it("completes the shown occurrence on any completed status", async () => {
		for (const status of ["done", "cancelled"]) {
			const task = createTask();
			const { plugin, move } = moveWith(task, { status });

			await expect(move()).resolves.toBe(true);

			expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledTimes(1);
			expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledWith(
				task,
				parseDateToUTC("2026-10-19"),
				{ onlyIf: expect.any(Function) }
			);
		}
	});

	it("does not reopen an occurrence a repeated move finds complete", async () => {
		const { plugin, move } = moveWith(createTask({ complete_instances: ["2026-10-19"] }));

		await expect(move()).resolves.toBe(true);

		expect(plugin.toggleRecurringTaskComplete).not.toHaveBeenCalled();
	});

	it("does not complete the next occurrence after the series has advanced", async () => {
		const { plugin, move } = moveWith(
			createTask({ scheduled: "2026-10-26", complete_instances: ["2026-10-19"] })
		);

		await expect(move()).resolves.toBe(true);

		expect(plugin.toggleRecurringTaskComplete).not.toHaveBeenCalled();
		expect(Notice).toHaveBeenCalledWith(
			"That occurrence was already completed, skipped or rescheduled."
		);
	});

	it("does not complete the next occurrence when the shown one was skipped elsewhere", async () => {
		const { plugin, move } = moveWith(
			createTask({ scheduled: "2026-10-26", skipped_instances: ["2026-10-19"] })
		);

		await expect(move()).resolves.toBe(true);

		expect(plugin.toggleRecurringTaskComplete).not.toHaveBeenCalled();
	});

	it("passes the same check down, so the operation can repeat it on its own read", async () => {
		const task = createTask();
		const { plugin, move } = moveWith(task);

		await move();

		const [, , { onlyIf }] = plugin.toggleRecurringTaskComplete.mock.calls[0];
		expect(onlyIf(task)).toBe(true);
		expect(onlyIf(createTask({ complete_instances: ["2026-10-19"] }))).toBe(false);
		expect(onlyIf(createTask({ skipped_instances: ["2026-10-19"] }))).toBe(false);
		expect(onlyIf(createTask({ scheduled: "2026-10-21" }))).toBe(false);
	});

	it("does not complete a rescheduled occurrence that keeps its identity", async () => {
		const { plugin } = moveWith(
			createTask({ scheduled: "2026-10-21", recurrence_original_date: "2026-10-19" })
		);
		const moved = (task: TaskInfo): Date =>
			parseDateToUTC((task.recurrence_original_date ?? task.scheduled) as string);

		await expect(
			completeOccurrenceForStatusMove({
				plugin: plugin as any,
				path: "tasks/recurring.md",
				status: "done",
				shownOccurrence: getShownOccurrence(createTask(), moved),
				getOccurrenceDate: moved,
			})
		).resolves.toBe(true);
		expect(plugin.toggleRecurringTaskComplete).not.toHaveBeenCalled();
	});

	it("settles a move with no known occurrence without writing the status", async () => {
		const task = createTask();
		const plugin = {
			cacheManager: { getTaskInfo: jest.fn().mockResolvedValue(task) },
			statusManager: { isCompletedStatus: (status: string) => status === "done" },
			toggleRecurringTaskComplete: jest.fn(),
		};

		await expect(
			completeOccurrenceForStatusMove({
				plugin: plugin as any,
				path: task.path,
				status: "done",
				shownOccurrence: undefined,
				getOccurrenceDate,
			})
		).resolves.toBe(true);

		expect(plugin.toggleRecurringTaskComplete).not.toHaveBeenCalled();
	});

	it.each([
		["no status change", createTask(), { status: null }],
		["an open status", createTask(), { status: "in-progress" }],
		["an ordinary task", createTask({ recurrence: undefined }), {}],
		["a task already in a completed status", createTask({ status: "done" }), { status: "cancelled" }],
		["a missing task", null, {}],
	])("leaves %s to the ordinary move", async (_name, task, overrides) => {
		const { plugin, move } = moveWith(task, overrides);

		await expect(move()).resolves.toBe(false);

		expect(plugin.toggleRecurringTaskComplete).not.toHaveBeenCalled();
	});
});
