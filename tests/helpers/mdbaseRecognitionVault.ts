import { TFile } from "obsidian";

/** Obsidian-compatible indexed vault, including metadata arrival events. */
export function recognitionVault(entries: Record<string, string>) {
	const files = new Map(Object.entries(entries));
	const folders = new Set<string>();
	const callbacks = new Map<string, Array<(file: { path: string }) => void>>();
	const parents = (path: string) => {
		let current = "";
		for (const part of path.split("/").slice(0, -1)) {
			current = current ? `${current}/${part}` : part;
			folders.add(current);
		}
	};
	for (const path of files.keys()) parents(path);
	const arrive = (path: string, content: string) => {
		files.set(path, content);
		parents(path);
		for (const callback of callbacks.get("create") ?? []) callback({ path });
	};
	const vault = {
		adapter: {
			exists: async (path: string) => files.has(path) || folders.has(path),
			read: async (path: string) => {
				const content = files.get(path);
				if (content === undefined) throw new Error(`Missing file: ${path}`);
				return content;
			},
			write: async (path: string, content: string) => { files.set(path, content); parents(path); },
			rename: async (from: string, to: string) => {
				const content = files.get(from);
				if (content === undefined) throw new Error(`Missing file: ${from}`);
				files.set(to, content); files.delete(from); parents(to);
			},
			remove: async (path: string) => { files.delete(path); },
			list: async (folder: string) => {
				const prefix = `${folder}/`;
				const direct = (path: string) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/");
				return { files: [...files.keys()].filter(direct), folders: [...folders].filter(direct) };
			},
		},
		on: (event: string, callback: (file: { path: string }) => void) => {
			callbacks.set(event, [...(callbacks.get(event) ?? []), callback]);
			return {};
		},
		getAbstractFileByPath: (path: string) => files.has(path) ? new TFile(path) : null,
		process: async (file: { path: string }, update: (content: string) => string) => {
			const next = update(files.get(file.path)!);
			files.set(file.path, next);
			return next;
		},
		create: async (path: string, content: string) => {
			if (files.has(path)) throw new Error(`File exists: ${path}`);
			files.set(path, content);
			parents(path);
			return { path };
		},
		createFolder: async (path: string) => { folders.add(path); parents(`${path}/x`); },
	};
	return { files, vault, arrive };
}
