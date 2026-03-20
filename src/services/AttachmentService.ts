import { App, TFile, normalizePath } from "obsidian";

/**
 * Thin wrapper over Obsidian's attachment APIs for saving and managing file attachments.
 */
export class AttachmentService {
	constructor(private app: App) {}

	/**
	 * Save a File (from drag-drop or file input) as a vault attachment.
	 * Returns the vault-relative path of the created file.
	 */
	async saveAttachment(file: File, sourceFilePath: string): Promise<string> {
		const arrayBuffer = await file.arrayBuffer();

		// Get the attachment folder path that Obsidian would use for this source file
		const attachmentPath = await (this.app.vault as any).getAvailablePathForAttachments(
			file.name.replace(/\.[^.]+$/, ""), // basename without extension
			file.name.split(".").pop() || "",   // extension
			this.app.vault.getAbstractFileByPath(sourceFilePath) as TFile | undefined,
		);

		const normalized = normalizePath(attachmentPath);
		await this.app.vault.createBinary(normalized, arrayBuffer);
		return normalized;
	}

	/**
	 * Remove a path from the attachments array (does NOT delete the file from vault).
	 */
	removeReference(attachments: string[], path: string): string[] {
		return attachments.filter((p) => p !== path);
	}

	/**
	 * Delete the actual file from the vault. Uses Obsidian's trash behavior setting.
	 * Returns true if the file was found and deleted.
	 */
	async deleteFile(path: string): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file) {
			await this.app.vault.trash(file, false);
			return true;
		}
		return false;
	}

	/**
	 * Map a file extension to a Lucide icon name.
	 */
	getIconName(path: string): string {
		const ext = path.split(".").pop()?.toLowerCase() || "";
		if (["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(ext)) return "image";
		if (["pdf", "doc", "docx", "txt", "rtf", "odt", "md"].includes(ext)) return "file-text";
		if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) return "music";
		if (["mp4", "webm", "mkv", "avi", "mov"].includes(ext)) return "video";
		return "paperclip";
	}

	/**
	 * Return the display name (basename) from a vault path.
	 */
	getDisplayName(path: string): string {
		return path.split("/").pop() || path;
	}
}
