import { Platform } from "obsidian";
import { METADATA_SWAPS, recoverMetadataSwap, type SwapJournal } from "./MetadataSwap";

export type MetadataSnapshot = { path: string; content: string | null };
export interface SafeMetadataAdapter {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	/** Atomic move to an empty destination; occupied destinations must fail. */
	rename?: (from: string, to: string) => Promise<void>;
	remove(path: string): Promise<void>;
	list(path: string): Promise<{ files: string[]; folders: string[] }>;
	mkdir?: (path: string) => Promise<void>;
	getBasePath?: () => string;
}

/** One queue per service: migrations, cleanup and settings writes share it. */
export class MetadataQueue {
	private tail: Promise<unknown> = Promise.resolve();
	run<T>(work: () => Promise<T>): Promise<T> {
		const next = this.tail.catch(() => undefined).then(work);
		this.tail = next;
		return next;
	}
}

/** Temp files are siblings: a failed write never tears the active metadata. */
export class SafeMetadata {
	private sequence = 0;
	constructor(private readonly adapter: SafeMetadataAdapter, private readonly mkdir?: (path: string) => Promise<void>) {}

	private async native() {
		if (typeof this.adapter.getBasePath !== "function") return null;
		if (Platform.isDesktop) {
			// Electron's renderer cannot resolve import("node:...") URLs.
			const fs = window.require("node:fs/promises") as typeof import("node:fs/promises");
			return { fs, root: this.adapter.getBasePath() };
		}
		return null;
	}

	async assertPhysical(path: string): Promise<void> {
		if (!path || path.includes("\\") || path.includes("\0") || path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").some((part) => part === ".." || part === ".")) {
			throw new Error(`Unsafe metadata path: ${path}`);
		}
		const native = await this.native();
		if (!native) return;
		let current = native.root;
		for (const part of path.split("/")) {
			current += `/${part}`;
			try {
				const stat = await native.fs.lstat(current);
				if (stat.isSymbolicLink()) throw new Error(`Symlinked metadata path: ${path}. Use a physical directory inside the vault.`);
			} catch (error) {
				if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
				throw error;
			}
		}
	}

	async exists(path: string): Promise<boolean> {
		await this.assertPhysical(path);
		return this.adapter.exists(path);
	}

	async read(path: string): Promise<string | null> {
		await this.assertPhysical(path);
		return await this.adapter.exists(path) ? await this.adapter.read(path) : null;
	}

	private token(): string {
		return `${Date.now()}-${++this.sequence}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
	}

	private async flushDirectory(path: string): Promise<void> {
		const native = await this.native();
		if (!native || process.platform === "win32") return;
		const parent = path.split("/").slice(0, -1).join("/");
		const handle = await native.fs.open(`${native.root}/${parent || "."}`, "r");
		try { await handle.sync(); } finally { await handle.close(); }
	}

	private async stage(path: string, content: string, original?: string): Promise<void> {
		await this.assertPhysical(path);
		if (await this.adapter.exists(path)) throw new Error(`Metadata stage already exists: ${path}`);
		await this.adapter.write(path, content);
		if (await this.adapter.read(path) !== content) throw new Error(`Metadata staging verification failed: ${path}`);
		const native = await this.native();
		if (native) {
			if (original) {
				const stat = await native.fs.stat(`${native.root}/${original}`);
				await native.fs.chmod(`${native.root}/${path}`, stat.mode & 0o777);
			}
			const handle = await native.fs.open(`${native.root}/${path}`, "r+");
			try { await handle.sync(); } finally { await handle.close(); }
		}
	}

	private async ensureFolder(path: string): Promise<void> {
		await this.assertPhysical(path);
		if (this.mkdir) return this.mkdir(path);
		if (!this.adapter.mkdir) throw new Error(`Metadata swap journal directory unavailable: ${path}`);
		const parts = path.split("/");
		for (let i = 1; i <= parts.length; i++) {
			const folder = parts.slice(0, i).join("/");
			if (!await this.exists(folder)) await this.adapter.mkdir(folder);
		}
	}

	private async moveEmpty(from: string, to: string): Promise<void> {
		await this.assertPhysical(from); await this.assertPhysical(to);
		if (!this.adapter.rename) throw new Error(`Safe metadata move unavailable: ${from}`);
		if (await this.read(to) !== null) throw new Error(`Concurrent metadata change: ${to}`);
		await this.adapter.rename(from, to);
		await this.flushDirectory(from);
		await this.flushDirectory(to);
	}

	private async activate(stage: string, path: string): Promise<void> {
		await this.assertPhysical(path);
		const native = await this.native();
		if (native) {
			// link is an atomic no-clobber publication, unlike Node's overwrite rename.
			await native.fs.link(`${native.root}/${stage}`, `${native.root}/${path}`);
			await this.flushDirectory(path);
			await this.adapter.remove(stage);
		} else {
			await this.moveEmpty(stage, path);
		}
	}

	private async create(path: string, content: string): Promise<void> {
		const temp = `${path}.tasknotes-stage-${this.token()}`;
		try {
			await this.stage(temp, content);
			await this.activate(temp, path);
			if (await this.read(path) !== content) throw new Error(`Metadata read-back failed: ${path}`);
		} finally {
			if (await this.adapter.exists(temp)) await this.adapter.remove(temp);
		}
	}

	private swapIO() {
		return {
			read: (path: string) => this.read(path),
			create: (path: string, content: string) => this.create(path, content),
			remove: (path: string) => this.adapter.remove(path),
			assertPhysical: (path: string) => this.assertPhysical(path),
		};
	}

	async recoverSwaps(): Promise<void> {
		if (!await this.exists(METADATA_SWAPS)) return;
		const listing = await this.adapter.list(METADATA_SWAPS);
		for (const path of listing.files.filter((path) => path.endsWith(".json")).sort()) {
			const raw = await this.read(path);
			if (raw === null) continue;
			try { await recoverMetadataSwap(this.swapIO(), path, JSON.parse(raw) as SwapJournal); }
			catch (error) { throw new Error(`Pending metadata swap: ${path}; ${String(error)}`); }
		}
	}

	async replace(snapshot: MetadataSnapshot, content: string): Promise<void> {
		await this.assertPhysical(snapshot.path);
		if (await this.read(snapshot.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
		if (snapshot.content === content) return;
		if (!this.adapter.rename) throw new Error(`Safe metadata move unavailable: ${snapshot.path}`);
		if (snapshot.content === null) return this.create(snapshot.path, content);
		const native = await this.native();
		if (native) await native.fs.access(`${native.root}/${snapshot.path}`, 2);
		await this.ensureFolder(METADATA_SWAPS);
		const token = this.token();
		const stage = `${snapshot.path}.tasknotes-stage-${token}`;
		const recovery = `${METADATA_SWAPS}/${token}/${snapshot.path}`;
		await this.ensureFolder(recovery.split("/").slice(0, -1).join("/"));
		const pending = `${METADATA_SWAPS}/${token}.json`;
		const journal: SwapJournal = { version: 1, snapshot, content, stage, recovery };
		let journaled = false;
		try {
			await this.stage(stage, content, snapshot.path);
			if (await this.read(snapshot.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
			await this.create(pending, JSON.stringify(journal, null, 2));
			journaled = true;
			// Capture the ACTUAL revision at the move boundary, not a stale copy.
			await this.moveEmpty(snapshot.path, recovery);
			if (await this.read(recovery) !== snapshot.content) {
				const actual = await this.read(recovery);
				if (actual !== null && await this.read(snapshot.path) === null) await this.create(snapshot.path, actual);
				throw new Error(`Concurrent metadata change: ${snapshot.path}; retained at ${recovery}; pending record: ${pending}`);
			}
			await this.activate(stage, snapshot.path);
			if (await this.read(snapshot.path) !== content) throw new Error(`Metadata read-back failed: ${snapshot.path}`);
			await this.adapter.remove(pending);
		} catch (error) {
			if (journaled) {
				try { await recoverMetadataSwap(this.swapIO(), pending, journal); }
				catch (recoveryError) { throw new Error(`Concurrent metadata change or interrupted swap: ${snapshot.path}; retained at ${recovery}; pending record: ${pending}; ${String(error)}; ${String(recoveryError)}`); }
			}
			throw error;
		} finally {
			// A live journal owns the verified stage; keep it for startup recovery.
			if (!await this.adapter.exists(pending) && await this.adapter.exists(stage)) await this.adapter.remove(stage);
		}
	}

	/** Move, never copy/delete. Even an edit during rename survives in recovery storage. */
	async move(snapshot: MetadataSnapshot, destination: string): Promise<void> {
		if (await this.read(snapshot.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
		await this.moveEmpty(snapshot.path, destination);
		if (await this.read(destination) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}; retained at ${destination}`);
	}
}
