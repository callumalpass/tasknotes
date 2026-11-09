export function installCalendarSwipe(root: HTMLElement, navigate: (direction: number) => void): () => void {
	let gesture: { x: number; y: number; started: number; delta: number; horizontal: boolean } | null = null;
	const inGrid = (target: EventTarget | null) => (target as Element | null)?.closest?.(".tnc-dg, .tnc-tg, .tnc-year");
	const start = (event: TouchEvent) => {
		if (!inGrid(event.target)) return;
		event.stopPropagation();
		gesture = null;
		const touch = event.touches[0];
		if (event.touches.length !== 1 || !touch || (event.target as Element).closest(".tnc-item, .tnc-more, .tnc-popover")) return;
		gesture = { x: touch.clientX, y: touch.clientY, started: performance.now(), delta: 0, horizontal: false };
	};
	const move = (event: TouchEvent) => {
		if (!gesture) return;
		const touch = event.touches[0];
		if (event.touches.length !== 1 || !touch || root.querySelector(".tnc-dragging") || performance.now() - gesture.started > 500) { gesture = null; return; }
		const delta = touch.clientX - gesture.x;
		const vertical = Math.abs(touch.clientY - gesture.y);
		if (!gesture.horizontal && vertical > 12 && vertical > Math.abs(delta)) { gesture = null; return; }
		if (Math.abs(delta) > 12 && Math.abs(delta) > vertical * 1.5) gesture.horizontal = true;
		if (!gesture.horizontal) return;
		gesture.delta = delta;
		event.preventDefault();
		event.stopPropagation();
	};
	const end = (event: TouchEvent) => {
		const finished = gesture;
		gesture = null;
		if (!finished?.horizontal || Math.abs(finished.delta) < 48 || root.querySelector(".tnc-dragging")) return;
		event.preventDefault();
		event.stopPropagation();
		navigate(finished.delta < 0 ? 1 : -1);
	};
	const cancel = () => { gesture = null; };
	root.addEventListener("touchstart", start, { passive: true });
	root.addEventListener("touchmove", move, { passive: false });
	root.addEventListener("touchend", end, { passive: false });
	root.addEventListener("touchcancel", cancel);
	return () => {
		root.removeEventListener("touchstart", start);
		root.removeEventListener("touchmove", move);
		root.removeEventListener("touchend", end);
		root.removeEventListener("touchcancel", cancel);
	};
}
