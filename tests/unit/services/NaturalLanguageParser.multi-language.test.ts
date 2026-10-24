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

        it('should parse various English recurrence patterns', () => {
            let result = parser.parseInput('weekly report');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            result = parser.parseInput('meeting every 2 months');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            result = parser.parseInput('cleanup every other day');
            expect(result.recurrence).toBe('FREQ=DAILY;INTERVAL=2');
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
            expect(result.title).toMatch(/reunión/);
        });

        it('should parse various Spanish priority keywords', () => {
            let result = parser.parseInput('tarea de prioridad alta');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('tarea de prioridad');

            result = parser.parseInput('tarea de prioridad baja');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('tarea de prioridad');
        });

        it('should parse Spanish status keywords', () => {
            const result = parser.parseInput('tarea en progreso');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('tarea');
        });

        it('should parse various Spanish status keywords', () => {
            let result = parser.parseInput('tarea hecho');
            expect(result.status).toBe('done');
            expect(result.title).toBe('tarea');

            result = parser.parseInput('tarea cancelado');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Spanish recurrence patterns', () => {
            let result = parser.parseInput('reunión semanal');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('reunión');

            result = parser.parseInput('revisión cada 2 meses');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('revisión');
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
            expect(result.title).toMatch(/réunion/);
        });

        it('should parse various French priority keywords', () => {
            let result = parser.parseInput('tâche de priorité important');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('tâche de priorité');

            result = parser.parseInput('tâche de priorité bas');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('tâche de priorité');
        });

        it('should parse French status keywords', () => {
            const result = parser.parseInput('tâche en cours');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('tâche');
        });

        it('should parse various French status keywords', () => {
            let result = parser.parseInput('tâche fait');
            expect(result.status).toBe('done');
            expect(result.title).toBe('tâche');

            result = parser.parseInput('tâche abandonné');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex French recurrence patterns', () => {
            let result = parser.parseInput('rapport hebdomadaire');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('rapport');

            result = parser.parseInput('réunion tous les 2 mois');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('réunion');
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

        it('should parse various German priority keywords', () => {
            let result = parser.parseInput('Aufgabe mit hohe Priorität');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('Aufgabe mit Priorität');

            result = parser.parseInput('Aufgabe mit niedrige Priorität');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('Aufgabe mit Priorität');
        });

        it('should parse German status keywords', () => {
            const result = parser.parseInput('aufgabe erledigt');
            expect(result.status).toBe('done');
            expect(result.title).toBe('aufgabe');
        });

        it('should parse various German status keywords', () => {
            let result = parser.parseInput('Aufgabe in arbeit');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('Aufgabe');

            result = parser.parseInput('Aufgabe abgesagt');
            expect(result.status).toBe('cancelled');
            expect(result.title).toBe('Aufgabe');
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

        it('should parse complex German recurrence patterns', () => {
            let result = parser.parseInput('wöchentlich Bericht');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('Bericht');

            result = parser.parseInput('alle 2 Monate überprüfen');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('überprüfen');
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

        it('should parse various Russian priority keywords', () => {
            let result = parser.parseInput('задача высокий приоритет');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('задача приоритет');

            result = parser.parseInput('задача низкий приоритет');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('задача приоритет');
        });

        it('should parse Russian status keywords', () => {
            const result = parser.parseInput('задача выполнено');
            expect(result.status).toBe('done');
            expect(result.title).toBe('задача');
        });

        it('should parse various Russian status keywords', () => {
            let result = parser.parseInput('задача в процессе');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('задача');

            result = parser.parseInput('задача отменено');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Russian recurrence patterns', () => {
            let result = parser.parseInput('еженедельно отчет');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('отчет');

            result = parser.parseInput('каждый 2 месяц');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('Untitled Task');
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

        it('should parse various Chinese priority keywords', () => {
            let result = parser.parseInput('任务 高 优先级');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('任务 优先级');

            result = parser.parseInput('任务 低 优先级');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('任务 优先级');
        });

        it('should parse Chinese status keywords', () => {
            const result = parser.parseInput('任务 完成');
            expect(result.status).toBe('done');
            expect(result.title).toBe('任务');
        });

        it('should parse various Chinese status keywords', () => {
            let result = parser.parseInput('任务 进行中');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('任务');

            result = parser.parseInput('任务 已取消');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Chinese recurrence patterns', () => {
            let result = parser.parseInput('每周 报告');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('报告');

            result = parser.parseInput('每 2 个月 检查');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('检查');
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

        it('should parse various Japanese priority keywords', () => {
            let result = parser.parseInput('タスク 優先度 高');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('タスク 優先度');

            result = parser.parseInput('タスク 優先度 低');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('タスク 優先度');
        });

        it('should parse Japanese status keywords', () => {
            const result = parser.parseInput('タスク 完了');
            expect(result.status).toBe('done');
            expect(result.title).toBe('タスク');
        });

        it('should parse various Japanese status keywords', () => {
            let result = parser.parseInput('タスク 進行中');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('タスク');

            result = parser.parseInput('タスク キャンセル');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Japanese recurrence patterns', () => {
            let result = parser.parseInput('毎週 レポート');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('レポート');

            result = parser.parseInput('毎 2 ヶ月 確認');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('確認');
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

        it('should parse various Italian priority keywords', () => {
            let result = parser.parseInput('attività con priorità alta');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('attività con priorità');

            result = parser.parseInput('attività con priorità bassa');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('attività con priorità');
        });

        it('should parse Italian status keywords', () => {
            const result = parser.parseInput('attività completato');
            expect(result.status).toBe('done');
            expect(result.title).toBe('attività');
        });

        it('should parse various Italian status keywords', () => {
            let result = parser.parseInput('attività in corso');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('attività');

            result = parser.parseInput('attività annullato');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Italian recurrence patterns', () => {
            let result = parser.parseInput('rapporto settimanale');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('rapporto');

            result = parser.parseInput('controllo ogni 2 mesi');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('controllo');
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

        it('should parse various Dutch priority keywords', () => {
            let result = parser.parseInput('taak met hoge prioriteit');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('taak met prioriteit');

            result = parser.parseInput('taak met lage prioriteit');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('taak met prioriteit');
        });

        it('should parse Dutch status keywords', () => {
            const result = parser.parseInput('taak voltooid');
            expect(result.status).toBe('done');
            expect(result.title).toBe('taak');
        });

        it('should parse various Dutch status keywords', () => {
            let result = parser.parseInput('taak in uitvoering');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('taak');

            result = parser.parseInput('taak geannuleerd');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Dutch recurrence patterns', () => {
            let result = parser.parseInput('wekelijks rapport');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('rapport');

            result = parser.parseInput('elke 2 maanden controleren');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('controleren');
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

        it('should parse various Portuguese priority keywords', () => {
            let result = parser.parseInput('tarefa com prioridade alta');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('tarefa com prioridade');

            result = parser.parseInput('tarefa com prioridade baixa');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('tarefa com prioridade');
        });

        it('should parse Portuguese status keywords', () => {
            const result = parser.parseInput('tarefa concluído');
            expect(result.status).toBe('done');
            expect(result.title).toBe('tarefa');
        });

        it('should parse various Portuguese status keywords', () => {
            let result = parser.parseInput('tarefa em andamento');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('tarefa');

            result = parser.parseInput('tarefa cancelado');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Portuguese recurrence patterns', () => {
            let result = parser.parseInput('relatório semanal');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('relatório');

            result = parser.parseInput('verificar cada 2 meses');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('verificar');
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

        it('should parse various Swedish priority keywords', () => {
            let result = parser.parseInput('uppgift med hög prioritet');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('uppgift med prioritet');

            result = parser.parseInput('uppgift med låg prioritet');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('uppgift med prioritet');
        });

        it('should parse Swedish status keywords', () => {
            const result = parser.parseInput('uppgift klar');
            expect(result.status).toBe('done');
            expect(result.title).toBe('uppgift');
        });

        it('should parse various Swedish status keywords', () => {
            let result = parser.parseInput('uppgift pågående');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('uppgift');

            result = parser.parseInput('uppgift avbruten');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Swedish recurrence patterns', () => {
            let result = parser.parseInput('veckovis rapport');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('rapport');

            result = parser.parseInput('kontroll varje annan månad');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('kontroll');
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

        it('should parse various Ukrainian priority keywords', () => {
            let result = parser.parseInput('завдання високий пріоритет');
            expect(result.priority).toBe('high');
            expect(result.title).toBe('завдання пріоритет');

            result = parser.parseInput('завдання низький пріоритет');
            expect(result.priority).toBe('low');
            expect(result.title).toBe('завдання пріоритет');
        });

        it('should parse Ukrainian status keywords', () => {
            const result = parser.parseInput('завдання виконано');
            expect(result.status).toBe('done');
            expect(result.title).toBe('завдання');
        });

        it('should parse various Ukrainian status keywords', () => {
            let result = parser.parseInput('завдання в процесі');
            expect(result.status).toBe('in-progress');
            expect(result.title).toBe('завдання');

            result = parser.parseInput('завдання скасовано');
            expect(result.status).toBe('cancelled');
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

        it('should parse complex Ukrainian recurrence patterns', () => {
            let result = parser.parseInput('щотижня звіт');
            expect(result.recurrence).toBe('FREQ=WEEKLY');
            expect(result.title).toBe('звіт');

            result = parser.parseInput('перевірка кожен 2 місяці');
            expect(result.recurrence).toBe('FREQ=MONTHLY;INTERVAL=2');
            expect(result.title).toBe('перевірка');
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