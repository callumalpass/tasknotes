import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { TFile, normalizePath, type App } from "obsidian";
import type { TaskNotesSettings } from "../types/settings";
import { createI18nService } from "../i18n";
import { ensureFolderHierarchy } from "./defaultBasesFiles";

export const STARTER_NOTE_PATH = "TaskNotes/Start Here.md";

export function generateStarterNoteContent(translate: (key: MessageDescriptor) => string): string {
	return [
		`# ${translate(msg({ message: "Start here with TaskNotes", context: "onboarding.title" }))}`,
		"",
		translate(msg({ message: "Tasks are Markdown notes in your vault. Use the command palette for these three steps.", context: "onboarding.intro" })),
		"",
		`1. **${translate(msg({ message: "Create new task", context: "commands.createNewTask" }))}**. ${translate(msg({ message: "Create a real task and schedule it for today.", context: "onboarding.create" }))}`,
		`2. **${translate(msg({ message: "Open today", context: "commands.openToday" }))}**. ${translate(msg({ message: "Find your task in `Today`.", context: "onboarding.review" }))}`,
		`3. ${translate(msg({ message: "Click the status control until the task is `Done`. It leaves `Today`, but its note stays in your vault.", context: "onboarding.complete" }))}`,
		"",
		translate(msg({ message: "For undated capture, clear the scheduled date. The inbox shows incomplete tasks with no project, scheduled date, or due date.", context: "onboarding.inbox" })),
		"",
		`[[TaskNotes/Views/tasks-default.base#Today|${translate(msg({ message: "Open today", context: "commands.openToday" }))}]] · [[TaskNotes/Views/tasks-default.base#Inbox|${translate(msg({ message: "Open inbox", context: "commands.openInbox" }))}]]`,
		"",
		`## ${translate(msg({ message: "Settings, when you need them", context: "onboarding.settings" }))}`,
		"",
		`- ${translate(msg({ message: "Settings", context: "common.settings" }))} → TaskNotes → ${translate(msg({ message: "Task files", context: "settings.native.taskFiles" }))}`,
		`- ${translate(msg({ message: "Settings", context: "common.settings" }))} → TaskNotes → ${translate(msg({ message: "Properties", context: "ui.filterBar.properties" }))}`,
		`- ${translate(msg({ message: "Settings", context: "common.settings" }))} → TaskNotes → ${translate(msg({ message: "Task creation", context: "settings.features.taskCreation.header" }))} → ${translate(msg({ message: "Form fields", context: "settings.native.formFields" }))}`,
		`- ${translate(msg({ message: "Settings", context: "common.settings" }))} → TaskNotes → ${translate(msg({ message: "Appearance & interaction", context: "settings.native.appearanceInteraction" }))} → ${translate(msg({ message: "Views & base files", context: "settings.integrations.basesIntegration.viewCommands.header" }))}`,
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
	translate?: (key: MessageDescriptor) => string;
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
