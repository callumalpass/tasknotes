import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const braces = require("braces");
const { MAX_DEPTH } = require("../vendor/braces/lib/depth");
const isDepthError = error => error instanceof SyntaxError && error.code === "ERR_BRACES_MAX_DEPTH";

// Keep a regression from wedging the test runner: attack cases run in a child
// with a time limit, and must fail explicitly, not by VM stack exhaustion.
for (const method of ["parse", "compile", "expand", "stringify"]) {
	test(`${method} bounds nested braces, parentheses and mixed containers`, () => {
		const script = `
		const assert = require('node:assert/strict');
		const braces = require(${JSON.stringify(require.resolve("braces"))});
		for (const [open, close] of [['{', '}'], ['(', ')'], ['{(', ')}']]) {
		  const input = open.repeat(2000) + 'x' + close.repeat(2000);
		  assert.throws(() => braces[${JSON.stringify(method)}](input, { maxDepth: Infinity }),
		    e => e instanceof SyntaxError && e.code === 'ERR_BRACES_MAX_DEPTH');
		}
		`;
		const result = spawnSync(process.execPath, ["-e", script], { timeout: 5000, encoding: "utf8" });
		assert.equal(result.error, undefined);
		assert.equal(result.signal, null);
		assert.equal(result.status, 0, result.stderr);
	});
}

test("the hard depth boundary preserves ordinary patterns and ignores quoted/escaped delimiters", () => {
	const boundary = "{".repeat(MAX_DEPTH) + "x" + "}".repeat(MAX_DEPTH);
	assert.equal(braces.stringify(braces.parse(boundary)), boundary);
	assert.doesNotThrow(() => braces.compile(boundary));
	assert.doesNotThrow(() => braces.expand(boundary));
	assert.throws(() => braces.parse("{".repeat(MAX_DEPTH + 1)), isDepthError);
	assert.throws(() => braces.parse("(".repeat(MAX_DEPTH + 1)), isDepthError);
	assert.equal(braces.stringify('"' + "{".repeat(200) + '"'), "{".repeat(200));
	assert.equal(braces.stringify("\\{".repeat(200)), "{".repeat(200));
	assert.equal(braces.compile("src/{a,b}/*.ts"), "src/(a|b)/*.ts");
	assert.deepEqual(braces.expand("file-{1..3}"), ["file-1", "file-2", "file-3"]);
	assert.deepEqual(braces.expand("{a,{b,c}}"), ["a", "b", "c"]);
	assert.deepEqual(braces("{,a,a}", { expand: true, noempty: true, nodupes: true }), ["a"]);
	assert.throws(() => braces.expand("{1..2000}"), /range limit/);
});

for (const method of ["compile", "expand", "stringify"]) {
	test(`${method} and its direct library entry reject over-deep or child-cyclic ASTs`, () => {
		let ast = { type: "text", value: "x" };
		for (let i = 0; i < MAX_DEPTH + 2; i++) ast = { type: "root", nodes: [ast] };
		const direct = require(`../vendor/braces/lib/${method}`);
		assert.throws(() => braces[method](ast), isDepthError);
		assert.throws(() => direct(ast), isDepthError);
		const cycle = { type: "root", nodes: [] };
		cycle.nodes.push(cycle);
		assert.throws(() => braces[method](cycle), { code: "ERR_BRACES_AST_CYCLE" });
	});
}

test("installed micromatch and fast-glob consumers resolve the maintained fork", () => {
	const expected = fileURLToPath(new URL("../vendor/braces/index.js", import.meta.url));
	assert.equal(require.resolve("braces"), expected);
	assert.equal(require("braces/package.json").name, "@tasknotes/braces");
	const micromatchRequire = createRequire(require.resolve("micromatch"));
	assert.equal(micromatchRequire.resolve("braces"), expected);
	const globRequire = createRequire(require.resolve("fast-glob"));
	assert.equal(createRequire(globRequire.resolve("micromatch")).resolve("braces"), expected);
	assert.deepEqual(require("micromatch")(["a.ts", "b.js", "c.md"], "*.{ts,js}"), ["a.ts", "b.js"]);
});
