/**
 * Issue #2246: Occurrence filename template writes title frontmatter,
 * so views display the title without the period suffix
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2246
 *
 * With `storeTitleInFilename` enabled, a templated occurrence filename
 * (e.g. "Pay rent — 2026-09") never equals the plain title, so the
 * `titleIsRepresentedByFilename` check from the collision-handling fix
 * always fails and every occurrence is born with a title property.
 * The title property then wins over the filename when reading, hiding
 * the period suffix in every view.
 *
 * Expected: when the templated filename is used as-is (no collision
 * suffix, no sanitization loss), the filename represents the title and
 * the title property should be omitted — matching the behavior for
 * regular tasks whose filename equals their title.
 */

import type { TaskInfo } from '../../../src/types';
import { PluginFactory } from '../../helpers/mock-factories';
import { TaskCreationService } from '../../../src/services/task-service/TaskCreationService';
import {
	generateTaskFilename,
	generateUniqueFilename,
	generateOccurrenceFilename,
} from '../../../src/utils/filenameGenerator';

jest.mock('../../../src/utils/dateUtils', () => ({
	getCurrentTimestamp: jest.fn(() => '2026-08-20T00:00:00-03:00'),
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
	generateTaskFilename: jest.fn(() => 'Pay rent'),
	generateUniqueFilename: jest.fn(async (base) => base),
	generateOccurrenceFilename: jest.fn(() => 'Pay rent — 2026-09'),
}));

jest.mock('../../../src/utils/helpers', () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

describe('Issue #2246: occurrence filename template vs title frontmatter', () => {
	const mockGenerateUniqueFilename = generateUniqueFilename as jest.MockedFunction<
		typeof generateUniqueFilename
	>;
	const mockGenerateOccurrenceFilename = generateOccurrenceFilename as jest.MockedFunction<
		typeof generateOccurrenceFilename
	>;
	const mockGenerateTaskFilename = generateTaskFilename as jest.MockedFunction<
		typeof generateTaskFilename
	>;

	beforeEach(() => {
		mockGenerateTaskFilename.mockReturnValue('Pay rent');
		mockGenerateOccurrenceFilename.mockReturnValue('Pay rent — 2026-09');
		mockGenerateUniqueFilename.mockImplementation(async (base) => base);
	});

	function createService(overrides: { sanitizeForFilename?: (input: string) => string } = {}) {
		const mockPlugin = PluginFactory.createMockPlugin();
		mockPlugin.settings.storeTitleInFilename = true;

		const service = new TaskCreationService({
			runtime: mockPlugin,
			applyTaskCreationDefaults: jest.fn(async (taskData) => taskData),
			applyTemplate: jest.fn(async () => ({ frontmatter: {}, body: '' })),
			processFolderTemplate: jest.fn((folderTemplate) => folderTemplate),
			sanitizeTitleForFilename: jest.fn(overrides.sanitizeForFilename ?? ((input) => input)),
			sanitizeTitleForStorage: jest.fn((input) => input),
		});

		return { mockPlugin, service };
	}

	const occurrenceTaskData: Partial<TaskInfo> = {
		title: 'Pay rent',
		recurrence_parent: '[[Tasks/Pay rent]]',
		occurrence_date: '2026-09-01',
		occurrenceFilenameTemplate: '{{title}} — {{occurrenceMonth}}',
	};

	it('omits title frontmatter when the templated occurrence filename is used as-is', async () => {
		const { mockPlugin, service } = createService();

		await service.createTask({ ...occurrenceTaskData }, { applyDefaults: false });

		const [path, content] = mockPlugin.app.vault.create.mock.calls[0] as [string, string];

		expect(path).toBe('Tasks/Pay rent — 2026-09.md');
		expect(content).not.toContain('title:');
		expect(mockPlugin.cacheManager.updateTaskInfoInCache).toHaveBeenCalledWith(
			'Tasks/Pay rent — 2026-09.md',
			expect.objectContaining({ title: 'Pay rent' })
		);
	});

	it('preserves title frontmatter when the templated filename needs a collision suffix', async () => {
		mockGenerateUniqueFilename.mockResolvedValue('Pay rent — 2026-09-1');
		const { mockPlugin, service } = createService();

		await service.createTask({ ...occurrenceTaskData }, { applyDefaults: false });

		const [path, content] = mockPlugin.app.vault.create.mock.calls[0] as [string, string];

		expect(path).toBe('Tasks/Pay rent — 2026-09-1.md');
		expect(content).toContain('title: Pay rent');
	});

	it('preserves title frontmatter when filename sanitization changes the title', async () => {
		mockGenerateOccurrenceFilename.mockReturnValue('Pay rent — 2026-09');
		const { mockPlugin, service } = createService({
			sanitizeForFilename: (input) => input.replace(/:/g, ''),
		});

		await service.createTask(
			{ ...occurrenceTaskData, title: 'Pay: rent' },
			{ applyDefaults: false }
		);

		const [, content] = mockPlugin.app.vault.create.mock.calls[0] as [string, string];

		expect(content).toContain('title: "Pay: rent"');
	});
});
