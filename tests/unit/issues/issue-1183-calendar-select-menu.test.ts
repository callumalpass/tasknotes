/**
 * Issue #1183: drag-selecting a time range in Calendar should keep the creation
 * menu open until the user dismisses it.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1183
 */

import { Menu } from "obsidian";
import { CalendarView } from "../../../src/bases/CalendarView";

jest.mock("../../../src/modals/TaskCreationModal", () => ({
	TaskCreationModal: jest.fn().mockImplementation(() => ({
		open: jest.fn(),
	})),
}));

type MockMenu = {
	hide: jest.Mock;
	showAtMouseEvent: jest.Mock;
	showAtPosition: jest.Mock;
};

const menuMock = Menu as unknown as jest.Mock;

function createCalendarView(calendar: { unselect: jest.Mock }): CalendarView {
	const view = Object.create(CalendarView.prototype) as CalendarView;
	Object.assign(view, {
		calendar,
		plugin: {
			app: {},
			calendarProviderRegistry: null,
			settings: {
				calendarViewSettings: {
					enableTimeblocking: false,
				},
			},
		},
		viewOptions: {
			slotDuration: "00:30",
		},
	});
	return view;
}

describe("Issue #1183: calendar selection menu lifecycle", () => {
	afterEach(() => {
		menuMock.mockClear();
	});

	it("positions a touch selection menu at the released finger", async () => {
		const view = createCalendarView({ unselect: jest.fn() });
		const event = new Event("touchend");
		Object.defineProperty(event, "changedTouches", {
			value: [{ clientX: 240, clientY: 360 }],
		});

		await (view as any).handleDateSelect({
			allDay: false,
			end: new Date("2026-06-01T11:00:00"),
			jsEvent: event,
			start: new Date("2026-06-01T09:00:00"),
		});

		const menu = menuMock.mock.results[0].value as MockMenu;
		expect(menu.showAtPosition).toHaveBeenCalledWith({ x: 240, y: 360 });
		expect(menu.showAtMouseEvent).not.toHaveBeenCalled();
	});

	it("does not clear a drag selection until the creation menu closes", async () => {
		const calendar = { unselect: jest.fn() };
		const view = createCalendarView(calendar);
		const event = new MouseEvent("mouseup");

		await (view as any).handleDateSelect({
			allDay: false,
			end: new Date("2026-06-01T11:00:00"),
			jsEvent: event,
			start: new Date("2026-06-01T09:00:00"),
		});

		const menu = menuMock.mock.results[0].value as MockMenu;

		expect(menu.showAtMouseEvent).toHaveBeenCalledWith(event);
		expect(calendar.unselect).not.toHaveBeenCalled();

		menu.hide();

		expect(calendar.unselect).toHaveBeenCalledTimes(1);
	});
});
