import { describe, expect, it, jest } from "@jest/globals";

import { CalendarView } from "../../../src/bases/CalendarView";
import type { TaskInfo } from "../../../src/types";

type MockEntry = {
	values: Record<string, unknown>;
};

function createCalendarViewFixture(
	entries: MockEntry[],
	overrides: Partial<{
		initialDateProperty: string | null;
		initialDateStrategy: "first" | "earliest" | "latest";
		data: unknown;
	}> = {}
) {
	const view = Object.create(CalendarView.prototype) as {
		determineInitialDate: (taskNotes: TaskInfo[]) => Date | string | undefined;
		viewOptions: {
			initialDate: string;
			initialDateProperty: string | null;
			initialDateStrategy: "first" | "earliest" | "latest";
		};
		data?: unknown;
		dataAdapter: {
			getPropertyValue: jest.Mock<(entry: MockEntry, propertyId: string) => unknown>;
		};
		propertyMapper: {
			basesToTaskCardProperty: jest.Mock<(propertyId: string) => string>;
		};
	};

	view.viewOptions = {
		initialDate: "",
		initialDateProperty: overrides.initialDateProperty ?? "note.date",
		initialDateStrategy: overrides.initialDateStrategy ?? "first",
	};
	view.data = Object.prototype.hasOwnProperty.call(overrides, "data")
		? overrides.data
		: { data: entries };
	view.dataAdapter = {
		getPropertyValue: jest.fn((entry: MockEntry, propertyId: string) => entry.values[propertyId]),
	};
	view.propertyMapper = {
		basesToTaskCardProperty: jest.fn((propertyId: string) =>
			propertyId.replace(/^(note\.|task\.)/, "")
		),
	};

	return view;
}

describe("Issue #1766: Calendar date navigation from property", () => {
	it("uses raw Bases row values for custom note date properties", () => {
		const view = createCalendarViewFixture([
			{ values: { "note.date": "2031-04-05" } },
		]);

		expect(view.determineInitialDate([])).toBe("2031-04-05");
		expect(view.dataAdapter.getPropertyValue).toHaveBeenCalledWith(
			expect.anything(),
			"note.date"
		);
	});

	it("honors earliest and latest strategies when reading Bases rows", () => {
		const entries = [
			{ values: { "note.date": "2031-04-05" } },
			{ values: { "note.date": "2031-01-10" } },
			{ values: { "note.date": "2031-12-20" } },
		];

		const earliestView = createCalendarViewFixture(entries, {
			initialDateStrategy: "earliest",
		});
		const latestView = createCalendarViewFixture(entries, {
			initialDateStrategy: "latest",
		});

		expect(earliestView.determineInitialDate([])).toBe("2031-01-10");
		expect(latestView.determineInitialDate([])).toBe("2031-12-20");
	});

	it("falls back to TaskInfo customProperties when raw Bases data is unavailable", () => {
		const view = createCalendarViewFixture([], { data: undefined });
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

		expect(view.determineInitialDate([task])).toBe("2031-04-05");
	});
});
