import { Modal, App, Setting } from "obsidian";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Modals/PropertySelectorModal" });

/**
 * Modal for selecting visible properties (multi-select checkboxes)
 * Used for both inline and default task card property selection
 */
export class PropertySelectorModal extends Modal {
	private availableProperties: Array<{ id: string; label: string }>;
	private currentSelection: string[];
	private onSubmit: (selected: string[]) => unknown;
	private tempSelection: string[];
	private modalTitle: string;
	private modalDescription: string;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(
		app: App,
		availableProperties: Array<{ id: string; label: string }>,
		currentSelection: string[],
		onSubmit: (selected: string[]) => unknown,
		modalTitle = "Select Task Card Properties",
		modalDescription = "Choose which properties to display in task cards. Selected properties will appear in the order shown below."
	) {
		super(app);
		this.availableProperties = availableProperties;
		this.currentSelection = currentSelection;
		this.tempSelection = [...currentSelection];
		this.onSubmit = onSubmit;
		this.modalTitle = modalTitle;
		this.modalDescription = modalDescription;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		// Add global keyboard shortcut handler for CMD/Ctrl+Enter
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				this.submitSelection();
				this.close();
			}
		};
		this.containerEl.addEventListener("keydown", this.keyboardHandler);

		contentEl.createEl("h2", { text: this.modalTitle });

		contentEl.createEl("p", {
			text: this.modalDescription,
			cls: "setting-item-description",
		});

		// Create checkboxes for each property
		const checkboxContainer = contentEl.createDiv({ cls: "property-selector-checkboxes" });
		checkboxContainer.classList.remove("tn-static-margin-top-12px-91e0f558");
		checkboxContainer.classList.add("tn-static-max-height-400px-f0787633");
		checkboxContainer.classList.remove(
			"tn-static-margin-top-12px-91e0f558",
			"tn-static-overflow-y-clip-c5043043"
		);
		checkboxContainer.classList.add("tn-static-overflow-y-auto-03df744e");
		checkboxContainer.classList.remove(
			"tn-static-font-size-12px-65574819",
			"tn-static-font-weight-bold-0fe8c30d",
			"tn-static-font-weight-bold-e0b452bd",
			"tn-static-margin-bottom-0-75rem-c05a3c6e",
			"tn-static-margin-bottom-8px-fdf33f23"
		);
		checkboxContainer.classList.add("tn-static-margin-bottom-20px-49f14f8f");

		for (const prop of this.availableProperties) {
			new Setting(checkboxContainer).setName(prop.label).addToggle((toggle) => {
				toggle.setValue(this.tempSelection.includes(prop.id)).onChange((value) => {
					if (value) {
						if (!this.tempSelection.includes(prop.id)) {
							this.tempSelection.push(prop.id);
						}
					} else {
						const index = this.tempSelection.indexOf(prop.id);
						if (index > -1) {
							this.tempSelection.splice(index, 1);
						}
					}
				});
			});
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({
			cls: "modal-button-container",
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

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const saveButton = buttonContainer.createEl("button", {
			text: "Save",
			cls: "mod-cta",
		});
		saveButton.addEventListener("click", () => {
			this.submitSelection();
			this.close();
		});
	}

	private submitSelection(): void {
		void Promise.resolve()
			.then(() => this.onSubmit(this.tempSelection))
			.catch((error: unknown) => {
				tasknotesLogger.error("TaskNotes property selection callback failed:", {
					category: "persistence",
					operation: "property-selection-callback",
					error: error,
				});
			});
	}

	onClose() {
		// Clean up keyboard handler
		if (this.keyboardHandler) {
			this.containerEl.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}

		const { contentEl } = this;
		contentEl.empty();
	}
}
