/**
 * Issue #1936: Calendar drag/drop snapping can be more granular than the
 * visible time slot duration.
 */

import { calendarOptionsFor } from "../../helpers/calendarViewHarness";

describe("Issue #1936: Calendar drag/drop snap duration", () => {
	afterEach(() => document.body.replaceChildren());

	it("defaults drag/drop snapping to the time slot duration", () => {
		const options = calendarOptionsFor({ slotDuration: "00:15:00" });

		expect(options.slotDuration).toBe("00:15:00");
		expect(options.snapDuration).toBe("00:15:00");
	});

	it("passes a snap duration more granular than the visible slots", () => {
		const options = calendarOptionsFor({ slotDuration: "00:30:00", snapDuration: "00:05:00" });

		expect(options.slotDuration).toBe("00:30:00");
		expect(options.snapDuration).toBe("00:05:00");
	});

	it("falls back to the time slot duration when the snap duration is invalid", () => {
		const options = calendarOptionsFor({ slotDuration: "00:30:00", snapDuration: "not-a-time" });

		expect(options.snapDuration).toBe("00:30:00");
	});
});
