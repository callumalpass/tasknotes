import { Modal, Setting } from "obsidian";
import TaskNotesPlugin from "../main";

/**
 * Specialized confirmation modal for storage location changes
 */
export class StorageLocationConfirmationModal extends Modal {
	private hasExistingData: boolean;
	private resolve: (confirmed: boolean) => void;
	private plugin: TaskNotesPlugin;

	constructor(plugin: TaskNotesPlugin, hasExistingData: boolean) {
		super(plugin.app);
		this.plugin = plugin;
		this.hasExistingData = hasExistingData;
	}

	private t(key: string, params?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, params);
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

		// Create title
		const stateKey = this.hasExistingData ? "migrate" : "switch";
		const title = this.t(`modals.storageLocation.title.${stateKey}`);
		new Setting(contentEl).setName(title).setHeading();

		// Main message
		const message = this.t(`modals.storageLocation.message.${stateKey}`);

		const messageP = contentEl.createEl("p");
		const strongMessage = messageP.createEl("strong");
		strongMessage.textContent = message;

		contentEl.createEl("br");

		// "What this means" section
		contentEl.createEl("p", { text: this.t("modals.storageLocation.whatThisMeans") });
		const warningsList = contentEl.createEl("ul");

		const warnings = [
			this.t("modals.storageLocation.bullets.dailyNotesRequired"),
			this.t("modals.storageLocation.bullets.storedInNotes"),
			this.hasExistingData
				? this.t("modals.storageLocation.bullets.migrateData")
				: this.t("modals.storageLocation.bullets.futureSessions"),
			this.t("modals.storageLocation.bullets.dataLongevity"),
		];

		warnings.forEach((warning) => {
			const listItem = warningsList.createEl("li");
			listItem.textContent = warning;
		});

		contentEl.createEl("br");

		// Final warning/note
		const finalNote = contentEl.createEl("p");
		if (this.hasExistingData) {
			const strongWarning = finalNote.createEl("strong");
			strongWarning.textContent = this.t("modals.storageLocation.finalNote.migrate");
		} else {
			finalNote.textContent = this.t("modals.storageLocation.finalNote.switch");
		}

		// Create buttons
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

		const cancelButton = buttonContainer.createEl("button", { text: this.t("common.cancel") });
		cancelButton.addEventListener("click", () => {
			this.resolve(false);
			this.close();
		});

		const confirmButton = buttonContainer.createEl("button", {
			text: this.hasExistingData
				? this.t("modals.storageLocation.buttons.migrate")
				: this.t("modals.storageLocation.buttons.switch"),
			cls: "mod-cta",
		});

		confirmButton.addEventListener("click", () => {
			this.resolve(true);
			this.close();
		});

		// Focus the confirm button
		window.setTimeout(() => {
			confirmButton.focus();
		}, 50);
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
 * Utility function to show storage location confirmation modal
 */
export async function showStorageLocationConfirmationModal(
	plugin: TaskNotesPlugin,
	hasExistingData: boolean
): Promise<boolean> {
	const modal = new StorageLocationConfirmationModal(plugin, hasExistingData);
	return modal.show();
}
