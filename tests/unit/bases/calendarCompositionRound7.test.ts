import { CalendarView } from "../../../src/bases/CalendarView";

function composition(width: number, showMonthDayPanel = true) {
	const rootElement = { clientWidth: width };
	let monthDisplay = "full";
	let dayMaxEventRows = 0;
	const calendar = {
		getOptions: () => ({ monthDisplay, dayMaxEventRows }),
		setOptions: jest.fn((options: { monthDisplay: string; dayMaxEventRows: number }) => {
			monthDisplay = options.monthDisplay;
			dayMaxEventRows = options.dayMaxEventRows;
		}),
		updateSize: jest.fn(),
	};
	const view = Object.assign(Object.create(CalendarView.prototype), {
		rootElement, calendar,
		viewOptions: { showMonthDayPanel, calendarView: "dayGridMonth" },
		explicitlyChosenView: true,
		syncDayPanel: jest.fn(),
	});
	return { rootElement, calendar, view };
}

test("narrow month summaries follow available pane width without rebuilding on every resize", () => {
	const { rootElement, calendar, view } = composition(400);
	view.onResize();
	expect(calendar.setOptions).toHaveBeenLastCalledWith({ monthDisplay: "chips", dayMaxEventRows: 0 });
	view.onResize();
	expect(calendar.setOptions).toHaveBeenCalledTimes(1);
	rootElement.clientWidth = 1180;
	view.onResize();
	expect(calendar.setOptions).toHaveBeenLastCalledWith({ monthDisplay: "full", dayMaxEventRows: 0 });
	view.onResize();
	expect(calendar.setOptions).toHaveBeenCalledTimes(2);
});

test("a narrow month without a selected-day panel retains detailed event bars", () => {
	const { calendar, view } = composition(400, false);
	view.onResize();
	expect(calendar.setOptions).not.toHaveBeenCalled();
	expect(view.getMonthDisplay()).toBe("full");
});

test("a hidden pane does not switch to summary mode at zero width", () => {
	const { calendar, view } = composition(0);
	view.onResize();
	expect(calendar.setOptions).not.toHaveBeenCalled();
});

test("dots remain a last resort below readable chip width", () => {
	const { calendar, view } = composition(240);
	view.onResize();
	expect(calendar.setOptions).toHaveBeenLastCalledWith({ monthDisplay: "dots", dayMaxEventRows: 0 });
});

test.each([640, 700, 850])("stacked month compositions retain identity at %ipx", (width) => {
	const { calendar, view } = composition(width);
	view.onResize();
	expect(calendar.setOptions).toHaveBeenLastCalledWith({ monthDisplay: "chips", dayMaxEventRows: 0 });
});

test("compact all-day limits do not override explicit limits or unlimited event settings", () => {
	const { view } = composition(400);
	view.viewOptions.calendarView = "timeGridDay";
	expect(view.getAllDayRowLimit()).toBe(2);
	view.viewOptions.dayMaxEventRows = 5;
	expect(view.getAllDayRowLimit()).toBe(5);
	view.viewOptions.dayMaxEventRows = false;
	view.viewOptions.dayMaxEvents = false;
	expect(view.getAllDayRowLimit()).toBe(0);
});
