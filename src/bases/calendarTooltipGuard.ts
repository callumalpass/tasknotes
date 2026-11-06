const activeRoots = new WeakMap<Document, Set<HTMLElement>>();
const selectionRoots = new WeakMap<Document, Set<HTMLElement>>();

export function installCalendarTooltipGuard(root: HTMLElement): () => void {
	const doc = root.ownerDocument;
	const roots = activeRoots.get(doc) ?? new Set<HTMLElement>();
	activeRoots.set(doc, roots);
	const selections = selectionRoots.get(doc) ?? new Set<HTMLElement>();
	selectionRoots.set(doc, selections);
	let active = false;
	const sync = () => {
		if (root.classList.contains("tn-calendar-has-selection")) selections.add(root);
		else selections.delete(root);
		doc.body.classList.toggle("tn-calendar-has-selection", selections.size > 0);
		const next = root.matches(".tnc-dragging") || Boolean(root.querySelector(".tnc-dragging"));
		if (next === active) return;
		active = next;
		root.querySelectorAll(".fc-task-event--hover-source, .fc-task-event--related-hover").forEach(element => {
			element.classList.remove("fc-task-event--hover-source", "fc-task-event--related-hover");
		});
		if (active) roots.add(root);
		else roots.delete(root);
		doc.querySelectorAll(".tooltip").forEach(tooltip => tooltip.remove());
		doc.body.classList.toggle("tn-calendar-gesture", roots.size > 0);
	};
	const observer = new MutationObserver(sync);
	observer.observe(root, { attributes: true, attributeFilter: ["class"], subtree: true });
	sync();
	return () => {
		observer.disconnect();
		roots.delete(root);
		selections.delete(root);
		doc.body.classList.toggle("tn-calendar-has-selection", selections.size > 0);
		doc.body.classList.toggle("tn-calendar-gesture", roots.size > 0);
	};
}
