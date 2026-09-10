import {
	formatIcsDateValue,
	icsDateValueToTaskDate,
	icsStampToEpochMs,
	isoToIcsUtcStamp,
	parseIcsDateValue,
	taskDateToIcsDateValue,
} from "../../../src/services/caldav/icsDateValue";

// jest.config.js pins TZ=UTC, so local wall time and UTC wall time coincide
// here. Conversions that depend on a real offset are exercised through the
// injected zone resolver instead.

describe("parseIcsDateValue", () => {
	it("parses a date-only value", () => {
		expect(parseIcsDateValue("20250901", { VALUE: "DATE" })).toEqual({
			dateOnly: true,
			value: "2025-09-01",
			utc: false,
		});
	});

	it("parses a UTC date-time", () => {
		expect(parseIcsDateValue("20250901T120000Z")).toEqual({
			dateOnly: false,
			value: "2025-09-01T12:00:00",
			tzid: undefined,
			utc: true,
		});
	});

	it("parses a zoned date-time and keeps the TZID", () => {
		expect(parseIcsDateValue("20250901T120000", { TZID: "Europe/Berlin" })).toEqual({
			dateOnly: false,
			value: "2025-09-01T12:00:00",
			tzid: "Europe/Berlin",
			utc: false,
		});
	});

	it("ignores a TZID on a value that is already UTC", () => {
		const parsed = parseIcsDateValue("20250901T120000Z", { TZID: "Europe/Berlin" });
		expect(parsed?.tzid).toBeUndefined();
		expect(parsed?.utc).toBe(true);
	});

	it("returns null for malformed and impossible values", () => {
		expect(parseIcsDateValue("")).toBeNull();
		expect(parseIcsDateValue("not-a-date")).toBeNull();
		expect(parseIcsDateValue("20250230")).toBeNull(); // 30 February
		expect(parseIcsDateValue("20250901T250000Z")).toBeNull(); // hour 25
	});

	it("accepts a leap second and a leap day", () => {
		expect(parseIcsDateValue("20240229")).not.toBeNull();
		expect(parseIcsDateValue("20250630T235960Z")).not.toBeNull();
	});
});

describe("formatIcsDateValue", () => {
	it("round-trips a date-only value with its VALUE=DATE parameter", () => {
		const formatted = formatIcsDateValue({
			dateOnly: true,
			value: "2025-09-01",
			utc: false,
		});
		expect(formatted).toEqual({ value: "20250901", params: { VALUE: "DATE" } });
	});

	it("emits a Z suffix for UTC and no parameters", () => {
		expect(
			formatIcsDateValue({ dateOnly: false, value: "2025-09-01T12:00:00", utc: true })
		).toEqual({ value: "20250901T120000Z", params: {} });
	});

	it("emits a TZID parameter for a zoned value", () => {
		expect(
			formatIcsDateValue({
				dateOnly: false,
				value: "2025-09-01T12:00:00",
				tzid: "Europe/Berlin",
				utc: false,
			})
		).toEqual({ value: "20250901T120000", params: { TZID: "Europe/Berlin" } });
	});

	it("survives a parse/format round trip", () => {
		for (const raw of ["20250901", "20250901T120000Z"]) {
			const parsed = parseIcsDateValue(raw);
			expect(parsed).not.toBeNull();
			expect(formatIcsDateValue(parsed!).value).toBe(raw);
		}
	});
});

describe("icsDateValueToTaskDate", () => {
	it("passes a date-only value through unchanged", () => {
		expect(
			icsDateValueToTaskDate({ dateOnly: true, value: "2025-09-01", utc: false })
		).toBe("2025-09-01");
	});

	it("renders a UTC instant as local wall time without seconds", () => {
		expect(
			icsDateValueToTaskDate({
				dateOnly: false,
				value: "2025-09-01T12:00:00",
				utc: true,
			})
		).toBe("2025-09-01T12:00");
	});

	it("uses the injected resolver to shift a zoned time", () => {
		// Berlin is UTC+2 in September, so 12:00 local is 10:00 UTC.
		const resolver = jest.fn().mockReturnValue("2025-09-01T10:00:00Z");
		const result = icsDateValueToTaskDate(
			{ dateOnly: false, value: "2025-09-01T12:00:00", tzid: "Europe/Berlin", utc: false },
			resolver
		);
		expect(resolver).toHaveBeenCalledWith("2025-09-01T12:00:00", "Europe/Berlin");
		expect(result).toBe("2025-09-01T10:00");
	});

	it("treats a zoned time as floating when no resolver is supplied", () => {
		// Better a wall time that reads correctly than one silently shifted by
		// the wrong offset.
		expect(
			icsDateValueToTaskDate({
				dateOnly: false,
				value: "2025-09-01T12:00:00",
				tzid: "Europe/Berlin",
				utc: false,
			})
		).toBe("2025-09-01T12:00");
	});

	it("falls back to floating when the resolver cannot resolve the zone", () => {
		expect(
			icsDateValueToTaskDate(
				{
					dateOnly: false,
					value: "2025-09-01T12:00:00",
					tzid: "Mars/Olympus_Mons",
					utc: false,
				},
				() => null
			)
		).toBe("2025-09-01T12:00");
	});
});

describe("taskDateToIcsDateValue", () => {
	it("keeps a date-only task date date-only", () => {
		expect(taskDateToIcsDateValue("2025-09-01")).toEqual({
			dateOnly: true,
			value: "2025-09-01",
			utc: false,
		});
	});

	it("converts a local wall time to a UTC instant", () => {
		expect(taskDateToIcsDateValue("2025-09-01T12:00")).toEqual({
			dateOnly: false,
			value: "2025-09-01T12:00:00",
			utc: true,
		});
	});

	it("accepts an explicit seconds component", () => {
		expect(taskDateToIcsDateValue("2025-09-01T12:00:30")?.value).toBe(
			"2025-09-01T12:00:30"
		);
	});

	it("returns null for empty and malformed input", () => {
		expect(taskDateToIcsDateValue("")).toBeNull();
		expect(taskDateToIcsDateValue("tomorrow")).toBeNull();
		expect(taskDateToIcsDateValue("2025-02-30")).toBeNull();
	});

	it("round-trips through the ICS form", () => {
		for (const taskDate of ["2025-09-01", "2025-09-01T12:00"]) {
			const ics = taskDateToIcsDateValue(taskDate);
			expect(ics).not.toBeNull();
			expect(icsDateValueToTaskDate(ics!)).toBe(taskDate);
		}
	});
});

describe("stamps", () => {
	it("renders an ISO timestamp as a UTC ICS stamp", () => {
		expect(isoToIcsUtcStamp("2025-09-01T12:00:00.000Z")).toBe("20250901T120000Z");
	});

	it("returns null for an unparseable ISO timestamp", () => {
		expect(isoToIcsUtcStamp("whenever")).toBeNull();
	});

	it("reads a stamp back as epoch milliseconds", () => {
		expect(icsStampToEpochMs("20250901T120000Z")).toBe(Date.UTC(2025, 8, 1, 12, 0, 0));
	});

	it("returns null rather than NaN for missing or unusable stamps", () => {
		expect(icsStampToEpochMs(undefined)).toBeNull();
		expect(icsStampToEpochMs("garbage")).toBeNull();
		expect(icsStampToEpochMs("20250901")).toBeNull(); // date-only cannot order edits
	});

	it("orders two stamps so the newer one wins the conflict tiebreak", () => {
		const older = icsStampToEpochMs("20250901T120000Z")!;
		const newer = icsStampToEpochMs("20250901T120500Z")!;
		expect(newer).toBeGreaterThan(older);
	});
});
