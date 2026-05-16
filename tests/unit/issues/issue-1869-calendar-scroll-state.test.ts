/**
 * Issue #1869: Calendar Month View resets scroll position after task updates.
 *
 * FullCalendar can keep its own scroll containers inside the calendar element.
 * Capturing only the Bases root scroll position is not enough, so CalendarView
 * preserves each FullCalendar scroller around task-update re-renders.
 */

import {
	captureCalendarScrollState,
	restoreCalendarScrollState,
} from "../../../src/bases/CalendarView";

function buildCalendarDom(): {
	calendarEl: HTMLElement;
	firstScroller: HTMLElement;
	secondScroller: HTMLElement;
} {
	const calendarEl = document.createElement("div");
	const firstScroller = document.createElement("div");
	firstScroller.classList.add("fc-scroller");
	const nested = document.createElement("section");
	const secondScroller = document.createElement("div");
	secondScroller.classList.add("fc-scroller");

	nested.appendChild(secondScroller);
	calendarEl.append(firstScroller, nested);
	document.body.appendChild(calendarEl);

	return { calendarEl, firstScroller, secondScroller };
}

describe("Issue #1869 - Calendar scroll state preservation", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	test("captures calendar root and FullCalendar scroller positions in DOM order", () => {
		const { calendarEl, firstScroller, secondScroller } = buildCalendarDom();
		calendarEl.scrollTop = 15;
		calendarEl.scrollLeft = 3;
		firstScroller.scrollTop = 120;
		firstScroller.scrollLeft = 7;
		secondScroller.scrollTop = 240;
		secondScroller.scrollLeft = 11;

		expect(captureCalendarScrollState(calendarEl)).toEqual([
			{ scrollTop: 15, scrollLeft: 3 },
			{ scrollTop: 120, scrollLeft: 7 },
			{ scrollTop: 240, scrollLeft: 11 },
		]);
	});

	test("restores calendar root and FullCalendar scroller positions", () => {
		const { calendarEl, firstScroller, secondScroller } = buildCalendarDom();

		restoreCalendarScrollState(calendarEl, [
			{ scrollTop: 15, scrollLeft: 3 },
			{ scrollTop: 120, scrollLeft: 7 },
			{ scrollTop: 240, scrollLeft: 11 },
		]);

		expect(calendarEl.scrollTop).toBe(15);
		expect(calendarEl.scrollLeft).toBe(3);
		expect(firstScroller.scrollTop).toBe(120);
		expect(firstScroller.scrollLeft).toBe(7);
		expect(secondScroller.scrollTop).toBe(240);
		expect(secondScroller.scrollLeft).toBe(11);
	});

	test("ignores malformed scroll entries without shifting following indexes", () => {
		const { calendarEl, firstScroller, secondScroller } = buildCalendarDom();

		restoreCalendarScrollState(calendarEl, [
			{ scrollTop: 15, scrollLeft: 3 },
			"invalid",
			{ scrollTop: 240, scrollLeft: 11 },
		]);

		expect(calendarEl.scrollTop).toBe(15);
		expect(calendarEl.scrollLeft).toBe(3);
		expect(firstScroller.scrollTop).toBe(0);
		expect(firstScroller.scrollLeft).toBe(0);
		expect(secondScroller.scrollTop).toBe(240);
		expect(secondScroller.scrollLeft).toBe(11);
	});

	test("returns an empty capture for a missing calendar element", () => {
		expect(captureCalendarScrollState(null)).toEqual([]);
		expect(() => restoreCalendarScrollState(null, [])).not.toThrow();
	});
});
