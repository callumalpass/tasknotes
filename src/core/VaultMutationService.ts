import type { App, DataAdapter, TFile } from "obsidian";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

type MutationVault = {
	configDir?: string;
	adapter?: Partial<Pick<DataAdapter, "read" | "write" | "remove">>;
	process(file: TFile, update: (content: string) => string): Promise<string>;
};

type FrontmatterMutationApp = {
	fileManager: {
		processFrontMatter(
			file: TFile,
			update: (frontmatter: Record<string, unknown>) => void
		): Promise<void>;
	};
	vault?: MutationVault;
};

/** A byte order mark before the opening frontmatter fence. */
const BOM_BEFORE_FRONTMATTER = /^\uFEFF+(?=---\r?\n)/;

type FileContentMutationApp = { vault: MutationVault };

const logger = createTaskNotesLogger({ tag: "Core/VaultMutationService" });
const vaultMutationQueues = new WeakMap<TFile, Promise<unknown>>();

async function withWriteRecovery<T>(
	vault: MutationVault | undefined,
	file: TFile,
	path: string,
	original: string,
	write: () => Promise<T>
): Promise<T> {
	const adapter = vault?.adapter;
	if (!original || !vault?.configDir || !adapter?.read || !adapter.write || !adapter.remove) {
		return write();
	}

	const backup = `${vault.configDir}/tasknotes-recovery-${crypto.randomUUID()}.bak`;
	const snapshot = JSON.stringify({ path, content: original });
	let keepBackup = false;
	try {
		await adapter.write(backup, snapshot);
		if (await adapter.read(backup) !== snapshot) {
			throw new Error(`TaskNotes recovery copy could not be verified: ${backup}`);
		}
		if (await adapter.read(path) !== original || file.path !== path) {
			throw new Error(`Task changed while preparing its write: ${path}`);
		}
		keepBackup = true;
		const result = await write();
		keepBackup = false;
		return result;
	} catch (error) {
		if (!keepBackup) throw error;
		try {
			if (file.path === path && await adapter.read(path) === "") {
				await vault.process(file, (current) =>
					file.path === path && current === "" ? original : current
				);
			}
			keepBackup = file.path !== path || await adapter.read(path) !== original;
		} catch (recoveryError) {
			throw Object.assign(new Error(
				`${String(error)}; task recovery failed. Previous contents saved in ${backup}`
			), { cause: error, recoveryError });
		}
		if (keepBackup) {
			throw Object.assign(new Error(
				`${String(error)}; previous task contents saved in ${backup}`
			), { cause: error });
		}
		throw error;
	} finally {
		if (!keepBackup) {
			try {
				await adapter.remove(backup);
			} catch (error) {
				logger.warn("Failed to remove task write recovery copy", {
					category: "persistence",
					operation: "remove-task-write-recovery-copy",
					details: { backup },
					error,
				});
			}
		}
	}
}

/**
 * Serialize TaskNotes mutations for one vault file while allowing unrelated
 * files to update concurrently. The queue complements Obsidian's serialized
 * read-modify-write APIs when a workflow uses different mutation APIs.
 */
export async function withVaultFileMutation<T>(
	file: TFile,
	mutation: () => Promise<T>
): Promise<T> {
	const previousMutation = vaultMutationQueues.get(file) ?? Promise.resolve();
	const currentMutation = previousMutation.catch(() => undefined).then(mutation);
	vaultMutationQueues.set(file, currentMutation);

	try {
		return await currentMutation;
	} finally {
		if (vaultMutationQueues.get(file) === currentMutation) {
			vaultMutationQueues.delete(file);
		}
	}
}

export async function processVaultFrontMatter(
	app: FrontmatterMutationApp,
	file: TFile,
	update: (frontmatter: Record<string, unknown>) => void
): Promise<void> {
	await withVaultFileMutation(file, () =>
		processVaultFrontMatterWithinMutation(app, file, update)
	);
}

export async function processVaultFrontMatterWithinMutation(
	app: FrontmatterMutationApp,
	file: TFile,
	update: (frontmatter: Record<string, unknown>) => void
): Promise<void> {
	// Obsidian reads frontmatter after a byte order mark, but processFrontMatter does
	// not find it there: it adds a second block above, which hides the task's
	// properties in the body. Drop the mark first so the existing block is edited.
	// vault.read() hides the mark, so check the raw file.
	const vault = app.vault;
	const path = file.path;
	const raw = vault?.adapter?.read ? await vault.adapter.read(path) : "";
	await withWriteRecovery(vault, file, path, raw, async () => {
		if (vault && BOM_BEFORE_FRONTMATTER.test(raw)) {
			await vault.process(file, (content) => content.replace(BOM_BEFORE_FRONTMATTER, ""));
		}
		await app.fileManager.processFrontMatter(file, update);
	});
}

export async function processVaultFile(
	app: FileContentMutationApp,
	file: TFile,
	update: (content: string) => string
): Promise<string> {
	return withVaultFileMutation(file, () => processVaultFileWithinMutation(app, file, update));
}

export async function processVaultFileWithinMutation(
	app: FileContentMutationApp,
	file: TFile,
	update: (content: string) => string
): Promise<string> {
	const vault = app.vault;
	const path = file.path;
	const raw = vault.adapter?.read ? await vault.adapter.read(path) : "";
	return withWriteRecovery(vault, file, path, raw, () => vault.process(file, update));
}

export async function createVaultFile(app: App, path: string, content: string): Promise<TFile> {
	return app.vault.create(path, content);
}

export async function createVaultBinaryFile(
	app: App,
	path: string,
	data: ArrayBuffer
): Promise<TFile> {
	return app.vault.createBinary(path, data);
}

export async function createVaultFolder(app: App, path: string): Promise<void> {
	await app.vault.createFolder(path);
}

export async function modifyVaultFile(app: App, file: TFile, content: string): Promise<void> {
	await withVaultFileMutation(file, () => app.vault.modify(file, content));
}

export async function renameVaultFile(app: App, file: TFile, newPath: string): Promise<void> {
	await app.vault.rename(file, newPath);
}
