import { TaskMovementAutoScroll } from "../../../src/bases/taskMovementAutoScroll";

describe("task movement edge scrolling", () => {
	let frames: Map<number, FrameRequestCallback>;
	let nextFrame: number;
	let container: HTMLElement;
	let onScroll: jest.Mock;

	beforeEach(() => {
		frames = new Map();
		nextFrame = 0;
		jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			frames.set(++nextFrame, callback);
			return nextFrame;
		});
		jest.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
			frames.delete(id);
		});
		container = document.createElement("div");
		Object.defineProperties(container, {
			clientHeight: { value: 200 },
			scrollHeight: { value: 600 },
		});
		container.getBoundingClientRect = () =>
			({ left: 10, right: 310, top: 20, bottom: 220, height: 200 }) as DOMRect;
		onScroll = jest.fn();
	});

	afterEach(() => jest.restoreAllMocks());

	const tick = (time = 16) => {
		const [id, callback] = frames.entries().next().value!;
		frames.delete(id);
		callback(time);
	};

	it("scrolls downward at the bottom edge and updates hit testing", () => {
		const scroll = new TaskMovementAutoScroll(container, onScroll);
		scroll.update(100, 210);
		tick();
		expect(container.scrollTop).toBeGreaterThan(0);
		expect(onScroll).toHaveBeenCalledWith(100, 210);
		expect(frames.size).toBe(1);
		scroll.stop();
		expect(frames.size).toBe(0);
	});

	it("scrolls upward at the top edge", () => {
		container.scrollTop = 100;
		const scroll = new TaskMovementAutoScroll(container, onScroll);
		scroll.update(100, 30);
		tick();
		expect(container.scrollTop).toBeLessThan(100);
		scroll.stop();
	});

	it.each([
		[100, 120],
		[400, 210],
		[100, 240],
	])("does not scroll outside an edge or outside the view (%i, %i)", (x, y) => {
		const scroll = new TaskMovementAutoScroll(container, onScroll);
		scroll.update(x, y);
		tick();
		expect(container.scrollTop).toBe(0);
		expect(onScroll).not.toHaveBeenCalled();
		expect(frames.size).toBe(0);
	});

	it("uses a scrollable view ancestor when the items container is not scrollable", () => {
		const items = document.createElement("div");
		container.appendChild(items);
		const scroll = new TaskMovementAutoScroll(items, onScroll);
		scroll.update(100, 210);
		tick();
		expect(container.scrollTop).toBeGreaterThan(0);
		scroll.stop();
	});
});
