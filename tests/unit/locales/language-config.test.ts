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
    });

    describe('getAvailableLanguages', () => {
        it('should return available languages for settings dropdown', () => {
            const languages = getAvailableLanguages();
            expect(languages).toEqual([
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
                { value: 'fr', label: 'Français' }
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
            (global as any).navigator = { language: 'es-ES' };
            
            const detected = detectSystemLanguage();
            expect(detected).toBe('es');
            
            // Restore original navigator
            global.navigator = originalNavigator;
        });

        it('should fallback to English for unsupported system language', () => {
            // Mock navigator.language
            const originalNavigator = global.navigator;
            (global as any).navigator = { language: 'de-DE' }; // German not supported yet
            
            const detected = detectSystemLanguage();
            expect(detected).toBe('en');
            
            // Restore original navigator
            global.navigator = originalNavigator;
        });

        it('should fallback to English when navigator is not available', () => {
            // Mock no navigator
            const originalNavigator = global.navigator;
            (global as any).navigator = undefined;
            
            const detected = detectSystemLanguage();
            expect(detected).toBe('en');
            
            // Restore original navigator
            global.navigator = originalNavigator;
        });
    });

    describe('Language Configuration Structure', () => {
        it('should have consistent structure across all languages', () => {
            const languages = ['en', 'es', 'fr'];
            
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