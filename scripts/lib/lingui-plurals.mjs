// Reviewed whole-message ICU migrations for the legacy English suffix mechanism.
// Read live resource text first so locale-review fixes survive a rerun.
const timeKeys = ["minutes", "hours", "days"];
const suffixKeys = [
  ...timeKeys.map(unit => [`settings.integrations.timeFormats.${unit}Ago`, unit]),
  ["services.calendarExport.notices.downloadSuccess", "count"],
  ["services.instantTaskConvert.notices.convertingTasks", "count"],
  ["services.instantTaskConvert.notices.conversionSuccess", "count"],
  ["services.instantTaskConvert.notices.partialConversion", "successCount"],
];
const russian = {
  minutes: ["{minutes} минуту назад", "{minutes} минуты назад", "{minutes} минут назад"],
  hours: ["{hours} час назад", "{hours} часа назад", "{hours} часов назад"],
  days: ["{days} день назад", "{days} дня назад", "{days} дней назад"],
  downloadSuccess: ["Скачан {filename} с {count} задачей", "Скачан {filename} с {count} задачами", "Скачан {filename} с {count} задачами"],
  convertingTasks: ["Преобразование {count} задачи...", "Преобразование {count} задач...", "Преобразование {count} задач..."],
  conversionSuccess: ["✅ Успешно преобразована {count} задача в TaskNotes!", "✅ Успешно преобразованы {count} задачи в TaskNotes!", "✅ Успешно преобразовано {count} задач в TaskNotes!"],
  partialConversion: ["Преобразована {successCount} задача. {failureCount} не удалось.", "Преобразованы {successCount} задачи. {failureCount} не удалось.", "Преобразовано {successCount} задач. {failureCount} не удалось."],
};
function plural(argument, arms) {
  return `{${argument}, plural, ${Object.entries(arms).map(([category, text]) => `${category} {${text}}`).join(" ")}}`;
}
export function migratePlurals(resources) {
  const migrated = Object.fromEntries(Object.entries(resources).map(([locale, messages]) => [locale, { ...messages }]));
  for (const [key, argument] of suffixKeys) {
    for (const [locale, messages] of Object.entries(migrated)) {
      const original = resources[locale][key];
      if (locale === "ru") {
        const values = russian[timeKeys.includes(argument) ? argument : key.split(".").at(-1)];
        messages[key] = plural(argument, { one: values[0], few: values[1], many: values[2], other: values[2] });
        continue;
      }
      const arm = category => {
        let text = original.replace(/\{(?:successPlural|plural)\}/g, category === "one" ? "" :
          ["ja", "ko", "zh"].includes(locale) ? "" : locale === "de" ? (argument === "days" ? "e" : "n") : "s");
        if (locale === "de" && category !== "one") text = text.replace("wird konvertiert", "werden konvertiert");
        if (key.endsWith("conversionSuccess")) {
          if (locale === "fr" && category === "one") text = text.replace("converties", "convertie");
          if (locale === "es" && category !== "one") text = text.replace("convertida", "convertidas");
          if (locale === "pt" && category === "one") text = text.replace("Convertidas", "Convertida").replace("convertidas", "convertida");
        }
        if (key.endsWith("partialConversion")) {
          if (locale === "es" && category !== "one") text = text.replace("convertida", "convertidas");
          if (locale === "pt" && category === "one") text = text.replace("Convertidas", "Convertida");
        }
        return text;
      };
      messages[key] = plural(argument, ["ja", "ko", "zh"].includes(locale)
        ? { other: arm("other") } : { one: arm("one"), other: arm("other") });
    }
  }
  const ordinals = {
    en: "one {{number}st} two {{number}nd} few {{number}rd} other {{number}th}",
    fr: "one {{number}er} other {{number}e}", de: "other {{number}.}",
    es: "other {{number}.º}", ja: "other {{number}番目}", ko: "other {{number}번째}",
    pt: "other {{number}.º}", ru: "other {{number}-й}", zh: "other {第{number}}",
  };
  for (const [locale, messages] of Object.entries(migrated)) {
    messages["modals.task.recurrence.ordinal"] = `{number, selectordinal, ${ordinals[locale]}}`;
    const oneKey = "ui.taskCard.reminderTooltipOne", manyKey = "ui.taskCard.reminderTooltipMany";
    const one = resources[locale][oneKey].replace(/1/g, "{count}");
    const other = resources[locale][manyKey];
    const arms = locale === "ru" ? {
      one: "{count} напоминание установлено (нажмите, чтобы управлять)",
      few: "{count} напоминания установлено (нажмите, чтобы управлять)",
      many: other, other,
    } : ["ja", "ko", "zh"].includes(locale) ? { other } : { one, other };
    messages[oneKey] = messages[manyKey] = plural("count", arms);
  }
  // Numeric interpolation is a mechanical ICU-format change, not new target copy.
  // Apply it to English and reviewed targets together so packs retain one contract.
  for (const messages of Object.values(migrated)) {
    for (const key of [...suffixKeys.map(([key]) => key), "modals.task.recurrence.ordinal", "ui.taskCard.reminderTooltipOne", "ui.taskCard.reminderTooltipMany"]) {
      messages[key] = messages[key].replace(/\{(minutes|hours|days|count|successCount|failureCount|number)\}/g, "{$1, number}");
    }
  }
  return migrated;
}
export const pluralKeys = new Set([...suffixKeys.map(([key]) => key), "modals.task.recurrence.ordinal", "ui.taskCard.reminderTooltipOne", "ui.taskCard.reminderTooltipMany"]);
