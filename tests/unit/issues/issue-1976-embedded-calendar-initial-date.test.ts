import { describe, expect, it, jest } from "@jest/globals";

import { determineCalendarInitialDate } from "../../../src/bases/calendarInitialDate";

describe("Issue #1976: embedded Calendar date navigation", () => {
	it("falls back to the embedding note property when Base rows do not have the selected date", () => {
		const getContextPropertyValue = jest.fn((propertyId: string) => {
			return propertyId === "note.day" ? "2031-04-05" : null;
		});

		const result = determineCalendarInitialDate({
			viewOptions: {
				initialDate: "",
				initialDateProperty: "note.day",
				initialDateStrategy: "first",
			},
			taskNotes: [],
			entries: [{ values: { "note.scheduled": "2031-06-10" } }],
			getEntryPropertyValue: () => null,
			getContextPropertyValue,
			mapPropertyToTaskField: (propertyId) => propertyId.replace(/^note\./, ""),
		});

		expect(result).toBe("2031-04-05");
		expect(getContextPropertyValue).toHaveBeenCalledWith("note.day");
	});

	it("keeps row-based date navigation ahead of the embedding note fallback", () => {
		const result = determineCalendarInitialDate({
			viewOptions: {
				initialDate: "",
				initialDateProperty: "note.day",
				initialDateStrategy: "first",
			},
			taskNotes: [],
			entries: [{ values: { "note.day": "2031-06-10" } }],
			getEntryPropertyValue: (entry, propertyId) =>
				(entry as { values: Record<string, unknown> }).values[propertyId],
			getContextPropertyValue: () => "2031-04-05",
			mapPropertyToTaskField: (propertyId) => propertyId.replace(/^note\./, ""),
		});

		expect(result).toBe("2031-06-10");
	});
});
