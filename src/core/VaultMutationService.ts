import type { App, DataAdapter, TFile } from "obsidian";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

type MutationVault = {
	configDir?: string;
	adapter?: Partial<Pick<DataAdapter, "read" | "write">>;
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

/** A leading byte order mark, which Obsidian's vault reads drop. */
const LEADING_BOM = /^\uFEFF+/;

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown): unknown {
	return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
}

/**
 * Run one write to an existing note. Obsidian's desktop writer truncates the
 * file before writing it, so a write that fails part way (for example with
 * ETIMEDOUT) can leave an empty note. The previous contents are kept in memory
 * and restored if the note is empty after the failure. A recovery copy is
 * written only when the note could not be confirmed as restored, so a
 * successful write costs no extra file I/O.
 */
async function withWriteRecovery<T>(
	vault: MutationVault | undefined,
	file: TFile,
	path: string,
	getOriginal: () => string | undefined,
	write: () => Promise<T>
): Promise<T> {
	try {
		return await write();
	} catch (error) {
		const original = getOriginal();
		if (!original || !vault) throw error;
		throw await recoverFailedWrite(vault, file, path, original, error);
	}
}

async function recoverFailedWrite(
	vault: MutationVault,
	file: TFile,
	path: string,
	original: string,
	error: unknown
): Promise<unknown> {
	const read = vault.adapter?.read?.bind(vault.adapter);
	if (!read) return error;

	let recoveryError: unknown;
	try {
		if (file.path === path && await read(path) === "") {
			await vault.process(file, (current) => (current === "" ? original : current));
		}
		const current = file.path === path ? await read(path) : undefined;
		if (
			current !== undefined &&
			current.replace(LEADING_BOM, "") === original.replace(LEADING_BOM, "")
		) {
			// Restored, or the failure happened before the note was touched.
			return error;
		}
	} catch (failure) {
		recoveryError = failure;
	}

	const recoveryPath = await saveRecoveryCopy(vault, path, original);
	if (!recoveryPath) {
		logger.error("Could not restore a note or save a recovery copy after a failed write", {
			category: "persistence",
			operation: "recover-failed-write",
			details: { path, previousContent: original },
			error,
		});
	}
	const detail = recoveryPath
		? `TaskNotes could not confirm the note was restored. Previous contents saved in ${recoveryPath}`
		: "TaskNotes could not confirm the note was restored or save a recovery copy. Previous contents were written to the developer console";
	return Object.assign(new Error(`${errorMessage(error)}; ${detail}`), {
		cause: error,
		code: errorCode(error),
		recoveryError,
		recoveryPath,
	});
}

async function saveRecoveryCopy(
	vault: MutationVault,
	path: string,
	content: string
): Promise<string | undefined> {
	const adapter = vault.adapter;
	if (!vault.configDir || !adapter?.write || !adapter.read) return undefined;
	const name = (path.split("/").pop() ?? "note").replace(/\.md$/i, "");
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const recoveryPath = `${vault.configDir}/tasknotes-recovery-${stamp}-${name}.md`;
	try {
		await adapter.write(recoveryPath, content);
		if (await adapter.read(recoveryPath) === content) return recoveryPath;
	} catch (failure) {
		logger.warn("Failed to save a recovery copy", {
			category: "persistence",
			operation: "save-recovery-copy",
			details: { path, recoveryPath },
			error: failure,
		});
	}
	return undefined;
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
	await withWriteRecovery(vault, file, path, () => raw, async () => {
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
	// Keep the contents Obsidian read for this write, without a second read.
	let original: string | undefined;
	return withWriteRecovery(vault, file, path, () => original, () =>
		vault.process(file, (content) => {
			original = content;
			return update(content);
		})
	);
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
