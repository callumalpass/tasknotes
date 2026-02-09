/**
 * Issue #609: Spurious creation of tags under specific circumstances
 *
 * @see https://github.com/callumalpass/tasknotes/issues/609
 *
 * Bug:
 * When using property-based task identification (e.g., `type: task`), editing a task
 * via the dialog box (e.g., adding a comment in a custom field or adding a tag) causes
 * a spurious `tags: [task]` property to be added to the YAML frontmatter. The value
 * "task" comes from the property value used for task identification, not from any
 * user-specified tag.
 *
 * Reproduction scenario:
 * 1. Settings: taskIdentificationMethod = "property", taskPropertyName = "type",
 *    taskPropertyValue = "task"
 * 2. Task file has `type: task` in frontmatter but NO `tags` field
 * 3. Open the task in the edit dialog
 * 4. Add a value to a custom text field (e.g., "comment")
 * 5. Save the dialog
 * 6. Expected: Only the comment field is added to frontmatter
 * 7. Actual: A `tags: [task]` property is also added to frontmatter
 *
 * This also happens when adding a tag (e.g., "cat") — the tag "task" is spuriously
 * included alongside it.
 */

import { FieldMapper } from '../../../src/services/FieldMapper';
import { TaskEditModal } from '../../../src/modals/TaskEditModal';
import { MockObsidian } from '../../__mocks__/obsidian';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import type { App, TFile } from 'obsidian';
import type { TaskInfo, FieldMapping } from '../../../src/types';

jest.mock('obsidian');

// @ts-ignore helper to cast the mock app
const createMockApp = (mockApp: any): App => mockApp as unknown as App;

describe('Issue #609: Spurious tag creation in property mode', () => {
	let mockApp: App;
	let fieldMapper: FieldMapper;

	beforeEach(() => {
		MockObsidian.reset();
		mockApp = createMockApp(MockObsidian.createMockApp());
		fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
	});

	describe('FieldMapper.mapToFrontmatter - property mode (taskTag = undefined)', () => {
		it.skip('reproduces issue #609: should NOT add tags when task has no tags and taskTag is undefined', () => {
			// Simulate a property-mode task with no tags
			const taskData: Partial<TaskInfo> = {
				title: 'Test task',
				status: 'open',
				priority: 'normal',
				path: 'test.md',
				archived: false,
				tags: [], // No tags on the task
				contexts: ['cat', 'dog'],
				projects: [],
				dateModified: '2025-09-08T22:03:26.418+01:00',
			};

			// In property mode, taskTag should be undefined
			const result = fieldMapper.mapToFrontmatter(taskData, undefined, false);

			// Should NOT have a tags field at all
			expect(result).not.toHaveProperty('tags');
		});

		it.skip('reproduces issue #609: should NOT include property value "task" when user adds a tag in property mode', () => {
			// User added tag "cat" in the dialog while in property mode
			const taskData: Partial<TaskInfo> = {
				title: 'Test task',
				status: 'open',
				priority: 'normal',
				path: 'test.md',
				archived: false,
				tags: ['cat'], // User explicitly added "cat"
				contexts: ['cat', 'dog'],
				projects: [],
				dateModified: '2025-09-08T22:03:26.418+01:00',
			};

			// In property mode, taskTag should be undefined
			const result = fieldMapper.mapToFrontmatter(taskData, undefined, false);

			// Should only have the user-specified tag, not the property value
			expect(result.tags).toEqual(['cat']);
			expect(result.tags).not.toContain('task');
		});
	});

	describe('TaskEditModal.getChanges() - property mode with custom fields', () => {
		let mockPlugin: any;
		let mockTask: TaskInfo;

		beforeEach(() => {
			mockTask = {
				title: 'Test task',
				status: 'open',
				priority: 'normal',
				path: 'test.md',
				archived: false,
				tags: [], // No tags — property-mode task
				contexts: ['cat', 'dog'],
				projects: ['[[Project Collations for elsewhere]]'],
				dateModified: '2025-09-08T21:22:00.994+01:00',
				due: '2025-09-07',
				scheduled: '2025-09-07',
				recurrence: 'DTSTART:20250907;FREQ=WEEKLY;INTERVAL=2;BYDAY=SU',
				reminders: [
					{
						id: 'rem_1757258251019',
						type: 'relative',
						relatedTo: 'scheduled',
						offset: '-PT5M',
						description: '5 minutes before',
					},
				],
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
					userFields: [
						{ key: 'comment', name: 'Comment', type: 'text' },
					],
				},
				taskService: {
					updateTask: jest.fn(async (orig: TaskInfo, changes: Partial<TaskInfo>) => ({
						...orig,
						...changes,
					})),
				},
				statusManager: { isCompletedStatus: jest.fn((s: string) => s === 'done') },
				fieldMapper: {
					toUserField: jest.fn((k: any) => k),
					mapToFrontmatter: fieldMapper.mapToFrontmatter.bind(fieldMapper),
				},
			};
		});

		it.skip('reproduces issue #609: adding a custom field comment should not cause tags to appear in changes', () => {
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });

			// Initialize form with the task's current values
			(modal as any).title = mockTask.title;
			(modal as any).status = mockTask.status;
			(modal as any).priority = mockTask.priority;
			(modal as any).tags = ''; // No tags, same as initial
			(modal as any).initialTags = '';
			(modal as any).contexts = 'cat, dog';
			(modal as any).projects = '[[Project Collations for elsewhere]]';
			(modal as any).timeEstimate = 0;
			(modal as any).recurrenceRule = mockTask.recurrence;
			(modal as any).recurrenceAnchor = 'scheduled';
			(modal as any).reminders = [...(mockTask.reminders || [])];

			// Simulate user adding a comment (custom field change)
			(modal as any).userFields = { comment: 'A test comment via dialog' };

			const changes = (modal as any).getChanges();

			// The changes should NOT include a tags property
			expect(changes).not.toHaveProperty('tags');

			// If tags somehow end up in changes, they definitely should not contain "task"
			if (changes.tags) {
				expect(changes.tags).not.toContain('task');
			}
		});

		it.skip('reproduces issue #609: adding a tag "cat" should not also add "task" tag', () => {
			const modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });

			// Initialize form with the task's current values
			(modal as any).title = mockTask.title;
			(modal as any).status = mockTask.status;
			(modal as any).priority = mockTask.priority;
			(modal as any).tags = 'cat'; // User added tag "cat"
			(modal as any).initialTags = ''; // Was empty
			(modal as any).contexts = 'cat, dog';
			(modal as any).projects = '[[Project Collations for elsewhere]]';
			(modal as any).timeEstimate = 0;
			(modal as any).recurrenceRule = mockTask.recurrence;
			(modal as any).recurrenceAnchor = 'scheduled';
			(modal as any).reminders = [...(mockTask.reminders || [])];
			(modal as any).userFields = {};

			const changes = (modal as any).getChanges();

			// Tags should be updated, but only with the user's tag
			if (changes.tags) {
				expect(changes.tags).toEqual(['cat']);
				expect(changes.tags).not.toContain('task');
			}
		});
	});

	describe('Full update flow simulation - property mode', () => {
		it.skip('reproduces issue #609: updating custom field should not write tags to frontmatter', () => {
			// Simulate the exact frontmatter from the bug report (before state)
			const originalFrontmatter: Record<string, any> = {
				status: 'open',
				priority: 'normal',
				contexts: ['cat', 'dog'],
				projects: ['[[Project Collations for elsewhere]]'],
				dateModified: '2025-09-08T21:22:00.994+01:00',
				type: 'task',
				reminders: [
					{
						id: 'rem_1757258251019',
						type: 'relative',
						relatedTo: 'scheduled',
						offset: '-PT5M',
						description: '5 minutes before',
					},
				],
				due: '2025-09-07',
				scheduled: '2025-09-07',
				recurrence: 'DTSTART:20250907;FREQ=WEEKLY;INTERVAL=2;BYDAY=SU',
			};

			// Read the original task via FieldMapper
			const originalTask = fieldMapper.mapFromFrontmatter(
				originalFrontmatter,
				'test.md',
				false
			);

			// Confirm the original task has no tags
			expect(originalTask.tags).toBeUndefined();

			// Simulate an update that only changes a custom field and dateModified
			const updates: Partial<TaskInfo> & { customFrontmatter?: Record<string, any> } = {
				dateModified: '2025-09-08T22:03:26.418+01:00',
				customFrontmatter: {
					comment: 'A test comment via dialog',
				},
			};

			// Build the complete task data as TaskService.updateTask does
			const completeTaskData: Partial<TaskInfo> = {
				...originalTask,
				...updates,
			};

			// Map to frontmatter in property mode (taskTag = undefined)
			const mappedFrontmatter = fieldMapper.mapToFrontmatter(
				completeTaskData,
				undefined, // property mode: no taskTag
				false
			);

			// The mapped frontmatter should NOT have a tags field
			expect(mappedFrontmatter).not.toHaveProperty('tags');

			// Simulate applying the mapped frontmatter to the original
			const resultFrontmatter = { ...originalFrontmatter };
			Object.keys(mappedFrontmatter).forEach((key) => {
				if (mappedFrontmatter[key] !== undefined) {
					resultFrontmatter[key] = mappedFrontmatter[key];
				}
			});

			// Apply custom frontmatter
			if (updates.customFrontmatter) {
				Object.keys(updates.customFrontmatter).forEach((key) => {
					resultFrontmatter[key] = updates.customFrontmatter![key];
				});
			}

			// The result should have the comment but NOT a tags field
			expect(resultFrontmatter.comment).toBe('A test comment via dialog');
			expect(resultFrontmatter).not.toHaveProperty('tags');
			// The type property should be preserved
			expect(resultFrontmatter.type).toBe('task');
		});

		it.skip('reproduces issue #609: adding tag "cat" should not also write "task" to tags', () => {
			const originalFrontmatter: Record<string, any> = {
				status: 'open',
				priority: 'normal',
				contexts: ['cat', 'dog'],
				projects: ['[[Project Collations for elsewhere]]'],
				dateModified: '2025-09-08T21:22:00.994+01:00',
				type: 'task',
				due: '2025-09-07',
				scheduled: '2025-09-07',
				recurrence: 'DTSTART:20250907;FREQ=WEEKLY;INTERVAL=2;BYDAY=SU',
			};

			// Read the original task
			const originalTask = fieldMapper.mapFromFrontmatter(
				originalFrontmatter,
				'test.md',
				false
			);

			// Simulate user adding tag "cat" via the dialog
			const updates: Partial<TaskInfo> = {
				tags: ['cat'],
				dateModified: '2025-09-08T22:03:26.418+01:00',
			};

			const completeTaskData: Partial<TaskInfo> = {
				...originalTask,
				...updates,
			};

			// Map to frontmatter in property mode
			const mappedFrontmatter = fieldMapper.mapToFrontmatter(
				completeTaskData,
				undefined, // property mode
				false
			);

			// Tags should only contain what the user specified
			if (mappedFrontmatter.tags) {
				expect(mappedFrontmatter.tags).toEqual(['cat']);
				expect(mappedFrontmatter.tags).not.toContain('task');
			}

			// Also verify through the full update simulation
			const resultFrontmatter = { ...originalFrontmatter };
			Object.keys(mappedFrontmatter).forEach((key) => {
				if (mappedFrontmatter[key] !== undefined) {
					resultFrontmatter[key] = mappedFrontmatter[key];
				}
			});

			// Simulate the explicit tags handling from TaskService.updateTask
			if (updates.hasOwnProperty('tags')) {
				const tagsToSet = Array.isArray(updates.tags) ? [...updates.tags] : [];
				if (tagsToSet.length > 0) {
					resultFrontmatter.tags = tagsToSet;
				} else {
					delete resultFrontmatter.tags;
				}
			}

			// Tags should only contain "cat", not "task"
			expect(resultFrontmatter.tags).toEqual(['cat']);
			expect(resultFrontmatter.tags).not.toContain('task');
		});
	});
});
