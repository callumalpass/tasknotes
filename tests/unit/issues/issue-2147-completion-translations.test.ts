import concepts from "../../../scripts/plugin-key-map.json";
import { translationResources } from "../../../src/i18n/bundledResources";
import { observeTranslation, englishText } from "../../helpers/real-i18n";

const completion = Object.entries(concepts).filter(([concept]) =>
  concept.startsWith("contextMenus.task.completion.") ||
  concept.startsWith("settings.appearance.taskCards.completionSubmenu.")
);
afterEach(() => observeTranslation("en"));
describe("Issue #2147: live PO completion-date translations", () => {
  it.each(["de", "es", "fr", "ja", "ko", "pt", "ru", "zh"])("%s renders every completion action from its real compiled PO catalogue", locale => {
    const translate = observeTranslation(locale);
    expect(completion.length).toBeGreaterThan(0);
    for (const [, descriptor] of completion) {
      expect(Object.hasOwn(translationResources[locale], descriptor.id)).toBe(true);
      const values = { date: "2026-10-24", count: 2 };
      const rendered = translate(descriptor, values);
      expect(rendered.trim()).not.toBe("");
      expect(rendered).not.toBe(descriptor.id);
      expect(rendered).not.toBe(englishText(descriptor, values));
    }
  });
});
