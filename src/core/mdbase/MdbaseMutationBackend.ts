/**
 * Route TaskNotes' vault writes through the mdbase runtime when it manages the
 * vault's collection.
 *
 * TaskNotes funnels every write through `VaultMutationService`
 * (`processFrontMatter`, `process`, `create`, `modify`). When a backend is installed
 * and claims a file, each write becomes a replica intent, in every collection state
 * (local only, synced, synced end to end), over one client API:
 * - a frontmatter callback becomes a **field-level update**: the keys the callback
 *   set, and the keys it removed, with the values it read as the merge base. Two
 *   devices editing different fields of one task both win, instead of the last
 *   whole-file write;
 * - a whole-content callback, or `modify`, becomes a document replace with the read
 *   document as its base. The replica merges, or holds the file;
 * - `create` becomes a record create at the requested path.
 *
 * The replica publishes into the vault itself, using the editor fence when the note is
 * open. Each call resolves once the write has settled (see
 * {@link MdbaseWriteClient.settle}), so callers that re-read the file afterwards see
 * the new content, as with Obsidian's own APIs.
 *
 * Files outside the collection, or written while no runtime is attached, keep using
 * Obsidian's APIs unchanged.
 */

/** A record as TaskNotes needs it, with plain JSON-like frontmatter. */
export interface MdbaseRecord {
	readonly id: string;
	readonly path: string;
	readonly frontmatter: Record<string, unknown>;
	/** The whole source, when read with `document`. */
	readonly document?: string;
}

/** An accepted write (pending or confirmed). */
export interface MdbaseWrite {
	readonly mutation: string;
}

/**
 * What the backend needs from the mdbase client. The adapter over
 * `@mdbase-dev/sdk`'s `MdbaseClient` converts values to and from plain JSON.
 */
export interface MdbaseWriteClient {
	/** The collection-relative path for a vault path, or `null` if outside the collection. */
	collectionPath(vaultPath: string): string | null;
	/** Read a record by path, with frontmatter (and the document when asked). */
	find(path: string, opts: { document: boolean }): Promise<MdbaseRecord | null>;
	/** Field-level update, with `base` taken from `seen`. */
	update(
		seen: MdbaseRecord,
		changes: { patch: Record<string, unknown>; unset: string[] }
	): Promise<MdbaseWrite>;
	/** Replace the whole document, with `seen.document` as the merge base. */
	replaceDocument(seen: MdbaseRecord, document: string): Promise<MdbaseWrite>;
	/** Create a record from a complete document at `path`. */
	create(path: string, document: string): Promise<MdbaseWrite>;
	/**
	 * Resolve once the write is settled for TaskNotes' purposes: rejected (throws), or
	 * published into the vault file (the replica's publish, or the editor fence plus
	 * Obsidian's save) and indexed by Obsidian's vault (so `getFileByPath` finds a
	 * created file). It does not wait for log confirmation, so TaskNotes works the
	 * same offline.
	 */
	settle(write: MdbaseWrite, vaultPath: string): Promise<void>;
}

/** Result of a backend attempt: `false` means "not mine, use Obsidian's API". */
export type Handled<T> = { handled: true; value: T } | { handled: false };

const NOT_HANDLED = { handled: false } as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/** Structural equality for YAML-shaped values (objects compare as key sets). */
export function yamlEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((x, i) => yamlEqual(x, b[i]));
	}
	if (isPlainObject(a) && isPlainObject(b)) {
		const ka = Object.keys(a);
		const kb = Object.keys(b);
		return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && yamlEqual(a[k], b[k]));
	}
	return false;
}

function clone<T>(v: T): T {
	return typeof structuredClone === "function" ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
}

/** The top-level keys a frontmatter callback set or removed. */
export function frontmatterDiff(
	before: Record<string, unknown>,
	after: Record<string, unknown>
): { patch: Record<string, unknown>; unset: string[] } {
	const patch: Record<string, unknown> = {};
	const unset: string[] = [];
	for (const [k, v] of Object.entries(after)) {
		if (v === undefined) {
			if (k in before) unset.push(k);
		} else if (!(k in before) || !yamlEqual(before[k], v)) {
			patch[k] = v;
		}
	}
	for (const k of Object.keys(before)) if (!(k in after)) unset.push(k);
	return { patch, unset };
}

/** The mdbase write path for TaskNotes. */
export class MdbaseMutationBackend {
	constructor(private readonly client: MdbaseWriteClient) {}

	/** Whether this backend handles writes to `vaultPath`. */
	claims(vaultPath: string): boolean {
		return this.client.collectionPath(vaultPath) !== null;
	}

	/** `fileManager.processFrontMatter`, as a field-level update. */
	async processFrontMatter(
		vaultPath: string,
		update: (frontmatter: Record<string, unknown>) => void
	): Promise<Handled<void>> {
		const path = this.client.collectionPath(vaultPath);
		if (path === null) return NOT_HANDLED;
		const seen = await this.client.find(path, { document: false });
		if (!seen) return NOT_HANDLED; // not a record (yet): let Obsidian write it
		const working = clone(seen.frontmatter);
		update(working);
		const changes = frontmatterDiff(seen.frontmatter, working);
		if (Object.keys(changes.patch).length === 0 && changes.unset.length === 0) {
			return { handled: true, value: undefined };
		}
		const write = await this.client.update(seen, changes);
		await this.client.settle(write, vaultPath);
		return { handled: true, value: undefined };
	}

	/** `vault.process`, as a document replace with the read document as base. */
	async process(vaultPath: string, update: (content: string) => string): Promise<Handled<string>> {
		const path = this.client.collectionPath(vaultPath);
		if (path === null) return NOT_HANDLED;
		const seen = await this.client.find(path, { document: true });
		if (!seen || seen.document === undefined) return NOT_HANDLED;
		const next = update(seen.document);
		if (next === seen.document) return { handled: true, value: next };
		const write = await this.client.replaceDocument(seen, next);
		await this.client.settle(write, vaultPath);
		return { handled: true, value: next };
	}

	/** `vault.modify`: a document replace from whatever is current. */
	async modify(vaultPath: string, content: string): Promise<Handled<void>> {
		const r = await this.process(vaultPath, () => content);
		return r.handled ? { handled: true, value: undefined } : NOT_HANDLED;
	}

	/** `vault.create`. The caller looks up the `TFile` once this resolves. */
	async create(vaultPath: string, content: string): Promise<Handled<void>> {
		const path = this.client.collectionPath(vaultPath);
		if (path === null) return NOT_HANDLED;
		const write = await this.client.create(path, content);
		await this.client.settle(write, vaultPath);
		return { handled: true, value: undefined };
	}
}
