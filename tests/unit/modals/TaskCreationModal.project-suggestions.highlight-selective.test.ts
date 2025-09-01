jest.mock('obsidian');

import type { App } from 'obsidian';
import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { MockObsidian } from '../../__mocks__/obsidian';

describe('Project suggestion highlighting - selective by |s and always-searchable', () => {
  let app: App;
  let plugin: any;

  beforeEach(() => {
    MockObsidian.reset();
    app = MockObsidian.createMockApp() as unknown as App;

    plugin = {
      app,
      settings: {
        enableNaturalLanguageInput: true,
        projectAutosuggest: {
          enableFuzzy: false,
          rows: [],
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
      },
      cacheManager: { getAllContexts: jest.fn(() => []), getAllTags: jest.fn(() => []) },
      fieldMapper: { mapFromFrontmatter: jest.fn((fm: any) => ({ title: fm?.title || '' })) },
    };
  });

  function createModal() {
    const modal = new TaskCreationModal(app, plugin);
    const root = document.createElement('div') as unknown as HTMLElement;
    (modal as any).createNaturalLanguageInput(root);
    const textarea: HTMLTextAreaElement = (modal as any).nlInput;
    const suggest: any = (modal as any).nlpSuggest;
    return { modal, textarea, suggest };
  }

  function renderSuggestion(suggest: any, query: string, suggestion: any) {
    suggest.currentTrigger = '+';
    const el = document.createElement('div');
    const textarea: HTMLTextAreaElement = (suggest as any).textarea ?? ((suggest as any).plugin?.nlInput);
    // Set the textarea on the suggest via back-reference to modal
    // Safer: set through modal reference
    // However, renderSuggestion reads suggest.textarea via closure; we set on modal's nlInput
    // The outer tests ensure textarea exists and is set in createNaturalLanguageInput
    const modalTextarea: HTMLTextAreaElement = (suggest as any).textarea || (suggest?.textareaEl) || (suggest?.textarea) || (suggest?.plugin?.nlInput);
    if (modalTextarea) {
      modalTextarea.value = query;
      modalTextarea.selectionStart = modalTextarea.value.length;
    }
    suggest.renderSuggestion(suggestion, el);
    return el;
  }

  function buildProjectSuggestion({ basename, path, parent, title, aliases, frontmatter }: any) {
    return {
      basename,
      displayName: basename,
      type: 'project' as const,
      entry: {
        basename,
        name: `${basename}.md`,
        path,
        parent,
        title,
        aliases,
        frontmatter,
      },
      toString() { return this.basename; }
    };
  }

  test('1) Only |s fields are highlighted in meta; filename always highlighted', () => {
    plugin.settings.projectAutosuggest.rows = ['{file.path}', '{tags|s}'];

    const { suggest } = createModal();
    const suggestion = buildProjectSuggestion({
      basename: 'Watch fantastic four',
      path: 'personal/tasks',
      parent: 'personal',
      title: 'Watch fantastic four',
      aliases: [],
      frontmatter: { tags: ['tasks'] },
    });

    const el = renderSuggestion(suggest, '+tas', suggestion);

    // Filename row should have highlight
    const filenameRow = el.querySelector('.nlp-suggest-project__filename');
    expect(filenameRow?.querySelector('mark')).toBeTruthy();

    const metaValues = Array.from(el.querySelectorAll('.nlp-suggest-project__meta .nlp-suggest-project__meta-value'));
    expect(metaValues.length).toBe(2);
    const marksPerValue = metaValues.map(v => v.querySelectorAll('mark').length);
    // file.path has no |s => no mark; tags|s has => mark present
    expect(marksPerValue).toEqual(expect.arrayContaining([0, expect.any(Number)]));
    expect(marksPerValue.some(c => c > 0)).toBe(true);
  });

  test('2) Title and aliases are highlighted even without |s', () => {
    plugin.settings.projectAutosuggest.rows = ['{title|n(Title)}', '{aliases|n(Aliases)}'];

    const { suggest } = createModal();
    const suggestion = buildProjectSuggestion({
      basename: 'My plan',
      path: 'foo/bar',
      parent: 'foo',
      title: 'Tasks master',
      aliases: ['Tas alias'],
      frontmatter: {},
    });

    const el = renderSuggestion(suggest, '+tas', suggestion);

    const metaValues = Array.from(el.querySelectorAll('.nlp-suggest-project__meta .nlp-suggest-project__meta-value'));
    expect(metaValues.length).toBe(2);
    // Both should have a <mark>
    for (const v of metaValues) {
      expect(v.querySelector('mark')).toBeTruthy();
    }
  });

  test("3) Non '+' triggers do not apply highlighting", () => {
    plugin.settings.projectAutosuggest.rows = ['{file.path}', '{tags|s}'];

    const { suggest, textarea } = createModal();
    const suggestion = buildProjectSuggestion({
      basename: 'Watch fantastic four',
      path: 'personal/tasks',
      parent: 'personal',
      title: 'Tasks master',
      aliases: ['Tas alias'],
      frontmatter: { tags: ['tasks'] },
    });

    // Set a non-plus trigger
    textarea.value = '@tas';
    textarea.selectionStart = textarea.value.length;
    suggest.currentTrigger = '@';

    const el = document.createElement('div');
    suggest.renderSuggestion(suggestion, el);

    expect(el.querySelector('mark')).toBeFalsy();
  });

  test('4) Mixed row: only searchable token is highlighted, not literals nor non-|s token', () => {
    plugin.settings.projectAutosuggest.rows = ['{customer|n(Customer)|s} - {file.path|n(Path)}'];

    const { suggest } = createModal();
    const suggestion = buildProjectSuggestion({
      basename: 'Demo',
      path: 'work/tas-demo',
      parent: 'work',
      title: 'Demo',
      aliases: [],
      frontmatter: { customer: 'Tasco' },
    });

    const el = renderSuggestion(suggest, '+tas', suggestion);
    const meta = el.querySelector('.nlp-suggest-project__meta')!;
    const valueSpans = Array.from(meta.querySelectorAll('.nlp-suggest-project__meta-value'));
    // Only customer value should have a <mark>
    const marks = Array.from(meta.querySelectorAll('mark'));
    expect(marks.length).toBe(1);
    expect(valueSpans.some(v => v.querySelector('mark'))).toBe(true);
  });

  test('5) Arrays joined values: highlight inside array element', () => {
    plugin.settings.projectAutosuggest.rows = ['{aliases|n(Aliases)|s}'];

    const { suggest } = createModal();
    const suggestion = buildProjectSuggestion({
      basename: 'Array demo',
      path: 'x/y',
      parent: 'x',
      title: 'Array demo',
      aliases: ['foo', 'TasBar', 'baz'],
      frontmatter: {},
    });

    const el = renderSuggestion(suggest, '+tas', suggestion);
    const value = el.querySelector('.nlp-suggest-project__meta-value')!;
    expect(value.textContent?.toLowerCase()).toContain('foo, tasbar, baz');
    expect(value.querySelector('mark')?.textContent?.toLowerCase()).toBe('tas');
  });

  test('6) Non-searchable field is not highlighted', () => {
    plugin.settings.projectAutosuggest.rows = ['{file.parent}'];

    const { suggest } = createModal();
    const suggestion = buildProjectSuggestion({
      basename: 'Parent demo',
      path: 'a/b',
      parent: 'tas-folder',
      title: 'Parent demo',
      aliases: [],
      frontmatter: {},
    });

    const el = renderSuggestion(suggest, '+tas', suggestion);
    const value = el.querySelector('.nlp-suggest-project__meta-value');
    expect(value?.querySelector('mark')).toBeFalsy();
  });
});

