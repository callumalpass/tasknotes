import type { TaskNotesSettings } from "../../types/settings";
import { parseMdbaseTaskTypeDocument } from "../mdbaseCanonicalConfig";
import { legacyTaskNotesSupport } from "../legacyTaskNotesSupport";
import { renderHistoricalTaskTypes } from "./historicalTaskTypeRenderers";
import { splitFrontmatter } from "./frontmatter";

/** Normalize transport/editor formatting only, never substantive content. */
export function normalizeLegacyMetadata(content: string): string {
	return content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function semanticValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(semanticValue);
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, child]) => [key, semanticValue(child)])
		);
	}
	return value;
}

function sameGeneratedType(content: string, expected: string): boolean {
	const source = normalizeLegacyMetadata(content);
	const generated = normalizeLegacyMetadata(expected);
	// This must precede parsing: v4 emitted unquoted enums that can be invalid
	// YAML. Only the exact complete writer output is safe to recover in that case.
	if (source === generated) return true;
	try {
		const parsedSource = parseMdbaseTaskTypeDocument(source);
		const parsedGenerated = parseMdbaseTaskTypeDocument(generated);
		return (
			parsedSource.body === parsedGenerated.body &&
			JSON.stringify(semanticValue(parsedSource.type)) ===
				JSON.stringify(semanticValue(parsedGenerated.type))
		);
	} catch {
		return false;
	}
}

export function recognizeLegacyTaskType(
	content: string,
	settings: TaskNotesSettings,
	currentWriter?: string
): boolean {
	try {
		// Canonical definitions cannot be historical fields-schema writers. Avoid
		// rendering every historical version on ordinary current-collection saves.
		const source = parseMdbaseTaskTypeDocument(normalizeLegacyMetadata(content));
		if (!Object.prototype.hasOwnProperty.call(source.type, "fields")) return false;
	} catch {
		// Invalid old enum YAML can still be recognized by complete writer bytes.
	}
	if (currentWriter && sameGeneratedType(content, currentWriter)) return true;
	for (const writer of renderHistoricalTaskTypes(settings)) {
		if (sameGeneratedType(content, writer.document)) return true;
	}
	return false;
}

/** Detect unrecognized/edited old fields-schema types without inspecting their Markdown body. */
export function hasLegacyFieldsSchema(content: string): boolean {
	const normalized = normalizeLegacyMetadata(content);
	try {
		return Object.prototype.hasOwnProperty.call(parseMdbaseTaskTypeDocument(normalized).type, "fields");
	} catch {
		try {
			const frontmatter = splitFrontmatter(normalized)?.frontmatter;
			return frontmatter !== undefined && /^fields:/m.test(frontmatter);
		} catch { return false; }
	}
}

export function isKnownLegacySupport(content: string): boolean {
	const normalized = normalizeLegacyMetadata(content);
	return legacyTaskNotesSupport.some((known) => normalizeLegacyMetadata(known) === normalized);
}
