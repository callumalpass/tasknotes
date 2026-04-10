/**
 * Coverage for issue #1684.
 *
 * Current behavior:
 * - TaskNotes does not use a hidden task ID for discovery; `TaskManager`
 *   exposes the markdown file path as the task `id`.
 * - Hand-authored markdown files are recognized when their YAML frontmatter
 *   matches the configured task-identification settings.
 * - Plain markdown checkboxes in note bodies are not indexed as tasks; they
 *   only become TaskNotes through the separate inline conversion flow.
 */

import { FieldMapper } from '../../../src/services/FieldMapper';
import {
	DEFAULT_FIELD_MAPPING,
	DEFAULT_SETTINGS,
} from '../../../src/settings/defaults';
import { TaskManager } from '../../../src/utils/TaskManager';
import { MockObsidian } from 'obsidian';

jest.mock('obsidian');

function makeTaskManager(settingsOverrides: Record<string, unknown> = {}) {
	const app = MockObsidian.createMockApp();
	const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
	const settings = { ...DEFAULT_SETTINGS, ...settingsOverrides } as any;
	const cache = new TaskManager(app as any, settings, mapper);
	cache.initialize();

	return { app, cache };
}

describe('Issue #1684: Plain markdown task discovery', () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it('recognizes a hand-authored task file without any hidden ID', async () => {
		const { app, cache } = makeTaskManager();
		const taskPath = 'Tasks/manual-frontmatter-task.md';

		await app.vault.create(
			taskPath,
			[
				'---',
				'title: Manual frontmatter task',
				'status: open',
				'priority: normal',
				'tags:',
				'  - task',
				'---',
				'',
				'Created outside the plugin.',
				'',
			].join('\n')
		);
		app.metadataCache.setCache(taskPath, {
			frontmatter: {
				title: 'Manual frontmatter task',
				status: 'open',
				priority: 'normal',
				tags: ['task'],
			},
		});

		const task = await cache.getTaskInfo(taskPath);

		expect(task).toMatchObject({
			id: taskPath,
			path: taskPath,
			title: 'Manual frontmatter task',
			status: 'open',
			priority: 'normal',
			tags: ['task'],
		});
	});

	it.skip('reproduces issue #1684 - a plain markdown checkbox should be discoverable without frontmatter conversion', async () => {
		const { app, cache } = makeTaskManager();

		await app.vault.create(
			'Inbox/plain-markdown-task.md',
			[
				'# Scratchpad',
				'',
				'- [ ] Draft release notes',
				'',
			].join('\n')
		);

		const tasks = await cache.getAllTasks();

		expect(tasks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					title: 'Draft release notes',
				}),
			])
		);
	});
});
