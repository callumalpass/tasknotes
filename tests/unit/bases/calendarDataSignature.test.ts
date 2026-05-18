import {
	buildCalendarDataSignature,
	buildCalendarDataSignaturePropertyIds,
	buildCalendarFallbackDataSignature,
	getCalendarSignaturePropertyValue,
	normalizeCalendarSignatureValue,
} from "../../../src/bases/calendarDataSignature";

describe("calendarDataSignature", () => {
	it("selects mapped core fields, visible properties, and property-event fields", () => {
		const propertyIds = buildCalendarDataSignaturePropertyIds({
			mapField: (field) => (field === "scheduled" ? "planned" : undefined),
			visiblePropertyIds: ["formula.Score", "", "tags"],
			showPropertyBasedEvents: true,
			startDateProperty: "file.ctime",
			endDateProperty: "file.mtime",
			titleProperty: "title",
		});

		expect(propertyIds).toContain("planned");
		expect(propertyIds).toContain("complete_instances");
		expect(propertyIds).toContain("recurrence_anchor");
		expect(propertyIds).toContain("skipped_instances");
		expect(propertyIds).toContain("formula.Score");
		expect(propertyIds).toContain("file.ctime");
		expect(propertyIds).toContain("file.mtime");
		expect(propertyIds.filter((propertyId) => propertyId === "tags")).toHaveLength(1);
		expect(propertyIds).not.toContain("");
	});

	it("reads exact and stripped Bases property keys", () => {
		expect(getCalendarSignaturePropertyValue({ "file.ctime": "exact" }, "file.ctime")).toBe(
			"exact"
		);
		expect(getCalendarSignaturePropertyValue({ ctime: "stripped" }, "file.ctime")).toBe(
			"stripped"
		);
		expect(getCalendarSignaturePropertyValue({ "formula.Score": 3 }, "formula.Score")).toBe(3);
		expect(getCalendarSignaturePropertyValue({}, "missing")).toBeNull();
	});

	it("normalizes values into stable JSON-safe signature data", () => {
		const circular: Record<string, unknown> = { z: undefined, a: 1 };
		circular.self = circular;

		expect(
			normalizeCalendarSignatureValue({
				date: new Date("2026-05-19T00:00:00.000Z"),
				big: BigInt(4),
				fn: () => null,
				circular,
			})
		).toEqual({
			big: "4",
			circular: {
				a: 1,
				self: "[Circular]",
				z: null,
			},
			date: "2026-05-19T00:00:00.000Z",
			fn: null,
		});
	});

	it("builds a path-and-property signature from extracted data items", () => {
		const signature = buildCalendarDataSignature(
			[
				{
					path: "TaskNotes/a.md",
					properties: {
						"file.ctime": new Date("2026-05-19T01:00:00.000Z"),
						priority: "high",
					},
				},
				{
					path: "TaskNotes/b.md",
					frontmatter: {
						ctime: "fallback",
						priority: undefined,
					},
				},
			],
			["file.ctime", "priority"]
		);

		expect(JSON.parse(signature)).toEqual({
			propertyIds: ["file.ctime", "priority"],
			rows: [
				{
					path: "TaskNotes/a.md",
					values: [
						["file.ctime", "2026-05-19T01:00:00.000Z"],
						["priority", "high"],
					],
				},
				{
					path: "TaskNotes/b.md",
					values: [
						["file.ctime", "fallback"],
						["priority", null],
					],
				},
			],
		});
	});

	it("builds the legacy path-only fallback signature", () => {
		expect(
			buildCalendarFallbackDataSignature([
				{ file: { path: "TaskNotes/a.md" } },
				{},
				{ file: { path: "TaskNotes/b.md" } },
			])
		).toBe("TaskNotes/a.md\u0000\u0000TaskNotes/b.md");
	});
});
