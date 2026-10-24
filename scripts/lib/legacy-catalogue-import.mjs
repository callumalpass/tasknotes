// Pure regression helpers for the historical keyed-to-PO import. The destructive
// one-shot converter/codemods were retired after the port; POs are authoritative.
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { legacyConceptReplacements, technicalDataConcepts } from "./lingui-retired.mjs";
const pluralKeys = new Set([
  ...["minutes", "hours", "days"].map(unit => `settings.integrations.timeFormats.${unit}Ago`),
  "services.calendarExport.notices.downloadSuccess",
  "services.instantTaskConvert.notices.convertingTasks",
  "services.instantTaskConvert.notices.conversionSuccess",
  "services.instantTaskConvert.notices.partialConversion",
  "modals.task.recurrence.ordinal",
  "ui.taskCard.reminderTooltipOne", "ui.taskCard.reminderTooltipMany",
]);
export function toICU(value) {
  return value.replaceAll("'", "''").replace(/\{\{[^{}]*\}\}|\{\w+\}|[{}]/g, token =>
    /^\{\w+\}$/.test(token) ? token : `'${token}'`);
}
export function mapping(english) {
  return Object.fromEntries(Object.entries(english).filter(([key, value]) => value !== "" && !technicalDataConcepts.has(key)).map(([key, value]) => {
    const replacement = legacyConceptReplacements[key];
    const message = replacement?.message ?? (pluralKeys.has(key) ? value : toICU(value));
    const context = replacement?.context ?? (/^ui\.taskCard\.reminderTooltip(One|Many)$/.test(key) ? "ui.taskCard.reminderTooltip" : key);
    return [key, { id: generateMessageId(message, context), message, context }];
  }));
}
export function importTranslation(locale, existing, reviewed, { replacement, plural = false, refreshReviewed = false } = {}) {
  if (replacement !== undefined) return locale === "en" ? replacement : existing ?? "";
  if (locale !== "en" && !refreshReviewed && existing) return existing;
  if (typeof reviewed !== "string" || !reviewed) throw new Error(`${locale}: missing reviewed migration input`);
  return plural ? reviewed : toICU(reviewed);
}
