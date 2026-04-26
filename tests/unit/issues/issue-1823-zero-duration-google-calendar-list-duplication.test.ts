import { beforeEach, describe, expect, it } from "@jest/globals";

import { createICSEvent } from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";
import type { ICSEvent } from "../../../src/types";

function createCalendarPlugin(): TaskNotesPlugin {
	return {} as TaskNotesPlugin;
}

beforeEach(() => {
	(globalThis as typeof globalThis & {
		activeDocument?: {
			body: {
				classList: {
					contains: (className: string) => boolean;
				};
			};
		};
	}).activeDocument = {
		body: {
			classList: {
				contains: (_className: string) => false,
			},
		},
	};
});

function createGoogleCalendarEvent(overrides: Partial<ICSEvent> = {}): ICSEvent {
	return {
		id: "google-primary-zero-duration-event",
		subscriptionId: "google-primary",
		title: "Ocado reserved cutoff",
		start: "2026-04-22T23:12:00",
		end: "2026-04-22T23:12:00",
		allDay: false,
		color: "#16a765",
		...overrides,
	};
}

describe("Issue #1823: zero-duration Google Calendar list duplication", () => {
	it("adds a minimal duration to zero-duration timed Google Calendar events", () => {
		const icsEvent = createGoogleCalendarEvent();

		const calendarEvent = createICSEvent(icsEvent, createCalendarPlugin());

		expect(calendarEvent).not.toBeNull();
		expect(calendarEvent?.start).toBe("2026-04-22T23:12:00");
		expect(calendarEvent?.end).not.toBe("2026-04-22T23:12:00");
		expect(calendarEvent?.allDay).toBe(false);
		expect(calendarEvent?.extendedProps.icsEvent?.end).toBe("2026-04-22T23:12:00");
		expect(new Date(calendarEvent!.end!).getTime() - new Date(calendarEvent!.start).getTime()).toBe(1);
	});

	it("preserves an explicit offset when normalizing zero-duration timed events", () => {
		const icsEvent = createGoogleCalendarEvent({
			start: "2026-04-22T23:12:00+01:00",
			end: "2026-04-22T23:12:00+01:00",
		});

		const calendarEvent = createICSEvent(icsEvent, createCalendarPlugin());

		expect(calendarEvent?.start).toBe("2026-04-22T23:12:00+01:00");
		expect(calendarEvent?.end).toBe("2026-04-22T23:12:00.001+01:00");
		expect(new Date(calendarEvent!.end!).getTime() - new Date(calendarEvent!.start).getTime()).toBe(1);
	});

	it("preserves UTC formatting when normalizing zero-duration timed events", () => {
		const icsEvent = createGoogleCalendarEvent({
			start: "2026-04-22T22:12:00.000Z",
			end: "2026-04-22T22:12:00.000Z",
		});

		const calendarEvent = createICSEvent(icsEvent, createCalendarPlugin());

		expect(calendarEvent?.start).toBe("2026-04-22T22:12:00.000Z");
		expect(calendarEvent?.end).toBe("2026-04-22T22:12:00.001Z");
		expect(new Date(calendarEvent!.end!).getTime() - new Date(calendarEvent!.start).getTime()).toBe(1);
	});

	it("leaves non-zero timed Google Calendar events unchanged", () => {
		const icsEvent = createGoogleCalendarEvent({
			end: "2026-04-22T23:42:00",
		});

		const calendarEvent = createICSEvent(icsEvent, createCalendarPlugin());

		expect(calendarEvent?.start).toBe("2026-04-22T23:12:00");
		expect(calendarEvent?.end).toBe("2026-04-22T23:42:00");
	});

	it("leaves all-day Google Calendar events unchanged", () => {
		const icsEvent = createGoogleCalendarEvent({
			start: "2026-04-22",
			end: "2026-04-23",
			allDay: true,
		});

		const calendarEvent = createICSEvent(icsEvent, createCalendarPlugin());

		expect(calendarEvent?.start).toBe("2026-04-22");
		expect(calendarEvent?.end).toBe("2026-04-23");
		expect(calendarEvent?.allDay).toBe(true);
	});
});
