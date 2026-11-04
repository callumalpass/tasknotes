export function resolveKanbanStatusColor(element: HTMLElement, color: string): string | null {
	const doc = element.ownerDocument;
	const probe = doc.win.createSpan();
	probe.style.backgroundColor = color;
	if (!probe.style.backgroundColor) return null;
	doc.body.appendChild(probe);
	const resolved = doc.defaultView?.getComputedStyle(probe).backgroundColor;
	probe.remove();
	// Unresolved variables and non-colour variable values compute to the
	// initial transparent background, not a usable tint.
	return !resolved ||
		resolved === "transparent" ||
		resolved === "rgba(0, 0, 0, 0)" ||
		resolved.includes("var(")
		? null
		: resolved;
}
