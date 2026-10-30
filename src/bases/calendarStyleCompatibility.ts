/** Preserve engine hover/drag stacking without important CSS overriding inline layout. */
export function observeCalendarLayering(root: HTMLElement): () => void {
	const win = root.ownerDocument.defaultView;
	if (!win) throw new Error("Calendar requires a document window");
	const previous = new WeakMap<HTMLElement, string>();
	const observer = new win.MutationObserver((records) => {
		for (const { target } of records) {
			if (!(target.instanceOf(win.HTMLElement)) || !target.classList.contains("tnc-item")) continue;
			const level = target.classList.contains("is-dragging") ? "40"
				: target.classList.contains("is-hover") ? "20" : null;
			if (level !== null) {
				if (!previous.has(target)) previous.set(target, target.style.zIndex);
				target.style.zIndex = level;
			} else if (previous.has(target)) {
				const value = previous.get(target);
				if (value) target.style.zIndex = value;
				else target.style.removeProperty("z-index");
				previous.delete(target);
			}
		}
	});
	observer.observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
	return () => observer.disconnect();
}
