import { buildTasknotesKanbanViewFactory } from '../../../src/bases/kanban-view';

// Stub TaskCard to avoid complex dependencies in unit test
jest.mock('../../../src/ui/TaskCard', () => ({
  createTaskCard: (task: any) => {
    const el = document.createElement('div');
    el.className = 'task-card';
    el.setAttribute('data-task-path', task.path);
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
      priority: 'normal',
      archived: false
    })),
    renderTaskNotesInBasesView: async (container: HTMLElement, taskNotes: any[]) => {
      const list = document.createElement('div');
      list.className = 'tn-bases-tasknotes-list';
      taskNotes.forEach((t) => {
        const el = document.createElement('div');
        el.className = 'task-card';
        el.setAttribute('data-task-path', t.path);
        list.appendChild(el);
      });
      container.appendChild(list);
    }
  };
});

// Minimal mock helpers
const makePlugin = () => ({
  app: { metadataCache: {}, workspace: {} },
  cacheManager: { getCachedTaskInfo: jest.fn(async (p: string) => ({ path: p })) },
  updateTaskProperty: jest.fn(async () => {}),
  settings: { basesPOCLogs: false }
}) as any;

function makeBasesContainer(items: any[], cfg: any = {}) {
  const results = new Map<any, any>();
  items.forEach((it, i) => results.set(i, it));
  const query = { properties: cfg.properties || {}, getViewConfig: (k?: string) => (k ? cfg[k] : cfg) } as any;
  return { results, query, viewContainerEl: document.createElement('div'), controller: { getViewConfig: () => cfg, query } } as any;
}

describe('buildTasknotesKanbanViewFactory', () => {
  it('renders columns based on groupBy and uses TaskCard renderer', async () => {
    const plugin = makePlugin();
    // Two tasks with status values
    const items = [
      { file: { path: '/a.md' }, properties: { status: 'open', title: 'A' } },
      { file: { path: '/b.md' }, properties: { status: 'done', title: 'B' } }
    ];
    const cfg = { groupBy: 'status', order: ['status', 'title'], properties: { status: { getDisplayName: () => 'Status' } } };
    const bases = makeBasesContainer(items, cfg);

    const factory = buildTasknotesKanbanViewFactory(plugin);
    factory(bases);

    // Wait for initial async render
    await new Promise(r => setTimeout(r, 10));

    // Verify columns exist and have counts
    const container = (bases.viewContainerEl as HTMLElement);
    const titles = Array.from(container.querySelectorAll('.kanban-view__column-title')).map(el => el.textContent || '');
    const uniqueTitles = Array.from(new Set(titles));
    expect(uniqueTitles.sort()).toEqual(['done', 'open']);

    const counts = Array.from(container.querySelectorAll('.kanban-view__column-count')).map(el => el.textContent || '');
    expect(counts.join(' ')).toContain('1 tasks');
  });

  it('supports dropping a task to another column triggers update', async () => {
    const plugin = makePlugin();
    const items = [
      { file: { path: '/a.md' }, properties: { status: 'open', title: 'A' } },
      { file: { path: '/b.md' }, properties: { status: 'done', title: 'B' } }
    ];
    const cfg = { groupBy: 'status', order: ['status', 'title'], properties: { status: { getDisplayName: () => 'Status' } } };
    const bases = makeBasesContainer(items, cfg);

    const factory = buildTasknotesKanbanViewFactory(plugin);
    const component = factory(bases);
    await Promise.resolve();
    await (component as any).refresh?.();
    await new Promise(r => setTimeout(r, 0));

    const container = (bases.viewContainerEl as HTMLElement);
    const doneCol = container.querySelector('.kanban-view__column[data-column-id="done"]') as HTMLElement;
    expect(doneCol).toBeTruthy();

    // Simulate drop of '/a.md' into 'done'
    const evt = new Event('drop', { bubbles: true }) as any;
    evt.preventDefault = () => {};
    evt.stopPropagation = () => {};
    evt.dataTransfer = { getData: () => '/a.md' };
    doneCol.dispatchEvent(evt);

    // Allow async handler
    await new Promise(r => setTimeout(r, 0));

    expect(plugin.updateTaskProperty).toHaveBeenCalled();
  });
});

