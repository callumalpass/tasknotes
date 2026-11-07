const activeRoots = new WeakMap<Document, Set<HTMLElement>>();
const selectionRoots = new WeakMap<Document, Set<HTMLElement>>();

export function installCalendarTooltipGuard(root: HTMLElement): () => void {
	const doc = root.ownerDocument;
	const roots = activeRoots.get(doc) ?? new Set<HTMLElement>();
	activeRoots.set(doc, roots);
	const selections = selectionRoots.get(doc) ?? new Set<HTMLElement>();
	selectionRoots.set(doc, selections);
	let active = false;
	let awaitingMovement = false;
	let pointer = { x: 0, y: 0 };
	const release = () => {
		if (active || !awaitingMovement) return;
		awaitingMovement = false;
		roots.delete(root);
		doc.body.classList.toggle("tn-calendar-gesture", roots.size > 0);
	};
	const move = (event: PointerEvent) => {
		if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4) release();
		if (active) pointer = { x: event.clientX, y: event.clientY };
	};
	doc.addEventListener("pointermove", move, true);
	doc.addEventListener("pointerdown", release, true);
	doc.addEventListener("keydown", release, true);
	const sync = () => {
		if (root.classList.contains("tn-calendar-has-selection")) selections.add(root);
		else selections.delete(root);
		doc.body.classList.toggle("tn-calendar-has-selection", selections.size > 0);
		const next = root.matches(".tnc-dragging") || Boolean(root.querySelector(".tnc-dragging"));
		if (next === active) return;
		active = next;
		awaitingMovement = !next;
		root.querySelectorAll(".fc-task-event--hover-source, .fc-task-event--related-hover").forEach(element => {
			element.classList.remove("fc-task-event--hover-source", "fc-task-event--related-hover");
		});
		roots.add(root);
		doc.querySelectorAll(".tooltip").forEach(tooltip => tooltip.remove());
		doc.body.classList.toggle("tn-calendar-gesture", roots.size > 0);
	};
	const observer = new MutationObserver(sync);
	observer.observe(root, { attributes: true, attributeFilter: ["class"], subtree: true });
	sync();
	return () => {
		observer.disconnect();
		doc.removeEventListener("pointermove", move, true);
		doc.removeEventListener("pointerdown", release, true);
		doc.removeEventListener("keydown", release, true);
		roots.delete(root);
		selections.delete(root);
		doc.body.classList.toggle("tn-calendar-has-selection", selections.size > 0);
		doc.body.classList.toggle("tn-calendar-gesture", roots.size > 0);
	};
}
