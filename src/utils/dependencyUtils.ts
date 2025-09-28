import { App, TFile } from "obsidian";
import { splitListPreservingLinksAndQuotes } from "./stringSplit";

export interface DependencyResolution {
	path: string;
	file: TFile | null;
}

export function parseDependencyInput(value: string): string[] {
	if (!value) {
		return [];
	}

	const entries: string[] = [];
	const lines = value.split(/\r?\n/);
	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) {
			continue;
		}

		const parts = splitListPreservingLinksAndQuotes(trimmedLine);
		for (const part of parts) {
			const token = part.trim();
			if (token.length === 0) {
				continue;
			}
			entries.push(token);
		}
	}

	const seen = new Set<string>();
	const result: string[] = [];
	for (const entry of entries) {
		if (!seen.has(entry)) {
			seen.add(entry);
			result.push(entry);
		}
	}
	return result;
}

export function resolveDependencyEntry(
	app: App,
	sourcePath: string,
	entry: string
): DependencyResolution | null {
	if (!entry) {
		return null;
	}

	const trimmed = entry.trim();
	if (!trimmed) {
		return null;
	}

	let target = trimmed;
	if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
		const inner = trimmed.slice(2, -2).trim();
		const pipeIndex = inner.indexOf("|");
		target = pipeIndex >= 0 ? inner.substring(0, pipeIndex).trim() : inner;
	}

	if (!target) {
		return null;
	}

	const resolved = app.metadataCache.getFirstLinkpathDest(target, sourcePath);
	if (resolved instanceof TFile) {
		return { path: resolved.path, file: resolved };
	}

	const fallback = app.vault.getAbstractFileByPath(target);
	if (fallback instanceof TFile) {
		return { path: fallback.path, file: fallback };
	}

	return null;
}

export function formatDependencyLink(app: App, sourcePath: string, targetPath: string): string {
	const target = app.vault.getAbstractFileByPath(targetPath);
	if (target instanceof TFile) {
		const linktext = app.metadataCache.fileToLinktext(target, sourcePath, false);
		return `[[${linktext}]]`;
	}

	const basename = targetPath.split("/").pop() || targetPath;
	return `[[${basename.replace(/\.md$/i, "")}]]`;
}
