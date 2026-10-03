import YAML from "yaml";

export type FrontmatterParts = { frontmatter: string; body: string; prefix: string };

/** One leading UTF-8 BOM and LF/CRLF are transport formatting, not membership. */
export function splitFrontmatter(content: string): FrontmatterParts | null {
	const match = content.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m);
	// The multiline flag is only for the closing delimiter; opening must be byte zero.
	if (!match || match.index !== 0) {
		if (/^\uFEFF?---[ \t]*(?:\r?\n|$)/.test(content)) throw new Error("Unterminated YAML frontmatter");
		return null;
	}
	return { frontmatter: match[1], body: content.slice(match[0].length), prefix: content.startsWith("\uFEFF") ? "\uFEFF" : "" };
}

export function requireFrontmatter(content: string): FrontmatterParts {
	const parts = splitFrontmatter(content);
	if (!parts) throw new Error("The mdbase task type must contain YAML frontmatter.");
	return parts;
}

/** Do not silently turn malformed or non-mapping membership into an empty record. */
export function recordDocument(content: string): { document: YAML.Document; body: string; prefix: string } {
	const parts = splitFrontmatter(content);
	if (!parts) return { document: new YAML.Document({}), body: content, prefix: "" };
	const document = parts.frontmatter.trim() ? YAML.parseDocument(parts.frontmatter) : new YAML.Document({});
	if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join("; "));
	const value: unknown = document.toJS();
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Record frontmatter must be a mapping");
	return { document, body: parts.body, prefix: parts.prefix };
}
