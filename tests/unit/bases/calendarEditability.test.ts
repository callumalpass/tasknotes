import type { CalendarEventInput } from "../../../src/bases/calendarEngine";
import { toCalendarItems } from "../../../src/bases/calendarEngine";
import { TaskFactory } from "../../helpers/mock-factories";

const task = TaskFactory.createTask({ path: "Tasks/event.md", tags: [] });

function createEvent(
	eventType: string,
	props: Record<string, unknown>,
	editable = false
): CalendarEventInput {
	return {
		id: "event",
		title: "Event",
		start: "2026-05-19T09:00",
		allDay: false,
		editable,
		extendedProps: {
			eventType,
			...(eventType === "timeblock" ? {} : { taskInfo: task }),
			...props,
		},
	} as unknown as CalendarEventInput;
}

describe("Calendar editability policy", () => {
	it.each<[string, Record<string, unknown>, boolean]>([
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
	])("makes %s %j editable: %s", (eventType, props, editable) => {
		const [item] = toCalendarItems([createEvent(eventType, props)]);
		expect(item.editable).toBe(editable);
	});

	it.each([
		["ics", false],
		["ics", true],
		["property-based", true],
		["unknown", false],
	])("keeps the builder's permission for %s events (%s)", (eventType, editable) => {
		const [item] = toCalendarItems([createEvent(eventType, {}, editable)]);
		expect(item.editable).toBe(editable);
	});

	it("keeps duplicate event ids distinct so each event can be dragged", () => {
		const items = toCalendarItems([createEvent("scheduled", {}), createEvent("due", {})]);
		expect(new Set(items.map((item) => item.id)).size).toBe(2);
	});
});
