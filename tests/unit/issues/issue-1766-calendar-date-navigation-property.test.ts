import { describe, expect, it, jest } from "@jest/globals";

import { determineCalendarInitialDate } from "../../../src/bases/calendarInitialDate";
import type { TaskInfo } from "../../../src/types";

type MockEntry = {
	values: Record<string, unknown>;
};

function determineInitialDateFixture(
	entries: MockEntry[],
	overrides: Partial<{
		initialDate: string;
		initialDateProperty: string | null;
		initialDateStrategy: "first" | "earliest" | "latest";
		data: unknown;
		taskNotes: TaskInfo[];
	}> = {}
) {
	const getPropertyValue = jest.fn((entry: MockEntry, propertyId: string) => entry.values[propertyId]);
	const mapPropertyToTaskField = jest.fn((propertyId: string) =>
		propertyId.replace(/^(note\.|task\.)/, "")
	);
	const data = Object.prototype.hasOwnProperty.call(overrides, "data")
		? overrides.data
		: entries;
	const determine = () => {
		return determineCalendarInitialDate({
			viewOptions: {
				initialDate: overrides.initialDate ?? "",
				initialDateProperty: overrides.initialDateProperty ?? "note.date",
				initialDateStrategy: overrides.initialDateStrategy ?? "first",
			},
			taskNotes: overrides.taskNotes ?? [],
			entries: Array.isArray(data) ? data : undefined,
			getEntryPropertyValue: (entry, propertyId) =>
				getPropertyValue(entry as MockEntry, propertyId),
			mapPropertyToTaskField,
		});
	};

	return { determine, getPropertyValue, mapPropertyToTaskField };
}

describe("Issue #1766: Calendar date navigation from property", () => {
	it("uses raw Bases row values for custom note date properties", () => {
		const fixture = determineInitialDateFixture([
			{ values: { "note.date": "2031-04-05" } },
		]);

		expect(fixture.determine()).toBe("2031-04-05");
		expect(fixture.getPropertyValue).toHaveBeenCalledWith(expect.anything(), "note.date");
	});

	it("honors earliest and latest strategies when reading Bases rows", () => {
		const entries = [
			{ values: { "note.date": "2031-04-05" } },
			{ values: { "note.date": "2031-01-10" } },
			{ values: { "note.date": "2031-12-20" } },
		];

		const earliestFixture = determineInitialDateFixture(entries, {
			initialDateStrategy: "earliest",
		});
		const latestFixture = determineInitialDateFixture(entries, {
			initialDateStrategy: "latest",
		});

		expect(earliestFixture.determine()).toBe("2031-01-10");
		expect(latestFixture.determine()).toBe("2031-12-20");
	});

	it("falls back to TaskInfo customProperties when raw Bases data is unavailable", () => {
		const task = {
			title: "Custom date task",
			status: "open",
			priority: "normal",
			path: "tasks/custom-date.md",
			archived: false,
			customProperties: {
				date: "2031-04-05",
			},
		};
		const fixture = determineInitialDateFixture([], {
			data: undefined,
			taskNotes: [task],
		});

		expect(fixture.determine()).toBe("2031-04-05");
	});
});
