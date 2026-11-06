import { CalendarView } from "../../../src/bases/CalendarView";

function composition(width: number, showMonthDayPanel = true) {
	const rootElement = { clientWidth: width };
	let monthDisplay = "full";
	const calendar = {
		getOptions: () => ({ monthDisplay }),
		setOptions: jest.fn((options: { monthDisplay: string }) => { monthDisplay = options.monthDisplay; }),
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
	expect(calendar.setOptions).toHaveBeenLastCalledWith({ monthDisplay: "dots" });
	view.onResize();
	expect(calendar.setOptions).toHaveBeenCalledTimes(1);
	rootElement.clientWidth = 1180;
	view.onResize();
	expect(calendar.setOptions).toHaveBeenLastCalledWith({ monthDisplay: "full" });
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
