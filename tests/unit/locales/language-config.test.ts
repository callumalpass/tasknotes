import { languageRegistry, getAvailableLanguages, getLanguageConfig, detectSystemLanguage } from '../../../src/locales';

describe('Language Configuration System', () => {
    describe('Language Registry', () => {
        it('should contain English configuration', () => {
            expect(languageRegistry['en']).toBeDefined();
            expect(languageRegistry['en'].name).toBe('English');
            expect(languageRegistry['en'].code).toBe('en');
        });

        it('should contain Spanish configuration', () => {
            expect(languageRegistry['es']).toBeDefined();
            expect(languageRegistry['es'].name).toBe('Español');
            expect(languageRegistry['es'].code).toBe('es');
        });

        it('should contain French configuration', () => {
            expect(languageRegistry['fr']).toBeDefined();
            expect(languageRegistry['fr'].name).toBe('Français');
            expect(languageRegistry['fr'].code).toBe('fr');
        });

        it('should contain German configuration', () => {
            expect(languageRegistry['de']).toBeDefined();
            expect(languageRegistry['de'].name).toBe('Deutsch');
            expect(languageRegistry['de'].code).toBe('de');
        });

        it('should contain Russian configuration', () => {
            expect(languageRegistry['ru']).toBeDefined();
            expect(languageRegistry['ru'].name).toBe('Русский');
            expect(languageRegistry['ru'].code).toBe('ru');
        });

        it('should contain Chinese configuration', () => {
            expect(languageRegistry['zh']).toBeDefined();
            expect(languageRegistry['zh'].name).toBe('中文');
            expect(languageRegistry['zh'].code).toBe('zh');
        });

        it('should contain Japanese configuration', () => {
            expect(languageRegistry['ja']).toBeDefined();
            expect(languageRegistry['ja'].name).toBe('日本語');
            expect(languageRegistry['ja'].code).toBe('ja');
        });

        it('should contain Italian configuration', () => {
            expect(languageRegistry['it']).toBeDefined();
            expect(languageRegistry['it'].name).toBe('Italiano');
            expect(languageRegistry['it'].code).toBe('it');
        });

        it('should contain Dutch configuration', () => {
            expect(languageRegistry['nl']).toBeDefined();
            expect(languageRegistry['nl'].name).toBe('Nederlands');
            expect(languageRegistry['nl'].code).toBe('nl');
        });

        it('should contain Portuguese configuration', () => {
            expect(languageRegistry['pt']).toBeDefined();
            expect(languageRegistry['pt'].name).toBe('Português');
            expect(languageRegistry['pt'].code).toBe('pt');
        });

        it('should contain Swedish configuration', () => {
            expect(languageRegistry['sv']).toBeDefined();
            expect(languageRegistry['sv'].name).toBe('Svenska');
            expect(languageRegistry['sv'].code).toBe('sv');
        });

        it('should contain Ukrainian configuration', () => {
            expect(languageRegistry['uk']).toBeDefined();
            expect(languageRegistry['uk'].name).toBe('Українська');
            expect(languageRegistry['uk'].code).toBe('uk');
        });
    });

    describe('getAvailableLanguages', () => {
        it('should return available languages for settings dropdown', () => {
            const languages = getAvailableLanguages();
            expect(languages).toEqual([
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
                { value: 'fr', label: 'Français' },
                { value: 'de', label: 'Deutsch' },
                { value: 'ru', label: 'Русский' },
                { value: 'zh', label: '中文' },
                { value: 'ja', label: '日本語' },
                { value: 'it', label: 'Italiano' },
                { value: 'nl', label: 'Nederlands' },
                { value: 'pt', label: 'Português' },
                { value: 'sv', label: 'Svenska' },
                { value: 'uk', label: 'Українська' }
            ]);
        });
    });

    describe('getLanguageConfig', () => {
        it('should return correct config for valid language code', () => {
            const config = getLanguageConfig('es');
            expect(config.code).toBe('es');
            expect(config.name).toBe('Español');
        });

        it('should fallback to English for invalid language code', () => {
            const config = getLanguageConfig('invalid');
            expect(config.code).toBe('en');
            expect(config.name).toBe('English');
        });
    });

    describe('detectSystemLanguage', () => {
        it('should return supported language if available', () => {
            // Mock navigator.language
            const originalNavigator = global.navigator;
            const mockNavigator = { language: 'es-ES' };
            Object.defineProperty(global, 'navigator', {
                value: mockNavigator,
                writable: true
            });
            
            const detected = detectSystemLanguage();
            expect(detected).toBe('es');
            
            // Restore original navigator
            Object.defineProperty(global, 'navigator', {
                value: originalNavigator,
                writable: true
            });
        });

        it('should fallback to English for unsupported system language', () => {
            // Mock navigator.language
            const originalNavigator = global.navigator;
            const mockNavigator = { language: 'ko-KR' }; // Korean not supported
            Object.defineProperty(global, 'navigator', {
                value: mockNavigator,
                writable: true
            });
            
            const detected = detectSystemLanguage();
            expect(detected).toBe('en');
            
            // Restore original navigator
            Object.defineProperty(global, 'navigator', {
                value: originalNavigator,
                writable: true
            });
        });

        it('should fallback to English when navigator is not available', () => {
            // Mock no navigator
            const originalNavigator = global.navigator;
            Object.defineProperty(global, 'navigator', {
                value: undefined,
                writable: true
            });
            
            const detected = detectSystemLanguage();
            expect(detected).toBe('en');
            
            // Restore original navigator
            Object.defineProperty(global, 'navigator', {
                value: originalNavigator,
                writable: true
            });
        });
    });

    describe('Language Configuration Structure', () => {
        it('should have consistent structure across all languages', () => {
            const languages = ['en', 'es', 'fr', 'de', 'ru', 'zh', 'ja', 'it', 'nl', 'pt', 'sv', 'uk'];
            
            languages.forEach(langCode => {
                const config = languageRegistry[langCode];
                expect(config).toBeDefined();
                
                // Check required fields
                expect(config.code).toBe(langCode);
                expect(config.name).toBeDefined();
                expect(config.chronoLocale).toBeDefined();
                
                // Check structure of dateTriggers
                expect(config.dateTriggers.due).toBeDefined();
                expect(config.dateTriggers.scheduled).toBeDefined();
                expect(Array.isArray(config.dateTriggers.due)).toBe(true);
                expect(Array.isArray(config.dateTriggers.scheduled)).toBe(true);
                
                // Check recurrence structure
                expect(config.recurrence.frequencies).toBeDefined();
                expect(config.recurrence.weekdays).toBeDefined();
                expect(config.recurrence.ordinals).toBeDefined();
                
                // Check time estimate structure
                expect(config.timeEstimate.hours).toBeDefined();
                expect(config.timeEstimate.minutes).toBeDefined();
                expect(Array.isArray(config.timeEstimate.hours)).toBe(true);
                expect(Array.isArray(config.timeEstimate.minutes)).toBe(true);
                
                // Check fallback patterns
                expect(config.fallbackStatus).toBeDefined();
                expect(config.fallbackPriority).toBeDefined();
            });
        });
    });
});