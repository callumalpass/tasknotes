import { msg } from "@lingui/core/macro";
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
		expect(content.querySelector(".date-time-picker-modal__quick-button")?.textContent).toBe(i18n.translate(msg({ message: "Today", context: "views.agenda.today" })));
		const input = content.querySelector<HTMLInputElement>(".date-time-picker-modal__nlp-input")!;
		expect(input.placeholder).toBe(i18n.translate(msg({ message: "Enter a date or date/time", context: "modals.dateTimePicker.placeholder" })));
		expect(input.getAttribute("aria-label")).toBe(i18n.translate(msg({ message: "Natural language date", context: "modals.dateTimePicker.naturalLanguage" })));
		expect(content.querySelector(".date-time-picker-modal__native-date-button")?.getAttribute("aria-label")).toBe(i18n.translate(msg({ message: "Open native date picker", context: "modals.dateTimePicker.nativePicker" })));
		expect(content.textContent).toContain(i18n.translate(msg({ message: "Time (optional)", context: "contextMenus.date.modal.timeLabel" })));
		expect(content.textContent).toContain(i18n.translate(msg({ message: "Cancel", context: "common.cancel" })));
		input.value = "invalid";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(content.querySelector('.date-time-picker-modal__error[role="alert"]')?.textContent).toBe(i18n.translate(msg({ message: "Could not find a date in that text.", context: "modals.dateTimePicker.notFound" })));
		modal.onClose();
	});
});
