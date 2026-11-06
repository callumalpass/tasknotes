import { buildCalendarEntries } from "@tasknotes/model/calendar";
import { buildCalendarBatchPreview, isCalendarBatchTarget, planCalendarBatchMove } from "../../../src/bases/calendarBatchMove";
import { eventApiFromItem, type CalendarEventChange, type CalendarEventItem } from "../../../src/bases/calendarEngine";
import { TaskFactory } from "../../helpers/mock-factories";
import { DEFAULT_FIELD_MAPPING } from "../../../src/core/defaultFieldMapping";

function fixture(timezone = "UTC", type = "scheduled", values = ["2026-03-07T09:00", "2026-03-08T14:30"]) {
	const tasks = values.map((scheduled, i) => TaskFactory.createTask({
		path: `Tasks/${i}.md`, scheduled, due: `2026-03-${10 + i}T17:00`,
	}));
	const entries = buildCalendarEntries({ tasks, timezone, now: "2026-03-01T00:00:00Z",
		range: { start: "2026-03-01", end: "2026-04-01" }, settings: { showDue: true } });
	const items: CalendarEventItem[] = entries.map(entry => ({
		id: entry.id, title: entry.title, start: entry.start, end: entry.end, allDay: entry.allDay,
		data: { modelEntry: entry, taskInfo: tasks.find(task => task.path === entry.taskId)!, eventType: entry.type },
	}));
	// Factory IDs may be used by the model instead of paths.
	for (const item of items) item.data!.taskInfo = tasks.find(task => item.data!.modelEntry!.taskId === (task.id || task.path))!;
	const anchor = items.find(item => item.data?.eventType === type)!;
	const oldEvent = eventApiFromItem(anchor);
	const info: CalendarEventChange = { oldEvent, event: { ...oldEvent, start: new Date(oldEvent.start!.getTime() + 86400000) },
		isPointer: true, jsEvent: null, revert: jest.fn() };
	const plan = () => planCalendarBatchMove(items, tasks, info, timezone, DEFAULT_FIELD_MAPPING, "2026-03-01T00:00:00Z");
	return { tasks, items, info, plan };
}

describe("calendar task batch moves", () => {
	it("moves scheduled dates by the same offset, retaining relative times and deadlines", () => {
		const { plan } = fixture();
		const moves = plan();
		expect(moves.map(move => move.after.scheduled)).toEqual(["2026-03-08T09:00", "2026-03-09T14:30"]);
		expect(moves.map(move => move.after.due)).toEqual(["2026-03-10T17:00", "2026-03-11T17:00"]);
		expect(moves[0].undoChange.start).toBe("2026-03-07T09:00");
	});

	it("moves due markers without changing scheduled dates", () => {
		const { plan, tasks } = fixture("UTC", "due");
		const moves = plan();
		expect(moves.map(move => move.after.scheduled)).toEqual(tasks.map(task => task.scheduled));
		expect(moves.map(move => move.after.due)).toEqual(["2026-03-11T17:00", "2026-03-12T17:00"]);
	});

	it("keeps date-only tasks date-only in a mixed selection", () => {
		const { plan } = fixture("UTC", "scheduled", ["2026-03-07", "2026-03-08T14:30"]);
		expect(plan().map(move => move.after.scheduled)).toEqual(["2026-03-08", "2026-03-09T14:30"]);
	});

	it("keeps floating local times across a DST transition", () => {
		const { info, plan } = fixture("America/New_York");
		info.oldEvent.start = new Date("2026-03-07T14:00:00Z");
		info.event.start = new Date("2026-03-08T13:00:00Z");
		expect(plan().map(move => move.after.scheduled)).toEqual(["2026-03-08T09:00", "2026-03-09T14:30"]);
	});

	it("shifts timed tasks across midnight without losing their spacing", () => {
		const { info, plan } = fixture();
		info.event.start = new Date("2026-03-07T23:30:00Z");
		expect(plan().map(move => move.after.scheduled)).toEqual(["2026-03-07T23:30", "2026-03-09T05:00"]);
	});

	it("rejects all-day/timed conversion before writing", () => {
		const { info, plan } = fixture();
		info.event.allDay = true;
		expect(plan).toThrow("Unsupported");
	});

	it.each(["hidden", "changed", "recurring", "missing marker"])("rejects a %s selection before writing", mode => {
		const { items, tasks, plan } = fixture();
		if (mode === "hidden") items.splice(0, items.length - 1);
		if (mode === "changed") tasks[1] = { ...tasks[1], scheduled: "2026-03-25" };
		if (mode === "recurring") tasks[1] = { ...tasks[1], recurrence: "FREQ=DAILY" };
		if (mode === "missing marker") items.splice(0, items.length, ...items.filter(item => item.data?.taskInfo?.path !== tasks[1].path || item.data?.eventType !== "scheduled"));
		expect(plan).toThrow();
	});

	it("rejects a source refresh that changed the dragged task during the gesture", () => {
		const { items, tasks, plan } = fixture();
		const index = items.findIndex(item => item.data?.taskInfo?.path === tasks[0].path && item.data?.eventType === "scheduled");
		items[index] = { ...items[index], data: { ...items[index].data!, taskInfo: { ...tasks[0], scheduled: "2026-03-25" } } };
		expect(plan).toThrow("Dragged task changed");
	});

	it.each(["scheduled", "due"])("previews the other selected %s marker using the persistence plan without mutating source items", type => {
		const { items, tasks, info, plan } = fixture("UTC", type);
		const before = JSON.stringify(items);
		const anchor = items.find(item => item.id === info.oldEvent.id)!;
		const peers = buildCalendarBatchPreview(items, tasks.map(task => task.path), {
			item: anchor, start: info.event.start!, end: info.event.end ?? info.event.start!, allDay: info.event.allDay,
		}, "UTC", DEFAULT_FIELD_MAPPING, "2026-03-01T00:00:00Z")!;
		expect(peers).toHaveLength(1);
		expect(peers[0].id).not.toBe(anchor.id);
		expect(peers[0].start).toBe(plan()[1].change.start);
		expect(peers[0].data?.eventType).toBe(type);
		expect(peers[0].className).toContain("tn-calendar-batch-preview");
		expect(peers[0].editable).toBe(false);
		expect(isCalendarBatchTarget(peers[0].data)).toBe(false);
		expect(JSON.stringify(items)).toBe(before);
	});

	it.each(["timeEntry", "scheduledToDueSpan"])("leaves a selected task's %s item on the single-item drag path", type => {
		const { items, tasks, info } = fixture();
		const anchor = items.find(item => item.id === info.oldEvent.id)!;
		const item = { ...anchor, data: { ...anchor.data!, modelEntry: { ...anchor.data!.modelEntry!, type } } } as CalendarEventItem;
		expect(buildCalendarBatchPreview(items, tasks.map(task => task.path), {
			item, start: info.event.start!, end: info.event.end ?? info.event.start!, allDay: info.event.allDay,
		}, "UTC", DEFAULT_FIELD_MAPPING, "2026-03-01T00:00:00Z")).toBeNull();
	});

	it("does not offer task-level selection for time entries or recurring previews", () => {
		const { items } = fixture();
		const props = items[0].data!;
		expect(isCalendarBatchTarget(props)).toBe(true);
		expect(isCalendarBatchTarget({ ...props, modelEntry: { ...props.modelEntry!, recurringKind: "pattern" } })).toBe(false);
		expect(isCalendarBatchTarget({ ...props, modelEntry: { ...props.modelEntry!, type: "timeEntry" } })).toBe(false);
		expect(isCalendarBatchTarget({ ...props, modelEntry: { ...props.modelEntry!, type: "scheduledToDueSpan" } })).toBe(false);
		expect(isCalendarBatchTarget({ ...props, modelEntry: { ...props.modelEntry!, isOverdueOnToday: true } })).toBe(false);
	});
});
