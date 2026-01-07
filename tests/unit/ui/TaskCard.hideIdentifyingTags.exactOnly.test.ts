/**
 * TaskCard Hide Identifying Tags - Exact Match Only Option Tests
 *
 * Tests for GitHub Issue #1284:
 * Feature request for an option to hide #task without hiding hierarchical
 * matches like #task/project.
 *
 * These tests verify the new `hideIdentifyingTagsMode` setting that allows:
 * - 'all': Hide the identifying tag AND all hierarchical children (current behavior)
 * - 'exact-only': Hide ONLY the exact identifying tag, show hierarchical children
 *
 * Test coverage:
 * - Mode 'exact-only': hides exact match, shows hierarchical children
 * - Mode 'all': existing behavior unchanged
 * - Integration with existing hideIdentifyingTagsInCards toggle
 * - Edge cases: case sensitivity, nested tags, partial matches
 */

import { createTaskCard } from '../../../src/ui/TaskCard';
import { TaskFactory } from '../../helpers/mock-factories';
import { MockObsidian } from '../../__mocks__/obsidian';
import type TaskNotesPlugin from '../../../src/main';

describe.skip('TaskCard - Hide Identifying Tags Exact Only Mode (#1284)', () => {
  let mockPlugin: any;
  let mockApp: any;

  beforeEach(() => {
    MockObsidian.reset();
    mockApp = MockObsidian.createMockApp();

    // Create base mock plugin with all required methods
    mockPlugin = {
      app: mockApp,
      selectedDate: new Date('2025-01-15'),
      fieldMapper: {
        isPropertyForField: jest.fn(() => false),
        toUserField: jest.fn((field) => field),
        toInternalField: jest.fn((field) => field),
        lookupMappingKey: jest.fn((propertyId) => {
          const mappings: Record<string, string> = {
            status: 'status',
            priority: 'priority',
            due: 'due',
            scheduled: 'scheduled',
            title: 'title',
            tags: 'tags',
            contexts: 'contexts',
            projects: 'projects',
          };
          return mappings[propertyId] || null;
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
        hideIdentifyingTagsInCards: true,
        hideIdentifyingTagsMode: 'all', // New setting: 'all' | 'exact-only'
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

  describe('Exact Only Mode', () => {
    beforeEach(() => {
      mockPlugin.settings.hideIdentifyingTagsInCards = true;
      mockPlugin.settings.hideIdentifyingTagsMode = 'exact-only';
    });

    it('should hide exact identifying tag but show hierarchical children', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project', 'task/urgent', 'personal'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Should show 3 tags: task/project, task/urgent, personal
      // Only 'task' (exact match) should be hidden
      expect(tagElements.length).toBe(3);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).toContain('#task/project');
      expect(tagTexts).toContain('#task/urgent');
      expect(tagTexts).toContain('#personal');
    });

    it('should hide only exact match when no hierarchical children exist', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'urgent', 'work'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      expect(tagElements.length).toBe(2);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).toContain('#urgent');
      expect(tagTexts).toContain('#work');
    });

    it('should handle deeply nested hierarchical tags', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/work', 'task/work/project', 'task/work/project/alpha'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Only 'task' hidden, all nested children shown
      expect(tagElements.length).toBe(3);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).toContain('#task/work');
      expect(tagTexts).toContain('#task/work/project');
      expect(tagTexts).toContain('#task/work/project/alpha');
    });

    it('should handle case-insensitive exact matching', () => {
      const task = TaskFactory.createTask({
        tags: ['Task', 'TASK', 'task/Project', 'urgent'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Both 'Task' and 'TASK' are exact matches (case-insensitive) and should be hidden
      // 'task/Project' is a hierarchical child and should be shown
      expect(tagElements.length).toBe(2);

      const tagTexts = Array.from(tagElements).map(el => el.textContent?.toLowerCase());
      expect(tagTexts).toContain('#task/project');
      expect(tagTexts).toContain('#urgent');
    });

    it('should show tags container when only hierarchical children remain after filtering', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagsContainer = card.querySelector('.task-card__metadata-property--tags');
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Container should exist with 'task/project' visible
      expect(tagsContainer).toBeTruthy();
      expect(tagElements.length).toBe(1);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).toContain('#task/project');
    });

    it('should not display tags when only exact match exists', () => {
      const task = TaskFactory.createTask({
        tags: ['task'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // No tags should be rendered
      expect(tagElements.length).toBe(0);
    });

    it('should work with different identifying tag values', () => {
      mockPlugin.settings.taskTag = 'todo';

      const task = TaskFactory.createTask({
        tags: ['todo', 'todo/work', 'todo/personal', 'task', 'task/project'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // 'todo' should be hidden (exact match)
      // 'todo/work', 'todo/personal' should be shown (hierarchical children)
      // 'task', 'task/project' should be shown (unrelated to identifying tag)
      expect(tagElements.length).toBe(4);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#todo');
      expect(tagTexts).toContain('#todo/work');
      expect(tagTexts).toContain('#todo/personal');
      expect(tagTexts).toContain('#task');
      expect(tagTexts).toContain('#task/project');
    });
  });

  describe('All Mode (Backward Compatibility)', () => {
    beforeEach(() => {
      mockPlugin.settings.hideIdentifyingTagsInCards = true;
      mockPlugin.settings.hideIdentifyingTagsMode = 'all';
    });

    it('should hide identifying tag and all hierarchical children', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project', 'task/urgent', 'personal'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Only 'personal' should be shown
      // 'task', 'task/project', 'task/urgent' all hidden
      expect(tagElements.length).toBe(1);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).not.toContain('#task/project');
      expect(tagTexts).not.toContain('#task/urgent');
      expect(tagTexts).toContain('#personal');
    });

    it('should hide deeply nested hierarchical tags', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/work', 'task/work/project', 'personal'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // All task-related tags hidden
      expect(tagElements.length).toBe(1);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).toContain('#personal');
    });
  });

  describe('Default Behavior When Mode Not Set', () => {
    beforeEach(() => {
      mockPlugin.settings.hideIdentifyingTagsInCards = true;
      // Simulate missing setting (undefined)
      delete mockPlugin.settings.hideIdentifyingTagsMode;
    });

    it('should default to "all" mode behavior when hideIdentifyingTagsMode is undefined', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project', 'personal'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Default to 'all' mode for backward compatibility
      // 'task' and 'task/project' should be hidden
      expect(tagElements.length).toBe(1);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).toContain('#personal');
    });
  });

  describe('Feature Disabled', () => {
    beforeEach(() => {
      mockPlugin.settings.hideIdentifyingTagsInCards = false;
      mockPlugin.settings.hideIdentifyingTagsMode = 'exact-only';
    });

    it('should show all tags when hideIdentifyingTagsInCards is false regardless of mode', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project', 'personal'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // All tags shown because the feature is disabled
      expect(tagElements.length).toBe(3);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).toContain('#task');
      expect(tagTexts).toContain('#task/project');
      expect(tagTexts).toContain('#personal');
    });
  });

  describe('Property Identification Method', () => {
    beforeEach(() => {
      mockPlugin.settings.taskIdentificationMethod = 'property';
      mockPlugin.settings.hideIdentifyingTagsInCards = true;
      mockPlugin.settings.hideIdentifyingTagsMode = 'exact-only';
    });

    it('should show all tags when using property identification method', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'task/project', 'personal'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Setting only applies to tag identification method
      expect(tagElements.length).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockPlugin.settings.hideIdentifyingTagsInCards = true;
      mockPlugin.settings.hideIdentifyingTagsMode = 'exact-only';
    });

    it('should not hide tags that only partially match identifying tag', () => {
      const task = TaskFactory.createTask({
        tags: ['task', 'tasks', 'mytask', 'tasking', 'task/project'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Only exact 'task' hidden, partials and hierarchical shown
      expect(tagElements.length).toBe(4);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#task');
      expect(tagTexts).toContain('#tasks');
      expect(tagTexts).toContain('#mytask');
      expect(tagTexts).toContain('#tasking');
      expect(tagTexts).toContain('#task/project');
    });

    it('should handle identifying tag that is itself hierarchical', () => {
      mockPlugin.settings.taskTag = 'work/task';

      const task = TaskFactory.createTask({
        tags: ['work/task', 'work/task/project', 'work', 'task'],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagElements = card.querySelectorAll('.task-card__metadata-property--tags .tag');

      // Only 'work/task' (exact match) hidden
      // 'work/task/project' shown (hierarchical child)
      // 'work' and 'task' shown (not matches)
      expect(tagElements.length).toBe(3);

      const tagTexts = Array.from(tagElements).map(el => el.textContent);
      expect(tagTexts).not.toContain('#work/task');
      expect(tagTexts).toContain('#work/task/project');
      expect(tagTexts).toContain('#work');
      expect(tagTexts).toContain('#task');
    });

    it('should handle empty tags array', () => {
      const task = TaskFactory.createTask({
        tags: [],
      });

      const card = createTaskCard(task, mockPlugin, ['tags']);
      const tagsContainer = card.querySelector('.task-card__metadata-property--tags');

      expect(tagsContainer).toBeFalsy();
    });
  });
});
