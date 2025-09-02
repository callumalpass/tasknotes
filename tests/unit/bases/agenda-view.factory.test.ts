import { buildTasknotesAgendaViewFactory } from '../../../src/bases/agenda-view';

// Stub TaskCard to avoid complex dependencies in unit test
jest.mock('../../../src/ui/TaskCard', () => ({
  createTaskCard: (task: any) => {
    const el = document.createElement('div');
    el.className = 'task-card';
    el.setAttribute('data-task-path', task.path);
    el.textContent = task.title || '';
    return el;
  },
  DEFAULT_TASK_CARD_OPTIONS: {}
}));

// Mock helpers to simplify data flow
jest.mock('../../../src/bases/helpers', () => {
  const actual = jest.requireActual('../../../src/bases/helpers');
  return {
    ...actual,
    identifyTaskNotesFromBasesData: async (dataItems: any[]) => dataItems.map(i => ({
      path: i.path,
      title: i.properties?.title || 'Untitled',
      status: i.properties?.status || 'open',
      priority: i.properties?.priority || 'normal',
      due: i.properties?.due,
      scheduled: i.properties?.scheduled,
      archived: false
    })),
    renderTaskNotesInBasesView: async (container: HTMLElement, taskNotes: any[]) => {
      const list = document.createElement('div');
      list.className = 'tn-bases-tasknotes-list';
      taskNotes.forEach((t) => {
        const el = document.createElement('div');
        el.className = 'task-card';
        el.setAttribute('data-task-path', t.path);
        el.textContent = t.title || '';
        list.appendChild(el);
      });
      container.appendChild(list);
    }
  };
});

function makePlugin() {
  return {
    app: { metadataCache: {}, workspace: {} },
    settings: { basesPOCLogs: false },
    // Selected date drives Agenda date range
    selectedDate: '2025-01-01',
    statusManager: {
      getAllStatuses: () => [{ value: 'open' }, { value: 'done' }],
      isCompletedStatus: (s: string) => s === 'done'
    },
    priorityManager: {
      getAllPriorities: () => [{ value: 'low' }, { value: 'normal' }, { value: 'high' }]
    },
    viewStateManager: {
      getViewPreferences: jest.fn(() => ({})),
      setViewPreferences: jest.fn()
    }
  } as any;
}

function makeBasesContainer(items: any[], cfg: any = {}) {
  const results = new Map<any, any>();
  items.forEach((it, i) => results.set(i, it));
  const query = { properties: cfg.properties || {}, getViewConfig: (k?: string) => (k ? cfg[k] : cfg) } as any;
  return { results, query, viewContainerEl: document.createElement('div'), controller: { getViewConfig: () => cfg, query } } as any;
}

describe('buildTasknotesAgendaViewFactory (Bases)', () => {
  it('renders day groups based on due/scheduled dates with counts', async () => {
    const plugin = makePlugin();
    const items = [
      { file: { path: '/a.md' }, properties: { due: '2025-01-01', title: 'Alpha' } },
      { file: { path: '/b.md' }, properties: { due: '2025-01-02', title: 'Bravo' } },
      { file: { path: '/c.md' }, properties: { scheduled: '2025-01-01', title: 'Charlie' } }
    ];
    const bases = makeBasesContainer(items, {});

    const factory = buildTasknotesAgendaViewFactory(plugin);
    factory(bases);

    await new Promise(r => setTimeout(r, 10));

    const container = (bases.viewContainerEl as HTMLElement);
    const headers = Array.from(container.querySelectorAll('.task-group-header .tn-bases-group-label')).map(el => el.textContent || '');
    expect(headers.sort()).toEqual(['2025-01-01', '2025-01-02']);

    const counts = Array.from(container.querySelectorAll('.agenda-view__item-count')).map(el => el.textContent || '');
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.join(' ')).toMatch(/\d+ \/ \d+/);
  });

  it('supports expand/collapse all groups controls', async () => {
    const plugin = makePlugin();
    const items = [
      { file: { path: '/a.md' }, properties: { due: '2025-01-01', title: 'Alpha' } },
      { file: { path: '/b.md' }, properties: { due: '2025-01-02', title: 'Bravo' } }
    ];
    const bases = makeBasesContainer(items, {});

    const factory = buildTasknotesAgendaViewFactory(plugin);
    factory(bases);

    await new Promise(r => setTimeout(r, 10));

    const container = (bases.viewContainerEl as HTMLElement);
    const collapseAll = container.querySelector('.filter-bar__collapse-groups') as HTMLElement;
    expect(collapseAll).toBeTruthy();
    collapseAll.dispatchEvent(new Event('click'));

    await new Promise(r => setTimeout(r, 0));

    const sections = Array.from(container.querySelectorAll('.task-section.task-group')) as HTMLElement[];
    expect(sections.every(s => s.classList.contains('is-collapsed'))).toBe(true);

    const expandAll = container.querySelector('.filter-bar__expand-groups') as HTMLElement;
    expect(expandAll).toBeTruthy();
    expandAll.dispatchEvent(new Event('click'));
    await new Promise(r => setTimeout(r, 0));
    expect(sections.every(s => !s.classList.contains('is-collapsed'))).toBe(true);
  });

  it('filters tasks by search term across day groups', async () => {
    const plugin = makePlugin();
    const items = [
      { file: { path: '/a.md' }, properties: { due: '2025-01-01', title: 'Alpha' } },
      { file: { path: '/b.md' }, properties: { due: '2025-01-01', title: 'Bravo' } },
      { file: { path: '/c.md' }, properties: { due: '2025-01-02', title: 'Charlie' } }
    ];
    const bases = makeBasesContainer(items, {});

    const factory = buildTasknotesAgendaViewFactory(plugin);
    factory(bases);
    await new Promise(r => setTimeout(r, 10));

    const container = (bases.viewContainerEl as HTMLElement);
    const input = container.querySelector('.filter-bar__search-input') as HTMLInputElement;
    expect(input).toBeTruthy();

    input.value = 'Alpha';
    input.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 900));

    const tasks = Array.from(container.querySelectorAll('.task-card')) as HTMLElement[];
    const titles = tasks.map(t => t.textContent || '');
    expect(titles.join(' ')).toContain('Alpha');
    expect(titles.join(' ')).not.toContain('Bravo');
  });
});

