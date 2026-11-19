import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { createMarkdownBuildPlugin } from "./lib/markdown-build.mjs";

async function bundleMarkdown(paths, production) {
	const result = await build({
		stdin: {
			contents: paths.map((path, index) => `import text${index} from ${JSON.stringify(path)}; export { text${index} };`).join("\n"),
			resolveDir: process.cwd(),
		},
		bundle: true,
		write: false,
		platform: "browser",
		format: "cjs",
		minify: true,
		plugins: [createMarkdownBuildPlugin({ production })],
	});
	const source = result.outputFiles[0].text;
	const module = { exports: {} };
	runInNewContext(source, { module, exports: module.exports, atob, Uint8Array, TextDecoder });
	return { source, values: paths.map((path, index) => module.exports[`text${index}`]) };
}

test("production Markdown preserves Unicode, whitespace and empty text in a browser", async () => {
	const directory = mkdtempSync(join(tmpdir(), "tasknotes-markdown-"));
	try {
		const texts = ["", "short", "# 日本語 🎉 café e\u0301\r\n\n  indentation\t\"quoted\"\\path\n".repeat(80)];
		const paths = texts.map((text, index) => {
			const path = join(directory, `${index}.md`);
			writeFileSync(path, text);
			return path;
		});
		const result = await bundleMarkdown(paths, true);
		assert.deepEqual(result.values, texts);
		assert.match(result.source, /atob\(/);
		assert.doesNotMatch(result.source, /require\(/);
		const development = await bundleMarkdown(paths, false);
		assert.deepEqual(development.values, texts);
		assert.doesNotMatch(development.source, /atob\(/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("every bundled release note round-trips without changing its text", async () => {
	const major = JSON.parse(readFileSync("manifest.json", "utf8")).version.split(".")[0];
	const paths = readdirSync("docs/releases")
		.filter(filename => filename.startsWith(`${major}.`) && filename.endsWith(".md"))
		.map(filename => resolve("docs/releases", filename));
	assert.ok(paths.length > 0);
	const result = await bundleMarkdown(paths, true);
	assert.deepEqual(result.values, paths.map(path => readFileSync(path, "utf8")));
});
