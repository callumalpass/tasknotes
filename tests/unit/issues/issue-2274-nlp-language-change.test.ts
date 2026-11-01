import type TaskNotesPlugin from '../../../src/main';
import { InstantTaskConvertService } from '../../../src/services/InstantTaskConvertService';
import { buildSettingsFromLoadedData } from '../../../src/settings/settingsPersistence';

// Exercise the installed parser and real date libraries, not the unit-suite stubs.
jest.mock('chrono-node', () => jest.requireActual('../../../node_modules/chrono-node'));
jest.mock('date-fns', () => jest.requireActual('../../../node_modules/date-fns'));

describe('Issue #2274: NLP language changes apply without a reload', () => {
	it('instant conversion parses with the language chosen after the service was created', () => {
		const settings = buildSettingsFromLoadedData(null).settings;
		const plugin = { settings } as TaskNotesPlugin;
		const service = new InstantTaskConvertService(plugin, {} as never, {} as never) as unknown as {
			tryNLPFallback(taskLine: string, details: string): { title: string; scheduledDate?: string } | null;
		};

		expect(service.tryNLPFallback('- [ ] Comprare latte domani', '')).toMatchObject({
			title: 'Comprare latte domani',
			scheduledDate: undefined,
		});

		settings.nlpLanguage = 'it';
		const italian = service.tryNLPFallback('- [ ] Comprare latte domani', '');
		expect(italian?.title).toBe('Comprare latte');
		expect(italian?.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
