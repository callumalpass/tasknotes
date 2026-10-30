import { unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { locales } from "@mdbase-dev/i18n/config";

if (process.argv.length !== 2) throw new Error("Fresh catalogue acceptance takes no bypass flags");
const root = fileURLToPath(new URL("../", import.meta.url));
const files = locales.map(locale => join(root, "src/i18n/locales", locale, "messages.json"));
function removeGenerated() {
  for (const file of files) try { unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  console.log("Fresh checkout: removed generated JSON only; authored POs unchanged.");
}
function run(...args) {
  const result = spawnSync("npm", args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
removeGenerated();
run("run", "typecheck");
if (files.some(existsSync)) throw new Error("Typecheck unexpectedly generated catalogues");
run("test", "--", "--runInBand", "--json", "--outputFile=dist/jest-lingui-fresh-final.json");
removeGenerated();
run("run", "docs:check");
