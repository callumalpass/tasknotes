import {
	buildCalendarPropertyEvent,
	normalizeDateValueForCalendar,
} from "../../../src/bases/calendarPropertyEvents";

describe("calendarPropertyEvents", () => {
	describe("normalizeDateValueForCalendar", () => {
		it("normalizes date-only strings as all-day storage dates", () => {
			expect(normalizeDateValueForCalendar("2026-05-18")).toEqual({
				value: "2026-05-18",
				isAllDay: true,
			});
		});

		it("normalizes timed strings as local datetime values", () => {
			expect(normalizeDateValueForCalendar("2026-05-18T09:30:00")).toEqual({
				value: "2026-05-18T09:30",
				isAllDay: false,
			});
		});

		it("returns null for blank or invalid values", () => {
			expect(normalizeDateValueForCalendar("   ")).toBeNull();
			expect(normalizeDateValueForCalendar(new Date("not-a-date"))).toBeNull();
		});
	});

	describe("buildCalendarPropertyEvent", () => {
		const file = {
			path: "Notes/project.md",
			basename: "Project",
			name: "project.md",
		};

		it("builds a property-based event from configured start, end, and title properties", () => {
			const entry = {
				start: "2026-05-18",
				end: "2026-05-19",
				title: "Planning window",
			};

			const event = buildCalendarPropertyEvent({
				entry,
				file,
				startDateProperty: "start",
				endDateProperty: "end",
				titleProperty: "title",
				getPropertyValue: (entry, propertyId) => entry[propertyId as keyof typeof entry],
			});

			expect(event).toMatchObject({
				id: "property-Notes/project.md",
				title: "Planning window",
				start: "2026-05-18",
				end: "2026-05-19",
				allDay: true,
				editable: true,
				extendedProps: {
					eventType: "property-based",
					filePath: "Notes/project.md",
					file,
					basesEntry: entry,
				},
			});
		});

		it("uses the file title fallback when the title property is missing", () => {
			const event = buildCalendarPropertyEvent({
				entry: { start: "2026-05-18", title: "" },
				file,
				startDateProperty: "start",
				titleProperty: "title",
				getPropertyValue: (entry, propertyId) => entry[propertyId as keyof typeof entry],
			});

			expect(event?.title).toBe("Project");
		});

		it("marks mixed all-day and timed ranges as timed events", () => {
			const event = buildCalendarPropertyEvent({
				entry: {
					start: "2026-05-18",
					end: "2026-05-18T15:00:00",
				},
				file,
				startDateProperty: "start",
				endDateProperty: "end",
				getPropertyValue: (entry, propertyId) => entry[propertyId as keyof typeof entry],
			});

			expect(event).toMatchObject({
				start: "2026-05-18",
				end: "2026-05-18T15:00",
				allDay: false,
			});
		});

		it("returns null when the file or start date is missing", () => {
			expect(
				buildCalendarPropertyEvent({
					entry: { start: "2026-05-18" },
					file: null,
					startDateProperty: "start",
					getPropertyValue: (entry, propertyId) =>
						entry[propertyId as keyof typeof entry],
				})
			).toBeNull();

			expect(
				buildCalendarPropertyEvent({
					entry: { start: "" },
					file,
					startDateProperty: "start",
					getPropertyValue: (entry, propertyId) =>
						entry[propertyId as keyof typeof entry],
				})
			).toBeNull();
		});
	});
});
