/**
 * MinimalNativeCache.getTaskInfo() validation tests
 * Tests for issue #953 - Subtasks incorrectly identified as TaskNotes
 */

import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { TaskNotesSettings } from '../../../src/types/settings';
import { TFile } from 'obsidian';

// Mock FilterUtils
jest.mock('../../../src/utils/FilterUtils', () => ({
	FilterUtils: {
		matchesHierarchicalTagExact: jest.fn((tag: string, taskTag: string) => {
			return tag.toLowerCase() === taskTag.toLowerCase();
		}),
	},
}));

describe('MinimalNativeCache.getTaskInfo() - Task Identification Validation', () => {
	let cache: MinimalNativeCache;
	let mockApp: any;
	let mockFile: any;
	let mockFieldMapper: any;

	beforeEach(() => {
		// Create a mock file object that will pass instanceof TFile check
		mockFile = Object.create(TFile.prototype);
		Object.defineProperty(mockFile, 'path', { value: 'test/note.md', writable: true });
		Object.defineProperty(mockFile, 'basename', { value: 'note', writable: true });
		Object.defineProperty(mockFile, 'extension', { value: 'md', writable: true });

		// Mock FieldMapper to return task info
		mockFieldMapper = {
			mapFromFrontmatter: jest.fn((frontmatter: any, path: string, storeTitleInFilename: boolean) => ({
				title: frontmatter.title || 'Untitled',
				status: frontmatter.status || 'open',
				priority: frontmatter.priority || 'normal',
				due: frontmatter.due,
				scheduled: frontmatter.scheduled,
				tags: frontmatter.tags || [],
				contexts: frontmatter.contexts || [],
				projects: frontmatter.projects || frontmatter.Parent ? [frontmatter.Parent] : [],
				blockedBy: [],
				timeEntries: [],
			})),
		};

		mockApp = {
			vault: {
				getAbstractFileByPath: jest.fn().mockReturnValue(mockFile),
				on: jest.fn(),
				getMarkdownFiles: jest.fn().mockReturnValue([]),
			},
			metadataCache: {
				getFileCache: jest.fn(),
				getFirstLinkpathDest: jest.fn().mockReturnValue(null), // For dependency resolution
				on: jest.fn(),
			},
		};
	});

	describe('Tag-based identification', () => {
		beforeEach(() => {
			const settings: TaskNotesSettings = {
				taskTag: 'task',
				taskIdentificationMethod: 'tag',
				excludedFolders: '',
				disableNoteIndexing: false,
				storeTitleInFilename: false,
			} as TaskNotesSettings;

			cache = new MinimalNativeCache(mockApp, settings, mockFieldMapper);
		});

		test('should return TaskInfo for file with task tag', async () => {
			// Arrange
			const frontmatter = {
				tags: ['task', 'project'],
				title: 'Valid Task',
				status: 'open',
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert
			expect(result).not.toBeNull();
			expect(result?.title).toBe('Valid Task');
		});

		test('should return null for file WITHOUT task tag (issue #953)', async () => {
			// Arrange - Note with Parent property but NO task tag
			const frontmatter = {
				tags: ['note', 'reference'],
				title: 'Random Note',
				Parent: '[[Existing_Task]]', // Has parent link but not a task
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert - Should return null because it lacks the task tag
			expect(result).toBeNull();
		});

		test('should return null for file with no tags', async () => {
			// Arrange
			const frontmatter = {
				title: 'Note without tags',
				Parent: '[[Some_Task]]',
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert
			expect(result).toBeNull();
		});

		test('should return null for file with empty tags array', async () => {
			// Arrange
			const frontmatter = {
				tags: [],
				title: 'Note with empty tags',
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert
			expect(result).toBeNull();
		});
	});

	describe('Property-based identification', () => {
		beforeEach(() => {
			const settings: TaskNotesSettings = {
				taskTag: 'task',
				taskIdentificationMethod: 'property',
				taskPropertyName: 'isTask',
				taskPropertyValue: 'true',
				excludedFolders: '',
				disableNoteIndexing: false,
				storeTitleInFilename: false,
			} as TaskNotesSettings;

			cache = new MinimalNativeCache(mockApp, settings, mockFieldMapper);
		});

		test('should return TaskInfo for file with matching property', async () => {
			// Arrange
			const frontmatter = {
				isTask: true,
				title: 'Valid Task',
				status: 'open',
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert
			expect(result).not.toBeNull();
			expect(result?.title).toBe('Valid Task');
		});

		test('should return null for file WITHOUT matching property (issue #953)', async () => {
			// Arrange - Note with Parent but no isTask property
			const frontmatter = {
				title: 'Random Note',
				Parent: '[[Existing_Task]]',
				// isTask property is missing
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert - Should return null because it lacks the required property
			expect(result).toBeNull();
		});

		test('should return null for file with property set to false', async () => {
			// Arrange
			const frontmatter = {
				isTask: false,
				title: 'Not a Task',
				Parent: '[[Some_Task]]',
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert
			expect(result).toBeNull();
		});

		test('should handle string "true" in frontmatter', async () => {
			// Arrange
			const frontmatter = {
				isTask: 'true', // String instead of boolean
				title: 'Task with string property',
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert
			expect(result).not.toBeNull();
		});
	});

	describe('Edge cases', () => {
		beforeEach(() => {
			const settings: TaskNotesSettings = {
				taskTag: 'task',
				taskIdentificationMethod: 'tag',
				excludedFolders: '',
				disableNoteIndexing: false,
				storeTitleInFilename: false,
			} as TaskNotesSettings;

			cache = new MinimalNativeCache(mockApp, settings, mockFieldMapper);
		});

		test('should return null for non-existent file', async () => {
			// Arrange
			mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

			// Act
			const result = await cache.getTaskInfo('nonexistent.md');

			// Assert
			expect(result).toBeNull();
		});

		test('should return null for file without frontmatter', async () => {
			// Arrange
			mockApp.metadataCache.getFileCache.mockReturnValue({});

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert
			expect(result).toBeNull();
		});

		test('should return null when metadata cache returns null', async () => {
			// Arrange
			mockApp.metadataCache.getFileCache.mockReturnValue(null);

			// Act
			const result = await cache.getTaskInfo('test/note.md');

			// Assert
			expect(result).toBeNull();
		});
	});

	describe('Consistency with getCachedTaskInfoSync', () => {
		test('async and sync methods should return same result for valid task', async () => {
			// Arrange
			const settings: TaskNotesSettings = {
				taskTag: 'task',
				taskIdentificationMethod: 'tag',
				excludedFolders: '',
				disableNoteIndexing: false,
				storeTitleInFilename: false,
			} as TaskNotesSettings;

			cache = new MinimalNativeCache(mockApp, settings, mockFieldMapper);

			const frontmatter = {
				tags: ['task'],
				title: 'Test Task',
				status: 'open',
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const asyncResult = await cache.getTaskInfo('test/note.md');
			const syncResult = cache.getCachedTaskInfoSync('test/note.md');

			// Assert - Both should return TaskInfo
			expect(asyncResult).not.toBeNull();
			expect(syncResult).not.toBeNull();
			expect(asyncResult?.title).toBe(syncResult?.title);
		});

		test('async and sync methods should both return null for non-task', async () => {
			// Arrange
			const settings: TaskNotesSettings = {
				taskTag: 'task',
				taskIdentificationMethod: 'tag',
				excludedFolders: '',
				disableNoteIndexing: false,
				storeTitleInFilename: false,
			} as TaskNotesSettings;

			cache = new MinimalNativeCache(mockApp, settings, mockFieldMapper);

			const frontmatter = {
				tags: ['note'],
				title: 'Not a Task',
				Parent: '[[Some_Task]]',
			};
			mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter });

			// Act
			const asyncResult = await cache.getTaskInfo('test/note.md');
			const syncResult = cache.getCachedTaskInfoSync('test/note.md');

			// Assert - Both should return null
			expect(asyncResult).toBeNull();
			expect(syncResult).toBeNull();
		});
	});
});

