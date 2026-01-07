/**
 * Issue #1432: Let us display properties in Task List base views without losing TN formatting
 *
 * GitHub: https://github.com/project/tasknotes/issues/1432
 *
 * Problem:
 * When users toggle additional properties visible in the Bases UI, the task cards
 * lose their TN formatting (status dot, priority dot, default properties).
 * This happens because `visibleProperties` from Bases config replaces rather than
 * extends the default TN properties.
 *
 * Expected Behavior (Feature Request):
 * TN should always show its core interactive elements (status dot, priority dot)
 * regardless of which properties are toggled in the Bases UI. The properties
 * toggled in base views should be additive - showing additional properties
 * while preserving TN's core UI elements.
 *
 * Technical Context:
 * - Status/priority dots are shown based on `shouldShowStatus`/`shouldShowPriority`
 * - These check if status/priority are in `visibleProperties` array
 * - When Bases UI toggles properties, `visibleProperties` only contains what's toggled
 * - If status/priority aren't explicitly toggled, the dots disappear
 *
 * This test file defines the EXPECTED behavior after the fix is implemented.
 * Tests will FAIL until the feature is implemented.
 */

import {
  createTaskCard,
  updateTaskCard,
} from '../../../src/ui/TaskCard';

import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { MockObsidian, App, Menu } from '../../__mocks__/obsidian';

// Mock external dependencies
jest.mock('obsidian');
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0];
    }
    return date.toISOString();
  })
}));

// Mock helper functions
jest.mock('../../../src/utils/helpers', () => ({
  calculateTotalTimeSpent: jest.fn((entries) => entries?.length ? entries.length * 30 : 0),
  getEffectiveTaskStatus: jest.fn((task) => task.status || 'open'),
  shouldUseRecurringTaskUI: jest.fn((task) => !!task.recurrence),
  getRecurringTaskCompletionText: jest.fn(() => 'Not completed for this date'),
  getRecurrenceDisplayText: jest.fn((recurrence) => 'Daily'),
  filterEmptyProjects: jest.fn((projects) => projects?.filter((p: string) => p && p.trim()) || [])
}));

jest.mock('../../../src/utils/dateUtils', () => ({
  isTodayTimeAware: jest.fn(() => false),
  isOverdueTimeAware: jest.fn(() => false),
  formatDateTimeForDisplay: jest.fn(() => 'Jan 15, 2025'),
  getDatePart: jest.fn((date) => date?.split('T')[0] || ''),
  getTimePart: jest.fn(() => null),
  formatDateForStorage: jest.fn((value: Date | string) => {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    return value?.split('T')[0] || '';
  })
}));

jest.mock('../../../src/components/TaskContextMenu', () => ({
  TaskContextMenu: jest.fn().mockImplementation(() => ({
    show: jest.fn()
  }))
}));

describe.skip('Issue #1432: TN formatting should persist when toggling base view properties', () => {
  let mockPlugin: any;
  let mockApp: any;
  let container: HTMLElement;

  beforeEach(() => {
    jest.clearAllMocks();
    MockObsidian.reset();

    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    mockApp = new App();
    mockPlugin = {
      app: mockApp,
      selectedDate: new Date('2025-01-15'),
      fieldMapper: {
        isPropertyForField: jest.fn((propertyId: string, field: string) => {
          // Map property IDs to their internal field names
          return propertyId === field;
        }),
        toUserField: jest.fn((field: string) => field),
        toInternalField: jest.fn((field: string) => field),
        lookupMappingKey: jest.fn((propertyId: string) => {
          // Return the internal key if it's a known property
          const knownProps = ['status', 'priority', 'due', 'scheduled', 'title', 'tags', 'contexts', 'projects'];
          return knownProps.includes(propertyId) ? propertyId : null;
        }),
        getMapping: jest.fn(() => ({
          status: 'status',
          priority: 'priority',
          due: 'due',
          scheduled: 'scheduled',
          title: 'title',
          tags: 'tags',
          contexts: 'contexts',
          projects: 'projects',
        })),
      },
      statusManager: {
        isCompletedStatus: jest.fn((status: string) => status === 'done'),
        getStatusConfig: jest.fn((status: string) => ({
          value: status,
          label: status,
          color: '#666666'
        })),
        getAllStatuses: jest.fn(() => [
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done' }
        ]),
        getNonCompletionStatuses: jest.fn(() => [
          { value: 'open', label: 'Open' },
          { value: 'in-progress', label: 'In Progress' }
        ]),
        getNextStatus: jest.fn(() => 'done')
      },
      priorityManager: {
        getPriorityConfig: jest.fn((priority: string) => priority ? ({
          value: priority,
          label: priority,
          color: '#ff0000'
        }) : null),
        getPrioritiesByWeight: jest.fn(() => [
          { value: 'high', label: 'High' },
          { value: 'normal', label: 'Normal' }
        ])
      },
      getActiveTimeSession: jest.fn(() => null),
      toggleTaskStatus: jest.fn(),
      toggleRecurringTaskComplete: jest.fn(),
      updateTaskProperty: jest.fn(),
      openTaskEditModal: jest.fn(),
      openDueDateModal: jest.fn(),
      openScheduledDateModal: jest.fn(),
      startTimeTracking: jest.fn(),
      stopTimeTracking: jest.fn(),
      toggleTaskArchive: jest.fn(),
      formatTime: jest.fn((minutes: number) => `${minutes}m`),
      cacheManager: {
        getTaskInfo: jest.fn()
      },
      taskService: {
        deleteTask: jest.fn()
      },
      projectSubtasksService: {
        isTaskUsedAsProject: jest.fn().mockResolvedValue(false),
        isTaskUsedAsProjectSync: jest.fn().mockReturnValue(false)
      },
      i18n: {
        translate: jest.fn((key: string) => key)
      },
      settings: {
        singleClickAction: 'edit',
        doubleClickAction: 'none',
        showExpandableSubtasks: true,
        subtaskChevronPosition: 'right',
        calendarViewSettings: {
          timeFormat: '12'
        }
      }
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Status indicator preservation', () => {
    it('should show status dot when visibleProperties does NOT include status', () => {
      // This test represents the EXPECTED behavior after the fix
      // Currently, this will FAIL because status dot is hidden when status is not in visibleProperties
      const task = TaskFactory.createTask({
        status: 'open',
      });

      // Simulate Bases UI where user only toggled "due" property visible
      // Status is NOT in this list, but status dot should STILL be shown
      const visibleProperties = ['due'];
      const card = createTaskCard(task, mockPlugin, visibleProperties);

      // Status dot should be visible even when status is not in visibleProperties
      const statusDot = card.querySelector('.task-card__status-dot');
      expect(statusDot).toBeTruthy();
    });

    it('should show status dot when visibleProperties is an empty array', () => {
      const task = TaskFactory.createTask({
        status: 'in-progress',
      });

      // User toggled off all properties in Bases UI
      const visibleProperties: string[] = [];
      const card = createTaskCard(task, mockPlugin, visibleProperties);

      const statusDot = card.querySelector('.task-card__status-dot');
      expect(statusDot).toBeTruthy();
    });

    it('should still respect hideStatusIndicator option for intentional hiding', () => {
      // The hideStatusIndicator option is used by Kanban when grouped by status
      // This intentional hiding should still work
      const task = TaskFactory.createTask({
        status: 'open',
      });

      const card = createTaskCard(task, mockPlugin, undefined, { hideStatusIndicator: true });

      const statusDot = card.querySelector('.task-card__status-dot');
      expect(statusDot).toBeNull();
    });
  });

  describe('Priority indicator preservation', () => {
    it('should show priority dot when visibleProperties does NOT include priority', () => {
      // This test represents the EXPECTED behavior after the fix
      // Currently, this will FAIL because priority dot is hidden when priority is not in visibleProperties
      const task = TaskFactory.createTask({
        priority: 'high',
      });

      // Simulate Bases UI where user only toggled "due" property visible
      // Priority is NOT in this list, but priority dot should STILL be shown
      const visibleProperties = ['due'];
      const card = createTaskCard(task, mockPlugin, visibleProperties);

      // Priority dot should be visible even when priority is not in visibleProperties
      const priorityDot = card.querySelector('.task-card__priority-dot');
      expect(priorityDot).toBeTruthy();
    });

    it('should show priority dot when visibleProperties is an empty array', () => {
      const task = TaskFactory.createTask({
        priority: 'normal',
      });

      // User toggled off all properties in Bases UI
      const visibleProperties: string[] = [];
      const card = createTaskCard(task, mockPlugin, visibleProperties);

      const priorityDot = card.querySelector('.task-card__priority-dot');
      expect(priorityDot).toBeTruthy();
    });
  });

  describe('Combined status and priority preservation', () => {
    it('should show both status and priority dots when neither is in visibleProperties', () => {
      const task = TaskFactory.createTask({
        status: 'in-progress',
        priority: 'high',
        due: '2025-01-20',
      });

      // User toggled only "tags" and "contexts" in Bases UI
      // Neither status nor priority is in the list
      const visibleProperties = ['tags', 'contexts'];
      const card = createTaskCard(task, mockPlugin, visibleProperties);

      const statusDot = card.querySelector('.task-card__status-dot');
      const priorityDot = card.querySelector('.task-card__priority-dot');

      expect(statusDot).toBeTruthy();
      expect(priorityDot).toBeTruthy();
    });

    it('should show additional properties from visibleProperties alongside TN formatting', () => {
      const task = TaskFactory.createTask({
        status: 'open',
        priority: 'high',
        due: '2025-01-20',
        contexts: ['@work', '@urgent'],
      });

      // User wants to see contexts in addition to TN default formatting
      const visibleProperties = ['contexts'];
      const card = createTaskCard(task, mockPlugin, visibleProperties);

      // TN formatting should be preserved
      const statusDot = card.querySelector('.task-card__status-dot');
      const priorityDot = card.querySelector('.task-card__priority-dot');
      expect(statusDot).toBeTruthy();
      expect(priorityDot).toBeTruthy();

      // Additional properties should also be shown
      const metadataLine = card.querySelector('.task-card__metadata');
      expect(metadataLine).toBeTruthy();
    });
  });

  describe('updateTaskCard with restricted visibleProperties', () => {
    it('should preserve status dot during updates even without status in visibleProperties', () => {
      const task = TaskFactory.createTask({
        status: 'open',
      });

      const visibleProperties = ['due']; // status not included
      const card = createTaskCard(task, mockPlugin, visibleProperties);

      // Update the task
      const updatedTask = TaskFactory.createTask({
        ...task,
        status: 'in-progress',
      });

      updateTaskCard(card, updatedTask, mockPlugin, visibleProperties);

      const statusDot = card.querySelector('.task-card__status-dot');
      expect(statusDot).toBeTruthy();
    });

    it('should preserve priority dot during updates even without priority in visibleProperties', () => {
      const task = TaskFactory.createTask({
        priority: 'normal',
      });

      const visibleProperties = ['due']; // priority not included
      const card = createTaskCard(task, mockPlugin, visibleProperties);

      // Update the task
      const updatedTask = TaskFactory.createTask({
        ...task,
        priority: 'high',
      });

      updateTaskCard(card, updatedTask, mockPlugin, visibleProperties);

      const priorityDot = card.querySelector('.task-card__priority-dot');
      expect(priorityDot).toBeTruthy();
    });
  });
});
