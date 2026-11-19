import type { App, TFile } from "obsidian";
import { EditorState, type ChangeSpec, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { EmbeddableMarkdownEditor } from "../editor/EmbeddableMarkdownEditor";
import { fieldLabelForId } from "../i18n/fieldLabels";
import { createTaskModalMarkdownEditor } from "./taskModalEditorAdapter";
import { normalizeTaskModalTitleValue } from "./taskModalTitleInput";

type Nullable<T> = T | null;

export interface TaskModalTitleEditorOptions {
	app: App;
	container: HTMLElement;
	value: string;
	placeholder: string;
	file?: Nullable<TFile>;
	onChange: (value: string) => void;
	onSubmit: (shift: boolean) => void;
	onEscape: () => void;
	onEnter: () => void;
	onTab: (shift: boolean) => boolean;
	createFallback: () => void;
}

let labelCount = 0;

/** A title is one line, however the text arrives: pasted, dropped or completed. */
function keepSingleLine(): Extension {
	return EditorState.transactionFilter.of((transaction) => {
		if (!transaction.docChanged || transaction.newDoc.lines === 1) return transaction;

		const changes: ChangeSpec[] = [];
		transaction.changes.iterChanges((from, to, _fromB, _toB, inserted) => {
			changes.push({ from, to, insert: normalizeTaskModalTitleValue(inserted.toString()) });
		});
		const flattened = transaction.startState.changes(changes);
		return {
			changes: flattened,
			selection: { anchor: flattened.mapPos(transaction.startState.selection.main.head, 1) },
			scrollIntoView: true,
		};
	});
}

/** The title is an Obsidian editor, so links, tags and editor commands work as they do in notes. */
export function createTaskModalTitleEditor(
	options: TaskModalTitleEditorOptions
): EmbeddableMarkdownEditor | null {
	const editorContainer = options.container.createDiv(
		"tn-task-modal__markdown-editor tn-task-modal__markdown-editor--title"
	);
	// Referenced rather than set with aria-label, which Obsidian shows as a hover tooltip.
	const labelEl = editorContainer.createDiv({
		cls: "tn-task-modal__editor-label",
		text: fieldLabelForId("title"),
		attr: { id: `tn-task-modal-title-label-${++labelCount}`, hidden: "" },
	});
	return createTaskModalMarkdownEditor(options.app, editorContainer, {
		value: options.value,
		placeholder: options.placeholder,
		cls: "title-editor",
		file: options.file ?? null,
		enterVimInsertMode: true,
		extensions: [
			keepSingleLine(),
			EditorView.contentAttributes.of({
				class: "title-input",
				"aria-labelledby": labelEl.id,
			}),
		],
		onChange: options.onChange,
		onSubmit: options.onSubmit,
		onEscape: options.onEscape,
		onTab: options.onTab,
		onEnter: () => {
			options.onEnter();
			return true;
		},
		createFallback: () => {
			editorContainer.remove();
			options.createFallback();
		},
	});
}
