import type { App } from "obsidian";
import { createVaultFile, createVaultFolder } from "../VaultMutationService";

/** Create and verify a collision-safe recovery copy before any approved mutation. */
export async function backupCollectionFile(app: App, path: string, content: string): Promise<string> {
	const vault = app.vault;
	const root = ".tasknotes/migrations";
	for (const folder of [".tasknotes", root]) {
		if (!(await vault.adapter.exists(folder))) await createVaultFolder(app, folder);
	}
	const base = `${root}/collection-${new Date().toISOString().replace(/[:.]/g, "-")}`;
	let folder = base;
	let index = 0;
	while (await vault.adapter.exists(folder)) folder = `${base}-${++index}`;
	await createVaultFolder(app, folder);
	const backup = `${folder}/${path.replace(/\//g, "__")}.bak`;
	await createVaultFile(app, backup, content);
	if ((await vault.adapter.read(backup)) !== content) throw new Error(`Backup verification failed: ${backup}`);
	return backup;
}
