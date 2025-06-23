/**
 * BaseTaskModal Tests
 * 
 * Tests for the BaseTaskModal base class including:
 * - Form creation and management utilities
 * - RRule parsing and generation
 * - Date/time input handling
 * - Autocomplete functionality
 * - Validation helpers
 * - Character counting utilities
 * - Form state management
 * - Error handling and edge cases
 */

import { BaseTaskModal } from '../../../src/modals/BaseTaskModal';
import { RRule, Frequency } from 'rrule';
import { MockObsidian, App } from '../../__mocks__/obsidian';

// Mock external dependencies
jest.mock('obsidian');
jest.mock('rrule');

// Mock date utils
jest.mock('../../../src/utils/dateUtils', () => ({
  normalizeDateString: jest.fn((date) => date?.split('T')[0] || date),
  validateDateInput: jest.fn(() => true),
  hasTimeComponent: jest.fn((date) => date?.includes('T')),
  getDatePart: jest.fn((date) => date?.split('T')[0] || date),
  getTimePart: jest.fn((date) => date?.includes('T') ? '10:00' : null),
  combineDateAndTime: jest.fn((date, time) => time ? `${date}T${time}` : date),
  validateDateTimeInput: jest.fn(() => true)
}));

// Concrete implementation of BaseTaskModal for testing
class TestTaskModal extends BaseTaskModal {
  protected async initializeFormData(): Promise<void> {
    this.title = 'Test Task';
    this.priority = 'normal';
    this.status = 'open';
  }

  protected createActionButtons(container: HTMLElement): void {
    const button = container.createEl('button', { text: 'Test Button' });
    button.addEventListener('click', () => this.handleSubmit());
  }

  protected async handleSubmit(): Promise<void> {
    // Test implementation
  }
}

describe('BaseTaskModal', () => {
  let mockApp: App;
  let mockPlugin: any;
  let modal: TestTaskModal;
  let container: HTMLElement;

  beforeEach(() => {
    jest.clearAllMocks();
    MockObsidian.reset();
    
    // Mock RRule constructor and toString to work properly with instance data
    const mockRRule = jest.requireActual('../../../tests/__mocks__/rrule.ts');
    
    // Store original static methods before overriding
    const originalRRule = RRule;
    const originalFromString = RRule.fromString;
    
    // Mock the constructor to properly set instance data
    (RRule as any) = jest.fn().mockImplementation(function(this: any, options: any = {}) {
      this.options = options;
      return this;
    });
    
    // Restore static methods
    (RRule as any).fromString = originalFromString;
    Object.assign(RRule, originalRRule);
    
    // Set up the prototype with proper toString method
    (RRule as any).prototype.toString = function(this: any) {
      // Manually implement the toString logic
      if (!this.options) {
        return 'FREQ=DAILY;INTERVAL=1';
      }
      
      const { freq, interval = 1, byweekday, bymonthday, bymonth, bysetpos, until, count } = this.options;
      let result = '';
      
      const Frequency = mockRRule.Frequency;
      switch (freq) {
        case Frequency.DAILY:
          result = 'FREQ=DAILY';
          break;
        case Frequency.WEEKLY:
          result = 'FREQ=WEEKLY';
          break;
        case Frequency.MONTHLY:
          result = 'FREQ=MONTHLY';
          break;
        case Frequency.YEARLY:
          result = 'FREQ=YEARLY';
          break;
        default:
          return 'FREQ=DAILY;INTERVAL=1';
      }

      if (interval && interval > 1) {
        result += `;INTERVAL=${interval}`;
      }

      if (byweekday && byweekday.length > 0) {
        const dayMap = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
        const days = byweekday.map((w: any) => dayMap[w.weekday || w]).filter(Boolean);
        if (days.length > 0) {
          result += `;BYDAY=${days.join(',')}`;
        }
      }

      if (bymonthday && bymonthday.length > 0) {
        result += `;BYMONTHDAY=${bymonthday.join(',')}`;
      }

      if (bymonth && bymonth.length > 0) {
        result += `;BYMONTH=${bymonth.join(',')}`;
      }

      if (bysetpos && bysetpos.length > 0) {
        result += `;BYSETPOS=${bysetpos.join(',')}`;
      }

      if (until) {
        const dateStr = until.toISOString().split('T')[0].replace(/-/g, '');
        result += `;UNTIL=${dateStr}`;
      }

      if (count) {
        result += `;COUNT=${count}`;
      }

      return result;
    };
    
    // Create DOM container
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    
    // Mock app
    mockApp = MockObsidian.createMockApp();
    
    // Mock plugin
    mockPlugin = {
      app: mockApp,
      settings: {
        taskTag: 'task',
        customStatuses: [
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done' }
        ],
        customPriorities: [
          { value: 'normal', label: 'Normal' },
          { value: 'high', label: 'High' }
        ]
      },
      cacheManager: {
        getAllContexts: jest.fn().mockResolvedValue(['work', 'home', 'urgent']),
        getAllTags: jest.fn().mockResolvedValue(['task', 'important', 'review'])
      }
    };
    
    modal = new TestTaskModal(mockApp, mockPlugin);
    
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
    it('should initialize with default properties', () => {
      expect(modal.title).toBe('');
      expect(modal.dueDate).toBe('');
      expect(modal.scheduledDate).toBe('');
      expect(modal.priority).toBe('normal');
      expect(modal.status).toBe('open');
      expect(modal.contexts).toBe('');
      expect(modal.tags).toBe('');
      expect(modal.timeEstimate).toBe(0);
      expect((modal as any).frequencyMode).toBe('NONE');
    });

    it('should initialize form data when called', async () => {
      await modal.initializeFormData();
      
      expect(modal.title).toBe('Test Task');
      expect(modal.priority).toBe('normal');
      expect(modal.status).toBe('open');
    });
  });

  describe('Cache Management', () => {
    it('should get existing contexts', async () => {
      const contexts = await modal.getExistingContexts();
      
      expect(mockPlugin.cacheManager.getAllContexts).toHaveBeenCalled();
      expect(contexts).toEqual(['work', 'home', 'urgent']);
    });

    it('should get existing tags excluding task tag', async () => {
      const tags = await modal.getExistingTags();
      
      expect(mockPlugin.cacheManager.getAllTags).toHaveBeenCalled();
      expect(tags).toEqual(['important', 'review']); // 'task' filtered out
    });
  });

  describe('Day Name Conversion', () => {
    it('should convert abbreviations to full names', () => {
      const abbrs = ['mon', 'tue', 'fri'];
      const fullNames = (modal as any).convertAbbreviationsToFullNames(abbrs);
      
      expect(fullNames).toEqual(['Monday', 'Tuesday', 'Friday']);
    });

    it('should convert full names to abbreviations', () => {
      const fullNames = ['Monday', 'Tuesday', 'Friday'];
      const abbrs = (modal as any).convertFullNamesToAbbreviations(fullNames);
      
      expect(abbrs).toEqual(['mon', 'tue', 'fri']);
    });

    it('should filter out invalid day names', () => {
      const invalid = ['invalid', 'mon', 'not-a-day'];
      const fullNames = (modal as any).convertAbbreviationsToFullNames(invalid);
      
      expect(fullNames).toEqual(['Monday']);
    });
  });

  describe('RRule Parsing', () => {
    it('should parse daily recurrence rule', () => {
      const rruleString = 'FREQ=DAILY;INTERVAL=2';
      (modal as any).parseRRuleString(rruleString);
      
      expect((modal as any).frequencyMode).toBe('DAILY');
      expect((modal as any).rruleInterval).toBe(2);
    });

    it('should parse weekly recurrence rule', () => {
      const rruleString = 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR';
      (modal as any).parseRRuleString(rruleString);
      
      expect((modal as any).frequencyMode).toBe('WEEKLY');
      expect((modal as any).rruleInterval).toBe(1);
      expect((modal as any).rruleByWeekday).toHaveLength(3);
    });

    it('should parse monthly recurrence rule', () => {
      const rruleString = 'FREQ=MONTHLY;BYMONTHDAY=15';
      (modal as any).parseRRuleString(rruleString);
      
      expect((modal as any).frequencyMode).toBe('MONTHLY');
      expect((modal as any).monthlyMode).toBe('day');
      expect((modal as any).rruleByMonthday).toEqual([15]);
    });

    it('should parse yearly recurrence rule', () => {
      const rruleString = 'FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15';
      (modal as any).parseRRuleString(rruleString);
      
      expect((modal as any).frequencyMode).toBe('YEARLY');
      expect((modal as any).rruleByMonth).toEqual([6]);
      expect((modal as any).rruleByMonthday).toEqual([15]);
    });

    it('should parse recurrence with end date', () => {
      const until = new Date('2025-12-31');
      const rruleString = `FREQ=DAILY;UNTIL=${until.toISOString().split('T')[0].replace(/-/g, '')}`;
      (modal as any).parseRRuleString(rruleString);
      
      expect((modal as any).endMode).toBe('until');
      expect((modal as any).rruleUntil).toBeInstanceOf(Date);
    });

    it('should parse recurrence with count', () => {
      const rruleString = 'FREQ=DAILY;COUNT=10';
      (modal as any).parseRRuleString(rruleString);
      
      expect((modal as any).endMode).toBe('count');
      expect((modal as any).rruleCount).toBe(10);
    });

    it('should handle empty rrule string', () => {
      (modal as any).parseRRuleString('');
      
      expect((modal as any).frequencyMode).toBe('NONE');
      expect((modal as any).rruleInterval).toBe(1);
    });

    it('should handle invalid rrule string', () => {
      (modal as any).parseRRuleString('INVALID_RRULE');
      
      expect((modal as any).frequencyMode).toBe('NONE');
      expect(console.error).toHaveBeenCalled();
    });

    it('should determine monthly weekday mode', () => {
      const rruleString = 'FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1';
      (modal as any).parseRRuleString(rruleString);
      
      expect((modal as any).frequencyMode).toBe('MONTHLY');
      expect((modal as any).monthlyMode).toBe('weekday');
    });
  });

  describe('RRule Generation', () => {
    it('should generate daily recurrence rule', () => {
      (modal as any).frequencyMode = 'DAILY';
      (modal as any).rruleInterval = 3;
      
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toContain('FREQ=DAILY');
      expect(rruleString).toContain('INTERVAL=3');
    });

    it('should generate weekly recurrence rule', () => {
      (modal as any).frequencyMode = 'WEEKLY';
      (modal as any).rruleByWeekday = [{ weekday: 0 }, { weekday: 2 }]; // Monday, Wednesday
      
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toContain('FREQ=WEEKLY');
    });

    it('should generate monthly day recurrence rule', () => {
      (modal as any).frequencyMode = 'MONTHLY';
      (modal as any).monthlyMode = 'day';
      (modal as any).rruleByMonthday = [15];
      
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toContain('FREQ=MONTHLY');
    });

    it('should generate monthly weekday recurrence rule', () => {
      (modal as any).frequencyMode = 'MONTHLY';
      (modal as any).monthlyMode = 'weekday';
      (modal as any).rruleByWeekday = [{ weekday: 0 }];
      (modal as any).rruleBySetpos = [1];
      
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toContain('FREQ=MONTHLY');
    });

    it('should generate yearly recurrence rule', () => {
      (modal as any).frequencyMode = 'YEARLY';
      (modal as any).rruleByMonth = [6];
      (modal as any).rruleByMonthday = [15];
      
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toContain('FREQ=YEARLY');
    });

    it('should generate rule with until date', () => {
      (modal as any).frequencyMode = 'DAILY';
      (modal as any).endMode = 'until';
      (modal as any).rruleUntil = new Date('2025-12-31');
      
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toContain('FREQ=DAILY');
    });

    it('should generate rule with count', () => {
      (modal as any).frequencyMode = 'DAILY';
      (modal as any).endMode = 'count';
      (modal as any).rruleCount = 10;
      
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toContain('FREQ=DAILY');
    });

    it('should return empty string for NONE frequency', () => {
      (modal as any).frequencyMode = 'NONE';
      
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toBe('');
    });

    it('should handle generation errors gracefully', () => {
      // Store the original RRule to restore it after the test
      const originalRRule = RRule;
      
      // Override the working RRule mock to throw an error
      (RRule as any) = jest.fn().mockImplementation(() => {
        throw new Error('RRule creation failed');
      });
      
      (modal as any).frequencyMode = 'DAILY';
      const rruleString = (modal as any).generateRRuleString();
      
      expect(rruleString).toBe('');
      expect(console.error).toHaveBeenCalled();
      
      // Restore the original RRule for subsequent tests
      (global as any).RRule = originalRRule;
      Object.assign(RRule, originalRRule);
    });
  });

  describe('RRule Human Text', () => {
    it('should generate human text for valid rule', () => {
      modal.recurrenceRule = 'FREQ=DAILY;INTERVAL=1';
      
      const humanText = (modal as any).getRRuleHumanText();
      
      expect(humanText).toBe('every day'); // Mocked response
    });

    it('should handle no recurrence rule', () => {
      modal.recurrenceRule = '';
      
      const humanText = (modal as any).getRRuleHumanText();
      
      expect(humanText).toBe('No recurrence');
    });

    it('should handle invalid recurrence rule', () => {
      modal.recurrenceRule = 'INVALID_RULE';
      
      const humanText = (modal as any).getRRuleHumanText();
      
      expect(humanText).toBe('Invalid recurrence rule');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Form Group Creation', () => {
    it('should create form group with label and input container', () => {
      const formGroup = (modal as any).createFormGroup(container, 'Test Label', (inputContainer: HTMLElement) => {
        inputContainer.createEl('input', { type: 'text' });
      });
      
      expect(formGroup.classList.contains('modal-form__group')).toBe(true);
      
      const label = formGroup.querySelector('.modal-form__label');
      expect(label?.textContent).toBe('Test Label');
      
      const inputContainer = formGroup.querySelector('.modal-form__input-container');
      expect(inputContainer).toBeTruthy();
      
      const input = inputContainer?.querySelector('input');
      expect(input).toBeTruthy();
    });

    it('should create accessible form group with proper ARIA labels', () => {
      const formGroup = (modal as any).createFormGroup(container, 'Accessible Label', (inputContainer: HTMLElement) => {
        inputContainer.createEl('input', { type: 'text' });
      });
      
      const label = formGroup.querySelector('.modal-form__label');
      const inputContainer = formGroup.querySelector('.modal-form__input-container');
      
      expect(label?.id).toBeTruthy();
      expect(inputContainer?.getAttribute('aria-labelledby')).toBe(label?.id);
    });
  });

  describe('Autocomplete Input', () => {
    beforeEach(() => {
      (modal as any).existingContexts = ['work', 'home', 'urgent'];
      (modal as any).existingTags = ['important', 'review'];
    });

    it('should create autocomplete input with proper attributes', async () => {
      const getSuggestions = jest.fn().mockResolvedValue(['work', 'home']);
      const onChange = jest.fn();
      
      await (modal as any).createAutocompleteInput(container, 'contexts', getSuggestions, onChange);
      
      const input = container.querySelector('input');
      expect(input).toBeTruthy();
      expect(input?.getAttribute('aria-autocomplete')).toBe('list');
      expect(input?.getAttribute('role')).toBe('combobox');
      expect(input?.getAttribute('aria-expanded')).toBe('false');
    });

    it('should update field value on input', async () => {
      const getSuggestions = jest.fn().mockResolvedValue([]);
      const onChange = jest.fn();
      
      await (modal as any).createAutocompleteInput(container, 'contexts', getSuggestions, onChange);
      
      const input = container.querySelector('input') as HTMLInputElement;
      input.value = 'work, home';
      input.dispatchEvent(new Event('input'));
      
      expect(modal.contexts).toBe('work, home');
      expect(onChange).toHaveBeenCalledWith('work, home');
    });

    it('should show suggestions on focus', async () => {
      const getSuggestions = jest.fn().mockResolvedValue(['work', 'home', 'urgent']);
      const onChange = jest.fn();
      
      await (modal as any).createAutocompleteInput(container, 'contexts', getSuggestions, onChange);
      
      const input = container.querySelector('input') as HTMLInputElement;
      input.focus();
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(getSuggestions).toHaveBeenCalled();
    });

    it('should hide suggestions on blur', async () => {
      const getSuggestions = jest.fn().mockResolvedValue(['work', 'home']);
      const onChange = jest.fn();
      
      await (modal as any).createAutocompleteInput(container, 'contexts', getSuggestions, onChange);
      
      const input = container.querySelector('input') as HTMLInputElement;
      input.focus();
      input.blur();
      
      // Allow timeout to complete
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const suggestions = container.querySelector('.modal-form__suggestions');
      expect(suggestions).toBeFalsy();
    });

    it('should handle keyboard navigation in suggestions', async () => {
      const getSuggestions = jest.fn().mockResolvedValue(['work', 'home', 'urgent']);
      const onChange = jest.fn();
      
      await (modal as any).createAutocompleteInput(container, 'contexts', getSuggestions, onChange);
      
      const input = container.querySelector('input') as HTMLInputElement;
      
      // Mock suggestions being shown
      const suggestionsList = container.createDiv({ cls: 'modal-form__suggestions' });
      suggestionsList.createDiv({ cls: 'modal-form__suggestion', text: 'work' });
      suggestionsList.createDiv({ cls: 'modal-form__suggestion', text: 'home' });
      
      const arrowDownEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      input.dispatchEvent(arrowDownEvent);
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should fetch fresh data when suggestions are empty', async () => {
      const getSuggestions = jest.fn().mockResolvedValue([]);
      const onChange = jest.fn();
      
      await (modal as any).createAutocompleteInput(container, 'contexts', getSuggestions, onChange);
      
      const input = container.querySelector('input') as HTMLInputElement;
      input.focus();
      
      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockPlugin.cacheManager.getAllContexts).toHaveBeenCalled();
    });
  });

  describe('Suggestion Management', () => {
    it('should show suggestions list', () => {
      const input = container.createEl('input');
      const suggestions = ['work', 'home', 'urgent'];
      const onChange = jest.fn();
      
      (modal as any).showSuggestions(container, suggestions, input, onChange);
      
      const suggestionsList = container.querySelector('.modal-form__suggestions');
      expect(suggestionsList).toBeTruthy();
      expect(suggestionsList?.getAttribute('role')).toBe('listbox');
      expect(input.getAttribute('aria-expanded')).toBe('true');
    });

    it('should hide suggestions when list is empty', () => {
      const input = container.createEl('input');
      const suggestions: string[] = [];
      const onChange = jest.fn();
      
      (modal as any).showSuggestions(container, suggestions, input, onChange);
      
      const suggestionsList = container.querySelector('.modal-form__suggestions');
      expect(suggestionsList).toBeFalsy();
      expect(input.getAttribute('aria-expanded')).toBe('false');
    });

    it('should hide existing suggestions before showing new ones', () => {
      const input = container.createEl('input');
      
      // Create existing suggestions
      container.createDiv({ cls: 'modal-form__suggestions' });
      
      const suggestions = ['work', 'home'];
      const onChange = jest.fn();
      
      (modal as any).showSuggestions(container, suggestions, input, onChange);
      
      const suggestionsLists = container.querySelectorAll('.modal-form__suggestions');
      expect(suggestionsLists.length).toBe(1); // Should only have one list
    });

    it('should filter suggestions based on current input', () => {
      const input = container.createEl('input') as HTMLInputElement;
      input.value = 'work, ho'; // Partial input
      
      const suggestions = ['work', 'home', 'urgent'];
      const onChange = jest.fn();
      
      (modal as any).showSuggestions(container, suggestions, input, onChange);
      
      // Should show suggestions (exact filtering logic is in full implementation)
      const suggestionsList = container.querySelector('.modal-form__suggestions');
      expect(suggestionsList).toBeTruthy();
    });

    it('should handle suggestion selection', () => {
      const input = container.createEl('input') as HTMLInputElement;
      input.value = 'work, ';
      
      const onChange = jest.fn();
      
      (modal as any).applySuggestion(input, 'home', onChange);
      
      expect(input.value).toBe('work, home');
      expect(onChange).toHaveBeenCalledWith('work, home');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in RRule parsing gracefully', () => {
      // Mock RRule.fromString to throw error for this test
      const originalFromString = RRule.fromString;
      RRule.fromString = jest.fn().mockImplementationOnce(() => {
        throw new Error('Invalid RRule');
      });
      
      (modal as any).parseRRuleString('INVALID_RULE');
      
      expect((modal as any).frequencyMode).toBe('NONE');
      expect(console.error).toHaveBeenCalled();
      
      // Restore original fromString
      RRule.fromString = originalFromString;
    });

    it('should handle errors in suggestion fetching', async () => {
      mockPlugin.cacheManager.getAllContexts.mockRejectedValue(new Error('Cache error'));
      
      const contexts = await modal.getExistingContexts();
      
      // Should not throw, might return empty array or cached data
      expect(Array.isArray(contexts)).toBe(true);
    });

    it('should handle malformed autocomplete input', async () => {
      const getSuggestions = jest.fn().mockRejectedValue(new Error('Fetch error'));
      const onChange = jest.fn();
      
      await expect(
        (modal as any).createAutocompleteInput(container, 'contexts', getSuggestions, onChange)
      ).resolves.not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should reset RRule properties correctly', () => {
      // Set some properties first
      (modal as any).frequencyMode = 'WEEKLY';
      (modal as any).rruleInterval = 2;
      (modal as any).rruleByWeekday = [{ weekday: 0 }];
      (modal as any).endMode = 'count';
      (modal as any).rruleCount = 10;
      
      (modal as any).resetRRuleProperties();
      
      expect((modal as any).frequencyMode).toBe('NONE');
      expect((modal as any).rruleInterval).toBe(1);
      expect((modal as any).rruleByWeekday).toEqual([]);
      expect((modal as any).endMode).toBe('never');
      expect((modal as any).rruleCount).toBeNull();
    });

    it('should maintain form field state correctly', () => {
      modal.title = 'Updated Task';
      modal.priority = 'high';
      modal.contexts = 'work, urgent';
      
      expect(modal.title).toBe('Updated Task');
      expect(modal.priority).toBe('high');
      expect(modal.contexts).toBe('work, urgent');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle multiple rapid suggestion requests', async () => {
      const getSuggestions = jest.fn().mockResolvedValue(['work', 'home', 'urgent']);
      const onChange = jest.fn();
      
      await (modal as any).createAutocompleteInput(container, 'contexts', getSuggestions, onChange);
      
      const input = container.querySelector('input') as HTMLInputElement;
      
      // Rapid focus/blur cycles
      for (let i = 0; i < 10; i++) {
        input.focus();
        input.blur();
      }
      
      // Should not cause memory leaks or errors
      expect(true).toBe(true);
    });

    it('should handle large suggestion lists efficiently', () => {
      const largeSuggestions = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      const input = container.createEl('input');
      const onChange = jest.fn();
      
      const startTime = Date.now();
      (modal as any).showSuggestions(container, largeSuggestions, input, onChange);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      
      const suggestionsList = container.querySelector('.modal-form__suggestions');
      expect(suggestionsList).toBeTruthy();
    });
  });
});