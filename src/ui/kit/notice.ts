import { Notice } from "obsidian";

export function showNotice(message: string, duration?: number): Notice {
	const fragment = activeWindow.createFragment();
	fragment.createDiv({ cls: "tasknotes-plugin tn-notice", text: message });
	return new Notice(fragment, duration);
}
