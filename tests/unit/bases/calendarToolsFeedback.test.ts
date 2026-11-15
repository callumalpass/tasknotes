import { handleCalendarEventDrop, type CalendarMutationContext } from "../../../src/bases/calendarMutations";
import type { CalendarEventChange } from "../../../src/bases/calendarEngine";
import { captureTaskUndo } from "../../../src/ui/taskMutationUndo";
import { showTaskUndo } from "../../../src/ui/taskPropertyPickers";
import { NotificationService } from "../../../src/ui/NotificationService";
import type TaskNotesPlugin from "../../../src/main";

jest.mock("date-fns", () => jest.requireActual("../../../node_modules/date-fns"));
jest.mock("../../../src/ui/taskMutationUndo", () => ({ captureTaskUndo: jest.fn() }));
jest.mock("../../../src/ui/taskPropertyPickers", () => ({ showTaskUndo: jest.fn() }));

describe("Tools time-format feedback", () => {
	beforeEach(() => jest.clearAllMocks());

	it.each([
		["24", false, "13:05", false],
		["12", false, "1:05 PM", true],
		["24", true, "Nov 7, 2026", false],
	] as const)("calendar move uses %s-hour format, allDay=%s", async (timeFormat, allDay, expected, hasPeriod) => {
		const task = { path: "Tasks/Review.md", title: "Review", scheduled: "2026-11-07T13:05" };
		const undo = jest.fn();
		jest.mocked(captureTaskUndo).mockResolvedValue({ task, undo } as never);
		const plugin = {
			settings: { calendarViewSettings: { timeFormat } },
			cacheManager: { getTaskInfo: jest.fn().mockResolvedValue(task) },
			app: { vault: {} },
		} as unknown as TaskNotesPlugin;
		const event = { start: new Date(2026, 10, 7, 13, 5), allDay, extendedProps: { taskInfo: task, modelEntry: {} } };
		const info = { event, oldEvent: event, revert: jest.fn() } as unknown as CalendarEventChange;
		await handleCalendarEventDrop({ plugin, options: {}, refreshTask: jest.fn() } as unknown as CalendarMutationContext, info);
		expect(info.revert).not.toHaveBeenCalled();
		const feedback = jest.mocked(showTaskUndo).mock.calls[0];
		expect(feedback.slice(0, 3)).toEqual([[undo], false, 1]);
		expect(feedback[4]).toContain(expected);
		expect(/AM|PM/.test(feedback[4] ?? "")).toBe(hasPeriod);
		if (allDay) expect(feedback[4]).not.toMatch(/\d:\d/);
	});

	it.each(["12", "24"] as const)("calendar move prefers the effective %s-hour view clock", async timeFormat => {
		const task = { path: "Tasks/Review.md", title: "Review", scheduled: "2026-11-07T13:05" };
		jest.mocked(captureTaskUndo).mockResolvedValue({ task } as never);
		const plugin = {
			settings: { calendarViewSettings: { timeFormat: timeFormat === "12" ? "24" : "12" } },
			cacheManager: { getTaskInfo: jest.fn().mockResolvedValue(task) },
			app: { vault: {} },
		} as unknown as TaskNotesPlugin;
		const event = { start: new Date(2026, 10, 7, 13, 5), allDay: false, extendedProps: { taskInfo: task, modelEntry: {} } };
		const info = { event, oldEvent: event, revert: jest.fn() } as unknown as CalendarEventChange;
		await handleCalendarEventDrop({ plugin, options: { timeFormat }, refreshTask: jest.fn() } as unknown as CalendarMutationContext, info);
		expect(info.revert).not.toHaveBeenCalled();
		expect(jest.mocked(showTaskUndo).mock.calls[0][4]).toContain(timeFormat === "12" ? "1:05 PM" : "13:05");
	});

	it.each(["12", "24"] as const)("reminder times use the configured %s-hour clock", timeFormat => {
		const service = new NotificationService({ settings: { calendarViewSettings: { timeFormat } } } as unknown as TaskNotesPlugin);
		const formatted = (service as unknown as { formatDateParts(timestamp: number): { time: string } }).formatDateParts(new Date(2026, 10, 7, 13, 5).getTime());
		expect(formatted.time).toContain(timeFormat === "24" ? "13:05" : "1:05");
		expect(/AM|PM/.test(formatted.time)).toBe(timeFormat === "12");
	});

	it("defaults incomplete reminder settings to the 24-hour clock", () => {
		const service = new NotificationService({ settings: {} } as unknown as TaskNotesPlugin);
		const formatted = (service as unknown as { formatDateParts(timestamp: number): { time: string } }).formatDateParts(new Date(2026, 10, 7, 13, 5).getTime());
		expect(formatted.time).toBe("13:05");
	});
});
