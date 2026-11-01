import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { attachmentPathFromReference, canonicalAttachmentReference } from "@tasknotes/model";
import { Setting, setIcon, setTooltip } from "obsidian";

/**
 * One row in the task modal attachment list.
 *
 * Linked entries already exist in the vault and are stored as a reference.
 * Pending entries were picked from disk and are only copied into the vault
 * when the task is saved, so cancelling the modal never leaves orphan files.
 */
export type TaskModalAttachmentEntry =
	| { kind: "linked"; reference: string; path: string | undefined }
	| { kind: "pending"; file: File };

export interface TaskModalAttachmentVaultFile {
	path: string;
	name: string;
}

export interface MaterializeTaskModalAttachmentsOptions {
	/** Path of the task note; Obsidian uses it to resolve the attachment folder. */
	sourcePath: string;
	getAvailablePath: (filename: string, sourcePath: string) => Promise<string>;
	writeBinary: (path: string, data: ArrayBuffer) => Promise<{ path: string }>;
	/** Moves a file this save created to the trash when the save is rolled back. */
	trashFile: (path: string) => Promise<void>;
}

export interface MaterializedTaskModalAttachments {
	references: string[];
	/** Trash the files this call wrote and put their rows back to pending. */
	rollback: () => Promise<void>;
}

export function createLinkedAttachmentEntries(
	references: readonly string[] | undefined,
	sourcePath: string
): TaskModalAttachmentEntry[] {
	return (references ?? []).map((reference) => ({
		kind: "linked",
		reference,
		path: attachmentPathFromReference(reference, sourcePath),
	}));
}

/**
 * Whether a vault path can be stored as an attachment link and read back.
 * Names with brackets, `#` or `|`, or without an extension, would be rejected
 * or misread as a heading/alias by the attachments field.
 */
export function isAttachablePath(path: string): boolean {
	try {
		return attachmentPathFromReference(canonicalAttachmentReference(path)) === path;
	} catch {
		return false;
	}
}

export function createVaultAttachmentEntry(path: string): TaskModalAttachmentEntry {
	return { kind: "linked", reference: canonicalAttachmentReference(path), path };
}

export function getLinkedAttachmentReferences(entries: readonly TaskModalAttachmentEntry[]): string[] {
	return entries.flatMap((entry) => (entry.kind === "linked" ? [entry.reference] : []));
}

export function hasPendingAttachments(entries: readonly TaskModalAttachmentEntry[]): boolean {
	return entries.some((entry) => entry.kind === "pending");
}

export function haveAttachmentsChanged(
	entries: readonly TaskModalAttachmentEntry[],
	initialReferences: readonly string[] | undefined
): boolean {
	if (hasPendingAttachments(entries)) {
		return true;
	}
	const current = getLinkedAttachmentReferences(entries);
	const initial = initialReferences ?? [];
	return (
		current.length !== initial.length ||
		current.some((reference, index) => reference !== initial[index])
	);
}

export function getAttachmentEntryName(entry: TaskModalAttachmentEntry): string {
	if (entry.kind === "pending") {
		return entry.file.name;
	}
	const target = entry.path ?? entry.reference;
	return target.split("/").pop() || target;
}

function isSamePendingFile(a: File, b: File): boolean {
	return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

export function isAttachmentAlreadyListed(
	entries: readonly TaskModalAttachmentEntry[],
	candidate: TaskModalAttachmentEntry
): boolean {
	return entries.some((entry) => {
		if (entry.kind === "linked" && candidate.kind === "linked") {
			return (
				(entry.path !== undefined && entry.path === candidate.path) ||
				entry.reference === candidate.reference
			);
		}
		if (entry.kind === "pending" && candidate.kind === "pending") {
			return isSamePendingFile(entry.file, candidate.file);
		}
		return false;
	});
}

/**
 * Copy pending disk files into the vault and convert them to linked entries.
 *
 * Entries are replaced in place as each file is written. If any import fails,
 * the files already written are trashed and their rows go back to pending, so
 * a failed save leaves no unlinked files and a retry imports each file once.
 * Callers use the returned rollback the same way when the task write fails.
 */
export async function materializeTaskModalAttachments(
	entries: TaskModalAttachmentEntry[],
	options: MaterializeTaskModalAttachmentsOptions
): Promise<MaterializedTaskModalAttachments> {
	const created: { index: number; pending: TaskModalAttachmentEntry; path: string }[] = [];
	const rollback = async () => {
		for (const item of created.splice(0).reverse()) {
			entries[item.index] = item.pending;
			try {
				await options.trashFile(item.path);
			} catch {
				// Best effort: the file stays in the vault, but the row is pending again.
			}
		}
	};

	try {
		for (let index = 0; index < entries.length; index++) {
			const entry = entries[index];
			if (entry.kind !== "pending") {
				continue;
			}
			const targetPath = await options.getAvailablePath(entry.file.name, options.sourcePath);
			if (!isAttachablePath(targetPath)) {
				throw new Error(`Unsupported attachment path: ${targetPath}`);
			}
			const written = await options.writeBinary(targetPath, await entry.file.arrayBuffer());
			created.push({ index, pending: entry, path: written.path });
			if (!isAttachablePath(written.path)) {
				throw new Error(`Unsupported attachment path: ${written.path}`);
			}
			entries[index] = createVaultAttachmentEntry(written.path);
		}
	} catch (error) {
		await rollback();
		throw error;
	}
	return { references: getLinkedAttachmentReferences(entries), rollback };
}

export interface TaskModalAttachmentsFieldOptions {
	container: HTMLElement;
	label: string;
	translate: (key: MessageDescriptor, params?: Record<string, string | number>) => string;
	getEntries: () => TaskModalAttachmentEntry[];
	setEntries: (entries: TaskModalAttachmentEntry[]) => void;
	/** Opens a vault file picker and passes the chosen file to the callback. */
	pickVaultFile: (onChoose: (file: TaskModalAttachmentVaultFile) => void) => void;
	openAttachment: (path: string) => void;
	resolveExists: (path: string) => boolean;
	onDuplicate: (name: string) => void;
	/** Called for a file whose name can't be stored as an attachment link. */
	onUnsupportedName: (name: string) => void;
}

type FocusTarget = { index: number; control: "open" | "up" | "down" | "remove" } | "add";

/**
 * Attachment list for the task create/edit modals. Removing an entry only
 * unlinks it from the task; vault files are never deleted from here.
 */
export class TaskModalAttachmentsField {
	private readonly options: TaskModalAttachmentsFieldOptions;
	private readonly fieldEl: HTMLElement;
	private readonly listEl: HTMLElement;
	private readonly fileInput: HTMLInputElement;
	private addButtonEl: HTMLButtonElement | null = null;

	constructor(options: TaskModalAttachmentsFieldOptions) {
		this.options = options;
		const t = options.translate;
		this.fieldEl = options.container.createDiv({ cls: "task-attachments-field" });

		this.fileInput = this.fieldEl.createEl("input", {
			cls: "task-attachments-file-input",
			attr: { type: "file", multiple: "", tabindex: "-1", "aria-hidden": "true" },
		});
		this.fileInput.addEventListener("change", () => {
			this.addPendingFiles(Array.from(this.fileInput.files ?? []));
			this.fileInput.value = "";
		});

		new Setting(this.fieldEl)
			.setName(options.label)
			.addButton((button) => {
				button
					.setButtonText(t(msg({ message: "Add from vault", context: "modals.task.attachments.addFromVaultButton" })))
					.setTooltip(t(msg({ message: "Attach an existing vault file", context: "modals.task.attachments.addFromVaultTooltip" })))
					.onClick(() => {
						options.pickVaultFile((file) => this.addVaultFile(file));
					});
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost", "task-attachments-add"]);
				this.addButtonEl = button.buttonEl;
			})
			.addButton((button) => {
				button
					.setButtonText(t(msg({ message: "Import file", context: "modals.task.attachments.importButton" })))
					.setTooltip(t(msg({ message: "Choose a file from this device. It is copied into the vault when the task is saved.", context: "modals.task.attachments.importTooltip" })))
					.onClick(() => {
						this.fileInput.click();
					});
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost", "task-attachments-import"]);
			});

		this.listEl = this.fieldEl.createEl("ul", { cls: "task-attachments-list" });

		this.fieldEl.addEventListener("dragover", (event) => {
			if (!event.dataTransfer?.types.includes("Files")) return;
			event.preventDefault();
			this.fieldEl.addClass("task-attachments-field--drag-over");
		});
		this.fieldEl.addEventListener("dragleave", () => {
			this.fieldEl.removeClass("task-attachments-field--drag-over");
		});
		this.fieldEl.addEventListener("drop", (event) => {
			this.fieldEl.removeClass("task-attachments-field--drag-over");
			const files = Array.from(event.dataTransfer?.files ?? []);
			if (files.length === 0) return;
			event.preventDefault();
			this.addPendingFiles(files);
		});

		this.render();
	}

	addVaultFile(file: TaskModalAttachmentVaultFile): void {
		if (!isAttachablePath(file.path)) {
			this.options.onUnsupportedName(file.name);
			return;
		}
		this.addEntries([createVaultAttachmentEntry(file.path)]);
	}

	addPendingFiles(files: File[]): void {
		this.addEntries(files.map((file) => ({ kind: "pending", file })));
	}

	private addEntries(candidates: TaskModalAttachmentEntry[]): void {
		if (candidates.length === 0) return;
		const entries = [...this.options.getEntries()];
		for (const candidate of candidates) {
			const candidatePath =
				candidate.kind === "pending" ? candidate.file.name : (candidate.path ?? "");
			if (!isAttachablePath(candidatePath)) {
				this.options.onUnsupportedName(getAttachmentEntryName(candidate));
				continue;
			}
			if (isAttachmentAlreadyListed(entries, candidate)) {
				this.options.onDuplicate(getAttachmentEntryName(candidate));
				continue;
			}
			entries.push(candidate);
		}
		this.options.setEntries(entries);
		this.render();
	}

	private remove(index: number): void {
		const entries = [...this.options.getEntries()];
		entries.splice(index, 1);
		this.options.setEntries(entries);
		const nextIndex = Math.min(index, entries.length - 1);
		this.render(nextIndex >= 0 ? { index: nextIndex, control: "remove" } : "add");
	}

	private move(index: number, delta: -1 | 1): void {
		const entries = [...this.options.getEntries()];
		const target = index + delta;
		if (target < 0 || target >= entries.length) return;
		[entries[index], entries[target]] = [entries[target], entries[index]];
		this.options.setEntries(entries);
		const atEdge = delta < 0 ? target === 0 : target === entries.length - 1;
		const control = atEdge ? (delta < 0 ? "down" : "up") : delta < 0 ? "up" : "down";
		this.render({ index: target, control });
	}

	render(focus?: FocusTarget): void {
		const t = this.options.translate;
		const entries = this.options.getEntries();
		this.listEl.empty();
		this.listEl.toggleClass("is-empty", entries.length === 0);

		entries.forEach((entry, index) => {
			const name = getAttachmentEntryName(entry);
			const itemEl = this.listEl.createEl("li", { cls: "task-attachment-item" });
			itemEl.dataset.index = String(index);

			const iconEl = itemEl.createSpan({ cls: "task-attachment-icon", attr: { "aria-hidden": "true" } });
			setIcon(iconEl, entry.kind === "pending" ? "upload" : "paperclip");

			const infoEl = itemEl.createDiv({ cls: "task-attachment-info" });
			const missing =
				entry.kind === "linked" && (!entry.path || !this.options.resolveExists(entry.path));

			if (entry.kind === "linked" && entry.path && !missing) {
				const path = entry.path;
				const openButton = infoEl.createEl("button", {
					cls: "task-attachment-name task-attachment-open",
					text: name,
					attr: {
						type: "button",
						"aria-label": t(msg({ message: "Open {name}", context: "modals.task.attachments.openAriaLabel" }), { name }),
					},
				});
				openButton.addEventListener("click", () => this.options.openAttachment(path));
			} else {
				infoEl.createSpan({ cls: "task-attachment-name", text: name });
			}

			if (entry.kind === "pending") {
				itemEl.addClass("task-attachment-item--pending");
				infoEl.createDiv({
					cls: "task-attachment-hint",
					text: t(msg({ message: "Copied into the vault when the task is saved", context: "modals.task.attachments.pendingHint" })),
				});
			} else if (missing) {
				itemEl.addClass("task-attachment-item--unresolved");
				infoEl.createDiv({
					cls: "task-attachment-hint",
					text: t(msg({ message: "File not found", context: "modals.task.attachments.missingHint" })),
				});
			} else if (entry.path && entry.path !== name) {
				infoEl.createDiv({ cls: "task-attachment-path", text: entry.path });
			}

			const actionsEl = itemEl.createDiv({ cls: "task-attachment-actions" });
			const controls: Record<"up" | "down" | "remove", HTMLButtonElement> = {
				up: this.createIconButton(
					actionsEl,
					"arrow-up",
					t(msg({ message: "Move {name} up", context: "modals.task.attachments.moveUpAriaLabel" }), { name }),
					index === 0,
					() => this.move(index, -1)
				),
				down: this.createIconButton(
					actionsEl,
					"arrow-down",
					t(msg({ message: "Move {name} down", context: "modals.task.attachments.moveDownAriaLabel" }), { name }),
					index === entries.length - 1,
					() => this.move(index, 1)
				),
				remove: this.createIconButton(
					actionsEl,
					"x",
					t(msg({ message: "Remove {name} from this task", context: "modals.task.attachments.removeAriaLabel" }), { name }),
					false,
					() => this.remove(index)
				),
			};
			controls.remove.addClass("task-attachment-remove");

			if (focus && focus !== "add" && focus.index === index) {
				const target =
					focus.control === "open"
						? itemEl.querySelector<HTMLElement>(".task-attachment-open")
						: controls[focus.control];
				target?.focus();
			}
		});

		if (focus === "add") {
			this.addButtonEl?.focus();
		}
	}

	private createIconButton(
		container: HTMLElement,
		icon: string,
		label: string,
		disabled: boolean,
		onClick: () => void
	): HTMLButtonElement {
		const button = container.createEl("button", {
			cls: "clickable-icon task-attachment-action",
			attr: { type: "button", "aria-label": label },
		});
		button.disabled = disabled;
		setIcon(button, icon);
		setTooltip(button, label, { placement: "top" });
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClick();
		});
		return button;
	}
}
