import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const tasknotesRoot = resolve(scriptDir, "..");
const specRoot = resolve(tasknotesRoot, "../tasknotes-spec");
const adapterPath = resolve(specRoot, "conformance/adapters/tasknotes.adapter.mjs");
const defaultWaiverPath = resolve(tasknotesRoot, "conformance/waivers.json");

function requirePath(path, label) {
  if (!existsSync(path)) {
    console.error(`Missing ${label}: ${path}`);
    process.exit(1);
  }
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: "inherit",
  });
}

function loadWaivers(path) {
  if (!existsSync(path)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const waivers = Array.isArray(parsed?.waivers) ? parsed.waivers : [];

  return waivers.map((entry, index) => {
    const id = typeof entry?.id === "string" ? entry.id.trim() : "";
    const reason = typeof entry?.reason === "string" ? entry.reason.trim() : "";
    const justification = typeof entry?.justification === "string" ? entry.justification.trim() : "";
    const scope = typeof entry?.scope === "string" ? entry.scope.trim() : "unspecified";

    if (!id) {
      throw new Error(`Invalid waiver at index ${index}: missing id`);
    }
    if (!reason) {
      throw new Error(`Invalid waiver ${id}: missing reason`);
    }
    if (!justification) {
      throw new Error(`Invalid waiver ${id}: missing justification`);
    }

    return { id, reason, justification, scope };
  });
}

function applyFixtureWaivers(root, waivers) {
  if (waivers.length === 0) {
    return { restore() {}, removedCount: 0 };
  }

  const fixturesDir = resolve(root, "conformance/fixtures");
  const waiverIds = new Map(waivers.map((waiver) => [waiver.id, waiver]));
  const unmatched = new Set(waiverIds.keys());
  const backups = [];
  let removedCount = 0;

  for (const file of readdirSync(fixturesDir)) {
    if (!file.endsWith(".json")) continue;
    const path = resolve(fixturesDir, file);
    const original = readFileSync(path, "utf8");
    backups.push({ path, original });

    const fixtures = JSON.parse(original);
    if (!Array.isArray(fixtures)) {
      continue;
    }

    const filtered = fixtures.filter((fixture) => {
      const id = typeof fixture?.id === "string" ? fixture.id : "";
      const shouldKeep = !waiverIds.has(id);
      if (!shouldKeep) {
        unmatched.delete(id);
        removedCount += 1;
      }
      return shouldKeep;
    });

    if (filtered.length !== fixtures.length) {
      writeFileSync(path, `${JSON.stringify(filtered, null, 2)}\n`);
    }
  }

  if (unmatched.size > 0) {
    for (const backup of backups) {
      writeFileSync(backup.path, backup.original);
    }
    throw new Error(
      `Waiver ids not found in generated fixtures: ${[...unmatched].sort().join(", ")}`,
    );
  }

  return {
    removedCount,
    restore() {
      for (const backup of backups) {
        writeFileSync(backup.path, backup.original);
      }
    },
  };
}

requirePath(specRoot, "tasknotes-spec repo");
requirePath(resolve(specRoot, "package.json"), "tasknotes-spec package.json");

const waiverPath = process.env.TASKNOTES_CONFORMANCE_WAIVERS
  ? resolve(tasknotesRoot, process.env.TASKNOTES_CONFORMANCE_WAIVERS)
  : defaultWaiverPath;
const waivers = loadWaivers(waiverPath);

let result = run("npm", ["run", "conformance:generate"], { cwd: specRoot });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

result = run("npm", ["run", "conformance:build:tasknotes-bridge"], { cwd: specRoot });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
const waiverSession = applyFixtureWaivers(specRoot, waivers);

if (waivers.length > 0) {
  console.warn(
    `Applying ${waivers.length} TaskNotes conformance waiver(s) from ${waiverPath} (${waiverSession.removedCount} fixture(s) skipped):`,
  );
  for (const waiver of waivers) {
    console.warn(`- ${waiver.id} [${waiver.scope}] ${waiver.reason}`);
    console.warn(`  justification: ${waiver.justification}`);
  }
}

try {
  result = run("npm", ["run", "conformance:test"], {
    cwd: specRoot,
    env: { TASKNOTES_ADAPTER: adapterPath },
  });
} finally {
  waiverSession.restore();
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
