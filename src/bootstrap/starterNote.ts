import { TFile, normalizePath, type App } from "obsidian";
import type { TaskNotesSettings } from "../types/settings";
import { createI18nService } from "../i18n";
import { ensureFolderHierarchy } from "./defaultBasesFiles";

export const STARTER_NOTE_PATH = "TaskNotes/Start Here.md";

export function generateStarterNoteContent(translate: (key: string) => string): string {
	return [
		`# ${translate("onboarding.title")}`,
		"",
		translate("onboarding.intro"),
		"",
		`1. **${translate("commands.createNewTask")}**. ${translate("onboarding.create")}`,
		`2. **${translate("commands.openToday")}**. ${translate("onboarding.review")}`,
		`3. ${translate("onboarding.complete")}`,
		"",
		translate("onboarding.inbox"),
		"",
		`[[TaskNotes/Views/tasks-default.base#Today|${translate("commands.openToday")}]] · [[TaskNotes/Views/tasks-default.base#Inbox|${translate("commands.openInbox")}]]`,
		"",
		`## ${translate("onboarding.settings")}`,
		"",
		`- ${translate("common.settings")} → TaskNotes → ${translate("settings.native.taskFiles")}`,
		`- ${translate("common.settings")} → TaskNotes → ${translate("ui.filterBar.properties")}`,
		`- ${translate("common.settings")} → TaskNotes → ${translate("settings.features.taskCreation.header")} → ${translate("settings.native.formFields")}`,
		`- ${translate("common.settings")} → TaskNotes → ${translate("settings.native.appearanceInteraction")} → ${translate("settings.integrations.basesIntegration.viewCommands.header")}`,
		"",
		"[tasknotes.dev](https://tasknotes.dev/getting-started/)",
		"",
	].join("\n");
}

const defaultI18n = createI18nService();
export const STARTER_NOTE_CONTENT = generateStarterNoteContent(defaultI18n.translate.bind(defaultI18n));

export type StarterNoteResult =
	| "created"
	| "opened-existing"
	| "already-created"
	| "not-first-install"
	| "path-not-file"
	| "failed";

export type StarterNoteHost = {
	app: Pick<App, "vault" | "workspace">;
	settings: Pick<TaskNotesSettings, "starterNoteCreated">;
	shouldCreateStarterNote: boolean;
	translate?: (key: string) => string;
	saveSettings(): Promise<void>;
	warn?(message: string, error?: unknown): void;
};

export async function ensureStarterNote(host: StarterNoteHost): Promise<StarterNoteResult> {
	if (host.settings.starterNoteCreated) return "already-created";
	if (!host.shouldCreateStarterNote) return "not-first-install";

	const normalizedPath = normalizePath(STARTER_NOTE_PATH);
	try {
		const vault = host.app.vault;
		const existing = await vault.adapter.exists(normalizedPath);
		let file: TFile;
		let result: StarterNoteResult = "created";
		if (existing) {
			const existingFile = vault.getAbstractFileByPath(normalizedPath);
			if (!(existingFile instanceof TFile)) {
				host.warn?.(`[TaskNotes][StarterNote] Starter note path exists but is not a file: ${normalizedPath}`);
				return "path-not-file";
			}
			file = existingFile;
			result = "opened-existing";
		} else {
			await ensureFolderHierarchy(vault, "TaskNotes");
			file = await vault.create(normalizedPath, host.translate
				? generateStarterNoteContent(host.translate) : STARTER_NOTE_CONTENT);
		}
		host.settings.starterNoteCreated = true;
		await host.saveSettings();
		await host.app.workspace.getLeaf("tab").openFile(file);
		return result;
	} catch (error) {
		host.warn?.("[TaskNotes][StarterNote] Failed to create starter note:", error);
		return "failed";
	}
}
