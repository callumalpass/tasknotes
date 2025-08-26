import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { MockObsidian } from '../../__mocks__/obsidian';
import type { App } from 'obsidian';

// @ts-ignore helper to cast the mock app
const createMockApp = (mockApp: any): App => mockApp as unknown as App;

// Do NOT mock helpers here to keep sanitizeTags available
jest.mock('obsidian');

describe('TaskCreationModal - projects with commas', () => {
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
        taskCreationDefaults: {
          defaultDueDate: 'none',
          defaultScheduledDate: 'none',
          defaultContexts: '',
          defaultTags: '',
          defaultTimeEstimate: 0,
          defaultRecurrence: 'none',
          defaultReminders: []
        }
      },
    };
  });

  it('should preserve a wikilink project containing commas as a single entry when building task data', () => {
    const modal = new TaskCreationModal(mockApp, mockPlugin);
    (modal as any).title = 'Test';
    ;(modal as any).projects = '[[Money, Org & Adm]]';
    ;(modal as any).tags = '';

    const data = (modal as any).buildTaskData();
    expect(data.projects).toEqual(['[[Money, Org & Adm]]']);
  });

  it('should preserve multiple mixed projects including wikilinks with commas', () => {
    const modal = new TaskCreationModal(mockApp, mockPlugin);
    (modal as any).title = 'Test';
    ;(modal as any).projects = '[[Money, Org & Adm]], [[Wellbeing|Health, Fitness & Mindset]]';
    ;(modal as any).tags = '';

    const data = (modal as any).buildTaskData();
    expect(data.projects).toEqual([
      '[[Money, Org & Adm]]',
      '[[Wellbeing|Health, Fitness & Mindset]]'
    ]);
  });
});

