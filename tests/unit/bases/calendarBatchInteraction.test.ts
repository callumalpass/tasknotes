import { Notice } from "obsidian";
import { buildCalendarEntries, planCalendarEdit, type CalendarEntry, type CalendarChange } from "@tasknotes/model/calendar";
import { CalendarView } from "../../../src/bases/CalendarView";
import { eventApiFromItem, type CalendarEventItem, type CalendarEventChange } from "../../../src/bases/calendarEngine";
import { DEFAULT_FIELD_MAPPING } from "../../../src/core/defaultFieldMapping";
import { createI18nService } from "../../../src/i18n";
import { TaskFactory } from "../../helpers/mock-factories";
import type { TaskInfo } from "../../../src/types";

function harness(failSecond = false) {
	const initial = [0, 1].map(i => TaskFactory.createTask({ id: `batch-${i}`, path: `Tasks/${i}.md`, scheduled: `2026-11-0${2+i}T09:00` }));
	const tasks = new Map(initial.map(task => [task.path, task]));
	const entries = buildCalendarEntries({ tasks: initial, timezone: "UTC", now: "2026-11-01T00:00:00Z", range: { start: "2026-11-01", end: "2026-12-01" } });
	const items: CalendarEventItem[] = entries.map(entry => ({
		id: entry.id, title: entry.title, start: entry.start, end: entry.end, allDay: entry.allDay,
		data: { modelEntry: entry, taskInfo: initial.find(task => task.id === entry.taskId), eventType: entry.type },
	}));
	const oldEvent = eventApiFromItem(items[0]);
	const info: CalendarEventChange = { oldEvent, event: { ...oldEvent, start: new Date("2026-11-03T09:00:00Z") }, isPointer: true, jsEvent: null, revert: jest.fn() };
	const apply = jest.fn(async (task: TaskInfo, entry: CalendarEntry, change: CalendarChange) => {
		if (failSecond && task.path === initial[1].path) throw new Error("Simulated write failure");
		const plan = planCalendarEdit({ task, entry, change, timezone: "UTC", fieldMapping: DEFAULT_FIELD_MAPPING, now: "2026-11-01T00:00:00Z" });
		tasks.set(task.path, plan.updatedTask);
		return plan.updatedTask;
	});
	const view = Object.assign(Object.create(CalendarView.prototype), {
		calendarItems: items, calendarTimezone: "UTC", batchMoveInProgress: false,
		containerEl: document.createElement("div"), refreshAfterDirectCalendarTaskWrite: jest.fn(), refreshTaskItems: jest.fn(),
		plugin: { i18n: createI18nService(), fieldMapper: { getMapping: () => DEFAULT_FIELD_MAPPING },
			cacheManager: { getTaskInfo: jest.fn(async path => tasks.get(path)) }, taskService: { applyCalendarEdit: apply } },
	}) as { moveSelectedCalendarTasks(info: CalendarEventChange, paths: string[]): Promise<void>; batchMoveInProgress: boolean; refreshTaskItems: jest.Mock };
	return { initial, tasks, view, info, apply };
}
function undoButton(): HTMLButtonElement {
	const calls = (Notice as unknown as jest.Mock).mock.calls;
	for (const [content] of [...calls].reverse()) {
		if (content instanceof DocumentFragment) {
			const button = content.querySelector("button");
			if (button) return button;
		}
	}
	throw new Error("Missing Undo action");
}
async function settle() { await new Promise(resolve => setTimeout(resolve, 0)); }
beforeEach(() => jest.clearAllMocks());

it("validates hidden and incompatible selections before writing any task", async () => {
	const { initial, view, info, apply } = harness();
	await view.moveSelectedCalendarTasks(info, [initial[0].path, "Tasks/missing.md"]);
	expect(apply).not.toHaveBeenCalled();
	expect(info.revert).toHaveBeenCalled();
	expect(view.batchMoveInProgress).toBe(false);
});

it("reports partial failure and Undo restores only the successfully moved task", async () => {
	const { initial, tasks, view, info, apply } = harness(true);
	await view.moveSelectedCalendarTasks(info, initial.map(task => task.path));
	expect(apply).toHaveBeenCalledTimes(2);
	expect(view.refreshTaskItems).toHaveBeenCalledTimes(1);
	expect(tasks.get(initial[0].path)?.scheduled).toBe("2026-11-03T09:00");
	expect(tasks.get(initial[1].path)?.scheduled).toBe(initial[1].scheduled);
	const button = undoButton();
	expect(button.parentNode?.textContent).toContain("successful: 1; failed: 1");
	button.click(); await settle();
	expect(tasks.get(initial[0].path)?.scheduled).toBe(initial[0].scheduled);
	expect(apply).toHaveBeenCalledTimes(3);
});

it("Undo preserves later date changes and restores unaffected tasks", async () => {
	const { initial, tasks, view, info } = harness();
	await view.moveSelectedCalendarTasks(info, initial.map(task => task.path));
	tasks.set(initial[0].path, { ...initial[0], scheduled: "2026-11-20T18:00" });
	undoButton().click(); await settle();
	expect(tasks.get(initial[0].path)?.scheduled).toBe("2026-11-20T18:00");
	expect(tasks.get(initial[1].path)?.scheduled).toBe(initial[1].scheduled);
});

it("refuses overlapping batch gestures", async () => {
	const { initial, view, info, apply } = harness();
	view.batchMoveInProgress = true;
	await view.moveSelectedCalendarTasks(info, initial.map(task => task.path));
	expect(apply).not.toHaveBeenCalled();
	expect(info.revert).toHaveBeenCalled();
});
