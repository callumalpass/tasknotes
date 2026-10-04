/** Edge scrolling shared by mouse and handle-only touch movement. */
export class TaskMovementAutoScroll {
	private frame = 0;
	private x = 0;
	private y = 0;
	private lastTime = 0;
	private readonly win: Window;

	constructor(
		private readonly container: HTMLElement,
		private readonly onScroll: (x: number, y: number) => void
	) {
		this.win = container.ownerDocument.defaultView ?? window;
	}

	update(x: number, y: number): void {
		this.x = x;
		this.y = y;
		if (!this.frame) {
			this.lastTime = 0;
			this.frame = this.win.requestAnimationFrame(this.tick);
		}
	}

	private tick = (time: number): void => {
		this.frame = 0;
		let scroller: HTMLElement | null = this.container;
		while (scroller && scroller.scrollHeight <= scroller.clientHeight) {
			if (scroller.classList.contains("workspace-leaf-content")) return;
			scroller = scroller.parentElement;
		}
		if (!scroller) return;
		const rect = scroller.getBoundingClientRect();
		const top = Math.max(0, rect.top);
		const bottom = Math.min(this.win.innerHeight, rect.bottom);
		if (this.x < rect.left || this.x > rect.right || this.y < top || this.y > bottom) return;
		const edge = Math.min(40, (bottom - top) / 4);
		const speed =
			this.y < top + edge
				? -Math.min(1, (top + edge - this.y) / edge)
				: this.y > bottom - edge
					? Math.min(1, (this.y - bottom + edge) / edge)
					: 0;
		if (!speed) return;
		const delta = this.lastTime ? Math.min(32, time - this.lastTime) : 16;
		this.lastTime = time;
		const previousTop = scroller.scrollTop;
		scroller.scrollTop += speed * delta * 0.8;
		if (scroller.scrollTop === previousTop) return;
		this.onScroll(this.x, this.y);
		this.frame = this.win.requestAnimationFrame(this.tick);
	};

	stop(): void {
		if (this.frame) this.win.cancelAnimationFrame(this.frame);
		this.frame = 0;
	}
}
