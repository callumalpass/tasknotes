import type { App } from "obsidian";
import { TFile, normalizePath } from "obsidian";
import { DEFAULT_SETTINGS } from "../settings/defaults";
import type { TaskNotesSettings } from "../types/settings";

export type DefaultBasesFileResult = {
	created: string[];
	updated: string[];
	skipped: string[];
};

export type DefaultBasesFileHost = {
	app: Pick<App, "vault">;
	settings: TaskNotesSettings;
	generateTemplate(commandId: string): string | null | undefined;
	warn?(message: string, error?: unknown): void;
};

export type DefaultBasesFileOptions = {
	overwriteExisting?: boolean;
};

export async function ensureFolderHierarchy(
	vault: Pick<App["vault"], "adapter" | "createFolder">,
	folderPath: string
): Promise<void> {
	if (!folderPath) {
		return;
	}

	const normalized = normalizePath(folderPath);
	const segments = normalized.split("/").filter((segment) => segment.length > 0);

	if (segments.length === 0) {
		return;
	}

	let currentPath = "";
	for (const segment of segments) {
		currentPath = currentPath ? `${currentPath}/${segment}` : segment;

		if (await vault.adapter.exists(currentPath)) {
			continue;
		}

		try {
			await vault.createFolder(currentPath);
		} catch (error) {
			if (!(await vault.adapter.exists(currentPath))) {
				throw error;
			}
		}
	}
}

export async function ensureDefaultBasesViewFiles(
	host: DefaultBasesFileHost,
	options: DefaultBasesFileOptions = {}
): Promise<DefaultBasesFileResult> {
	const created: string[] = [];
	const updated: string[] = [];
	const skipped: string[] = [];
	const overwriteExisting = options.overwriteExisting === true;

	try {
		const vault = host.app.vault;
		const adapter = vault.adapter;
		const commandFileMapping = {
			...DEFAULT_SETTINGS.commandFileMapping,
			...(host.settings.commandFileMapping ?? {}),
		};
		host.settings.commandFileMapping = commandFileMapping;

		for (const [commandId, rawPath] of Object.entries(commandFileMapping)) {
			if (!rawPath) {
				continue;
			}

			const normalizedPath = normalizePath(rawPath);
			const template = host.generateTemplate(commandId);
			if (!template) {
				skipped.push(rawPath);
				continue;
			}

			if (await adapter.exists(normalizedPath)) {
				if (!overwriteExisting) {
					skipped.push(rawPath);
					continue;
				}

				const existing = vault.getAbstractFileByPath(normalizedPath);
				if (!(existing instanceof TFile)) {
					host.warn?.(
						`[TaskNotes][Bases] Cannot update default Bases file because path is not a file: ${normalizedPath}`
					);
					skipped.push(rawPath);
					continue;
				}

				await vault.modify(existing, template);
				updated.push(rawPath);
				continue;
			}

			const lastSlashIndex = normalizedPath.lastIndexOf("/");
			const directory =
				lastSlashIndex >= 0 ? normalizedPath.substring(0, lastSlashIndex) : "";

			if (directory) {
				await ensureFolderHierarchy(vault, directory);
			}

			await vault.create(normalizedPath, template);
			created.push(rawPath);
		}
	} catch (error) {
		host.warn?.("[TaskNotes][Bases] Failed to ensure Bases command files:", error);
	}

	return { created, updated, skipped };
}
