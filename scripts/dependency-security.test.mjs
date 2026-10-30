import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import * as z3esm from "zod/v3";
import * as z4esm from "zod/v4";
import * as z4mini from "zod/v4-mini";

const require = createRequire(import.meta.url);
const variants = [
  ["v3 ESM", z3esm], ["v3 CommonJS", require("zod/v3")],
  ["root CommonJS", require("zod")], ["v4 ESM", z4esm], ["v4 CommonJS", require("zod/v4")],
];

for (const [name, z] of variants) {
  test(`${name}: oversized collections fail before element and outer callbacks`, async () => {
    let elements = 0;
    let outer = 0;
    const element = z.string().refine(() => { elements++; return true; });
    for (const schema of [z.array(element).max(1, "bounded"), z.array(element).length(1, "bounded"), z.set(element).max(1, "bounded")]) {
      const input = schema instanceof z.ZodSet ? new Set(["a", "b"]) : Array(5000).fill("a");
      const result = schema.refine(() => { outer++; return true; }).safeParse(input);
      assert.equal(result.success, false);
      assert.equal(result.error.issues.length, 1);
      assert.equal(result.error.issues[0].code, "too_big");
      assert.equal(result.error.issues[0].message, "bounded");
      assert.deepEqual([elements, outer], [0, 0]);
      const asynchronous = await schema.safeParseAsync(input);
      assert.equal(asynchronous.success, false);
      assert.equal(elements, 0);
    }
    const asyncElement = z.string().refine(async () => { elements++; return true; });
    assert.equal((await z.array(asyncElement).max(1).safeParseAsync(["a", "b"])).success, false);
    assert.equal(elements, 0);
  });

  test(`${name}: valid inputs, minimum bounds, union fallbacks and nested paths remain usable`, () => {
    assert.deepEqual(z.array(z.string()).max(2).parse(["a", "b"]), ["a", "b"]);
    assert.deepEqual([...z.set(z.string()).max(2).parse(new Set(["a", "b"]))], ["a", "b"]);
    assert.equal(z.array(z.string()).length(2).safeParse(["a"]).success, false);
    assert.equal(z.array(z.string()).min(1).safeParse([]).success, false);
    const nested = z.object({ list: z.array(z.string()).max(1) }).safeParse({ list: [1, 2] });
    assert.equal(nested.success, false);
    assert.deepEqual(nested.error.issues[0].path, ["list"]);
    assert.deepEqual(z.union([z.array(z.string()).max(1), z.array(z.string())]).parse(["a", "b"]), ["a", "b"]);
  });
}

test("patched upstream v4 map and mini entry points reject oversized input", () => {
  let calls = 0;
  const item = z4esm.string().refine(() => { calls++; return true; });
  assert.equal(z4esm.map(item, item).max(1).safeParse(new Map([["a", "a"], ["b", "b"]])).success, false);
  assert.equal(calls, 0);
  assert.equal(z4mini.array(z4mini.string()).check(z4mini.maxLength(1)).safeParse(["a", "b"]).success, false);
});

for (const file of ["../vendor/deepmerge/dist/cjs.js", "../vendor/deepmerge/dist/umd.js"]) {
  const merge = require(file);
  test(`${file}: own __proto__ keys never poison the result's prototype`, () => {
    const malicious = JSON.parse('{"__proto__":{"securityMarker":true},"normal":1}');
    for (const [target, source, keepsOwnKey] of [[malicious, {}, true], [Object.create(null), malicious, true], [{ nested: malicious }, {}, false]]) {
      const result = merge(target, source);
      const checked = result.nested ?? result;
      assert.equal(Object.getPrototypeOf(checked), Object.prototype);
      assert.equal(checked.securityMarker, undefined);
      assert.equal({}.securityMarker, undefined);
      assert.equal(Object.hasOwn(checked, "__proto__"), keepsOwnKey);
      assert.deepEqual(Object.getOwnPropertyDescriptor(checked, "__proto__"), keepsOwnKey ? {
        value: { securityMarker: true }, writable: true, enumerable: true, configurable: true,
      } : undefined);
    }
    assert.equal(merge({}, malicious).securityMarker, undefined);
  });
  test(`${file}: ordinary merge, array, symbol and clone behavior is preserved`, () => {
    const symbol = Symbol("key");
    const target = { nested: { left: 1 }, list: [1], [symbol]: { a: 1 } };
    const source = { nested: { right: 2 }, list: [2], [symbol]: { b: 2 } };
    assert.deepEqual(merge(target, source), { nested: { left: 1, right: 2 }, list: [1, 2], [symbol]: { a: 1, b: 2 } });
    assert.deepEqual(target.list, [1]);
    assert.deepEqual(merge.all([{ a: 1 }, { b: 2 }]), { a: 1, b: 2 });
    const child = { a: 1 };
    assert.equal(merge({}, { child }, { clone: false }).child, child);
    assert.deepEqual(merge({ x: [1] }, { x: [2] }, { arrayMerge: (_a, b) => b }), { x: [2] });
  });
}

test("installed model/SDK/Jest consumers resolve to the maintained forks", () => {
  for (const entry of ["@tasknotes/model", "@modelcontextprotocol/sdk/server/mcp.js", "zod-to-json-schema"]) {
    const consumer = createRequire(require.resolve(entry));
    assert.equal(realpathSync(consumer.resolve("zod")), realpathSync(require.resolve("zod")));
  }
  const jest = createRequire(require.resolve("jest-config"));
  assert.equal(realpathSync(jest.resolve("deepmerge")), realpathSync(require.resolve("deepmerge")));
  assert.equal(require("zod/package.json").name, "@tasknotes/zod");
  assert.equal(require("deepmerge/package.json").name, "@tasknotes/deepmerge");
});

test("vendor runtime differs from upstream only in the documented backport files", () => {
  for (const [directory, changed] of [
    ["zod", ["v3/types.js", "v3/types.cjs"]],
    ["deepmerge", ["index.js", "dist/cjs.js", "dist/umd.js"]],
  ]) {
    const base = new URL(`../vendor/${directory}/`, import.meta.url);
    const hashes = JSON.parse(readFileSync(new URL("UPSTREAM-SHA256.json", base), "utf8"));
    const differences = Object.entries(hashes).filter(([file, hash]) =>
      createHash("sha256").update(readFileSync(new URL(file, base))).digest("hex") !== hash
    ).map(([file]) => file).sort();
    assert.deepEqual(differences, [...changed].sort());
  }
});
