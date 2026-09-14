/**
 * Helpers for placing note-level widgets after Obsidian's title/properties block.
 *
 * Obsidian 1.12 wraps the inline title and metadata container in
 * `.mod-header.mod-ui`, so `.metadata-container.nextSibling` is no longer enough
 * to find the first content node in reading mode.
 */

function findDirectChildAncestor(container: HTMLElement, element: Element): Element | null {
	let current: Element | null = element;

	while (current?.parentElement && current.parentElement !== container) {
		current = current.parentElement;
	}

	return current?.parentElement === container ? current : null;
}

function findDirectHeader(container: HTMLElement): Element | null {
	for (let i = 0; i < container.children.length; i++) {
		const child = container.children.item(i);
		if (child?.classList.contains("mod-header") && child.classList.contains("mod-ui")) {
			return child;
		}
	}

	return null;
}

function findDirectChildWithClass(container: HTMLElement, className: string): Element | null {
	for (let i = 0; i < container.children.length; i++) {
		const child = container.children.item(i);
		if (child?.classList.contains(className)) {
			return child;
		}
	}

	return null;
}

export function getMetadataOrHeaderInsertionReference(container: HTMLElement): ChildNode | null {
	const metadataContainer = container.querySelector(".metadata-container");
	if (metadataContainer) {
		const anchor = findDirectChildAncestor(container, metadataContainer);
		return anchor?.nextSibling ?? null;
	}

	const header = findDirectHeader(container);
	if (header) {
		return header.nextSibling;
	}

	const previewPusher = findDirectChildWithClass(container, "markdown-preview-pusher");
	if (previewPusher) {
		return previewPusher.nextSibling;
	}

	return container.firstChild;
}

/**
 * Places a widget inside the note's header block, after the properties.
 *
 * Reading mode is virtualised: every render pass ends with
 * `sizerEl.setChildrenInPlace([pusherEl, ...shownSections])`, which deletes any
 * direct child of the sizer that Obsidian did not put there. A widget injected
 * between sections is therefore removed on each pass and re-injected on the next
 * frame, and that add/remove cycle drags the scroll position down the note (#2255).
 *
 * `setChildrenInPlace` only manages *direct* children, so nesting the widget one
 * level deeper leaves it untouched by the render pass. Nesting also fixes the height
 * accounting: `measureSection` takes a section's height as the gap between its own
 * `offsetTop` and its next sibling's, so a widget inside the header is counted in
 * that section instead of falling between two sections and being counted in neither.
 *
 * Obsidian still detaches the whole header when it scrolls out of the render window,
 * taking the widget with it. That is fine and must not be fought: callers check
 * `hasMetadataOrHeaderAnchor` first and skip injection while the header is gone,
 * because the fallback placement would land the widget in the middle of the text
 * being read.
 *
 * Returns false when there is no header to nest into.
 */
export function insertInsideHeaderAnchor(container: HTMLElement, widget: HTMLElement): boolean {
	const header = findDirectHeader(container);
	if (!header) {
		return false;
	}

	// Anchor on the properties block rather than the end of the header. Obsidian
	// builds the header in stages, so appending to it during an early pass puts the
	// widget above the properties, which then render underneath and shove it down -
	// a visible jolt on every note open. Waiting for the properties block means the
	// widget is placed once, in its final position.
	const metadata = header.querySelector(".metadata-container");
	if (!metadata) {
		return false;
	}

	metadata.insertAdjacentElement("afterend", widget);
	return true;
}

/**
 * Whether the header the widget is nested into is currently rendered.
 *
 * Obsidian detaches sections that scroll out of the render window, and the note's
 * `.mod-header.mod-ui` is one of them. While it is gone there is nowhere correct to
 * put the widget: `getMetadataOrHeaderInsertionReference` would fall through to the
 * preview pusher, whose next sibling is the first section that is *currently
 * rendered* rather than the first section of the note (#2255).
 */
export function hasMetadataOrHeaderAnchor(container: HTMLElement): boolean {
	const header = findDirectHeader(container);
	return header !== null && header.querySelector(".metadata-container") !== null;
}

export function insertAfterMetadataOrHeader(container: HTMLElement, widget: HTMLElement): void {
	container.insertBefore(widget, getMetadataOrHeaderInsertionReference(container));
}

export function insertAfterElement(anchor: Element, widget: HTMLElement): boolean {
	const parent = anchor.parentNode;
	if (!parent) {
		return false;
	}

	parent.insertBefore(widget, anchor.nextSibling);
	return true;
}
