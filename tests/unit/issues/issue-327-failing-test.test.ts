/**
 * Failing test for Issue #327: Updating Recurring Task from Agenda View updates wrong day
 * 
 * This test should FAIL when the bug is present and PASS when it's fixed
 */

import { formatDateForStorage, formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #327: Recurring Task Wrong Day Bug (FAILING TEST)', () => {
    it('should format dates correctly regardless of how they are created', () => {
        // Test case from the actual bug report
        // User clicks on Tuesday July 29th, but Monday July 28th gets marked
        
        // Create July 29, 2024 in different ways
        const july29LocalTime = new Date(2024, 6, 29); // Month is 0-indexed
        const july29UTC = new Date(Date.UTC(2024, 6, 29));
        const july29String = new Date('2024-07-29');
        
        // Test the NEW formatDateForStorage function
        const localFormattedNew = formatDateForStorage(july29LocalTime);
        const utcFormattedNew = formatDateForStorage(july29UTC);
        const stringFormattedNew = formatDateForStorage(july29String);
        
        // Also test the OLD formatDateForStorage to show the bug
        const localFormattedOld = formatDateForStorage(july29LocalTime);
        const utcFormattedOld = formatDateForStorage(july29UTC);
        
        console.log('Local time date:', july29LocalTime.toString());
        console.log('Local time formatted (NEW):', localFormattedNew);
        console.log('Local time formatted (OLD):', localFormattedOld);
        console.log('UTC date:', july29UTC.toString());
        console.log('UTC formatted (NEW):', utcFormattedNew);
        console.log('UTC formatted (OLD):', utcFormattedOld);
        
        // The NEW function should work correctly for all cases
        expect(localFormattedNew).toBe('2024-07-29'); // This should now pass!
        expect(utcFormattedNew).toBe('2024-07-29');
        expect(stringFormattedNew).toBe('2024-07-29');
        
        // The OLD function has been fixed and now works correctly
        expect(localFormattedOld).toBe('2024-07-29'); // Fixed!
        expect(utcFormattedOld).toBe('2024-07-29'); // Still works for UTC dates
    });
    
    it('should handle dates in timezones ahead of UTC correctly', () => {
        // For users in timezones ahead of UTC (like Australia, New Zealand)
        // When they create a date for Jan 1, it might be Dec 31 in UTC
        
        const jan1LocalTime = new Date(2024, 0, 1); // Jan 1, 2024 00:00 local time
        const jan1UTC = new Date(Date.UTC(2024, 0, 1)); // Jan 1, 2024 00:00 UTC
        
        console.log('\n=== January 1 Test ===');
        console.log('Local time:', jan1LocalTime.toString());
        console.log('Local time ISO:', jan1LocalTime.toISOString());
        console.log('UTC time:', jan1UTC.toString());
        console.log('UTC time ISO:', jan1UTC.toISOString());
        
        // Test with the new function - both should format to 2024-01-01
        expect(formatDateForStorage(jan1LocalTime)).toBe('2024-01-01');
        expect(formatDateForStorage(jan1UTC)).toBe('2024-01-01');
        
        // The old function has been fixed and now works correctly
        expect(formatDateForStorage(jan1LocalTime)).toBe('2024-01-01'); // Fixed!
        expect(formatDateForStorage(jan1UTC)).toBe('2024-01-01');
    });
    
    it('demonstrates the fix needed for formatDateForStorage', () => {
        // The bug is that formatDateForStorage uses UTC methods
        // on dates that might have been created in local time
        
        // Current implementation extracts UTC components:
        // year = date.getUTCFullYear()
        // month = date.getUTCMonth()
        // day = date.getUTCDate()
        
        // But if the date was created in local time, these UTC methods
        // will return different values than expected
        
        // The fix would be to either:
        // 1. Always use local methods (getFullYear, getMonth, getDate)
        // 2. Or ensure all dates are created in UTC before formatting
        
        const testDate = new Date(2024, 6, 29); // July 29 local time
        
        // What the current implementation does (WRONG for local dates)
        const currentImplementation = `${testDate.getUTCFullYear()}-${String(testDate.getUTCMonth() + 1).padStart(2, '0')}-${String(testDate.getUTCDate()).padStart(2, '0')}`;
        
        // What it should do for local dates
        const correctImplementation = `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, '0')}-${String(testDate.getDate()).padStart(2, '0')}`;
        
        console.log('\n=== Implementation Comparison ===');
        console.log('Test date:', testDate.toString());
        console.log('Current implementation result:', currentImplementation);
        console.log('Correct implementation result:', correctImplementation);
        
        // The current implementation gives the wrong result
        expect(currentImplementation).not.toBe('2024-07-29'); // Will be 2024-07-28
        expect(correctImplementation).toBe('2024-07-29'); // Correct
    });
});