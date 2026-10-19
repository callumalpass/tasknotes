import { TaskMovementTouch } from "../../../src/bases/taskMovementTouch";

function pointer(target: EventTarget, type: string, options: Record<string, unknown> = {}): Event {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { pointerType: "touch", pointerId: 1, isPrimary: true, clientX: 10, clientY: 20, ...options });
	target.dispatchEvent(event);
	return event;
}

describe("handle-only touch movement", () => {
	let input: TaskMovementTouch;
	let container: HTMLElement;
	let handle: HTMLElement;
	let callbacks: { start: jest.Mock; update: jest.Mock; commit: jest.Mock; cancel: jest.Mock };

	beforeEach(() => {
		jest.useFakeTimers();
		container = document.createElement("div");
		handle = document.createElement("div");
		handle.dataset.tnDragHandle = "true";
		container.appendChild(handle);
		document.body.appendChild(container);
		callbacks = { start: jest.fn(() => true), update: jest.fn(), commit: jest.fn(), cancel: jest.fn() };
		input = new TaskMovementTouch(container, callbacks);
	});

	afterEach(() => {
		input.destroy();
		container.remove();
		jest.useRealTimers();
	});

	it("leaves ordinary card gestures and mouse input alone", () => {
		pointer(container, "pointerdown");
		pointer(handle, "pointerdown", { pointerType: "mouse" });
		jest.advanceTimersByTime(500);
		expect(callbacks.start).not.toHaveBeenCalled();
	});

	it("leaves a tap available to open the movement menu", () => {
		pointer(handle, "pointerdown");
		const up = pointer(document, "pointerup");
		jest.advanceTimersByTime(500);
		expect(up.defaultPrevented).toBe(false);
		expect(callbacks.start).not.toHaveBeenCalled();
		expect(callbacks.commit).not.toHaveBeenCalled();
	});

	it("activates on deliberate movement and commits the release coordinate", () => {
		pointer(handle, "pointerdown");
		const move = pointer(document, "pointermove", { clientX: 30, clientY: 100 });
		expect(move.defaultPrevented).toBe(true);
		expect(callbacks.start).toHaveBeenCalledWith(handle, 30, 100);
		expect(callbacks.update).toHaveBeenCalledWith(30, 100);
		pointer(document, "pointerup", { clientX: 35, clientY: 110 });
		expect(callbacks.commit).toHaveBeenCalledWith(35, 110);
		const click = new MouseEvent("click", { bubbles: true, cancelable: true });
		handle.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(true);
	});

	it("activates on a long press, but never from a detached handle", () => {
		pointer(handle, "pointerdown");
		jest.advanceTimersByTime(200);
		expect(callbacks.start).toHaveBeenCalledTimes(1);
		input.cancel();
		callbacks.start.mockClear();
		pointer(handle, "pointerdown");
		handle.remove();
		jest.advanceTimersByTime(500);
		expect(callbacks.start).not.toHaveBeenCalled();
	});

	it("treats a hold released in place as a tap: no commit, and the menu click survives", () => {
		pointer(handle, "pointerdown");
		jest.advanceTimersByTime(200);
		expect(callbacks.start).toHaveBeenCalledTimes(1);
		pointer(document, "pointermove", { clientX: 12, clientY: 22 });
		const up = pointer(document, "pointerup", { clientX: 12, clientY: 22 });
		expect(callbacks.commit).not.toHaveBeenCalled();
		expect(callbacks.cancel).toHaveBeenCalledTimes(1);
		expect(up.defaultPrevented).toBe(false);
		const click = new MouseEvent("click", { bubbles: true, cancelable: true });
		handle.dispatchEvent(click);
		expect(click.defaultPrevented).toBe(false);
	});

	it("disables native dragging for the press and restores it afterwards", () => {
		const card = document.createElement("div");
		card.setAttribute("draggable", "true");
		handle.setAttribute("draggable", "true");
		container.appendChild(card);
		card.appendChild(handle);
		pointer(handle, "pointerdown");
		expect(handle.getAttribute("draggable")).toBe("false");
		expect(card.getAttribute("draggable")).toBe("false");
		pointer(document, "pointerup");
		expect(handle.getAttribute("draggable")).toBe("true");
		expect(card.getAttribute("draggable")).toBe("true");
	});

	it("cancels interrupted and multi-touch gestures without committing", () => {
		pointer(handle, "pointerdown");
		pointer(document, "pointermove", { clientY: 40 });
		pointer(document, "pointercancel");
		expect(callbacks.cancel).toHaveBeenCalledTimes(1);
		pointer(handle, "pointerdown");
		pointer(document, "pointermove", { clientY: 40 });
		pointer(handle, "pointerdown", { pointerId: 2, isPrimary: false });
		expect(callbacks.cancel).toHaveBeenCalledTimes(2);
		expect(callbacks.commit).not.toHaveBeenCalled();
	});

	it("releases document listeners and pending activation on teardown", () => {
		pointer(handle, "pointerdown");
		input.destroy();
		jest.advanceTimersByTime(500);
		pointer(document, "pointermove", { clientY: 40 });
		expect(callbacks.start).not.toHaveBeenCalled();
		expect(callbacks.update).not.toHaveBeenCalled();
	});
});
