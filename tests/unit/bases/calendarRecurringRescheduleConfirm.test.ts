// Calendar planning needs the real recurrence parser, and the drop feedback formats real dates.
jest.mock("rrule", () => jest.requireActual("rrule/dist/es5/rrule.js"));
jest.mock("date-fns", () => jest.requireActual("../../../node_modules/date-fns"));
jest.mock("../../../src/ui/taskMutationUndo", () => ({
	captureTaskUndo: async (_plugin: unknown, _task: unknown, operation: () => Promise<unknown>) => ({
		task: await operation(),
	}),
}));
jest.mock("../../../src/ui/taskPropertyPickers", () => ({ showTaskUndo: jest.fn() }));

import { buildCalendarEntries } from "@tasknotes/model/calendar";
import { CalendarView } from "../../../src/bases/CalendarView";
import { eventApiFromItem, type CalendarEventChange } from "../../../src/bases/calendarEngine";
import {
	handleCalendarEventDrop,
	type CalendarMutationContext,
} from "../../../src/bases/calendarMutations";
import type TaskNotesPlugin from "../../../src/main";
import { TaskService } from "../../../src/services/TaskService";
import { showTaskUndo } from "../../../src/ui/taskPropertyPickers";
import type { TaskInfo } from "../../../src/types";
import { TASK_PATH_DRAG_TYPE } from "../../../src/utils/DragDropManager";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

/**
 * A weekly task whose next occurrence is Sunday 22 November, with the previous
 * Sunday completed and the following Sunday skipped. Moving it to Saturday 21
 * November would clear the skipped 29 November.
 */
function weeklyTask(): TaskInfo {
	return TaskFactory.createTask({
		id: "weekly",
		path: "Tasks/Weekly review.md",
		title: "Weekly review",
		scheduled: "2026-11-22",
		recurrence: "DTSTART:20261101;FREQ=WEEKLY",
		complete_instances: ["2026-11-15"],
		skipped_instances: ["2026-11-29"],
	});
}

function harness(confirmed: boolean) {
	const task = weeklyTask();
	const frontmatter: Record<string, unknown> = {
		scheduled: task.scheduled,
		recurrence: task.recurrence,
		complete_instances: [...(task.complete_instances ?? [])],
		skipped_instances: [...(task.skipped_instances ?? [])],
	};
	const confirm = jest.fn(async () => confirmed);
	const plugin = PluginFactory.createMockPlugin({
		settings: { calendarViewSettings: { timeFormat: "24" } },
		cacheManager: {
			getTaskInfo: jest.fn(async () => task),
			updateTaskInfoInCache: jest.fn(),
		},
		taskCalendarSyncService: { isEnabled: () => false },
		confirmClearRescheduledInstances: confirm,
	});
	plugin.app.fileManager.processFrontMatter = jest.fn(
		async (_file: unknown, update: (frontmatter: Record<string, unknown>) => void) => {
			update(frontmatter);
		}
	);
	plugin.taskService = new TaskService(plugin);
	return { task, frontmatter, confirm, plugin: plugin as TaskNotesPlugin };
}

/** Drags the task's next occurrence to Saturday 21 November in the calendar grid. */
function dragNextOccurrence(task: TaskInfo): CalendarEventChange {
	const [entry] = buildCalendarEntries({
		tasks: [task],
		timezone: "UTC",
		now: "2026-11-20T12:00:00Z",
		range: { start: "2026-11-16", end: "2026-11-23" },
	}).filter((candidate) => candidate.recurringKind === "next-scheduled");
	const oldEvent = eventApiFromItem({
		id: entry.id,
		title: entry.title,
		start: entry.start,
		end: entry.end,
		allDay: entry.allDay,
		data: { modelEntry: entry, taskInfo: task, eventType: entry.type },
	});
	return {
		oldEvent,
		event: { ...oldEvent, start: new Date("2026-11-21T00:00:00Z"), end: null },
		isPointer: true,
		jsEvent: null,
		revert: jest.fn(),
	};
}

/** Drops the task on Saturday 21 November from outside the calendar, such as from a task link in a note. */
async function dropFromOutside(plugin: TaskNotesPlugin, task: TaskInfo) {
	const view = Object.assign(Object.create(CalendarView.prototype), {
		plugin,
		expectImmediateUpdate: jest.fn(),
		refreshAfterDirectCalendarTaskWrite: jest.fn(),
	}) as CalendarView & { refreshAfterDirectCalendarTaskWrite: jest.Mock };
	const dataTransfer = {
		types: [TASK_PATH_DRAG_TYPE],
		getData: (type: string) => (type === TASK_PATH_DRAG_TYPE ? task.path : ""),
	} as unknown as DataTransfer;
	await (view as unknown as {
		handleExternalTaskDrop(arg: { dataTransfer: DataTransfer; startStr: string }): Promise<void>;
	}).handleExternalTaskDrop({ dataTransfer, startStr: "2026-11-21" });
	return view;
}

function mutationContext(plugin: TaskNotesPlugin): CalendarMutationContext {
	return {
		plugin,
		options: { startDateProperty: null, endDateProperty: null },
		timezone: "UTC",
		refreshTask: jest.fn(),
		refreshEvent: jest.fn(),
	};
}

describe("calendar reschedules that would clear a recurring task's recorded instances", () => {
	describe("dragging the next occurrence within the calendar", () => {
		it("asks first, and Cancel reverts the drop and keeps the schedule and its history", async () => {
			const { task, frontmatter, confirm, plugin } = harness(false);
			const info = dragNextOccurrence(task);

			await handleCalendarEventDrop(mutationContext(plugin), info);

			expect(confirm).toHaveBeenCalledWith({ complete: [], skipped: ["2026-11-29"] });
			expect(info.revert).toHaveBeenCalled();
			expect(plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
			expect(frontmatter).toMatchObject({
				scheduled: "2026-11-22",
				complete_instances: ["2026-11-15"],
				skipped_instances: ["2026-11-29"],
			});
			expect(showTaskUndo).not.toHaveBeenCalled();
		});

		it("clears the listed instances once confirmed", async () => {
			const { task, frontmatter, confirm, plugin } = harness(true);
			const info = dragNextOccurrence(task);

			await handleCalendarEventDrop(mutationContext(plugin), info);

			expect(confirm).toHaveBeenCalledWith({ complete: [], skipped: ["2026-11-29"] });
			expect(info.revert).not.toHaveBeenCalled();
			expect(frontmatter.scheduled).toBe("2026-11-21");
			expect(frontmatter.complete_instances).toEqual(["2026-11-15"]);
			expect(frontmatter.skipped_instances ?? []).toEqual([]);
			expect(showTaskUndo).toHaveBeenCalledTimes(1);
		});
	});

	describe("dropping the task into the calendar from outside it", () => {
		it("asks first, and Cancel keeps the schedule and its history", async () => {
			const { task, frontmatter, confirm, plugin } = harness(false);

			const view = await dropFromOutside(plugin, task);

			expect(confirm).toHaveBeenCalledWith({ complete: [], skipped: ["2026-11-29"] });
			expect(plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
			expect(frontmatter).toMatchObject({
				scheduled: "2026-11-22",
				complete_instances: ["2026-11-15"],
				skipped_instances: ["2026-11-29"],
			});
			expect(view.refreshAfterDirectCalendarTaskWrite).not.toHaveBeenCalled();
			expect(showTaskUndo).not.toHaveBeenCalled();
		});

		it("clears the listed instances once confirmed", async () => {
			const { task, frontmatter, confirm, plugin } = harness(true);

			const view = await dropFromOutside(plugin, task);

			expect(confirm).toHaveBeenCalledWith({ complete: [], skipped: ["2026-11-29"] });
			expect(frontmatter.scheduled).toBe("2026-11-21");
			expect(frontmatter.complete_instances).toEqual(["2026-11-15"]);
			expect(frontmatter.skipped_instances ?? []).toEqual([]);
			expect(view.refreshAfterDirectCalendarTaskWrite).toHaveBeenCalledTimes(1);
			expect(showTaskUndo).toHaveBeenCalledTimes(1);
		});
	});
});
