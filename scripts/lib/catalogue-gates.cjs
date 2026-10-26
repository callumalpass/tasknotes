const { execFileSync } = require("node:child_process");
const { readFileSync, realpathSync } = require("node:fs");
const { createRequire } = require("node:module");
const { dirname, join } = require("node:path");
function tools(root) {
  const filename = realpathSync(join(root, "node_modules/@mdbase-dev/i18n/package.json"));
  const manifest = JSON.parse(readFileSync(filename, "utf8"));
  const requireKit = createRequire(filename);
  return {
    shared: join(dirname(filename), manifest.bin["mdbase-i18n"]),
    lingui: join(dirname(requireKit.resolve("@lingui/cli")), "lingui.js"),
  };
}
function run(root, cli, args = [], diagnosticsToStderr = false) {
  execFileSync(process.execPath, [cli, ...args], { cwd: root, stdio: diagnosticsToStderr ? ["inherit", 2, 2] : "inherit" });
}
exports.prepareStrictCatalogues = (root = process.cwd(), { diagnosticsToStderr = false } = {}) => {
  // Lingui --strict alone permits fallback-filled entries. The shared check
  // rejects missing authored translations BEFORE fallback and compiles strictly.
  run(root, join(root, "scripts/check-plural-contracts.mjs"), [], diagnosticsToStderr);
  run(root, join(root, "scripts/check-message-values.mjs"), [], diagnosticsToStderr);
  run(root, tools(root).shared, ["check"], diagnosticsToStderr);
  run(root, join(root, "scripts/check-obsidian-i18n.mjs"), [], diagnosticsToStderr);
};
exports.prepareDevelopmentCatalogues = (root = process.cwd()) => {
  console.warn("DEVELOPMENT ONLY: incomplete catalogues with English fallback; not translation/release acceptance.");
  run(root, tools(root).lingui, ["compile", "--workers", "1"]);
};
