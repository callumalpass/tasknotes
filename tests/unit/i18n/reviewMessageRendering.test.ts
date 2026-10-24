import { msg } from "@lingui/core/macro";
import { setupI18n } from "@lingui/core";
import { bindUIDisplay } from "../../../src/i18n/runtime";
import { getMonthDayOptions } from "../../../src/components/RecurrenceContextMenu";
import { observeTranslation } from "../../helpers/real-i18n";
import { uiText } from "../../../src/i18n/runtime";

const locales = ["en", "de", "es", "fr", "ja", "ko", "pt", "ru", "zh"];
afterEach(() => observeTranslation("en"));
it.each(locales)("renders literal braces and both corrected parameter contracts in %s", locale => {
  observeTranslation(locale);
  const warning = uiText(msg({ message: "Single-brace syntax like '{title}' is deprecated. Please use double-brace syntax '{{title}}' instead for consistency with body templates.", context: "settings.taskProperties.titleCard.legacySyntaxWarning" }));
  expect(warning).toContain("{title}");
  expect(warning).toContain("{{title}}");
  expect(uiText(msg({ message: "'{date}'-'{title}'", context: "settings.integrations.calendarSubscriptions.customTemplate.placeholder" }))).toBe("{date}-{title}");
  const created = uiText(msg({ message: "Task created: {title}", context: "notices.icsTaskCreatedSuccess" }), { title: "User task α" });
  expect(created).toContain("User task α");
  const raw = String.raw`C:\x41dir\u0042\uD83D\uDE00\\end`;
  expect(uiText(msg({ message: "Task created: {title}", context: "notices.icsTaskCreatedSuccess" }), { title: raw })).toContain(raw);
  const unresolved = uiText(msg({ message: "Could not resolve: {entries}", context: "contextMenus.task.dependencies.notices.unresolved" }), { entries: "[[Missing note]]" });
  expect(unresolved).toContain("[[Missing note]]");
});

it("keeps recurrence day values ASCII while displaying native digits", () => {
  bindUIDisplay(setupI18n({ locale: "fa", messages: { fa: {} } }));
  expect(getMonthDayOptions()[16]).toEqual({ value: "17", text: "۱۷" });
  expect(parseInt(getMonthDayOptions()[16].value, 10)).toBe(17);
});
