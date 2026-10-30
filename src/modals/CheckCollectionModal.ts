import { uiData } from "../i18n/dataText";
import { msg } from "@lingui/core/macro";
import { Modal, Notice, Setting } from "obsidian";
import type TaskNotesPlugin from "../main";
import { checkCollection, repairCollectionRecord, type CollectionProblem } from "../services/mdbase/checkCollection";
import { showConfirmationModal } from "./ConfirmationModal";

export class CheckCollectionModal extends Modal {
	private problems: CollectionProblem[] = [];
	private choices = new Map<CollectionProblem, string>();
	private busy = false;

	constructor(private plugin: TaskNotesPlugin) { super(plugin.app); }

	onOpen(): void { void this.scan(); }
	onClose(): void { this.contentEl.empty(); }

	private async scan(): Promise<void> {
		this.busy = true;
		this.contentEl.empty();
		new Setting(this.contentEl).setName(this.plugin.i18n.translate(msg({ message: "Check collection", context: "collectionCheck.title" }))).setHeading();
		try {
			this.problems = await checkCollection(this.plugin);
			this.choices.clear();
			this.render();
		} catch (error) {
			this.contentEl.createEl("p", { text: `${this.plugin.i18n.translate(msg({ message: "Collection check or repair stopped. No unapproved changes were made.", context: "collectionCheck.error" }))} ${String(error)}` });
		} finally { this.busy = false; }
	}

	private render(): void {
		const translate = this.plugin.i18n.translate.bind(this.plugin.i18n);
		this.contentEl.empty();
		new Setting(this.contentEl).setName(translate(msg({ message: "Check collection", context: "collectionCheck.title" }))).setHeading();
		this.contentEl.createEl("p", { text: translate(msg({ message: "Check task records without changing notes. Missing creation dates can be filled from file creation time. Invalid statuses require your choice. Other errors need manual review.", context: "collectionCheck.description" })) });
		this.contentEl.createEl("p", { text: this.problems.length ? translate(msg({ message: "Invalid records: {count}", context: "collectionCheck.count" }), { count: this.problems.length }) : translate(msg({ message: "No invalid task records found.", context: "collectionCheck.clean" })) });
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(translate(msg({ message: "Check again", context: "collectionCheck.check" }))).onClick(() => { if (!this.busy) void this.scan(); }))
			.addButton((button) => button.setButtonText(translate(msg({ message: "Back up and fix selected changes in all records", context: "collectionCheck.fixAll" }))).setDisabled(!this.problems.some((problem) => problem.missingDateCreated || problem.invalidStatus)).onClick(() => { void this.fix(this.problems); }));
		for (const problem of this.problems) {
			const row = new Setting(this.contentEl).setName(problem.file.path).setDesc(problem.issues.join("\n"));
			if (problem.invalidStatus) {
				row.addDropdown((dropdown) => {
					dropdown.addOption("", translate(msg({ message: "Choose a replacement status", context: "collectionCheck.chooseStatus" })));
					for (const status of problem.statusValues) dropdown.addOption(status, status);
					dropdown.onChange((value) => { if (value) this.choices.set(problem, value); else this.choices.delete(problem); });
				});
			}
			row.addButton((button) => button.setButtonText(translate(msg({ message: "Back up and fix", context: "collectionCheck.fix" }))).setDisabled(!problem.missingDateCreated && !problem.invalidStatus).onClick(() => { void this.fix([problem]); }));
		}
	}

	private async fix(problems: CollectionProblem[]): Promise<void> {
		if (this.busy) return;
		const translate = this.plugin.i18n.translate.bind(this.plugin.i18n);
		const selected = problems.filter((problem) => problem.missingDateCreated || (problem.invalidStatus && this.choices.has(problem)));
		if (!selected.length) { new Notice(translate(msg({ message: "Choose a replacement status", context: "collectionCheck.chooseStatus" }))); return; }
		this.busy = true;
		try {
			const confirmed = await showConfirmationModal(this.app, {
				title: translate(msg({ message: "Back up and fix", context: "collectionCheck.fix" })),
				message: `${translate(msg({ message: "Apply only the changes listed below; original notes will be backed up in {backupFolder} before each change, and unselected statuses and other errors will remain unchanged?", context: "collectionCheck.confirm" }), { backupFolder: uiData(".tasknotes/migrations", "Vault-relative recovery folder, not UI prose") })}\n${selected.map((problem) => `${problem.file.path}: ${problem.missingDateCreated ? `${problem.dateCreatedField} = ${new Date(problem.file.stat.ctime).toISOString()}` : ""}${this.choices.has(problem) ? ` ${problem.statusField} = ${this.choices.get(problem)}` : ""}`).join("\n")}`,
				confirmText: translate(msg({ message: "Back up and fix", context: "collectionCheck.fix" })),
				cancelText: translate(msg({ message: "Cancel", context: "common.cancel" })),
			});
			if (!confirmed) return;
			for (const problem of selected) await repairCollectionRecord(this.plugin, problem, this.choices.get(problem));
			new Notice(translate(msg({ message: "Approved changes saved; backups are in {backupFolder}, please check remaining errors.", context: "collectionCheck.fixed" }), { backupFolder: uiData(".tasknotes/migrations", "Vault-relative recovery folder, not UI prose") }));
			await this.scan();
		} catch (error) {
			new Notice(`${translate(msg({ message: "Collection check or repair stopped. No unapproved changes were made.", context: "collectionCheck.error" }))} ${String(error)}`);
		} finally { this.busy = false; }
	}
}
