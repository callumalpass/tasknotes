import { EditorView } from "@codemirror/view";
import { WorkspaceLeaf, editorInfoField } from "obsidian";
import { createTaskNotesLogger, type TaskNotesLogger } from "../utils/tasknotesLogger";

const EMBEDDED_MARKDOWN_CONTEXT_SELECTOR = [
	".blp-inline-edit-root",
	".internal-embed.markdown-embed",
	".markdown-embed",
	".popover.hover-popover",
].join(", ");

const markdownWidgetContextLogger = createTaskNotesLogger({
	tag: "MarkdownWidgetContext",
});

function isCanvasMarkdownElement(element: HTMLElement | null | undefined): boolean {
	return Boolean(element?.closest(".canvas-node-content"));
}

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

export function shouldSkipMarkdownWidgetEditor(
	view: EditorView,
	logger: TaskNotesLogger = markdownWidgetContextLogger
): boolean {
	if (isCanvasMarkdownElement(view.dom)) {
		return false;
	}

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

		if (isCanvasMarkdownElement(editorInfo?.containerEl)) {
			return false;
		}

		return isEmbeddedMarkdownElement(editorInfo?.containerEl);
	} catch (error) {
		logger.debug("Error checking markdown widget editor context", {
			category: "provider",
			operation: "check-editor-context",
			error,
		});
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
