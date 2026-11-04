import type { Modal } from "obsidian";
import { renderKeyHint, TASK_KEYBOARD_MAP } from "./keyHint";

export function applyModalShell(modal: Pick<Modal, "modalEl" | "contentEl">): void {
	modal.modalEl.addClass("tasknotes-plugin", "tn-modal");
	modal.contentEl.addClass("tn-modal__content");
}

export function renderModalSubmitHint(button: HTMLElement): void {
	renderKeyHint(button, TASK_KEYBOARD_MAP.save);
}
