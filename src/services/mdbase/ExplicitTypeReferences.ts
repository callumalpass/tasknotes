import type { SafeMetadataAdapter } from "./SafeMetadata";
import YAML from "yaml";

type Provider = { path: string; type: Record<string, unknown> };

/** Read-only inventory before removing a provider; never migrate record membership implicitly. */
export async function findExplicitTypeReference(
	adapter: SafeMetadataAdapter,
	states: Provider[],
	options: { keys: string[]; excludedFolders: string[]; extensions: string[] }
): Promise<{ typePath: string; recordPath: string } | null> {
	const pending = [""];
	const visited = new Set<string>();
	while (pending.length) {
		const folder = pending.pop();
		if (folder === undefined || visited.has(folder)) continue;
		visited.add(folder);
		const listing = await adapter.list(folder);
		for (const child of listing.folders) {
			if (options.excludedFolders.some((excluded) => excluded && (child === excluded || child.startsWith(`${excluded}/`)))) continue;
			pending.push(child);
		}
		for (const path of listing.files) {
			const extension = path.split(".").pop()?.toLowerCase() ?? "";
			if (!options.extensions.includes(extension)) continue;
			const content = await adapter.read(path);
			const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
			const source = frontmatter ?? (extension === "base" || extension === "yaml" || extension === "json" ? content : null);
			if (!source) continue;
			let record: unknown;
			try { record = YAML.parse(source) as unknown; }
			catch { throw new Error(`Cannot check explicit type membership in ${path}; the file is malformed.`); }
			if (!record || typeof record !== "object" || Array.isArray(record)) continue;
			const fields = record as Record<string, unknown>;
			for (const state of states) {
				if (options.keys.some((key) => fields[key] === state.type.name || (Array.isArray(fields[key]) && fields[key].includes(state.type.name)))) {
					return { typePath: state.path, recordPath: path };
				}
			}
		}
	}
	return null;
}
