import { sanitizeHTMLToDom } from "obsidian";

/**
 * Plain-text normalization for calendar event descriptions.
 *
 * The Google Calendar API documents the event `description` field as one that
 * "can contain HTML". Google Calendar and third-party integrations therefore
 * store markup such as `<p>`, `<br>`, `<ul><li>`, and `<a href>` in it.
 *
 * TaskNotes consumes that string as plain text everywhere: event tooltips, the
 * ICS event info modal, "copy as markdown", the `{{icsEventDescription}}`
 * template variable, generated note bodies, and folder templates. Several of
 * those write the value into the vault, so raw markup does not merely look
 * wrong on screen — it is persisted into notes and folder names.
 *
 * Normalizing at the Google provider boundary keeps every one of those
 * consumers plain-text, rather than making each handle HTML independently.
 * ICS subscriptions read descriptions through their own boundary and are not
 * normalized here.
 */

/**
 * Elements that separate paragraphs, rendered with a blank line between them.
 */
const PARAGRAPH_TAGS = new Set([
	"ADDRESS",
	"ARTICLE",
	"ASIDE",
	"BLOCKQUOTE",
	"DL",
	"FIELDSET",
	"FIGURE",
	"FOOTER",
	"FORM",
	"H1",
	"H2",
	"H3",
	"H4",
	"H5",
	"H6",
	"HEADER",
	"HR",
	"MAIN",
	"NAV",
	"OL",
	"P",
	"PRE",
	"SECTION",
	"TABLE",
	"UL",
]);

/**
 * Elements that start a new line without a blank line. List items and the
 * `<div>`-per-line style emitted by Google's editors belong here — treating
 * them as paragraphs would double-space every list.
 */
const LINE_TAGS = new Set([
	"DD",
	"DIV",
	"DT",
	"FIGCAPTION",
	"LI",
	"TBODY",
	"TD",
	"TFOOT",
	"TH",
	"THEAD",
	"TR",
]);

/**
 * Elements whose content is markup rather than prose.
 */
const NON_CONTENT_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "HEAD"]);

/**
 * A closing tag is strong evidence that a string contains markup. Void tags
 * cover common standalone elements such as `<br>`. Requiring one of those
 * forms preserves ordinary text such as `Contact <user@example.com>` and
 * placeholders such as `<TBC>`.
 */
const PAIRED_HTML_TAG_PATTERN = /<([a-z][\w:-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1\s*>/i;
const VOID_HTML_TAG_PATTERN =
	/<(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(?:\s[^>]*)?\/?\s*>/i;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/;

/**
 * Reports whether a description looks like HTML rather than plain text.
 */
export function looksLikeHtml(value: string): boolean {
	return (
		PAIRED_HTML_TAG_PATTERN.test(value) ||
		VOID_HTML_TAG_PATTERN.test(value) ||
		HTML_COMMENT_PATTERN.test(value)
	);
}

/**
 * A flattened fragment: literal text, or a line break whose `weight` is the
 * number of newlines it requests. Adjacent breaks coalesce to their strongest
 * weight, so nested block elements never stack up blank lines.
 */
type Fragment = string | { weight: number };

function breakWeightOf(tag: string): number {
	if (PARAGRAPH_TAGS.has(tag)) {
		return 2;
	}
	if (LINE_TAGS.has(tag)) {
		return 1;
	}
	return 0;
}

function flattenAnchor(element: Element, out: Fragment[]): void {
	const labelFragments: Fragment[] = [];
	element.childNodes.forEach((child) => flattenNode(child, labelFragments));
	const label = tidy(joinFragments(labelFragments));
	const href = (element.getAttribute("href") ?? "").trim();

	if (!href || href === label) {
		out.push(label);
		return;
	}

	if (!label) {
		out.push(href);
		return;
	}

	// Keep the target reachable once the anchor markup is gone.
	out.push(`${label} (${href})`);
}

function flattenNode(node: Node, out: Fragment[]): void {
	if (node.nodeType === 3 /* TEXT_NODE */) {
		out.push(node.textContent ?? "");
		return;
	}

	if (node.nodeType !== 1 /* ELEMENT_NODE */) {
		return;
	}

	const element = node as Element;
	const tag = element.tagName.toUpperCase();

	if (NON_CONTENT_TAGS.has(tag)) {
		return;
	}

	if (tag === "BR") {
		out.push({ weight: 1 });
		return;
	}

	if (tag === "A") {
		flattenAnchor(element, out);
		return;
	}

	const weight = breakWeightOf(tag);
	if (weight > 0) {
		out.push({ weight });
	}

	if (tag === "LI") {
		out.push("- ");
	}

	element.childNodes.forEach((child) => flattenNode(child, out));

	if (weight > 0) {
		out.push({ weight });
	}
}

/**
 * Joins fragments, coalescing runs of breaks into the strongest one and
 * dropping whitespace that only exists to indent the source markup.
 */
function joinFragments(fragments: Fragment[]): string {
	let result = "";
	let pendingBreak = 0;

	for (const fragment of fragments) {
		if (typeof fragment !== "string") {
			pendingBreak = Math.max(pendingBreak, fragment.weight);
			continue;
		}

		if (fragment.length === 0) {
			continue;
		}

		// Whitespace between block elements is markup indentation, not content.
		if (pendingBreak > 0 && fragment.trim().length === 0) {
			continue;
		}

		if (result.length > 0 && pendingBreak > 0) {
			result += "\n".repeat(pendingBreak);
		}
		pendingBreak = 0;
		result += fragment;
	}

	return result;
}

/**
 * Collapses the flattened text into tidy plain text: normal spaces, no trailing
 * whitespace, and at most one blank line between paragraphs.
 */
function tidy(text: string): string {
	return text
		.replace(/\u00a0/g, " ")
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+/g, " ").trim())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

/**
 * Converts an HTML event description to plain text, preserving paragraph
 * breaks, list structure, and link targets.
 *
 * Obsidian sanitizes the markup into a detached fragment before it is read.
 */
export function htmlToPlainText(html: string): string {
	const fragment = sanitizeHTMLToDom(html);
	const fragments: Fragment[] = [];
	fragment.childNodes.forEach((child) => flattenNode(child, fragments));
	return tidy(joinFragments(fragments));
}

/**
 * Normalizes a provider event description to plain text.
 *
 * Plain-text descriptions are returned unchanged. Descriptions containing HTML
 * are flattened, with entities decoded as a side effect of DOM parsing. Returns
 * `undefined` when there is no usable text left, so existing truthiness checks
 * on the field continue to skip empty descriptions.
 */
export function normalizeCalendarDescription(value: string | undefined | null): string | undefined {
	if (typeof value !== "string" || value.length === 0) {
		return undefined;
	}

	if (!looksLikeHtml(value)) {
		return value;
	}

	const plainText = htmlToPlainText(value);
	return plainText.length > 0 ? plainText : undefined;
}
