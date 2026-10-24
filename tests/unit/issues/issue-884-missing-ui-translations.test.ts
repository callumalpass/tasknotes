import { msg } from "@lingui/core/macro";
import { translationResources } from "../../../src/i18n/bundledResources";
import { englishText, observeTranslation } from "../../helpers/real-i18n";

// Exercise the catalogues the plugin actually loads, not the retired keyed trees.
const descriptors = [
  msg({ message: "Date", context: "components.dateContextMenu.dateLabel" }),
  msg({ message: "Time (optional)", context: "contextMenus.date.modal.timeLabel" }),
  msg({ message: "Cancel", context: "common.cancel" }),
  msg({ message: "Task reminders", context: "modals.reminder.title" }),
  msg({ message: "Current reminders", context: "modals.reminder.current" }),
  msg({ message: "Loading reminders...", context: "modals.reminder.loading" }),
];
afterEach(() => observeTranslation("en"));
describe("Issue #884: missing UI translations", () => {
  it.each(["de", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"])("%s contains the real picker/reminder descriptors", locale => {
    const translate = observeTranslation(locale);
    for (const descriptor of descriptors) {
      expect(Object.hasOwn(translationResources.en, descriptor.id!)).toBe(true);
      expect(Object.hasOwn(translationResources[locale], descriptor.id!)).toBe(true);
      expect(translate(descriptor).trim()).not.toBe("");
      if (locale === "ru") expect(translate(descriptor)).not.toBe(englishText(descriptor));
    }
  });
});
