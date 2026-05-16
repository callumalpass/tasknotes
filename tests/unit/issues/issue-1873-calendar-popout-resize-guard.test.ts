/**
 * Issue #1873: Calendar view freezes when moved to a pop-out window or embedded tab.
 *
 * The current CalendarView implementation had lost the defensive sizing guard
 * from the earlier #699 fix. FullCalendar should only be asked to recalculate
 * size when its element is attached to the same document as the Obsidian view
 * container and has measurable dimensions.
 */

import { isCalendarElementReadyForSizing } from "../../../src/bases/CalendarView";

function setElementSize(element: HTMLElement, width: number, height: number): void {
	Object.defineProperty(element, "clientWidth", {
		configurable: true,
		value: width,
	});
	Object.defineProperty(element, "clientHeight", {
		configurable: true,
		value: height,
	});
}

describe("Issue #1873 - calendar pop-out resize guard", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	test("allows sizing for a connected calendar in the same document with dimensions", () => {
		const container = document.createElement("div");
		const calendarEl = document.createElement("div");
		setElementSize(calendarEl, 900, 600);

		container.appendChild(calendarEl);
		document.body.appendChild(container);

		expect(isCalendarElementReadyForSizing(calendarEl, container)).toBe(true);
	});

	test("skips sizing while the calendar element is detached during window transfer", () => {
		const container = document.createElement("div");
		const calendarEl = document.createElement("div");
		setElementSize(calendarEl, 900, 600);
		document.body.appendChild(container);

		expect(isCalendarElementReadyForSizing(calendarEl, container)).toBe(false);
	});

	test("skips sizing while the view container itself is detached", () => {
		const container = document.createElement("div");
		const calendarEl = document.createElement("div");
		setElementSize(calendarEl, 900, 600);
		container.appendChild(calendarEl);

		expect(isCalendarElementReadyForSizing(calendarEl, container)).toBe(false);
	});

	test("skips sizing when the calendar belongs to a different owner document", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		const otherDocument = document.implementation.createHTMLDocument("popout");
		const calendarEl = otherDocument.createElement("div");
		setElementSize(calendarEl, 900, 600);
		otherDocument.body.appendChild(calendarEl);

		expect(isCalendarElementReadyForSizing(calendarEl, container)).toBe(false);
	});

	test("skips sizing while the calendar has no measurable dimensions", () => {
		const container = document.createElement("div");
		const calendarEl = document.createElement("div");
		container.appendChild(calendarEl);
		document.body.appendChild(container);

		setElementSize(calendarEl, 0, 600);
		expect(isCalendarElementReadyForSizing(calendarEl, container)).toBe(false);

		setElementSize(calendarEl, 900, 0);
		expect(isCalendarElementReadyForSizing(calendarEl, container)).toBe(false);
	});

	test("skips sizing when no calendar element exists", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		expect(isCalendarElementReadyForSizing(null, container)).toBe(false);
	});
});
