/**
 * Create an element in a specific document without relying on the active
 * Obsidian window. This matters for views rendered in pop-out windows.
 *
 * The second argument is the standard ElementCreationOptions parameter. It
 * also prevents the Obsidian lint autofix from changing this intentional
 * document-scoped call to `doc.win.createEl()`, which targets the active
 * window when `doc` itself is a Document node.
 */
export function createElementInDocument<K extends keyof HTMLElementTagNameMap>(
	doc: Document,
	tag: K
): HTMLElementTagNameMap[K] {
	return doc.createElement(tag, {});
}
