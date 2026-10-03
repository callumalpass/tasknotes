import YAML from "yaml";
import { SafeMetadata, type MetadataSnapshot } from "./SafeMetadata";

export const METADATA_PENDING = ".tasknotes/migrations/mdbase-v0.3-pending.json";
type Journal = { backupFolder: string; snapshots: MetadataSnapshot[]; intendedWrites: MetadataSnapshot[] };

/** Stages the whole upgrade before committing; startup rolls back interrupted commits. */
export class MetadataTransaction {
	private staged: Map<string, MetadataSnapshot> | null = null;
	private compared = new Map<string, MetadataSnapshot>();
	constructor(
		private readonly io: SafeMetadata,
		private readonly mkdir: (path: string) => Promise<void>,
		private readonly remove: (path: string) => Promise<void>,
	) {}

	stage(snapshot: MetadataSnapshot, content: string): boolean {
		if (!this.staged) return false;
		const previous = this.compared.get(snapshot.path);
		if (previous && previous.content !== snapshot.content) throw new Error(`Conflicting metadata snapshots: ${snapshot.path}`);
		if (!this.compared.has(snapshot.path)) this.compared.set(snapshot.path, snapshot);
		this.staged.set(snapshot.path, { path: snapshot.path, content });
		return true;
	}

	async run(work: () => Promise<void>): Promise<void> {
		if (await this.io.read(METADATA_PENDING) !== null) throw new Error(`Pending metadata recovery: ${METADATA_PENDING}`);
		this.staged = new Map();
		this.compared = new Map();
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
		const base = `.tasknotes/migrations/mdbase-v0.3-${new Date().toISOString().replace(/[:.]/g, "-")}`;
		let backupFolder = base;
		let suffix = 2;
		while (await this.io.exists(backupFolder)) backupFolder = `${base}-${suffix++}`;
		await this.mkdir(backupFolder);
		const journal: Journal = { backupFolder, snapshots, intendedWrites: writes };
		for (const snapshot of snapshots) {
			if (snapshot.content === null) continue;
			const path = `${backupFolder}/${snapshot.path}.bak`;
			await this.mkdir(path.split("/").slice(0, -1).join("/"));
			await this.io.replace({ path, content: null }, snapshot.content);
		}
		await this.io.replace({ path: `${backupFolder}/manifest.json`, content: null }, JSON.stringify(journal, null, 2));
		try {
			await this.io.replace({ path: METADATA_PENDING, content: null }, JSON.stringify(journal, null, 2));
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
			catch (recovery) { throw new Error(`Recovery blocked. Pending record: ${METADATA_PENDING}; backups: ${backupFolder}; ${String(recovery)}`); }
			throw new Error(`Metadata upgrade rolled back. Backups: ${backupFolder}; ${String(error)}`);
		}
	}

	private async assertUnchanged(snapshots: MetadataSnapshot[]): Promise<void> {
		for (const snapshot of snapshots) {
			if (await this.io.read(snapshot.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
		}
	}

	private rank(path: string): number {
		if (path === "mdbase.yaml") return 3;
		if (path.endsWith("/tasknotes.task.md")) return 2;
		if (path.endsWith(".json")) return 1;
		return 0;
	}

	async recover(): Promise<void> {
		const raw = await this.io.read(METADATA_PENDING);
		if (raw === null) return;
		let backupFolder = "unknown";
		try {
			const journal = JSON.parse(raw) as Journal;
			backupFolder = journal.backupFolder;
			if (typeof backupFolder !== "string" || !backupFolder.startsWith(".tasknotes/migrations/mdbase-v0.3-")) throw new Error("Invalid backup folder");
			await this.io.assertPhysical(backupFolder);
			if (!Array.isArray(journal.snapshots) || !Array.isArray(journal.intendedWrites)) throw new Error("Invalid journal entries");
			// The immutable manifest verifies the journal, including paths and intentions.
			const manifest = await this.io.read(`${backupFolder}/manifest.json`);
			if (manifest !== JSON.stringify(journal, null, 2)) throw new Error("Journal does not match backup manifest");
			const configEntry = journal.snapshots.find((entry) => entry.path === "mdbase.yaml");
			const config = YAML.parse(configEntry?.content ?? "settings: {}") as { settings?: { types_folder?: string; contracts_folder?: string } };
			const types = config.settings?.types_folder ?? "_types";
			const contracts = config.settings?.contracts_folder ?? "_contracts";
			for (const entry of [...journal.snapshots, ...journal.intendedWrites]) {
				if (typeof entry.path !== "string" || (entry.content !== null && typeof entry.content !== "string")) throw new Error("Invalid journal entry");
				await this.io.assertPhysical(entry.path);
				if (entry.path !== "mdbase.yaml" && entry.path !== `${contracts}/tasknotes.task.md` &&
					!(/^_schemas\/tasknotes\/tasknotes-task(-binding)?\.schema\.json$/.test(entry.path)) &&
					!(entry.path.startsWith(`${types}/`) && entry.path.endsWith(".md"))) throw new Error(`Unsafe recovery target: ${entry.path}`);
			}
			for (const snapshot of journal.snapshots) {
				if (snapshot.content !== null && await this.io.read(`${backupFolder}/${snapshot.path}.bak`) !== snapshot.content) throw new Error(`Backup mismatch: ${snapshot.path}`);
			}
			await this.restore(journal);
			await this.remove(METADATA_PENDING);
		} catch (error) {
			throw new Error(`Pending record: ${METADATA_PENDING}; backups: ${backupFolder}; blocked file: ${String(error)}. Review the backup manifest before restoring metadata; do not replace changed files blindly.`);
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
			if (snapshot.content === null || current.get(snapshot.path) === snapshot.content) continue;
			await this.io.replace({ path: snapshot.path, content: current.get(snapshot.path) ?? null }, snapshot.content);
		}
	}
}
