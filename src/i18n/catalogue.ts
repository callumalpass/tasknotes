import type { TranslationTree } from "./types";

// Legacy English grammatical suffixes are not meaningful in every language.
// Keep exceptions scoped to their actual messages, rather than allowing the
// omission of arbitrary interpolation values. An ICU migration removes these.
const optionalPlaceholders: Record<string, string[]> = {
	"modals.task.recurrence.ordinal": ["suffix"],
	"settings.integrations.timeFormats.minutesAgo": ["plural"],
	"settings.integrations.timeFormats.hoursAgo": ["plural"],
	"settings.integrations.timeFormats.daysAgo": ["plural"],
	"services.calendarExport.notices.downloadSuccess": ["plural"],
	"services.instantTaskConvert.notices.convertingTasks": ["plural"],
	"services.instantTaskConvert.notices.conversionSuccess": ["plural"],
	"services.instantTaskConvert.notices.partialConversion": ["successPlural"],
};

function placeholders(message: string): Set<string> {
	const result = new Set<string>();
	// Double-brace examples in setting descriptions document templates; they
	// aren't interpolation parameters supplied by the interface.
	const pattern = /\{\{[^{}]*\}\}|\{(\w+)\}/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(message)) !== null) {
		if (match[1]) result.add(match[1]);
	}
	return result;
}

export function validateTranslationMessage(key: string, source: string, translated: string): void {
	const expected = placeholders(source);
	const actual = placeholders(translated);
	const optional = optionalPlaceholders[key] ?? [];
	if (
		[...actual].some((token) => !expected.has(token)) ||
		[...expected].some((token) => !actual.has(token) && !optional.includes(token))
	) {
		throw new Error(`Invalid language-pack message: ${key}`);
	}
}

export function flattenTranslations(tree: TranslationTree, prefix = ""): Record<string, string> {
	const entries: Record<string, string> = Object.create(null);
	for (const [key, value] of Object.entries(tree)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			entries[fullKey] = value;
		} else if (value && typeof value === "object") {
			Object.assign(entries, flattenTranslations(value, fullKey));
		}
	}
	return entries;
}
