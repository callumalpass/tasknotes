/**
 * DateUtils Unit Tests
 * 
 * Tests for date parsing, formatting, and comparison utilities including:
 * - Smart date parsing with various formats
 * - Timezone-aware operations
 * - Safe date comparisons
 * - Date normalization and validation
 * - Time-aware date operations
 * - Error handling and edge cases
 */

import {
  parseDate,
  isSameDateSafe,
  isBeforeDateSafe,
  getTodayString,
  normalizeDateString,
  createSafeDate,
  validateDateInput,
  addDaysToDateString,
  startOfDayForDateString,
  isToday,
  isPastDate,
  formatDateForDisplay,
  getCurrentTimestamp,
  getCurrentDateString,
  parseTimestamp,
  formatTimestampForDisplay,
  hasTimeComponent,
  getDatePart,
  getTimePart,
  combineDateAndTime,
  formatDateTimeForDisplay,
  isBeforeDateTimeAware,
  isOverdueTimeAware,
  isTodayTimeAware,
  validateDateTimeInput,
  getCurrentDateTimeString,
  addDaysToDateTime
} from '../../../src/utils/dateUtils';

// Mock date-fns functions for consistent testing
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, formatStr: string) => {
    // Mock basic format functionality
    const d = new Date(date);
    if (formatStr === 'yyyy-MM-dd') {
      return d.toISOString().split('T')[0];
    } else if (formatStr === 'MMM d, yyyy') {
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } else if (formatStr === 'h:mm a') {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (formatStr === 'HH:mm') {
      return d.toTimeString().substring(0, 5);
    } else if (formatStr === "yyyy-MM-dd'T'HH:mm") {
      return d.toISOString().substring(0, 16);
    }
    return d.toISOString();
  }),
  parse: jest.fn((dateStr: string, format: string, refDate: Date) => {
    if (format === 'yyyy-MM-dd') {
      return new Date(dateStr + 'T00:00:00.000Z');
    }
    return new Date(dateStr);
  }),
  parseISO: jest.fn((dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return date;
  }),
  isSameDay: jest.fn((date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  }),
  isBefore: jest.fn((date1: Date, date2: Date) => {
    return date1.getTime() < date2.getTime();
  }),
  isValid: jest.fn((date: Date) => {
    return date instanceof Date && !isNaN(date.getTime());
  }),
  startOfDay: jest.fn((date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }),
  endOfDay: jest.fn((date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }),
  addDays: jest.fn((date: Date, amount: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  })
}));

describe('DateUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('parseDate', () => {
    it('should parse simple date strings', () => {
      const result = parseDate('2025-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toContain('2025-01-15');
    });

    it('should parse ISO datetime strings', () => {
      const result = parseDate('2025-01-15T14:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2025-01-15T14:30:00.000Z');
    });

    it('should parse space-separated datetime', () => {
      const result = parseDate('2025-01-15 14:30:00');
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse ISO week format', () => {
      const result = parseDate('2025-W03');
      expect(result).toBeInstanceOf(Date);
      // Should be Monday of week 3
    });

    it('should throw error for empty string', () => {
      expect(() => parseDate('')).toThrow('Date string cannot be empty');
    });

    it('should throw error for invalid ISO week', () => {
      expect(() => parseDate('2025-W99')).toThrow('Invalid week number');
    });

    it('should throw error for incomplete time format', () => {
      expect(() => parseDate('T14:30')).toThrow('Invalid date format - time without date');
    });

    it('should handle timezone-aware dates', () => {
      const result = parseDate('2025-01-15T14:30:00+02:00');
      expect(result).toBeInstanceOf(Date);
    });

    it('should throw for invalid date formats', () => {
      // Mock parseISO to throw for invalid dates
      const mockParseISO = require('date-fns').parseISO;
      mockParseISO.mockImplementationOnce(() => {
        throw new Error('Invalid');
      });

      expect(() => parseDate('invalid-date')).toThrow();
    });

    it('should handle whitespace in input', () => {
      const result = parseDate('  2025-01-15  ');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('Date Comparison Functions', () => {
    describe('isSameDateSafe', () => {
      it('should return true for same dates', () => {
        const result = isSameDateSafe('2025-01-15', '2025-01-15');
        expect(result).toBe(true);
      });

      it('should return false for different dates', () => {
        const result = isSameDateSafe('2025-01-15', '2025-01-16');
        expect(result).toBe(false);
      });

      it('should handle comparison errors gracefully', () => {
        // Mock parseDate to throw
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        const result = isSameDateSafe('invalid', '2025-01-15');
        expect(result).toBe(false);
      });
    });

    describe('isBeforeDateSafe', () => {
      it('should return true when first date is before second', () => {
        const result = isBeforeDateSafe('2025-01-14', '2025-01-15');
        expect(result).toBe(true);
      });

      it('should return false when first date is after second', () => {
        const result = isBeforeDateSafe('2025-01-16', '2025-01-15');
        expect(result).toBe(false);
      });

      it('should handle comparison errors gracefully', () => {
        const result = isBeforeDateSafe('invalid', '2025-01-15');
        expect(result).toBe(false);
      });
    });
  });

  describe('Date Utility Functions', () => {
    describe('getTodayString', () => {
      it('should return today in YYYY-MM-DD format', () => {
        const result = getTodayString();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('normalizeDateString', () => {
      it('should normalize various date formats to YYYY-MM-DD', () => {
        const result = normalizeDateString('2025-01-15T14:30:00Z');
        expect(result).toBe('2025-01-15');
      });

      it('should return original string on parse error', () => {
        // Mock parseDate to throw
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        const result = normalizeDateString('invalid-date');
        expect(result).toBe('invalid-date');
      });
    });

    describe('createSafeDate', () => {
      it('should create date with correct year, month, day', () => {
        const result = createSafeDate(2025, 0, 15); // Month is 0-based
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(15);
      });
    });

    describe('validateDateInput', () => {
      it('should return true for valid dates', () => {
        expect(validateDateInput('2025-01-15')).toBe(true);
        expect(validateDateInput('2025-01-15T14:30:00Z')).toBe(true);
      });

      it('should return true for empty strings', () => {
        expect(validateDateInput('')).toBe(true);
        expect(validateDateInput('   ')).toBe(true);
      });

      it('should return false for invalid dates', () => {
        // Mock parseDate to throw
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        expect(validateDateInput('invalid-date')).toBe(false);
      });
    });

    describe('addDaysToDateString', () => {
      it('should add days to date string', () => {
        const result = addDaysToDateString('2025-01-15', 5);
        expect(result).toBe('2025-01-20');
      });

      it('should handle negative days', () => {
        const result = addDaysToDateString('2025-01-15', -5);
        expect(result).toBe('2025-01-10');
      });

      it('should throw on invalid input', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        expect(() => addDaysToDateString('invalid', 5)).toThrow();
      });
    });
  });

  describe('Display Functions', () => {
    describe('formatDateForDisplay', () => {
      it('should format date with default format', () => {
        const result = formatDateForDisplay('2025-01-15');
        expect(result).toBe('Jan 15, 2025');
      });

      it('should format date with custom format', () => {
        const result = formatDateForDisplay('2025-01-15', 'yyyy-MM-dd');
        expect(result).toBe('2025-01-15');
      });

      it('should return original string on format error', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        const result = formatDateForDisplay('invalid');
        expect(result).toBe('invalid');
      });
    });
  });

  describe('Timestamp Functions', () => {
    describe('getCurrentTimestamp', () => {
      it('should return timestamp with timezone info', () => {
        const result = getCurrentTimestamp();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
      });
    });

    describe('getCurrentDateString', () => {
      it('should return current date in YYYY-MM-DD format', () => {
        const result = getCurrentDateString();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('parseTimestamp', () => {
      it('should parse valid timestamps', () => {
        const result = parseTimestamp('2025-01-15T14:30:00Z');
        expect(result).toBeInstanceOf(Date);
      });

      it('should throw for empty timestamp', () => {
        expect(() => parseTimestamp('')).toThrow('Timestamp string cannot be empty');
      });

      it('should throw for invalid timestamp', () => {
        const mockParseISO = require('date-fns').parseISO;
        mockParseISO.mockImplementationOnce(() => new Date('invalid'));
        const mockIsValid = require('date-fns').isValid;
        mockIsValid.mockImplementationOnce(() => false);

        expect(() => parseTimestamp('invalid')).toThrow('Invalid timestamp');
      });
    });

    describe('formatTimestampForDisplay', () => {
      it('should format timestamp for display', () => {
        const result = formatTimestampForDisplay('2025-01-15T14:30:00Z');
        expect(result).toContain('Jan 15, 2025');
      });

      it('should return original on format error', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseTimestamp')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        const result = formatTimestampForDisplay('invalid');
        expect(result).toBe('invalid');
      });
    });
  });

  describe('Time-Aware Functions', () => {
    describe('hasTimeComponent', () => {
      it('should return true for datetime strings', () => {
        expect(hasTimeComponent('2025-01-15T14:30:00')).toBe(true);
        expect(hasTimeComponent('2025-01-15T14:30')).toBe(true);
      });

      it('should return false for date-only strings', () => {
        expect(hasTimeComponent('2025-01-15')).toBe(false);
        expect(hasTimeComponent('')).toBe(false);
      });
    });

    describe('getDatePart', () => {
      it('should extract date part from datetime', () => {
        const result = getDatePart('2025-01-15T14:30:00');
        expect(result).toBe('2025-01-15');
      });

      it('should return empty for empty input', () => {
        expect(getDatePart('')).toBe('');
      });

      it('should return original on error', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        const result = getDatePart('invalid');
        expect(result).toBe('invalid');
      });
    });

    describe('getTimePart', () => {
      it('should extract time part from datetime', () => {
        const result = getTimePart('2025-01-15T14:30:00');
        expect(result).toBe('14:30');
      });

      it('should return null for date-only strings', () => {
        expect(getTimePart('2025-01-15')).toBeNull();
      });

      it('should return null on error', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        const result = getTimePart('invalid');
        expect(result).toBeNull();
      });
    });

    describe('combineDateAndTime', () => {
      it('should combine date and time', () => {
        const result = combineDateAndTime('2025-01-15', '14:30');
        expect(result).toBe('2025-01-15T14:30');
      });

      it('should return date if no time provided', () => {
        expect(combineDateAndTime('2025-01-15', '')).toBe('2025-01-15');
      });

      it('should return empty if no date provided', () => {
        expect(combineDateAndTime('', '14:30')).toBe('');
      });

      it('should handle invalid time format', () => {
        const result = combineDateAndTime('2025-01-15', 'invalid');
        expect(result).toBe('2025-01-15');
      });
    });

    describe('formatDateTimeForDisplay', () => {
      it('should format datetime with default options', () => {
        const result = formatDateTimeForDisplay('2025-01-15T14:30:00');
        expect(result).toContain('Jan 15, 2025');
        expect(result).toContain('2:30 PM');
      });

      it('should format date-only with date format only', () => {
        const result = formatDateTimeForDisplay('2025-01-15', {
          dateFormat: 'yyyy-MM-dd',
          showTime: true
        });
        expect(result).toBe('2025-01-15');
      });

      it('should return empty for time-only request when no time', () => {
        const result = formatDateTimeForDisplay('2025-01-15', {
          dateFormat: '',
          showTime: true
        });
        expect(result).toBe('');
      });

      it('should return time only when dateFormat is empty and has time', () => {
        const result = formatDateTimeForDisplay('2025-01-15T14:30:00', {
          dateFormat: '',
          timeFormat: 'h:mm a',
          showTime: true
        });
        expect(result).toBe('2:30 PM');
      });
    });

    describe('isBeforeDateTimeAware', () => {
      it('should compare dates with time correctly', () => {
        const result = isBeforeDateTimeAware('2025-01-15T14:00:00', '2025-01-15T15:00:00');
        expect(result).toBe(true);
      });

      it('should compare date-only strings correctly', () => {
        const result = isBeforeDateTimeAware('2025-01-14', '2025-01-15');
        expect(result).toBe(true);
      });

      it('should handle mixed datetime and date-only', () => {
        // Date-only treated as end-of-day for sorting
        const result = isBeforeDateTimeAware('2025-01-15T14:00:00', '2025-01-15');
        expect(result).toBe(true); // Time is before end-of-day
      });

      it('should handle comparison errors', () => {
        const result = isBeforeDateTimeAware('invalid', '2025-01-15');
        expect(result).toBe(false);
      });
    });

    describe('isOverdueTimeAware', () => {
      it('should detect overdue datetime', () => {
        // Mock current time
        const originalNow = Date.now;
        Date.now = jest.fn(() => new Date('2025-01-15T16:00:00Z').getTime());

        const result = isOverdueTimeAware('2025-01-15T14:00:00Z');
        expect(result).toBe(true);

        Date.now = originalNow;
      });

      it('should detect overdue date-only', () => {
        const result = isOverdueTimeAware('2020-01-01'); // Past date
        expect(result).toBe(true);
      });

      it('should return false for empty input', () => {
        expect(isOverdueTimeAware('')).toBe(false);
      });

      it('should handle errors gracefully', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        const result = isOverdueTimeAware('invalid');
        expect(result).toBe(false);
      });
    });

    describe('isTodayTimeAware', () => {
      it('should detect today dates', () => {
        const today = new Date().toISOString().split('T')[0];
        const result = isTodayTimeAware(today);
        expect(result).toBe(true);
      });

      it('should return false for empty input', () => {
        expect(isTodayTimeAware('')).toBe(false);
      });

      it('should handle errors gracefully', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        const result = isTodayTimeAware('invalid');
        expect(result).toBe(false);
      });
    });

    describe('validateDateTimeInput', () => {
      it('should validate date and time separately', () => {
        expect(validateDateTimeInput('2025-01-15', '14:30')).toBe(true);
      });

      it('should validate date-only input', () => {
        expect(validateDateTimeInput('2025-01-15')).toBe(true);
      });

      it('should return true for empty date', () => {
        expect(validateDateTimeInput('')).toBe(true);
      });

      it('should reject invalid time format', () => {
        expect(validateDateTimeInput('2025-01-15', 'invalid')).toBe(false);
      });

      it('should handle validation errors', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'validateDateInput')
          .mockImplementationOnce(() => false);

        expect(validateDateTimeInput('invalid')).toBe(false);
      });
    });

    describe('getCurrentDateTimeString', () => {
      it('should return current datetime in YYYY-MM-DDTHH:mm format', () => {
        const result = getCurrentDateTimeString();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      });
    });

    describe('addDaysToDateTime', () => {
      it('should add days to datetime preserving time', () => {
        const result = addDaysToDateTime('2025-01-15T14:30', 5);
        expect(result).toBe('2025-01-20T14:30');
      });

      it('should add days to date-only without adding time', () => {
        const result = addDaysToDateTime('2025-01-15', 5);
        expect(result).toBe('2025-01-20');
      });

      it('should throw on invalid input', () => {
        jest.spyOn(require('../../../src/utils/dateUtils'), 'parseDate')
          .mockImplementationOnce(() => { throw new Error('Parse error'); });

        expect(() => addDaysToDateTime('invalid', 5)).toThrow();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => parseDate(null as any)).toThrow();
      expect(() => parseDate(undefined as any)).toThrow();
    });

    it('should handle very large or small years', () => {
      const futureDate = parseDate('9999-12-31');
      expect(futureDate).toBeInstanceOf(Date);
    });

    it('should handle leap year dates', () => {
      const leapDay = parseDate('2024-02-29');
      expect(leapDay).toBeInstanceOf(Date);
    });

    it('should handle month/day edge cases', () => {
      expect(() => parseDate('2025-13-01')).toThrow(); // Invalid month
      expect(() => parseDate('2025-02-30')).toThrow(); // Invalid day for month
    });

    it('should handle timezone offsets properly', () => {
      const withOffset = parseDate('2025-01-15T14:30:00+05:00');
      expect(withOffset).toBeInstanceOf(Date);
    });

    it('should preserve consistency across utility functions', () => {
      const dateStr = '2025-01-15T14:30:00Z';
      const datePart = getDatePart(dateStr);
      const timePart = getTimePart(dateStr);
      const combined = combineDateAndTime(datePart, timePart!);
      
      expect(datePart).toBe('2025-01-15');
      expect(timePart).toBe('14:30');
      expect(combined).toBe('2025-01-15T14:30');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large date operations efficiently', () => {
      const startTime = Date.now();
      
      // Perform multiple date operations
      for (let i = 0; i < 100; i++) {
        const dateStr = `2025-01-${String(i % 28 + 1).padStart(2, '0')}`;
        parseDate(dateStr);
        formatDateForDisplay(dateStr);
        isToday(dateStr);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should not leak memory with repeated operations', () => {
      // This is hard to test directly, but we can ensure no global state accumulation
      const initialState = Object.keys(global).length;
      
      for (let i = 0; i < 50; i++) {
        parseDate('2025-01-15');
        getCurrentTimestamp();
        getTodayString();
      }
      
      const finalState = Object.keys(global).length;
      expect(finalState).toBe(initialState);
    });
  });
});