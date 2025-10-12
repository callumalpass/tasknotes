import { FileSuggestHelper, FileFilterConfig } from '../../../src/suggest/FileSuggestHelper';
import { TFile } from 'obsidian';
import type TaskNotesPlugin from '../../../src/main';

// Mock parseFrontMatterAliases
jest.mock('obsidian', () => ({
  ...jest.requireActual('obsidian'),
  parseFrontMatterAliases: jest.fn((frontmatter: any) => {
    if (!frontmatter || !frontmatter.aliases) return [];
    if (Array.isArray(frontmatter.aliases)) return frontmatter.aliases;
    return [frontmatter.aliases];
  }),
}));

describe('FileSuggestHelper', () => {
  let mockPlugin: any;
  let mockFiles: TFile[];
  let projectFilterConfig: FileFilterConfig;

  beforeEach(() => {
    // Create mock files
    mockFiles = [
      {
        basename: 'Project A',
        path: 'projects/Project A.md',
        extension: 'md',
        parent: { path: 'projects' }
      } as TFile,
      {
        basename: 'Project B',
        path: 'projects/Project B.md',
        extension: 'md',
        parent: { path: 'projects' }
      } as TFile,
      {
        basename: 'Note 1',
        path: 'notes/Note 1.md',
        extension: 'md',
        parent: { path: 'notes' }
      } as TFile,
      {
        basename: 'Note 2',
        path: 'notes/Note 2.md',
        extension: 'md',
        parent: { path: 'notes' }
      } as TFile,
    ];

    // Create project filter configuration
    projectFilterConfig = {
      requiredTags: ['project'],
      includeFolders: [],
      propertyKey: '',
      propertyValue: ''
    };

    // Create mock plugin with settings
    mockPlugin = {
      app: {
        vault: {
          getMarkdownFiles: jest.fn(() => mockFiles),
        },
        metadataCache: {
          getFileCache: jest.fn((file: TFile) => {
            // Project files have #project tag
            if (file.path.startsWith('projects/')) {
              return {
                frontmatter: {
                  tags: ['project'],
                  type: 'project'
                },
                tags: [{ tag: '#project', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 8, offset: 8 } } }]
              };
            }
            // Note files don't have #project tag
            return {
              frontmatter: {},
              tags: []
            };
          }),
        },
      },
      settings: {
        suggestionDebounceMs: 0
      },
      fieldMapper: {
        mapFromFrontmatter: jest.fn((fm: any) => ({
          title: fm.title || ''
        }))
      }
    } as unknown as TaskNotesPlugin;
  });

  describe('Filter Configuration', () => {
    it('should return ALL files when no filterConfig is provided', async () => {
      const results = await FileSuggestHelper.suggest(mockPlugin, '');

      // Should return ALL files (4 total) - no filtering
      expect(results.length).toBe(4);
      const basenames = results.map(r => r.insertText);
      expect(basenames).toContain('Project A');
      expect(basenames).toContain('Project B');
      expect(basenames).toContain('Note 1');
      expect(basenames).toContain('Note 2');
    });

    it('should apply filters when filterConfig is provided', async () => {
      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        'Project',
        20,
        projectFilterConfig
      );

      // Should only return files with #project tag
      expect(results.length).toBe(2);
      expect(results.every(r => r.insertText.startsWith('Project'))).toBe(true);
    });

    it('should return ALL files when filterConfig is undefined', async () => {
      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20,
        undefined
      );

      // Should return ALL files (4 total)
      expect(results.length).toBe(4);
      const basenames = results.map(r => r.insertText);
      expect(basenames).toContain('Project A');
      expect(basenames).toContain('Project B');
      expect(basenames).toContain('Note 1');
      expect(basenames).toContain('Note 2');
    });
  });

  describe('Tag Filtering', () => {
    it('should filter by required tags when configured', async () => {
      const filterConfig: FileFilterConfig = {
        requiredTags: ['project']
      };

      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20,
        filterConfig
      );

      // Only files with #project tag
      expect(results.length).toBe(2);
      expect(results.every(r => r.insertText.startsWith('Project'))).toBe(true);
    });

    it('should NOT filter by tags when no filterConfig provided', async () => {
      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20
      );

      // All files should be returned
      expect(results.length).toBe(4);
    });
  });

  describe('Folder Filtering', () => {
    it('should filter by included folders when configured', async () => {
      const filterConfig: FileFilterConfig = {
        includeFolders: ['projects']
      };

      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20,
        filterConfig
      );

      // Only files in projects/ folder
      expect(results.length).toBe(2);
      expect(results.every(r => r.insertText.startsWith('Project'))).toBe(true);
    });

    it('should NOT filter by folders when no filterConfig provided', async () => {
      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20
      );

      // All files should be returned
      expect(results.length).toBe(4);
    });
  });

  describe('Property Filtering', () => {
    it('should filter by property when configured', async () => {
      const filterConfig: FileFilterConfig = {
        propertyKey: 'type',
        propertyValue: 'project'
      };

      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20,
        filterConfig
      );

      // Only files with type: project
      expect(results.length).toBe(2);
      expect(results.every(r => r.insertText.startsWith('Project'))).toBe(true);
    });

    it('should NOT filter by property when no filterConfig provided', async () => {
      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20
      );

      // All files should be returned
      expect(results.length).toBe(4);
    });
  });

  describe('Multiple Filters Combined', () => {
    it('should apply all filters when configured', async () => {
      const filterConfig: FileFilterConfig = {
        requiredTags: ['project'],
        includeFolders: ['projects'],
        propertyKey: 'type',
        propertyValue: 'project'
      };

      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20,
        filterConfig
      );

      // Only files matching ALL criteria
      expect(results.length).toBe(2);
      expect(results.every(r => r.insertText.startsWith('Project'))).toBe(true);
    });

    it('should ignore all filters when no filterConfig provided', async () => {
      const results = await FileSuggestHelper.suggest(
        mockPlugin,
        '',
        20
      );

      // All files should be returned regardless of filters
      expect(results.length).toBe(4);
    });
  });

  describe('Query Matching', () => {
    it('should match query regardless of filter settings', async () => {
      const resultsWithoutFilters = await FileSuggestHelper.suggest(
        mockPlugin,
        'Note 1',
        20
      );

      // Should match "Note 1" specifically
      expect(resultsWithoutFilters.length).toBeGreaterThanOrEqual(1);
      expect(resultsWithoutFilters.some(r => r.insertText === 'Note 1')).toBe(true);
    });
  });
});

