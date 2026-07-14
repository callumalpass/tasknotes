import { App, Modal, Setting } from "obsidian";

export interface TextInputModalFitContentOptions {
	minCh?: number;
	maxCh?: number;
}

export interface TextInputModalOptions {
	title: string;
	placeholder?: string;
	initialValue?: string;
	confirmText?: string;
	cancelText?: string;
	/** When true, confirming with an empty value resolves to "" instead of null. */
	allowEmpty?: boolean;
	/** When false, places the cursor at the end instead of selecting all text on open. */
	selectOnFocus?: boolean;
	/** Shrink the modal and input width to match the current value. */
	fitContent?: boolean | TextInputModalFitContentOptions;
	onInputReady?: (inputEl: HTMLInputElement) => void;
}

export function bindTextInputModalWidthToContent(
	input: HTMLInputElement,
	options: TextInputModalFitContentOptions = {}
): void {
	const minCh = options.minCh ?? 14;
	const maxCh = options.maxCh ?? 48;
	const update = (): void => {
		const contentLength = Math.max(
			input.value.length,
			input.placeholder.length,
			minCh
		);
		input.style.width = `${Math.min(contentLength + 2, maxCh)}ch`;
	};

	input.addEventListener("input", update);
	update();
}

/**
 * Generic text input modal
 */
export class TextInputModal extends Modal {
	private options: TextInputModalOptions;
	private resolve: (value: string | null) => void;
	private inputEl: HTMLInputElement;

	constructor(app: App, options: TextInputModalOptions) {
		super(app);
		this.options = {
			confirmText: "Confirm",
			cancelText: "Cancel",
			...options,
		};
	}

	public show(): Promise<string | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	private getFitContentOptions(): TextInputModalFitContentOptions | null {
		const { fitContent } = this.options;
		if (!fitContent) return null;
		return fitContent === true ? {} : fitContent;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tn-text-input-modal__content");

		const fitContentOptions = this.getFitContentOptions();
		this.modalEl.addClass("tn-text-input-modal");
		if (fitContentOptions) {
			this.modalEl.addClass("tn-text-input-modal--fit-content");
		}

		new Setting(contentEl).setName(this.options.title).setHeading();

		const inputSetting = new Setting(contentEl);
		if (fitContentOptions) {
			inputSetting.settingEl.addClass("tn-text-input-modal__input-setting");
		}

		inputSetting.addText((text) => {
			this.inputEl = text.inputEl;
			text.setPlaceholder(this.options.placeholder || "")
				.setValue(this.options.initialValue || "")
				.onChange(() => {
					// Optional: real-time validation could go here
				});

			if (fitContentOptions) {
				bindTextInputModalWidthToContent(this.inputEl, fitContentOptions);
			}

			// Focus the input after the modal is visible so suggest popovers can attach.
			window.setTimeout(() => {
				this.inputEl.focus();
				if (this.options.selectOnFocus !== false) {
					this.inputEl.select();
				} else {
					const length = this.inputEl.value.length;
					this.inputEl.setSelectionRange(length, length);
				}
				this.options.onInputReady?.(this.inputEl);
			}, 100);
		});

		const buttonContainer = contentEl.createEl("div", {
			cls: "modal-button-container tn-text-input-modal__buttons",
		});
		buttonContainer.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		buttonContainer.classList.add("tn-static-display-flex-75816cae");
		buttonContainer.classList.remove(
			"tn-static-display-flex-8bb39979",
			"tn-static-gap-0-5rem-ce2fca4d",
			"tn-static-gap-12px-ed7b3d87",
			"tn-static-gap-6px-f0abc1db",
			"tn-static-gap-8px-33fcd4c3"
		);
		buttonContainer.classList.add("tn-static-gap-10px-f3d7ce77");
		buttonContainer.classList.remove(
			"tn-static-justify-content-center-03c4bb6f",
			"tn-static-justify-content-space-between-a562f4fd"
		);
		buttonContainer.classList.add("tn-static-justify-content-flex-end-455f8cca");
		buttonContainer.classList.remove(
			"tn-static-font-size-12px-b0cc7e05",
			"tn-static-margin-top-0-5rem-3dc98b5e",
			"tn-static-margin-top-0-d462248a",
			"tn-static-margin-top-12px-91e0f558",
			"tn-static-margin-top-16px-1b0f4999",
			"tn-static-margin-top-1rem-2239d6d5",
			"tn-static-margin-top-30px-2fbbbcd4",
			"tn-static-margin-top-4px-96ad6099",
			"tn-static-margin-top-8px-8a77e5a3",
			"tn-static-margin-top-8px-f4f01e68"
		);
		buttonContainer.classList.add("tn-static-margin-top-20px-a26bda7d");

		const cancelButton = buttonContainer.createEl("button", { text: this.options.cancelText });
		cancelButton.addEventListener("click", () => {
			this.resolve(null);
			this.close();
		});

		const confirmButton = buttonContainer.createEl("button", {
			text: this.options.confirmText,
			cls: "mod-cta",
		});

		confirmButton.addEventListener("click", () => {
			const value = this.inputEl.value.trim();
			this.resolve(value || (this.options.allowEmpty ? value : null));
			this.close();
		});

		// Handle Enter key
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				confirmButton.click();
			} else if (e.key === "Escape") {
				e.preventDefault();
				cancelButton.click();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// Ensure promise is resolved even if modal is closed without selection
		if (this.resolve) {
			this.resolve(null);
		}
	}
}

/**
 * Utility function to show text input modal
 */
export async function showTextInputModal(
	app: App,
	options: TextInputModalOptions
): Promise<string | null> {
	const modal = new TextInputModal(app, options);
	return modal.show();
}
