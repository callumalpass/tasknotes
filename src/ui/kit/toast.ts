export interface ToastAction {
	label: string;
	run: () => void;
}

export interface ToastOptions {
	message: string;
	action?: ToastAction;
	durationMs?: number;
}

const DEFAULT_DURATION_MS = 5000;

/** One-line transient message. Prefer this over Notice when the action can be undone. */
export function showToast(options: ToastOptions): { dismiss: () => void } {
	const doc = activeDocument;
	doc.body.querySelector(".tn-toast")?.remove();

	const el = doc.body.createDiv({
		cls: "tasknotes-plugin tn-toast",
		attr: { role: "status", "aria-live": "polite" },
	});
	el.createSpan({ cls: "tn-toast__message", text: options.message });

	const dismiss = () => {
		window.clearTimeout(timer);
		el.remove();
	};
	const timer = window.setTimeout(dismiss, options.durationMs ?? DEFAULT_DURATION_MS);

	if (options.action) {
		const { label, run } = options.action;
		const button = el.createEl("button", { cls: "tn-toast__action", text: label });
		button.addEventListener("click", () => {
			dismiss();
			run();
		});
	}

	return { dismiss };
}
