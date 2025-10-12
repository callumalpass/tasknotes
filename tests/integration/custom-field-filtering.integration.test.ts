import TaskNotesPlugin from '../../src/main';
import { TFile } from 'obsidian';
import type { UserMappedField } from '../../src/types/settings';
import type { FileFilterConfig } from '../../src/suggest/FileSuggestHelper';

// Mock parseFrontMatterAliases
jest.mock('obsidian', () => ({
	...jest.requireActual('obsidian'),
	parseFrontMatterAliases: jest.fn((frontmatter: any) => {
		if (!frontmatter || !frontmatter.aliases) return [];
		if (Array.isArray(frontmatter.aliases)) return frontmatter.aliases;
		return [frontmatter.aliases];
	}),
}));

describe('Custom Field Filtering Integration', () => {
	let mockPlugin: any;
	let mockFiles: TFile[];

	beforeEach(() => {
		// Create mock files with different characteristics
		mockFiles = [
			{
				basename: 'Alice',
				path: 'People/Alice.md',
				extension: 'md',
				parent: { path: 'People' },
			} as TFile,
			{
				basename: 'Bob',
				path: 'People/Bob.md',
				extension: 'md',
				parent: { path: 'People' },
			} as TFile,
			{
				basename: 'Project Alpha',
				path: 'Projects/Project Alpha.md',
				extension: 'md',
				parent: { path: 'Projects' },
			} as TFile,
			{
				basename: 'Random Note',
				path: 'Notes/Random Note.md',
				extension: 'md',
				parent: { path: 'Notes' },
			} as TFile,
		];

		// Create mock plugin
		mockPlugin = {
			app: {
				vault: {
					getMarkdownFiles: jest.fn(() => mockFiles),
				},
				metadataCache: {
					getFileCache: jest.fn((file: TFile) => {
						// People files have #person tag and role property
						if (file.path.startsWith('People/')) {
							return {
								frontmatter: {
									tags: ['person'],
									role: 'developer',
								},
								tags: [
									{
										tag: '#person',
										position: {
											start: { line: 0, col: 0, offset: 0 },
											end: { line: 0, col: 7, offset: 7 },
										},
									},
								],
							};
						}
						// Project files have #project tag
						if (file.path.startsWith('Projects/')) {
							return {
								frontmatter: {
									tags: ['project'],
									type: 'project',
								},
								tags: [
									{
										tag: '#project',
										position: {
											start: { line: 0, col: 0, offset: 0 },
											end: { line: 0, col: 8, offset: 8 },
										},
									},
								],
							};
						}
						// Random notes have no tags
						return {
							frontmatter: {},
							tags: [],
						};
					}),
				},
			},
			settings: {
				suggestionDebounceMs: 0,
				userFields: [] as UserMappedField[],
			},
			fieldMapper: {
				mapFromFrontmatter: jest.fn((fm: any) => ({
					title: fm.title || '',
				})),
			},
		} as unknown as TaskNotesPlugin;
	});

	describe('Custom Field with Filter Configuration', () => {
		it('should filter suggestions based on custom field filter config', async () => {
			// Configure a custom field with filter
			const assigneeField: UserMappedField = {
				id: 'assignee',
				displayName: 'Assignee',
				key: 'assignee',
				type: 'text',
				autosuggestFilter: {
					requiredTags: ['person'],
					includeFolders: ['People'],
				},
			};

			mockPlugin.settings.userFields = [assigneeField];

			// Import FileSuggestHelper and test filtering
			const { FileSuggestHelper } = await import('../../src/suggest/FileSuggestHelper');

			const results = await FileSuggestHelper.suggest(
				mockPlugin,
				'',
				20,
				assigneeField.autosuggestFilter
			);

			// Should only return people (Alice and Bob)
			expect(results.length).toBe(2);
			expect(results.map((r) => r.insertText)).toEqual(
				expect.arrayContaining(['Alice', 'Bob'])
			);
		});

		it('should show all files when custom field has no filter', async () => {
			// Configure a custom field WITHOUT filter
			const notesField: UserMappedField = {
				id: 'related-note',
				displayName: 'Related Note',
				key: 'related-note',
				type: 'text',
				// No autosuggestFilter
			};

			mockPlugin.settings.userFields = [notesField];

			const { FileSuggestHelper } = await import('../../src/suggest/FileSuggestHelper');

			const results = await FileSuggestHelper.suggest(
				mockPlugin,
				'',
				20,
				notesField.autosuggestFilter
			);

			// Should return ALL files (4 total)
			expect(results.length).toBe(4);
		});

		it('should support different filters for different custom fields', async () => {
			// Configure multiple custom fields with different filters
			const assigneeField: UserMappedField = {
				id: 'assignee',
				displayName: 'Assignee',
				key: 'assignee',
				type: 'text',
				autosuggestFilter: {
					requiredTags: ['person'],
				},
			};

			const projectField: UserMappedField = {
				id: 'project',
				displayName: 'Project',
				key: 'project',
				type: 'text',
				autosuggestFilter: {
					requiredTags: ['project'],
				},
			};

			mockPlugin.settings.userFields = [assigneeField, projectField];

			const { FileSuggestHelper } = await import('../../src/suggest/FileSuggestHelper');

			// Test assignee filter
			const assigneeResults = await FileSuggestHelper.suggest(
				mockPlugin,
				'',
				20,
				assigneeField.autosuggestFilter
			);
			expect(assigneeResults.length).toBe(2);
			expect(assigneeResults.map((r) => r.insertText)).toEqual(
				expect.arrayContaining(['Alice', 'Bob'])
			);

			// Test project filter
			const projectResults = await FileSuggestHelper.suggest(
				mockPlugin,
				'',
				20,
				projectField.autosuggestFilter
			);
			expect(projectResults.length).toBe(1);
			expect(projectResults[0].insertText).toBe('Project Alpha');
		});

		it('should filter by folder path', async () => {
			const peopleField: UserMappedField = {
				id: 'person',
				displayName: 'Person',
				key: 'person',
				type: 'text',
				autosuggestFilter: {
					includeFolders: ['People'],
				},
			};

			const { FileSuggestHelper } = await import('../../src/suggest/FileSuggestHelper');

			const results = await FileSuggestHelper.suggest(
				mockPlugin,
				'',
				20,
				peopleField.autosuggestFilter
			);

			// Should only return files in People folder
			expect(results.length).toBe(2);
			expect(results.map((r) => r.insertText)).toEqual(
				expect.arrayContaining(['Alice', 'Bob'])
			);
		});

		it('should filter by property key and value', async () => {
			const developerField: UserMappedField = {
				id: 'developer',
				displayName: 'Developer',
				key: 'developer',
				type: 'text',
				autosuggestFilter: {
					propertyKey: 'role',
					propertyValue: 'developer',
				},
			};

			const { FileSuggestHelper } = await import('../../src/suggest/FileSuggestHelper');

			const results = await FileSuggestHelper.suggest(
				mockPlugin,
				'',
				20,
				developerField.autosuggestFilter
			);

			// Should only return files with role: developer
			expect(results.length).toBe(2);
			expect(results.map((r) => r.insertText)).toEqual(
				expect.arrayContaining(['Alice', 'Bob'])
			);
		});

		it('should combine multiple filter criteria', async () => {
			const strictField: UserMappedField = {
				id: 'strict',
				displayName: 'Strict Filter',
				key: 'strict',
				type: 'text',
				autosuggestFilter: {
					requiredTags: ['person'],
					includeFolders: ['People'],
					propertyKey: 'role',
					propertyValue: 'developer',
				},
			};

			const { FileSuggestHelper } = await import('../../src/suggest/FileSuggestHelper');

			const results = await FileSuggestHelper.suggest(
				mockPlugin,
				'',
				20,
				strictField.autosuggestFilter
			);

			// Should only return files matching ALL criteria
			expect(results.length).toBe(2);
			expect(results.map((r) => r.insertText)).toEqual(
				expect.arrayContaining(['Alice', 'Bob'])
			);
		});
	});

	describe('Backward Compatibility', () => {
		it('should work with existing custom fields without autosuggestFilter', async () => {
			// Old custom field without filter property
			const oldField: UserMappedField = {
				id: 'old-field',
				displayName: 'Old Field',
				key: 'old-field',
				type: 'text',
				// No autosuggestFilter property
			};

			mockPlugin.settings.userFields = [oldField];

			const { FileSuggestHelper } = await import('../../src/suggest/FileSuggestHelper');

			const results = await FileSuggestHelper.suggest(
				mockPlugin,
				'',
				20,
				oldField.autosuggestFilter
			);

			// Should return ALL files (no filtering)
			expect(results.length).toBe(4);
		});
	});
});

