/**
 * Factory functions for creating test objects and mock data
 * These factories help create consistent test data across the test suite
 */

import { 
  TaskInfo, 
  TimeEntry, 
  PomodoroSession, 
  TaskCreationData,
  StatusConfig,
  PriorityConfig,
  FieldMapping,
  FilterQuery,
  ICSSubscription,
  ICSEvent,
  TimeBlock
} from '../../src/types';
import { MockObsidian, TFile } from '../__mocks__/obsidian';
import { FieldMapper } from '../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../src/settings/defaults';

// Task-related factories
export const TaskFactory = {
  /**
   * Create a basic TaskInfo object with sensible defaults
   */
  createTask: (overrides?: Partial<TaskInfo>): TaskInfo => ({
    title: 'Test Task',
    status: 'open',
    priority: 'normal',
    path: '/tasks/test-task.md',
    archived: false,
    tags: ['task'],
    dateCreated: '2025-01-01T00:00:00Z',
    dateModified: '2025-01-01T00:00:00Z',
    ...overrides
  }),

  /**
   * Create a task with due date
   */
  createTaskWithDue: (dueDate: string, overrides?: Partial<TaskInfo>): TaskInfo => 
    TaskFactory.createTask({
      due: dueDate,
      ...overrides
    }),

  /**
   * Create a recurring task
   */
  createRecurringTask: (rrule: string, overrides?: Partial<TaskInfo>): TaskInfo => 
    TaskFactory.createTask({
      recurrence: rrule,
      complete_instances: [],
      ...overrides
    }),

  /**
   * Create an overdue task
   */
  createOverdueTask: (overrides?: Partial<TaskInfo>): TaskInfo => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return TaskFactory.createTask({
      due: yesterday.toISOString().split('T')[0],
      status: 'open',
      ...overrides
    });
  },

  /**
   * Create a completed task
   */
  createCompletedTask: (overrides?: Partial<TaskInfo>): TaskInfo => 
    TaskFactory.createTask({
      status: 'done',
      completedDate: new Date().toISOString().split('T')[0],
      ...overrides
    }),

  /**
   * Create a task with time tracking
   */
  createTaskWithTimeTracking: (overrides?: Partial<TaskInfo>): TaskInfo => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    
    return TaskFactory.createTask({
      timeEstimate: 120, // 2 hours
      timeEntries: [
        {
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
          description: 'Work session'
        }
      ],
      ...overrides
    });
  },

  /**
   * Create task creation data for testing task creation
   */
  createTaskCreationData: (overrides?: Partial<TaskCreationData>): TaskCreationData => ({
    title: 'New Test Task',
    status: 'open',
    priority: 'normal',
    details: 'Task details',
    ...overrides
  }),

  /**
   * Create multiple tasks for testing collections
   */
  createTasks: (count: number, baseOverrides?: Partial<TaskInfo>): TaskInfo[] => {
    const tasks: TaskInfo[] = [];
    const baseDate = new Date();
    
    for (let i = 0; i < count; i++) {
      const task = TaskFactory.createTask({
        title: `Test Task ${i + 1}`,
        path: `/tasks/test-task-${i + 1}.md`,
        dateCreated: new Date(baseDate.getTime() + i * 1000).toISOString(),
        ...baseOverrides
      });
      tasks.push(task);
    }
    
    return tasks;
  }
};

// Time entry factory
export const TimeEntryFactory = {
  createEntry: (overrides?: Partial<TimeEntry>): TimeEntry => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago
    
    return {
      startTime: start.toISOString(),
      endTime: now.toISOString(),
      description: 'Work session',
      ...overrides
    };
  },

  createActiveEntry: (overrides?: Partial<TimeEntry>): TimeEntry => {
    const start = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
    
    return {
      startTime: start.toISOString(),
      description: 'Active session',
      ...overrides
    };
  },

  createEntries: (count: number): TimeEntry[] => {
    const entries: TimeEntry[] = [];
    const baseTime = Date.now() - count * 60 * 60 * 1000; // Start hours ago
    
    for (let i = 0; i < count; i++) {
      const start = new Date(baseTime + i * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      
      entries.push({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        description: `Session ${i + 1}`
      });
    }
    
    return entries;
  }
};

// Pomodoro session factory
export const PomodoroFactory = {
  createSession: (overrides?: Partial<PomodoroSession>): PomodoroSession => {
    const now = new Date();
    const start = new Date(now.getTime() - 25 * 60 * 1000); // 25 minutes ago
    
    return {
      id: `pomodoro-${Date.now()}`,
      startTime: start.toISOString(),
      plannedDuration: 25,
      type: 'work',
      completed: false,
      activePeriods: [
        {
          startTime: start.toISOString(),
          endTime: now.toISOString()
        }
      ],
      ...overrides
    };
  },

  createCompletedSession: (overrides?: Partial<PomodoroSession>): PomodoroSession => 
    PomodoroFactory.createSession({
      completed: true,
      endTime: new Date().toISOString(),
      ...overrides
    }),

  createBreakSession: (type: 'short-break' | 'long-break' = 'short-break', overrides?: Partial<PomodoroSession>): PomodoroSession => 
    PomodoroFactory.createSession({
      type,
      plannedDuration: type === 'short-break' ? 5 : 15,
      ...overrides
    })
};

// Settings and configuration factories
export const SettingsFactory = {
  createFieldMapping: (overrides?: Partial<FieldMapping>): FieldMapping => ({
    title: 'title',
    status: 'status',
    priority: 'priority',
    due: 'due',
    scheduled: 'scheduled',
    contexts: 'contexts',
    projects: 'projects',
    timeEstimate: 'timeEstimate',
    completedDate: 'completedDate',
    dateCreated: 'dateCreated',
    dateModified: 'dateModified',
    recurrence: 'recurrence',
    archiveTag: 'archived',
    timeEntries: 'timeEntries',
    completeInstances: 'complete_instances',
    pomodoros: 'pomodoros',
    icsEventId: 'icsEventId',
    reminders: 'reminders',
    ...overrides
  }),

  createStatusConfig: (overrides?: Partial<StatusConfig>): StatusConfig => ({
    id: 'test-status',
    value: 'test',
    label: 'Test Status',
    color: '#3788d8',
    isCompleted: false,
    order: 1,
    ...overrides
  }),

  createPriorityConfig: (overrides?: Partial<PriorityConfig>): PriorityConfig => ({
    id: 'test-priority',
    value: 'test',
    label: 'Test Priority',
    color: '#ff6b6b',
    weight: 5,
    ...overrides
  }),

  createFilterQuery: (overrides?: Partial<FilterQuery>): FilterQuery => ({
    type: 'group',
    id: 'root',
    conjunction: 'and',
    children: [],
    sortKey: 'due',
    sortDirection: 'asc',
    groupKey: 'none',
    ...overrides
  })
};

// Calendar and ICS factories
export const CalendarFactory = {
  createICSSubscription: (overrides?: Partial<ICSSubscription>): ICSSubscription => ({
    id: `ics-${Date.now()}`,
    name: 'Test Calendar',
    url: 'https://example.com/calendar.ics',
    type: 'remote',
    color: '#3788d8',
    enabled: true,
    refreshInterval: 60,
    ...overrides
  }),

  createICSEvent: (overrides?: Partial<ICSEvent>): ICSEvent => ({
    id: `event-${Date.now()}`,
    subscriptionId: 'test-subscription',
    title: 'Test Event',
    start: new Date().toISOString(),
    allDay: false,
    ...overrides
  }),

  createTimeBlock: (overrides?: Partial<TimeBlock>): TimeBlock => ({
    id: `block-${Date.now()}`,
    title: 'Test Time Block',
    startTime: '09:00',
    endTime: '10:00',
    ...overrides
  })
};

// File system factories
export const FileSystemFactory = {
  createMockFile: (path: string, content: string = '') => {
    return MockObsidian.createTestFile(path, content);
  },

  createTaskFile: (task: TaskInfo): void => {
    const frontmatter = {
      title: task.title,
      status: task.status,
      priority: task.priority,
      due: task.due,
      scheduled: task.scheduled,
      tags: task.tags,
      contexts: task.contexts,
      dateCreated: task.dateCreated,
      dateModified: task.dateModified,
      recurrence: task.recurrence,
      timeEstimate: task.timeEstimate,
      timeEntries: task.timeEntries
    };

    // Remove undefined values
    Object.keys(frontmatter).forEach(key => {
      if (frontmatter[key as keyof typeof frontmatter] === undefined) {
        delete frontmatter[key as keyof typeof frontmatter];
      }
    });

    const yaml = require('yaml').stringify(frontmatter);
    const content = `---\n${yaml}---\n\n# ${task.title}\n\nTask content here.`;
    
    MockObsidian.createTestFile(task.path, content);
  },

  createTaskFiles: (tasks: TaskInfo[]): void => {
    tasks.forEach(task => FileSystemFactory.createTaskFile(task));
  }
};

// Plugin mock factory
export const PluginFactory = {
  createMockPlugin: (overrides?: any) => {
    const mockApp = {
      vault: {
        create: jest.fn().mockImplementation((path, _content) => {
          const mockFile = new TFile(path);
          return Promise.resolve(mockFile);
        }),
        modify: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        read: jest.fn().mockResolvedValue(''),
        getAbstractFileByPath: jest.fn().mockImplementation((path) => {
          return new TFile(path);
        }),
        adapter: {
          exists: jest.fn().mockResolvedValue(true),
          mkdir: jest.fn().mockResolvedValue(undefined)
        }
      },
      fileManager: {
        processFrontMatter: jest.fn().mockImplementation(async (_file, fn) => {
          const mockFrontmatter = {};
          fn(mockFrontmatter);
        }),
        generateMarkdownLink: jest.fn().mockResolvedValue('[[link]]')
      },
      metadataCache: {
        getFileCache: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      },
      workspace: {
        getActiveView: jest.fn(),
        getLeavesOfType: jest.fn().mockReturnValue([]),
        getViewsOfType: jest.fn().mockReturnValue([]),
        detachLeavesOfType: jest.fn(),
        iterateAllLeaves: jest.fn().mockImplementation((_callback) => {
          // Mock implementation - iterate over no leaves by default
        }),
        getLeaf: jest.fn().mockReturnValue({
          open: jest.fn().mockResolvedValue(undefined),
          openFile: jest.fn().mockResolvedValue(undefined)
        }),
        on: jest.fn(),
        off: jest.fn(),
        trigger: jest.fn()
      }
    };

    const mockCache = {
      // Core MinimalNativeCache methods
      initialize: jest.fn(),
      getAllTasks: jest.fn().mockResolvedValue([]),
      getTaskInfo: jest.fn().mockResolvedValue(null),
      updateTaskInfoInCache: jest.fn(),
      removeFromCache: jest.fn().mockResolvedValue(undefined),
      getAllTags: jest.fn().mockReturnValue([]),
      getAllContexts: jest.fn().mockReturnValue([]),
      getAllStatuses: jest.fn().mockReturnValue(['open', 'in-progress', 'done']),
      getAllPriorities: jest.fn().mockReturnValue(['low', 'normal', 'high']),
      getTasksForDate: jest.fn().mockReturnValue([]),
      getTaskPathsByStatus: jest.fn().mockReturnValue([]),
      clearCacheEntry: jest.fn(),
      clearAllCaches: jest.fn().mockResolvedValue(undefined),
      isInitialized: jest.fn().mockReturnValue(true),
      destroy: jest.fn(),
      
      // Backward compatibility methods for tests
      refreshTaskCache: jest.fn().mockResolvedValue(undefined),
      updateContextsCache: jest.fn().mockResolvedValue(undefined),
      updateTagsCache: jest.fn().mockResolvedValue(undefined),
      rebuildCache: jest.fn().mockResolvedValue(undefined),
      
      // Event system
      on: jest.fn(),
      off: jest.fn(),
      trigger: jest.fn()
    };

    const mockSettings = {
      taskTag: 'task',
      taskIdentificationMethod: 'tag',  // Default to tag-based identification
      taskPropertyName: '',
      taskPropertyValue: '',
      tasksFolder: 'Tasks',
      defaultTaskStatus: 'open',
      defaultTaskPriority: 'normal',
      taskCreationDefaults: {
        defaultFolder: '',
        useBodyTemplate: false,
        bodyTemplate: ''
      },
      fieldMapping: SettingsFactory.createFieldMapping(),
      customStatuses: [SettingsFactory.createStatusConfig()],
      customPriorities: [SettingsFactory.createPriorityConfig()]
    };

    const mockPlugin = {
      app: mockApp,
      settings: mockSettings,
      emitter: {
        trigger: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      },
      fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
      cacheManager: mockCache,
      taskService: {
        createTask: jest.fn().mockImplementation(async (taskData) => {
          const file = new TFile(taskData.path || '/tasks/test-task.md');
          return { 
            success: true, 
            file,
            task: { ...taskData, path: file.path }
          };
        }),
        updateTask: jest.fn().mockImplementation(async (taskOrPath, updates) => {
          const path = typeof taskOrPath === 'string' ? taskOrPath : taskOrPath.path;
          const file = new TFile(path);
          return { 
            success: true, 
            file,
            task: { ...updates, path }
          };
        }),
        updateTaskProperty: jest.fn().mockImplementation(async (taskOrPath, property, value) => {
          const path = typeof taskOrPath === 'string' ? taskOrPath : taskOrPath.path;
          const file = new TFile(path);
          return { 
            success: true, 
            file,
            task: { path, [property]: value }
          };
        }),
        deleteTask: jest.fn().mockImplementation(async (_task) => {
          return { success: true };
        })
      },
      nlParser: {
        parseInput: jest.fn().mockImplementation((input) => {
          // Basic parsing simulation
          const result = {
            title: input.replace(/@\w+/g, '').replace(/#\w+/g, '').trim(),
            contexts: input.match(/@(\w+)/g)?.map((c: string) => c.slice(1)) || [],
            tags: input.match(/#(\w+)/g)?.map((t: string) => t.slice(1)) || [],
            due: null as string | null,
            priority: 'normal',
            status: 'open'
          };
          
          // Simple date parsing
          if (input.includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            result.due = tomorrow.toISOString().split('T')[0];
            
            if (input.includes('3pm')) {
              result.due = `${result.due}T15:00`;
            }
          }
          
          return result;
        })
      },
      statusManager: {
        isCompletedStatus: jest.fn((status) => status === 'done' || status === 'completed'),
        getCompletedStatuses: jest.fn(() => ['done', 'completed']),
        getNextStatus: jest.fn((currentStatus) => {
          const statusMap: Record<string, string> = {
            'open': 'in-progress',
            'in-progress': 'done',
            'done': 'open'
          };
          return statusMap[currentStatus] || 'in-progress';
        }),
        getAllStatuses: jest.fn(() => ['open', 'in-progress', 'done'])
      },
      getActiveTimeSession: jest.fn().mockReturnValue(null),
      selectedDate: new Date(),
      
      // Calendar integration methods that are missing from test failures
      toggleRecurringTaskComplete: jest.fn().mockImplementation(async (_task, _targetDate) => {
        return { success: true, taskUpdated: true };
      }),
      updateTimeblockInDailyNote: jest.fn().mockImplementation(async (_app, _timeblockId, _oldDate, _newDate, _newStartTime, _newEndTime) => {
        return { success: true, updated: true };
      }),
      
      // Task archiving methods
      toggleTaskArchive: jest.fn().mockImplementation(async (_task) => {
        return { success: true, taskArchived: !_task.archived };
      }),
      
      // Time tracking methods
      startTimeTracking: jest.fn().mockImplementation(async (_task) => {
        return { success: true, sessionStarted: true };
      }),
      stopTimeTracking: jest.fn().mockImplementation(async (_task) => {
        return { success: true, sessionEnded: true };
      }),
      
      ...overrides
    };

    return mockPlugin;
  }
};

// Test data sets for comprehensive testing
export const TestDataSets = {
  // Common task scenarios
  getTaskScenarios: () => ({
    simple: TaskFactory.createTask(),
    withDue: TaskFactory.createTaskWithDue('2025-01-15'),
    overdue: TaskFactory.createOverdueTask(),
    completed: TaskFactory.createCompletedTask(),
    recurring: TaskFactory.createRecurringTask('FREQ=DAILY;INTERVAL=1'),
    withTimeTracking: TaskFactory.createTaskWithTimeTracking()
  }),

  // Edge cases
  getEdgeCases: () => ({
    emptyTitle: TaskFactory.createTask({ title: '' }),
    longTitle: TaskFactory.createTask({ title: 'A'.repeat(300) }),
    specialCharacters: TaskFactory.createTask({ title: 'Task with émojis 🚀 and spëcial chars!' }),
    invalidDate: TaskFactory.createTask({ due: 'invalid-date' }),
    futureDue: TaskFactory.createTaskWithDue('2030-12-31'),
    complexRecurrence: TaskFactory.createRecurringTask('FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=10')
  }),

  // Performance test data
  getLargeDataset: (size: number = 1000) => ({
    tasks: TaskFactory.createTasks(size),
    timeEntries: TimeEntryFactory.createEntries(size),
    pomodoroSessions: Array.from({ length: size }, (_, i) => 
      PomodoroFactory.createSession({ id: `session-${i}` })
    )
  })
};

export default {
  TaskFactory,
  TimeEntryFactory,
  PomodoroFactory,
  SettingsFactory,
  CalendarFactory,
  FileSystemFactory,
  PluginFactory,
  TestDataSets
};