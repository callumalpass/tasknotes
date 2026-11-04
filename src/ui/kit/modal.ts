import type { Modal } from "obsidian";
import { renderKeyHint, TASK_KEYBOARD_MAP } from "./keyHint";

export function applyModalShell(modal: Pick<Modal, "modalEl" | "contentEl" | "onClose">): void {
	modal.modalEl.addClass("tasknotes-plugin", "tn-modal");
	modal.contentEl.addClass("tn-modal__content");
	const opener = modal.modalEl.ownerDocument.activeElement as HTMLElement | null;
	const view = opener?.closest<HTMLElement>(".bases-view .tasknotes-plugin[tabindex]");
	const close = modal.onClose.bind(modal);
	modal.onClose = () => {
		close();
		queueMicrotask(() => {
			const doc = modal.modalEl.ownerDocument;
			if (doc.activeElement === doc.body || modal.modalEl.contains(doc.activeElement)) {
				const target = view ?? opener;
				if (target?.isConnected) target.focus({ preventScroll: true });
			}
		});
	};
}

export function renderModalSubmitHint(button: HTMLElement): void {
	renderKeyHint(button, TASK_KEYBOARD_MAP.save);
}
