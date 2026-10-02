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
		new Setting(this.contentEl).setName(this.plugin.i18n.translate("collectionCheck.title")).setHeading();
		try {
			this.problems = await checkCollection(this.plugin);
			this.choices.clear();
			this.render();
		} catch (error) {
			this.contentEl.createEl("p", { text: `${this.plugin.i18n.translate("collectionCheck.error")} ${String(error)}` });
		} finally { this.busy = false; }
	}

	private render(): void {
		const translate = this.plugin.i18n.translate.bind(this.plugin.i18n);
		this.contentEl.empty();
		new Setting(this.contentEl).setName(translate("collectionCheck.title")).setHeading();
		this.contentEl.createEl("p", { text: translate("collectionCheck.description") });
		this.contentEl.createEl("p", { text: this.problems.length ? translate("collectionCheck.count", { count: this.problems.length }) : translate("collectionCheck.clean") });
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(translate("collectionCheck.check")).onClick(() => { if (!this.busy) void this.scan(); }))
			.addButton((button) => button.setButtonText(translate("collectionCheck.fixAll")).setDisabled(!this.problems.some((problem) => problem.missingDateCreated || problem.invalidStatus)).onClick(() => { void this.fix(this.problems); }));
		for (const problem of this.problems) {
			const row = new Setting(this.contentEl).setName(problem.file.path).setDesc(problem.issues.join("\n"));
			if (problem.invalidStatus) {
				row.addDropdown((dropdown) => {
					dropdown.addOption("", translate("collectionCheck.chooseStatus"));
					for (const status of problem.statusValues) dropdown.addOption(status, status);
					dropdown.onChange((value) => { if (value) this.choices.set(problem, value); else this.choices.delete(problem); });
				});
			}
			row.addButton((button) => button.setButtonText(translate("collectionCheck.fix")).setDisabled(!problem.missingDateCreated && !problem.invalidStatus).onClick(() => { void this.fix([problem]); }));
		}
	}

	private async fix(problems: CollectionProblem[]): Promise<void> {
		if (this.busy) return;
		const translate = this.plugin.i18n.translate.bind(this.plugin.i18n);
		const selected = problems.filter((problem) => problem.missingDateCreated || (problem.invalidStatus && this.choices.has(problem)));
		if (!selected.length) { new Notice(translate("collectionCheck.chooseStatus")); return; }
		this.busy = true;
		try {
			const confirmed = await showConfirmationModal(this.app, {
				title: translate("collectionCheck.fix"),
				message: `${translate("collectionCheck.confirm", { backupFolder: ".tasknotes/migrations" })}\n${selected.map((problem) => `${problem.file.path}: ${problem.missingDateCreated ? `${problem.dateCreatedField} = ${new Date(problem.file.stat.ctime).toISOString()}` : ""}${this.choices.has(problem) ? ` ${problem.statusField} = ${this.choices.get(problem)}` : ""}`).join("\n")}`,
				confirmText: translate("collectionCheck.fix"),
				cancelText: translate("common.cancel"),
			});
			if (!confirmed) return;
			for (const problem of selected) await repairCollectionRecord(this.plugin, problem, this.choices.get(problem));
			new Notice(translate("collectionCheck.fixed", { backupFolder: ".tasknotes/migrations" }));
			await this.scan();
		} catch (error) {
			new Notice(`${translate("collectionCheck.error")} ${String(error)}`);
		} finally { this.busy = false; }
	}
}
