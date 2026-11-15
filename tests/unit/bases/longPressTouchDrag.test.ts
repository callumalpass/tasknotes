import { attachLongPressTouchDrag, scrollTouchDragContainer } from "../../../src/bases/longPressTouchDrag";

function touch(element: HTMLElement, type: string, x: number, y: number, count = 1) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperties(event, {
		touches: { value: type === "touchend" ? [] : Array.from({ length: count }, () => ({ clientX: x, clientY: y })) },
		changedTouches: { value: [{ clientX: x, clientY: y }] },
	});
	element.dispatchEvent(event);
	return event;
}

describe("shared Kanban/list long-press gesture", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());
	function fixture() {
		const element = document.createElement("div");
		const options = { onStart: jest.fn(), onMove: jest.fn(), onDrop: jest.fn().mockResolvedValue(undefined), onCancel: jest.fn() };
		const cancel = attachLongPressTouchDrag(element, options);
		return { element, options, cancel };
	}
	it("allows scrolling before activation and cancels the pending long press", () => {
		const f = fixture();
		touch(f.element, "touchstart", 20, 20);
		expect(touch(f.element, "touchmove", 20, 40).defaultPrevented).toBe(false);
		jest.advanceTimersByTime(400);
		expect(f.options.onStart).not.toHaveBeenCalled();
		touch(f.element, "touchend", 20, 40);
		expect(f.options.onDrop).not.toHaveBeenCalled();
	});
	it("activates on hold and drops the final position once", async () => {
		const f = fixture();
		touch(f.element, "touchstart", 20, 20);
		jest.advanceTimersByTime(350);
		expect(f.options.onStart).toHaveBeenCalledWith({ x: 20, y: 20 });
		expect(touch(f.element, "touchmove", 20, 80).defaultPrevented).toBe(true);
		touch(f.element, "touchend", 20, 80);
		await Promise.resolve();
		expect(f.options.onDrop).toHaveBeenCalledWith({ x: 20, y: 80 });
	});
	it.each(["touchcancel", "multitouch", "unload"])("cancels without writing on %s", (kind) => {
		const f = fixture();
		touch(f.element, "touchstart", 20, 20);
		jest.advanceTimersByTime(350);
		if (kind === "unload") f.cancel();
		else touch(f.element, kind === "multitouch" ? "touchmove" : kind, 20, 40, kind === "multitouch" ? 2 : 1);
		touch(f.element, "touchend", 20, 40);
		expect(f.options.onDrop).not.toHaveBeenCalled();
	});
	it("does not cancel a newer gesture when an earlier asynchronous drop finishes", async () => {
		const f = fixture();
		let release!: () => void;
		f.options.onDrop.mockReturnValueOnce(new Promise<void>((resolve) => { release = resolve; }));
		touch(f.element, "touchstart", 20, 20);
		jest.advanceTimersByTime(350);
		touch(f.element, "touchend", 20, 80);
		touch(f.element, "touchstart", 20, 30);
		jest.advanceTimersByTime(350);
		release();
		await Promise.resolve();
		await Promise.resolve();
		expect(f.options.onCancel).not.toHaveBeenCalled();
		expect(touch(f.element, "touchmove", 20, 90).defaultPrevented).toBe(true);
		f.cancel();
	});
	it("auto-scrolls vertically near either edge only", () => {
		const element = document.createElement("div");
		jest.spyOn(element, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 300, left: 0, right: 300 } as DOMRect);
		element.scrollTop = 100;
		scrollTouchDragContainer(element, { x: 150, y: 295 }, "y");
		expect(element.scrollTop).toBe(108);
		scrollTouchDragContainer(element, { x: 150, y: 150 }, "y");
		expect(element.scrollTop).toBe(108);
		scrollTouchDragContainer(element, { x: 150, y: 5 }, "y");
		expect(element.scrollTop).toBe(100);
	});
});
