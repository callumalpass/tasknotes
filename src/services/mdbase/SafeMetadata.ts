import { Platform } from "obsidian";

export type MetadataSnapshot = { path: string; content: string | null };
export interface SafeMetadataAdapter {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	rename?: (from: string, to: string) => Promise<void>;
	remove(path: string): Promise<void>;
	list(path: string): Promise<{ files: string[]; folders: string[] }>;
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
	constructor(private readonly adapter: SafeMetadataAdapter) {}

	private async native() {
		if (typeof this.adapter.getBasePath !== "function") return null;
		if (Platform.isDesktop) {
			// Electron's renderer cannot resolve import("node:...") URLs.
			// Obsidian supplies its desktop Node loader on window instead.
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

	async replace(snapshot: MetadataSnapshot, content: string, fallback?: () => Promise<void>): Promise<void> {
		await this.assertPhysical(snapshot.path);
		const native = await this.native();
		if (native && snapshot.content !== null) await native.fs.access(`${native.root}/${snapshot.path}`, 2);
		if (await this.read(snapshot.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
		if (snapshot.content === content) return;
		if (typeof this.adapter.rename !== "function") {
			if (!fallback) throw new Error(`Atomic replacement unavailable: ${snapshot.path}`);
			await fallback();
		} else {
			const temp = `${snapshot.path}.tasknotes-stage-${Date.now()}-${++this.sequence}`;
			try {
				await this.adapter.write(temp, content);
				if (await this.adapter.read(temp) !== content) throw new Error(`Metadata staging verification failed: ${snapshot.path}`);
				if (native) {
					if (snapshot.content !== null) {
						const stat = await native.fs.stat(`${native.root}/${snapshot.path}`);
						await native.fs.chmod(`${native.root}/${temp}`, stat.mode & 0o777);
					}
					const handle = await native.fs.open(`${native.root}/${temp}`, "r+");
					try { await handle.sync(); } finally { await handle.close(); }
				}
				if (await this.read(snapshot.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
				if (native && snapshot.content === null) {
					// Native no-clobber activation: a newly arriving file wins.
					await native.fs.link(`${native.root}/${temp}`, `${native.root}/${snapshot.path}`);
					await this.adapter.remove(temp);
				} else if (native) {
					// Obsidian's adapter deliberately refuses an occupied destination;
					// the native rename primitive atomically replaces it on desktop.
					await native.fs.rename(`${native.root}/${temp}`, `${native.root}/${snapshot.path}`);
				} else {
					await this.adapter.rename(temp, snapshot.path);
				}
				if (native && process.platform !== "win32") {
					const parent = snapshot.path.split("/").slice(0, -1).join("/");
					const handle = await native.fs.open(`${native.root}/${parent || "."}`, "r");
					try { await handle.sync(); } finally { await handle.close(); }
				}
			} finally {
				if (await this.adapter.exists(temp)) await this.adapter.remove(temp);
			}
		}
		if (await this.read(snapshot.path) !== content) throw new Error(`Metadata read-back failed: ${snapshot.path}`);
	}

	/** Move, never copy/delete. Even an edit during rename survives in recovery storage. */
	async move(snapshot: MetadataSnapshot, destination: string): Promise<void> {
		await this.assertPhysical(destination);
		if (typeof this.adapter.rename !== "function") throw new Error(`Safe metadata move unavailable: ${snapshot.path}`);
		if (await this.adapter.exists(destination)) throw new Error(`Backup already exists: ${destination}`);
		if (await this.read(snapshot.path) !== snapshot.content) throw new Error(`Concurrent metadata change: ${snapshot.path}`);
		await this.adapter.rename(snapshot.path, destination);
		const moved = await this.read(destination);
		if (moved !== snapshot.content) {
			// Never move it back over a newly arriving source. The actual bytes are
			// retained here, and the caller stops rather than claiming success.
			throw new Error(`Concurrent metadata change: ${snapshot.path}; retained at ${destination}`);
		}
	}
}
