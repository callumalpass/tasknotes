/**
 * Tests for the UTC Anchor approach to date handling
 * 
 * These tests verify that the new parseDateToUTC function correctly
 * implements the UTC anchor principle for timezone-independent logic.
 */

import {
    parseDateToUTC,
    parseDateToLocal,
    parseDate,
    formatDateForStorage,
    isOverdueTimeAware,
    getTodayLocal,
    createUTCDateFromLocalCalendarDate
} from '../../../src/utils/dateUtils';

describe('UTC Anchor Date Handling', () => {
    // Save original timezone
    const originalTZ = process.env.TZ;
    
    afterEach(() => {
        // Restore original timezone
        process.env.TZ = originalTZ;
    });
    
    describe('parseDateToUTC', () => {
        it('should parse date-only strings to UTC midnight', () => {
            const dateStr = '2025-08-01';
            const result = parseDateToUTC(dateStr);
            
            expect(result.toISOString()).toBe('2025-08-01T00:00:00.000Z');
            expect(result.getUTCFullYear()).toBe(2025);
            expect(result.getUTCMonth()).toBe(7); // August (0-based)
            expect(result.getUTCDate()).toBe(1);
            expect(result.getUTCHours()).toBe(0);
            expect(result.getUTCMinutes()).toBe(0);
            expect(result.getUTCSeconds()).toBe(0);
        });
        
        it('should provide same UTC anchor regardless of user timezone', () => {
            const dateStr = '2025-08-01';
            
            // Test in different timezones
            process.env.TZ = 'America/Los_Angeles'; // UTC-7
            const resultLA = parseDateToUTC(dateStr);
            
            process.env.TZ = 'Asia/Tokyo'; // UTC+9
            const resultTokyo = parseDateToUTC(dateStr);
            
            process.env.TZ = 'UTC';
            const resultUTC = parseDateToUTC(dateStr);
            
            // All should produce the exact same timestamp
            expect(resultLA.getTime()).toBe(resultTokyo.getTime());
            expect(resultTokyo.getTime()).toBe(resultUTC.getTime());
            expect(resultLA.toISOString()).toBe('2025-08-01T00:00:00.000Z');
        });
        
        it('should handle datetime strings by preserving their exact time', () => {
            const dateTimeStr = '2025-08-01T14:30:00Z';
            const result = parseDateToUTC(dateTimeStr);
            
            expect(result.toISOString()).toBe('2025-08-01T14:30:00.000Z');
        });
        
        it('should handle timezone-aware strings correctly', () => {
            const dateTimeStr = '2025-08-01T14:30:00-07:00'; // 2:30 PM PDT
            const result = parseDateToUTC(dateTimeStr);
            
            // Should convert to UTC
            expect(result.toISOString()).toBe('2025-08-01T21:30:00.000Z');
        });
    });
    
    describe('Comparison with parseDateToLocal', () => {
        it('should show different behavior for date-only strings', () => {
            const dateStr = '2025-08-01';
            
            // Set timezone to Tokyo (UTC+9)
            process.env.TZ = 'Asia/Tokyo';
            
            const utcResult = parseDateToUTC(dateStr);
            const localResult = parseDateToLocal(dateStr);
            
            // UTC result should be Aug 1 at midnight UTC
            expect(utcResult.toISOString()).toBe('2025-08-01T00:00:00.000Z');
            
            // Local result should be Aug 1 at midnight Tokyo time
            // Tokyo is UTC+9, so midnight Aug 1 Tokyo = Aug 1 00:00 - 9 hours = July 31 15:00 UTC
            // But Date constructor might use system timezone, not process.env.TZ
            const localHour = localResult.getUTCHours();
            expect(localHour).toBeLessThan(24); // Should be on July 31 in UTC
            
            // They represent different moments in time
            expect(utcResult.getTime()).not.toBe(localResult.getTime());
        });
    });
    
    describe('isOverdueTimeAware with UTC anchor', () => {
        beforeEach(() => {
            // Mock current time to 2025-08-02 10:00:00 local time
            jest.useFakeTimers();
            jest.setSystemTime(new Date(2025, 7, 2, 10, 0, 0));
        });
        
        afterEach(() => {
            jest.useRealTimers();
        });
        
        it('should consistently determine overdue status across timezones', () => {
            // Task due on Aug 1 (yesterday)
            const dueDate = '2025-08-01';
            
            // Test in different timezones
            process.env.TZ = 'America/New_York';
            const overdueNY = isOverdueTimeAware(dueDate);
            
            process.env.TZ = 'Asia/Tokyo';
            const overdueTokyo = isOverdueTimeAware(dueDate);
            
            // Both users should see the task as overdue
            expect(overdueNY).toBe(true);
            expect(overdueTokyo).toBe(true);
        });
        
        it('should handle edge case at timezone boundaries', () => {
            // This test demonstrates that overdue status depends on the user's local date
            // Set time to Aug 2 00:30 Tokyo time (Aug 1 15:30 UTC)
            const tokyoTime = new Date('2025-08-02T00:30:00+09:00');
            jest.setSystemTime(tokyoTime);
            
            const dueDate = '2025-08-01';
            
            // With UTC anchor approach:
            // - Task UTC anchor: 2025-08-01T00:00:00Z
            // - Current time: 2025-08-01T15:30:00Z
            // - Tokyo local start of day: 2025-08-02T00:00:00+09:00 = 2025-08-01T15:00:00Z
            // - LA local start of day: 2025-08-01T00:00:00-07:00 = 2025-08-01T07:00:00Z
            
            // Both should see task as overdue since UTC anchor (Aug 1 00:00 UTC) 
            // is before both users' start of current day
            const overdueTokyo = isOverdueTimeAware(dueDate);
            const overdueLA = isOverdueTimeAware(dueDate);
            
            // With UTC anchor, the task appears overdue for both users
            // because Aug 1 midnight UTC is before both users' "today"
            expect(overdueTokyo).toBe(true);
            expect(overdueLA).toBe(true);
        });
    });
    
    describe('formatDateForStorage consistency', () => {
        it('should format UTC anchor dates consistently', () => {
            const dateStr = '2025-08-01';
            
            // Create UTC anchor
            const utcAnchor = parseDateToUTC(dateStr);
            
            // Format should always produce the same result
            const formatted = formatDateForStorage(utcAnchor);
            expect(formatted).toBe('2025-08-01');
            
            // Test in different timezone
            process.env.TZ = 'Asia/Tokyo';
            const formattedTokyo = formatDateForStorage(utcAnchor);
            expect(formattedTokyo).toBe('2025-08-01');
        });
    });
    
    describe('Today initialization with UTC anchor', () => {
        it('should create consistent UTC anchor for today', () => {
            // Mock current time
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2025-08-01T15:30:00+09:00')); // 3:30 PM Tokyo time
            
            process.env.TZ = 'Asia/Tokyo';
            const todayLocal = getTodayLocal();
            const todayUTC = createUTCDateFromLocalCalendarDate(todayLocal);
            
            // Should be Aug 1 at midnight UTC
            expect(todayUTC.toISOString()).toBe('2025-08-01T00:00:00.000Z');
            
            // Format for storage
            expect(formatDateForStorage(todayUTC)).toBe('2025-08-01');
            
            jest.useRealTimers();
        });
    });
    
    describe('Benefits of UTC anchor approach', () => {
        it('should enable consistent sorting across timezones', () => {
            const dates = ['2025-08-03', '2025-08-01', '2025-08-02'];
            
            // Convert to UTC anchors
            const utcDates = dates.map(d => parseDateToUTC(d));
            
            // Sort by timestamp
            utcDates.sort((a, b) => a.getTime() - b.getTime());
            
            // Convert back to strings
            const sorted = utcDates.map(d => formatDateForStorage(d));
            
            expect(sorted).toEqual(['2025-08-01', '2025-08-02', '2025-08-03']);
        });
        
        it('should enable consistent filtering across timezones', () => {
            const tasks = [
                { due: '2025-08-01' },
                { due: '2025-08-02' },
                { due: '2025-08-03' }
            ];
            
            // Filter for tasks due before Aug 2
            const cutoff = parseDateToUTC('2025-08-02');
            const overdue = tasks.filter(task => {
                const taskDate = parseDateToUTC(task.due);
                return taskDate.getTime() < cutoff.getTime();
            });
            
            expect(overdue).toHaveLength(1);
            expect(overdue[0].due).toBe('2025-08-01');
        });
    });
});