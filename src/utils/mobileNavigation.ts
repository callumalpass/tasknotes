export function getContentBottomAboveMobileNavigation(doc: Document, bottom: number): number {
	if (!doc.body.classList.contains("is-mobile")) return bottom;
	const win = doc.defaultView ?? window;
	for (const nav of doc.querySelectorAll<HTMLElement>(".mobile-navbar, .mobile-toolbar")) {
		const rect = nav.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0 && rect.top >= win.innerHeight / 2 && rect.top < win.innerHeight &&
			win.getComputedStyle(nav).visibility !== "hidden") bottom = Math.min(bottom, rect.top);
	}
	return bottom;
}
