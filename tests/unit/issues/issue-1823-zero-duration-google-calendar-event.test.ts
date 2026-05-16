import { createICSEvent } from "../../../src/bases/calendar-core";
import type { ICSEvent } from "../../../src/types";

function makeEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id: "google-event-1",
		subscriptionId: "google-primary",
		title: "Moved recurring exception",
		start: "2026-04-22T23:12:00",
		end: "2026-04-22T23:12:00",
		allDay: false,
		...overrides,
	};
}

describe("Issue #1823: zero-duration Google Calendar events", () => {
	it("omits the render end for timed external events whose start and end are identical", () => {
		const icsEvent = makeEvent();

		const calendarEvent = createICSEvent(icsEvent, {} as any);

		expect(calendarEvent).not.toBeNull();
		expect(calendarEvent?.start).toBe("2026-04-22T23:12:00");
		expect(calendarEvent?.end).toBeUndefined();
		expect(calendarEvent?.allDay).toBe(false);
		expect(calendarEvent?.extendedProps?.icsEvent).toBe(icsEvent);
	});

	it("preserves real timed event end values", () => {
		const icsEvent = makeEvent({
			end: "2026-04-22T23:42:00",
		});

		const calendarEvent = createICSEvent(icsEvent, {} as any);

		expect(calendarEvent?.end).toBe("2026-04-22T23:42:00");
	});

	it("does not normalize all-day event ends", () => {
		const icsEvent = makeEvent({
			start: "2026-04-22",
			end: "2026-04-22",
			allDay: true,
		});

		const calendarEvent = createICSEvent(icsEvent, {} as any);

		expect(calendarEvent?.end).toBe("2026-04-22");
		expect(calendarEvent?.allDay).toBe(true);
	});
});
