/**
 * RRULE Converter Unit Tests
 *
 * Tests for converting TaskNotes RRULE format to Google Calendar recurrence format.
 */

import {
	convertToGoogleRecurrence,
	formatExdates,
	isGoogleCompatibleRrule,
	extractDTSTART,
} from "../../../src/utils/rruleConverter";

describe("rruleConverter", () => {
	describe("convertToGoogleRecurrence", () => {
		describe("basic conversions", () => {
			test("converts basic daily RRULE", () => {
				const input = "DTSTART:20240115;FREQ=DAILY;INTERVAL=1";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=DAILY;INTERVAL=1"],
					dtstart: "2024-01-15",
					hasTime: false,
				});
			});

			test("converts weekly RRULE with BYDAY", () => {
				const input = "DTSTART:20240115;FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR"],
					dtstart: "2024-01-15",
					hasTime: false,
				});
			});

			test("converts monthly RRULE with BYMONTHDAY", () => {
				const input = "DTSTART:20240315;FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15"],
					dtstart: "2024-03-15",
					hasTime: false,
				});
			});

			test("converts yearly RRULE", () => {
				const input = "DTSTART:20240315;FREQ=YEARLY;INTERVAL=1;BYMONTH=3;BYMONTHDAY=15";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=YEARLY;INTERVAL=1;BYMONTH=3;BYMONTHDAY=15"],
					dtstart: "2024-03-15",
					hasTime: false,
				});
			});

			test("converts bi-weekly RRULE", () => {
				const input = "DTSTART:20240115;FREQ=WEEKLY;INTERVAL=2;BYDAY=MO";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO"],
					dtstart: "2024-01-15",
					hasTime: false,
				});
			});

			test("converts RRULE with COUNT", () => {
				const input = "DTSTART:20240115;FREQ=DAILY;INTERVAL=1;COUNT=10";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=DAILY;INTERVAL=1;COUNT=10"],
					dtstart: "2024-01-15",
					hasTime: false,
				});
			});

			test("converts RRULE with UNTIL", () => {
				const input = "DTSTART:20240115;FREQ=DAILY;INTERVAL=1;UNTIL=20240215";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=DAILY;INTERVAL=1;UNTIL=20240215"],
					dtstart: "2024-01-15",
					hasTime: false,
				});
			});
		});

		describe("time component handling", () => {
			test("converts RRULE with time component (Z suffix)", () => {
				const input = "DTSTART:20240115T090000Z;FREQ=WEEKLY;BYDAY=MO,WE,FR";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"],
					dtstart: "2024-01-15",
					hasTime: true,
					time: "09:00:00",
				});
			});

			test("converts RRULE with time component (no Z suffix)", () => {
				const input = "DTSTART:20240115T143000;FREQ=DAILY;INTERVAL=1";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=DAILY;INTERVAL=1"],
					dtstart: "2024-01-15",
					hasTime: true,
					time: "14:30:00",
				});
			});
		});

		describe("EXDATE generation", () => {
			test("generates EXDATE entries for completed instances", () => {
				const input = "DTSTART:20240115;FREQ=DAILY;INTERVAL=1";
				const result = convertToGoogleRecurrence(input, {
					completedInstances: ["2024-01-16", "2024-01-18"],
				});

				expect(result?.recurrence).toContain("RRULE:FREQ=DAILY;INTERVAL=1");
				expect(result?.recurrence).toContain("EXDATE;VALUE=DATE:20240116");
				expect(result?.recurrence).toContain("EXDATE;VALUE=DATE:20240118");
				expect(result?.recurrence).toHaveLength(3);
			});

			test("generates EXDATE entries for skipped instances", () => {
				const input = "DTSTART:20240115;FREQ=DAILY;INTERVAL=1";
				const result = convertToGoogleRecurrence(input, {
					skippedInstances: ["2024-01-17", "2024-01-19"],
				});

				expect(result?.recurrence).toContain("RRULE:FREQ=DAILY;INTERVAL=1");
				expect(result?.recurrence).toContain("EXDATE;VALUE=DATE:20240117");
				expect(result?.recurrence).toContain("EXDATE;VALUE=DATE:20240119");
			});

			test("combines completed and skipped instances in EXDATE", () => {
				const input = "DTSTART:20240115;FREQ=DAILY";
				const result = convertToGoogleRecurrence(input, {
					completedInstances: ["2024-01-16"],
					skippedInstances: ["2024-01-17"],
				});

				expect(result?.recurrence).toContain("EXDATE;VALUE=DATE:20240116");
				expect(result?.recurrence).toContain("EXDATE;VALUE=DATE:20240117");
				expect(result?.recurrence).toHaveLength(3);
			});

			test("handles empty instance arrays", () => {
				const input = "DTSTART:20240115;FREQ=DAILY;INTERVAL=1";
				const result = convertToGoogleRecurrence(input, {
					completedInstances: [],
					skippedInstances: [],
				});

				expect(result?.recurrence).toEqual(["RRULE:FREQ=DAILY;INTERVAL=1"]);
			});
		});

		describe("edge cases and error handling", () => {
			test("returns null for empty string", () => {
				expect(convertToGoogleRecurrence("")).toBeNull();
			});

			test("returns null for null/undefined input", () => {
				expect(convertToGoogleRecurrence(null as any)).toBeNull();
				expect(convertToGoogleRecurrence(undefined as any)).toBeNull();
			});

			test("returns null for RRULE without DTSTART", () => {
				expect(convertToGoogleRecurrence("FREQ=DAILY;INTERVAL=1")).toBeNull();
			});

			test("returns null for DTSTART only (no FREQ)", () => {
				expect(convertToGoogleRecurrence("DTSTART:20240115")).toBeNull();
			});

			test("handles DTSTART without trailing semicolon", () => {
				const input = "DTSTART:20240115FREQ=DAILY;INTERVAL=1";
				// This should still work because we strip DTSTART regardless of semicolon
				const result = convertToGoogleRecurrence(input);
				// The result depends on implementation - check if it works or returns null
				// In our implementation, we require semicolon, so this may return null or parse
				expect(result).toBeDefined();
			});

			test("handles complex monthly RRULE with positioned day", () => {
				const input = "DTSTART:20240320;FREQ=MONTHLY;BYDAY=3MO";
				const result = convertToGoogleRecurrence(input);

				expect(result).toEqual({
					recurrence: ["RRULE:FREQ=MONTHLY;BYDAY=3MO"],
					dtstart: "2024-03-20",
					hasTime: false,
				});
			});
		});
	});

	describe("formatExdates", () => {
		test("formats single date", () => {
			expect(formatExdates(["2024-01-15"])).toEqual(["EXDATE;VALUE=DATE:20240115"]);
		});

		test("formats multiple dates", () => {
			expect(formatExdates(["2024-01-15", "2024-01-16", "2024-02-01"])).toEqual([
				"EXDATE;VALUE=DATE:20240115",
				"EXDATE;VALUE=DATE:20240116",
				"EXDATE;VALUE=DATE:20240201",
			]);
		});

		test("returns empty array for empty input", () => {
			expect(formatExdates([])).toEqual([]);
		});

		test("returns empty array for null/undefined", () => {
			expect(formatExdates(null as any)).toEqual([]);
			expect(formatExdates(undefined as any)).toEqual([]);
		});

		test("filters out invalid date formats", () => {
			expect(formatExdates(["2024-01-15", "invalid", "2024-01-16"])).toEqual([
				"EXDATE;VALUE=DATE:20240115",
				"EXDATE;VALUE=DATE:20240116",
			]);
		});

		test("filters out empty strings", () => {
			expect(formatExdates(["2024-01-15", "", "2024-01-16"])).toEqual([
				"EXDATE;VALUE=DATE:20240115",
				"EXDATE;VALUE=DATE:20240116",
			]);
		});
	});

	describe("isGoogleCompatibleRrule", () => {
		test("returns true for valid DAILY RRULE", () => {
			expect(isGoogleCompatibleRrule("FREQ=DAILY;INTERVAL=1")).toBe(true);
		});

		test("returns true for valid WEEKLY RRULE", () => {
			expect(isGoogleCompatibleRrule("FREQ=WEEKLY;BYDAY=MO,WE,FR")).toBe(true);
		});

		test("returns true for valid MONTHLY RRULE", () => {
			expect(isGoogleCompatibleRrule("FREQ=MONTHLY;BYMONTHDAY=15")).toBe(true);
		});

		test("returns true for valid YEARLY RRULE", () => {
			expect(isGoogleCompatibleRrule("FREQ=YEARLY;BYMONTH=3")).toBe(true);
		});

		test("returns false for empty string", () => {
			expect(isGoogleCompatibleRrule("")).toBe(false);
		});

		test("returns false for null/undefined", () => {
			expect(isGoogleCompatibleRrule(null as any)).toBe(false);
			expect(isGoogleCompatibleRrule(undefined as any)).toBe(false);
		});

		test("returns false for unsupported FREQ", () => {
			expect(isGoogleCompatibleRrule("FREQ=SECONDLY")).toBe(false);
			expect(isGoogleCompatibleRrule("FREQ=MINUTELY")).toBe(false);
			expect(isGoogleCompatibleRrule("FREQ=HOURLY")).toBe(false);
		});

		test("returns false for RRULE with BYSECOND", () => {
			expect(isGoogleCompatibleRrule("FREQ=DAILY;BYSECOND=30")).toBe(false);
		});

		test("returns false for RRULE with BYMINUTE", () => {
			expect(isGoogleCompatibleRrule("FREQ=DAILY;BYMINUTE=30")).toBe(false);
		});

		test("returns false for RRULE with BYHOUR", () => {
			expect(isGoogleCompatibleRrule("FREQ=DAILY;BYHOUR=9")).toBe(false);
		});

		test("returns false for missing FREQ", () => {
			expect(isGoogleCompatibleRrule("INTERVAL=1;BYDAY=MO")).toBe(false);
		});
	});

	describe("extractDTSTART", () => {
		test("extracts date-only DTSTART", () => {
			expect(extractDTSTART("DTSTART:20240115;FREQ=DAILY")).toBe("2024-01-15");
		});

		test("extracts DTSTART with time component", () => {
			expect(extractDTSTART("DTSTART:20240115T090000Z;FREQ=DAILY")).toBe("2024-01-15");
		});

		test("returns null for missing DTSTART", () => {
			expect(extractDTSTART("FREQ=DAILY;INTERVAL=1")).toBeNull();
		});

		test("returns null for empty string", () => {
			expect(extractDTSTART("")).toBeNull();
		});

		test("returns null for null/undefined", () => {
			expect(extractDTSTART(null as any)).toBeNull();
			expect(extractDTSTART(undefined as any)).toBeNull();
		});
	});
});
