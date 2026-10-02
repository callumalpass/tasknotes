import { Notice } from "obsidian";
import { createI18nService, translationResources } from "../../../src/i18n";
import { DateTimePickerModal } from "../../../src/modals/DateTimePickerModal";

describe("date picker localization", () => {
	it.each(Object.keys(translationResources))("translates controls and validation in %s", (locale) => {
		const i18n = createI18nService({ defaultLocale: locale });
		const modal = new DateTimePickerModal({} as never, {
			currentDate: "2026-01-01",
			plugin: { i18n, settings: { enableNaturalLanguageInput: true } } as never,
			naturalLanguageParser: { parseInput: () => ({ title: "invalid" }) as never },
			onSelect: jest.fn(),
		});
		modal.onOpen();
		const content = modal.contentEl;
		expect(content.querySelector(".date-time-picker-modal__quick-button")?.textContent).toBe(i18n.translate("dateTimePicker.today"));
		const input = content.querySelector<HTMLInputElement>(".date-time-picker-modal__nlp-input")!;
		expect(input.placeholder).toBe(i18n.translate("dateTimePicker.naturalLanguagePlaceholder"));
		expect(input.getAttribute("aria-label")).toBe(i18n.translate("dateTimePicker.naturalLanguageLabel"));
		expect(content.querySelector(".date-time-picker-modal__native-date-button")?.getAttribute("aria-label")).toBe(i18n.translate("dateTimePicker.openNativePicker"));
		expect(content.textContent).toContain(i18n.translate("dateTimePicker.time"));
		expect(content.textContent).toContain(i18n.translate("common.cancel"));
		input.value = "invalid";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(Notice).toHaveBeenLastCalledWith(i18n.translate("dateTimePicker.invalidInput"));
		modal.onClose();
	});
});
