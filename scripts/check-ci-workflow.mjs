// Execute the checked-in workflow's shell gates verbatim on the remote builder.
// This does not dispatch Actions or claim checkout/setup/upload action acceptance.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import YAML from "yaml";

if (process.argv.length !== 2) throw new Error("Workflow parity accepts no bypass flags");
if (Number(process.versions.node.split(".")[0]) !== 22) throw new Error("Workflow requires Node 22");
const filename = ".github/workflows/test.yml";
const source = await readFile(filename, "utf8");
const workflow = YAML.parse(source);
const report = {
  workflow: filename,
  sha256: createHash("sha256").update(source).digest("hex"),
  node: process.version,
  hostedCI: false,
  environment: "rpnpm remote builder; Node 22; no OAuth secrets supplied",
  steps: [],
};
let failed = false;
for (const [job, definition] of Object.entries(workflow.jobs)) {
  for (const step of definition.steps) {
    if (!step.run) {
      report.steps.push({ job, name: step.name, uses: step.uses, status: "not-reproduced-action" });
      continue;
    }
    // The existing workflow conditions this on 20,
    // while its sole matrix entry is 22. Preserve that condition; don't change CI.
    if (step.if) {
      if (step.if !== "matrix.node-version == '20'") throw new Error(`Unhandled workflow condition: ${step.if}`);
      report.steps.push({ job, name: step.name, command: step.run, status: "skipped-workflow-condition" });
      continue;
    }
    console.log(`\nWORKFLOW ${job}: ${step.name}\n${step.run}`);
    const started = new Date().toISOString();
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", step.run], {
      cwd: resolve(step["working-directory"] ?? "."),
      stdio: "inherit",
      env: { ...process.env, CI: "true", TZ: "UTC", GOOGLE_OAUTH_CLIENT_ID: "", MICROSOFT_OAUTH_CLIENT_ID: "" },
    });
    const status = result.status === 0 ? "passed" : "failed";
    report.steps.push({ job, name: step.name, command: step.run, started, finished: new Date().toISOString(), status, exit: result.status, signal: result.signal, error: result.error?.message });
    if (status === "failed") { failed = true; break; }
  }
}
report.status = failed ? "failed" : "passed";
await mkdir("dist", { recursive: true });
await writeFile("dist/ci-workflow-parity.json", JSON.stringify(report, null, 2) + "\n");
process.exitCode = failed ? 1 : 0;
