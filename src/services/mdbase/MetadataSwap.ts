import type { MetadataSnapshot } from "./SafeMetadata";

export const METADATA_SWAPS = ".tasknotes/migrations/metadata-swaps";
export interface SwapJournal {
	version: 1;
	snapshot: MetadataSnapshot;
	content: string;
	stage: string;
	recovery: string;
}
export interface SwapIO {
	read(path: string): Promise<string | null>;
	create(path: string, content: string): Promise<void>;
	remove(path: string): Promise<void>;
	assertPhysical(path: string): Promise<void>;
}

/** Immutable write-ahead record: no progress rewrite can tear or displace it. */
export async function recoverMetadataSwap(io: SwapIO, path: string, journal: SwapJournal): Promise<void> {
	const { snapshot, recovery, stage, content } = journal;
	if (journal.version !== 1 || typeof snapshot?.path !== "string" || typeof snapshot.content !== "string" ||
		typeof content !== "string" || typeof stage !== "string" || typeof recovery !== "string" ||
		!stage.startsWith(`${snapshot.path}.tasknotes-stage-`) ||
		recovery !== `${METADATA_SWAPS}/${stage.slice(`${snapshot.path}.tasknotes-stage-`.length)}/${snapshot.path}` ||
		path !== `${METADATA_SWAPS}/${stage.slice(`${snapshot.path}.tasknotes-stage-`.length)}.json` ||
		!/^[-a-z0-9]+$/.test(stage.slice(`${snapshot.path}.tasknotes-stage-`.length))) {
		throw new Error(`Invalid metadata swap journal: ${path}`);
	}
	for (const target of [snapshot.path, stage, recovery]) await io.assertPhysical(target);
	const staged = await io.read(stage);
	if (staged !== null && staged !== content) throw new Error(`Metadata staging verification failed: ${stage}; pending record: ${path}`);
	const moved = await io.read(recovery);
	let active = await io.read(snapshot.path);
	if (active === null && moved !== null) {
		// Copy through a verified stage; retain the actual displaced revision even
		// when restoring it. A sync arrival wins the no-clobber publication.
		await io.create(snapshot.path, moved);
		active = await io.read(snapshot.path);
	}
	if (active !== snapshot.content && !(moved === snapshot.content && active === content)) {
		throw new Error(`Concurrent metadata change: ${snapshot.path}; retained at ${recovery}; pending record: ${path}`);
	}
	// An explicitly restored original also resolves a conflict. Never remove
	// the moved actual revision, even when it differs from the expected bytes.
	if (await io.read(stage) !== null) await io.remove(stage);
	await io.remove(path);
}
