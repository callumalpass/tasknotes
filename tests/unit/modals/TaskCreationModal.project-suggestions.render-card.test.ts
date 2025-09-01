jest.mock('obsidian');

import type { App } from 'obsidian';
import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { MockObsidian } from '../../__mocks__/obsidian';

describe('TaskCreationModal project suggestion rendering (MVP)', () => {
  let mockApp: App;
  let mockPlugin: any;

  beforeEach(() => {
    MockObsidian.reset();
    mockApp = MockObsidian.createMockApp() as unknown as App;

    // Create two markdown files in the mock vault with frontmatter
    const yaml = require('yaml');
    const workContent = `---\n${yaml.stringify({ title: 'Work Plan', aliases: ['P'] })}---\n`;
    const personalContent = `---\n${yaml.stringify({ title: 'Personal Plan', aliases: ['P'] })}---\n`;
    MockObsidian.createTestFile('Work/Plan.md', workContent);
    MockObsidian.createTestFile('Personal/Plan.md', personalContent);

    // Minimal plugin mock with required settings and services
    mockPlugin = {
      app: mockApp,
      settings: {
        enableNaturalLanguageInput: true,
        projectAutosuggest: {
          enableFuzzy: false,
          rows: [
            '{title|n(Title)}',
            '{aliases|n(Aliases)}',
            '{file.path|n(Path)}',
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
      },
      cacheManager: {
        getAllContexts: jest.fn(() => []),
        getAllTags: jest.fn(() => []),
      },
      fieldMapper: {
        mapFromFrontmatter: jest.fn((fm: any, _path: string) => ({ title: fm?.title || '' })),
      },
    };
  });

  it('produces multi-line suggestion content with filename row and configured rows', async () => {
    const modal = new TaskCreationModal(mockApp, mockPlugin);

    // Create a minimal container element with Obsidian-like helpers
    const enhance = (el: any) => {
      el.addClass = function(...classes: string[]) { this.classList.add(...classes); return this; };
      el.removeClass = function(...classes: string[]) { this.classList.remove(...classes); return this; };
      el.createEl = function(tag: string, attrs?: any) {
        const child = document.createElement(tag);
        if (attrs?.cls) {
          if (Array.isArray(attrs.cls)) child.classList.add(...attrs.cls);
          else child.classList.add(attrs.cls);
        }
        if (attrs?.text) child.textContent = attrs.text;
        if (attrs?.attr) Object.entries(attrs.attr).forEach(([k, v]) => child.setAttribute(k, String(v)));
        enhance(child);
        this.appendChild(child);
        return child;
      };
      el.createDiv = function(attrs?: any) { return this.createEl('div', attrs); };
      el.empty = function() { this.innerHTML = ''; return this; };
      return el;
    };

    const root = enhance(document.createElement('div')) as unknown as HTMLElement;

    // Call the internal creator to initialize textarea + suggest
    (modal as any).createNaturalLanguageInput(root);

    const textarea: HTMLTextAreaElement = (modal as any).nlInput;
    textarea.value = '+pla';
    textarea.selectionStart = textarea.value.length;

    const suggest: any = (modal as any).nlpSuggest;
    // Build a synthetic project suggestion (avoid dependency on vault scanning)
    const suggestion = {
      basename: 'Plan',
      displayName: 'Plan [title: Work Plan | aliases: P]',
      type: 'project' as const,
      entry: {
        basename: 'Plan',
        name: 'Plan.md',
        path: 'Work/Plan.md',
        parent: 'Work',
        title: 'Work Plan',
        aliases: ['P'],
        frontmatter: { title: 'Work Plan', aliases: ['P'] },
      },
      toString() { return this.basename; }
    };

    // Simulate render
    const el = document.createElement('div');
    suggest['currentTrigger'] = '+';
    suggest.renderSuggestion(suggestion as any, el);

    // Filename row present
    expect(el.querySelector('.nlp-suggest-project__filename')).toBeTruthy();
    // Configured rows present (Title, Aliases, Path)
    expect(el.textContent).toContain('Work Plan');
    expect(el.textContent).toContain('Aliases');
    expect(el.textContent).toContain('Work/Plan.md');
  });
});
