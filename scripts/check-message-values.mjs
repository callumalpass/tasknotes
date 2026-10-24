import { readFile, readdir } from "node:fs/promises";
import { inspectMessageValues } from "./lib/message-values.mjs";
async function inspect(dir) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "locales") continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) results.push(...await inspect(path));
    else if (entry.name.endsWith(".ts")) results.push(...inspectMessageValues(await readFile(path, "utf8"), path));
  }
  return results;
}
const findings = await inspect("src");
for (const finding of findings) console.error(`${finding.file}:${finding.line}: missing message values ${finding.missing.join(", ")} (provided: ${finding.provided.join(", ")})`);
if (findings.length) process.exitCode = 1;
else console.log("PASS direct static Lingui call-site argument contracts");
