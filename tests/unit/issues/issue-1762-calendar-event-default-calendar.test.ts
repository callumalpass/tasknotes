import { describe, expect, it } from "@jest/globals";

import { getDefaultWritableCalendarIndex } from "../../../src/modals/CalendarEventCreationModal";

function entry(providerId: string, calendarId: string, primary = false) {
	return {
		provider: {
			providerId,
			providerName: providerId,
		},
		calendar: {
			id: calendarId,
			summary: calendarId,
			primary,
		},
	} as any;
}

describe("Issue #1762: external calendar event default calendar", () => {
	it("uses the configured Google task export target calendar when available", () => {
		const calendars = [
			entry("google", "primary", true),
			entry("google", "work"),
			entry("microsoft", "work"),
		];

		expect(getDefaultWritableCalendarIndex(calendars, "work")).toBe(1);
	});

	it("does not match a Google target calendar ID against another provider", () => {
		const calendars = [
			entry("microsoft", "work"),
			entry("google", "primary", true),
		];

		expect(getDefaultWritableCalendarIndex(calendars, "work")).toBe(1);
	});

	it("falls back to the primary calendar, then the first calendar", () => {
		expect(
			getDefaultWritableCalendarIndex(
				[entry("google", "personal"), entry("microsoft", "primary", true)],
				"missing"
			)
		).toBe(1);

		expect(
			getDefaultWritableCalendarIndex(
				[entry("google", "personal"), entry("microsoft", "team")],
				"missing"
			)
		).toBe(0);
	});
});
