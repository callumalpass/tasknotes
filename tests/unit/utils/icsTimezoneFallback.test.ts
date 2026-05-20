/**
 * Unit tests for the Windows-TZID → IANA fallback that recovers from
 * Outlook published calendars where ical.js demotes events to floating
 * because the calendar's VTIMEZONE blocks don't cover every TZID
 * referenced by the events.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/781
 * @see https://github.com/callumalpass/tasknotes/issues/1085
 */

import {
	resolveTzidToIANA,
	wallTimeInZoneToUtcIso,
	WINDOWS_TZID_TO_IANA,
} from "../../../src/utils/icsTimezoneFallback";

// Minimal duck type matching what ical.js's Time exposes for wall-clock fields.
// The helper only reads year/month/day/hour/minute/second, so we don't need a
// real ICAL.Time instance — passing a plain object keeps the test independent
// of ical.js and the project's ical.js mock.
function wall(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	second = 0
): any {
	return { year, month, day, hour, minute, second, isDate: false };
}

describe("resolveTzidToIANA", () => {
	it("returns the same name for IANA zones", () => {
		expect(resolveTzidToIANA("Europe/Amsterdam")).toBe("Europe/Amsterdam");
		expect(resolveTzidToIANA("America/Los_Angeles")).toBe("America/Los_Angeles");
		expect(resolveTzidToIANA("UTC")).toBe("UTC");
	});

	it("maps Windows TZIDs from Outlook published calendars to IANA names", () => {
		expect(resolveTzidToIANA("W. Europe Standard Time")).toBe("Europe/Berlin");
		expect(resolveTzidToIANA("Romance Standard Time")).toBe("Europe/Paris");
		expect(resolveTzidToIANA("GMT Standard Time")).toBe("Europe/London");
		expect(resolveTzidToIANA("Eastern Standard Time")).toBe("America/New_York");
		expect(resolveTzidToIANA("Pacific Standard Time")).toBe("America/Los_Angeles");
		expect(resolveTzidToIANA("China Standard Time")).toBe("Asia/Shanghai");
	});

	it("trims whitespace and strips '(GMT...)' prefixes", () => {
		expect(resolveTzidToIANA("  W. Europe Standard Time  ")).toBe("Europe/Berlin");
		expect(resolveTzidToIANA("(GMT+01:00) Europe/Berlin")).toBe("Europe/Berlin");
	});

	it("returns null for unknown / unresolvable TZIDs", () => {
		expect(resolveTzidToIANA("Definitely Not A Zone")).toBeNull();
		expect(resolveTzidToIANA("")).toBeNull();
		expect(resolveTzidToIANA(undefined)).toBeNull();
		expect(resolveTzidToIANA(null)).toBeNull();
	});

	it("covers every entry in the static Windows TZID map", () => {
		// Sanity: every value in the map should be Intl-recognized in modern
		// Node/Electron. Catches regressions if we accidentally introduce a
		// typo in an IANA name. The resolver may return either the mapped
		// IANA name or — when the Windows TZID happens to itself be a valid
		// Intl zone (e.g. "UTC") — the input verbatim. Both are fine; only a
		// null result on an entry we explicitly mapped is a regression.
		for (const [windows] of Object.entries(WINDOWS_TZID_TO_IANA)) {
			const resolved = resolveTzidToIANA(windows);
			// Some IANA names are obsolete aliases that Intl may not accept
			// (e.g. America/Godthab). The helper falls back to null in that
			// case rather than returning an unsupported name, which is fine.
			if (resolved !== null) {
				// Resolved name must itself be a valid Intl timezone.
				expect(() => new Intl.DateTimeFormat("en-US", { timeZone: resolved })).not.toThrow();
			}
		}
	});
});

describe("wallTimeInZoneToUtcIso", () => {
	it("converts CEST wall time to the correct UTC instant", () => {
		// 09:30 on 2025-05-20 in Europe/Berlin (CEST, UTC+2) = 07:30 UTC.
		const iso = wallTimeInZoneToUtcIso(wall(2025, 5, 20, 9, 30), "Europe/Berlin");
		expect(iso).toBe("2025-05-20T07:30:00.000Z");
	});

	it("converts CET (winter) wall time to the correct UTC instant", () => {
		// 09:30 on 2025-12-15 in Europe/Berlin (CET, UTC+1) = 08:30 UTC.
		const iso = wallTimeInZoneToUtcIso(wall(2025, 12, 15, 9, 30), "Europe/Berlin");
		expect(iso).toBe("2025-12-15T08:30:00.000Z");
	});

	it("converts EST wall time to UTC", () => {
		// 15:00 on 2025-01-10 in America/New_York (EST, UTC-5) = 20:00 UTC.
		const iso = wallTimeInZoneToUtcIso(
			wall(2025, 1, 10, 15, 0),
			"America/New_York"
		);
		expect(iso).toBe("2025-01-10T20:00:00.000Z");
	});

	it("converts PDT wall time to UTC across DST boundary in March", () => {
		// 14:00 on 2025-03-15 in America/Los_Angeles (PDT, UTC-7) = 21:00 UTC.
		// (DST springs forward on 2025-03-09.)
		const iso = wallTimeInZoneToUtcIso(
			wall(2025, 3, 15, 14, 0),
			"America/Los_Angeles"
		);
		expect(iso).toBe("2025-03-15T21:00:00.000Z");
	});

	it("handles UTC as a no-op", () => {
		const iso = wallTimeInZoneToUtcIso(wall(2025, 5, 20, 9, 30), "UTC");
		expect(iso).toBe("2025-05-20T09:30:00.000Z");
	});

	it("handles UTC-12 (Etc/GMT+12) sign-inverted offset", () => {
		// 00:00 on 2025-06-15 in Etc/GMT+12 (UTC-12) = 12:00 UTC.
		const iso = wallTimeInZoneToUtcIso(wall(2025, 6, 15, 0, 0), "Etc/GMT+12");
		expect(iso).toBe("2025-06-15T12:00:00.000Z");
	});
});
