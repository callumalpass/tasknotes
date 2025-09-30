import { MinimalNativeCache } from '../../src/utils/MinimalNativeCache';
import { TaskNotesSettings } from '../../src/types/settings';

// Mock FilterUtils
jest.mock('../../src/utils/FilterUtils', () => ({
	FilterUtils: {
		matchesHierarchicalTagExact: jest.fn((tag: string, taskTag: string) => {
			return tag.toLowerCase() === taskTag.toLowerCase();
		}),
	},
}));

describe('MinimalNativeCache - isTaskFile with non-string tags', () => {
	let cache: MinimalNativeCache;
	let mockApp: any;
	let settings: TaskNotesSettings;

	beforeEach(() => {
		mockApp = {
			metadataCache: {
				on: jest.fn(),
			},
			vault: {
				on: jest.fn(),
			},
		};

		settings = {
			taskTag: 'task',
			taskIdentificationMethod: 'tag',
			excludedFolders: '',
			disableNoteIndexing: false,
			storeTitleInFilename: false,
		} as TaskNotesSettings;

		cache = new MinimalNativeCache(mockApp, settings);
	});

	test('handles frontmatter with valid string tags', () => {
		const frontmatter = {
			tags: ['task', 'project', 'important'],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(true);
	});

	test('handles frontmatter with number in tags array', () => {
		const frontmatter = {
			tags: ['task', 123, 'project'],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(true);
	});

	test('handles frontmatter with boolean in tags array', () => {
		const frontmatter = {
			tags: [true, 'task', false],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(true);
	});

	test('handles frontmatter with mixed non-string types', () => {
		const frontmatter = {
			tags: [123, true, 'task', null, undefined, 'project'],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(true);
	});

	test('returns false when all tags are non-strings', () => {
		const frontmatter = {
			tags: [123, true, null, undefined, 456],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(false);
	});

	test('handles frontmatter with object in tags array', () => {
		const frontmatter = {
			tags: [{ nested: 'value' }, 'task'],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(true);
	});

	test('handles frontmatter with array in tags array', () => {
		const frontmatter = {
			tags: [['nested', 'array'], 'task'],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(true);
	});

	test('handles empty tags array', () => {
		const frontmatter = {
			tags: [],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(false);
	});

	test('handles nested tag hierarchy with non-strings', () => {
		const frontmatter = {
			tags: ['task', 123, 'other/tag'],
		};

		const result = (cache as any).isTaskFile(frontmatter);
		expect(result).toBe(true);
	});
});