import { msg } from "@lingui/core/macro";
import { App, FuzzySuggestModal, TFile } from "obsidian";
import type TaskNotesPlugin from "../main";

/**
 * Picks an existing vault file to attach to a task. Unlike FileSelectorModal
 * it cannot create files, so choosing an attachment never writes to the vault.
 */
export class AttachmentFileSuggestModal extends FuzzySuggestModal<TFile> {
	private readonly onChoose: (file: TFile) => void;
	private readonly excludePath?: string;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		onChoose: (file: TFile) => void,
		excludePath?: string
	) {
		super(app);
		this.onChoose = onChoose;
		this.excludePath = excludePath;
		this.setPlaceholder(
			plugin.i18n.translate(msg({ message: "Search vault files to attach...", context: "modals.task.attachments.pickerPlaceholder" }))
		);
		this.containerEl.addClass("tasknotes-plugin");
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles().filter((file) => file.path !== this.excludePath);
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onChoose(file);
	}
}
