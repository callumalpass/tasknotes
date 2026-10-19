type TouchMovementCallbacks = {
	start: (handle: HTMLElement, x: number, y: number) => boolean;
	update: (x: number, y: number) => void;
	commit: (x: number, y: number) => void;
	cancel: () => void;
};

/**
 * Handle-only touch input. A tap (or a hold released in place) opens the existing menu;
 * only a gesture that actually moves commits, using the same operation as a mouse.
 */
export class TaskMovementTouch {
	private pointerId: number | null = null;
	private handle: HTMLElement | null = null;
	private startX = 0;
	private startY = 0;
	private active = false;
	private moved = false;
	private suppressedDraggables: Array<[HTMLElement, string | null]> = [];
	private timer: number | null = null;
	private suppressClickUntil = 0;
	private readonly doc: Document;
	private readonly win: Window;

	constructor(
		private readonly container: HTMLElement,
		private readonly callbacks: TouchMovementCallbacks
	) {
		this.doc = container.ownerDocument;
		this.win = this.doc.defaultView ?? window;
		container.addEventListener("pointerdown", this.onPointerDown, true);
		container.addEventListener("click", this.onClick, true);
		this.win.addEventListener("blur", this.onBlur);
	}

	private onPointerDown = (event: PointerEvent): void => {
		if (event.pointerType !== "touch") return;
		if (this.pointerId !== null && event.pointerId !== this.pointerId) {
			this.cancel();
			return;
		}
		if (!event.isPrimary || this.pointerId !== null) return;
		const target = event.target as HTMLElement | null;
		const handle = target?.closest<HTMLElement>("[data-tn-drag-handle]");
		if (!handle || !this.container.contains(handle)) return;
		event.stopPropagation();
		this.pointerId = event.pointerId;
		this.handle = handle;
		this.startX = event.clientX;
		this.startY = event.clientY;
		this.suppressNativeDrag(handle);
		this.doc.addEventListener("pointermove", this.onPointerMove, {
			capture: true,
			passive: false,
		});
		this.doc.addEventListener("pointerup", this.onPointerUp, true);
		this.doc.addEventListener("pointercancel", this.onPointerCancel, true);
		this.timer = this.win.setTimeout(() => this.activate(this.startX, this.startY), 200);
	};

	private activate(x: number, y: number): void {
		if (this.active || !this.handle || !this.handle.isConnected) return;
		this.clearTimer();
		this.active = this.callbacks.start(this.handle, x, y);
		if (this.active && this.pointerId !== null) {
			this.handle.setPointerCapture?.(this.pointerId);
		}
	}

	/** A native touch drag would cancel this pointer gesture, so disable it for the press. */
	private suppressNativeDrag(handle: HTMLElement): void {
		const card = handle.parentElement?.closest<HTMLElement>("[draggable]");
		for (const element of new Set([handle, card])) {
			if (!element) continue;
			this.suppressedDraggables.push([element, element.getAttribute("draggable")]);
			element.setAttribute("draggable", "false");
		}
	}

	private restoreNativeDrag(): void {
		for (const [element, value] of this.suppressedDraggables) {
			if (value === null) element.removeAttribute("draggable");
			else element.setAttribute("draggable", value);
		}
		this.suppressedDraggables = [];
	}

	private onPointerMove = (event: PointerEvent): void => {
		if (event.pointerId !== this.pointerId) return;
		if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) >= 6) {
			this.moved = true;
			if (!this.active) this.activate(event.clientX, event.clientY);
		}
		if (!this.active) return;
		event.preventDefault();
		event.stopPropagation();
		this.callbacks.update(event.clientX, event.clientY);
	};

	private onPointerUp = (event: PointerEvent): void => {
		if (event.pointerId !== this.pointerId) return;
		const wasActive = this.active;
		const moved = this.moved;
		this.reset();
		if (!wasActive) return;
		if (!moved) {
			// Released in place: nothing was previewed, so never write. Let the click open the menu.
			this.callbacks.cancel();
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.suppressClickUntil = Date.now() + 500;
		this.callbacks.commit(event.clientX, event.clientY);
	};

	private onPointerCancel = (event: PointerEvent): void => {
		if (event.pointerId === this.pointerId) this.cancel();
	};

	private onBlur = (): void => this.cancel();

	private onClick = (event: MouseEvent): void => {
		if (Date.now() >= this.suppressClickUntil) return;
		event.preventDefault();
		event.stopPropagation();
	};

	private clearTimer(): void {
		if (this.timer !== null) this.win.clearTimeout(this.timer);
		this.timer = null;
	}

	private reset(): void {
		this.clearTimer();
		if (this.pointerId !== null && this.handle?.hasPointerCapture?.(this.pointerId)) {
			this.handle.releasePointerCapture(this.pointerId);
		}
		this.doc.removeEventListener("pointermove", this.onPointerMove, true);
		this.doc.removeEventListener("pointerup", this.onPointerUp, true);
		this.doc.removeEventListener("pointercancel", this.onPointerCancel, true);
		this.restoreNativeDrag();
		this.pointerId = null;
		this.handle = null;
		this.active = false;
		this.moved = false;
	}

	cancel(): void {
		const wasActive = this.active;
		this.reset();
		if (wasActive) {
			this.suppressClickUntil = Date.now() + 500;
			this.callbacks.cancel();
		}
	}

	destroy(): void {
		this.cancel();
		this.container.removeEventListener("pointerdown", this.onPointerDown, true);
		this.container.removeEventListener("click", this.onClick, true);
		this.win.removeEventListener("blur", this.onBlur);
	}
}
