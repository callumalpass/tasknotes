import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';

// Exercise the installed parser and real date libraries, not the unit-suite stubs.
// Explicit paths bypass the global moduleNameMapper entries for these packages.
jest.mock('chrono-node', () => jest.requireActual('../../../node_modules/chrono-node'));
jest.mock('date-fns', () => jest.requireActual('../../../node_modules/date-fns'));

describe('Issue #2428: Italian NLP date fields and accented weekdays', () => {
    const title = 'Nome Attività';
    const parse = (expression: string) =>
        new NaturalLanguageParser([], [], true, 'it').parseInput(`${title} ${expression}`);

    test.each(['entro le 20:00', 'entro 20:00'])('%s is due, not scheduled', (expression) => {
        const result = parse(expression);
        expect(result.title).toBe(title);
        expect(result.dueTime).toBe('20:00');
        expect(result.scheduledDate).toBeUndefined();
        expect(result.scheduledTime).toBeUndefined();
    });

    test.each([
        'programmato per il', 'programmata per', 'programmata il',
        'programmata per il', 'programmato per', 'programmato il',
    ])('%s consumes the complete scheduled trigger', (trigger) => {
        const result = parse(`${trigger} 25/12/2026`);
        expect(result.title).toBe(title);
        expect(result.scheduledDate).toBe('2026-12-25');
        expect(result.dueDate).toBeUndefined();
    });

    test.each(['entro il', 'per il'])('%s remains due despite the nested il', (trigger) => {
        const result = parse(`${trigger} 25/12/2026`);
        expect(result.title).toBe(title);
        expect(result.dueDate).toBe('2026-12-25');
        expect(result.scheduledDate).toBeUndefined();
    });

    test.each([
        'programmata per il 25/12/2026 entro il 26/12/2026',
        'entro il 26/12/2026 programmata per il 25/12/2026',
    ])('keeps both fields: %s', (expression) => {
        const result = parse(expression);
        expect(result.title).toBe(title);
        expect(result.scheduledDate).toBe('2026-12-25');
        expect(result.dueDate).toBe('2026-12-26');
    });

    test.each([
        ['lunedì', 'MO'], ['martedì', 'TU'], ['mercoledì', 'WE'],
        ['giovedì', 'TH'], ['venerdì', 'FR'], ['sabato', 'SA'], ['domenica', 'SU'],
    ])('ogni %s extracts weekly recurrence', (weekday, code) => {
        const result = parse(`ogni ${weekday}`);
        expect(result.title).toBe(title);
        expect(result.recurrence).toBe(`FREQ=WEEKLY;BYDAY=${code}`);
        expect(result.scheduledDate).toBeUndefined();
        expect(result.dueDate).toBeUndefined();
    });
});
