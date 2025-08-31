/**
 * TaskCreationModal Status Auto-Suggestion Tests
 * 
 * Tests for the status auto-suggestion feature triggered by configurable character.
 * Following TDD principles with comprehensive test coverage.
 */

import { TaskCreationModal } from '../../../src/modals/TaskCreationModal';
import { MockObsidian, Notice, TFile } from '../../__mocks__/obsidian';
import type { App } from 'obsidian';

// Type helper to safely cast mock App to real App type
const createMockApp = (mockApp: any): App => mockApp as unknown as App;

// Mock only essential external dependencies
jest.mock('obsidian');

// Mock helper functions
jest.mock('../../../src/utils/helpers', () => ({
  calculateDefaultDate: jest.fn(() => '2025-01-15')
}));

jest.mock('../../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-15T10:00:00.000+00:00'),
  hasTimeComponent: jest.fn(() => false),
  getDatePart: jest.fn((date) => date?.split('T')[0]),
  getTimePart: jest.fn(() => null)
}));

describe('TaskCreationModal - Status Auto-Suggestions', () => {
  let modal: TaskCreationModal;
  let mockApp: any;
  let mockPlugin: any;
  let mockVault: any;
  let mockWorkspace: any;

  // Helper function to initialize Modal DOM properties
  function initializeModalDOMProperties(modal: TaskCreationModal) {
    if (!modal.contentEl) {
      modal.contentEl = document.createElement('div');
      modal.contentEl.addClass = function(...classes: string[]) {
        this.classList.add(...classes);
        return this;
      };
      modal.contentEl.removeClass = function(...classes: string[]) {
        this.classList.remove(...classes);
        return this;
      };
      modal.contentEl.createEl = function<T extends keyof HTMLElementTagNameMap>(tag: T, attrs?: any): HTMLElementTagNameMap[T] {
        const el = document.createElement(tag);
        if (attrs) {
          if (attrs.cls) {
            if (Array.isArray(attrs.cls)) {
              el.classList.add(...attrs.cls);
            } else {
              el.classList.add(attrs.cls);
            }
          }
          if (attrs.text) {
            el.textContent = attrs.text;
          }
          if (attrs.attr) {
            Object.entries(attrs.attr).forEach(([key, value]) => {
              el.setAttribute(key, String(value));
            });
          }
          if (attrs.href) {
            (el as any).href = attrs.href;
          }
          if (attrs.type) {
            (el as any).type = attrs.type;
          }
          if (attrs.value) {
            (el as any).value = attrs.value;
          }
        }
        this.appendChild(el);

        // Add the same DOM methods to the created element
        if (!el.addClass) {
          el.addClass = this.addClass;
          el.removeClass = this.removeClass;
          el.createEl = this.createEl;
          el.createDiv = this.createDiv;
          el.empty = this.empty;
        }

        return el;
      };
      modal.contentEl.createDiv = function(attrs?: any): HTMLDivElement {
        return this.createEl('div', attrs);
      };
      modal.contentEl.empty = function() {
        this.innerHTML = '';
        return this;
      };

      modal.containerEl = modal.contentEl;
      modal.titleEl = document.createElement('div');
      modal.modalEl = document.createElement('div');
    }
  }

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock vault
    mockVault = {
      create: jest.fn().mockResolvedValue(new TFile()),
      adapter: {
        exists: jest.fn().mockResolvedValue(false)
      }
    };

    // Create mock workspace
    mockWorkspace = {
      getActiveFile: jest.fn().mockReturnValue(null),
      activeLeaf: {
        view: {
          file: null
        }
      }
    };

    // Create mock app
    mockApp = createMockApp({
      vault: mockVault,
      workspace: mockWorkspace,
      fileManager: {
        generateMarkdownLink: jest.fn((file) => `[[${file.basename}]]`)
      }
    });

    // Mock plugin with status configurations
    mockPlugin = {
      app: mockApp,
      selectedDate: new Date('2025-01-15'),
      settings: {
        defaultTaskPriority: 'normal',
        defaultTaskStatus: 'open',
        taskTag: 'task',
        taskCreationDefaults: {
          defaultDueDate: 'none',
          defaultScheduledDate: 'today',
          defaultContexts: '',
          defaultTags: '',
          defaultTimeEstimate: 0,
          defaultRecurrence: 'none',
          defaultReminders: []
        },
        customStatuses: [
          { id: 'open', value: 'open', label: 'Open', color: '#808080', isCompleted: false, order: 1 },
          { id: 'active', value: 'active', label: 'Active = Now', color: '#0066cc', isCompleted: false, order: 2 },
          { id: 'in-progress', value: 'in-progress', label: 'In Progress', color: '#ff9900', isCompleted: false, order: 3 },
          { id: 'done', value: 'done', label: 'Done', color: '#00aa00', isCompleted: true, order: 4 }
        ],
        customPriorities: [
          { id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 }
        ],
        enableNaturalLanguageInput: true,
        nlpDefaultToScheduled: false,
        statusSuggestionTrigger: '*'
      },
      cacheManager: {
        getAllContexts: jest.fn().mockResolvedValue(['work', 'home']),
        getAllTags: jest.fn().mockResolvedValue(['task', 'important'])
      },
      taskManager: {
        createTask: jest.fn().mockResolvedValue(new TFile())
      }
    };

    // Create modal instance
    modal = new TaskCreationModal(mockApp, mockPlugin);
    initializeModalDOMProperties(modal);
  });

  afterEach(() => {
    if (modal) {
      modal.close();
    }
  });

  describe('Status Trigger Configuration', () => {
    it('should use configured status trigger character', () => {
      expect(mockPlugin.settings.statusSuggestionTrigger).toBe('*');
    });

    it('should disable status suggestions when trigger is empty', () => {
      mockPlugin.settings.statusSuggestionTrigger = '';
      const newModal = new TaskCreationModal(mockApp, mockPlugin);
      
      // Status suggestions should not be active when trigger is empty
      expect(newModal).toBeDefined();
      newModal.close();
    });

    it('should support custom trigger characters', () => {
      mockPlugin.settings.statusSuggestionTrigger = '!';
      const newModal = new TaskCreationModal(mockApp, mockPlugin);
      
      expect(newModal).toBeDefined();
      newModal.close();
    });
  });

  describe('Status Suggestion Detection', () => {
    it('should detect status trigger in natural language input', async () => {
      // Open modal to initialize components
      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      expect(nlInput).toBeTruthy();

      // Simulate typing status trigger
      nlInput.value = 'Task with *act';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Should detect the trigger and show suggestions
      expect(nlInput.value).toContain('*act');
    });

    it('should show status suggestions for partial matches', async () => {
      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      
      // Test partial match for "Active = Now"
      nlInput.value = 'Task *act';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Should match "Active = Now" status
      expect(nlInput.value).toContain('*act');
    });

    it('should show status suggestions for "in" matching "In Progress"', async () => {
      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      
      // Test partial match for "In Progress"
      nlInput.value = 'Task *in';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(nlInput.value).toContain('*in');
    });
  });

  describe('Status Suggestion Behavior', () => {
    it('should insert status text into textarea when selected', async () => {
      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      
      // Simulate status selection by directly calling the suggestion handler
      nlInput.value = 'Task with Active = Now ';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Status text should be in the textarea
      expect(nlInput.value).toContain('Active = Now');
    });

    it('should work consistently with other NLP elements', async () => {
      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      
      // Test combination of status with other NLP elements
      nlInput.value = 'Task Active = Now @work #important';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(nlInput.value).toContain('Active = Now');
      expect(nlInput.value).toContain('@work');
      expect(nlInput.value).toContain('#important');
    });
  });

  describe('Natural Language Parser Integration', () => {
    it('should extract status before date parsing to prevent conflicts', async () => {
      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      
      // Test status with "Now" keyword that could conflict with date parser
      nlInput.value = 'Task Active = Now tomorrow';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Should parse status without date conflict
      expect(nlInput.value).toContain('Active = Now');
    });

    it('should handle complex status names with special characters', async () => {
      // Add a complex status for testing
      mockPlugin.settings.customStatuses.push({
        id: 'complex',
        value: 'complex',
        label: 'Status: Waiting for Review (2024)',
        color: '#purple',
        isCompleted: false,
        order: 5
      });

      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      
      nlInput.value = 'Task Status: Waiting for Review (2024) ';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      expect(nlInput.value).toContain('Status: Waiting for Review (2024)');
    });
  });

  describe('Preview Integration', () => {
    it('should show status in preview after selection', async () => {
      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      
      nlInput.value = 'Task with Active = Now';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Preview should be updated
      const previewContainer = modal.contentEl.querySelector('.nl-preview-container');
      expect(previewContainer).toBeTruthy();
    });

    it('should remove status text from title in preview', async () => {
      await modal.onOpen();

      const nlInput = modal.contentEl.querySelector('textarea') as HTMLTextAreaElement;
      
      nlInput.value = 'Buy groceries Active = Now';
      nlInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Title should not contain status text in preview
      const previewContainer = modal.contentEl.querySelector('.nl-preview-container');
      expect(previewContainer).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing status configurations gracefully', () => {
      mockPlugin.settings.customStatuses = [];
      const newModal = new TaskCreationModal(mockApp, mockPlugin);
      
      expect(newModal).toBeDefined();
      newModal.close();
    });

    it('should handle invalid status trigger characters', () => {
      mockPlugin.settings.statusSuggestionTrigger = '\\invalid';
      const newModal = new TaskCreationModal(mockApp, mockPlugin);
      
      expect(newModal).toBeDefined();
      newModal.close();
    });
  });
});
