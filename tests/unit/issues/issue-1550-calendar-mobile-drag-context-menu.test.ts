import { Platform } from "obsidian";
import { suppressCalendarContextMenuOnMobile } from "../../../src/bases/CalendarView";

function setMobile(value: boolean): void {
	(Platform as unknown as { isMobile: boolean }).isMobile = value;
}

describe("Issue #1550: mobile calendar drag context menu suppression", () => {
	afterEach(() => {
		setMobile(false);
	});

	it("suppresses mobile context menus before nested task-card handlers can open", () => {
		setMobile(true);
		const eventEl = document.createElement("div");
		const nestedHandler = jest.fn();

		suppressCalendarContextMenuOnMobile(eventEl);
		eventEl.addEventListener("contextmenu", nestedHandler);

		const event = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
		});
		eventEl.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(nestedHandler).not.toHaveBeenCalled();
		expect(eventEl.classList.contains("tn-calendar-event-touch-target")).toBe(true);
	});

	it("leaves desktop context menus untouched", () => {
		setMobile(false);
		const eventEl = document.createElement("div");
		const nestedHandler = jest.fn();

		suppressCalendarContextMenuOnMobile(eventEl);
		eventEl.addEventListener("contextmenu", nestedHandler);

		const event = new MouseEvent("contextmenu", {
			bubbles: true,
			cancelable: true,
		});
		eventEl.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
		expect(nestedHandler).toHaveBeenCalledTimes(1);
		expect(eventEl.classList.contains("tn-calendar-event-touch-target")).toBe(false);
	});
});
