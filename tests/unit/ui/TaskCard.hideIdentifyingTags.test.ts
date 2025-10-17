/**
 * TaskCard Hide Identifying Tags Feature Tests
 *
 * Tests for the conditional setting that hides identifying tags in task cards.
 * Following TDD approach - these tests are written before implementation.
 *
 * Test coverage:
 * - Setting disabled: all tags shown (default behavior)
 * - Setting enabled with tag method: identifying tags hidden
 * - Setting enabled with property method: all tags shown (setting has no effect)
 * - Hierarchical tag matching works correctly
 * - Empty tag array after filtering handled gracefully
 * - Edge cases: null/undefined tags, empty arrays, special characters
 */

import { createTaskCard } from '../../../src/ui/TaskCard';
import { TaskFactory } from '../../helpers/mock-factories';
import { MockObsidian } from '../../__mocks__/obsidian';
import type { TaskInfo } from '../../../src/types';
import type TaskNotesPlugin from '../../../src/main';

describe('TaskCard - Hide Identifying Tags Feature', () => {
  let mockPlugin: any;
  let mockApp: any;

  beforeEach(() => {
    MockObsidian.reset();
    mockApp = MockObsidian.createMockApp();

    // Create base mock plugin with all required methods
    mockPlugin = {
      app: mockApp,
      selectedDate: new Date('2025-01-15'),
      statusManager: {
        isCompletedStatus: jest.fn((status) => status === 'done'),
        getStatusConfig: jest.fn((status) => ({
          value: status,
          label: status,
          color: '#666666',
        })),
        getAllStatuses: jest.fn(() => [
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done' },
        ]),
        getNonCompletionStatuses: jest.fn(() => [
          { value: 'open', label: 'Open' },
        ]),
        getNextStatus: jest.fn(() => 'done'),
      },
      priorityManager: {
        getPriorityConfig: jest.fn((priority) => ({
          value: priority,
          label: priority,
          color: '#ff0000',
        })),
        getPrioritiesByWeight: jest.fn(() => [
          { value: 'high', label: 'High' },
          { value: 'normal', label: 'Normal' },
        ]),
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
      formatTime: jest.fn((minutes) => `${minutes}m`),
      openTagsPane: jest.fn().mockResolvedValue(true),
      cacheManager: {
        getTaskInfo: jest.fn(),
      },
      taskService: {
        deleteTask: jest.fn(),
      },
      projectSubtasksService: {
        isTaskUsedAsProject: jest.fn().mockResolvedValue(false),
        isTaskUsedAsProjectSync: jest.fn().mockReturnValue(false),
      },
      settings: {
        taskIdentificationMethod: 'tag',
        taskTag: 'task',
        hideIdentifyingTagsInCards: false, // Default: feature disabled
        singleClickAction: 'edit',
        doubleClickAction: 'none',
        showExpandableSubtasks: true,
        subtaskChevronPosition: 'right',
        calendarViewSettings: {
          timeFormat: '12',
        },
      },
    } as unknown as TaskNotesPlugin;

    // Ensure app has proper mock methods
    mockApp.vault = mockApp.vault || {};
    mockApp.vault.getAbstractFileByPath = jest.fn();
    mockApp.workspace = mockApp.workspace || {};
    mockApp.workspace.getLeaf = jest.fn().mockReturnValue({
      openFile: jest.fn(),
    });
    mockApp.workspace.openLinkText = jest.fn();
    mockApp.workspace.trigger = jest.fn();
    mockApp.metadataCache = mockApp.metadataCache || {};
    mockApp.metadataCache.getFirstLinkpathDest = jest.fn();
  });

  describe('Feature Disabled (Default Behavior)', () => {
    it('should display all tags when hideIdentifyingTagsInCards is false', () => {
      const task = TaskFactory.createTask({
        title: 'Test Task',
        tags: ['task', 'urgent', 'work'],
      });

      // Pass visible properties that include 'tags'
      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagsContainer = card.querySelector('.task-card__metadata-property--tags');

      expect(tagsContainer).toBeTruthy();

      // Should render all 3 tags
      const tagElements = tagsContainer?.querySelectorAll('.tag');
      expect(tagElements?.length).toBe(3);

      // Verify all tags are present
      const tagTexts = Array.from(tagElements || []).map(el => el.textContent);
      expect(tagTexts).toContain('#task');
      expect(tagTexts).toContain('#urgent');
      expect(tagTexts).toContain('#work');
    });

    it('should display hierarchical identifying tags when feature is disabled', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project', 'task/urgent', 'personal'],
      });

      // Pass visible properties that include 'tags'
      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      expect(tagElements.length).toBe(4);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).toContain('#task');
      expect(tagTexts).toContain('#task/project');
      expect(tagTexts).toContain('#task/urgent');
      expect(tagTexts).toContain('#personal');
    });
  });

  describe('Feature Enabled with Tag Identification Method', () => {
    beforeEach(() => {
      mockPlugin.settings.taskIdentificationMethod = 'tag';
      mockPlugin.settings.taskTag = 'task';
      mockPlugin.settings.hideIdentifyingTagsInCards = true;
    });

    it('should hide exact matching identifying tag', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'urgent', 'work'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Should only show 2 tags (urgent, work) - 'task' should be hidden
      expect(tagElements.length).toBe(2);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).toContain('#urgent');
      expect(tagTexts).toContain('#work');
    });

    it('should hide hierarchical child tags of identifying tag', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project', 'task/urgent', 'personal', 'work'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Should only show 2 tags (personal, work)
      // 'task', 'task/project', 'task/urgent' should all be hidden
      expect(tagElements.length).toBe(2);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).not.toContain('#task/project');
      expect(tagTexts).not.toContain('#task/urgent');
      expect(tagTexts).toContain('#personal');
      expect(tagTexts).toContain('#work');
    });

    it('should handle case-insensitive tag matching', () => {
      const task = TaskFactory.createTask({
        tags: ['Task', 'TASK', 'task', 'TaSk/Project', 'urgent'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // All variations of 'task' should be hidden
      expect(tagElements.length).toBe(1);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).toContain('#urgent');
    });

    it('should not display tags property when all tags are filtered out', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project', 'task/urgent'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // No tag elements should be rendered when all tags are filtered
      // (container may exist but should be empty)
      expect(tagElements.length).toBe(0);
    });

    it('should handle tasks with only non-identifying tags', () => {
      const task = TaskFactory.createTask({
        tags: ['urgent', 'work', 'personal'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // All tags should be shown (none match identifying tag)
      expect(tagElements.length).toBe(3);
    });

    it('should work with different identifying tag values', () => {
      mockPlugin.settings.taskTag = 'todo';

      const task = TaskFactory.createTask({
        tags: ['todo', 'todo/work', 'task', 'urgent'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // 'todo' and 'todo/work' should be hidden, 'task' and 'urgent' shown
      expect(tagElements.length).toBe(2);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).toContain('#task');
      expect(tagTexts).toContain('#urgent');
      expect(tagTexts).not.toContain('#todo');
      expect(tagTexts).not.toContain('#todo/work');
    });
  });

  describe('Feature Enabled with Property Identification Method', () => {
    beforeEach(() => {
      mockPlugin.settings.taskIdentificationMethod = 'property';
      mockPlugin.settings.hideIdentifyingTagsInCards = true; // Enabled but should have no effect
    });

    it('should display all tags when using property identification method', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'urgent', 'work'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // All tags should be shown - setting only applies to tag method
      expect(tagElements.length).toBe(3);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).toContain('#task');
      expect(tagTexts).toContain('#urgent');
      expect(tagTexts).toContain('#work');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockPlugin.settings.taskIdentificationMethod = 'tag';
      mockPlugin.settings.taskTag = 'task';
      mockPlugin.settings.hideIdentifyingTagsInCards = true;
    });

    it('should handle empty tags array', () => {
      const task = TaskFactory.createTask({
        tags: [],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagsContainer = card.querySelector('.task-card__metadata-property--tags');

      // No tags container should be rendered
      expect(tagsContainer).toBeFalsy();
    });

    it('should handle undefined tags', () => {
      const task = TaskFactory.createTask({
        tags: undefined as any,
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagsContainer = card.querySelector('.task-card__metadata-property--tags');

      // Should handle gracefully without errors
      expect(tagsContainer).toBeFalsy();
    });

    it('should handle tags with special characters', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'urgent!', 'work@home', 'project#1'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // 'task' should be hidden, others shown (after normalization)
      expect(tagElements.length).toBeGreaterThan(0);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
    });

    it('should not hide tags that only partially match identifying tag', () => {
      mockPlugin.settings.taskTag = 'task';

      const task = TaskFactory.createTask({
        tags: ['tasks', 'tasking', 'mytask', 'task', 'urgent'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Only exact 'task' should be hidden, not partial matches
      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).toContain('#tasks');
      expect(tagTexts).toContain('#tasking');
      expect(tagTexts).toContain('#mytask');
      expect(tagTexts).toContain('#urgent');
    });

    it('should handle nested hierarchical tags correctly', () => {
      mockPlugin.settings.taskTag = 'task';

      const task = TaskFactory.createTask({
        tags: ['task', 'task/work', 'task/work/project', 'work', 'work/project'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // 'task', 'task/work', 'task/work/project' should be hidden
      // 'work' and 'work/project' should be shown (not children of 'task')
      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).not.toContain('#task/work');
      expect(tagTexts).not.toContain('#task/work/project');
      expect(tagTexts).toContain('#work');
      expect(tagTexts).toContain('#work/project');
    });
  });
});

