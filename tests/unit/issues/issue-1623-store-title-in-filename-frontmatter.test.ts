/**
 * Issue #1623: "Store title in filename" still saves title in frontmatter
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1623
 *
 * Docs currently state that when `storeTitleInFilename` is enabled,
 * the `title` property is removed from frontmatter.
 *
 * Current behavior in code keeps title in frontmatter (changed in PR #1608).
 * This test documents the reported expectation from issue #1623.
 */

import { FieldMapper } from '../../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import type { TaskInfo } from '../../../src/types';
import { PluginFactory } from '../../helpers/mock-factories';
import { TaskCreationService } from '../../../src/services/task-service/TaskCreationService';
import { TaskService } from '../../../src/services/TaskService';

jest.mock('../../../src/utils/dateUtils', () => ({
	getCurrentTimestamp: jest.fn(() => '2026-05-17T00:00:00+10:00'),
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
	generateTaskFilename: jest.fn(() => 'plan-quarterly-review'),
	generateUniqueFilename: jest.fn(() => 'plan-quarterly-review'),
}));

jest.mock('../../../src/utils/helpers', () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

describe('Issue #1623: Store title in filename still writes title frontmatter', () => {
	it('omits title from mapped frontmatter when storeTitleInFilename=true', () => {
		const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);

		const taskData: Partial<TaskInfo> = {
			title: 'Plan quarterly review',
			status: 'open',
			priority: 'normal',
			path: 'tasks/Plan quarterly review.md',
			archived: false,
		};

		const frontmatter = fieldMapper.mapToFrontmatter(
			taskData,
			undefined,
			true // storeTitleInFilename
		);

		// Expected per docs (current code behavior differs): no title in frontmatter.
		expect(frontmatter).not.toHaveProperty(DEFAULT_FIELD_MAPPING.title);
	});

	it('omits title frontmatter when creating through the shared task creation service', async () => {
		const mockPlugin = PluginFactory.createMockPlugin();
		mockPlugin.settings.storeTitleInFilename = true;

		const service = new TaskCreationService({
			runtime: mockPlugin,
			applyTaskCreationDefaults: jest.fn(async (taskData) => taskData),
			applyTemplate: jest.fn(async () => ({ frontmatter: {}, body: "" })),
			processFolderTemplate: jest.fn((folderTemplate) => folderTemplate),
			sanitizeTitleForFilename: jest.fn((input) => input),
			sanitizeTitleForStorage: jest.fn((input) => input),
		});

		await service.createTask(
			{
				title: 'Plan quarterly review',
			},
			{ applyDefaults: false }
		);

		const [, content] = mockPlugin.app.vault.create.mock.calls[0] as [string, string];

		expect(content).not.toContain('title:');
		expect(mockPlugin.cacheManager.updateTaskInfoInCache).toHaveBeenCalledWith(
			'Tasks/plan-quarterly-review.md',
			expect.objectContaining({ title: 'Plan quarterly review' })
		);
	});

	it('removes stale title frontmatter when updating another field', async () => {
		const mockPlugin = PluginFactory.createMockPlugin();
		mockPlugin.settings.storeTitleInFilename = true;
		const service = new TaskService(mockPlugin);
		const task = {
			title: 'Plan quarterly review',
			status: 'open',
			priority: 'normal',
			path: 'Tasks/Plan quarterly review.md',
			archived: false,
			tags: ['task'],
		};
		let capturedFrontmatter: Record<string, unknown> = {};

		mockPlugin.app.fileManager.processFrontMatter.mockImplementation(async (_file, fn) => {
			capturedFrontmatter = {
				title: 'Plan quarterly review',
				status: 'open',
				priority: 'normal',
			};
			fn(capturedFrontmatter);
		});

		await service.updateTask(task, { priority: 'high' });

		expect(capturedFrontmatter.title).toBeUndefined();
		expect(capturedFrontmatter.priority).toBe('high');
	});
});
