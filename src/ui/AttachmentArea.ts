import { Menu, setIcon } from "obsidian";
import { AttachmentService } from "../services/AttachmentService";

export interface AttachmentAreaOptions {
	attachments: string[];
	onAdd: (files: File[]) => Promise<void>;
	onRemove: (path: string) => void;
	onDelete: (path: string) => void;
	onOpen: (path: string) => void;
	readonly?: boolean;
	attachmentService: AttachmentService;
	dropzoneText?: string;
	contextMenuRemoveLabel?: string;
	contextMenuDeleteLabel?: string;
	contextMenuOpenLabel?: string;
}

/**
 * Reusable "dumb" component for displaying and managing file attachments.
 * Renders a drop zone + file chip list with context menu.
 */
export class AttachmentArea {
	private containerEl: HTMLElement;
	private listEl: HTMLElement;
	private options: AttachmentAreaOptions;
	private fileInput: HTMLInputElement;

	constructor(parentEl: HTMLElement, options: AttachmentAreaOptions) {
		this.options = options;
		this.containerEl = parentEl.createDiv("attachment-area");
		this.buildUI();
	}

	private buildUI(): void {
		if (!this.options.readonly) {
			this.createDropZone();
		}
		this.listEl = this.containerEl.createDiv("attachment-area__list");
		this.renderChips();
	}

	private createDropZone(): void {
		const dropzone = this.containerEl.createDiv("attachment-area__dropzone");

		const iconEl = dropzone.createSpan("attachment-area__dropzone-icon");
		setIcon(iconEl, "paperclip");
		dropzone.createSpan({ text: this.options.dropzoneText || "Drop files or click to attach" });

		// Hidden file input
		this.fileInput = dropzone.createEl("input", {
			type: "file",
			attr: { multiple: "true" },
		});
		this.fileInput.addClass("attachment-area__file-input");

		this.fileInput.addEventListener("change", () => {
			const files = Array.from(this.fileInput.files || []);
			if (files.length > 0) {
				this.options.onAdd(files);
			}
			// Reset so the same file can be re-selected
			this.fileInput.value = "";
		});

		dropzone.addEventListener("click", (e) => {
			if (e.target !== this.fileInput) {
				this.fileInput.click();
			}
		});

		dropzone.addEventListener("dragover", (e) => {
			e.preventDefault();
			dropzone.addClass("attachment-area__dropzone--active");
		});

		dropzone.addEventListener("dragleave", () => {
			dropzone.removeClass("attachment-area__dropzone--active");
		});

		dropzone.addEventListener("drop", (e) => {
			e.preventDefault();
			dropzone.removeClass("attachment-area__dropzone--active");
			const files = Array.from(e.dataTransfer?.files || []);
			if (files.length > 0) {
				this.options.onAdd(files);
			}
		});
	}

	private showContextMenu(e: MouseEvent, path: string): void {
		e.preventDefault();
		e.stopPropagation();

		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle(this.options.contextMenuOpenLabel || "Open file")
				.setIcon("external-link")
				.onClick(() => this.options.onOpen(path));
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle(this.options.contextMenuRemoveLabel || "Remove attachment")
				.setIcon("link-2-off")
				.onClick(() => this.options.onRemove(path));
		});

		menu.addItem((item) => {
			item.setTitle(this.options.contextMenuDeleteLabel || "Remove and delete file")
				.setIcon("trash-2")
				.onClick(() => this.options.onDelete(path));
		});

		menu.showAtMouseEvent(e);
	}

	private renderChips(): void {
		this.listEl.empty();
		const svc = this.options.attachmentService;

		for (const path of this.options.attachments) {
			const chip = this.listEl.createDiv("attachment-area__chip");

			const iconEl = chip.createSpan("attachment-area__chip-icon");
			setIcon(iconEl, svc.getIconName(path));

			const nameEl = chip.createSpan("attachment-area__chip-name");
			nameEl.textContent = svc.getDisplayName(path);
			nameEl.addEventListener("click", () => this.options.onOpen(path));

			// Right-click context menu on the entire chip
			chip.addEventListener("contextmenu", (e) => this.showContextMenu(e, path));

			if (!this.options.readonly) {
				const removeEl = chip.createSpan("attachment-area__chip-remove");
				removeEl.textContent = "\u00d7";
				removeEl.addEventListener("click", (e) => {
					e.stopPropagation();
					this.options.onRemove(path);
				});
			}
		}
	}

	/**
	 * Re-render the chip list after attachments array changes.
	 */
	update(attachments: string[]): void {
		this.options.attachments = attachments;
		this.renderChips();
	}
}
