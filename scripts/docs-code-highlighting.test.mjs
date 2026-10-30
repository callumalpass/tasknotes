import { test } from "node:test";
import assert from "node:assert/strict";
import { highlightDocumentationCode } from "../docs-builder/src/highlight-code.js";

test("ordinary examples keep syntax highlighting", () => {
	assert.match(highlightDocumentationCode("const task = 1;", "javascript"), /class="hljs-/);
});

test("large examples retain every byte of source without a token-span payload", () => {
	const code = '<script>&data</script>\n'.repeat(1000);
	const html = highlightDocumentationCode(code, "html");
	assert.doesNotMatch(html, /<script>|<span/);
	assert.equal(html.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"), code);
});
