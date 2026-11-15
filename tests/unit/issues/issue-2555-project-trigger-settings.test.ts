/**
 * Issue #2555: `- [ ] Send Report tomorrow !high +Admin` converted with scheduled and
 * priority but no project, and "+Admin" stayed in the title, while the settings tab showed
 * the project trigger as enabled with "+".
 *
 * The settings tab falls back to the default for a project trigger that is missing from
 * saved data, empty, or padded with whitespace; the parser used the saved value as-is.
 */
import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { DEFAULT_NLP_TRIGGERS } from '../../../src/settings/defaults';
import { buildSettingsFromLoadedData } from '../../../src/settings/settingsPersistence';

jest.mock('chrono-node', () => jest.requireActual('../../../node_modules/chrono-node'));
jest.mock('date-fns', () => jest.requireActual('../../../node_modules/date-fns'));

const savedTriggers = (project: { trigger: string; enabled: boolean } | null) => [
	...DEFAULT_NLP_TRIGGERS.triggers
		.filter((t) => t.propertyId !== 'projects')
		.map((t) => (t.propertyId === 'priority' ? { ...t, enabled: true } : { ...t })),
	...(project ? [{ propertyId: 'projects', ...project }] : []),
];

const parseWithSaved = (triggers: ReturnType<typeof savedTriggers>, input: string) => {
	const { settings } = buildSettingsFromLoadedData({ nlpTriggers: { triggers } } as never);
	return new NaturalLanguageParser(
		settings.customStatuses,
		settings.customPriorities,
		true,
		'en',
		settings.nlpTriggers,
		settings.userFields
	).parseInput(input);
};

describe('Issue #2555: saved project trigger matches what settings shows', () => {
	test.each([
		['missing from saved data', null],
		['saved empty', { trigger: '', enabled: true }],
		['saved with trailing space', { trigger: '+ ', enabled: true }],
		['saved with leading space', { trigger: ' +', enabled: true }],
	])('project trigger %s still extracts the project', (_label, project) => {
		for (const [input, projectValue] of [
			['Send Report tomorrow !high +Admin', 'Admin'],
			['Send Report tomorrow !high +[[Admin]]', '[[Admin]]'],
		]) {
			const result = parseWithSaved(savedTriggers(project), input);
			expect(result.title).toBe('Send Report');
			expect(result.projects).toEqual([projectValue]);
			expect(result.priority).toBe('high');
			expect(result.scheduledDate).toBeDefined();
		}
	});

	test('an explicitly disabled project trigger stays disabled', () => {
		const result = parseWithSaved(
			savedTriggers({ trigger: '+', enabled: false }),
			'!high Send Report +Admin'
		);
		expect(result.projects).toEqual([]);
		expect(result.title).toBe('Send Report +Admin');
		expect(result.priority).toBe('high');
	});
});
