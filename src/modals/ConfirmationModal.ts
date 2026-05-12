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

		// Optional third button (e.g., "Cancel" to go back to editing)
		let thirdButton: HTMLButtonElement | null = null;
		if (this.options.thirdButtonText) {
			thirdButton = buttonContainer.createEl("button", {
				text: this.options.thirdButtonText,
			});
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
			confirmButton.classList.remove(
				"tn-static-background-color-var-background-mo-94b219f0",
				"tn-static-background-color-var-background-se-9087a23e",
				"tn-static-background-color-var-color-base-40-ef5f175e",
				"tn-static-background-color-var-text-accent-a954c70f"
			);
			confirmButton.classList.add("tn-static-background-color-var-color-red-134bc721");
			confirmButton.classList.remove(
				"tn-static-color-var-color-accent-d2cad743",
				"tn-static-color-var-text-accent-65b47ee3",
				"tn-static-color-var-text-muted-5872de20",
				"tn-static-color-var-text-on-accent-f3e1679d",
				"tn-static-color-var-text-warning-783d5f03",
				"tn-static-color-var-tn-text-muted-a90fb6f3",
				"tn-static-cursor-pointer-2723efcc",
				"tn-static-font-size-12px-65574819",
				"tn-static-font-weight-bold-0fe8c30d",
				"tn-static-font-weight-bold-e0b452bd",
				"tn-static-margin-2px-0-edce9b14",
				"tn-static-padding-20px-7a035d95",
				"tn-static-padding-20px-ebe8e48c"
			);
			confirmButton.classList.add("tn-static-color-white-0a43e56a");
		}

		confirmButton.addEventListener("click", () => {
			this.resolve(true);
			this.close();
		});

		// Focus the appropriate button based on defaultToConfirm option
		// Use setTimeout to ensure the DOM is fully rendered before focusing
		window.setTimeout(() => {
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
