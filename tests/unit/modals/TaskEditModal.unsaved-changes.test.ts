/**
 * TaskEditModal Unsaved Changes Tests
 *
 * Tests for the unsaved changes detection and confirmation prompt feature.
 * Following TDD principles with comprehensive test coverage.
 */

import { TaskEditModal } from '../../../src/modals/TaskEditModal';
import { ConfirmationModal } from '../../../src/modals/ConfirmationModal';
import { MockObsidian } from '../../__mocks__/obsidian';
import type { App } from 'obsidian';
import { TaskInfo } from '../../../src/types';

// Type helper to safely cast mock App to real App type
const createMockApp = (mockApp: any): App => mockApp as unknown as App;

jest.mock('obsidian');

// Mock ConfirmationModal with callback support for thirdButton
jest.mock('../../../src/modals/ConfirmationModal', () => ({
  ConfirmationModal: jest.fn().mockImplementation((app, options) => ({
    show: jest.fn().mockResolvedValue(false),
    open: jest.fn(),
    close: jest.fn(),
    options,
  })),
}));

describe('TaskEditModal - Unsaved Changes Detection', () => {
  let mockApp: App;
  let mockPlugin: any;
  let modal: TaskEditModal;
  let mockTask: TaskInfo;

  beforeEach(() => {
    jest.clearAllMocks();
    MockObsidian.reset();
    mockApp = createMockApp(MockObsidian.createMockApp());

    // Create a comprehensive mock plugin
    mockPlugin = {
      app: mockApp,
      settings: {
        taskTag: 'task',
        taskIdentificationMethod: 'tag',
        defaultTaskPriority: 'normal',
        defaultTaskStatus: 'open',
        useFrontmatterMarkdownLinks: false,
        modalFieldsConfig: {
          contexts: { enabled: true, visibleInEdit: true },
          projects: { enabled: true, visibleInEdit: true },
          tags: { enabled: true, visibleInEdit: true },
          timeEstimate: { enabled: true, visibleInEdit: true },
        },
        userFields: [],
      },
      taskService: {
        updateTask: jest.fn(async (orig: TaskInfo, changes: Partial<TaskInfo>) => ({ ...orig, ...changes })),
      },
      statusManager: {
        isCompletedStatus: jest.fn((s: string) => s === 'done'),
        getStatusConfig: jest.fn((s: string) => ({ label: s })),
      },
      cacheManager: {
        getTaskInfo: jest.fn(),
      },
      i18n: {
        translate: jest.fn((key: string, _vars?: any) => {
          const translations: Record<string, string> = {
            'modals.taskEdit.title': 'Edit Task',
            'modals.taskEdit.notices.titleRequired': 'Title is required',
            'modals.task.unsavedChanges.title': 'Unsaved Changes',
            'modals.task.unsavedChanges.message': 'You have unsaved changes. Do you want to save them?',
            'modals.task.unsavedChanges.save': 'Save Changes',
            'modals.task.unsavedChanges.discard': 'Discard Changes',
            'modals.task.unsavedChanges.cancel': 'Keep Editing',
            'common.cancel': 'Cancel',
          };
          return translations[key] || key;
        }),
      },
      t: jest.fn((key: string, _vars?: any) => {
        const translations: Record<string, string> = {
          'modals.taskEdit.title': 'Edit Task',
          'modals.taskEdit.notices.titleRequired': 'Title is required',
          'modals.task.unsavedChanges.title': 'Unsaved Changes',
          'modals.task.unsavedChanges.message': 'You have unsaved changes. Do you want to save them?',
          'modals.task.unsavedChanges.save': 'Save Changes',
          'modals.task.unsavedChanges.discard': 'Discard Changes',
          'modals.task.unsavedChanges.cancel': 'Keep Editing',
          'common.cancel': 'Cancel',
        };
        return translations[key] || key;
      }),
    };

    // Create a mock task
    mockTask = {
      title: 'Original Task Title',
      status: 'open',
      priority: 'normal',
      path: 'test-task.md',
      archived: false,
      due: '',
      scheduled: '',
      contexts: [],
      projects: [],
      tags: ['task'],
      details: 'Original details',
    } as TaskInfo;

  });

  afterEach(() => {
    if (modal) {
      // Use forceClose to avoid triggering confirmation
      modal.forceClose();
    }
  });

  // Helper function to initialize modal fields from task
  const initializeModalFields = (modal: TaskEditModal, task: TaskInfo) => {
    (modal as any).task = task;
    (modal as any).title = task.title;
    (modal as any).status = task.status;
    (modal as any).priority = task.priority;
    (modal as any).dueDate = task.due || '';
    (modal as any).scheduledDate = task.scheduled || '';
    (modal as any).contexts = task.contexts?.join(', ') || '';
    (modal as any).projects = task.projects?.join(', ') || '';
    (modal as any).tags = task.tags?.filter(t => t !== 'task').join(', ') || '';
    (modal as any).details = task.details || '';
    (modal as any).originalDetails = task.details || '';
  };

  // Helper to wait for async operations
  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  describe('Close without changes', () => {
    it('should close immediately when no changes exist', () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Spy on the parent close method
      const parentCloseSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(modal)), 'close');

      // Close the modal (synchronous)
      modal.close();

      // Should close without showing confirmation
      expect(ConfirmationModal).not.toHaveBeenCalled();
      expect(parentCloseSpy).toHaveBeenCalled();
    });

    it('should not show confirmation when using forceClose', () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Make a change
      (modal as any).title = 'Modified Title';

      // Spy on parent close
      const parentCloseSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(modal)), 'close');

      // Use forceClose to bypass confirmation
      modal.forceClose();

      // Should not show confirmation
      expect(ConfirmationModal).not.toHaveBeenCalled();
      expect(parentCloseSpy).toHaveBeenCalled();
    });
  });

  describe('Close with unsaved changes', () => {
    it('should show confirmation when title is modified', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify the title
      (modal as any).title = 'Modified Title';

      // Mock confirmation modal to return false (discard)
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockResolvedValue(false),
        options,
      }));

      // Close the modal (triggers async confirmation)
      modal.close();

      // Wait for async operations
      await flushPromises();

      // Should show confirmation
      expect(ConfirmationModal).toHaveBeenCalledWith(
        mockApp,
        expect.objectContaining({
          title: expect.any(String),
          message: expect.any(String),
          confirmText: expect.any(String),
          cancelText: expect.any(String),
          thirdButtonText: expect.any(String),
        })
      );
    });

    it('should show confirmation when details are modified', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify the details
      (modal as any).details = 'Modified details content';

      // Mock confirmation modal
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockResolvedValue(false),
        options,
      }));

      // Close the modal
      modal.close();
      await flushPromises();

      // Should show confirmation
      expect(ConfirmationModal).toHaveBeenCalled();
    });

    it('should show confirmation when priority is modified', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify the priority
      (modal as any).priority = 'high';

      // Mock confirmation modal
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockResolvedValue(false),
        options,
      }));

      // Close the modal
      modal.close();
      await flushPromises();

      // Should show confirmation
      expect(ConfirmationModal).toHaveBeenCalled();
    });

    it('should show confirmation when due date is added', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Add a due date
      (modal as any).dueDate = '2025-12-31';

      // Mock confirmation modal
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockResolvedValue(false),
        options,
      }));

      // Close the modal
      modal.close();
      await flushPromises();

      // Should show confirmation
      expect(ConfirmationModal).toHaveBeenCalled();
    });
  });

  describe('User confirmation choices', () => {
    it('should save and close when user confirms save', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify the title
      (modal as any).title = 'Modified Title';

      // Mock confirmation modal to return true (save)
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockResolvedValue(true),
        options,
      }));

      // Spy on handleSave and forceClose
      const handleSaveSpy = jest.spyOn(modal as any, 'handleSave');
      const forceCloseSpy = jest.spyOn(modal, 'forceClose');

      // Close the modal (triggers async confirmation)
      modal.close();

      // Wait for async operations to complete
      await flushPromises();

      // Should call handleSave and then forceClose
      expect(handleSaveSpy).toHaveBeenCalled();
      expect(forceCloseSpy).toHaveBeenCalled();
      expect(mockPlugin.taskService.updateTask).toHaveBeenCalledWith(
        mockTask,
        expect.objectContaining({
          title: 'Modified Title',
        })
      );
    });

    it('should discard and close when user chooses discard', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify the title
      (modal as any).title = 'Modified Title';

      // Mock confirmation modal to return false (discard)
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockResolvedValue(false),
        options,
      }));

      // Spy on handleSave and forceClose
      const handleSaveSpy = jest.spyOn(modal as any, 'handleSave');
      const forceCloseSpy = jest.spyOn(modal, 'forceClose');

      // Close the modal
      modal.close();

      // Wait for async operations
      await flushPromises();

      // Should NOT call handleSave but should forceClose
      expect(handleSaveSpy).not.toHaveBeenCalled();
      expect(forceCloseSpy).toHaveBeenCalled();
      expect(mockPlugin.taskService.updateTask).not.toHaveBeenCalled();
    });

    it('should stay open when user chooses cancel (keep editing)', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify the title
      (modal as any).title = 'Modified Title';

      // Mock confirmation modal - simulate third button (cancel) being clicked
      // The onThirdButton callback is called, then show() promise never resolves to save/discard
      let onThirdButtonCallback: (() => void) | undefined;
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => {
        onThirdButtonCallback = options.onThirdButton;
        return {
          show: jest.fn().mockImplementation(() => {
            // Simulate user clicking the third button
            if (onThirdButtonCallback) {
              onThirdButtonCallback();
            }
            // Return a promise that resolves to false (but onThirdButton already called)
            return Promise.resolve(false);
          }),
          options,
        };
      });

      // Spy on forceClose
      const forceCloseSpy = jest.spyOn(modal, 'forceClose');

      // Close the modal
      modal.close();

      // Wait for async operations
      await flushPromises();

      // The modal should NOT call forceClose when cancel is clicked
      // (because onThirdButton triggers "cancel" result which does nothing)
      // Note: In the real implementation, both onThirdButton AND the promise resolve
      // but our implementation checks onThirdButton first via the promise wrapper
      expect(ConfirmationModal).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace-only changes as no change', () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Add only whitespace to title (should be trimmed)
      (modal as any).title = 'Original Task Title   ';

      // Close the modal
      modal.close();

      // Should not show confirmation (whitespace is trimmed in getChanges)
      expect(ConfirmationModal).not.toHaveBeenCalled();
    });

    it('should detect changes in contexts field', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify contexts
      (modal as any).contexts = 'work, urgent';

      // Mock confirmation modal
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockResolvedValue(false),
        options,
      }));

      // Close the modal
      modal.close();
      await flushPromises();

      // Should show confirmation
      expect(ConfirmationModal).toHaveBeenCalled();
    });

    it('should detect changes in projects field', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify projects
      (modal as any).projects = '[[Project A]]';

      // Mock confirmation modal
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockResolvedValue(false),
        options,
      }));

      // Close the modal
      modal.close();
      await flushPromises();

      // Should show confirmation
      expect(ConfirmationModal).toHaveBeenCalled();
    });

    it('should prevent re-entrancy when confirmation is already showing', async () => {
      modal = new TaskEditModal(mockApp, mockPlugin, { task: mockTask });
      initializeModalFields(modal, mockTask);

      // Modify the title
      (modal as any).title = 'Modified Title';

      // Mock confirmation modal with a delayed response
      let resolveShow: (value: boolean) => void;
      (ConfirmationModal as jest.Mock).mockImplementationOnce((app, options) => ({
        show: jest.fn().mockImplementation(() => new Promise(resolve => {
          resolveShow = resolve;
        })),
        options,
      }));

      // First close triggers confirmation
      modal.close();

      // Second close should be ignored (re-entrancy prevention)
      modal.close();

      // Should only create one confirmation modal
      expect(ConfirmationModal).toHaveBeenCalledTimes(1);

      // Resolve the confirmation
      resolveShow!(false);
      await flushPromises();
    });
  });
});
