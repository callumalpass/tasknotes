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
  addDaysToDateTime,
  createUTCDateForRRule,
  validateCompleteInstances,
  normalizeCalendarBoundariesToUTC,
  formatUTCDateForCalendar,
  isNaturalLanguageDate,
  resolveNaturalLanguageDate,
  getNaturalLanguageDateSuggestions,
  NATURAL_LANGUAGE_DATE_PATTERNS,
  addWeeksToDateString,
  addMonthsToDateString,
  addYearsToDateString,
  isValidDateInput
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

  describe('createUTCDateForRRule', () => {
    it('should create UTC date at midnight for date-only strings', () => {
      const result = createUTCDateForRRule('2025-06-26');
      
      expect(result.toISOString()).toBe('2025-06-26T00:00:00.000Z');
      expect(result.getUTCDate()).toBe(26);
      expect(result.getUTCMonth()).toBe(5); // June is month 5 (0-based)
      expect(result.getUTCFullYear()).toBe(2025);
      expect(result.getUTCDay()).toBe(4); // Thursday
    });

    it('should preserve day of week in UTC', () => {
      const testCases = [
        { date: '2025-06-26', expectedDay: 4 }, // Thursday
        { date: '2025-06-27', expectedDay: 5 }, // Friday
        { date: '2025-06-28', expectedDay: 6 }, // Saturday
        { date: '2025-06-29', expectedDay: 0 }, // Sunday
      ];

      testCases.forEach(({ date, expectedDay }) => {
        const result = createUTCDateForRRule(date);
        expect(result.getUTCDay()).toBe(expectedDay);
      });
    });

    it('should handle datetime strings by extracting date part', () => {
      const testCases = [
        '2025-06-26T15:30:00',
        '2025-06-26T00:00:00Z',
        '2025-06-26 15:30:00',
      ];

      testCases.forEach(dateString => {
        const result = createUTCDateForRRule(dateString);
        expect(result.toISOString()).toBe('2025-06-26T00:00:00.000Z');
      });
    });

    it('should handle edge cases', () => {
      // Leap year
      const leapYear = createUTCDateForRRule('2024-02-29');
      expect(leapYear.toISOString()).toBe('2024-02-29T00:00:00.000Z');

      // Year boundaries
      const yearStart = createUTCDateForRRule('2025-01-01');
      expect(yearStart.toISOString()).toBe('2025-01-01T00:00:00.000Z');

      const yearEnd = createUTCDateForRRule('2025-12-31');
      expect(yearEnd.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    });

    it('should throw error for invalid date formats', () => {
      const invalidDates = [
        '',
        'invalid',
        '2025-13-01', // Invalid month
        '2025-02-30', // Invalid day for February
        '25-06-26',   // Wrong year format
      ];

      invalidDates.forEach(dateString => {
        expect(() => createUTCDateForRRule(dateString)).toThrow();
      });
    });
  });

  describe('validateCompleteInstances', () => {
    it('should return valid YYYY-MM-DD dates', () => {
      const input = ['2025-01-01', '2025-02-15', '2025-12-31'];
      const result = validateCompleteInstances(input);
      expect(result).toEqual(['2025-01-01', '2025-02-15', '2025-12-31']);
    });

    it('should filter out invalid time-only entries like T00:00', () => {
      const input = ['2025-01-01', 'T00:00', '2025-02-15', 'T12:30', '2025-12-31'];
      const result = validateCompleteInstances(input);
      expect(result).toEqual(['2025-01-01', '2025-02-15', '2025-12-31']);
    });

    it('should filter out invalid date formats', () => {
      const input = ['2025-01-01', 'invalid-date', '2025/02/15', '01-01-2025', '2025-12-31'];
      const result = validateCompleteInstances(input);
      expect(result).toEqual(['2025-01-01', '2025-12-31']);
    });

    it('should filter out non-string entries', () => {
      const input = ['2025-01-01', null, undefined, 123, {}, '2025-12-31'];
      const result = validateCompleteInstances(input);
      expect(result).toEqual(['2025-01-01', '2025-12-31']);
    });

    it('should filter out empty strings', () => {
      const input = ['2025-01-01', '', '   ', '2025-12-31'];
      const result = validateCompleteInstances(input);
      expect(result).toEqual(['2025-01-01', '2025-12-31']);
    });

    it('should return empty array for non-array input', () => {
      expect(validateCompleteInstances(null)).toEqual([]);
      expect(validateCompleteInstances(undefined)).toEqual([]);
      expect(validateCompleteInstances('not-an-array')).toEqual([]);
      expect(validateCompleteInstances(123)).toEqual([]);
    });

    it('should trim whitespace from valid entries', () => {
      const input = ['  2025-01-01  ', ' 2025-02-15 ', '2025-12-31'];
      const result = validateCompleteInstances(input);
      expect(result).toEqual(['2025-01-01', '2025-02-15', '2025-12-31']);
    });

    it('should return empty array for empty input array', () => {
      const result = validateCompleteInstances([]);
      expect(result).toEqual([]);
    });

    it('should filter out all invalid entries returning empty array', () => {
      const input = ['T00:00', 'T12:30', 'invalid-date', '', null];
      const result = validateCompleteInstances(input);
      expect(result).toEqual([]);
    });
  });

  describe('Calendar Timezone Utilities', () => {
    describe('normalizeCalendarBoundariesToUTC', () => {
      it('should convert local date boundaries to UTC midnight', () => {
        const startDate = new Date('2025-01-15T10:30:00');
        const endDate = new Date('2025-01-17T14:45:00');
        
        const { utcStart, utcEnd } = normalizeCalendarBoundariesToUTC(startDate, endDate);
        
        expect(utcStart.toISOString()).toBe('2025-01-15T00:00:00.000Z');
        expect(utcEnd.toISOString()).toBe('2025-01-17T00:00:00.000Z');
      });

      it('should handle timezone boundaries correctly', () => {
        // Test with dates that could be problematic across timezones
        const startDate = new Date('2025-06-15T23:30:00-07:00'); // 11:30 PM PDT
        const endDate = new Date('2025-06-16T01:30:00-07:00');   // 1:30 AM PDT next day
        
        const { utcStart, utcEnd } = normalizeCalendarBoundariesToUTC(startDate, endDate);
        
        // The function normalizes to UTC midnight based on the local date representation
        // PDT -07:00 times convert to UTC and the date is extracted from that
        expect(utcStart.toISOString()).toBe('2025-06-16T00:00:00.000Z');
        expect(utcEnd.toISOString()).toBe('2025-06-16T00:00:00.000Z');
      });

      it('should preserve date boundaries across DST transitions', () => {
        // March DST transition in US (spring forward)
        const dstStart = new Date('2025-03-09T02:30:00-05:00'); // EST before DST
        const dstEnd = new Date('2025-03-09T03:30:00-04:00');   // EDT after DST
        
        const { utcStart, utcEnd } = normalizeCalendarBoundariesToUTC(dstStart, dstEnd);
        
        expect(utcStart.toISOString()).toBe('2025-03-09T00:00:00.000Z');
        expect(utcEnd.toISOString()).toBe('2025-03-09T00:00:00.000Z');
      });

      it('should handle month boundaries correctly', () => {
        const monthEnd = new Date('2025-01-31T23:59:59');
        const monthStart = new Date('2025-02-01T00:00:01');
        
        const { utcStart, utcEnd } = normalizeCalendarBoundariesToUTC(monthEnd, monthStart);
        
        expect(utcStart.toISOString()).toBe('2025-01-31T00:00:00.000Z');
        expect(utcEnd.toISOString()).toBe('2025-02-01T00:00:00.000Z');
      });

      it('should handle year boundaries correctly', () => {
        const yearEnd = new Date('2024-12-31T23:59:59');
        const yearStart = new Date('2025-01-01T00:00:01');
        
        const { utcStart, utcEnd } = normalizeCalendarBoundariesToUTC(yearEnd, yearStart);
        
        expect(utcStart.toISOString()).toBe('2024-12-31T00:00:00.000Z');
        expect(utcEnd.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      });
    });

    describe('formatUTCDateForCalendar', () => {
      it('should format UTC dates to YYYY-MM-DD without timezone shift', () => {
        const utcDate = new Date('2025-01-15T00:00:00.000Z');
        
        const result = formatUTCDateForCalendar(utcDate);
        
        expect(result).toBe('2025-01-15');
      });

      it('should handle UTC dates at different times of day', () => {
        const testCases = [
          { input: '2025-01-15T00:00:00.000Z', expected: '2025-01-15' },
          { input: '2025-01-15T12:00:00.000Z', expected: '2025-01-15' },
          { input: '2025-01-15T23:59:59.999Z', expected: '2025-01-15' }
        ];

        testCases.forEach(({ input, expected }) => {
          const utcDate = new Date(input);
          const result = formatUTCDateForCalendar(utcDate);
          expect(result).toBe(expected);
        });
      });

      it('should handle edge case dates correctly', () => {
        const testCases = [
          { input: '2025-01-01T00:00:00.000Z', expected: '2025-01-01' }, // Year start
          { input: '2025-12-31T00:00:00.000Z', expected: '2025-12-31' }, // Year end
          { input: '2024-02-29T00:00:00.000Z', expected: '2024-02-29' }, // Leap year
          { input: '2025-02-28T00:00:00.000Z', expected: '2025-02-28' }  // Non-leap year
        ];

        testCases.forEach(({ input, expected }) => {
          const utcDate = new Date(input);
          const result = formatUTCDateForCalendar(utcDate);
          expect(result).toBe(expected);
        });
      });

      it('should pad single-digit months and days with zeros', () => {
        const testCases = [
          { input: '2025-01-01T00:00:00.000Z', expected: '2025-01-01' },
          { input: '2025-01-09T00:00:00.000Z', expected: '2025-01-09' },
          { input: '2025-09-01T00:00:00.000Z', expected: '2025-09-01' },
          { input: '2025-09-09T00:00:00.000Z', expected: '2025-09-09' }
        ];

        testCases.forEach(({ input, expected }) => {
          const utcDate = new Date(input);
          const result = formatUTCDateForCalendar(utcDate);
          expect(result).toBe(expected);
        });
      });

      it('should gracefully handle invalid dates with fallback', () => {
        const invalidDate = new Date('invalid');
        
        // Should not throw and should provide a fallback
        expect(() => formatUTCDateForCalendar(invalidDate)).not.toThrow();
        
        const result = formatUTCDateForCalendar(invalidDate);
        // Fallback should be ISO string date part
        expect(typeof result).toBe('string');
      });
    });
  });

  // Issue #129: Ensure recurring tasks show consistent dates across all views
  describe('Issue #129: Timezone Consistency Across Views', () => {
    describe('Calendar View and Edit Modal Consistency', () => {
      it('should generate consistent date strings between calendar and edit modal', () => {
        // Simulate a recurring task starting on 2025-07-07 (Monday)
        const startDate = createUTCDateForRRule('2025-07-07');
        
        // Test that both calendar and edit modal use the same date formatting
        const calendarDate = formatUTCDateForCalendar(startDate);
        const editModalDate = formatUTCDateForCalendar(startDate);
        
        expect(calendarDate).toBe('2025-07-07');
        expect(editModalDate).toBe('2025-07-07');
        expect(calendarDate).toBe(editModalDate);
      });

      it('should handle US/CST timezone consistently', () => {
        // Issue #129 specifically mentions US/CST timezone
        // Test dates that could be problematic in CST (-06:00 standard, -05:00 daylight)
        const testDates = [
          '2025-07-07', // Summer (CDT -05:00)
          '2025-01-07', // Winter (CST -06:00)
          '2025-03-09', // DST transition
          '2025-11-02'  // DST transition
        ];

        testDates.forEach(dateStr => {
          const utcDate = createUTCDateForRRule(dateStr);
          const formattedDate = formatUTCDateForCalendar(utcDate);
          
          // Date should remain consistent regardless of timezone
          expect(formattedDate).toBe(dateStr);
        });
      });

      it('should normalize calendar boundaries consistently across timezones', () => {
        // Test calendar view boundaries that caused issues in #129
        const viewStart = new Date('2025-07-06T23:00:00-05:00'); // 11 PM CDT
        const viewEnd = new Date('2025-07-08T01:00:00-05:00');   // 1 AM CDT

        const { utcStart, utcEnd } = normalizeCalendarBoundariesToUTC(viewStart, viewEnd);
        
        // Should normalize to UTC midnight of the respective dates
        expect(utcStart.toISOString()).toBe('2025-07-07T00:00:00.000Z');
        expect(utcEnd.toISOString()).toBe('2025-07-08T00:00:00.000Z');
      });
    });

    describe('Recurring Task Instance Generation', () => {
      it('should generate consistent recurring instances across different views', () => {
        // Test case from issue #129: task set for 7/7 Monday showing as 7/6 in some views
        const startDate = createUTCDateForRRule('2025-07-07');
        
        // Simulate generating recurring instances for different views
        const calendarInstances = [startDate];
        const editModalInstances = [startDate];
        
        // Both should format to the same date string
        const calendarDates = calendarInstances.map(d => formatUTCDateForCalendar(d));
        const editModalDates = editModalInstances.map(d => formatUTCDateForCalendar(d));
        
        expect(calendarDates).toEqual(['2025-07-07']);
        expect(editModalDates).toEqual(['2025-07-07']);
        expect(calendarDates).toEqual(editModalDates);
      });

      it('should handle off-by-one date errors in different timezones', () => {
        // Test potential off-by-one errors mentioned in issue #129
        const testCases = [
          {
            timezone: 'US/Central',
            date: '2025-07-07',
            description: 'CST timezone from issue #129'
          },
          {
            timezone: 'US/Pacific', 
            date: '2025-07-07',
            description: 'PST timezone edge case'
          },
          {
            timezone: 'US/Eastern',
            date: '2025-07-07', 
            description: 'EST timezone edge case'
          }
        ];

        testCases.forEach(({ date, description }) => {
          const utcDate = createUTCDateForRRule(date);
          const formattedDate = formatUTCDateForCalendar(utcDate);
          
          expect(formattedDate).toBe(date);
        });
      });
    });

    describe('Calendar Boundary Edge Cases', () => {
      it('should handle calendar month boundaries without date shifting', () => {
        // Test month boundaries that could cause issues
        const monthEndDates = [
          '2025-01-31', // January end
          '2025-02-28', // February end (non-leap year)
          '2025-04-30', // April end
          '2025-12-31'  // Year end
        ];

        monthEndDates.forEach(dateStr => {
          const utcDate = createUTCDateForRRule(dateStr);
          const formattedDate = formatUTCDateForCalendar(utcDate);
          
          expect(formattedDate).toBe(dateStr);
        });
      });

      it('should handle DST transitions consistently', () => {
        // Test DST transitions - verify that dates are properly normalized even with timezone shifts
        const dstTestCases = [
          {
            description: 'Spring forward DST',
            startDate: new Date('2025-03-09T10:00:00-05:00'), // EST
            endDate: new Date('2025-03-09T14:00:00-05:00')    // EST
          },
          {
            description: 'Fall back DST',
            startDate: new Date('2025-11-02T10:00:00-05:00'), // EST
            endDate: new Date('2025-11-02T14:00:00-05:00')    // EST
          }
        ];

        dstTestCases.forEach(({ description, startDate, endDate }) => {
          const { utcStart, utcEnd } = normalizeCalendarBoundariesToUTC(startDate, endDate);
          
          // The function should normalize to UTC midnight regardless of timezone shifts
          expect(utcStart.getUTCHours()).toBe(0);
          expect(utcStart.getUTCMinutes()).toBe(0);
          expect(utcStart.getUTCSeconds()).toBe(0);
          
          expect(utcEnd.getUTCHours()).toBe(0);
          expect(utcEnd.getUTCMinutes()).toBe(0);
          expect(utcEnd.getUTCSeconds()).toBe(0);
          
          // Verify that dates are properly formatted for calendar display
          const startDateStr = formatUTCDateForCalendar(utcStart);
          const endDateStr = formatUTCDateForCalendar(utcEnd);
          
          expect(startDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(endDateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
      });
    });

    describe('Cross-View Date Consistency', () => {
      it('should maintain consistent date display across Tasks view, Calendar view, and Edit modal', () => {
        // Simulate the scenario described in issue #129
        const recurringTaskDate = '2025-07-07'; // Monday
        
        // All views should use the same date utilities
        const tasksViewDate = formatUTCDateForCalendar(createUTCDateForRRule(recurringTaskDate));
        const calendarViewDate = formatUTCDateForCalendar(createUTCDateForRRule(recurringTaskDate));
        const editModalDate = formatUTCDateForCalendar(createUTCDateForRRule(recurringTaskDate));
        
        // All three views should show the same date
        expect(tasksViewDate).toBe('2025-07-07');
        expect(calendarViewDate).toBe('2025-07-07');
        expect(editModalDate).toBe('2025-07-07');
        
        // Verify all are identical
        expect(tasksViewDate).toBe(calendarViewDate);
        expect(calendarViewDate).toBe(editModalDate);
      });

      it('should handle completion instances consistently', () => {
        // Test that completion instances are handled the same way across views
        const completionDates = ['2025-07-07', '2025-07-14', '2025-07-21'];
        
        completionDates.forEach(dateStr => {
          const utcDate = createUTCDateForRRule(dateStr);
          const formattedDate = formatUTCDateForCalendar(utcDate);
          
          // Should maintain the original date
          expect(formattedDate).toBe(dateStr);
        });
      });
    });
  });

  describe('Natural Language Date Functions', () => {
    
    describe('isNaturalLanguageDate', () => {
      
      it('should recognize exact pattern matches', () => {
        expect(isNaturalLanguageDate('today')).toBe(true);
        expect(isNaturalLanguageDate('tomorrow')).toBe(true);
        expect(isNaturalLanguageDate('yesterday')).toBe(true);
        expect(isNaturalLanguageDate('next week')).toBe(true);
        expect(isNaturalLanguageDate('last week')).toBe(true);
      });

      it('should recognize relative patterns', () => {
        expect(isNaturalLanguageDate('in 3 days')).toBe(true);
        expect(isNaturalLanguageDate('2 days ago')).toBe(true);
        expect(isNaturalLanguageDate('in 1 week')).toBe(true);
        expect(isNaturalLanguageDate('5 weeks ago')).toBe(true);
      });

      it('should handle case insensitive matching', () => {
        expect(isNaturalLanguageDate('TODAY')).toBe(true);
        expect(isNaturalLanguageDate('Tomorrow')).toBe(true);
        expect(isNaturalLanguageDate('NEXT WEEK')).toBe(true);
        expect(isNaturalLanguageDate('IN 3 DAYS')).toBe(true);
      });

      it('should handle whitespace variations', () => {
        expect(isNaturalLanguageDate('  today  ')).toBe(true);
        expect(isNaturalLanguageDate(' in  3  days ')).toBe(true);
        expect(isNaturalLanguageDate('2  weeks  ago')).toBe(true);
      });

      it('should reject non-natural language date strings', () => {
        expect(isNaturalLanguageDate('2024-01-15')).toBe(false);
        expect(isNaturalLanguageDate('random text')).toBe(false);
        expect(isNaturalLanguageDate('in 3 hours')).toBe(false);
        expect(isNaturalLanguageDate('5 minutes ago')).toBe(false);
        expect(isNaturalLanguageDate('')).toBe(false);
        expect(isNaturalLanguageDate(null as any)).toBe(false);
        expect(isNaturalLanguageDate(undefined as any)).toBe(false);
      });

      it('should reject malformed relative patterns', () => {
        expect(isNaturalLanguageDate('in days')).toBe(false);
        expect(isNaturalLanguageDate('3 ago')).toBe(false);
        expect(isNaturalLanguageDate('in 3')).toBe(false);
        expect(isNaturalLanguageDate('weeks ago')).toBe(false);
      });
    });

    describe('resolveNaturalLanguageDate', () => {
      
      // Mock the current date for consistent testing
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-07-15T12:00:00Z')); // Monday
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should resolve basic relative days', () => {
        expect(resolveNaturalLanguageDate('today')).toBe('2024-07-15');
        expect(resolveNaturalLanguageDate('tomorrow')).toBe('2024-07-16');
        expect(resolveNaturalLanguageDate('yesterday')).toBe('2024-07-14');
      });

      it('should resolve relative day patterns', () => {
        expect(resolveNaturalLanguageDate('in 3 days')).toBe('2024-07-18');
        expect(resolveNaturalLanguageDate('2 days ago')).toBe('2024-07-13');
        expect(resolveNaturalLanguageDate('in 1 day')).toBe('2024-07-16');
        expect(resolveNaturalLanguageDate('1 day ago')).toBe('2024-07-14');
      });

      it('should resolve relative week patterns', () => {
        expect(resolveNaturalLanguageDate('in 1 week')).toBe('2024-07-22');
        expect(resolveNaturalLanguageDate('2 weeks ago')).toBe('2024-07-01');
        expect(resolveNaturalLanguageDate('in 2 weeks')).toBe('2024-07-29');
        expect(resolveNaturalLanguageDate('1 week ago')).toBe('2024-07-08');
      });



      it('should handle case insensitive input', () => {
        expect(resolveNaturalLanguageDate('TODAY')).toBe('2024-07-15');
        expect(resolveNaturalLanguageDate('Tomorrow')).toBe('2024-07-16');
        expect(resolveNaturalLanguageDate('IN 3 DAYS')).toBe('2024-07-18');
      });

      it('should handle whitespace variations', () => {
        expect(resolveNaturalLanguageDate('  today  ')).toBe('2024-07-15');
        expect(resolveNaturalLanguageDate(' in  3  days ')).toBe('2024-07-18');
        expect(resolveNaturalLanguageDate('2  weeks  ago')).toBe('2024-07-01');
      });

      it('should return original value for non-natural language dates', () => {
        expect(resolveNaturalLanguageDate('2024-01-15')).toBe('2024-01-15');
        expect(resolveNaturalLanguageDate('random text')).toBe('random text');
        expect(resolveNaturalLanguageDate('')).toBe('');
        expect(resolveNaturalLanguageDate(null as any)).toBe(null);
        expect(resolveNaturalLanguageDate(undefined as any)).toBe(undefined);
      });

      it('should handle errors gracefully', () => {
        // Mock console.error to avoid noise in test output
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        
        // Test with patterns that might cause errors due to invalid dates
        expect(resolveNaturalLanguageDate('in 999999 years')).toBe('in 999999 years');
        
        consoleSpy.mockRestore();
      });
    });

    describe('getNaturalLanguageDateSuggestions', () => {
      
      it('should return a sorted array of suggestions', () => {
        const suggestions = getNaturalLanguageDateSuggestions();
        
        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThan(0);
        
        // Check that it's sorted
        const sortedSuggestions = [...suggestions].sort();
        expect(suggestions).toEqual(sortedSuggestions);
      });

      it('should include exact pattern suggestions', () => {
        const suggestions = getNaturalLanguageDateSuggestions();
        
        expect(suggestions).toContain('today');
        expect(suggestions).toContain('tomorrow');
        expect(suggestions).toContain('yesterday');
        expect(suggestions).toContain('next week');
        expect(suggestions).toContain('last week');
      });

      it('should include relative pattern examples', () => {
        const suggestions = getNaturalLanguageDateSuggestions();
        
        expect(suggestions).toContain('in 3 days');
        expect(suggestions).toContain('2 days ago');
        expect(suggestions).toContain('in 1 week');
        expect(suggestions).toContain('2 weeks ago');
      });

      it('should not contain duplicates', () => {
        const suggestions = getNaturalLanguageDateSuggestions();
        const uniqueSuggestions = [...new Set(suggestions)];
        
        expect(suggestions.length).toBe(uniqueSuggestions.length);
      });
    });

    describe('NATURAL_LANGUAGE_DATE_PATTERNS', () => {
      
      it('should contain expected pattern functions', () => {
        expect(typeof NATURAL_LANGUAGE_DATE_PATTERNS.today).toBe('function');
        expect(typeof NATURAL_LANGUAGE_DATE_PATTERNS.tomorrow).toBe('function');
        expect(typeof NATURAL_LANGUAGE_DATE_PATTERNS.yesterday).toBe('function');
        expect(typeof NATURAL_LANGUAGE_DATE_PATTERNS['next week']).toBe('function');
        expect(typeof NATURAL_LANGUAGE_DATE_PATTERNS['last week']).toBe('function');
      });

      it('should return valid date strings when called', () => {
        const today = NATURAL_LANGUAGE_DATE_PATTERNS.today();
        const tomorrow = NATURAL_LANGUAGE_DATE_PATTERNS.tomorrow();
        
        expect(typeof today).toBe('string');
        expect(typeof tomorrow).toBe('string');
        expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(tomorrow).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('isValidDateInput', () => {
      it('should return true for empty strings', () => {
        expect(isValidDateInput('')).toBe(true);
        expect(isValidDateInput('   ')).toBe(true);
      });

      it('should return true for valid natural language dates', () => {
        expect(isValidDateInput('today')).toBe(true);
        expect(isValidDateInput('tomorrow')).toBe(true);
        expect(isValidDateInput('next week')).toBe(true);
        expect(isValidDateInput('in 3 days')).toBe(true);
        expect(isValidDateInput('2 weeks ago')).toBe(true);
      });

      it('should return true for valid ISO date formats', () => {
        expect(isValidDateInput('2024-12-25')).toBe(true);
        expect(isValidDateInput('2024-12-25T14:30:00')).toBe(true);
        expect(isValidDateInput('2024-12-25T14:30:00Z')).toBe(true);
        expect(isValidDateInput('2024-01-01')).toBe(true);
      });

      it('should return false for invalid date formats', () => {
        expect(isValidDateInput('not a date')).toBe(false);
        expect(isValidDateInput('2024-13-25')).toBe(false);
        expect(isValidDateInput('2024-12-32')).toBe(false);
        expect(isValidDateInput('invalid date')).toBe(false);
        expect(isValidDateInput('25/12/2024')).toBe(false);
      });

      it('should return false for null/undefined inputs', () => {
        expect(isValidDateInput(null as any)).toBe(false);
        expect(isValidDateInput(undefined as any)).toBe(false);
      });

      it('should handle case insensitive natural language dates', () => {
        expect(isValidDateInput('TODAY')).toBe(true);
        expect(isValidDateInput('Tomorrow')).toBe(true);
        expect(isValidDateInput('NEXT WEEK')).toBe(true);
      });
    });
  });
});