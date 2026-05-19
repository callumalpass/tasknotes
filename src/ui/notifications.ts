import { Notice } from "obsidian";

export type TaskNotesNotice = Notice;

export function showNotice(message: string | DocumentFragment, timeout?: number): TaskNotesNotice {
	if (timeout === undefined) {
		return new Notice(message);
	}

	return new Notice(message, timeout);
}
