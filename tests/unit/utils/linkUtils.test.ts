import { generateLink, generateLinkWithBasename, generateLinkWithDisplay } from '../../../src/utils/linkUtils';
import { MockObsidian } from '../../__mocks__/obsidian';
import type { App, TFile } from 'obsidian';

// @ts-ignore helper to cast the mock app
const createMockApp = (mockApp: any): App => mockApp as unknown as App;

jest.mock('obsidian');

describe('linkUtils - frontmatter link format', () => {
  let mockApp: App;
  let mockFile: TFile;

  beforeEach(() => {
    MockObsidian.reset();
    mockApp = createMockApp(MockObsidian.createMockApp());

    // Create a test file
    const vault = (mockApp as any).vault;
    vault.create('projects/Test Project.md', '');
    mockFile = vault.getAbstractFileByPath('projects/Test Project.md') as TFile;
  });

  describe('generateLink', () => {
    it('should always generate wikilinks for frontmatter properties (regression test for #827)', () => {
      // The bug: generateMarkdownLink respects user settings and might generate markdown links
      // But markdown links don't work in frontmatter properties in Obsidian
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md');

      // Expected: wikilink format [[Test Project]]
      // Bug would produce: [Test Project](projects/Test%20Project.md)
      expect(link).toMatch(/^\[\[.*\]\]$/); // Should be wikilink format
      expect(link).not.toMatch(/^\[.*\]\(.*\)$/); // Should NOT be markdown format
    });

    it('should generate wikilink with basename only when no alias provided', () => {
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md');
      expect(link).toBe('[[Test Project]]');
    });

    it('should generate wikilink with alias when provided', () => {
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md', '', 'Custom Alias');
      expect(link).toBe('[[Test Project|Custom Alias]]');
    });

    it('should handle subpaths correctly', () => {
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md', '#Section', '');
      expect(link).toBe('[[Test Project#Section]]');
    });
  });

  describe('generateLinkWithBasename', () => {
    it('should generate wikilink with basename as alias', () => {
      const link = generateLinkWithBasename(mockApp, mockFile, 'tasks/My Task.md');
      expect(link).toBe('[[Test Project|Test Project]]');
    });
  });

  describe('generateLinkWithDisplay', () => {
    it('should generate wikilink with custom display name', () => {
      const link = generateLinkWithDisplay(mockApp, mockFile, 'tasks/My Task.md', 'My Custom Display');
      expect(link).toBe('[[Test Project|My Custom Display]]');
    });
  });

  describe('markdown link mode (when useMarkdownLinks=true)', () => {
    it('should generate markdown links when explicitly requested', () => {
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md', '', '', true);

      // Should be markdown format when enabled
      expect(link).toMatch(/^\[.*\]\(.*\)$/);
      expect(link).toBe('[Test Project](projects/Test Project.md)');
    });

    it('should generate markdown links with alias when provided', () => {
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md', '', 'Custom Alias', true);
      expect(link).toBe('[Custom Alias](projects/Test Project.md)');
    });

    it('should generate markdown links with subpath when provided', () => {
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md', '#Section', '', true);
      expect(link).toBe('[Test Project](projects/Test Project.md#Section)');
    });

    it('should generate wikilinks by default when useMarkdownLinks is false', () => {
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md', '', '', false);
      expect(link).toBe('[[Test Project]]');
    });

    it('should generate wikilinks by default when useMarkdownLinks is undefined', () => {
      const link = generateLink(mockApp, mockFile, 'tasks/My Task.md');
      expect(link).toBe('[[Test Project]]');
    });
  });
});
