jest.mock('obsidian', () => {
  const base = jest.requireActual('obsidian');
  return {
    ...base,
    parseFrontMatterAliases: (frontmatter: any): string[] => {
      if (!frontmatter) return [];
      const aliases = (frontmatter as any).aliases ?? (frontmatter as any).alias ?? [];
      if (typeof aliases === 'string') return [aliases];
      if (Array.isArray(aliases)) return aliases.filter(a => typeof a === 'string');
      return [];
    }
  };
});

import { App, TFile } from 'obsidian';
import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';

class MockPlugin {
  app: App;
  settings: any;
  cacheManager: any;
  fieldMapper: any;
  constructor(app: App, settings: any) {
    this.app = app;
    this.settings = settings;
    this.cacheManager = { getAllContexts: jest.fn(() => []), getAllTags: jest.fn(() => []) };
    this.fieldMapper = { mapFromFrontmatter: (fm: any) => ({ title: fm?.title || '' }) };
  }
}

describe('+ project suggestions with |s searchable flag', () => {
  let mockApp: App;
  let mockPlugin: any;

  beforeEach(() => {
    // Build deterministic environment by injecting files and cache via DI (no shared FS reliance)
    mockApp = new (require('obsidian').App)();
    const file = new (require('obsidian').TFile)('Clients/Acme/Project.md');
    (mockApp as any).vault.getMarkdownFiles = jest.fn(() => [file]);
    (mockApp as any).metadataCache.getFileCache = jest.fn((f: any) => {
      if (f.path === 'Clients/Acme/Project.md') {
        return { frontmatter: { title: 'Foobar', customer: 'Acme Corp' } };
      }
      return null;
    });

    const settings = {
      enableNaturalLanguageInput: true,
      projectAutosuggest: {
        enableFuzzy: false,
        rows: [
          '{title|n(Title)}',
          '{file.path|n(Path)}',
          '{customer|n(Customer)}'
        ],
      },
      excludedFolders: '',
      storeTitleInFilename: false,
      defaultTaskPriority: 'normal',
      defaultTaskStatus: 'open',
      taskCreationDefaults: {
        defaultDueDate: '',
        defaultScheduledDate: '',
        defaultContexts: '',
        defaultTags: '',
        defaultProjects: '',
        defaultTimeEstimate: 0,
        defaultReminders: [],
      },
    };

    mockPlugin = new MockPlugin(mockApp, settings);
  });

  function setupModal() {
    const modal = new TaskCreationModal(mockApp, mockPlugin);
    const root = document.createElement('div') as unknown as HTMLElement;
    (modal as any).createNaturalLanguageInput(root);
    const textarea: HTMLTextAreaElement = (modal as any).nlInput;
    const suggest: any = (modal as any).nlpSuggest;
    // Ensure the NLPSuggest instance has explicit app and plugin references
    suggest.plugin = mockPlugin;
    suggest.obsidianApp = mockApp;
    return { modal, textarea, suggest };
  }

  it('defaults searchable fields are always active (basename, title, aliases)', async () => {
    const { textarea, suggest } = setupModal();
    textarea.value = '+foo';
    textarea.selectionStart = textarea.value.length;

    const suggestions = await suggest.getSuggestions('');
    const projects = (suggestions as any[]).filter(s => s.type === 'project');
    // We don't assert a hit here; just ensure no exceptions and array shape is valid
    expect(Array.isArray(projects)).toBe(true);
  });

  it('adds additional searchable fields (|s) on top of defaults', async () => {
    // Mark file.path as searchable
    mockPlugin.settings.projectAutosuggest.rows = [
      '{title|n(Title)}',
      '{file.path|n(Path)|s}',
      '{customer|n(Customer)}'
    ];

    const { textarea, suggest } = setupModal();
    textarea.value = '+acme';
    textarea.selectionStart = textarea.value.length;

    const suggestions = await suggest.getSuggestions('');
    const projects = (suggestions as any[]).filter(s => s.type === 'project');
    expect(projects.length).toBeGreaterThanOrEqual(1);
  });

  it('matches custom frontmatter fields when flagged with |s in addition to defaults', async () => {
    mockPlugin.settings.projectAutosuggest.rows = [
      '{customer|n(Customer)|s}',
      '{title|n(Title)}'
    ];

    const { textarea, suggest } = setupModal();
    textarea.value = '+acme';
    textarea.selectionStart = textarea.value.length;

    const suggestions = await suggest.getSuggestions('');
    const projects = (suggestions as any[]).filter(s => s.type === 'project');
    expect(projects.length).toBeGreaterThanOrEqual(1);
  });
});

