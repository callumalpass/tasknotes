import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const tasknotesRoot = resolve(scriptDir, "..");
const specRoot = resolve(tasknotesRoot, "../tasknotes-spec");
const adapterPath = resolve(specRoot, "conformance/adapters/tasknotes.adapter.mjs");

function requirePath(path, label) {
  if (!existsSync(path)) {
    console.error(`Missing ${label}: ${path}`);
    process.exit(1);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

requirePath(specRoot, "tasknotes-spec repo");
requirePath(resolve(specRoot, "package.json"), "tasknotes-spec package.json");

run("npm", ["run", "conformance:generate"], { cwd: specRoot });
run("npm", ["run", "conformance:build:tasknotes-bridge"], { cwd: specRoot });
run("npm", ["run", "conformance:test"], {
  cwd: specRoot,
  env: { TASKNOTES_ADAPTER: adapterPath },
});
