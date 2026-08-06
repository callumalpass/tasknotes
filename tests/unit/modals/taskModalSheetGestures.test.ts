import {
	attachTaskModalSheetGestures,
	createTaskModalSheetHandle,
	FULL_SNAP_MAX_HEIGHT,
	PARTIAL_SNAP_MAX_HEIGHT,
} from "../../../src/modals/taskModalSheetGestures";

/**
 * jsdom does not implement the PointerEvent constructor or pointer capture
 * methods, so tests build plain Events and manually attach the fields the
 * gesture code reads (pointerId, clientY, button, timeStamp).
 */
function createPointerEvent(
	type: string,
	init: { pointerId?: number; clientY?: number; button?: number; timeStamp?: number }
): Event {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, {
		pointerId: init.pointerId ?? 1,
		clientY: init.clientY ?? 0,
		button: init.button ?? 0,
	});
	Object.defineProperty(event, "timeStamp", { value: init.timeStamp ?? 0, configurable: true });
	return event;
}

function setupSheet(height = 500) {
	const containerEl = document.createElement("div");
	const modalEl = document.createElement("div");
	containerEl.appendChild(modalEl);
	createTaskModalSheetHandle(containerEl);

	jest.spyOn(modalEl, "getBoundingClientRect").mockReturnValue({
		height,
		width: 0,
		top: 0,
		left: 0,
		right: 0,
		bottom: height,
		x: 0,
		y: 0,
		toJSON: () => ({}),
	} as DOMRect);

	const handle = containerEl.querySelector<HTMLElement>(".tn-task-modal__sheet-handle")!;
	return { containerEl, modalEl, handle };
}

describe("attachTaskModalSheetGestures", () => {
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("returns a no-op controller when the handle element is missing, without leaving the sheet stuck off-screen", () => {
		const containerEl = document.createElement("div");
		const modalEl = document.createElement("div");
		modalEl.classList.add("tn-task-modal__sheet--pending");
		const controller = attachTaskModalSheetGestures({
			containerEl,
			modalEl,
			onDismiss: jest.fn(),
		});
		expect(modalEl.classList.contains("tn-task-modal__sheet--pending")).toBe(false);
		expect(() => controller.destroy()).not.toThrow();
		expect(() => controller.expandToFull()).not.toThrow();
	});

	it("reveals the sheet by removing the pending class and applying the partial max-height together", () => {
		jest.useFakeTimers();
		const containerEl = document.createElement("div");
		const modalEl = document.createElement("div");
		modalEl.classList.add("tn-task-modal__sheet--pending");
		containerEl.appendChild(modalEl);
		createTaskModalSheetHandle(containerEl);
		jest.spyOn(modalEl, "getBoundingClientRect").mockReturnValue({
			height: 500,
			width: 0,
			top: 0,
			left: 0,
			right: 0,
			bottom: 500,
			x: 0,
			y: 0,
			toJSON: () => ({}),
		} as DOMRect);

		attachTaskModalSheetGestures({ containerEl, modalEl, onDismiss: jest.fn() });

		// Before content height has been measured, the sheet must stay hidden
		// off-screen rather than flashing at the fully-expanded default -
		// this is what previously caused the "opens at the top" glitch.
		expect(modalEl.classList.contains("tn-task-modal__sheet--pending")).toBe(true);

		jest.runOnlyPendingTimers();

		expect(modalEl.classList.contains("tn-task-modal__sheet--pending")).toBe(false);
		expect(modalEl.style.getPropertyValue("--tn-sheet-max-height")).toBe(PARTIAL_SNAP_MAX_HEIGHT);
		expect(modalEl.style.getPropertyValue("--tn-sheet-offset")).toBe("0");
	});

	it("tracks the drag using window-level listeners so movement outside the handle's bounds is not lost", () => {
		jest.useFakeTimers();
		const { containerEl, modalEl, handle } = setupSheet();
		const onDismiss = jest.fn();
		attachTaskModalSheetGestures({ containerEl, modalEl, onDismiss });
		jest.runOnlyPendingTimers();

		handle.dispatchEvent(createPointerEvent("pointerdown", { clientY: 100, timeStamp: 0 }));
		// Movement is dispatched on window, not the (small) handle element,
		// mirroring how a finger quickly leaves the handle's hit area during
		// a real drag.
		window.dispatchEvent(createPointerEvent("pointermove", { clientY: 160, timeStamp: 100 }));
		expect(modalEl.style.getPropertyValue("--tn-sheet-offset")).toBe("60px");

		window.dispatchEvent(createPointerEvent("pointerup", { clientY: 160, timeStamp: 120 }));

		// The pointerup dispatched on window was handled and the sheet snapped
		// back to its resting partial height with no dismiss offset.
		expect(modalEl.style.getPropertyValue("--tn-sheet-offset")).toBe("0");
		expect(modalEl.style.getPropertyValue("--tn-sheet-max-height")).toBe(PARTIAL_SNAP_MAX_HEIGHT);
		expect(onDismiss).not.toHaveBeenCalled();
	});

	it("ignores a second pointer starting a drag while one is already active", () => {
		jest.useFakeTimers();
		const { containerEl, modalEl, handle } = setupSheet();
		attachTaskModalSheetGestures({ containerEl, modalEl, onDismiss: jest.fn() });
		jest.runOnlyPendingTimers();

		handle.dispatchEvent(
			createPointerEvent("pointerdown", { pointerId: 1, clientY: 100, timeStamp: 0 })
		);
		window.dispatchEvent(
			createPointerEvent("pointermove", { pointerId: 1, clientY: 150, timeStamp: 16 })
		);
		const offsetDuringFirstDrag = modalEl.style.getPropertyValue("--tn-sheet-offset");

		// A second finger touches the handle mid-drag; it must not reset the
		// gesture's start position and cause the sheet to jump.
		handle.dispatchEvent(
			createPointerEvent("pointerdown", { pointerId: 2, clientY: 10, timeStamp: 20 })
		);
		window.dispatchEvent(
			createPointerEvent("pointermove", { pointerId: 2, clientY: 10, timeStamp: 24 })
		);

		expect(modalEl.style.getPropertyValue("--tn-sheet-offset")).toBe(offsetDuringFirstDrag);
	});

	it("does not treat a stale velocity sample as a fling when the pointer paused before release", () => {
		jest.useFakeTimers();
		const { containerEl, modalEl, handle } = setupSheet(500);
		attachTaskModalSheetGestures({ containerEl, modalEl, onDismiss: jest.fn() });
		jest.runOnlyPendingTimers();

		// Starting from the partial snap position, a brief fast downward flick
		// establishes a high velocity...
		handle.dispatchEvent(createPointerEvent("pointerdown", { clientY: 100, timeStamp: 0 }));
		window.dispatchEvent(createPointerEvent("pointermove", { clientY: 210, timeStamp: 5 }));
		expect(modalEl.style.getPropertyValue("--tn-sheet-offset")).toBe("110px");

		// ...but the pointer then pauses for a long while before being
		// released, so that earlier fling velocity is stale and must be
		// ignored. The final offset (110px) is below the dismiss threshold
		// (120px), so it should snap back to partial - not dismiss, which is
		// what the stale, now-irrelevant velocity would otherwise incorrectly
		// trigger.
		window.dispatchEvent(createPointerEvent("pointerup", { clientY: 210, timeStamp: 505 }));

		jest.runOnlyPendingTimers();
		expect(modalEl.style.getPropertyValue("--tn-sheet-offset")).toBe("0");
		expect(modalEl.style.getPropertyValue("--tn-sheet-max-height")).toBe(PARTIAL_SNAP_MAX_HEIGHT);
	});

	it("cleans up window listeners on destroy", () => {
		jest.useFakeTimers();
		const { containerEl, modalEl, handle } = setupSheet();
		const controller = attachTaskModalSheetGestures({ containerEl, modalEl, onDismiss: jest.fn() });
		jest.runOnlyPendingTimers();

		handle.dispatchEvent(createPointerEvent("pointerdown", { clientY: 100, timeStamp: 0 }));
		controller.destroy();

		const offsetBefore = modalEl.style.getPropertyValue("--tn-sheet-offset");
		window.dispatchEvent(createPointerEvent("pointermove", { clientY: 400, timeStamp: 16 }));
		expect(modalEl.style.getPropertyValue("--tn-sheet-offset")).toBe(offsetBefore);
	});

	it("expandToFull snaps to the full max-height with no dismiss offset", () => {
		jest.useFakeTimers();
		const { containerEl, modalEl } = setupSheet();
		const controller = attachTaskModalSheetGestures({ containerEl, modalEl, onDismiss: jest.fn() });
		jest.runOnlyPendingTimers();

		controller.expandToFull();
		expect(modalEl.style.getPropertyValue("--tn-sheet-max-height")).toBe(FULL_SNAP_MAX_HEIGHT);
		expect(modalEl.style.getPropertyValue("--tn-sheet-offset")).toBe("0");
	});
});
