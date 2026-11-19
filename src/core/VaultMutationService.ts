import type { App, TFile } from "obsidian";

type FrontmatterMutationApp = {
	fileManager: {
		processFrontMatter(
			file: TFile,
			update: (frontmatter: Record<string, unknown>) => void
		): Promise<void>;
	};
	vault?: {
		adapter?: { read?(path: string): Promise<string> };
		process(file: TFile, update: (content: string) => string): Promise<string>;
	};
};

/** A byte order mark before the opening frontmatter fence. */
const BOM_BEFORE_FRONTMATTER = /^\uFEFF+(?=---\r?\n)/;

type FileContentMutationApp = {
	vault: {
		process(file: TFile, update: (content: string) => string): Promise<string>;
	};
};

const vaultMutationQueues = new WeakMap<TFile, Promise<unknown>>();

/**
 * Serialize TaskNotes mutations for one vault file while allowing unrelated
 * files to update concurrently. The queue complements Obsidian's atomic write
 * APIs when a workflow must fall back between different mutation APIs.
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
	const raw = vault?.adapter?.read ? await vault.adapter.read(file.path) : "";
	if (vault && BOM_BEFORE_FRONTMATTER.test(raw)) {
		await vault.process(file, (content) => content.replace(BOM_BEFORE_FRONTMATTER, ""));
	}
	await app.fileManager.processFrontMatter(file, update);
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
	return app.vault.process(file, update);
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
