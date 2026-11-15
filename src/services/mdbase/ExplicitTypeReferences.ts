import type { SafeMetadataAdapter } from "./SafeMetadata";
import { recordDocument } from "./frontmatter";
import { collectionScope, explicitTypeNames, isCollectionRecord } from "./collectionMembership";

type Provider = { path: string; type: Record<string, unknown> };

/** Read-only engine-scoped inventory; uncertainty must preserve the provider. */
export async function findExplicitTypeReference(
	adapter: SafeMetadataAdapter,
	states: Provider[],
	config: unknown
): Promise<{ typePath: string; recordPath: string } | null> {
	const scope = collectionScope(config);
	const pending = [""];
	const visited = new Set<string>();
	while (pending.length) {
		const folder = pending.pop();
		if (folder === undefined || visited.has(folder)) continue;
		visited.add(folder);
		const listing = await adapter.list(folder);
		for (const child of listing.folders) {
			if (!scope.contains(`${child}/`) || await adapter.exists(`${child}/mdbase.yaml`)) continue;
			pending.push(child);
		}
		for (const path of listing.files) {
			if (!await isCollectionRecord(adapter, path, scope)) continue;
			const content = await adapter.read(path);
			let fields: Record<string, unknown>;
			try { fields = recordDocument(content).document.toJS() as Record<string, unknown>; }
			catch { throw new Error(`Cannot check explicit type membership in ${path}; the file is malformed. The provider was kept.`); }
			const names = explicitTypeNames(fields, scope.keys);
			for (const state of states) {
				if (names.includes(String(state.type.name).toLowerCase())) return { typePath: state.path, recordPath: path };
			}
		}
	}
	return null;
}
