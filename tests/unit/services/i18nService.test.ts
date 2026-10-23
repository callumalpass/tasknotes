import { msg } from "@lingui/core/macro";
import { describe, expect, it } from "@jest/globals";
import { createI18nService, translationResources } from "../../../src/i18n";

describe("I18nService", () => {
	it("returns active English messages synchronously by default", () => {
		const service = createI18nService();
		expect(service.getCurrentLocale()).toBe("en");
		expect(service.translate(msg({ message: "System default", context: "common.systemDefault" }))).toBe("System default");
		expect(service.translate(msg({ message: "This week", context: "views.pomodoroStats.sections.week" }))).toBe("This week");
		expect(service.translate(msg({ message: "Start focus", context: "views.pomodoro.buttons.startFocus" }))).toBe("Start focus");
		expect(service.translate(msg({ message: "Please enter a task title", context: "modals.taskCreation.notices.titleRequired" }))).toBe("Please enter a task title");
	});

	it("switches locales and uses English source for an uncatalogued descriptor", () => {
		const service = createI18nService();
		service.setLocale("fr");
		expect(service.getCurrentLocale()).toBe("fr");
		expect(service.translate(msg({ message: "System default", context: "common.systemDefault" }))).toBe("Langue du système");
		expect(service.translate(msg({ message: "This week", context: "views.pomodoroStats.sections.week" }))).toBe("Cette semaine");
		expect(service.translate(msg({ message: "Start focus", context: "views.pomodoro.buttons.startFocus" }))).toBe("Démarrer la concentration");
		expect(service.translate(msg({ message: "Please enter a task title", context: "modals.taskCreation.notices.titleRequired" }))).toBe("Veuillez saisir un titre de tâche");
		expect(service.translate(msg({ message: "Uncatalogued source fallback", context: "test fallback" }))).toBe("Uncatalogued source fallback");
	});

	it("honours an injected system locale", () => {
		const service = createI18nService({ initialLocale: "system", getSystemLocale: () => "fr" });
		expect(service.getCurrentLocale()).toBe("fr");
		expect(service.translate(msg({ message: "Start focus", context: "views.pomodoro.buttons.startFocus" }))).toBe("Démarrer la concentration");
	});

	it("keeps service instances isolated while UI helpers follow the active plugin", () => {
		const english = createI18nService();
		const french = createI18nService({ initialLocale: "fr" });
		const start = msg({ message: "Start focus", context: "views.pomodoro.buttons.startFocus" });
		expect(english.lingui).not.toBe(french.lingui);
		expect(english.translate(start)).toBe("Start focus");
		expect(french.translate(start)).toBe("Démarrer la concentration");
		french.setLocale("de");
		expect(english.translate(start)).toBe("Start focus");
	});

	it("uses real-catalogue CLDR zero, one, few and many rather than an English suffix", () => {
		const russian = createI18nService({ initialLocale: "ru" });
		const relativeTime = msg({ message: "{minutes, plural, one {{minutes, number} minute ago} other {{minutes, number} minutes ago}}", context: "settings.integrations.timeFormats.minutesAgo" });
		expect([0, 1, 2, 5, 21].map(minutes => russian.translate(relativeTime, { minutes }))).toEqual([
			"0 минут назад", "1 минуту назад", "2 минуты назад", "5 минут назад", "21 минуту назад",
		]);
		const korean = createI18nService({ initialLocale: "ko" });
		expect([0, 1, 2, 5, 21].map(minutes => korean.translate(relativeTime, { minutes }))).toEqual([
			"0분 전", "1분 전", "2분 전", "5분 전", "21분 전",
		]);
	});

	it("exposes all nine available locales", () => {
		const service = createI18nService();
		expect(service.getAvailableLocales().sort()).toEqual(Object.keys(translationResources).sort());
	});
});
