import { CalendarView } from "../../../src/bases/CalendarView";

it("restores the custom-day control after a narrow Week selection uses the same day count", () => {
	const calendarEl = document.createElement("div");
	calendarEl.innerHTML = '<select class="tnc-toolbar-view-select"><option value="week">Week</option><option value="days">3 days</option></select><button class="tnc-btn-view tnc-btn-view-week" aria-pressed="true"></button><button class="tnc-btn-view tnc-btn-view-days" aria-pressed="false"></button>';
	const view = Object.assign(Object.create(CalendarView.prototype), {
		calendarEl,
		calendar: { view: { type: "days" } },
		narrowWeek: true,
	});
	view.syncCalendarToolbar();
	expect(calendarEl.querySelector("select")?.value).toBe("week");
	view.narrowWeek = false;
	view.syncCalendarToolbar();
	expect(calendarEl.querySelector("select")?.value).toBe("days");
	expect(calendarEl.querySelector(".tnc-btn-view-week")?.getAttribute("aria-pressed")).toBe("false");
	expect(calendarEl.querySelector(".tnc-btn-view-days")?.getAttribute("aria-pressed")).toBe("true");
});

it("does not rebuild the current date when restoring state after a task refresh", () => {
	const calendar = {
		getDate: () => new Date("2026-11-05T00:00:00Z"),
		gotoDate: jest.fn(),
		flush: jest.fn(),
		setScroll: jest.fn(),
	};
	const view = Object.assign(Object.create(CalendarView.prototype), { calendar });
	view.setEphemeralState({ calendarDate: "2026-11-05T00:00:00.000Z", calendarScroll: { top: 50, left: 0 } });
	expect(calendar.gotoDate).not.toHaveBeenCalled();
	expect(calendar.setScroll).toHaveBeenCalledWith({ top: 50, left: 0 });
	view.setEphemeralState({ calendarDate: "2026-11-06T00:00:00.000Z" });
	expect(calendar.gotoDate).toHaveBeenCalledWith(new Date("2026-11-06T00:00:00Z"));
});

it("keeps the chosen view while config.set synchronously notifies its readers", () => {
	jest.useFakeTimers();
	try {
		let saved = "listWeek";
		const view = Object.assign(Object.create(CalendarView.prototype), {
			viewOptions: { calendarView: "timeGridCustom" },
			readEventToggles: jest.fn(),
			applyHeightModeClass: jest.fn(),
			applyLayoutClasses: jest.fn(),
			validateTimeValue: (_value: unknown, fallback: unknown) => fallback,
			getConfigOption: (key: string, fallback: unknown) => key === "calendarView" ? saved : fallback,
			config: {
				get: jest.fn(),
				set: (_key: string, value: string) => {
					view.readViewOptions();
					saved = value;
				},
			},
		});
		view.debouncedSaveViewType("timeGridCustom");
		jest.runOnlyPendingTimers();
		expect(saved).toBe("timeGridCustom");
		expect(view.viewOptions.calendarView).toBe("timeGridCustom");
	} finally {
		jest.useRealTimers();
	}
});

it.each([true, false])("keeps the correct toolbar selection after an all-day layout rebuild (narrow Week: %s)", narrowWeek => {
	const calendarEl = document.createElement("div");
	calendarEl.innerHTML = '<select class="tnc-toolbar-view-select"><option value="week">Week</option><option value="days">3 days</option></select><button class="tnc-btn-view tnc-btn-view-week"></button><button class="tnc-btn-view tnc-btn-view-days"></button>';
	let options = { slotEventOverlap: true, dayMaxEventRows: 3, navLinks: false };
	const calendar = {
		view: { type: "days" },
		getOptions: () => options,
		scrollToTime: jest.fn(),
		setOptions: jest.fn(update => {
			options = { ...options, ...update };
			// The engine rebuilds the toolbar without onRangeChange when the range is unchanged.
			calendarEl.querySelector("select")!.value = "days";
			calendarEl.querySelector(".tnc-btn-view-week")!.setAttribute("aria-pressed", "false");
			calendarEl.querySelector(".tnc-btn-view-days")!.setAttribute("aria-pressed", "true");
		}),
	};
	const view = Object.assign(Object.create(CalendarView.prototype), {
		calendarEl, calendar, narrowWeek,
		viewOptions: { calendarView: narrowWeek ? "timeGridWeek" : "timeGridCustom", slotEventOverlap: true },
		syncSelectionModeAfterCalendarRender: jest.fn(),
		applyLayoutClasses: () => view.syncCalendarToolbar(),
		syncDayPanel: jest.fn(),
		getAllDayRowLimit: () => 4,
	});
	view.handleViewChange(calendar.view);
	expect(calendar.setOptions).toHaveBeenCalledWith({ dayMaxEventRows: 4 });
	expect(calendarEl.querySelector("select")!.value).toBe(narrowWeek ? "week" : "days");
	expect(calendarEl.querySelector(".tnc-btn-view-week")!.getAttribute("aria-pressed")).toBe(String(narrowWeek));
	expect(calendarEl.querySelector(".tnc-btn-view-days")!.getAttribute("aria-pressed")).toBe(String(!narrowWeek));
});
