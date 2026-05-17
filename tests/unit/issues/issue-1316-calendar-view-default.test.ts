/**
 * Issue #1316: Default calendar view cannot be changed
 *
 * Workspace restore can replay stale calendar view state after the user has
 * changed the Calendar view config/defaults. Calendar date and scroll are safe
 * ephemeral state, but the view type should be owned by the Bases view config.
 */

import { CalendarView } from "../../../src/bases/CalendarView";
import type TaskNotesPlugin from "../../../src/main";
import { DEFAULT_CALENDAR_VIEW_SETTINGS } from "../../../src/settings/defaults";

function createCalendarView(): CalendarView {
	const container = document.createElement("div");
	document.body.appendChild(container);

	const plugin = {
		settings: {
			calendarViewSettings: { ...DEFAULT_CALENDAR_VIEW_SETTINGS },
		},
		fieldMapper: {},
	} as unknown as TaskNotesPlugin;

	const view = new CalendarView({}, container, plugin);
	(view as unknown as { calendarEl: HTMLElement }).calendarEl = document.createElement("div");
	return view;
}

describe("Issue #1316 - Calendar view defaults vs workspace state", () => {
	afterEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("does not save calendarView in ephemeral state", () => {
		const view = createCalendarView();
		(view as unknown as { calendar: unknown }).calendar = {
			getDate: () => new Date("2026-01-15T00:00:00.000Z"),
			view: { type: "timeGridWeek" },
		};

		const state = view.getEphemeralState() as Record<string, unknown>;

		expect(state.calendarDate).toBe("2026-01-15T00:00:00.000Z");
		expect(state.calendarView).toBeUndefined();
	});

	it("ignores stale calendarView when restoring old workspace state", () => {
		const view = createCalendarView();
		const gotoDate = jest.fn();
		const changeView = jest.fn();
		(view as unknown as { calendar: unknown }).calendar = {
			getDate: () => new Date("2026-01-15T00:00:00.000Z"),
			gotoDate,
			changeView,
			view: { type: "timeGridDay" },
		};

		view.setEphemeralState({
			calendarDate: "2026-01-20T00:00:00.000Z",
			calendarView: "timeGridWeek",
		});

		expect(gotoDate).toHaveBeenCalledWith(new Date("2026-01-20T00:00:00.000Z"));
		expect(changeView).not.toHaveBeenCalled();
	});
});
