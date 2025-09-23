jest.mock('obsidian');

import type { App } from 'obsidian';
import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { MockObsidian } from '../../__mocks__/obsidian';

describe('TaskCreationModal project suggestion highlighting', () => {
  let mockApp: App;
  let mockPlugin: any;

  beforeEach(() => {
    MockObsidian.reset();
    mockApp = MockObsidian.createMockApp() as unknown as App;

    // Create two markdown files in the mock vault with frontmatter
    const yaml = require('yaml');
    const workContent = `---\n${yaml.stringify({ title: 'Work Plan', aliases: ['P'] })}---\n`;
    MockObsidian.createTestFile('Work/Plan.md', workContent);

    // Minimal plugin mock with required settings and services
    mockPlugin = {
      app: mockApp,
      settings: {
        enableNaturalLanguageInput: true,
        projectAutosuggest: {
          enableFuzzy: false,
          rows: [
            '{title|n(Title)}',
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
        mapFromFrontmatter: jest.fn((fm: any) => ({ title: fm?.title || '' })),
      },
      i18n: {
        translate: jest.fn((key: string, params?: Record<string, string | number>) => {
          // Mock translations for specific keys used in tests
          const translations: Record<string, string> = {
            'modals.taskCreation.notices.success': 'Task "{title}" created successfully',
            'modals.taskCreation.notices.failure': 'Failed to create task: {message}',
            'modals.taskCreation.notices.titleRequired': 'Please enter a task title'
          };

          let result = translations[key] || key;

          // Handle parameter substitution
          if (params) {
            Object.entries(params).forEach(([param, value]) => {
              result = result.replace(`{${param}}`, String(value));
            });
          }

          return result;
        })
      }
    };
  });

  function enhance(el: any) {
    el.addClass = function(...classes: string[]) { this.classList.add(...classes); return this; };
    el.removeClass = function(...classes: string[]) { this.classList.remove(...classes); return this; };
    el.createEl = function(tag: string, attrs?: any) {
      const child = document.createElement(tag);
      if (attrs?.cls) {
        if (Array.isArray(attrs.cls)) child.classList.add(...attrs.cls);
        else child.classList.add(attrs.cls);
      }
      if (attrs?.text !== undefined) child.textContent = attrs.text;
      if (attrs?.attr) Object.entries(attrs.attr).forEach(([k, v]) => child.setAttribute(k, String(v)));
      enhance(child);
      this.appendChild(child);
      return child;
    };
    el.createDiv = function(attrs?: any) { return this.createEl('div', attrs); };
    el.empty = function() { this.innerHTML = ''; return this; };
    return el;
  }

  it('wraps matched query with <mark> in filename and meta rows', async () => {
    const modal = new TaskCreationModal(mockApp, mockPlugin);
    const root = enhance(document.createElement('div')) as unknown as HTMLElement;
    (modal as any).createNaturalLanguageInput(root);

    const textarea: HTMLTextAreaElement = (modal as any).nlInput;
    textarea.value = '+pla';
    textarea.selectionStart = textarea.value.length;

    const suggest: any = (modal as any).nlpSuggest;

    // Build a project suggestion for rendering
    const suggestion = {
      basename: 'Plan',
      displayName: 'Plan [title: Work Plan]',
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
    const el = enhance(document.createElement('div')) as unknown as HTMLElement;
    suggest['currentTrigger'] = '+';
    suggest.renderSuggestion(suggestion as any, el);

    const filenameRow = el.querySelector('.nlp-suggest-project__filename');
    expect(filenameRow).toBeTruthy();
    expect(filenameRow!.querySelector('mark')?.textContent?.toLowerCase()).toBe('pla');

    const metaRow = el.querySelector('.nlp-suggest-project__meta');
    expect(metaRow).toBeTruthy();
    // Expect highlight in path row as it contains 'Plan'
    expect(Array.from(metaRow!.querySelectorAll('mark')).length).toBeGreaterThan(0);
  });
});

