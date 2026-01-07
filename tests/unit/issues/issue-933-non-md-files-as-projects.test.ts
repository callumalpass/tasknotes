/**
 * Issue #933: [FR] Add anything other than .md files as a project
 *
 * Problem:
 * When creating a new task, only notes that have a .md extension are suggested.
 * Any other extensions, such as .canvas, are ignored.
 *
 * Root cause:
 * FileSuggestHelper.ts uses plugin.app.vault.getMarkdownFiles() (line 34-35)
 * which only returns .md files. This is an intentional call to the Obsidian API
 * that filters to markdown files only.
 *
 * Proposed fix:
 * Use plugin.app.vault.getFiles() instead, then optionally filter by extension
 * if the user wants to restrict to certain file types. This would allow canvas
 * files and other Obsidian file types to be suggested as projects.
 *
 * Workaround:
 * Manually edit the `projects` property in the task note.
 */

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

describe('Issue #933: Non-.md files as projects', () => {
  let mockPlugin: any;

  beforeEach(() => {
    // Create mock files including both .md and non-.md files
    const allFiles: TFile[] = [
      {
        basename: 'Project Alpha',
        path: 'projects/Project Alpha.md',
        extension: 'md',
        parent: { path: 'projects' }
      } as TFile,
      {
        basename: 'Canvas Project',
        path: 'projects/Canvas Project.canvas',
        extension: 'canvas',
        parent: { path: 'projects' }
      } as TFile,
      {
        basename: 'Design Board',
        path: 'projects/Design Board.canvas',
        extension: 'canvas',
        parent: { path: 'projects' }
      } as TFile,
      {
        basename: 'Notes Doc',
        path: 'projects/Notes Doc.md',
        extension: 'md',
        parent: { path: 'projects' }
      } as TFile,
    ];

    // The current implementation only returns markdown files
    const markdownFiles = allFiles.filter(f => f.extension === 'md');

    mockPlugin = {
      app: {
        vault: {
          // This is what FileSuggestHelper currently uses - only returns .md files
          getMarkdownFiles: jest.fn(() => markdownFiles),
          // This is what should be used to get ALL files including .canvas
          getFiles: jest.fn(() => allFiles),
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

  describe('Current behavior (bug reproduction)', () => {
    it('only suggests .md files, ignoring .canvas files', async () => {
      // This test documents the current (undesired) behavior
      const results = await FileSuggestHelper.suggest(mockPlugin, '');

      // Currently only returns 2 files (the .md files)
      expect(results.length).toBe(2);
      expect(results.map(r => r.insertText)).toEqual(
        expect.arrayContaining(['Project Alpha', 'Notes Doc'])
      );

      // Canvas files are NOT included - this is the bug
      expect(results.map(r => r.insertText)).not.toContain('Canvas Project');
      expect(results.map(r => r.insertText)).not.toContain('Design Board');
    });
  });

  describe('Expected behavior (feature request)', () => {
    // These tests are skipped until the feature is implemented
    it.skip('reproduces issue #933: should suggest .canvas files when searching for projects', async () => {
      // When the fix is implemented, this test should pass
      const results = await FileSuggestHelper.suggest(mockPlugin, 'Canvas');

      // Should find the canvas file
      expect(results.some(r => r.insertText === 'Canvas Project')).toBe(true);
    });

    it.skip('reproduces issue #933: should suggest all file types, not just .md', async () => {
      // When the fix is implemented, all files should be suggested
      const results = await FileSuggestHelper.suggest(mockPlugin, '');

      // Should return all 4 files including .canvas
      expect(results.length).toBe(4);
      expect(results.map(r => r.insertText)).toEqual(
        expect.arrayContaining(['Project Alpha', 'Canvas Project', 'Design Board', 'Notes Doc'])
      );
    });

    it.skip('reproduces issue #933: should match .canvas files by basename', async () => {
      // Searching for "Design" should find "Design Board.canvas"
      const results = await FileSuggestHelper.suggest(mockPlugin, 'Design');

      expect(results.some(r => r.insertText === 'Design Board')).toBe(true);
    });

    it.skip('reproduces issue #933: should allow configuring which file extensions to include', async () => {
      // Future enhancement: allow users to configure which extensions are valid for projects
      // For now, this documents the expected behavior

      // Example: user only wants .md and .canvas files as projects (not .pdf, .png, etc.)
      // This could be a setting like: allowedProjectExtensions: ['md', 'canvas']
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Implementation notes', () => {
    it('documents that getMarkdownFiles() is the source of the limitation', async () => {
      // Verify that the current implementation calls getMarkdownFiles
      await FileSuggestHelper.suggest(mockPlugin, '');

      // The implementation uses getMarkdownFiles() which only returns .md files
      expect(mockPlugin.app.vault.getMarkdownFiles).toHaveBeenCalled();

      // It does NOT use getFiles() which would return all files
      expect(mockPlugin.app.vault.getFiles).not.toHaveBeenCalled();
    });
  });
});
