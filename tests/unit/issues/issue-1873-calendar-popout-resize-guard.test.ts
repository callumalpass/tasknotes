/**
 * Issue #1873: Calendar view freezes when moved to a pop-out window or embedded tab.
 *
 * The current CalendarView implementation had lost the defensive sizing guard
 * from the earlier #699 fix. FullCalendar should only be asked to recalculate
 * size when its element is attached to the same document as the Obsidian view
 * container and has measurable dimensions.
 */

import {
	CalendarView,
	isCalendarElementReadyForSizing,
	isCalendarInPopoutWindow,
} from "../../../src/bases/CalendarView";

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

	test("detects calendar containers mounted in a separate window document", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		expect(isCalendarInPopoutWindow(container)).toBe(false);

		const iframe = document.createElement("iframe");
		document.body.appendChild(iframe);
		const popoutContainer = iframe.contentDocument?.createElement("div");
		if (!popoutContainer) {
			throw new Error("Expected iframe document");
		}
		iframe.contentDocument?.body.appendChild(popoutContainer);

		expect(isCalendarInPopoutWindow(popoutContainer)).toBe(true);
	});

	test("tears down an active calendar when Obsidian moves it to a separate window", () => {
		const iframe = document.createElement("iframe");
		document.body.appendChild(iframe);
		const popoutDocument = iframe.contentDocument;
		if (!popoutDocument) {
			throw new Error("Expected iframe document");
		}

		const container = popoutDocument.createElement("div");
		const rootElement = popoutDocument.createElement("div");
		const calendarEl = popoutDocument.createElement("div");
		rootElement.appendChild(calendarEl);
		container.appendChild(rootElement);
		popoutDocument.body.appendChild(container);

		const calendar = {
			destroy: jest.fn(),
			updateSize: jest.fn(),
		};
		const view = Object.create(CalendarView.prototype) as CalendarView & {
			containerEl: HTMLElement;
			rootElement: HTMLElement;
			calendarEl: HTMLElement;
			calendar: typeof calendar | null;
		};
		view.containerEl = container;
		view.rootElement = rootElement;
		view.calendarEl = calendarEl;
		view.calendar = calendar;

		view.onResize();

		expect(calendar.destroy).toHaveBeenCalledTimes(1);
		expect(calendar.updateSize).not.toHaveBeenCalled();
		expect(view.calendar).toBeNull();
		expect(calendarEl.textContent).toContain(
			"Calendar view is unavailable in a separate window"
		);
	});
});
