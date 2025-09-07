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

    describe('Japanese Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'ja');
        });

        it('should parse Japanese priority keywords', () => {
            const result = parser.parseInput('会議 緊急 明日');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/会議/);
        });

        it('should parse Japanese status keywords', () => {
            const result = parser.parseInput('タスク 完了');
            expect(result.status).toBe('done');
            expect(result.title).toBe('タスク');
        });

        it('should parse Japanese time estimates', () => {
            const result = parser.parseInput('タスク 2 時間 30 分');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('タスク');
        });

        it('should parse Japanese recurrence patterns', () => {
            const result = parser.parseInput('会議 毎日 チーム');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/会議.*チーム/);
        });
    });

    describe('Italian Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'it');
        });

        it('should parse Italian priority keywords', () => {
            const result = parser.parseInput('riunione urgente domani');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/riunione/);
        });

        it('should parse Italian status keywords', () => {
            const result = parser.parseInput('attività completato');
            expect(result.status).toBe('done');
            expect(result.title).toBe('attività');
        });

        it('should parse Italian time estimates', () => {
            const result = parser.parseInput('attività 2 ore 30 minuti');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('attività');
        });

        it('should parse Italian recurrence patterns', () => {
            const result = parser.parseInput('riunione giornaliera team');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/riunione.*team/);
        });
    });

    describe('Dutch Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'nl');
        });

        it('should parse Dutch priority keywords', () => {
            const result = parser.parseInput('vergadering urgent morgen');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/vergadering/);
        });

        it('should parse Dutch status keywords', () => {
            const result = parser.parseInput('taak voltooid');
            expect(result.status).toBe('done');
            expect(result.title).toBe('taak');
        });

        it('should parse Dutch time estimates', () => {
            const result = parser.parseInput('taak 2 uur 30 minuten');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('taak');
        });

        it('should parse Dutch recurrence patterns', () => {
            const result = parser.parseInput('vergadering dagelijks team');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/vergadering.*team/);
        });
    });

    describe('Portuguese Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'pt');
        });

        it('should parse Portuguese priority keywords', () => {
            const result = parser.parseInput('reunião urgente amanhã');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/reunião/);
        });

        it('should parse Portuguese status keywords', () => {
            const result = parser.parseInput('tarefa concluído');
            expect(result.status).toBe('done');
            expect(result.title).toBe('tarefa');
        });

        it('should parse Portuguese time estimates', () => {
            const result = parser.parseInput('tarefa 2 horas 30 minutos');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('tarefa');
        });

        it('should parse Portuguese recurrence patterns', () => {
            const result = parser.parseInput('reunião diária equipe');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/reunião.*equipe/);
        });
    });

    describe('Swedish Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'sv');
        });

        it('should parse Swedish priority keywords', () => {
            const result = parser.parseInput('möte brådskande imorgon');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/möte/);
        });

        it('should parse Swedish status keywords', () => {
            const result = parser.parseInput('uppgift klar');
            expect(result.status).toBe('done');
            expect(result.title).toBe('uppgift');
        });

        it('should parse Swedish time estimates', () => {
            const result = parser.parseInput('uppgift 2 timmar 30 minuter');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('uppgift');
        });

        it('should parse Swedish recurrence patterns', () => {
            const result = parser.parseInput('möte dagligen team');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/möte.*team/);
        });
    });

    describe('Ukrainian Language', () => {
        let parser: NaturalLanguageParser;

        beforeEach(() => {
            // Use empty configs to test language fallback patterns
            parser = new NaturalLanguageParser([], [], true, 'uk');
        });

        it('should parse Ukrainian priority keywords', () => {
            const result = parser.parseInput('зустріч терміново завтра');
            expect(result.priority).toBe('urgent');
            expect(result.title).toMatch(/зустріч/);
        });

        it('should parse Ukrainian status keywords', () => {
            const result = parser.parseInput('завдання виконано');
            expect(result.status).toBe('done');
            expect(result.title).toBe('завдання');
        });

        it('should parse Ukrainian time estimates', () => {
            const result = parser.parseInput('завдання 2 години 30 хвилин');
            expect(result.estimate).toBe(150); // 2*60 + 30 = 150 minutes
            expect(result.title).toBe('завдання');
        });

        it('should parse Ukrainian recurrence patterns', () => {
            const result = parser.parseInput('зустріч щодня команда');
            expect(result.recurrence).toBe('FREQ=DAILY');
            expect(result.title).toMatch(/зустріч.*команда/);
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