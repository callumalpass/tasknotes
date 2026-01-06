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

    // Issue #1427: Tags filtering not working when notes only have frontmatter tags
    describe('Issue #1427: Frontmatter-only tags filtering', () => {
      let frontmatterOnlyMockPlugin: any;
      let frontmatterOnlyMockFiles: TFile[];

      beforeEach(() => {
        // Create mock files where tags are ONLY in frontmatter (no inline #tags)
        frontmatterOnlyMockFiles = [
          {
            basename: 'Project Alpha',
            path: 'projects/Project Alpha.md',
            extension: 'md',
            parent: { path: 'projects' }
          } as TFile,
          {
            basename: 'Project Beta',
            path: 'projects/Project Beta.md',
            extension: 'md',
            parent: { path: 'projects' }
          } as TFile,
          {
            basename: 'Regular Note',
            path: 'notes/Regular Note.md',
            extension: 'md',
            parent: { path: 'notes' }
          } as TFile,
        ];

        frontmatterOnlyMockPlugin = {
          app: {
            vault: {
              getMarkdownFiles: jest.fn(() => frontmatterOnlyMockFiles),
            },
            metadataCache: {
              getFileCache: jest.fn((file: TFile) => {
                // Project files have tags ONLY in frontmatter (no native #tags)
                if (file.path.startsWith('projects/')) {
                  return {
                    frontmatter: {
                      tags: ['project'], // Frontmatter tags only
                    },
                    tags: [], // No native inline #tags detected
                  };
                }
                // Regular notes have no tags
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

      it('should filter by requiredTags when tags are only in frontmatter', async () => {
        // This is the bug from issue #1427:
        // Setting Required Tags to "project" should match notes with frontmatter tags: [project]
        const filterConfig: FileFilterConfig = {
          requiredTags: ['project']
        };

        const results = await FileSuggestHelper.suggest(
          frontmatterOnlyMockPlugin,
          '',
          20,
          filterConfig
        );

        // Should find the 2 project files that have tags: [project] in frontmatter
        expect(results.length).toBe(2);
        expect(results.some(r => r.insertText === 'Project Alpha')).toBe(true);
        expect(results.some(r => r.insertText === 'Project Beta')).toBe(true);
      });

      it('should produce same results as property filter for tags', async () => {
        // This demonstrates the discrepancy from issue #1427:
        // - requiredTags: ['project'] should work the same as
        // - propertyKey: 'tags', propertyValue: 'project'

        const tagFilterConfig: FileFilterConfig = {
          requiredTags: ['project']
        };

        const propertyFilterConfig: FileFilterConfig = {
          propertyKey: 'tags',
          propertyValue: 'project'
        };

        const tagResults = await FileSuggestHelper.suggest(
          frontmatterOnlyMockPlugin,
          '',
          20,
          tagFilterConfig
        );

        const propertyResults = await FileSuggestHelper.suggest(
          frontmatterOnlyMockPlugin,
          '',
          20,
          propertyFilterConfig
        );

        // Both should return the same files
        expect(tagResults.length).toBe(propertyResults.length);
        expect(tagResults.length).toBe(2);
      });

      it('should work with single tag string in frontmatter', async () => {
        // Some users might have tags: project (string) instead of tags: [project] (array)
        const singleTagMockPlugin = {
          ...frontmatterOnlyMockPlugin,
          app: {
            ...frontmatterOnlyMockPlugin.app,
            metadataCache: {
              getFileCache: jest.fn((file: TFile) => {
                if (file.path.startsWith('projects/')) {
                  return {
                    frontmatter: {
                      tags: 'project', // Single string, not array
                    },
                    tags: [],
                  };
                }
                return {
                  frontmatter: {},
                  tags: []
                };
              }),
            },
          },
        };

        const filterConfig: FileFilterConfig = {
          requiredTags: ['project']
        };

        const results = await FileSuggestHelper.suggest(
          singleTagMockPlugin,
          '',
          20,
          filterConfig
        );

        expect(results.length).toBe(2);
      });

      it('should work when frontmatter.tags is undefined but parseFrontMatterTags returns tags', async () => {
        // This simulates the real Obsidian behavior where tags might not be
        // directly accessible via frontmatter.tags but are available via parseFrontMatterTags
        const obsidianStyleMockPlugin = {
          ...frontmatterOnlyMockPlugin,
          app: {
            ...frontmatterOnlyMockPlugin.app,
            metadataCache: {
              getFileCache: jest.fn((file: TFile) => {
                if (file.path.startsWith('projects/')) {
                  return {
                    frontmatter: {
                      // Obsidian might store tags in a different format internally
                      // The raw 'tags' key might not be directly accessible
                      // but parseFrontMatterTags would still return them
                    },
                    // Native tags array is also empty
                    tags: [],
                  };
                }
                return {
                  frontmatter: {},
                  tags: []
                };
              }),
            },
          },
        };

        const filterConfig: FileFilterConfig = {
          requiredTags: ['project']
        };

        // Note: This test documents the current behavior
        // If frontmatter.tags is undefined and cache.tags is empty,
        // no files will match - this might be the bug!
        const results = await FileSuggestHelper.suggest(
          obsidianStyleMockPlugin,
          '',
          20,
          filterConfig
        );

        // Currently this returns 0 because no tags are found
        // This might be the root cause of issue #1427
        expect(results.length).toBe(0);
      });

      it('should handle Obsidian tag format with # prefix in frontmatter', async () => {
        // Obsidian's parseFrontMatterTags might return tags with # prefix
        const hashPrefixMockPlugin = {
          ...frontmatterOnlyMockPlugin,
          app: {
            ...frontmatterOnlyMockPlugin.app,
            metadataCache: {
              getFileCache: jest.fn((file: TFile) => {
                if (file.path.startsWith('projects/')) {
                  return {
                    frontmatter: {
                      // Some users might store tags with # prefix in frontmatter
                      tags: ['#project'],
                    },
                    tags: [],
                  };
                }
                return {
                  frontmatter: {},
                  tags: []
                };
              }),
            },
          },
        };

        const filterConfig: FileFilterConfig = {
          requiredTags: ['project']
        };

        const results = await FileSuggestHelper.suggest(
          hashPrefixMockPlugin,
          '',
          20,
          filterConfig
        );

        // Should still match even if tags have # prefix
        // Current behavior: this might fail because '#project' !== 'project'
        expect(results.length).toBe(2);
      });

      it('should handle tags stored as "tag" key instead of "tags"', async () => {
        // Some YAML parsers or user configurations might use "tag" (singular)
        const singularKeyMockPlugin = {
          ...frontmatterOnlyMockPlugin,
          app: {
            ...frontmatterOnlyMockPlugin.app,
            metadataCache: {
              getFileCache: jest.fn((file: TFile) => {
                if (file.path.startsWith('projects/')) {
                  return {
                    frontmatter: {
                      tag: ['project'], // Note: "tag" instead of "tags"
                    },
                    tags: [],
                  };
                }
                return {
                  frontmatter: {},
                  tags: []
                };
              }),
            },
          },
        };

        const filterConfig: FileFilterConfig = {
          requiredTags: ['project']
        };

        const results = await FileSuggestHelper.suggest(
          singularKeyMockPlugin,
          '',
          20,
          filterConfig
        );

        // This will fail because the code only checks "tags" key
        // This might be a potential issue if users use "tag" key
        expect(results.length).toBe(0); // Documents current behavior
      });

      it('should handle empty string tags array', async () => {
        // Edge case: tags array exists but is empty or has empty strings
        const emptyTagsMockPlugin = {
          ...frontmatterOnlyMockPlugin,
          app: {
            ...frontmatterOnlyMockPlugin.app,
            metadataCache: {
              getFileCache: jest.fn((file: TFile) => {
                if (file.path.startsWith('projects/')) {
                  return {
                    frontmatter: {
                      tags: [], // Empty array
                    },
                    tags: [],
                  };
                }
                return {
                  frontmatter: {},
                  tags: []
                };
              }),
            },
          },
        };

        const filterConfig: FileFilterConfig = {
          requiredTags: ['project']
        };

        const results = await FileSuggestHelper.suggest(
          emptyTagsMockPlugin,
          '',
          20,
          filterConfig
        );

        expect(results.length).toBe(0);
      });

      it('should handle null frontmatter.tags', async () => {
        // Edge case: frontmatter exists but tags is null
        const nullTagsMockPlugin = {
          ...frontmatterOnlyMockPlugin,
          app: {
            ...frontmatterOnlyMockPlugin.app,
            metadataCache: {
              getFileCache: jest.fn((file: TFile) => {
                if (file.path.startsWith('projects/')) {
                  return {
                    frontmatter: {
                      tags: null,
                    },
                    tags: [],
                  };
                }
                return {
                  frontmatter: {},
                  tags: []
                };
              }),
            },
          },
        };

        const filterConfig: FileFilterConfig = {
          requiredTags: ['project']
        };

        const results = await FileSuggestHelper.suggest(
          nullTagsMockPlugin,
          '',
          20,
          filterConfig
        );

        expect(results.length).toBe(0);
      });
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

    // Issue #1325: Relative path support
    describe.skip('Relative Path Support (Issue #1325)', () => {
      let nestedMockFiles: TFile[];
      let nestedMockPlugin: any;

      beforeEach(() => {
        // Create a more complex folder structure for relative path testing
        nestedMockFiles = [
          {
            basename: 'Root Note',
            path: 'Root Note.md',
            extension: 'md',
            parent: { path: '' }
          } as TFile,
          {
            basename: 'Project Alpha',
            path: 'work/projects/Project Alpha.md',
            extension: 'md',
            parent: { path: 'work/projects' }
          } as TFile,
          {
            basename: 'Project Beta',
            path: 'work/projects/active/Project Beta.md',
            extension: 'md',
            parent: { path: 'work/projects/active' }
          } as TFile,
          {
            basename: 'Meeting Notes',
            path: 'work/notes/Meeting Notes.md',
            extension: 'md',
            parent: { path: 'work/notes' }
          } as TFile,
          {
            basename: 'Personal Todo',
            path: 'personal/Personal Todo.md',
            extension: 'md',
            parent: { path: 'personal' }
          } as TFile,
        ];

        nestedMockPlugin = {
          app: {
            vault: {
              getMarkdownFiles: jest.fn(() => nestedMockFiles),
            },
            metadataCache: {
              getFileCache: jest.fn(() => ({
                frontmatter: {},
                tags: []
              })),
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

      it('should support relative paths with ./ prefix', async () => {
        // When in context of 'work/' folder, './projects' should match 'work/projects'
        const filterConfig: FileFilterConfig = {
          includeFolders: ['./projects'],
          // Context: we're in the 'work' folder
        };

        // This test will fail until relative path support is implemented
        // The implementation should resolve './projects' relative to current context
        const results = await FileSuggestHelper.suggest(
          nestedMockPlugin,
          '',
          20,
          filterConfig,
          'work' // activeFolder context
        );

        // Should match files in work/projects and work/projects/active
        expect(results.length).toBe(2);
        expect(results.some(r => r.insertText === 'Project Alpha')).toBe(true);
        expect(results.some(r => r.insertText === 'Project Beta')).toBe(true);
      });

      it('should support relative paths with ../ prefix', async () => {
        // When in context of 'work/projects' folder, '../notes' should match 'work/notes'
        const filterConfig: FileFilterConfig = {
          includeFolders: ['../notes'],
        };

        const results = await FileSuggestHelper.suggest(
          nestedMockPlugin,
          '',
          20,
          filterConfig,
          'work/projects' // activeFolder context
        );

        // Should match files in work/notes
        expect(results.length).toBe(1);
        expect(results[0].insertText).toBe('Meeting Notes');
      });

      it('should support multiple ../ navigations', async () => {
        // When in 'work/projects/active', '../../notes' should match 'work/notes'
        const filterConfig: FileFilterConfig = {
          includeFolders: ['../../notes'],
        };

        const results = await FileSuggestHelper.suggest(
          nestedMockPlugin,
          '',
          20,
          filterConfig,
          'work/projects/active' // activeFolder context
        );

        // Should match files in work/notes
        expect(results.length).toBe(1);
        expect(results[0].insertText).toBe('Meeting Notes');
      });

      it('should support mixed relative and absolute paths', async () => {
        const filterConfig: FileFilterConfig = {
          includeFolders: ['./projects', 'personal'], // relative and absolute
        };

        const results = await FileSuggestHelper.suggest(
          nestedMockPlugin,
          '',
          20,
          filterConfig,
          'work' // activeFolder context
        );

        // Should match work/projects/* and personal/*
        expect(results.length).toBe(3);
        expect(results.some(r => r.insertText === 'Project Alpha')).toBe(true);
        expect(results.some(r => r.insertText === 'Project Beta')).toBe(true);
        expect(results.some(r => r.insertText === 'Personal Todo')).toBe(true);
      });

      it('should handle ../ that goes beyond vault root gracefully', async () => {
        // When in root, '../anything' should either fail gracefully or treat as root
        const filterConfig: FileFilterConfig = {
          includeFolders: ['../nonexistent'],
        };

        const results = await FileSuggestHelper.suggest(
          nestedMockPlugin,
          '',
          20,
          filterConfig,
          '' // root context
        );

        // Should return empty or all files depending on implementation
        // Current expectation: should handle gracefully without errors
        expect(Array.isArray(results)).toBe(true);
      });

      it('should normalize paths with trailing slashes in relative paths', async () => {
        const filterConfig: FileFilterConfig = {
          includeFolders: ['./projects/'], // trailing slash
        };

        const results = await FileSuggestHelper.suggest(
          nestedMockPlugin,
          '',
          20,
          filterConfig,
          'work' // activeFolder context
        );

        // Should still match work/projects/*
        expect(results.length).toBe(2);
        expect(results.some(r => r.insertText === 'Project Alpha')).toBe(true);
        expect(results.some(r => r.insertText === 'Project Beta')).toBe(true);
      });
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

