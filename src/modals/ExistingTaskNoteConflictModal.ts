import { App, Modal, Setting, stringifyYaml } from "obsidian";

export type ExistingTaskNoteConflictAction = "apply" | "create-unique" | "cancel";
export type ExistingTaskNoteConflictChoice = "existing" | "incoming";

export interface ExistingTaskNoteConflictDecision {
	action: ExistingTaskNoteConflictAction;
	metadataChoice: ExistingTaskNoteConflictChoice;
	bodyChoice: ExistingTaskNoteConflictChoice;
}

export interface ExistingTaskNoteConflictModalOptions {
	path: string;
	existingFrontmatter: Record<string, unknown>;
	incomingFrontmatter: Record<string, unknown>;
	existingBody: string;
	incomingBody: string;
}

export class ExistingTaskNoteConflictModal extends Modal {
	private resolve: (decision: ExistingTaskNoteConflictDecision) => void;
	private resolved = false;
	private metadataChoice: ExistingTaskNoteConflictChoice = "incoming";
	private bodyChoice: ExistingTaskNoteConflictChoice = "existing";

	constructor(app: App, private options: ExistingTaskNoteConflictModalOptions) {
		super(app);
	}

	show(): Promise<ExistingTaskNoteConflictDecision> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-existing-tasknote-conflict-modal");

		new Setting(contentEl).setName("TaskNote already exists").setHeading();
		contentEl.createEl("p", {
			text: `A TaskNote already exists at ${this.options.path}. Choose what to keep before converting this task.`,
		});

		new Setting(contentEl)
			.setName("Metadata")
			.setDesc("Choose which frontmatter should be saved to the existing TaskNote.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("incoming", "Use converted task metadata")
					.addOption("existing", "Keep existing metadata")
					.setValue(this.metadataChoice)
					.onChange((value) => {
						this.metadataChoice = value as ExistingTaskNoteConflictChoice;
					});
			});

		this.renderDiffSection(
			contentEl,
			"Existing metadata",
			stringifyYaml(this.options.existingFrontmatter || {}).trimEnd()
		);
		this.renderDiffSection(
			contentEl,
			"Converted task metadata",
			stringifyYaml(this.options.incomingFrontmatter || {}).trimEnd()
		);

		new Setting(contentEl)
			.setName("Note body")
			.setDesc("Choose which body content should be saved to the existing TaskNote.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("existing", "Keep existing body")
					.addOption("incoming", "Use converted task body")
					.setValue(this.bodyChoice)
					.onChange((value) => {
						this.bodyChoice = value as ExistingTaskNoteConflictChoice;
					});
			});

		this.renderDiffSection(contentEl, "Existing body", this.options.existingBody);
		this.renderDiffSection(contentEl, "Converted task body", this.options.incomingBody);

		const buttonContainer = contentEl.createDiv("modal-button-container");
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.marginTop = "20px";

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel conversion" });
		cancelButton.addEventListener("click", () => {
			this.finish({ action: "cancel", metadataChoice: this.metadataChoice, bodyChoice: this.bodyChoice });
		});

		const uniqueButton = buttonContainer.createEl("button", { text: "Create unique copy" });
		uniqueButton.addEventListener("click", () => {
			this.finish({
				action: "create-unique",
				metadataChoice: this.metadataChoice,
				bodyChoice: this.bodyChoice,
			});
		});

		const applyButton = buttonContainer.createEl("button", {
			text: "Apply to existing note",
			cls: "mod-cta",
		});
		applyButton.addEventListener("click", () => {
			this.finish({ action: "apply", metadataChoice: this.metadataChoice, bodyChoice: this.bodyChoice });
		});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.finish({ action: "cancel", metadataChoice: this.metadataChoice, bodyChoice: this.bodyChoice });
		}
	}

	private renderDiffSection(container: HTMLElement, label: string, value: string): void {
		const section = container.createDiv("tasknotes-existing-tasknote-conflict-modal__section");
		section.createEl("h4", { text: label });
		const pre = section.createEl("pre");
		pre.style.maxHeight = "180px";
		pre.style.overflow = "auto";
		pre.style.padding = "8px";
		pre.style.background = "var(--background-secondary)";
		pre.style.border = "1px solid var(--background-modifier-border)";
		pre.style.borderRadius = "4px";
		pre.style.whiteSpace = "pre-wrap";
		pre.textContent = value.trim() || "(empty)";
	}

	private finish(decision: ExistingTaskNoteConflictDecision): void {
		if (this.resolved) {
			return;
		}
		this.resolved = true;
		this.resolve(decision);
		this.close();
	}
}

export async function showExistingTaskNoteConflictModal(
	app: App,
	options: ExistingTaskNoteConflictModalOptions
): Promise<ExistingTaskNoteConflictDecision> {
	return new ExistingTaskNoteConflictModal(app, options).show();
}
