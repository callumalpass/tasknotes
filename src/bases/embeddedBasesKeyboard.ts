const RELATIONSHIPS_WIDGET_SELECTOR = ".tasknotes-relationships-widget";
const MARKDOWN_SOURCE_VIEW_SELECTOR = ".markdown-source-view";
const EDITOR_FOCUS_SELECTOR = '.cm-content[contenteditable="true"], .cm-editor .cm-content';

/**
 * Reports whether mouse hover may claim task-card focus for a Bases view.
 *
 * Standalone and reading-mode views may claim focus. An auto-injected widget in
 * Live Preview must yield while its containing CodeMirror editor owns the edit
 * cursor; explicit focus events inside the widget are handled separately.
 */
export function canHoverClaimBasesTaskFocus(root: HTMLElement): boolean {
	const widget = root.closest(RELATIONSHIPS_WIDGET_SELECTOR);
	if (!widget) return true;

	const sourceView = widget.closest<HTMLElement>(MARKDOWN_SOURCE_VIEW_SELECTOR);
	if (!sourceView) return true;

	const activeElement = root.ownerDocument.activeElement;
	return !(
		activeElement instanceof Element &&
		sourceView.contains(activeElement) &&
		Boolean(activeElement.closest(EDITOR_FOCUS_SELECTOR)) &&
		!widget.contains(activeElement)
	);
}
