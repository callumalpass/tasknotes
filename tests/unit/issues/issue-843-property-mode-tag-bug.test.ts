/**
 * Test for Issue #843: Task Tag Added in Property Identification Mode
 *
 * Bug: When creating or editing a task via modal, the system incorrectly adds
 * Tags: task to the note even when the "Identify tasks by" setting is configured
 * to use Property instead of Tag.
 *
 * Expected: When taskIdentificationMethod is set to "property", the task tag
 * should NOT be added to the tags field.
 */

import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { TaskEditModal } from '../../../src/modals/TaskEditModal';
import { MockObsidian } from '../../__mocks__/obsidian';
import type { App } from 'obsidian';
import { TaskInfo } from '../../../src/types';

// @ts-ignore helper to cast the mock app
const createMockApp = (mockApp: any): App => mockApp as unknown as App;

jest.mock('obsidian');

describe('Issue #843: Property Mode Tag Bug', () => {
	let mockApp: App;
	let mockPlugin: any;

	beforeEach(() => {
		MockObsidian.reset();
		mockApp = createMockApp(MockObsidian.createMockApp());
	});

	describe('TaskCreationModal - Property Mode', () => {
		beforeEach(() => {
			mockPlugin = {
				app: mockApp,
				settings: {
					taskTag: 'task',
					taskIdentificationMethod: 'property',
					taskPropertyName: 'type',
					taskPropertyValue: 'task',
					enableNaturalLanguageInput: false,
					defaultTaskPriority: 'normal',
					defaultTaskStatus: 'open',
				},
				taskService: { createTask: jest.fn() },
				statusManager: { isCompletedStatus: jest.fn((s: string) => s === 'done') },
				fieldMapper: { toUserField: jest.fn((k: any) => k) },
			};
		});

		test('should NOT add task tag when taskIdentificationMethod is "property"', () => {
			const modal = new TaskCreationModal(mockApp, mockPlugin, jest.fn());

			// Set up modal data
			(modal as any).title = 'Test task';
			(modal as any).tags = ''; // No tags provided by user
			(modal as any).contexts = '';
			(modal as any).projects = '';

			// Call buildTaskData which should NOT add the task tag
			const taskData = (modal as any).buildTaskData();

			// When no tags are provided in property mode, tags should be undefined or empty
			expect(taskData.tags).toBeUndefined();
		});

		test('should NOT add task tag when user provides other tags in property mode', () => {
			const modal = new TaskCreationModal(mockApp, mockPlugin, jest.fn());

			(modal as any).title = 'Test task';
			(modal as any).tags = 'important, work';
			(modal as any).contexts = '';
			(modal as any).projects = '';

			const taskData = (modal as any).buildTaskData();

			expect(taskData.tags).toEqual(['important', 'work']);
			expect(taskData.tags).not.toContain('task');
		});

		test('should keep task tag if user explicitly added it in property mode', () => {
			const modal = new TaskCreationModal(mockApp, mockPlugin, jest.fn());

			(modal as any).title = 'Test task';
			(modal as any).tags = 'task'; // User explicitly added the task tag
			(modal as any).contexts = '';
			(modal as any).projects = '';

			const taskData = (modal as any).buildTaskData();

			// Even though we're in property mode, if user explicitly added the tag, keep it
			// But don't add it a second time
			expect(taskData.tags).toContain('task');
			expect(taskData.tags?.filter((t: string) => t === 'task').length).toBe(1);
		});
	});

	describe('TaskCreationModal - Tag Mode (Existing Behavior)', () => {
		beforeEach(() => {
			mockPlugin = {
				app: mockApp,
				settings: {
					taskTag: 'task',
					taskIdentificationMethod: 'tag', // Tag mode
					enableNaturalLanguageInput: false,
					defaultTaskPriority: 'normal',
					defaultTaskStatus: 'open',
				},
				taskService: { createTask: jest.fn() },
				statusManager: { isCompletedStatus: jest.fn((s: string) => s === 'done') },
				fieldMapper: { toUserField: jest.fn((k: any) => k) },
			};
		});

		test('SHOULD add task tag when taskIdentificationMethod is "tag" (existing behavior)', () => {
			const modal = new TaskCreationModal(mockApp, mockPlugin, jest.fn());

			(modal as any).title = 'Test task';
			(modal as any).tags = ''; // No tags provided
			(modal as any).contexts = '';
			(modal as any).projects = '';

			const taskData = (modal as any).buildTaskData();

			expect(taskData.tags).toContain('task');
		});

		test('should not duplicate task tag if already present in tag mode', () => {
			const modal = new TaskCreationModal(mockApp, mockPlugin, jest.fn());

			(modal as any).title = 'Test task';
			(modal as any).tags = 'task, important'; // task already present
			(modal as any).contexts = '';
			(modal as any).projects = '';

			const taskData = (modal as any).buildTaskData();

			expect(taskData.tags).toContain('task');
			expect(taskData.tags?.filter((t: string) => t === 'task').length).toBe(1);
		});
	});

	describe('TaskEditModal - Property Mode', () => {
		let mockTask: TaskInfo;

		beforeEach(() => {
			mockTask = {
				title: 'Test task',
				status: 'open',
				priority: 'normal',
				path: 'test.md',
				archived: false,
				tags: ['existing'],
				projects: [],
			} as any;

			mockPlugin = {
				app: mockApp,
				settings: {
					taskTag: 'task',
					taskIdentificationMethod: 'property',
					taskPropertyName: 'type',
					taskPropertyValue: 'task',
					enableNaturalLanguageInput: false,
					defaultTaskPriority: 'normal',
					defaultTaskStatus: 'open',
				},
				taskService: {
					updateTask: jest.fn(async (orig: TaskInfo, changes: Partial<TaskInfo>) => ({
						...orig,
						...changes,
					})),
				},
				statusManager: { isCompletedStatus: jest.fn((s: string) => s === 'done') },
				fieldMapper: { toUserField: jest.fn((k: any) => k) },
			};
		});

		test('should NOT add task tag when taskIdentificationMethod is "property"', () => {
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });

			// Set fields directly
			(modal as any).title = mockTask.title;
			(modal as any).status = mockTask.status;
			(modal as any).priority = mockTask.priority;
			(modal as any).tags = 'important';
			(modal as any).contexts = '';
			(modal as any).projects = '';
			(modal as any).timeEstimate = 0;

			// Get changes
			const changes = (modal as any).getChanges();

			if (changes.tags) {
				expect(changes.tags).toEqual(['important']);
				expect(changes.tags).not.toContain('task');
			}
		});

		test('should keep existing tags and not add task tag in property mode', () => {
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });

			(modal as any).title = mockTask.title;
			(modal as any).status = mockTask.status;
			(modal as any).priority = mockTask.priority;
			(modal as any).tags = 'existing, work';
			(modal as any).contexts = '';
			(modal as any).projects = '';
			(modal as any).timeEstimate = 0;

			const changes = (modal as any).getChanges();

			if (changes.tags) {
				expect(changes.tags).toEqual(['existing', 'work']);
				expect(changes.tags).not.toContain('task');
			}
		});

		test('should preserve task tag on load in property mode', async () => {
			mockTask.tags = ['task', 'existing'];
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
			(modal as any).initializeSubtasks = jest.fn().mockResolvedValue(undefined);

			await modal.initializeFormData();

			expect((modal as any).tags).toBe('task, existing');
		});

		test('should not mark tags as changed when untouched in property mode', async () => {
			mockTask.tags = ['task', 'existing'];
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
			(modal as any).initializeSubtasks = jest.fn().mockResolvedValue(undefined);

			await modal.initializeFormData();

			const changes = (modal as any).getChanges();
			expect(changes.tags).toBeUndefined();
		});
	});

	describe('TaskEditModal - Tag Mode (Existing Behavior)', () => {
		let mockTask: TaskInfo;

		beforeEach(() => {
			mockTask = {
				title: 'Test task',
				status: 'open',
				priority: 'normal',
				path: 'test.md',
				archived: false,
				tags: ['existing'],
				projects: [],
			} as any;

			mockPlugin = {
				app: mockApp,
				settings: {
					taskTag: 'task',
					taskIdentificationMethod: 'tag', // Tag mode
					enableNaturalLanguageInput: false,
					defaultTaskPriority: 'normal',
					defaultTaskStatus: 'open',
				},
				taskService: {
					updateTask: jest.fn(async (orig: TaskInfo, changes: Partial<TaskInfo>) => ({
						...orig,
						...changes,
					})),
				},
				statusManager: { isCompletedStatus: jest.fn((s: string) => s === 'done') },
				fieldMapper: { toUserField: jest.fn((k: any) => k) },
			};
		});

		test('SHOULD add task tag when taskIdentificationMethod is "tag"', () => {
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });

			(modal as any).title = mockTask.title;
			(modal as any).status = mockTask.status;
			(modal as any).priority = mockTask.priority;
			(modal as any).tags = 'important';
			(modal as any).contexts = '';
			(modal as any).projects = '';
			(modal as any).timeEstimate = 0;

			const changes = (modal as any).getChanges();

			if (changes.tags) {
				expect(changes.tags).toContain('task');
				expect(changes.tags).toEqual(['important', 'task']);
			}
		});

		test('should hide task tag on load in tag mode', async () => {
			mockTask.tags = ['task', 'existing'];
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
			(modal as any).initializeSubtasks = jest.fn().mockResolvedValue(undefined);

			await modal.initializeFormData();

			expect((modal as any).tags).toBe('existing');
		});

		test('should not mark tags as changed when untouched in tag mode', async () => {
			mockTask.tags = ['task', 'existing'];
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
			(modal as any).initializeSubtasks = jest.fn().mockResolvedValue(undefined);

			await modal.initializeFormData();

			const changes = (modal as any).getChanges();
			expect(changes.tags).toBeUndefined();
		});
	});
});
