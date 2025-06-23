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

// Use improved date-fns mock that behaves more like the real library

describe('DateUtils', () => {
  // Mock current time for deterministic tests
  const FIXED_SYSTEM_TIME = '2025-01-15T12:00:00.000Z';
  
  beforeEach(() => {
    // Set a fixed time for testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date(FIXED_SYSTEM_TIME));
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('parseDate', () => {
    it('should parse simple date strings', () => {
      const result = parseDate('2025-01-15');
      expect(result).toBeInstanceOf(Date);
      // Check that the local date components match, not the UTC string
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January is 0
      expect(result.getDate()).toBe(15);
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
      expect(() => parseDate('invalid-date')).toThrow();
      expect(() => parseDate('not-a-date')).toThrow();
      expect(() => parseDate('2025-99-99')).toThrow();
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
        const result = isSameDateSafe('invalid', '2025-01-15');
        expect(result).toBe(false);
        
        const result2 = isSameDateSafe('2025-01-15', 'invalid');
        expect(result2).toBe(false);
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
        // With our fixed system time, it should be 2025-01-15
        expect(result).toBe('2025-01-15');
      });
    });

    describe('normalizeDateString', () => {
      it('should normalize various date formats to YYYY-MM-DD', () => {
        const result = normalizeDateString('2025-01-15T14:30:00Z');
        expect(result).toBe('2025-01-15');
      });

      it('should return original string on parse error', () => {
        const result = normalizeDateString('invalid-date');
        expect(result).toBe('invalid-date');
        
        const result2 = normalizeDateString('not-a-date');
        expect(result2).toBe('not-a-date');
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
      it('should return true for valid date-only strings', () => {
        expect(validateDateInput('2025-01-15')).toBe(true);
      });
      
      it('should return true for valid ISO datetime strings', () => {
        expect(validateDateInput('2025-01-15T14:30:00Z')).toBe(true);
        expect(validateDateInput('2025-01-15T14:30:00')).toBe(true);
        expect(validateDateInput('2025-01-15T14:30:00+02:00')).toBe(true);
      });

      it('should return true for empty strings', () => {
        expect(validateDateInput('')).toBe(true);
        expect(validateDateInput('   ')).toBe(true);
      });

      it('should return false for invalid dates', () => {
        expect(validateDateInput('invalid-date')).toBe(false);
        expect(validateDateInput('2025-13-01')).toBe(false);
        expect(validateDateInput('not-a-date')).toBe(false);
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
        expect(() => addDaysToDateString('invalid', 5)).toThrow();
        expect(() => addDaysToDateString('not-a-date', 5)).toThrow();
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
        const result = formatDateForDisplay('invalid');
        expect(result).toBe('invalid');
        
        const result2 = formatDateForDisplay('not-a-date');
        expect(result2).toBe('not-a-date');
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
        // With our fixed system time, it should be 2025-01-15
        expect(result).toBe('2025-01-15');
      });
    });

    describe('parseTimestamp', () => {
      it('should parse valid timestamps', () => {
        const result = parseTimestamp('2025-01-15T14:30:00Z');
        expect(result).toBeInstanceOf(Date);
        expect(result.toISOString()).toBe('2025-01-15T14:30:00.000Z');
      });

      it('should throw for empty timestamp', () => {
        expect(() => parseTimestamp('')).toThrow('Timestamp string cannot be empty');
      });

      it('should throw for invalid timestamp', () => {
        expect(() => parseTimestamp('invalid')).toThrow('Invalid timestamp');
        expect(() => parseTimestamp('not-a-timestamp')).toThrow('Invalid timestamp');
      });
    });

    describe('formatTimestampForDisplay', () => {
      it('should format timestamp for display', () => {
        const result = formatTimestampForDisplay('2025-01-15T14:30:00Z');
        // Since this is a UTC timestamp, when displayed in local timezone it may show a different time
        // Just check that it contains the expected date pattern
        expect(result).toMatch(/Jan \d{1,2}, 2025/);
        expect(result).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
      });

      it('should return original on format error', () => {
        const result = formatTimestampForDisplay('invalid');
        expect(result).toBe('invalid');
        
        const result2 = formatTimestampForDisplay('not-a-timestamp');
        expect(result2).toBe('not-a-timestamp');
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
        const result = getDatePart('invalid');
        expect(result).toBe('invalid');
        
        const result2 = getDatePart('not-a-date');
        expect(result2).toBe('not-a-date');
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
        const result = getTimePart('invalid');
        expect(result).toBeNull();
        
        const result2 = getTimePart('not-a-date');
        expect(result2).toBeNull();
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
        // With our fixed system time of 2025-01-15T12:00:00.000Z
        // A time before this should be overdue
        const result = isOverdueTimeAware('2025-01-15T10:00:00Z');
        expect(result).toBe(true);
        
        // A time after this should not be overdue
        const resultFuture = isOverdueTimeAware('2025-01-15T14:00:00Z');
        expect(resultFuture).toBe(false);
      });

      it('should detect overdue date-only', () => {
        const result = isOverdueTimeAware('2020-01-01'); // Past date
        expect(result).toBe(true);
      });

      it('should return false for empty input', () => {
        expect(isOverdueTimeAware('')).toBe(false);
      });

      it('should handle errors gracefully', () => {
        const result = isOverdueTimeAware('invalid');
        expect(result).toBe(false);
        
        const result2 = isOverdueTimeAware('not-a-date');
        expect(result2).toBe(false);
      });
    });

    describe('isTodayTimeAware', () => {
      it('should detect today dates', () => {
        // With our fixed system time, today should be 2025-01-15
        const result = isTodayTimeAware('2025-01-15');
        expect(result).toBe(true);
        
        const resultDateTime = isTodayTimeAware('2025-01-15T14:30:00');
        expect(resultDateTime).toBe(true);
        
        const resultNotToday = isTodayTimeAware('2025-01-16');
        expect(resultNotToday).toBe(false);
      });

      it('should return false for empty input', () => {
        expect(isTodayTimeAware('')).toBe(false);
      });

      it('should handle errors gracefully', () => {
        const result = isTodayTimeAware('invalid');
        expect(result).toBe(false);
        
        const result2 = isTodayTimeAware('not-a-date');
        expect(result2).toBe(false);
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
        expect(validateDateTimeInput('invalid')).toBe(false);
        expect(validateDateTimeInput('not-a-date', '25:00')).toBe(false);
      });
    });

    describe('getCurrentDateTimeString', () => {
      it('should return current datetime in YYYY-MM-DDTHH:mm format', () => {
        const result = getCurrentDateTimeString();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        // With our fixed system time, it should start with 2025-01-15T
        expect(result).toMatch(/^2025-01-15T\d{2}:\d{2}$/);
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
        expect(() => addDaysToDateTime('invalid', 5)).toThrow();
        expect(() => addDaysToDateTime('not-a-date', 5)).toThrow();
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
      expect(() => parseDate('2025-04-31')).toThrow(); // Invalid day for April
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
      
      // Since this is a UTC timestamp, the local date/time extraction may differ
      // Test that the functions are consistent with each other, regardless of timezone
      expect(datePart).toMatch(/2025-01-(15|16)/);
      expect(timePart).toMatch(/\d{2}:\d{2}/);
      expect(combined).toBe(`${datePart}T${timePart}`);
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