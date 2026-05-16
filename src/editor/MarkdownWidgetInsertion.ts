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
