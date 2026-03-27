/**
 * Modal for on-demand frontmatter property migration.
 * Supports renaming property keys, changing property values, and renaming tags.
 */

import { App, Modal, Notice, Setting, TFile } from "obsidian";
import TaskNotesPlugin from "../main";
import { FolderSuggest } from "../settings/components/FolderSuggest";
import { PropertySuggest } from "../settings/components/PropertySuggest";

type MigrationType = "renameKey" | "changeValue" | "renameTag";

export class MigrationModal extends Modal {
	private plugin: TaskNotesPlugin;

	private migrationType: MigrationType = "renameKey";
	private oldValue = "";
	private newValue = "";
	// For changeValue: the property name that holds the value
	private propertyName = "";
	private scopeFolder = "";

	private affectedCount = 0;
	private affectedFiles: TFile[] = [];
	private countEl: HTMLElement | null = null;
	private migrateButton: HTMLButtonElement | null = null;
	private inputsContainer: HTMLElement | null = null;

	constructor(app: App, plugin: TaskNotesPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tn-migration-modal");

		new Setting(contentEl).setName("Migrate frontmatter properties").setHeading();

		contentEl.createEl("p", {
			text: "Rename property keys, change property values, or rename tags across your vault.",
			cls: "setting-item-description",
		});
		contentEl.style.paddingBottom = "0";

		// Migration type
		new Setting(contentEl)
			.setName("Migration type")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("renameKey", "Rename property key")
					.addOption("changeValue", "Change property value")
					.addOption("renameTag", "Rename tag")
					.setValue(this.migrationType)
					.onChange((value) => {
						this.migrationType = value as MigrationType;
						this.rebuildInputs();
						this.updateCount();
					});
			});

		// Dynamic inputs container
		this.inputsContainer = contentEl.createDiv();
		this.rebuildInputs();

		// Scope filter with FolderSuggest autocomplete
		const scopeSetting = new Setting(contentEl)
			.setName("Scope")
			.setDesc("Limit to a folder (leave empty for all files)");

		const scopeInputEl = scopeSetting.controlEl.createEl("input", {
			type: "text",
			cls: "settings-view__input",
			attr: { placeholder: "e.g., TaskNotes/Tasks" },
		});
		scopeInputEl.value = this.scopeFolder;
		new FolderSuggest(this.app, scopeInputEl);
		scopeInputEl.addEventListener("input", () => {
			this.scopeFolder = scopeInputEl.value.trim();
			this.updateCount();
		});

		// Affected count display
		const countContainer = contentEl.createDiv({ cls: "tn-migration-count" });
		countContainer.style.cssText = "padding: 8px 12px; margin: 8px 0; border-radius: 6px; background: var(--background-secondary); text-align: center; font-size: var(--font-ui-small);";
		this.countEl = countContainer;
		this.updateCount();

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
		buttonContainer.style.cssText = "display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px;";

		const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());

		this.migrateButton = buttonContainer.createEl("button", {
			text: "Migrate",
			cls: "mod-cta",
		});
		this.migrateButton.disabled = true;
		this.migrateButton.addEventListener("click", () => this.executeMigration());

		// Tighten setting item spacing inside this modal
		contentEl.querySelectorAll<HTMLElement>(".setting-item").forEach((el) => {
			el.style.padding = "8px 0";
		});
	}

	private rebuildInputs() {
		if (!this.inputsContainer) return;
		this.inputsContainer.empty();

		const isChangeValue = this.migrationType === "changeValue";

		// Property name (only for changeValue)
		if (isChangeValue) {
			const propNameSetting = new Setting(this.inputsContainer)
				.setName("Property name")
				.setDesc("The frontmatter key that holds the value to change");
			const propNameInput = propNameSetting.controlEl.createEl("input", {
				type: "text",
				cls: "settings-view__input",
				attr: { placeholder: "e.g., status" },
			});
			propNameInput.value = this.propertyName;
			new PropertySuggest(this.app, propNameInput);
			propNameInput.addEventListener("input", () => {
				this.propertyName = propNameInput.value.trim();
				this.updateCount();
			});
		}

		// Old value
		const oldLabel = this.migrationType === "renameKey" ? "Current property key"
			: this.migrationType === "renameTag" ? "Current tag"
			: "Current value";
		const oldPlaceholder = this.migrationType === "renameKey" ? "e.g., tnType"
			: this.migrationType === "renameTag" ? "e.g., task"
			: "e.g., open";

		const oldSetting = new Setting(this.inputsContainer).setName(oldLabel);
		const oldInputEl = oldSetting.controlEl.createEl("input", {
			type: "text",
			cls: "settings-view__input",
			attr: { placeholder: oldPlaceholder },
		});
		oldInputEl.value = this.oldValue;
		if (this.migrationType === "renameKey") {
			new PropertySuggest(this.app, oldInputEl);
		}
		oldInputEl.addEventListener("input", () => {
			this.oldValue = oldInputEl.value.trim();
			this.updateCount();
		});

		// New value
		const newLabel = this.migrationType === "renameKey" ? "New property key"
			: this.migrationType === "renameTag" ? "New tag"
			: "New value";
		const newPlaceholder = this.migrationType === "renameKey" ? "e.g., noteType"
			: this.migrationType === "renameTag" ? "e.g., todo"
			: "e.g., active";

		const newSetting = new Setting(this.inputsContainer).setName(newLabel);
		const newInputEl = newSetting.controlEl.createEl("input", {
			type: "text",
			cls: "settings-view__input",
			attr: { placeholder: newPlaceholder },
		});
		newInputEl.value = this.newValue;
		newInputEl.addEventListener("input", () => {
			this.newValue = newInputEl.value.trim();
			this.updateCount();
		});

		// Apply tight spacing to dynamically created settings too
		this.inputsContainer.querySelectorAll<HTMLElement>(".setting-item").forEach((el) => {
			el.style.padding = "8px 0";
		});
	}

	private updateCount() {
		if (!this.oldValue) {
			this.affectedFiles = [];
			this.affectedCount = 0;
			if (this.countEl) this.countEl.textContent = "Enter values to see affected files";
			if (this.migrateButton) this.migrateButton.disabled = true;
			return;
		}

		const files = this.app.vault.getMarkdownFiles();
		const scopeFolder = this.scopeFolder;
		const filtered = scopeFolder
			? files.filter((f) => f.path.startsWith(scopeFolder))
			: files;

		this.affectedFiles = [];

		for (const file of filtered) {
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!fm) continue;

			switch (this.migrationType) {
				case "renameKey":
					if (fm[this.oldValue] !== undefined) {
						this.affectedFiles.push(file);
					}
					break;
				case "changeValue":
					if (this.propertyName && fm[this.propertyName] === this.oldValue) {
						this.affectedFiles.push(file);
					}
					break;
				case "renameTag":
					if (Array.isArray(fm.tags)) {
						if (fm.tags.some((t: string) => t === this.oldValue || t === `#${this.oldValue}`)) {
							this.affectedFiles.push(file);
						}
					}
					break;
			}
		}

		this.affectedCount = this.affectedFiles.length;

		if (this.countEl) {
			if (this.affectedCount === 0) {
				this.countEl.textContent = "No matching files found";
				this.countEl.style.color = "var(--text-muted)";
			} else {
				this.countEl.textContent = `${this.affectedCount} file${this.affectedCount === 1 ? "" : "s"} will be updated`;
				this.countEl.style.color = "var(--text-normal)";
			}
		}

		const canMigrate = this.affectedCount > 0 && this.newValue && this.oldValue !== this.newValue;
		if (this.migrateButton) {
			this.migrateButton.disabled = !canMigrate;
			this.migrateButton.textContent = canMigrate ? `Migrate ${this.affectedCount} file${this.affectedCount === 1 ? "" : "s"}` : "Migrate";
		}
	}

	private async executeMigration() {
		if (!this.migrateButton || this.affectedFiles.length === 0) return;

		this.migrateButton.disabled = true;
		this.migrateButton.textContent = "Migrating...";

		let count = 0;

		try {
			for (const file of this.affectedFiles) {
				await this.app.fileManager.processFrontMatter(file, (fm) => {
					switch (this.migrationType) {
						case "renameKey":
							if (fm[this.oldValue] !== undefined) {
								fm[this.newValue] = fm[this.oldValue];
								delete fm[this.oldValue];
								count++;
							}
							break;
						case "changeValue":
							if (this.propertyName && fm[this.propertyName] === this.oldValue) {
								fm[this.propertyName] = this.newValue;
								count++;
							}
							break;
						case "renameTag":
							if (Array.isArray(fm.tags)) {
								const idx = fm.tags.indexOf(this.oldValue);
								if (idx !== -1) {
									fm.tags[idx] = this.newValue;
									count++;
								} else {
									const hashIdx = fm.tags.indexOf(`#${this.oldValue}`);
									if (hashIdx !== -1) {
										fm.tags[hashIdx] = `#${this.newValue}`;
										count++;
									}
								}
							}
							break;
					}
				});
			}

			const typeLabel = this.migrationType === "renameKey" ? "Renamed property key"
				: this.migrationType === "renameTag" ? "Renamed tag"
				: "Changed property value";
			new Notice(`${typeLabel} in ${count} file${count === 1 ? "" : "s"}.`);
			this.close();
		} catch (error) {
			new Notice(`Migration failed: ${error}`);
			this.migrateButton.disabled = false;
			this.migrateButton.textContent = "Retry";
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
