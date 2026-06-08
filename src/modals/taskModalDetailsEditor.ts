import type { App, TFile } from "obsidian";
import type { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";
import { createTaskModalMarkdownEditor } from "./taskModalEditorAdapter";

type Nullable<T> = T | null;

export interface TaskModalDetailsEditorOptions {
	app: App;
	parent: HTMLElement;
	label: string;
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
	const labelEl = options.parent.createDiv("detail-label");
	labelEl.textContent = options.label;

	const editorContainer = options.parent.createDiv(
		"tn-task-modal__markdown-editor tn-task-modal__markdown-editor--details"
	);

	return createTaskModalMarkdownEditor(options.app, editorContainer, {
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
