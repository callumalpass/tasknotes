import type { App, TFile } from "obsidian";
import type { MdbaseMutationBackend } from "./mdbase/MdbaseMutationBackend";

let mdbaseBackend: MdbaseMutationBackend | null = null;

/**
 * Install (or remove, with `null`) the mdbase write path. While installed, writes
 * to files in the mdbase collection go through the runtime as intents; everything
 * else keeps using Obsidian's APIs.
 */
export function setMdbaseMutationBackend(backend: MdbaseMutationBackend | null): void {
	mdbaseBackend = backend;
}

/** The installed mdbase write path, if any. */
export function getMdbaseMutationBackend(): MdbaseMutationBackend | null {
	return mdbaseBackend;
}

type FrontmatterMutationApp = {
	fileManager: {
		processFrontMatter(
			file: TFile,
			update: (frontmatter: Record<string, unknown>) => void
		): Promise<void>;
	};
};

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
	if (mdbaseBackend?.claims(file.path)) {
		const r = await mdbaseBackend.processFrontMatter(file.path, update);
		if (r.handled) return;
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
	if (mdbaseBackend?.claims(file.path)) {
		const r = await mdbaseBackend.process(file.path, update);
		if (r.handled) return r.value;
	}
	return app.vault.process(file, update);
}

export async function createVaultFile(app: App, path: string, content: string): Promise<TFile> {
	if (mdbaseBackend?.claims(path)) {
		const r = await mdbaseBackend.create(path, content);
		if (r.handled) {
			const file = app.vault.getFileByPath(path);
			if (file) return file;
			throw new Error(`mdbase created ${path}, but Obsidian has not indexed it yet`);
		}
	}
	return app.vault.create(path, content);
}

export async function createVaultFolder(app: App, path: string): Promise<void> {
	await app.vault.createFolder(path);
}

export async function modifyVaultFile(app: App, file: TFile, content: string): Promise<void> {
	await withVaultFileMutation(file, async () => {
		if (mdbaseBackend?.claims(file.path)) {
			const r = await mdbaseBackend.modify(file.path, content);
			if (r.handled) return;
		}
		await app.vault.modify(file, content);
	});
}

export async function renameVaultFile(app: App, file: TFile, newPath: string): Promise<void> {
	await app.vault.rename(file, newPath);
}
