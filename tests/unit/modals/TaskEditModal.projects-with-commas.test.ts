import { TaskEditModal } from '../../../src/modals/TaskEditModal';
import { MockObsidian, Notice } from '../../__mocks__/obsidian';
import type { App } from 'obsidian';
import { TaskInfo } from '../../../src/types';

// @ts-ignore helper to cast the mock app
const createMockApp = (mockApp: any): App => mockApp as unknown as App;

jest.mock('obsidian');

describe('TaskEditModal - projects with commas', () => {
  let mockApp: App;
  let mockPlugin: any;

  beforeEach(() => {
    MockObsidian.reset();
    mockApp = createMockApp(MockObsidian.createMockApp());

    mockPlugin = {
      app: mockApp,
      settings: {
        taskTag: 'task',
        enableNaturalLanguageInput: false,
        defaultTaskPriority: 'normal',
        defaultTaskStatus: 'open',
      },
      taskService: { updateTask: jest.fn(async (_orig: TaskInfo, changes: Partial<TaskInfo>) => ({ ..._orig, ...changes })) },
      statusManager: { isCompletedStatus: jest.fn((s: string) => s === 'done') },
      fieldMapper: { toUserField: jest.fn((k: any) => k) }
    };
  });

  it('should not split wikilink with commas when computing changes', async () => {
    const task: TaskInfo = {
      title: 'T', status: 'open', priority: 'normal', path: 't.md', archived: false,
      projects: []
    } as any;
    const modal = new TaskEditModal(mockApp, mockPlugin, { task });

    // Set fields directly to avoid dependency on metadataCache during init
    (modal as any).title = task.title;
    (modal as any).status = task.status;
    (modal as any).priority = task.priority;
    (modal as any).projects = '[[Money, Org & Adm]]';
    (modal as any).contexts = (task as any).contexts || '';
    (modal as any).tags = (task as any).tags?.join(', ') || '';
    (modal as any).timeEstimate = (task as any).timeEstimate || 0;

    // Call private getChanges directly
    const changes = (modal as any).getChanges();

    expect(changes.projects).toEqual(['[[Money, Org & Adm]]']);
  });
});

