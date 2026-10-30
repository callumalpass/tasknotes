/**
 * Issue #1316: Default calendar view cannot be changed
 *
 * Workspace restore can replay stale calendar view state after the user has
 * changed the Calendar view config/defaults. Calendar date and scroll (#1869)
 * are safe ephemeral state, but the view type is owned by the Bases view config.
 */

import { CalendarView } from "../../../src/bases/CalendarView";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_CALENDAR_VIEW_SETTINGS } from "../../../src/settings/defaults";

function createCalendarView(calendar: Record<string, unknown>): CalendarView {
	const container = document.createElement("div");
	document.body.appendChild(container);

	const plugin = {
		settings: {
			calendarViewSettings: { ...DEFAULT_CALENDAR_VIEW_SETTINGS },
		},
		fieldMapper: {},
	} as unknown as TaskNotesPlugin;

	const view = new CalendarView({}, container, plugin);
	Object.assign(view, { calendarEl: document.createElement("div"), calendar });
	return view;
}

describe("Issue #1316 - Calendar view defaults vs workspace state", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it("saves date and scroll, but not the view type, in ephemeral state", () => {
		const view = createCalendarView({
			getDate: () => new Date("2026-01-15T00:00:00.000Z"),
			getScroll: () => ({ top: 320, left: 0 }),
			getView: () => ({ type: "week" }),
		});

		const state = view.getEphemeralState() as Record<string, unknown>;

		expect(state.calendarDate).toBe("2026-01-15T00:00:00.000Z");
		expect(state.calendarScroll).toEqual({ top: 320, left: 0 });
		expect(state.calendarView).toBeUndefined();
	});

	it("restores date and scroll, ignoring a stale calendarView", () => {
		const calendar = {
			gotoDate: jest.fn(),
			changeView: jest.fn(),
			flush: jest.fn(),
			setScroll: jest.fn(),
		};
		const view = createCalendarView(calendar);

		view.setEphemeralState({
			calendarDate: "2026-01-20T00:00:00.000Z",
			calendarView: "timeGridWeek",
			calendarScroll: { top: 320, left: 0 },
		});

		expect(calendar.gotoDate).toHaveBeenCalledWith(new Date("2026-01-20T00:00:00.000Z"));
		expect(calendar.setScroll).toHaveBeenCalledWith({ top: 320, left: 0 });
		expect(calendar.changeView).not.toHaveBeenCalled();
	});
});
