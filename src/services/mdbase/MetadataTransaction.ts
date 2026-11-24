import YAML from "yaml";
import { MDBASE_README, MDBASE_README_PATH, NEW_TYPES_FOLDER, NEW_CONTRACTS_FOLDER } from "./folders";
import { SafeMetadata, type MetadataSnapshot } from "./SafeMetadata";
import { isAppSettingsRecordPath, isAppSettingsMetadataPath } from "./appSettingsResources";

export const METADATA_PENDING = ".tasknotes/migrations/mdbase-v0.3-pending.json";
const SETTINGS_MANIFEST_PREFIX = ".tasknotes/migrations/mdbase-settings-";
type Journal = { snapshots: MetadataSnapshot[]; intendedWrites: MetadataSnapshot[] } & (
	{ backupFolder: string; settingsManifest?: never } | { settingsManifest: string; backupFolder?: never }
);

/** Stages the whole upgrade before committing; startup rolls back interrupted commits. */
export class MetadataTransaction {
	private staged: Map<string, MetadataSnapshot> | null = null;
	private compared = new Map<string, MetadataSnapshot>();
	private settingsEdits = new Set<string>();
	constructor(
		private readonly io: SafeMetadata,
		private readonly mkdir: (path: string) => Promise<void>,
		private readonly remove: (path: string) => Promise<void>,
	) {}

	stage(snapshot: MetadataSnapshot, content: string, settingsEdit = false): boolean {
		if (!this.staged) return false;
		const previous = this.compared.get(snapshot.path);
		if (previous && previous.content !== snapshot.content && this.staged.get(snapshot.path)?.content !== snapshot.content) {
			throw new Error(`Conflicting metadata snapshots: ${snapshot.path}`);
		}
		if (!this.compared.has(snapshot.path)) this.compared.set(snapshot.path, snapshot);
		if (settingsEdit) this.settingsEdits.add(snapshot.path);
		else this.settingsEdits.delete(snapshot.path);
		this.staged.set(snapshot.path, { path: snapshot.path, content });
		return true;
	}

	async run(work: () => Promise<void>): Promise<void> {
		if (await this.io.read(METADATA_PENDING) !== null) throw new Error(`Pending metadata recovery: ${METADATA_PENDING}`);
		this.staged = new Map();
		this.compared = new Map();
		this.settingsEdits = new Set();
		let writes: MetadataSnapshot[];
		try {
			await work();
			writes = [...this.staged.values()];
		} finally { this.staged = null; }
		if (!writes.some((write) => write.path === "mdbase.yaml")) {
			const config = { path: "mdbase.yaml", content: await this.io.read("mdbase.yaml") };
			writes.push(config);
			this.compared.set(config.path, config);
		}
		const snapshots: MetadataSnapshot[] = [];
		for (const write of writes) {
			const snapshot = this.compared.get(write.path);
			if (!snapshot) throw new Error(`Missing metadata snapshot: ${write.path}`);
			if (await this.io.read(write.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${write.path}`);
			snapshots.push(snapshot);
		}
		// A stage must not mask a change between its comparison and commit.
		const changed = writes.filter((write, i) => write.content !== snapshots[i].content);
		if (!changed.length) return;
		const keepBackup = snapshots.some(({ path, content }, index) =>
			content !== null && writes[index].content !== content && !this.settingsEdits.has(path)
		);
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const base = `${keepBackup ? ".tasknotes/migrations/mdbase-v0.3-" : SETTINGS_MANIFEST_PREFIX}${timestamp}`;
		const extension = keepBackup ? "" : ".json";
		let recoveryPath = `${base}${extension}`;
		let suffix = 2;
		while (await this.io.exists(recoveryPath)) recoveryPath = `${base}-${suffix++}${extension}`;
		const journal: Journal = keepBackup
			? { backupFolder: recoveryPath, snapshots, intendedWrites: writes }
			: { settingsManifest: recoveryPath, snapshots, intendedWrites: writes };
		const manifestPath = journal.settingsManifest ?? `${journal.backupFolder}/manifest.json`;
		const manifest = JSON.stringify(journal, null, 2);
		const recoveryLabel = keepBackup ? "backups" : "recovery manifest";
		await this.mkdir(manifestPath.split("/").slice(0, -1).join("/"));
		if (journal.backupFolder) {
			for (const snapshot of snapshots) {
				if (snapshot.content === null) continue;
				const path = `${journal.backupFolder}/${snapshot.path}.bak`;
				await this.mkdir(path.split("/").slice(0, -1).join("/"));
				await this.io.replace({ path, content: null }, snapshot.content);
			}
		}
		await this.io.replace({ path: manifestPath, content: null }, manifest);
		try {
			await this.io.replace({ path: METADATA_PENDING, content: null }, manifest);
			// Type before contract activation, collection configuration last.
			const ordered = [...changed].sort((a, b) => this.rank(a.path) - this.rank(b.path));
			const progress = snapshots.map((snapshot) => ({ ...snapshot }));
			for (const write of ordered) {
				await this.assertUnchanged(progress);
				await this.mkdir(write.path.split("/").slice(0, -1).join("/"));
				const snapshot = snapshots.find((item) => item.path === write.path);
				const entry = progress.find((item) => item.path === write.path);
				if (!snapshot || !entry || write.content === null) throw new Error(`Invalid metadata write: ${write.path}`);
				await this.io.replace(snapshot, write.content);
				entry.content = write.content;
			}
			await this.assertUnchanged(progress);
			await this.remove(METADATA_PENDING);
		} catch (error) {
			try { await this.restore(journal); await this.remove(METADATA_PENDING); }
			catch (recovery) { throw new Error(`Recovery blocked. Pending record: ${METADATA_PENDING}; ${recoveryLabel}: ${recoveryPath}; ${String(error)}; ${String(recovery)}`); }
			await this.clearSettingsManifest(journal, manifest);
			throw new Error(keepBackup
				? `Metadata upgrade rolled back. Backups: ${recoveryPath}; ${String(error)}`
				: `Metadata update rolled back. ${String(error)}`);
		}
		await this.clearSettingsManifest(journal, manifest);
	}

	private async clearSettingsManifest(journal: Journal, manifest: string): Promise<void> {
		if (journal.settingsManifest) await this.io.removeIfUnchanged(journal.settingsManifest, manifest).catch(() => false);
	}

	private async assertUnchanged(snapshots: MetadataSnapshot[]): Promise<void> {
		for (const snapshot of snapshots) {
			if (await this.io.read(snapshot.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
		}
	}

	private rank(path: string): number {
		if (path === "mdbase.yaml") return 4;
		// The settings record after its type and contracts.
		if (isAppSettingsRecordPath(path)) return 3;
		if (/(^|\/)(tasknotes\.task|tasknotes\.settings|mdbase\.app-settings)(\/[^/]+)?\.md$/.test(path)) return 2;
		if (path.endsWith(".json")) return 1;
		return 0;
	}

	async recover(): Promise<void> {
		await this.io.recoverSwaps();
		const raw = await this.io.read(METADATA_PENDING);
		if (raw === null) return;
		let recoveryPath = "unknown";
		let recoveryLabel = "backups";
		try {
			const journal = JSON.parse(raw) as Journal;
			recoveryPath = journal.settingsManifest ?? journal.backupFolder;
			if (journal.settingsManifest !== undefined) {
				recoveryLabel = "recovery manifest";
				if (journal.backupFolder !== undefined || typeof recoveryPath !== "string" || !recoveryPath.startsWith(SETTINGS_MANIFEST_PREFIX) ||
					!/^\d{4}-[\dTZ-]+\.json$/.test(recoveryPath.slice(SETTINGS_MANIFEST_PREFIX.length))) throw new Error("Invalid settings manifest");
			} else if (typeof recoveryPath !== "string" || !recoveryPath.startsWith(".tasknotes/migrations/mdbase-v0.3-")) {
				throw new Error("Invalid backup folder");
			}
			await this.io.assertPhysical(recoveryPath);
			if (!Array.isArray(journal.snapshots) || !Array.isArray(journal.intendedWrites)) throw new Error("Invalid journal entries");
			// The immutable manifest verifies the journal, including paths and intentions.
			const manifest = await this.io.read(journal.settingsManifest ?? `${recoveryPath}/manifest.json`);
			if (manifest !== JSON.stringify(journal, null, 2)) throw new Error("Journal does not match backup manifest");
			const configEntry = journal.snapshots.find((entry) => entry.path === "mdbase.yaml");
			const config = YAML.parse(configEntry?.content ?? journal.intendedWrites.find((entry) => entry.path === "mdbase.yaml")?.content ?? "settings: {}") as { settings?: { types_folder?: string; contracts_folder?: string } };
			const types = config.settings?.types_folder ?? "_types";
			const contracts = config.settings?.contracts_folder ?? "_contracts";
			const newReadme = configEntry?.content === null && types === NEW_TYPES_FOLDER && contracts === NEW_CONTRACTS_FOLDER &&
				journal.snapshots.find((entry) => entry.path === MDBASE_README_PATH)?.content === null &&
				journal.intendedWrites.find((entry) => entry.path === MDBASE_README_PATH)?.content === MDBASE_README;
			const schemaParent = contracts.split("/").slice(0, -1).join("/");
			const taskSchemas = schemaParent ? `${schemaParent}/_schemas/tasknotes/` : "_schemas/tasknotes/";
			for (const entry of [...journal.snapshots, ...journal.intendedWrites]) {
				if (typeof entry.path !== "string" || (entry.content !== null && typeof entry.content !== "string")) throw new Error("Invalid journal entry");
				await this.io.assertPhysical(entry.path);
				if (entry.path !== "mdbase.yaml" && !(newReadme && entry.path === MDBASE_README_PATH) && entry.path !== `${contracts}/tasknotes.task.md` &&
					!(entry.path.startsWith(`${contracts}/tasknotes.task/`) && entry.path.endsWith(".md")) &&
					!isAppSettingsMetadataPath(entry.path, contracts, types) &&
					!(/^_schemas\/tasknotes\/tasknotes-task(-binding)?\.schema\.json$/.test(entry.path) ||
						(entry.path.startsWith(taskSchemas) && /^tasknotes-task(-binding)?\.schema\.json$/.test(entry.path.slice(taskSchemas.length)))) &&
					!(entry.path.startsWith(`${types}/`) && entry.path.endsWith(".md"))) throw new Error(`Unsafe recovery target: ${entry.path}`);
			}
			if (journal.backupFolder) {
				for (const snapshot of journal.snapshots) {
					if (snapshot.content !== null && await this.io.read(`${recoveryPath}/${snapshot.path}.bak`) !== snapshot.content) throw new Error(`Backup mismatch: ${snapshot.path}`);
				}
			}
			await this.restore(journal);
			await this.remove(METADATA_PENDING);
			await this.clearSettingsManifest(journal, manifest);
		} catch (error) {
			throw new Error(`Pending record: ${METADATA_PENDING}; ${recoveryLabel}: ${recoveryPath}; blocked file: ${String(error)}. Review the recovery manifest before restoring metadata; do not replace changed files blindly.`);
		}
	}

	private async restore(journal: Journal): Promise<void> {
		const current = new Map<string, string | null>();
		for (const snapshot of journal.snapshots) {
			const content = await this.io.read(snapshot.path);
			current.set(snapshot.path, content);
			if (content !== snapshot.content && content !== journal.intendedWrites.find((write) => write.path === snapshot.path)?.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
		}
		for (const snapshot of [...journal.snapshots].reverse()) {
			const content = current.get(snapshot.path) ?? null;
			if (content === snapshot.content) continue;
			if (snapshot.content === null) {
				// Created by this upgrade: remove it while it still holds what was written.
				if (content !== null) await this.io.removeIfUnchanged(snapshot.path, content);
				continue;
			}
			await this.io.replace({ path: snapshot.path, content }, snapshot.content);
		}
		await this.io.removeAbandonedStages(journal.snapshots.map(({ path }) => path));
	}
}
