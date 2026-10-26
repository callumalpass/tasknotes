import {
	buildProviderEventDateUpdate,
	getCalendarFrontmatterPropertyName,
	planPropertyEventDrop,
	planPropertyEventResize,
} from "../../../src/bases/calendarMutationPlanning";

function localDate(year: number, monthIndex: number, day: number, hour = 0, minute = 0): Date {
	return new Date(year, monthIndex, day, hour, minute);
}

describe("calendar mutation planning", () => {
	describe("property-based event planning", () => {
		it("normalizes Bases property IDs to frontmatter keys", () => {
			expect(getCalendarFrontmatterPropertyName("note.reviewStart")).toBe("reviewStart");
			expect(getCalendarFrontmatterPropertyName("reviewStart")).toBe("reviewStart");
			expect(getCalendarFrontmatterPropertyName(null)).toBeNull();
		});

		it("shifts property-based event start and end values by the drag delta", () => {
			const plan = planPropertyEventDrop({
				frontmatter: {
					start: "2026-05-18T09:00",
					end: "2026-05-18T10:30",
				},
				startProperty: "start",
				endProperty: "end",
				oldStart: localDate(2026, 4, 18, 9),
				newStart: localDate(2026, 4, 19, 11),
				allDay: false,
			});

			expect(plan).toEqual({
				kind: "update-frontmatter",
				updates: {
					start: "2026-05-19T11:00",
					end: "2026-05-19T12:30",
				},
			});
		});

		it("keeps the start update when the optional end value cannot be shifted", () => {
			const plan = planPropertyEventDrop({
				frontmatter: {
					start: "2026-05-18",
					end: "not a date",
				},
				startProperty: "start",
				endProperty: "end",
				oldStart: localDate(2026, 4, 18),
				newStart: localDate(2026, 4, 20),
				allDay: true,
			});

			expect(plan).toEqual({
				kind: "update-frontmatter",
				updates: {
					start: "2026-05-20",
				},
			});
		});

		it("ignores property-based drops when the required start value is malformed", () => {
			const plan = planPropertyEventDrop({
				frontmatter: {
					start: "not a date",
					end: "2026-05-18",
				},
				startProperty: "start",
				endProperty: "end",
				oldStart: localDate(2026, 4, 18),
				newStart: localDate(2026, 4, 20),
				allDay: true,
			});

			expect(plan).toEqual({ kind: "ignore", reason: "invalid-start-value" });
		});

		it("plans property-based resize writes against the configured end field", () => {
			expect(
				planPropertyEventResize({
					endProperty: "end",
					newEnd: localDate(2026, 4, 18, 16, 45),
					allDay: false,
				})
			).toEqual({
				kind: "update-frontmatter",
				updates: {
					end: "2026-05-18T16:45",
				},
			});

			expect(
				planPropertyEventResize({
					endProperty: null,
					newEnd: localDate(2026, 4, 18),
					allDay: true,
				})
			).toEqual({ kind: "revert", reason: "missing-end-property" });
		});
	});

	describe("provider update planning", () => {
		it("defaults missing drag end dates before updating all-day provider events", () => {
			const plan = buildProviderEventDateUpdate({
				start: localDate(2026, 4, 18),
				end: null,
				allDay: true,
				timezone: "Australia/Melbourne",
			});

			expect(plan).toEqual({
				kind: "update-provider-event",
				updates: {
					start: { date: "2026-05-18" },
					end: { date: "2026-05-19" },
				},
			});
		});

		it("uses timezone-aware datetime payloads for timed provider events", () => {
			const plan = buildProviderEventDateUpdate({
				start: localDate(2026, 4, 18, 9),
				end: localDate(2026, 4, 18, 10, 30),
				allDay: false,
				timezone: "Australia/Melbourne",
			});

			expect(plan.kind).toBe("update-provider-event");
			if (plan.kind !== "update-provider-event") return;
			expect(plan.updates.start).toEqual({
				dateTime: expect.any(String),
				timeZone: "Australia/Melbourne",
			});
			expect(plan.updates.end).toEqual({
				dateTime: expect.any(String),
				timeZone: "Australia/Melbourne",
			});
		});

		it("requires explicit end dates for provider resize updates", () => {
			expect(
				buildProviderEventDateUpdate({
					start: localDate(2026, 4, 18, 9),
					end: null,
					allDay: false,
					timezone: "Australia/Melbourne",
					requireEnd: true,
				})
			).toEqual({ kind: "revert", reason: "missing-end" });
		});
	});
});
