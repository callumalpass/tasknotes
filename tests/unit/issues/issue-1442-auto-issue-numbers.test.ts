/**
 * Issue #1442: [FR] Add automatic issue numbers to tasks
 *
 * Feature Request: Tasks should be able to automatically get assigned a
 * sequential issue number (like GitHub issues), stored as a numeric field
 * in frontmatter. This would:
 *
 * 1. Keep tasks uniquely identifiable even when titles are identical across
 *    projects (e.g., "Process meeting notes" becomes distinguishable via #1442).
 * 2. Allow short-hand references between systems (calendar, post-it notes, etc.).
 * 3. Give a sense of scope and progress to knowledge work.
 *
 * Implementation considerations:
 * - A new `taskNumber` (or similar) field on TaskInfo
 * - A persistent counter stored in plugin data (not per-vault file, to avoid conflicts)
 * - Auto-assignment during TaskService.createTask()
 * - Display in task titles/cards (e.g., "#42 Process meeting notes")
 * - The number should be unique and monotonically increasing
 * - Must handle edge cases: concurrent creation, vault sync, task deletion
 *   (numbers should NOT be reused)
 */

import { FileSystemFactory, PluginFactory } from '../../helpers/mock-factories';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';
import { TaskCreationData, TaskService } from '../../../src/services/TaskService';

// Mock external dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
	getCurrentTimestamp: jest.fn(() => '2025-01-01T12:00:00Z'),
	getCurrentDateString: jest.fn(() => '2025-01-01')
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
	generateTaskFilename: jest.fn((context) => `${context.title.toLowerCase().replace(/\s+/g, '-')}`),
	generateUniqueFilename: jest.fn((base) => base)
}));

jest.mock('../../../src/utils/helpers', () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
	calculateDefaultDate: jest.fn().mockReturnValue(undefined),
	addDTSTARTToRecurrenceRule: jest.fn(() => null),
	updateDTSTARTInRecurrenceRule: jest.fn((rule: string) => rule),
	updateToNextScheduledOccurrence: jest.fn(),
	splitFrontmatterAndBody: jest.fn(() => ({ frontmatter: {}, body: '' }))
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
	processTemplate: jest.fn(() => ({
		frontmatter: {},
		body: ''
	})),
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template }))
}));

describe('Issue #1442 - Automatic issue numbers for tasks', () => {
	let taskService: TaskService;
	let mockPlugin: any;

	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();

		mockPlugin = PluginFactory.createMockPlugin({
			statusManager: {
				isCompletedStatus: jest.fn((status) => status === 'done'),
				getCompletedStatuses: jest.fn(() => ['done', 'completed'])
			},
			getActiveTimeSession: jest.fn(),
			cacheManager: {
				updateTaskInfoInCache: jest.fn().mockResolvedValue(undefined),
				getTaskInfo: jest.fn(),
				clearCacheEntry: jest.fn()
			}
		});

		mockPlugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);

		taskService = new TaskService(mockPlugin);
	});

	it.skip('reproduces issue #1442 - created tasks should have a sequential taskNumber field', async () => {
		/**
		 * When a task is created, it should be assigned a unique, auto-incrementing
		 * task number. This number persists in the task's frontmatter and in TaskInfo.
		 *
		 * Expected: taskInfo.taskNumber is a positive integer, increasing with each new task.
		 */
		const task1 = await taskService.createTask({ title: 'Process meeting notes' });
		const task2 = await taskService.createTask({ title: 'Process meeting notes' });

		// Both tasks have the same title but different task numbers
		expect(task1.taskInfo.title).toBe(task2.taskInfo.title);
		expect((task1.taskInfo as any).taskNumber).toBeDefined();
		expect((task2.taskInfo as any).taskNumber).toBeDefined();
		expect(typeof (task1.taskInfo as any).taskNumber).toBe('number');
		expect((task2.taskInfo as any).taskNumber).toBeGreaterThan((task1.taskInfo as any).taskNumber);
	});

	it.skip('reproduces issue #1442 - task numbers should be unique even across projects', async () => {
		/**
		 * Task numbers should be globally unique within the vault, not scoped
		 * to a project. Two tasks in different projects should never share a number.
		 */
		const taskA = await taskService.createTask({
			title: 'Review PR',
			projects: ['[[Project Alpha]]']
		});
		const taskB = await taskService.createTask({
			title: 'Review PR',
			projects: ['[[Project Beta]]']
		});

		expect((taskA.taskInfo as any).taskNumber).not.toBe((taskB.taskInfo as any).taskNumber);
	});

	it.skip('reproduces issue #1442 - task numbers should never be reused after deletion', async () => {
		/**
		 * Once a task number is assigned, it should never be reused, even if
		 * the task is deleted. The counter should only increase.
		 */
		const task1 = await taskService.createTask({ title: 'Temporary task' });
		const number1 = (task1.taskInfo as any).taskNumber;

		// Simulate deletion (the number should not be reclaimed)
		// await taskService.deleteTask(task1.file.path);

		const task2 = await taskService.createTask({ title: 'Next task' });
		const number2 = (task2.taskInfo as any).taskNumber;

		expect(number2).toBeGreaterThan(number1);
	});

	it.skip('reproduces issue #1442 - task number should appear in frontmatter', async () => {
		/**
		 * The task number should be persisted in the YAML frontmatter so it
		 * survives vault syncs and is visible when reading the markdown file.
		 *
		 * Expected frontmatter includes something like:
		 * ---
		 * taskNumber: 42
		 * ---
		 */
		const { file } = await taskService.createTask({ title: 'Numbered task' });

		// Read back the file content and check frontmatter contains taskNumber
		const content = await mockPlugin.app.vault.read(file);
		expect(content).toMatch(/taskNumber:\s*\d+/);
	});
});
