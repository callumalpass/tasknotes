import { generateLink, generateLinkWithBasename, generateLinkWithDisplay, getProjectDisplayName, parseLinkToPath } from '../../../src/utils/linkUtils';
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

  describe('parseLinkToPath', () => {
    it('should parse wikilinks with alias', () => {
      const link = '[[Folder/My Note|Alias]]';
      expect(parseLinkToPath(link)).toBe('Folder/My Note');
    });

    it('should parse markdown links with angle bracket paths', () => {
      const link = '[My Note](<Folder/My Note.md>)';
      expect(parseLinkToPath(link)).toBe('Folder/My Note.md');
    });

    it('should parse plain angle bracket autolinks', () => {
      const link = '<Folder/My Note.md>';
      expect(parseLinkToPath(link)).toBe('Folder/My Note.md');
    });

    it('should decode markdown link paths without .md extension', () => {
      const link = '[My Note](Folder/My%20Note)';
      expect(parseLinkToPath(link)).toBe('Folder/My Note');
    });
  });

  describe('getProjectDisplayName', () => {
    it('should prefer markdown link display text', () => {
      const link = '[Display Title](<Folder/My Note.md>)';
      expect(getProjectDisplayName(link)).toBe('Display Title');
    });

    it('should prefer wikilink alias', () => {
      const link = '[[Folder/My Note|Alias Title]]';
      expect(getProjectDisplayName(link)).toBe('Alias Title');
    });

    it('should resolve basename from app when possible', () => {
      const appWithResolver = createMockApp(MockObsidian.createMockApp());
      (appWithResolver.metadataCache as any).getFirstLinkpathDest = jest.fn().mockReturnValue({
        basename: 'Resolved Project'
      });

      const link = '[[Folder/My Note]]';
      expect(getProjectDisplayName(link, appWithResolver)).toBe('Resolved Project');
    });

    it('should fall back to last path segment when unresolved', () => {
      const link = '[[Folder/My Note]]';
      expect(getProjectDisplayName(link)).toBe('My Note');
    });
  });
});
