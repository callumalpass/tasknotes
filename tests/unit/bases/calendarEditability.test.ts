import type { EventInput, EventMountArg } from "@fullcalendar/core";
import { CalendarView } from "../../../src/bases/CalendarView";
import * as calendarCore from "../../../src/bases/calendar-core";
import { TaskFactory } from "../../helpers/mock-factories";

const task = TaskFactory.createTask({ path: "Tasks/event.md", tags: [] });
const cases: [string, Record<string, unknown>, boolean][] = [
	["scheduled", {}, true],
	["due", {}, true],
	["timeEntry", {}, true],
	["recurring", { isPatternInstance: true }, true],
	["scheduled", { isNextScheduledOccurrence: true }, true],
	["recurring", { isRecurringInstance: true, isCompleted: true }, true],
	["scheduledToDueSpan", {}, true],
	["scheduledToDueSpan", { isRecurringInstance: true }, false],
	["scheduledToDueSpan", { isNextScheduledOccurrence: true }, false],
	["scheduledToDueSpan", { isPatternInstance: true }, false],
	["timeblock", { timeblock: { id: "block", title: "Block", color: "#6366f1" } }, true],
];

function createView(viewType = "dayGridMonth") {
	const view = Object.create(CalendarView.prototype);
	Object.assign(view, {
		plugin: {
			settings: {},
			priorityManager: { getPriorityConfig: () => ({ color: "#6366f1" }) },
			statusManager: { getStatusConfig: () => ({ label: "Open" }) },
		},
		viewOptions: { calendarView: viewType, showAllDaySlot: true },
		calendar: { view: { type: viewType } },
		currentTasks: [],
		basesSortIndexByPath: new Map(),
		basesEntryByPath: new Map(),
		getVisibleProperties: () => [],
	});
	return view;
}

function createEvent(eventType: string, props: Record<string, unknown>): EventInput {
	return {
		id: "event",
		start: "2026-05-19T09:00",
		allDay: false,
		editable: false,
		extendedProps: {
			eventType,
			...(eventType === "timeblock" ? {} : { taskInfo: task }),
			...props,
		},
	};
}

afterEach(() => jest.restoreAllMocks());

describe("Calendar editability without mount-time store mutations", () => {
	it.each(cases)("mounting %s %j only decorates the DOM", (eventType, props) => {
		const view = createView();
		const element = document.createElement("div");
		const event = {
			...createEvent(eventType, props),
			setProp: jest.fn(),
			setExtendedProp: jest.fn(),
			setDates: jest.fn(),
		};
		view.handleEventDidMount({
			el: element,
			view: { type: "dayGridMonth" },
			event,
		} as unknown as EventMountArg);

		expect(event.setProp).not.toHaveBeenCalled();
		expect(event.setExtendedProp).not.toHaveBeenCalled();
		expect(event.setDates).not.toHaveBeenCalled();
		expect(element.dataset.eventType).toBe(eventType);
		if (eventType !== "timeblock") expect(element.dataset.taskPath).toBe(task.path);
	});

	it.each(cases)("builds %s %j with the existing drag/resize policy", async (eventType, props, editable) => {
		const input = createEvent(eventType, props);
		jest.spyOn(calendarCore, "generateCalendarEvents").mockResolvedValue([input as calendarCore.CalendarEvent]);
		const events = await createView().buildAllEvents({});

		expect(events).toHaveLength(1);
		expect(events[0].editable).toBe(editable);
		expect(events[0].startEditable).toBe(editable);
		expect(events[0].durationEditable).toBe(editable);
	});

	it.each([
		["ics", false],
		["ics", true],
		["property-based", true],
		["unknown", false],
	])("preserves %s permissions (%s)", async (eventType, editable) => {
		const input = createEvent(eventType as string, {});
		input.editable = editable as boolean;
		input.startEditable = false;
		input.durationEditable = true;
		jest.spyOn(calendarCore, "generateCalendarEvents").mockResolvedValue([input as calendarCore.CalendarEvent]);
		const events = await createView().buildAllEvents({});
		expect(events[0]).toMatchObject({ editable, startEditable: false, durationEditable: true });
	});

	it("preserves list-view recorded-instance inputs (no drag/resize there)", async () => {
		const input = createEvent("recurring", { isRecurringInstance: true });
		jest.spyOn(calendarCore, "generateCalendarEvents").mockResolvedValue([input as calendarCore.CalendarEvent]);
		const events = await createView("listWeek").buildAllEvents({});
		expect(events[0].editable).toBe(false);
	});
});
