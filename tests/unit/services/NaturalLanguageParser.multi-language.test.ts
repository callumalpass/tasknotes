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
            expect(result.title).toBe('meeting');
            expect(result.scheduledDate).toBeDefined(); // "tomorrow" should be parsed as a date
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
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'es');
        });

        it('should parse Spanish priority keywords', () => {
            const result = parser.parseInput('reunión urgente mañana');
            expect(result.priority).toBe('urgent');
            // Note: chrono-node's Spanish support is partial, so "mañana" may not be parsed
            expect(result.title).toMatch(/reunión/);
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
            expect(result.title).toMatch(/reunión.*equipo/);
        });
    });

    describe('French Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'fr');
        });

        it('should parse French priority keywords', () => {
            const result = parser.parseInput('réunion urgent demain');
            expect(result.priority).toBe('urgent');
            // Note: chrono-node French support may vary for different date words
            expect(result.title).toMatch(/réunion/);
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
            expect(result.title).toMatch(/réunion.*équipe/);
        });
    });

    describe('German Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'de');
        });

        it('should parse German priority keywords', () => {
            const result = parser.parseInput('meeting dringend morgen');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/meeting/);
        });

        it('should parse German status keywords', () => {
            const result = parser.parseInput('aufgabe erledigt');
            expect(result.status).toBe('done');
            expect(result.title).toBe('aufgabe');
        });

        it('should parse German time estimates', () => {
            const result = parser.parseInput('aufgabe 2 stunden 30 minuten');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('aufgabe');
        });

        it('should parse German recurrence patterns', () => {
            const result = parser.parseInput('meeting täglich team');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/meeting.*team/);
        });
    });

    describe('Russian Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'ru');
        });

        it('should parse Russian priority keywords', () => {
            const result = parser.parseInput('встреча срочно завтра');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/встреча/);
        });

        it('should parse Russian status keywords', () => {
            const result = parser.parseInput('задача выполнено');
            expect(result.status).toBe('done');
            expect(result.title).toBe('задача');
        });

        it('should parse Russian time estimates', () => {
            const result = parser.parseInput('задача 2 часа 30 минут');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('задача');
        });

        it('should parse Russian recurrence patterns', () => {
            const result = parser.parseInput('встреча ежедневно команда');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/встреча.*команда/);
        });
    });

    describe('Chinese Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'zh');
        });

        it('should parse Chinese priority keywords', () => {
            const result = parser.parseInput('会议 紧急 明天');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/会议/);
        });

        it('should parse Chinese status keywords', () => {
            const result = parser.parseInput('任务 完成');
            expect(result.status).toBe('done');
            expect(result.title).toBe('任务');
        });

        it('should parse Chinese time estimates', () => {
            const result = parser.parseInput('任务 2 小时 30 分钟');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('任务');
        });

        it('should parse Chinese recurrence patterns', () => {
            const result = parser.parseInput('会议 每天 团队');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/会议.*团队/);
        });
    });

    describe('Language Fallback', () => {
        it('should fallback to English for unsupported language codes', () => {
            const parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true, 'unsupported');
            const result = parser.parseInput('urgent task tomorrow');
            expect(result.priority).toBe('urgent');
            expect(result.title).toBe('task');
            expect(result.scheduledDate).toBeDefined(); // "tomorrow" should be parsed as a date
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
                { id: 'custom', value: 'custom', label: 'CustomPriority', color: '#purple', weight: 5 }
            ];
            
            const parser = new NaturalLanguageParser([], customPriorityConfigs, true, 'en');
            const result = parser.parseInput('CustomPriority important task');
            expect(result.priority).toBe('custom');
            expect(result.title).toBe('important task');
        });
    });
});