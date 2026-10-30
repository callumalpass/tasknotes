import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// A dependency upgrade must not silently leave the host stylesheet on an old
// engine layout. Review/reapply the documented adaptations when this changes.
test("host calendar stylesheet tracks the pinned upstream engine and license", () => {
  const packageRoot = new URL("../node_modules/@tasknotes/calendar/", import.meta.url);
  const version = JSON.parse(readFileSync(new URL("package.json", packageRoot), "utf8")).version;
  assert.equal(version, "0.1.0");
  const upstreamHash = createHash("sha256")
    .update(readFileSync(new URL("dist/calendar.css", packageRoot))).digest("hex");
  assert.equal(upstreamHash, "43932615da8bfe1b2398ac8368413e9aeb28e9a4d28cf6ed4459c56a403f0e15");
  const host = readFileSync(new URL("../vendor/tasknotes-calendar/calendar.css", import.meta.url), "utf8");
  assert.ok(host.replace(/[\s*]+/g, "").includes(upstreamHash));
  assert.deepEqual(readFileSync(new URL("../vendor/tasknotes-calendar/LICENSE", import.meta.url)),
    readFileSync(new URL("LICENSE", packageRoot)));
});
