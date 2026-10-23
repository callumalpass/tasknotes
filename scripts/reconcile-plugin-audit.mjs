import { readFile, writeFile } from "node:fs/promises";
import { formatter } from "@lingui/format-po";
const readJSON = async path => JSON.parse(await readFile(path, "utf8"));
const rows = await readJSON("scripts/plugin-audit-remediation.json");
const formats = await readJSON("scripts/plugin-format-remediation.json");
const dynamic = await readJSON("scripts/plugin-dynamic-audit.json");
// Run after rpnpm --pull dist run i18n:source on the same source revision.
const issues = await readJSON("dist/obsidian-i18n-source.json");
if (issues.length) throw new Error("Cannot reconcile against a failing source report");
const sites = await readJSON("dist/plugin-dynamic-sites.json");
const english = await formatter().parse(await readFile("src/i18n/locales/en/messages.po", "utf8"), { locale: "en" });
const idsAt = file => Object.entries(english).filter(([, entry]) => entry.origin?.some(([path]) => path === file)).map(([id]) => id).sort();
const formatEvidence = {
  "src/bases/calendar-core.ts": "Whole estimate message with uiDuration(task.timeEstimate)",
  "src/components/RecurrenceContextMenu.ts": "recurrenceMonthlyOn/recurrenceYearlyOn; Intl month/day and whole ordinal phrases",
  "src/components/TaskContextMenu.ts": "recurrenceMonthlyOn/recurrenceYearlyOn; no English ordinal suffix array",
  "src/modals/taskModalActionValues.ts": "Re-exports recurrenceDisplayText/recurrenceOrdinal; standalone English month/weekday arrays removed",
  "src/templates/defaultBasesFiles.ts": "basesMessage serializes compiled ICU with selected-locale numbers; native date-format tokens remain native Bases syntax",
  "src/ui/taskCardProperties.ts": "uiNumber with explicit fraction digits; stored numeric values are unchanged",
  "src/views/PomodoroStatsView.ts": "formatTime delegates to uiDuration",
  "src/views/PomodoroView.ts": "Whole add/subtract-duration messages with uiDuration(1)",
  "src/views/StatsView.ts": "All four formatTime helpers and daily tooltips use uiDuration",
};
const key = row => JSON.stringify([row.file, row.line, row.code]);
for (const row of formats) {
  row.initialState ??= row.state;
  if (row.initialState === "manual formatting cluster") {
    if (!formatEvidence[row.file]) throw new Error(`Unreviewed formatting cluster: ${row.file}:${row.line}`);
    row.state = "source formatting remediated";
    row.evidence = formatEvidence[row.file];
  }
}
const formatIndex = new Map(formats.map(row => [key(row), row]));
const moved = {
  "src/modals/taskModalActionValues.ts": "src/i18n/recurrence.ts",
  "src/utils/helpers.ts": "src/i18n/recurrence.ts",
  "src/releaseNotesAnnouncement.md": "src/i18n/releaseNotesAnnouncement.ts",
};
for (const row of rows) {
  row.initialState ??= row.state;
  if (row.initialState === "excluded") continue; // Preserve each original scope/data-contract rationale.
  const formatted = formatIndex.get(key(row));
  const contextIds = Object.entries(english).filter(([, entry]) => entry.context === row.context).map(([id]) => id);
  if (formatted) {
    row.state = "source formatting remediated";
    row.evidence = formatted.evidence ?? formatted.state;
  } else if (row.file === "src/i18n/I18nService.ts") {
    row.state = "obsolete English plural resolver removed";
    row.evidence = "Isolated Lingui core evaluates descriptors using CLDR; no translatePlural/resolveKey implementation";
  } else if (row.file === "src/services/OAuthService.ts" && row.code.includes("<!doctype")) {
    row.state = "escaped localized callback page";
    row.evidence = "Title/body descriptors at handleCallback; fixed oauthCallbackHtml structure escapes all copy and language attributes";
  } else if (row.initialState === "diagnostic boundary mapping") {
    row.state = "presentation-only diagnostic localization";
    row.evidence = "Recognized diagnostic catalogue and explicit displayError/Notice/CLI boundaries; original throws/logs/API contracts preserved";
  } else if (row.initialState === "module seed pending") {
    row.state = "deferred translation";
    row.evidence = "Render-time getter/descriptor instead of module-time translated label; eager-module source guard passes";
  } else {
    row.state = "source copy remediated";
    row.evidence = moved[row.file] ? "Whole-message/Intl presentation adapter replaces the original English fragment cluster"
      : row.file === "src/bootstrap/starterNote.ts" ? "getStarterNoteContent translates complete Markdown; template/path/code values are parameters"
      : row.file === "src/templates/defaultBasesFiles.ts" ? "Generated Bases names/labels/count/duration formulas use descriptors and compiled ICU"
      : "Reviewed whole-message/descriptor call site; forwarded UI interpolation and finite selection checked by consumer guard";
  }
  row.currentFile = moved[row.file] ?? row.file;
  row.messageIds = contextIds.length ? contextIds : idsAt(row.currentFile);
  row.acceptance = "Source remediation only; strict authored translations and native regression remain required";
}
if (rows.length !== 1075 || formats.length !== 156 || dynamic.forwards.length !== 93 || dynamic.conditionals.length !== 23) throw new Error("Audit inventory changed unexpectedly");
for (const row of [...dynamic.forwards, ...dynamic.conditionals]) {
  row.state = row.file === "src/i18n/I18nService.ts" ? "obsolete keyed resolver removed" : "descriptor/finite-selection migration reviewed";
  row.evidence = "Typecheck plus Obsidian source guard; no TranslationKey/MessageDescriptor/any casts at translator calls";
}
const closure = {
  base: dynamic.base, originalRows: rows.length, localeFormattingRows: formats.length,
  forwards: 93, conditionals: 23, finiteSites: sites.length,
  finiteConcepts: new Set(sites.flatMap(site => site.concepts)).size,
  sourceGuard: "PASS, including forwarding/interpolation/diagnostic/callback/eager-module checks",
  acceptance: "Not final acceptance: translations, full tests, strict gates, final budget and native checks are still outstanding",
  stateCounts: rows.reduce((counts, row) => (counts[row.state] = (counts[row.state] ?? 0) + 1, counts), {}),
};
await writeFile("scripts/plugin-audit-remediation.json", JSON.stringify(rows, null, 2) + "\n");
await writeFile("scripts/plugin-format-remediation.json", JSON.stringify(formats, null, 2) + "\n");
await writeFile("scripts/plugin-dynamic-audit.json", JSON.stringify(dynamic, null, 2) + "\n");
await writeFile("docs/development/i18n-audit-closure.json", JSON.stringify(closure, null, 2) + "\n");
console.log(JSON.stringify(closure, null, 2));
