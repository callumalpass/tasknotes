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

test.each([240, 400, 700, 850])("a month without a selected-day panel retains readable chips at %ipx", (width) => {
	const { calendar, view } = composition(width, false);
	view.onResize();
	expect(calendar.setOptions).toHaveBeenLastCalledWith({ monthDisplay: "chips", dayMaxEventRows: 0 });
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

test.each([400, 1180])("all-day framing at %ipx preserves explicit limits and unlimited settings", (width) => {
	const { view } = composition(width);
	view.viewOptions.calendarView = "timeGridDay";
	expect(view.getAllDayRowLimit()).toBe(2);
	view.viewOptions.showTimeGrid = false;
	expect(view.getAllDayRowLimit()).toBe(0);
	view.viewOptions.showTimeGrid = true;
	view.viewOptions.dayMaxEventRows = 5;
	expect(view.getAllDayRowLimit()).toBe(5);
	view.viewOptions.dayMaxEventRows = false;
	view.viewOptions.dayMaxEvents = false;
	expect(view.getAllDayRowLimit()).toBe(0);
});
