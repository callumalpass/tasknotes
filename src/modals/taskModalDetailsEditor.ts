import type { App, TFile } from "obsidian";
import type { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";
import { createTaskModalMarkdownEditor } from "./taskModalEditorAdapter";

type Nullable<T> = T | null;

export interface TaskModalDetailsEditorOptions {
	app: App;
	parent: HTMLElement;
	value: string;
	placeholder: string;
	file?: Nullable<TFile>;
	tabMovesFocus: boolean;
	onChange: (value: string) => void;
	onSubmit: (shift: boolean) => void;
	onEscape: () => void;
	focusNextField: () => boolean;
	focusPreviousField: () => boolean;
}

export function createTaskModalDetailsEditor(
	options: TaskModalDetailsEditorOptions
): EmbeddableMarkdownEditor | null {
	const editorContainer = options.parent.createDiv(
		"tn-task-modal__markdown-editor tn-task-modal__markdown-editor--details"
	);

	const editor = createTaskModalMarkdownEditor(options.app, editorContainer, {
		value: options.value,
		placeholder: options.placeholder,
		cls: "details-editor",
		onChange: options.onChange,
		onSubmit: options.onSubmit,
		onEscape: options.onEscape,
		onTab: (shift) => {
			if (!options.tabMovesFocus) {
				return false;
			}

			return shift ? options.focusPreviousField() : options.focusNextField();
		},
		file: options.file ?? null,
	});

	attachDetailsEditorFocusOnClick(editorContainer, editor);

	return editor;
}

function attachDetailsEditorFocusOnClick(
	editorContainer: HTMLElement,
	editor: EmbeddableMarkdownEditor | null
): void {
	editorContainer.addEventListener("mousedown", (event) => {
		if (event.button !== 0) {
			return;
		}

		const fallback = editorContainer.querySelector<HTMLTextAreaElement>(
			".details-editor-fallback"
		);
		if (fallback) {
			if (event.target !== fallback) {
				event.preventDefault();
				fallback.focus();
			}
			return;
		}

		if (!editor) {
			return;
		}

		const content = editorContainer.querySelector(".cm-content");
		if (content?.contains(event.target as Node)) {
			return;
		}

		event.preventDefault();
		editor.editor.cm.focus();
	});
}

export function setTaskModalDetailsEditorValue(
	editor: EmbeddableMarkdownEditor | null,
	value: string
): void {
	editor?.setValue(value);
}

export function destroyTaskModalDetailsEditor(editor: EmbeddableMarkdownEditor | null): void {
	editor?.destroy();
}
