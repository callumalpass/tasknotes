import { App, Modal, Setting } from "obsidian";

export interface ConfirmationModalOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	isDestructive?: boolean;
	defaultToConfirm?: boolean;
	/** Optional third button text (e.g., "Cancel" to go back) */
	thirdButtonText?: string;
	/** Callback when third button is clicked */
	onThirdButton?: () => void;
}

/**
 * Generic confirmation modal for user confirmations
 */
export class ConfirmationModal extends Modal {
	private options: ConfirmationModalOptions;
	private resolve: (confirmed: boolean) => void;

	constructor(app: App, options: ConfirmationModalOptions) {
		super(app);
		this.options = {
			confirmText: "Confirm",
			cancelText: "Cancel",
			isDestructive: false,
			...options,
		};
	}

	public show(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl).setName(this.options.title).setHeading();

		contentEl.createEl("p", { text: this.options.message });

		const buttonContainer = contentEl.createEl("div", { cls: "modal-button-container" });
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.marginTop = "20px";

		// Optional third button (e.g., "Cancel" to go back to editing)
		let thirdButton: HTMLButtonElement | null = null;
		if (this.options.thirdButtonText) {
			thirdButton = buttonContainer.createEl("button", { text: this.options.thirdButtonText });
			thirdButton.addEventListener("click", () => {
				if (this.options.onThirdButton) {
					this.options.onThirdButton();
				}
				this.close();
			});
		}

		const cancelButton = buttonContainer.createEl("button", { text: this.options.cancelText });
		cancelButton.addEventListener("click", () => {
			this.resolve(false);
			this.close();
		});

		const confirmButton = buttonContainer.createEl("button", {
			text: this.options.confirmText,
			cls: this.options.isDestructive ? "mod-warning" : "mod-cta",
		});

		if (this.options.isDestructive) {
			confirmButton.style.backgroundColor = "var(--color-red)";
			confirmButton.style.color = "white";
		}

		confirmButton.addEventListener("click", () => {
			this.resolve(true);
			this.close();
		});

		// Focus the appropriate button based on defaultToConfirm option
		// Use setTimeout to ensure the DOM is fully rendered before focusing
		setTimeout(() => {
			if (this.options.defaultToConfirm) {
				confirmButton.focus();
			} else {
				// Focus the cancel button by default for safety
				cancelButton.focus();
			}
		}, 0);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// Ensure promise is resolved even if modal is closed without selection
		if (this.resolve) {
			this.resolve(false);
		}
	}
}

/**
 * Utility function to show confirmation modal
 */
export async function showConfirmationModal(
	app: App,
	options: ConfirmationModalOptions
): Promise<boolean> {
	const modal = new ConfirmationModal(app, options);
	return modal.show();
}
