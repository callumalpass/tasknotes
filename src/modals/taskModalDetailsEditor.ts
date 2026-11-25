import { type App, TFile } from "obsidian";
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
	trackDraftAttachmentRenames?: boolean;
	tabMovesFocus: boolean;
	onChange: (value: string) => void;
	onSubmit: (shift: boolean) => void;
	onEscape: () => void;
	focusNextField: () => boolean;
	focusPreviousField: () => boolean;
	attachMobileKeyboardScrollGuard: (container: HTMLElement) => void;
}

let labelCount = 0;

export function createTaskModalDetailsEditor(
	options: TaskModalDetailsEditorOptions
): EmbeddableMarkdownEditor | null {
	const labelEl = options.parent.createDiv("detail-label");
	labelEl.textContent = options.label;
	labelEl.id = `tn-task-modal-details-label-${++labelCount}`;

	const editorContainer = options.parent.createDiv(
		"tn-task-modal__markdown-editor tn-task-modal__markdown-editor--details"
	);

	options.attachMobileKeyboardScrollGuard(editorContainer);

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
	// Referenced rather than set with aria-label, which Obsidian shows as a hover tooltip.
	editor?.editor.cm.contentDOM.setAttribute("aria-labelledby", labelEl.id);
	if (editor && options.trackDraftAttachmentRenames) {
		watchDraftAttachmentRenames(options.app, editor);
	}
	return editor;
}

function watchDraftAttachmentRenames(app: App, editor: EmbeddableMarkdownEditor): void {
	const embeds = new WeakMap<TFile, string>();
	// Obsidian's embedded paste handler generates links without a source note.
	const getEmbed = (file: TFile) => "!" + app.fileManager.generateMarkdownLink(file, "");

	editor.registerEvent(
		app.vault.on("create", (file) => {
			if (file instanceof TFile && file.extension !== "md") {
				embeds.set(file, getEmbed(file));
			}
		})
	);
	editor.registerEvent(
		app.vault.on("rename", (file) => {
			if (!(file instanceof TFile)) return;
			const previous = embeds.get(file);
			if (!previous) return;

			const replacement = getEmbed(file);
			embeds.set(file, replacement);
			editor.updateAttachmentEmbeds(previous, replacement);
		})
	);
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
