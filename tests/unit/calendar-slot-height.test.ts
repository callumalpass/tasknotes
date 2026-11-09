/**
 * Calendar time grid: the height of one slot is configurable, so short slots
 * such as 15 minutes no longer make a day taller than the window.
 */

import { calendarOptionsFor } from "../helpers/calendarViewHarness";
import { DEFAULT_CALENDAR_VIEW_SETTINGS } from "../../src/settings/defaults";

describe("Calendar time slot height", () => {
	afterEach(() => document.body.replaceChildren());

	it("uses the saved slot height when the view does not override it", () => {
		expect(calendarOptionsFor({}).slotHeight).toBe(
			DEFAULT_CALENDAR_VIEW_SETTINGS.slotHeight
		);
	});

	it("passes a per-view slot height to the calendar", () => {
		const options = calendarOptionsFor({ slotDuration: "00:15:00", slotHeight: 10 });

		expect(options.slotDuration).toBe("00:15:00");
		expect(options.slotHeight).toBe(10);
	});

	it("clamps a slot height outside the supported range", () => {
		expect(calendarOptionsFor({ slotHeight: 1 }).slotHeight).toBe(5);
		expect(calendarOptionsFor({ slotHeight: 500 }).slotHeight).toBe(96);
	});

	it("offers pinching unless the view turns it off", () => {
		expect(calendarOptionsFor({}).pinchZoom).toBe(true);
		expect(calendarOptionsFor({ pinchZoom: false }).pinchZoom).toBe(false);
	});

	it("keeps a pinched height on the device until the configured height changes", () => {
		const localStorage = new Map<string, unknown>();
		const options = calendarOptionsFor({ slotHeight: 30 }, { localStorage });
		options.onSlotHeightChange?.(48);

		expect(calendarOptionsFor({ slotHeight: 30 }, { localStorage }).slotHeight).toBe(48);
		expect(calendarOptionsFor({ slotHeight: 20 }, { localStorage }).slotHeight).toBe(20);
	});

	it("falls back to the saved height when the value is not a number", () => {
		expect(calendarOptionsFor({ slotHeight: "not-a-number" }).slotHeight).toBe(
			DEFAULT_CALENDAR_VIEW_SETTINGS.slotHeight
		);
	});
});
