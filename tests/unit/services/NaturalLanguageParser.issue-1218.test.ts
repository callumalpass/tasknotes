import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';

/**
 * Tests for Issue #1218: Option to enable NLP for multiple languages
 *
 * Feature Request: Allow NLP to recognize multiple languages simultaneously
 * for users who write tasks in multiple languages.
 *
 * Current behavior: Only a single language can be selected for NLP parsing.
 * Desired behavior: Multiple languages can be enabled, and the parser
 * recognizes keywords from all selected languages.
 *
 * These tests document the expected multi-language behavior.
 * They will fail until the feature is implemented.
 */
describe('NaturalLanguageParser Multi-Language Support - Issue #1218', () => {
    let mockStatusConfigs: StatusConfig[];
    let mockPriorityConfigs: PriorityConfig[];

    beforeEach(() => {
        mockStatusConfigs = [
            { id: 'open', value: 'open', label: 'Open', color: '#blue', isCompleted: false, order: 1 },
            { id: 'in-progress', value: 'in-progress', label: 'In Progress', color: '#orange', isCompleted: false, order: 2 },
            { id: 'done', value: 'done', label: 'Done', color: '#green', isCompleted: true, order: 3 }
        ];

        mockPriorityConfigs = [
            { id: 'low', value: 'low', label: 'Low', color: '#green', weight: 1 },
            { id: 'normal', value: 'normal', label: 'Normal', color: '#blue', weight: 2 },
            { id: 'high', value: 'high', label: 'High', color: '#orange', weight: 3 },
            { id: 'urgent', value: 'urgent', label: 'Urgent', color: '#red', weight: 4 }
        ];
    });

    describe('Multi-language priority recognition', () => {
        /**
         * A user who speaks both English and Spanish should be able to
         * use priority keywords from either language interchangeably.
         */
        it.skip('should recognize English priority keywords when English+Spanish are enabled', () => {
            // TODO: This test requires a multi-language parser constructor
            // Expected: new NaturalLanguageParser(statusConfigs, priorityConfigs, true, ['en', 'es'])
            const parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'en');

            const result = parser.parseInput('urgent meeting tomorrow');
            expect(result.priority).toBe('urgent');
            expect(result.title).toBe('meeting');
        });

        it.skip('should recognize Spanish priority keywords when English+Spanish are enabled', () => {
            // TODO: This test requires a multi-language parser constructor
            // With only Spanish enabled, "urgente" works but "urgent" wouldn't
            // With both enabled, both should work
            const parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'es');

            const result = parser.parseInput('reunión urgente mañana');
            expect(result.priority).toBe('urgent');
        });

        it.skip('should recognize mixed-language input with English+German enabled', () => {
            // A bilingual user might write: "dringend call with client"
            // mixing German priority keyword with English task description
            const parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'en');

            // Current behavior: "dringend" is not recognized as English doesn't know it
            // Expected behavior with multi-language: "dringend" recognized as German "urgent"
            const result = parser.parseInput('dringend call with client');
            expect(result.priority).toBe('urgent');
            expect(result.title).toBe('call with client');
        });
    });

    describe('Multi-language recurrence patterns', () => {
        it.skip('should recognize English recurrence when multiple languages enabled', () => {
            // TODO: Requires multi-language parser
            const parser = new NaturalLanguageParser([], [], true, 'en');

            const result = parser.parseInput('daily standup');
            expect(result.recurrence).toBe('FREQ=DAILY');
        });

        it.skip('should recognize French recurrence when English+French enabled', () => {
            // A French user who also uses English should be able to use
            // "quotidienne" (French for daily) in their tasks
            const parser = new NaturalLanguageParser([], [], true, 'en');

            // Current: Only works if French is the selected language
            // Expected: Works when both English and French are enabled
            const result = parser.parseInput('réunion quotidienne');
            expect(result.recurrence).toBe('FREQ=DAILY');
        });

        it.skip('should recognize "weekly" in English and "semanal" in Spanish simultaneously', () => {
            // Both should resolve to FREQ=WEEKLY when both languages enabled
            const parser = new NaturalLanguageParser([], [], true, 'en');

            const resultEn = parser.parseInput('weekly report');
            expect(resultEn.recurrence).toBe('FREQ=WEEKLY');

            // This would fail with only English enabled
            const resultEs = parser.parseInput('informe semanal');
            expect(resultEs.recurrence).toBe('FREQ=WEEKLY');
        });
    });

    describe('Multi-language status recognition', () => {
        it.skip('should recognize status keywords from multiple languages', () => {
            // A user with English+German enabled should recognize:
            // - "done", "completed" (English)
            // - "erledigt", "fertig" (German)
            const parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'en');

            // English: works
            const resultEn = parser.parseInput('task done');
            expect(resultEn.status).toBe('done');

            // German: would need multi-language support
            const resultDe = parser.parseInput('aufgabe erledigt');
            expect(resultDe.status).toBe('done');
        });
    });

    describe('Multi-language time estimate recognition', () => {
        it.skip('should recognize time estimates in multiple languages', () => {
            // A user should be able to write:
            // - "2 hours" (English)
            // - "2 horas" (Spanish)
            // - "2 heures" (French)
            // when those languages are enabled
            const parser = new NaturalLanguageParser([], [], true, 'en');

            const resultEn = parser.parseInput('task 2 hours');
            expect(resultEn.estimate).toBe(120);

            // With multi-language support, Spanish time keywords should work too
            const resultEs = parser.parseInput('tarea 2 horas');
            expect(resultEs.estimate).toBe(120);
        });
    });

    describe('Date parsing with multiple locales', () => {
        it.skip('should parse dates using multiple chrono locales', () => {
            // chrono-node supports multiple locales
            // With multi-language enabled, the parser should try each locale
            // until one successfully parses the date
            const parser = new NaturalLanguageParser([], [], true, 'en');

            // "demain" is French for "tomorrow"
            // This should work when English+French are both enabled
            const result = parser.parseInput('meeting demain');
            expect(result.scheduledDate).toBeDefined();
        });

        it.skip('should handle date parsing with German locale alongside English', () => {
            const parser = new NaturalLanguageParser([], [], true, 'en');

            // "morgen" is German for "tomorrow"
            const result = parser.parseInput('task morgen');
            expect(result.scheduledDate).toBeDefined();
        });
    });

    describe('Language priority and conflict resolution', () => {
        it.skip('should have a defined order of language priority for ambiguous terms', () => {
            // Some words might mean different things in different languages
            // The parser should have a defined priority order based on user's language list
            // e.g., if user has ['en', 'de'], English interpretations take precedence
            const parser = new NaturalLanguageParser([], [], true, 'en');

            // This is a design consideration for the implementation
            // The test documents that there should be predictable behavior
            const result = parser.parseInput('task with ambiguous term');
            expect(result).toBeDefined();
        });
    });
});
