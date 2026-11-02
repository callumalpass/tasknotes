import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The pinned spec ships adapters for an older TaskNotes runtime. Only adapt the
// host mocks, build tooling and migration input boundary; never change fixtures or assertions.
export function adaptPinnedSpecBuild(specRoot, tasknotesRoot) {
  const path = resolve(specRoot, "package.json");
  const metadata = JSON.parse(readFileSync(path, "utf8"));
  const key = "conformance:build:tasknotes-bridge";
  const command = metadata.scripts?.[key];
  const cli = "npm --prefix ../tasknotes exec -- esbuild";
  if (typeof command !== "string" || command.split(cli).length !== 5) {
    throw new Error("Pinned spec build changed; review Lingui bridge compilation");
  }
  metadata.scripts[key] = command.replaceAll(cli,
    `node ${JSON.stringify(resolve(tasknotesRoot, "scripts/conformance-esbuild.mjs"))}`);
  writeFileSync(path, `${JSON.stringify(metadata, null, 2)}\n`);
}

export function adaptPinnedSpecRuntime(specRoot) {
  const frontmatterMock = fileURLToPath(new URL(
    "../node_modules/obsidian-test-mocks/dist/lib/esm/obsidian/functions/getFrontMatterInfo.mjs", import.meta.url));
  const patches = [
    {
      file: "conformance/adapters/tasknotes-runtime-obsidian-shim.ts",
      before: "export function parseYaml(source: string): unknown {",
      after: `// Supply the host API added after this adapter was pinned.
export { getFrontMatterInfo } from ${JSON.stringify(frontmatterMock)};

export function parseYaml(source: string): unknown {`,
    },
    {
      file: "conformance/adapters/tasknotes-runtime-bridge.ts",
      before: 'import { TaskService } from "../../../tasknotes/src/services/TaskService.ts";',
      after: `import { TaskService } from "../../../tasknotes/src/services/TaskService.ts";
import { StatusManager } from "../../../tasknotes/src/services/StatusManager.ts";`,
    },
    {
      file: "conformance/adapters/tasknotes-runtime-bridge.ts",
      before: "      getCompletedStatuses: () => {",
      after: `      getConfiguredStatusAfterCompletion: () => {
        const statuses = Array.isArray(settings.customStatuses) ? settings.customStatuses : [];
        return new StatusManager(statuses as ConstructorParameters<typeof StatusManager>[0])
          .getConfiguredStatusAfterCompletion();
      },
      getCompletedStatuses: () => {`,
    },
    {
      file: "conformance/adapters/tasknotes-runtime-bridge.ts",
      before: "    settings,\n    fieldMapper,",
      after: `    expandedProjectsService: { renamePath: () => undefined },
    projectSubtasksService: { invalidateIndex: () => undefined },
    settings,
    fieldMapper,`,
    },
    {
      file: "conformance/adapters/tasknotes-core/conformance.ts",
      before: "    const parsed = parseDateToUTC(trimmed);\n    return canonicalInstant(parsed);",
      after: `    // Migration accepts legacy space-separated timestamps. The current
    // runtime parser deliberately accepts only ISO timestamps with a T.
    const iso = trimmed.replace(/^(\\d{4}-\\d{2}-\\d{2}) (?=\\d{2}:\\d{2})/, "$1T");
    const parsed = parseDateToUTC(iso);
    return canonicalInstant(parsed);`,
    },
  ];
  for (const { file, before, after } of patches) {
    const path = resolve(specRoot, file);
    const source = readFileSync(path, "utf8");
    if (source.split(before).length !== 2) {
      throw new Error(`Pinned spec adapter changed; review compatibility patch: ${file}`);
    }
    writeFileSync(path, source.replace(before, after));
  }
}
