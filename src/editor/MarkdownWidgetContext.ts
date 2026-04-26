import { EditorView } from "@codemirror/view";
import { WorkspaceLeaf, editorInfoField } from "obsidian";

const EMBEDDED_MARKDOWN_CONTEXT_SELECTOR = [
	".blp-inline-edit-root",
	".internal-embed.markdown-embed",
	".markdown-embed",
	".popover.hover-popover",
].join(", ");

function isDetachedLeaf(leaf: unknown): boolean {
	if (!leaf || typeof leaf !== "object") {
		return false;
	}

	const leafRecord = leaf as { parent?: unknown };
	return "parent" in leafRecord && leafRecord.parent == null;
}

function isEmbeddedMarkdownElement(element: HTMLElement | null | undefined): boolean {
	return Boolean(element?.closest(EMBEDDED_MARKDOWN_CONTEXT_SELECTOR));
}

export function shouldSkipMarkdownWidgetEditor(view: EditorView): boolean {
	if (isEmbeddedMarkdownElement(view.dom)) {
		return true;
	}

	try {
		const editorInfo = view.state.field(editorInfoField, false) as
			| {
					leaf?: WorkspaceLeaf;
					containerEl?: HTMLElement;
			  }
			| undefined;

		if (isDetachedLeaf(editorInfo?.leaf)) {
			return true;
		}

		return isEmbeddedMarkdownElement(editorInfo?.containerEl);
	} catch (error) {
		console.debug("[TaskNotes] Error checking markdown widget editor context:", error);
		return false;
	}
}

export function shouldSkipMarkdownWidgetLeaf(leaf: WorkspaceLeaf): boolean {
	if (isDetachedLeaf(leaf)) {
		return true;
	}

	const viewContainer = (leaf.view as { containerEl?: HTMLElement } | undefined)?.containerEl;
	return isEmbeddedMarkdownElement(viewContainer);
}
