import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import { CalendarView } from "../../../src/bases/CalendarView";
import { MiniCalendarView } from "../../../src/bases/MiniCalendarView";
import { EventEmitter } from "../../../src/utils/EventEmitter";

jest.mock("../../../src/bases/calendarKeyboard", () => ({
	installCalendarKeyboard: jest.fn(() => ({ mount: jest.fn(), destroy: jest.fn() })),
}));

describe("ICS filter changes refresh mounted calendars", () => {
	afterEach(() => jest.restoreAllMocks());
	it.each([CalendarView, MiniCalendarView])("refreshes %p and unsubscribes on teardown", View => {
		jest.spyOn(BasesViewBase.prototype, "onload").mockImplementation(() => {});
		const service = new EventEmitter();
		const refresh = jest.fn();
		const cleanups: Array<() => void> = [];
		const root = document.createElement("div");
		document.body.appendChild(root);
		const view = Object.assign(Object.create(View.prototype), {
			plugin: { icsSubscriptionService: service, emitter: { on: jest.fn(), offref: jest.fn() }, app: { metadataCache: { on: jest.fn() } } },
			rootElement: root, readViewOptions: jest.fn(),
			getConfigSnapshot: jest.fn(), getDataSignature: jest.fn(), getControllerViewName: jest.fn(),
			register: (cleanup: () => void) => cleanups.push(cleanup),
			registerEvent: jest.fn(),
			refetchEvents: refresh, render: refresh,
		});
		view.onload();
		service.emit("data-changed");
		expect(refresh).toHaveBeenCalledTimes(1);
		root.remove();
		service.emit("data-changed");
		expect(refresh).toHaveBeenCalledTimes(1);
		cleanups.forEach(cleanup => cleanup());
		document.body.appendChild(root);
		service.emit("data-changed");
		expect(refresh).toHaveBeenCalledTimes(1);
		root.remove();
	});
});
