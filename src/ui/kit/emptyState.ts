import { renderKeyHint } from "./keyHint";

export interface EmptyStateOptions {
	message: string;
	actionLabel?: string;
	actionKey?: string;
	onAction?: () => void;
	secondaryActionLabel?: string;
	onSecondaryAction?: () => void;
	/** A single quiet line with little padding, for an expected empty result. */
	compact?: boolean;
}

export function renderEmptyState(container: HTMLElement, options: EmptyStateOptions): HTMLElement {
	const el = container.createDiv({ cls: options.compact ? "tn-empty tn-empty--compact" : "tn-empty" });
	el.createDiv({ cls: "tn-empty__message", text: options.message });

	if (options.actionLabel && options.onAction) {
		const button = el.createEl("button", { cls: "tn-btn mod-cta", text: options.actionLabel, attr: { type: "button" } });
		if (options.actionKey) renderKeyHint(button, options.actionKey);
		button.addEventListener("click", options.onAction);
	}
	if (options.secondaryActionLabel && options.onSecondaryAction) {
		const button = el.createEl("button", { cls: "tn-btn", text: options.secondaryActionLabel, attr: { type: "button" } });
		button.addEventListener("click", options.onSecondaryAction);
	}
	return el;
}
