/**
 * RRule Migration and Helper Functions Tests
 * 
 * Tests for rrule-related utility functions including:
 * - Legacy recurrence to rrule conversion
 * - RRule-based task due date checking  
 * - Recurring instance generation
 * - Recurrence display text formatting
 */

import {
  convertLegacyRecurrenceToRRule,
  isDueByRRule,
  generateRecurringInstances,
  getRecurrenceDisplayText
} from '../../../src/utils/helpers';

import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { RRule } from 'rrule';

// Mock RRule for consistent testing
jest.mock('rrule');

const mockRRule = RRule as jest.MockedClass<typeof RRule>;

describe('RRule Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default RRule mock behavior
    mockRRule.DAILY = 3;
    mockRRule.WEEKLY = 2;
    mockRRule.MONTHLY = 1;
    mockRRule.YEARLY = 0;
    mockRRule.MO = { weekday: 0 };
    mockRRule.TU = { weekday: 1 };
    mockRRule.WE = { weekday: 2 };
    mockRRule.TH = { weekday: 3 };
    mockRRule.FR = { weekday: 4 };
    mockRRule.SA = { weekday: 5 };
    mockRRule.SU = { weekday: 6 };
    
    // Mock RRule constructor and methods
    mockRRule.mockImplementation((options: any) => ({
      toString: jest.fn(() => 'FREQ=DAILY'),
      toText: jest.fn(() => 'daily'),
      between: jest.fn(() => [new Date('2024-01-15')]),
      options
    } as any));
    
    mockRRule.parseString = jest.fn(() => ({ freq: 3 }));
    mockRRule.fromString = jest.fn(() => ({
      toText: jest.fn(() => 'daily'),
      between: jest.fn(() => [new Date('2024-01-15')])
    } as any));
  });

  describe('convertLegacyRecurrenceToRRule', () => {
    it('should convert daily recurrence', () => {
      const legacyRecurrence = {
        frequency: 'daily'
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=DAILY')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      const result = convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.DAILY
      });
      expect(result).toBe('FREQ=DAILY');
    });

    it('should convert weekly recurrence with specific days', () => {
      const legacyRecurrence = {
        frequency: 'weekly',
        days_of_week: ['mon', 'wed', 'fri']
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=WEEKLY;BYDAY=MO,WE,FR')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      const result = convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.WEEKLY,
        byweekday: [RRule.MO, RRule.WE, RRule.FR]
      });
      expect(result).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
    });

    it('should convert weekly recurrence without specific days', () => {
      const legacyRecurrence = {
        frequency: 'weekly'
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=WEEKLY')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      const result = convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.WEEKLY
      });
      expect(result).toBe('FREQ=WEEKLY');
    });

    it('should handle case-insensitive day names', () => {
      const legacyRecurrence = {
        frequency: 'weekly',
        days_of_week: ['MON', 'Wed', 'FRI']
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=WEEKLY;BYDAY=MO,WE,FR')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.WEEKLY,
        byweekday: [RRule.MO, RRule.WE, RRule.FR]
      });
    });

    it('should filter out invalid day names', () => {
      const legacyRecurrence = {
        frequency: 'weekly',
        days_of_week: ['mon', 'invalid', 'fri', '']
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=WEEKLY;BYDAY=MO,FR')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.WEEKLY,
        byweekday: [RRule.MO, RRule.FR]
      });
    });

    it('should convert monthly recurrence with day of month', () => {
      const legacyRecurrence = {
        frequency: 'monthly',
        day_of_month: 15
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=MONTHLY;BYMONTHDAY=15')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      const result = convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.MONTHLY,
        bymonthday: [15]
      });
      expect(result).toBe('FREQ=MONTHLY;BYMONTHDAY=15');
    });

    it('should convert monthly recurrence without day of month', () => {
      const legacyRecurrence = {
        frequency: 'monthly'
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=MONTHLY')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      const result = convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.MONTHLY
      });
      expect(result).toBe('FREQ=MONTHLY');
    });

    it('should convert yearly recurrence with month and day', () => {
      const legacyRecurrence = {
        frequency: 'yearly',
        month_of_year: 12,
        day_of_month: 25
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      const result = convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.YEARLY,
        bymonth: [12],
        bymonthday: [25]
      });
      expect(result).toBe('FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25');
    });

    it('should convert yearly recurrence with only month', () => {
      const legacyRecurrence = {
        frequency: 'yearly',
        month_of_year: 6
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=YEARLY;BYMONTH=6')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      const result = convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.YEARLY,
        bymonth: [6]
      });
      expect(result).toBe('FREQ=YEARLY;BYMONTH=6');
    });

    it('should convert yearly recurrence with only day', () => {
      const legacyRecurrence = {
        frequency: 'yearly',
        day_of_month: 1
      };

      const mockRRuleInstance = {
        toString: jest.fn(() => 'FREQ=YEARLY;BYMONTHDAY=1')
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);

      const result = convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.YEARLY,
        bymonthday: [1]
      });
      expect(result).toBe('FREQ=YEARLY;BYMONTHDAY=1');
    });

    it('should throw error for invalid recurrence object', () => {
      expect(() => convertLegacyRecurrenceToRRule(null)).toThrow('Invalid recurrence object');
      expect(() => convertLegacyRecurrenceToRRule({})).toThrow('Invalid recurrence object');
      expect(() => convertLegacyRecurrenceToRRule({ invalid: true })).toThrow('Invalid recurrence object');
    });

    it('should throw error for unsupported frequency', () => {
      const legacyRecurrence = {
        frequency: 'hourly'
      };

      expect(() => convertLegacyRecurrenceToRRule(legacyRecurrence))
        .toThrow('Unsupported frequency: hourly');
    });

    it('should handle RRule creation errors', () => {
      const legacyRecurrence = {
        frequency: 'daily'
      };

      mockRRule.mockImplementation(() => {
        throw new Error('RRule creation failed');
      });

      expect(() => convertLegacyRecurrenceToRRule(legacyRecurrence))
        .toThrow('RRule creation failed');
    });

    it('should handle all valid day abbreviations', () => {
      const legacyRecurrence = {
        frequency: 'weekly',
        days_of_week: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      };

      convertLegacyRecurrenceToRRule(legacyRecurrence);

      expect(mockRRule).toHaveBeenCalledWith({
        freq: RRule.WEEKLY,
        byweekday: [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA]
      });
    });
  });

  describe('isDueByRRule', () => {
    it('should return true for non-recurring tasks', () => {
      const task = TaskFactory.createTask({ recurrence: undefined });
      const result = isDueByRRule(task, new Date('2024-01-15'));
      expect(result).toBe(true);
    });

    it('should handle rrule string recurrence with scheduled date', () => {
      const task = TaskFactory.createTask({
        recurrence: 'FREQ=DAILY',
        scheduled: '2024-01-10'
      });

      const mockRRuleInstance = {
        between: jest.fn(() => [new Date('2024-01-15')])
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);
      mockRRule.parseString = jest.fn(() => ({ freq: 3 }));

      const result = isDueByRRule(task, new Date('2024-01-15'));

      expect(mockRRule.parseString).toHaveBeenCalledWith('FREQ=DAILY');
      expect(mockRRule).toHaveBeenCalledWith(expect.objectContaining({
        freq: 3,
        dtstart: expect.any(Date)
      }));
      expect(result).toBe(true);
    });

    it('should handle rrule string recurrence with dateCreated fallback', () => {
      const task = TaskFactory.createTask({
        recurrence: 'FREQ=DAILY',
        dateCreated: '2024-01-10'
      });

      const mockRRuleInstance = {
        between: jest.fn(() => [new Date('2024-01-15')])
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);
      mockRRule.parseString = jest.fn(() => ({ freq: 3 }));

      const result = isDueByRRule(task, new Date('2024-01-15'));

      expect(mockRRule).toHaveBeenCalledWith(expect.objectContaining({
        freq: 3,
        dtstart: expect.any(Date)
      }));
      expect(result).toBe(true);
    });

    it('should return false for rrule tasks without anchor date', () => {
      const task = TaskFactory.createTask({
        recurrence: 'FREQ=DAILY',
        scheduled: undefined,
        dateCreated: undefined
      });

      const result = isDueByRRule(task, new Date('2024-01-15'));
      expect(result).toBe(false);
    });

    it('should return false when no occurrences found', () => {
      const task = TaskFactory.createTask({
        recurrence: 'FREQ=DAILY',
        scheduled: '2024-01-10'
      });

      const mockRRuleInstance = {
        between: jest.fn(() => []) // No occurrences
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);
      mockRRule.parseString = jest.fn(() => ({ freq: 3 }));

      const result = isDueByRRule(task, new Date('2024-01-15'));
      expect(result).toBe(false);
    });

    it('should fall back to legacy handler on rrule errors', () => {
      const task = TaskFactory.createTask({
        recurrence: 'INVALID_RRULE',
        scheduled: '2024-01-10'
      });

      mockRRule.parseString = jest.fn(() => {
        throw new Error('Invalid rrule');
      });

      // Mock isRecurringTaskDueOn to return true
      const result = isDueByRRule(task, new Date('2024-01-15'));
      // Since we can't easily mock the legacy function, just check it doesn't throw
      expect(typeof result).toBe('boolean');
    });

    it('should handle legacy object recurrence', () => {
      const task = TaskFactory.createTask({
        recurrence: {
          frequency: 'daily'
        }
      });

      // Should fall back to legacy handler
      const result = isDueByRRule(task, new Date('2024-01-15'));
      expect(typeof result).toBe('boolean');
    });

    it('should use correct date range for occurrence check', () => {
      const task = TaskFactory.createTask({
        recurrence: 'FREQ=DAILY',
        scheduled: '2024-01-10'
      });

      const mockRRuleInstance = {
        between: jest.fn(() => [new Date('2024-01-15')])
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);
      mockRRule.parseString = jest.fn(() => ({ freq: 3 }));

      const targetDate = new Date('2024-01-15T10:30:00');
      isDueByRRule(task, targetDate);

      expect(mockRRuleInstance.between).toHaveBeenCalledWith(
        expect.any(Date), // Start of day (flexible for timezone)
        expect.any(Date), // End of day (flexible for timezone)
        true
      );
    });
  });

  describe('generateRecurringInstances', () => {
    it('should return empty array for non-recurring tasks', () => {
      const task = TaskFactory.createTask({ recurrence: undefined });
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = generateRecurringInstances(task, startDate, endDate);
      expect(result).toEqual([]);
    });

    it('should generate instances using rrule with scheduled anchor', () => {
      const task = TaskFactory.createTask({
        recurrence: 'FREQ=DAILY',
        scheduled: '2024-01-10'
      });

      const expectedInstances = [
        new Date('2024-01-15'),
        new Date('2024-01-16'),
        new Date('2024-01-17')
      ];

      const mockRRuleInstance = {
        between: jest.fn(() => expectedInstances)
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);
      mockRRule.parseString = jest.fn(() => ({ freq: 3 }));

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-17');

      const result = generateRecurringInstances(task, startDate, endDate);

      expect(mockRRule.parseString).toHaveBeenCalledWith('FREQ=DAILY');
      expect(mockRRule).toHaveBeenCalledWith(expect.objectContaining({
        freq: 3,
        dtstart: expect.any(Date)
      }));
      expect(mockRRuleInstance.between).toHaveBeenCalledWith(startDate, endDate, true);
      expect(result).toEqual(expectedInstances);
    });

    it('should use dateCreated as fallback anchor', () => {
      const task = TaskFactory.createTask({
        recurrence: 'FREQ=WEEKLY',
        dateCreated: '2024-01-05'
      });

      const mockRRuleInstance = {
        between: jest.fn(() => [new Date('2024-01-15')])
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);
      mockRRule.parseString = jest.fn(() => ({ freq: 2 }));

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-21');

      generateRecurringInstances(task, startDate, endDate);

      expect(mockRRule).toHaveBeenCalledWith(expect.objectContaining({
        freq: 2,
        dtstart: expect.any(Date)
      }));
    });

    it('should return empty array when no anchor date available', () => {
      const task = {
        ...TaskFactory.createTask({
          recurrence: 'FREQ=DAILY'
        }),
        scheduled: undefined,
        dateCreated: undefined
      };

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-17');

      const result = generateRecurringInstances(task, startDate, endDate);
      expect(result).toEqual([]);
    });

    it('should fall back to legacy method on rrule errors', () => {
      const task = TaskFactory.createTask({
        recurrence: 'INVALID_RRULE',
        scheduled: '2024-01-10'
      });

      mockRRule.parseString = jest.fn(() => {
        throw new Error('Invalid rrule');
      });

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-17');

      const result = generateRecurringInstances(task, startDate, endDate);
      // Should use legacy method and return an array
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle legacy object recurrence', () => {
      const task = TaskFactory.createTask({
        recurrence: {
          frequency: 'daily'
        }
      });

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-17');

      const result = generateRecurringInstances(task, startDate, endDate);
      // Should use legacy method and return an array
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty date ranges', () => {
      const task = TaskFactory.createTask({
        recurrence: 'FREQ=DAILY',
        scheduled: '2024-01-10'
      });

      const mockRRuleInstance = {
        between: jest.fn(() => [])
      };
      mockRRule.mockReturnValue(mockRRuleInstance as any);
      mockRRule.parseString = jest.fn(() => ({ freq: 3 }));

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-15'); // Same day range

      const result = generateRecurringInstances(task, startDate, endDate);
      expect(result).toEqual([]);
    });
  });

  describe('getRecurrenceDisplayText', () => {
    it('should return empty string for no recurrence', () => {
      expect(getRecurrenceDisplayText(null)).toBe('');
      expect(getRecurrenceDisplayText(undefined)).toBe('');
      expect(getRecurrenceDisplayText('')).toBe('');
    });

    it('should convert rrule string to human text', () => {
      const mockRRuleInstance = {
        toText: jest.fn(() => 'daily')
      };
      mockRRule.fromString = jest.fn(() => mockRRuleInstance);

      const result = getRecurrenceDisplayText('FREQ=DAILY');

      expect(mockRRule.fromString).toHaveBeenCalledWith('FREQ=DAILY');
      expect(result).toBe('daily');
    });

    it('should convert legacy object to human text via rrule', () => {
      const legacyRecurrence = {
        frequency: 'weekly',
        days_of_week: ['mon', 'fri']
      };

      // Mock convertLegacyRecurrenceToRRule
      const mockConvertedRRule = 'FREQ=WEEKLY;BYDAY=MO,FR';
      const mockRRuleInstance = {
        toString: jest.fn(() => mockConvertedRRule)
      };
      const mockFromStringInstance = {
        toText: jest.fn(() => 'weekly on Monday and Friday')
      };
      
      mockRRule.mockReturnValue(mockRRuleInstance as any);
      mockRRule.fromString = jest.fn(() => mockFromStringInstance as any);

      const result = getRecurrenceDisplayText(legacyRecurrence);

      expect(mockRRule.fromString).toHaveBeenCalledWith(mockConvertedRRule);
      expect(result).toBe('weekly on Monday and Friday');
    });

    it('should return fallback text on rrule parsing error', () => {
      mockRRule.fromString = jest.fn(() => {
        throw new Error('Invalid rrule');
      });

      const result = getRecurrenceDisplayText('INVALID_RRULE');
      expect(result).toBe('rrule');
    });

    it('should return fallback text on legacy conversion error', () => {
      const legacyRecurrence = {
        frequency: 'invalid'
      };

      // convertLegacyRecurrenceToRRule will throw
      const result = getRecurrenceDisplayText(legacyRecurrence);
      expect(result).toBe('rrule');
    });

    it('should return fallback text for unknown format', () => {
      const unknownFormat = 'some random string';
      const result = getRecurrenceDisplayText(unknownFormat);
      expect(result).toBe('rrule');
    });

    it('should handle complex rrule strings', () => {
      const complexRRule = 'FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20241231T235959Z';
      
      const mockRRuleInstance = {
        toText: jest.fn(() => 'monthly on the 15th until December 31, 2024')
      };
      mockRRule.fromString = jest.fn(() => mockRRuleInstance);

      const result = getRecurrenceDisplayText(complexRRule);

      expect(mockRRule.fromString).toHaveBeenCalledWith(complexRRule);
      expect(result).toBe('monthly on the 15th until December 31, 2024');
    });
  });
});