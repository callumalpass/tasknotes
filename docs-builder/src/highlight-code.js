import hljs from "highlight.js";

/** Keep complete large source examples without multiplying their HTML by token spans. */
export function highlightDocumentationCode(code, lang) {
	if (Buffer.byteLength(code) > 16_000) {
		return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}
	const language = hljs.getLanguage(lang) ? lang : "plaintext";
	return hljs.highlight(code, { language }).value;
}
