jest.mock('obsidian');

import type { App } from 'obsidian';
import { ProjectSelectModal } from '../../../src/modals/ProjectSelectModal';
import { MockObsidian } from '../../__mocks__/obsidian';

describe('ProjectSelectModal property filtering', () => {
  let mockApp: App;
  let mockPlugin: any;

  beforeEach(async () => {
    MockObsidian.reset();
    mockApp = MockObsidian.createMockApp() as unknown as App;
    // Provide getAllLoadedFiles for the modal under test
    (mockApp.vault as any).getAllLoadedFiles = () => mockApp.vault.getFiles();

    const yaml = require('yaml');
    await mockApp.vault.create('Projects/Alpha.md', `---\n${yaml.stringify({ type: 'project' })}---\n`);
    await mockApp.vault.create('Notes/Idea.md', `---\n${yaml.stringify({ type: 'note' })}---\n`);
    mockApp.metadataCache.setCache('Projects/Alpha.md', {
      frontmatter: { type: 'project' },
      tags: [],
    });
    mockApp.metadataCache.setCache('Notes/Idea.md', {
      frontmatter: { type: 'note' },
      tags: [],
    });

    mockPlugin = {
      app: mockApp,
      settings: {
        projectAutosuggest: {
          enableFuzzy: false,
          rows: [],
          showAdvanced: false,
          requiredTags: [],
          includeFolders: [],
          propertyKey: 'type',
          propertyValue: 'project',
        },
        storeTitleInFilename: false,
      },
      fieldMapper: {
        mapFromFrontmatter: jest.fn(() => ({ title: '' })),
      },
    };
  });

  it('only returns files that match the configured property filter', () => {
    const alphaFile = mockApp.vault.getAbstractFileByPath('Projects/Alpha.md');
    expect(alphaFile).toBeTruthy();
    const cache = mockApp.metadataCache.getFileCache(alphaFile as any);
    expect(cache?.frontmatter?.type).toBe('project');

    const modal = new ProjectSelectModal(mockApp, mockPlugin, jest.fn());
    const items = modal.getItems();
    const paths = items.map(item => (item as any).path ?? '');
    expect(paths).toContain('Projects/Alpha.md');
    expect(paths).not.toContain('Notes/Idea.md');
  });

  it('filters project suggestions by required frontmatter tags', () => {
    mockPlugin.settings.projectAutosuggest.propertyKey = '';
    mockPlugin.settings.projectAutosuggest.propertyValue = '';
    mockPlugin.settings.projectAutosuggest.requiredTags = ['project'];

    mockApp.metadataCache.setCache('Projects/Alpha.md', {
      frontmatter: { tag: 'project' },
      tags: [],
    });
    mockApp.metadataCache.setCache('Notes/Idea.md', {
      frontmatter: { tags: ['note'] },
      tags: [],
    });

    const modal = new ProjectSelectModal(mockApp, mockPlugin, jest.fn());
    const paths = modal.getItems().map(item => (item as any).path ?? '');

    expect(paths).toContain('Projects/Alpha.md');
    expect(paths).not.toContain('Notes/Idea.md');
  });

  it('resolves include folders relative to the active note folder', async () => {
    mockPlugin.settings.projectAutosuggest.propertyKey = '';
    mockPlugin.settings.projectAutosuggest.propertyValue = '';
    mockPlugin.settings.projectAutosuggest.includeFolders = ['./Projects'];

    await mockApp.vault.create('Work/Current.md', '');
    await mockApp.vault.create('Work/Projects/Beta.md', '');
    mockApp.metadataCache.setCache('Work/Current.md', { frontmatter: {}, tags: [] });
    mockApp.metadataCache.setCache('Work/Projects/Beta.md', { frontmatter: {}, tags: [] });
    (mockApp.workspace as any).getActiveFile = jest.fn(() =>
      mockApp.vault.getAbstractFileByPath('Work/Current.md')
    );

    const modal = new ProjectSelectModal(mockApp, mockPlugin, jest.fn());
    const paths = modal.getItems().map(item => (item as any).path ?? '');

    expect(paths).toContain('Work/Projects/Beta.md');
    expect(paths).not.toContain('Projects/Alpha.md');
    expect(paths).not.toContain('Notes/Idea.md');
  });
});
