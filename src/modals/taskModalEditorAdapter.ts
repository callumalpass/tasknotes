import { App } from "obsidian";
import type { Extension } from "@codemirror/state";
import type { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";

type EmbeddableMarkdownEditorConstructor =
	typeof import("../editor/EmbeddableMarkdownEditor").EmbeddableMarkdownEditor;

function loadEmbeddableMarkdownEditor(): EmbeddableMarkdownEditorConstructor {
	// Lazy-load because the editor module resolves Obsidian internals during evaluation.
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- Modal editor is lazy-loaded to avoid evaluating Obsidian internals during import.
	const editorModule = require("../editor/EmbeddableMarkdownEditor") as typeof import("../editor/EmbeddableMarkdownEditor");
	return editorModule.EmbeddableMarkdownEditor;
}

export interface TaskModalEditorOptions {
	value: string;
	placeholder: string;
	cls: string;
	onChange: (value: string) => void;
	onSubmit: (shift: boolean) => void;
	onEscape: () => void;
	onTab: (shift: boolean) => boolean;
	extensions?: Extension[];
}

export function createTaskModalMarkdownEditor(
	app: App,
	container: HTMLElement,
	options: TaskModalEditorOptions
): EmbeddableMarkdownEditor | null {
	try {
		const EmbeddableMarkdownEditor = loadEmbeddableMarkdownEditor();
		return new EmbeddableMarkdownEditor(app, container, {
			...options,
			onSubmit: (_editor, shift) => options.onSubmit(shift),
			onTab: (_editor, shift) => options.onTab(shift),
		});
	} catch (error) {
		console.error("Failed to create markdown editor:", error);

		const fallbackTextarea = container.createEl("textarea", {
			cls: options.cls + "-fallback",
			placeholder: options.placeholder,
		});
		fallbackTextarea.value = options.value;
		fallbackTextarea.addEventListener("input", (e) => {
			options.onChange((e.target as HTMLTextAreaElement).value);
		});
		fallbackTextarea.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				options.onSubmit(e.shiftKey);
			} else if (e.key === "Escape") {
				e.preventDefault();
				options.onEscape();
			} else if (e.key === "Tab") {
				const shouldPreventDefault = options.onTab(e.shiftKey);
				if (shouldPreventDefault) {
					e.preventDefault();
				}
			}
		});

		return null;
	}
}
