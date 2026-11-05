const activeRoots = new WeakMap<Document, Set<HTMLElement>>();

export function installCalendarTooltipGuard(root: HTMLElement): () => void {
	const doc = root.ownerDocument;
	const roots = activeRoots.get(doc) ?? new Set<HTMLElement>();
	activeRoots.set(doc, roots);
	let active = false;
	const sync = () => {
		const next = root.matches(".tnc-dragging") || Boolean(root.querySelector(".tnc-dragging"));
		if (next === active) return;
		active = next;
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
		doc.body.classList.toggle("tn-calendar-gesture", roots.size > 0);
	};
}
