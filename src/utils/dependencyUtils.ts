import { App, TFile, parseLinktext } from "obsidian";
import type { TaskDependency, TaskDependencyRelType } from "../types";
import { splitListPreservingLinksAndQuotes } from "./stringSplit";
import { generateLink, parseLinkToPath } from "./linkUtils";

export const DEFAULT_DEPENDENCY_RELTYPE: TaskDependencyRelType = "FINISHTOSTART";

const VALID_RELATIONSHIP_TYPES: TaskDependencyRelType[] = [
	"FINISHTOSTART",
	"FINISHTOFINISH",
	"STARTTOSTART",
	"STARTTOFINISH",
];

export function isValidDependencyRelType(value: string): value is TaskDependencyRelType {
	return VALID_RELATIONSHIP_TYPES.includes(value as TaskDependencyRelType);
}

export function extractDependencyUid(entry: TaskDependency | string): string {
	return typeof entry === "string" ? entry : entry.uid;
}

export function normalizeDependencyEntry(value: unknown): TaskDependency | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return null;
		return { uid: parseLinkToPath(trimmed), reltype: DEFAULT_DEPENDENCY_RELTYPE };
	}

	if (typeof value === "object" && value !== null) {
		const raw = value as Record<string, unknown>;
		const rawUid = typeof raw.uid === "string" ? raw.uid.trim() : "";
		if (!rawUid) {
			return null;
		}
		const normalizedUid = parseLinkToPath(rawUid);
		const reltypeRaw = typeof raw.reltype === "string" ? raw.reltype.trim().toUpperCase() : "";
		const reltype = isValidDependencyRelType(reltypeRaw)
			? (reltypeRaw as TaskDependencyRelType)
			: DEFAULT_DEPENDENCY_RELTYPE;
		const gap = typeof raw.gap === "string" && raw.gap.trim().length > 0 ? raw.gap.trim() : undefined;
		return gap ? { uid: normalizedUid, reltype, gap } : { uid: normalizedUid, reltype };
	}

	return null;
}

export function normalizeDependencyList(value: unknown): TaskDependency[] | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}

	const arrayValue = Array.isArray(value) ? value : [value];
	const normalized: TaskDependency[] = [];
	for (const entry of arrayValue) {
		const normalizedEntry = normalizeDependencyEntry(entry);
		if (normalizedEntry) {
			normalized.push(normalizedEntry);
		}
	}

	return normalized.length > 0 ? normalized : undefined;
}

export function serializeDependencies(dependencies: TaskDependency[]): any[] {
	return dependencies.map((dependency) => {
		const serialized: Record<string, string> = {
			uid: dependency.uid,
			reltype: dependency.reltype,
		};
		if (dependency.gap && dependency.gap.trim().length > 0) {
			serialized.gap = dependency.gap;
		}
		return serialized;
	});
}

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
	entry: TaskDependency | string
): DependencyResolution | null {
	const rawUid = extractDependencyUid(entry);
	if (!rawUid) {
		return null;
	}

	const target = parseLinkToPath(rawUid);

	if (!target) {
		return null;
	}

	// Try multiple candidate targets to tolerate .md suffix and parsed linktext variants
	const candidates = new Set<string>();
	candidates.add(target);
	if (target.endsWith(".md")) {
		candidates.add(target.replace(/\.md$/i, ""));
	}
	const parsed = parseLinktext(target);
	if (parsed.path && parsed.path !== target) {
		candidates.add(parsed.path);
	}

	for (const candidate of candidates) {
		const resolved = app.metadataCache.getFirstLinkpathDest(candidate, sourcePath);
		if (resolved instanceof TFile) {
			return { path: resolved.path, file: resolved };
		}
		const fallback = app.vault.getAbstractFileByPath(candidate);
		if (fallback instanceof TFile) {
			return { path: fallback.path, file: fallback };
		}
	}

	return null;
}

export function formatDependencyLink(app: App, sourcePath: string, targetPath: string, useMarkdownLinks?: boolean): string {
	const target = app.vault.getAbstractFileByPath(targetPath);
	if (target instanceof TFile) {
		return generateLink(app, target, sourcePath, "", "", useMarkdownLinks);
	}

	// For unresolved files, create a simple wikilink with the basename
	const basename = targetPath.split("/").pop() || targetPath;
	return `[[${basename.replace(/\.md$/i, "")}]]`;
}
