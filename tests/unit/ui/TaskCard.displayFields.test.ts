import { App, TFile, Notice } from 'obsidian';
import { createTaskCard, updateTaskCard } from '../../../src/ui/TaskCard';
import { TaskCardDisplayFieldsConfig, TaskInfo } from '../../../src/types';
import { PluginFactory, TaskFactory, FileSystemFactory } from '../../helpers/mock-factories';

jest.mock('obsidian');

describe('TaskCard display fields rendering', () => {
  let mockPlugin: any;
  let mockApp: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPlugin = PluginFactory.createMockPlugin();
    mockApp = mockPlugin.app;
  });

  it('renders labels when showName is true and uses displayName if provided', () => {
    const task: TaskInfo = TaskFactory.createTask({ title: 'X', status: 'open', priority: 'normal' });
    const cfg: TaskCardDisplayFieldsConfig = {
      version: 1,
      row1FixedTitle: true,
      rows: [
        [ { property: 'due', showName: true, displayName: 'Due Date' } ],
        [ { property: 'priority', showName: true } ],
        []
      ]
    };

    const card = createTaskCard(task, mockPlugin, { displayFields: cfg });
    const rowEls = card.querySelectorAll('.task-card__custom-row');
    expect(rowEls.length).toBeGreaterThanOrEqual(1);
    const labels = card.querySelectorAll('.task-card__field-label');
    expect(Array.from(labels).map(l => l.textContent?.trim())).toEqual(expect.arrayContaining(['Due Date:', 'Priority:']));
  });

  it('reads user:<id> value from frontmatter', () => {
    // Setup user field in settings
    mockPlugin.settings.userFields = [{ id: 'effort', key: 'effort', displayName: 'Effort', type: 'number' }];

    const task: TaskInfo = TaskFactory.createTask({ title: 'Task', path: '/tasks/t1.md' });
    // Mock file + frontmatter
    const file = new TFile(task.path);
    mockApp.vault.getAbstractFileByPath.mockReturnValue(file);
    mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter: { effort: 5 } });

    const cfg: TaskCardDisplayFieldsConfig = {
      version: 1,
      row1FixedTitle: true,
      rows: [
        [ { property: 'user:effort', showName: true } ],
        [],
        []
      ]
    };

    const card = createTaskCard(task, mockPlugin, { displayFields: cfg });
    const valueEl = card.querySelector('.task-card__field-value');
    expect(valueEl?.textContent).toBe('5');
  });

  it('falls back to arbitrary frontmatter key when property has no mapping', () => {
    const task: TaskInfo = TaskFactory.createTask({ path: '/tasks/t2.md' });
    const file = new TFile(task.path);
    mockApp.vault.getAbstractFileByPath.mockReturnValue(file);
    mockApp.metadataCache.getFileCache.mockReturnValue({ frontmatter: { custom_key: 'ABC' } });

    const cfg: TaskCardDisplayFieldsConfig = {
      version: 1,
      row1FixedTitle: true,
      rows: [
        [ { property: 'custom_key', showName: true } ],
        [],
        []
      ]
    };

    const card = createTaskCard(task, mockPlugin, { displayFields: cfg });
    const valueEl = card.querySelector('.task-card__field-value');
    expect(valueEl?.textContent).toBe('ABC');
  });
});

