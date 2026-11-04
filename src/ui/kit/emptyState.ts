import { renderKeyHint } from "./keyHint";

export interface EmptyStateOptions {
	message: string;
	actionLabel?: string;
	actionKey?: string;
	onAction?: () => void;
}

export function renderEmptyState(container: HTMLElement, options: EmptyStateOptions): HTMLElement {
	const el = container.createDiv({ cls: "tn-empty" });
	el.createDiv({ cls: "tn-empty__message", text: options.message });

	if (options.actionLabel && options.onAction) {
		const button = el.createEl("button", { cls: "tn-btn tn-btn--ghost", text: options.actionLabel });
		if (options.actionKey) renderKeyHint(button, options.actionKey);
		button.addEventListener("click", options.onAction);
	}
	return el;
}
