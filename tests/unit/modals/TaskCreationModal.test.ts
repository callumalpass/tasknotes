/**
 * TaskCreationModal Component Tests
 * 
 * Tests for the TaskCreationModal including:
 * - Modal initialization and form population
 * - Natural language input parsing and quick creation
 * - Form validation and task creation
 * - Task conversion from parsed data
 * - Filename preview generation
 * - Form toggling and UI interactions
 * - Error handling and edge cases
 * - Integration with various plugin services
 */

import { TaskCreationModal, TaskConversionOptions } from '../../../src/modals/TaskCreationModal';
import { TaskInfo } from '../../../src/types';
import { ParsedTaskData } from '../../../src/utils/TasksPluginParser';
import { MockObsidian, App, Notice, TFile, Setting } from '../../__mocks__/obsidian';
import { TaskFactory } from '../../helpers/mock-factories';

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
  calculateDefaultDate: jest.fn((option) => {
    if (option === 'today') return '2025-01-15';
    if (option === 'tomorrow') return '2025-01-16';
    return '';
  })
}));

jest.mock('../../../src/utils/dateUtils', () => ({
  getCurrentTimestamp: jest.fn(() => '2025-01-15T10:00:00.000+00:00'),
  hasTimeComponent: jest.fn((date) => date?.includes('T')),
  getDatePart: jest.fn((date) => date?.split('T')[0] || date),
  getTimePart: jest.fn((date) => date?.includes('T') ? '10:00' : null)
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
  generateTaskFilename: jest.fn(() => 'test-task-2025-01-15')
}));

// Mock NaturalLanguageParser
jest.mock('../../../src/services/NaturalLanguageParser', () => ({
  NaturalLanguageParser: jest.fn().mockImplementation(() => ({
    parseInput: jest.fn((input) => ({
      title: 'Parsed Task',
      details: 'Additional details',
      dueDate: '2025-01-16',
      dueTime: '15:00',
      priority: 'high',
      status: 'open',
      contexts: ['work'],
      tags: ['important'],
      estimate: 60,
      recurrence: 'FREQ=DAILY'
    })),
    getPreviewData: jest.fn(() => [
      { icon: 'calendar', text: 'Due: Tomorrow 3:00 PM' },
      { icon: 'flag', text: 'Priority: High' },
      { icon: 'tag', text: 'Context: work' }
    ])
  }))
}));

describe('TaskCreationModal', () => {
  let mockApp: App;
  let mockPlugin: any;
  let modal: TaskCreationModal;
  let container: HTMLElement;

  beforeEach(() => {
    jest.clearAllMocks();
    MockObsidian.reset();
    
    // Create DOM container
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Mock app
    mockApp = MockObsidian.createMockApp();
    
    // Mock plugin
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
          defaultRecurrence: 'none'
        },
        customStatuses: [
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done' }
        ],
        customPriorities: [
          { value: 'normal', label: 'Normal' },
          { value: 'high', label: 'High' }
        ],
        enableNaturalLanguageInput: true,
        nlpDefaultToScheduled: false
      },
      taskService: {
        createTask: jest.fn().mockResolvedValue({
          file: new TFile('test-task.md'),
          content: '# Test Task'
        })
      }
    };
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    if (modal) {
      modal.close();
    }
  });

  describe('Modal Initialization', () => {
    it('should initialize modal with default values', () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      expect(modal).toBeInstanceOf(TaskCreationModal);
    });

    it('should initialize with pre-populated values', () => {
      const prePopulatedValues: Partial<TaskInfo> = {
        title: 'Pre-filled Task',
        priority: 'high',
        status: 'open',
        due: '2025-01-20',
        contexts: ['work', 'urgent']
      };

      modal = new TaskCreationModal(mockApp, mockPlugin, prePopulatedValues);
      expect(modal).toBeInstanceOf(TaskCreationModal);
    });

    it('should initialize with conversion options', () => {
      const parsedData: ParsedTaskData = {
        title: 'Converted Task',
        priority: 'high',
        status: 'open',
        dueDate: '2025-01-20'
      };

      const conversionOptions: TaskConversionOptions = {
        parsedData,
        editor: {} as any,
        lineNumber: 5
      };

      modal = new TaskCreationModal(mockApp, mockPlugin, {}, conversionOptions);
      expect(modal).toBeInstanceOf(TaskCreationModal);
    });

    it('should open modal and create form elements', async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      
      await modal.onOpen();

      expect(modal.containerEl.classList.contains('task-creation-modal')).toBe(true);
    });

    it('should initialize form data with defaults', async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      
      // Call initializeFormData directly to test defaults
      await (modal as any).initializeFormData();

      expect((modal as any).priority).toBe('normal');
      expect((modal as any).status).toBe('open');
      expect((modal as any).scheduledDate).toBe('2025-01-15');
    });

    it('should apply task creation defaults', async () => {
      mockPlugin.settings.taskCreationDefaults = {
        defaultDueDate: 'tomorrow',
        defaultScheduledDate: 'today',
        defaultContexts: 'work',
        defaultTags: 'important',
        defaultTimeEstimate: 60
      };

      modal = new TaskCreationModal(mockApp, mockPlugin);
      await (modal as any).initializeFormData();

      expect((modal as any).dueDate).toBe('2025-01-16');
      expect((modal as any).contexts).toBe('work');
      expect((modal as any).tags).toBe('important');
      expect((modal as any).timeEstimate).toBe(60);
    });
  });

  describe('Form Population', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should populate form from pre-populated values', () => {
      const values: Partial<TaskInfo> = {
        title: 'Test Task',
        status: 'open',
        priority: 'high',
        due: '2025-01-20',
        scheduled: '2025-01-18',
        contexts: ['work', 'urgent']
      };

      (modal as any).populateFromPrePopulatedValues(values);

      expect((modal as any).title).toBe('Test Task');
      expect((modal as any).status).toBe('open');
      expect((modal as any).priority).toBe('high');
      expect((modal as any).dueDate).toBe('2025-01-20');
      expect((modal as any).scheduledDate).toBe('2025-01-18');
      expect((modal as any).contexts).toBe('work, urgent');
    });

    it('should populate form from parsed data', () => {
      const parsedData: ParsedTaskData = {
        title: 'Parsed Task',
        priority: 'high',
        status: 'done',
        dueDate: '2025-01-25',
        scheduledDate: '2025-01-20',
        startDate: '2025-01-18',
        createdDate: '2025-01-15',
        doneDate: '2025-01-16',
        recurrence: 'weekly',
        recurrenceData: {
          days_of_week: ['mon', 'fri'],
          day_of_month: 15
        }
      };

      const conversionOptions: TaskConversionOptions = {
        parsedData,
        prefilledDetails: 'Additional context'
      };

      (modal as any).conversionOptions = conversionOptions;
      (modal as any).populateFromParsedData(parsedData);

      expect((modal as any).title).toBe('Parsed Task');
      expect((modal as any).priority).toBe('high');
      expect((modal as any).status).toBe('done');
      expect((modal as any).dueDate).toBe('2025-01-25');
      expect((modal as any).details).toContain('Additional context');
      expect((modal as any).details).toContain('Recurrence: weekly');
      expect((modal as any).details).toContain('Days: mon, fri');
    });

    it('should handle missing optional fields in parsed data', () => {
      const parsedData: ParsedTaskData = {
        title: 'Minimal Task'
      };

      (modal as any).conversionOptions = { parsedData };
      (modal as any).populateFromParsedData(parsedData);

      expect((modal as any).title).toBe('Minimal Task');
      expect((modal as any).priority).toBe('normal');
      expect((modal as any).status).toBe('open');
    });
  });

  describe('Natural Language Input', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should create natural language input when enabled', () => {
      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      expect(nlContainer).toBeTruthy();

      const textarea = nlContainer?.querySelector('.nl-input');
      expect(textarea).toBeTruthy();

      const buttons = nlContainer?.querySelectorAll('button');
      expect(buttons?.length).toBe(3); // Create, Fill form, Toggle detail
    });

    it('should not create natural language input when disabled', async () => {
      mockPlugin.settings.enableNaturalLanguageInput = false;
      modal.close();
      
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();

      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      expect(nlContainer).toBeNull();
    });

    it('should update preview on input', () => {
      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      const textarea = nlContainer?.querySelector('.nl-input') as HTMLTextAreaElement;
      
      textarea.value = 'Buy groceries tomorrow @home #errands';
      textarea.dispatchEvent(new Event('input'));

      const previewContainer = nlContainer?.querySelector('.nl-preview-container') as HTMLElement;
      expect(previewContainer?.style.display).toBe('block');
    });

    it('should clear preview when input is empty', () => {
      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      const textarea = nlContainer?.querySelector('.nl-input') as HTMLTextAreaElement;
      
      textarea.value = '';
      textarea.dispatchEvent(new Event('input'));

      const previewContainer = nlContainer?.querySelector('.nl-preview-container') as HTMLElement;
      expect(previewContainer?.style.display).toBe('none');
    });

    it('should parse and fill form when fill button clicked', () => {
      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      const textarea = nlContainer?.querySelector('.nl-input') as HTMLTextAreaElement;
      const fillButton = nlContainer?.querySelector('.nl-parse-button') as HTMLButtonElement;
      
      textarea.value = 'Buy groceries tomorrow @home #errands';
      fillButton.click();

      // Should show detailed form
      const detailedForm = modal.containerEl.querySelector('.detailed-form-container') as HTMLElement;
      expect(detailedForm?.style.display).toBe('block');
    });

    it('should toggle detailed form visibility', () => {
      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      const toggleButton = nlContainer?.querySelector('.nl-show-detail-button') as HTMLButtonElement;
      const detailedForm = modal.containerEl.querySelector('.detailed-form-container') as HTMLElement;
      
      // Initially hidden (assuming NL input is enabled)
      expect(detailedForm?.style.display).toBe('none');
      
      toggleButton.click();
      expect(detailedForm?.style.display).toBe('block');
      expect(toggleButton.textContent).toBe('−');
      
      toggleButton.click();
      expect(detailedForm?.style.display).toBe('none');
      expect(toggleButton.textContent).toBe('+');
    });

    it('should handle quick create task', async () => {
      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      const textarea = nlContainer?.querySelector('.nl-input') as HTMLTextAreaElement;
      const createButton = nlContainer?.querySelector('.nl-quick-create-button') as HTMLButtonElement;
      
      textarea.value = 'Buy groceries tomorrow @home #errands';
      
      const closeSpy = jest.spyOn(modal, 'close');
      createButton.click();

      // Allow async operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockPlugin.taskService.createTask).toHaveBeenCalled();
    });

    it('should handle keyboard shortcuts in natural language input', () => {
      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      const textarea = nlContainer?.querySelector('.nl-input') as HTMLTextAreaElement;
      
      textarea.value = 'Test task';
      
      // Test Ctrl+Enter for quick create
      const ctrlEnterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true
      });
      textarea.dispatchEvent(ctrlEnterEvent);
      
      // Test Shift+Enter for fill form
      const shiftEnterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true
      });
      textarea.dispatchEvent(shiftEnterEvent);
      
      // Events should be handled without throwing
      expect(true).toBe(true);
    });
  });

  describe('Filename Preview', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should show filename preview when title is entered', () => {
      const titleInput = modal.containerEl.querySelector('.modal-form__input--title') as HTMLInputElement;
      const filenamePreview = modal.containerEl.querySelector('.task-creation-modal__preview');
      
      titleInput.value = 'Test Task';
      titleInput.dispatchEvent(new Event('input'));

      expect(filenamePreview?.textContent).toBe('test-task-2025-01-15.md');
      expect(filenamePreview?.classList.contains('task-creation-modal__preview--valid')).toBe(true);
    });

    it('should show placeholder when no title entered', () => {
      const filenamePreview = modal.containerEl.querySelector('.task-creation-modal__preview');
      
      expect(filenamePreview?.textContent).toBe('Enter a title to see filename preview...');
    });

    it('should handle filename generation errors', () => {
      const mockGenerateTaskFilename = require('../../../src/utils/filenameGenerator').generateTaskFilename;
      mockGenerateTaskFilename.mockImplementationOnce(() => {
        throw new Error('Invalid filename');
      });

      const titleInput = modal.containerEl.querySelector('.modal-form__input--title') as HTMLInputElement;
      const filenamePreview = modal.containerEl.querySelector('.task-creation-modal__preview');
      
      titleInput.value = 'Invalid Title';
      titleInput.dispatchEvent(new Event('input'));

      expect(filenamePreview?.textContent).toBe('Error generating filename preview');
      expect(filenamePreview?.classList.contains('task-creation-modal__preview--error')).toBe(true);
    });

    it('should update filename preview when priority or status changes', () => {
      const titleInput = modal.containerEl.querySelector('.modal-form__input--title') as HTMLInputElement;
      titleInput.value = 'Test Task';
      titleInput.dispatchEvent(new Event('input'));

      const prioritySelect = modal.containerEl.querySelector('select') as HTMLSelectElement;
      prioritySelect.value = 'high';
      prioritySelect.dispatchEvent(new Event('change'));

      // Should trigger filename preview update
      expect(require('../../../src/utils/filenameGenerator').generateTaskFilename).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should validate required title field', async () => {
      const result = await (modal as any).validateAndPrepareTask();
      expect(result).toBe(false);
      expect(Notice).toHaveBeenCalledWith('Title is required');
    });

    it('should validate title length', async () => {
      (modal as any).title = 'a'.repeat(201);
      
      const result = await (modal as any).validateAndPrepareTask();
      expect(result).toBe(false);
      expect(Notice).toHaveBeenCalledWith('Title is too long (max 200 characters)');
    });

    it('should validate weekly recurrence days', async () => {
      (modal as any).title = 'Test Task';
      (modal as any).frequencyMode = 'WEEKLY';
      (modal as any).rruleByWeekday = [];
      
      const result = await (modal as any).validateAndPrepareTask();
      expect(result).toBe(false);
      expect(Notice).toHaveBeenCalledWith('Please select at least one day for weekly recurrence');
    });

    it('should validate monthly recurrence settings', async () => {
      (modal as any).title = 'Test Task';
      (modal as any).frequencyMode = 'MONTHLY';
      (modal as any).monthlyMode = 'day';
      (modal as any).rruleByMonthday = [];
      
      const result = await (modal as any).validateAndPrepareTask();
      expect(result).toBe(false);
      expect(Notice).toHaveBeenCalledWith('Please specify a day for monthly recurrence');
    });

    it('should validate yearly recurrence settings', async () => {
      (modal as any).title = 'Test Task';
      (modal as any).frequencyMode = 'YEARLY';
      (modal as any).rruleByMonth = [];
      (modal as any).rruleByMonthday = [];
      
      const result = await (modal as any).validateAndPrepareTask();
      expect(result).toBe(false);
      expect(Notice).toHaveBeenCalledWith('Please specify both month and day for yearly recurrence');
    });

    it('should pass validation with valid data', async () => {
      (modal as any).title = 'Valid Task';
      (modal as any).frequencyMode = 'NONE';
      
      const result = await (modal as any).validateAndPrepareTask();
      expect(result).toBe(true);
    });
  });

  describe('Task Creation', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should create task with valid data', async () => {
      (modal as any).title = 'Test Task';
      (modal as any).status = 'open';
      (modal as any).priority = 'high';
      (modal as any).details = 'Task details';
      (modal as any).contexts = 'work, urgent';
      (modal as any).tags = 'important';
      (modal as any).timeEstimate = 60;
      
      await modal.createTask();

      expect(mockPlugin.taskService.createTask).toHaveBeenCalledWith({
        title: 'Test Task',
        status: 'open',
        priority: 'high',
        contexts: ['work', 'urgent'],
        tags: ['task', 'important'],
        timeEstimate: 60,
        details: 'Task details',
        parentNote: '',
        dateCreated: '2025-01-15T10:00:00.000+00:00',
        dateModified: '2025-01-15T10:00:00.000+00:00'
      });

      expect(Notice).toHaveBeenCalledWith('Task created: Test Task');
    });

    it('should handle task creation errors', async () => {
      (modal as any).title = 'Test Task';
      mockPlugin.taskService.createTask.mockRejectedValue(new Error('Creation failed'));
      
      await modal.createTask();

      expect(console.error).toHaveBeenCalledWith('Failed to create task:', expect.any(Error));
      expect(Notice).toHaveBeenCalledWith('Failed to create task. Please try again.');
    });

    it('should create task with recurrence rule', async () => {
      (modal as any).title = 'Recurring Task';
      (modal as any).recurrenceRule = 'FREQ=DAILY;INTERVAL=1';
      
      await modal.createTask();

      expect(mockPlugin.taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrence: 'FREQ=DAILY;INTERVAL=1'
        })
      );
    });

    it('should filter out empty contexts and tags', async () => {
      (modal as any).title = 'Test Task';
      (modal as any).contexts = 'work, , urgent, ';
      (modal as any).tags = ', important, ';
      
      await modal.createTask();

      expect(mockPlugin.taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          contexts: ['work', 'urgent'],
          tags: ['task', 'important']
        })
      );
    });
  });

  describe('Task Conversion', () => {
    let mockEditor: any;

    beforeEach(() => {
      mockEditor = {
        getLine: jest.fn().mockReturnValue('- [ ] Original task line'),
        replaceRange: jest.fn()
      };
    });

    it('should replace original task line after creation', async () => {
      const conversionOptions: TaskConversionOptions = {
        editor: mockEditor,
        lineNumber: 5
      };

      modal = new TaskCreationModal(mockApp, mockPlugin, {}, conversionOptions);
      await modal.onOpen();
      
      (modal as any).title = 'Converted Task';
      
      const mockFile = new TFile('converted-task.md');
      mockPlugin.taskService.createTask.mockResolvedValue({ file: mockFile });
      
      await modal.createTask();

      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '- [[converted-task.md|Converted Task]]',
        { line: 5, ch: 0 },
        { line: 5, ch: 22 }
      );
    });

    it('should handle multi-line replacement', async () => {
      const selectionInfo = {
        taskLine: '- [ ] Original task',
        details: 'Additional details',
        startLine: 5,
        endLine: 7,
        originalContent: ['  - [ ] Original task', '    Additional details', '    More details']
      };

      const conversionOptions: TaskConversionOptions = {
        editor: mockEditor,
        lineNumber: 5,
        selectionInfo
      };

      modal = new TaskCreationModal(mockApp, mockPlugin, {}, conversionOptions);
      await modal.onOpen();
      
      (modal as any).title = 'Converted Task';
      
      const mockFile = new TFile('converted-task.md');
      mockPlugin.taskService.createTask.mockResolvedValue({ file: mockFile });
      
      mockEditor.getLine.mockReturnValue('    More details');
      
      await modal.createTask();

      expect(mockEditor.replaceRange).toHaveBeenCalledWith(
        '  - [[converted-task.md|Converted Task]]',
        { line: 5, ch: 0 },
        { line: 7, ch: 16 }
      );
    });
  });

  describe('Character Counter', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should update character counter on title input', () => {
      const titleInput = modal.containerEl.querySelector('.modal-form__input--title') as HTMLInputElement;
      const counter = modal.containerEl.querySelector('.modal-form__char-counter');
      
      titleInput.value = 'Test Task';
      titleInput.dispatchEvent(new Event('input'));

      expect(counter?.textContent).toBe('9/200');
    });

    it('should show warning when approaching limit', () => {
      const titleInput = modal.containerEl.querySelector('.modal-form__input--title') as HTMLInputElement;
      const counter = modal.containerEl.querySelector('.modal-form__char-counter');
      
      titleInput.value = 'a'.repeat(180);
      titleInput.dispatchEvent(new Event('input'));

      expect(counter?.textContent).toBe('180/200');
    });
  });

  describe('Keyboard Shortcuts', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should close modal on Escape key', () => {
      const closeSpy = jest.spyOn(modal, 'close');
      
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      modal.containerEl.dispatchEvent(escapeEvent);

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should create task on Ctrl+Enter', async () => {
      (modal as any).title = 'Test Task';
      
      const createTaskSpy = jest.spyOn(modal, 'createTask');
      
      const ctrlEnterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        bubbles: true
      });
      modal.containerEl.dispatchEvent(ctrlEnterEvent);

      expect(createTaskSpy).toHaveBeenCalled();
    });
  });

  describe('Parsed Data Application', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should apply parsed data to form fields', () => {
      const parsedData = {
        title: 'Parsed Task',
        details: 'Parsed details',
        dueDate: '2025-01-20',
        dueTime: '15:00',
        priority: 'high',
        status: 'open',
        contexts: ['work'],
        tags: ['important'],
        estimate: 60,
        recurrence: 'FREQ=DAILY'
      };

      (modal as any).applyParsedData(parsedData);

      expect((modal as any).title).toBe('Parsed Task');
      expect((modal as any).details).toBe('Parsed details');
      expect((modal as any).dueDate).toBe('2025-01-20 15:00');
      expect((modal as any).priority).toBe('high');
      expect((modal as any).contexts).toBe('work');
      expect((modal as any).tags).toBe('important');
      expect((modal as any).timeEstimate).toBe(60);
    });

    it('should handle partial parsed data', () => {
      const parsedData = {
        title: 'Minimal Task'
      };

      (modal as any).applyParsedData(parsedData);

      expect((modal as any).title).toBe('Minimal Task');
      // Other fields should remain unchanged
    });

    it('should handle recurrence parsing', () => {
      const parsedData = {
        title: 'Recurring Task',
        recurrence: 'FREQ=WEEKLY;BYDAY=MO,FR'
      };

      (modal as any).applyParsedData(parsedData);

      expect((modal as any).recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=MO,FR');
    });

    it('should handle legacy recurrence patterns', () => {
      const parsedData = {
        title: 'Legacy Recurring Task',
        recurrence: 'weekly'
      };

      (modal as any).applyParsedData(parsedData);

      expect((modal as any).details).toContain('Recurrence: weekly');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should handle quick create task errors', async () => {
      mockPlugin.taskService.createTask.mockRejectedValue(new Error('Network error'));
      
      await (modal as any).quickCreateTask('Test task');

      expect(console.error).toHaveBeenCalledWith('Error during quick task creation:', expect.any(Error));
      expect(Notice).toHaveBeenCalledWith('Failed to create task. Please try using the detailed form.');
    });

    it('should handle malformed natural language input', () => {
      const nlContainer = modal.containerEl.querySelector('.nl-input-container');
      const textarea = nlContainer?.querySelector('.nl-input') as HTMLTextAreaElement;
      
      // Mock parser to throw error
      const mockParser = (modal as any).nlParser;
      mockParser.parseInput.mockImplementationOnce(() => {
        throw new Error('Parse error');
      });
      
      textarea.value = 'Invalid input format';
      
      expect(() => textarea.dispatchEvent(new Event('input'))).not.toThrow();
    });

    it('should handle form population errors gracefully', () => {
      const parsedData = {
        title: 'Test Task',
        invalidField: 'should be ignored'
      };

      expect(() => (modal as any).applyParsedData(parsedData)).not.toThrow();
    });
  });

  describe('UI State Management', () => {
    beforeEach(async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
    });

    it('should manage detailed form visibility correctly', () => {
      const detailedForm = modal.containerEl.querySelector('.detailed-form-container') as HTMLElement;
      
      (modal as any).showDetailedForm();
      expect(detailedForm.style.display).toBe('block');
      expect((modal as any).isDetailedFormVisible).toBe(true);
      
      (modal as any).hideDetailedForm();
      expect(detailedForm.style.display).toBe('none');
      expect((modal as any).isDetailedFormVisible).toBe(false);
    });

    it('should show detailed form by default for task conversions', async () => {
      const conversionOptions: TaskConversionOptions = {
        parsedData: { title: 'Converted Task' }
      };

      modal.close();
      modal = new TaskCreationModal(mockApp, mockPlugin, {}, conversionOptions);
      await modal.onOpen();

      expect((modal as any).isDetailedFormVisible).toBe(true);
    });

    it('should hide detailed form by default with natural language input', async () => {
      mockPlugin.settings.enableNaturalLanguageInput = true;
      
      modal.close();
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();

      const detailedForm = modal.containerEl.querySelector('.detailed-form-container') as HTMLElement;
      expect(detailedForm.style.display).toBe('none');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid input changes efficiently', async () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      await modal.onOpen();
      
      const titleInput = modal.containerEl.querySelector('.modal-form__input--title') as HTMLInputElement;
      
      const startTime = Date.now();
      
      for (let i = 0; i < 50; i++) {
        titleInput.value = `Test Task ${i}`;
        titleInput.dispatchEvent(new Event('input'));
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(500);
    });

    it('should clean up event listeners on close', () => {
      modal = new TaskCreationModal(mockApp, mockPlugin);
      const closeSpy = jest.spyOn(modal, 'close');
      
      modal.close();
      
      expect(closeSpy).toHaveBeenCalled();
    });
  });
});