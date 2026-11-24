import { createTimeblockEvent } from "../../../src/bases/calendar-core";

describe("calendar timeblock ends", () => {
	it.each([
		["23:30", "00:00", "2027-01-01T00:00:00"],
		["23:45", "24:00", "2027-01-01T00:00:00"],
		["00:00", "00:30", "2026-12-31T00:30:00"],
	])("renders %s–%s with end %s", (startTime, endTime, end) => {
		const date = "2026-12-31";
		const timeblock = { id: "late-block", title: "Focus", startTime, endTime };

		expect(createTimeblockEvent(timeblock, date)).toMatchObject({
			start: `${date}T${startTime}:00`,
			end,
			extendedProps: { timeblock, originalDate: date },
		});
	});
});
