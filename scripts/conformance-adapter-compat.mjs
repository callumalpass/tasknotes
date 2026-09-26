import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// The pinned spec ships adapters for an older TaskNotes runtime. Only adapt the
// host mocks and migration input boundary; never change fixtures or assertions.
export function adaptPinnedSpecRuntime(specRoot) {
  const patches = [
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
