import { build } from "esbuild";
import { linguiMacros } from "./lib/lingui-build.mjs";
import { fileURLToPath } from "node:url";

process.env.LINGUI_CONFIG = fileURLToPath(new URL("../lingui.config.mjs", import.meta.url));

// The pinned spec invokes esbuild's CLI. Its bridges also import plugin UI code,
// so use the same compile-time Lingui transformation as the production bundle.
const [entry, ...args] = process.argv.slice(2);
if (!entry || entry.startsWith("-")) throw new Error("Expected a conformance bridge entry point");
const options = { entryPoints: [entry], plugins: [linguiMacros()], alias: {} };
for (const arg of args) {
  if (arg === "--bundle") options.bundle = true;
  else if (arg.startsWith("--platform=")) options.platform = arg.slice(11);
  else if (arg.startsWith("--format=")) options.format = arg.slice(9);
  else if (arg.startsWith("--outfile=")) options.outfile = arg.slice(10);
  else if (arg.startsWith("--alias:")) {
    const separator = arg.indexOf("=", 8);
    if (separator === -1) throw new Error(`Invalid alias: ${arg}`);
    options.alias[arg.slice(8, separator)] = arg.slice(separator + 1);
  } else throw new Error(`Unsupported pinned conformance build argument: ${arg}`);
}
await build(options);
