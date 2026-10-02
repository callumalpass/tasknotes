import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Bases/TouchDrag" });

export interface TouchDragPoint {
	x: number;
	y: number;
}

interface LongPressTouchDragOptions {
	onPress?: (target: EventTarget | null) => void;
	onPending?: (timer: number | null) => void;
	onStart: (point: TouchDragPoint) => void;
	onMove: (point: TouchDragPoint) => void;
	onDrop: (point: TouchDragPoint) => Promise<void>;
	onCancel: () => void;
	delay?: number;
	threshold?: number;
}

/** Kanban's long press gesture: movement before activation remains native scrolling. */
export function attachLongPressTouchDrag(
	element: HTMLElement,
	options: LongPressTouchDragOptions
): () => void {
	const win = element.ownerDocument.defaultView ?? window;
	let timer: number | null = null;
	let active = false;
	let generation = 0;
	let start: TouchDragPoint = { x: 0, y: 0 };
	const clearTimer = () => {
		if (timer !== null) win.clearTimeout(timer);
		timer = null;
		options.onPending?.(null);
	};
	const cancel = () => {
		clearTimer();
		active = false;
		options.onCancel();
	};
	element.addEventListener("touchstart", (event: TouchEvent) => {
		if (timer !== null || active) cancel();
		if (event.touches.length !== 1) return;
		generation++;
		options.onPress?.(event.target);
		const touch = event.touches[0];
		start = { x: touch.clientX, y: touch.clientY };
		timer = win.setTimeout(() => {
			clearTimer();
			active = true;
			options.onStart(start);
		}, options.delay ?? 350);
		options.onPending?.(timer);
	}, { passive: true });
	element.addEventListener("touchmove", (event: TouchEvent) => {
		if (event.touches.length !== 1) { cancel(); return; }
		const touch = event.touches[0];
		const point = { x: touch.clientX, y: touch.clientY };
		if (!active) {
			const threshold = options.threshold ?? 10;
			if (Math.abs(point.x - start.x) > threshold || Math.abs(point.y - start.y) > threshold) clearTimer();
			return;
		}
		event.preventDefault();
		options.onMove(point);
	}, { passive: false });
	element.addEventListener("touchend", (event: TouchEvent) => {
		clearTimer();
		if (!active) return;
		active = false;
		event.preventDefault();
		const touch = event.changedTouches[0];
		if (!touch) { cancel(); return; }
		const dropGeneration = generation;
		void options.onDrop({ x: touch.clientX, y: touch.clientY }).catch((error) => {
			tasknotesLogger.error("Failed to complete touch drag", {
				category: "persistence", operation: "touch-drag-drop", error,
			});
		}).finally(() => {
			if (generation === dropGeneration) cancel();
		});
	});
	element.addEventListener("touchcancel", cancel);
	element.addEventListener("contextmenu", (event) => {
		if (timer !== null || active) event.preventDefault();
	});
	return cancel;
}

export function findTouchDragScrollContainer(element: HTMLElement): HTMLElement {
	const win = element.ownerDocument.defaultView ?? window;
	for (let current: HTMLElement | null = element; current; current = current.parentElement) {
		if (current.scrollHeight > current.clientHeight && /auto|scroll/.test(win.getComputedStyle(current).overflowY)) return current;
	}
	return element;
}

/** Scroll one axis near a drag container's visible edges; call once per animation frame. */
export function scrollTouchDragContainer(container: HTMLElement, point: TouchDragPoint, axis: "x" | "y"): void {
	const rect = container.getBoundingClientRect();
	const position = axis === "y" ? point.y : point.x;
	const win = container.ownerDocument.defaultView ?? window;
	const start = Math.max(0, axis === "y" ? rect.top : rect.left);
	const end = Math.min(axis === "y" ? win.innerHeight : win.innerWidth, axis === "y" ? rect.bottom : rect.right);
	const direction = position < start + 50 ? -1 : position > end - 50 ? 1 : 0;
	if (axis === "y") container.scrollTop += direction * 8;
	else container.scrollLeft += direction * 8;
}
