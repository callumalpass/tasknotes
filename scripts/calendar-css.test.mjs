import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import stylelint from "stylelint";

// A dependency upgrade must not silently leave the host stylesheet on an old
// engine layout. Review/reapply the documented adaptations when this changes.
test("host calendar stylesheet tracks the pinned upstream engine and license", () => {
  const packageRoot = new URL("../node_modules/@tasknotes/calendar/", import.meta.url);
  const version = JSON.parse(readFileSync(new URL("package.json", packageRoot), "utf8")).version;
  assert.equal(version, "0.1.13");
  const upstreamHash = createHash("sha256")
    .update(readFileSync(new URL("dist/calendar.css", packageRoot))).digest("hex");
  assert.equal(upstreamHash, "a2f7e17719334df98bd436c4c4399cbe8e438461cdff0a10d8b34cc7444482e6");
  const host = readFileSync(new URL("../vendor/tasknotes-calendar/calendar.css", import.meta.url), "utf8");
  assert.ok(host.replace(/[\s*]+/g, "").includes(upstreamHash));
  assert.deepEqual(readFileSync(new URL("../vendor/tasknotes-calendar/LICENSE", import.meta.url)),
    readFileSync(new URL("LICENSE", packageRoot)));
});

test("the pinned host calendar stylesheet passes strict CSS validation", async () => {
  const result = await stylelint.lint({ files: "vendor/tasknotes-calendar/calendar.css" });
  assert.equal(result.errored, false);
  assert.deepEqual(result.results.flatMap(file => file.warnings), []);
});
