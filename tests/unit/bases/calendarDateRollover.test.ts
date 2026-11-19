import { CalendarView } from "../../../src/bases/CalendarView";

const yesterday = new Date(2026, 10, 4);
const today = new Date(2026, 10, 5, 0, 0, 1);

function harness(date: Date, viewOptions: Record<string, unknown> = {}) {
	const visibleView = { type: "list" };
	const scroll = { top: 240, left: 0 };
	const view = Object.assign(Object.create(CalendarView.prototype), {
		visibleView,
		viewOptions: { initialDate: "", initialDateProperty: null, ...viewOptions },
		refetchEvents: jest.fn(() => Promise.resolve()),
	}) as {
		visibleView: unknown;
		refetchEvents: jest.Mock;
		calendar: unknown;
		handleDateRollover(previousDay: string): void;
	};
	const calendar = {
		getDate: () => date,
		getScroll: () => scroll,
		setScroll: jest.fn(),
		gotoDate: jest.fn(),
	};
	view.calendar = calendar;
	return { view, calendar, scroll };
}

describe("Calendar date rollover", () => {
	beforeEach(() => jest.useFakeTimers().setSystemTime(today));
	afterEach(() => jest.useRealTimers());

	it("moves a calendar on the old day to today, keeping its scroll", () => {
		const { view, calendar, scroll } = harness(yesterday);

		view.handleDateRollover(yesterday.toDateString());

		expect(calendar.gotoDate).toHaveBeenCalledWith(new Date(today));
		expect(calendar.setScroll).toHaveBeenCalledWith(scroll);
		expect(view.refetchEvents).toHaveBeenCalledTimes(1);
	});

	it("refetches once when the move itself changed the range", () => {
		const { view, calendar } = harness(yesterday);
		calendar.gotoDate.mockImplementation(() => {
			view.visibleView = { type: "list" };
		});

		view.handleDateRollover(yesterday.toDateString());

		expect(view.refetchEvents).not.toHaveBeenCalled();
	});

	it.each([
		["paged elsewhere", new Date(2026, 10, 12), {}],
		["pinned to a date", yesterday, { initialDate: "2026-11-04" }],
		["pinned to a property", yesterday, { initialDateProperty: "note.date" }],
	])("leaves a calendar %s where it is, but refreshes its items", (_name, date, options) => {
		const { view, calendar } = harness(date, options);

		view.handleDateRollover(yesterday.toDateString());

		expect(calendar.gotoDate).not.toHaveBeenCalled();
		expect(view.refetchEvents).toHaveBeenCalledTimes(1);
	});
});
