import { msg } from "@lingui/core/macro";
import { describe, expect, it } from '@jest/globals';
import { createI18nService, translationResources } from '../../../src/i18n';
import { messageForKey } from '../../../src/i18n/messages';

describe('I18nService', () => {
    it('returns English strings by default', () => {
        const i18n = createI18nService();
        expect(i18n.getCurrentLocale()).toBe('en');
        expect(i18n.translate(msg({ message: "System default", context: "common.systemDefault" }))).toBe('System default');
        expect(i18n.translate(msg({ message: "This week", context: "views.pomodoroStats.sections.week" }))).toBe('This week');
        expect(i18n.translate(msg({ message: "Start", context: "views.pomodoro.buttons.start" }))).toBe('Start');
        expect(i18n.translate(msg({ message: "Please enter a task title", context: "modals.taskCreation.notices.titleRequired" }))).toBe('Please enter a task title');
    });

    it('switches locales and translates using fallback when key missing', () => {
        const i18n = createI18nService();
        i18n.setLocale('fr');
        expect(i18n.getCurrentLocale()).toBe('fr');
        expect(i18n.translate(msg({ message: "System default", context: "common.systemDefault" }))).toBe('Langue du système');
        expect(i18n.translate(msg({ message: "This week", context: "views.pomodoroStats.sections.week" }))).toBe('Cette semaine');
        expect(i18n.translate(msg({ message: "Start", context: "views.pomodoro.buttons.start" }))).toBe('Démarrer');
        expect(i18n.translate(msg({ message: "Please enter a task title", context: "modals.taskCreation.notices.titleRequired" }))).toBe('Veuillez saisir un titre de tâche');

        // Non-existent key falls back to English key (returns key when no locale has it)
        expect(i18n.translate(msg({ message: "Uncatalogued source fallback", context: "test fallback" }))).toBe("Uncatalogued source fallback");
    });

    it('honours system locale when set to system', () => {
        const i18n = createI18nService({
            initialLocale: 'system',
            getSystemLocale: () => 'fr'
        });
        expect(i18n.getCurrentLocale()).toBe('fr');
        expect(i18n.translate(msg({ message: "Notes", context: "views.notes.title" }))).toBe('Notes');
    });

    it('keeps service instances isolated while UI helpers follow the active plugin', () => {
        const english = createI18nService();
        const french = createI18nService({ initialLocale: 'fr' });
        const start = msg({ message: "Start", context: "views.pomodoro.buttons.start" });
        expect(english.lingui).not.toBe(french.lingui);
        expect(english.translate(start)).toBe('Start');
        expect(french.translate(start)).toBe('Démarrer');
        french.setLocale('de');
        expect(english.translate(start)).toBe('Start');
    });

    it('uses CLDR zero, one, few and many rather than an English suffix', () => {
        const russian = createI18nService({ initialLocale: 'ru' });
        const relativeTime = messageForKey('settings.integrations.timeFormats.minutesAgo');
        expect([0, 1, 2, 5, 21].map(minutes => russian.translate(relativeTime, { minutes }))).toEqual([
            '0 минут назад', '1 минуту назад', '2 минуты назад', '5 минут назад', '21 минуту назад',
        ]);
        const korean = createI18nService({ initialLocale: 'ko' });
        expect([0, 1, 2, 5, 21].map(minutes => korean.translate(relativeTime, { minutes }))).toEqual([
            '0분 전', '1분 전', '2분 전', '5분 전', '21분 전',
        ]);
    });

    it('exposes available locales from resources', () => {
        const i18n = createI18nService();
        const locales = i18n.getAvailableLocales();
        expect(locales.sort()).toEqual(Object.keys(translationResources).sort());
    });
});
