import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';

describe('NaturalLanguageParser Multi-Language', () => {
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

    describe('English Language (Default)', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'en');
        });

        it('should parse English priority keywords', () => {
            const result = parser.parseInput('urgent meeting tomorrow');
            expect(result.priority).toBe('urgent');
            expect(result.title).toBe('meeting tomorrow');
        });

        it('should parse English status keywords', () => {
            const result = parser.parseInput('task in progress');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('task');
        });

        it('should parse English time estimates', () => {
            const result = parser.parseInput('task 2 hours 30 minutes');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('task');
        });

        it('should parse English recurrence patterns', () => {
            const result = parser.parseInput('daily standup meeting');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toBe('standup meeting');
        });
    });

    describe('Spanish Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'es');
        });

        it('should parse Spanish priority keywords', () => {
            const result = parser.parseInput('reunión urgente mañana');
            expect(result.priority).toBe('urgent');
            expect(result.title).toBe('reunión mañana');
        });

        it('should parse Spanish status keywords', () => {
            const result = parser.parseInput('tarea en progreso');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('tarea');
        });

        it('should parse Spanish time estimates', () => {
            const result = parser.parseInput('tarea 2 horas 30 minutos');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('tarea');
        });

        it('should parse Spanish recurrence patterns', () => {
            const result = parser.parseInput('reunión diaria de equipo');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toBe('reunión de equipo');
        });
    });

    describe('French Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'fr');
        });

        it('should parse French priority keywords', () => {
            const result = parser.parseInput('réunion urgente demain');
            expect(result.priority).toBe('urgent');
            expect(result.title).toBe('réunion demain');
        });

        it('should parse French status keywords', () => {
            const result = parser.parseInput('tâche en cours');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('tâche');
        });

        it('should parse French time estimates', () => {
            const result = parser.parseInput('tâche 2 heures 30 minutes');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('tâche');
        });

        it('should parse French recurrence patterns', () => {
            const result = parser.parseInput('réunion quotidienne équipe');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toBe('réunion équipe');
        });
    });

    describe('Language Fallback', () => {
        it('should fallback to English for unsupported language codes', () => {
            const parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'unsupported');
            const result = parser.parseInput('urgent task tomorrow');
            expect(result.priority).toBe('urgent');
            expect(result.title).toBe('task tomorrow');
        });
    });

    describe('User-configured Status/Priority Priority', () => {
        it('should prioritize user-configured statuses over language fallbacks', () => {
            const customStatusConfigs: StatusConfig[] = [
                { id: 'custom', value: 'custom', label: 'Custom Status', color: '#purple', isCompleted: false, order: 1 }
            ];
            
            const parser = new NaturalLanguageParser(customStatusConfigs, [], true, 'en');
            const result = parser.parseInput('task Custom Status');
            expect(result.status).toBe('custom');
            expect(result.title).toBe('task');
        });

        it('should prioritize user-configured priorities over language fallbacks', () => {
            const customPriorityConfigs: PriorityConfig[] = [
                { id: 'custom', value: 'custom', label: 'Custom Priority', color: '#purple', weight: 5 }
            ];
            
            const parser = new NaturalLanguageParser([], customPriorityConfigs, true, 'en');
            const result = parser.parseInput('task Custom Priority');
            expect(result.priority).toBe('custom');
            expect(result.title).toBe('task');
        });
    });
});