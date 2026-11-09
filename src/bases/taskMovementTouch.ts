type TouchMovementCallbacks = {
	start: (handle: HTMLElement, x: number, y: number) => boolean;
	update: (x: number, y: number) => void;
	commit: (x: number, y: number) => void;
	cancel: () => void;
	menu?: (card: HTMLElement, x: number, y: number) => void;
};

/**
 * Handle-only touch input. A tap (or a hold released in place) opens the existing menu;
 * only a gesture that actually moves commits, using the same operation as a mouse.
 */
export class TaskMovementTouch {
	private pointerId: number | null = null;
	private handle: HTMLElement | null = null;
	private menuTarget: HTMLElement | null = null;
	private menuOpened = false;
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
		this.win.addEventListener("pointerdown", this.onNewPress, true);
		for (const type of ["mousedown", "mouseup", "click", "touchend"] as const) this.win.addEventListener(type, this.onClick, { capture: true, passive: false });
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
		const card = target?.closest<HTMLElement>(".task-card[data-task-path]");
		if (!handle && (!this.callbacks.menu || !card || target?.closest("button, a, input, select, textarea, [role=button]"))) return;
		if (!this.container.contains(handle ?? card ?? null)) return;
		event.stopPropagation();
		this.pointerId = event.pointerId;
		this.handle = handle ?? null;
		this.menuTarget = handle ? null : card ?? null;
		this.startX = event.clientX;
		this.startY = event.clientY;
		if (handle) this.suppressNativeDrag(handle);
		this.doc.querySelectorAll(".tooltip").forEach((tooltip) => tooltip.remove());
		this.doc.addEventListener("pointermove", this.onPointerMove, {
			capture: true,
			passive: false,
		});
		this.doc.addEventListener("pointerup", this.onPointerUp, true);
		this.doc.addEventListener("pointercancel", this.onPointerCancel, true);
		this.timer = this.win.setTimeout(() => {
			if (this.menuTarget) {
				this.menuOpened = true;
				this.suppressClickUntil = Infinity;
				this.callbacks.menu?.(this.menuTarget, this.startX, this.startY);
			} else this.activate(this.startX, this.startY);
		}, handle ? 200 : 450);
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
			if (this.menuTarget) {
				this.reset();
				return;
			}
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
		const menuOpened = this.menuOpened;
		this.reset();
		if (menuOpened) {
			event.preventDefault();
			event.stopPropagation();
			this.suppressClickUntil = Date.now() + 500;
			return;
		}
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

	private onNewPress = (): void => {
		if (this.pointerId === null) this.suppressClickUntil = 0;
	};

	private onClick = (event: Event): void => {
		if (Date.now() >= this.suppressClickUntil) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		if (event.type === "click") this.suppressClickUntil = 0;
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
		this.menuTarget = null;
		this.menuOpened = false;
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
		this.win.removeEventListener("pointerdown", this.onNewPress, true);
		for (const type of ["mousedown", "mouseup", "click", "touchend"] as const) this.win.removeEventListener(type, this.onClick, true);
		this.win.removeEventListener("blur", this.onBlur);
	}
}
