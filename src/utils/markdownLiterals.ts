// Inline code, wikilinks, markdown links and bare URLs. Text inside them belongs
// to the markup, so the date in [[2026-11-03 Meeting]] or the #tag in `#tag` is
// not task syntax.
const MARKDOWN_LITERAL_PATTERN = new RegExp(
	[
		"(`+)[^`\\n]+\\1(?!`)",
		"\\[\\[[^\\n]*?\\]\\]",
		'\\[[^[\\]\\n]*\\]\\((?:<[^<>\\n]*>|[^()\\s]*(?:\\([^()\\s]*\\)[^()\\s]*)*)(?:\\s+"[^"\\n]*")?\\)',
		// A URL starts a word; the captured prefix stands in for a lookbehind.
		"(^|[^A-Za-z0-9_])([a-z][a-z0-9+.-]*:\\/\\/[^\\s<>]*[^\\s<>.,;:!?'\")\\]])",
	].join("|"),
	"giu"
);
const PLACEHOLDER_PATTERN = /\uFFFC(\d+)\uFFFC/gu;

/**
 * Replaces each markdown literal with a placeholder that no task syntax
 * matches. `restore` puts the original text back.
 */
export function shieldMarkdownLiterals(text: string): {
	text: string;
	restore: (value: string) => string;
} {
	const literals: string[] = [];
	const shielded = text.replace(
		MARKDOWN_LITERAL_PATTERN,
		(match: string, _ticks?: string, urlPrefix?: string, url?: string) => {
			literals.push(url ?? match);
			return `${url === undefined ? "" : urlPrefix}\uFFFC${literals.length - 1}\uFFFC`;
		}
	);
	return {
		text: shielded,
		restore: (value) =>
			literals.length === 0
				? value
				: value.replace(PLACEHOLDER_PATTERN, (match, index: string) => literals[Number(index)] ?? match),
	};
}
