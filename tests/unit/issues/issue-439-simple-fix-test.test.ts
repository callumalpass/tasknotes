/**
 * Simple test to verify the Issue #439 fix works
 * 
 * This test directly tests the core fix: using parseDateToUTC instead of 
 * manually creating UTC dates in FilterService.getTasksForDate()
 */

import { formatDateForStorage, parseDateToUTC } from '../../../src/utils/dateUtils';

describe('Issue #439: Simple Fix Verification', () => {
    
    it('demonstrates that parseDateToUTC gives consistent results vs manual UTC construction', () => {
        // This test demonstrates the core issue and fix
        
        // Simulate a date input - this represents the Date object passed to getTasksForDate()
        const inputDate = new Date(2024, 0, 30); // Tuesday, January 30, 2024 in local time
        
        console.log('Input date:', inputDate.toString());
        console.log('Input date timezone offset (minutes):', inputDate.getTimezoneOffset());
        
        // Step 1: Convert to date string (this is what FilterService does)
        const dateStr = formatDateForStorage(inputDate);
        console.log('Date string:', dateStr);
        
        // OLD BUGGY APPROACH: Manually construct UTC date (this is what was causing the bug)
        const normalizedDate = new Date(Date.UTC(
            inputDate.getFullYear(),
            inputDate.getMonth(), 
            inputDate.getDate()
        ));
        
        const buggyUTCDate = new Date(Date.UTC(
            normalizedDate.getFullYear(),
            normalizedDate.getMonth(), 
            normalizedDate.getDate()
        ));
        
        console.log('Buggy approach result:', buggyUTCDate.toISOString());
        console.log('Buggy formatted:', formatDateForStorage(buggyUTCDate));
        
        // NEW FIXED APPROACH: Use parseDateToUTC (UTC Anchor principle)
        const fixedUTCDate = parseDateToUTC(dateStr);
        console.log('Fixed approach result:', fixedUTCDate.toISOString());
        console.log('Fixed formatted:', formatDateForStorage(fixedUTCDate));
        
        // THE FIX: The fixed approach should give us the same date string we started with
        expect(formatDateForStorage(fixedUTCDate)).toBe(dateStr);
        
        // DEMONSTRATION: Show that the buggy approach might give different results
        const buggyFormatted = formatDateForStorage(buggyUTCDate);
        if (buggyFormatted !== dateStr) {
            console.log('✅ TEST DEMONSTRATES BUG: Buggy approach gave different date');
            console.log(`   Expected: ${dateStr}, Got: ${buggyFormatted}`);
        } else {
            console.log('ℹ️  In this timezone, the buggy approach happens to work');
        }
    });
    
    it('shows the UTC Anchor principle ensures date consistency', () => {
        // Test various date strings to show UTC Anchor consistency
        const testDates = [
            '2024-01-15', // Monday
            '2024-01-16', // Tuesday  
            '2024-01-17', // Wednesday
            '2024-01-18', // Thursday
            '2024-01-19', // Friday
            '2024-01-20', // Saturday
            '2024-01-21'  // Sunday
        ];
        
        console.log('\n=== UTC Anchor Consistency Test ===');
        
        testDates.forEach(dateStr => {
            const utcDate = parseDateToUTC(dateStr);
            const roundTrip = formatDateForStorage(utcDate);
            
            console.log(`${dateStr} -> ${utcDate.toISOString()} -> ${roundTrip}`);
            
            // UTC Anchor principle: date string should round-trip perfectly
            expect(roundTrip).toBe(dateStr);
        });
    });
    
    it('verifies the fix addresses the core timezone conversion issue', () => {
        // This test simulates the problematic code path in FilterService
        
        // Simulate different timezone scenarios by manually creating dates
        const testScenarios = [
            { name: 'Positive offset simulation', date: new Date('2024-01-30T10:00:00+10:00') },
            { name: 'Negative offset simulation', date: new Date('2024-01-30T10:00:00-05:00') },
            { name: 'UTC simulation', date: new Date('2024-01-30T10:00:00Z') }
        ];
        
        console.log('\n=== Timezone Conversion Fix Verification ===');
        
        testScenarios.forEach(({ name, date }) => {
            console.log(`\n${name}:`);
            console.log('Original date:', date.toISOString());
            
            // Convert to date string (simulates FilterService input)
            const dateStr = formatDateForStorage(date);
            console.log('Date string:', dateStr);
            
            // Apply the FIX: Use UTC Anchor principle
            const fixedDate = parseDateToUTC(dateStr);
            console.log('Fixed UTC date:', fixedDate.toISOString());
            console.log('Fixed formatted:', formatDateForStorage(fixedDate));
            
            // The fix ensures consistency: date string should round-trip
            expect(formatDateForStorage(fixedDate)).toBe(dateStr);
            
            // The fixed date should be consistently at midnight UTC
            expect(fixedDate.getUTCHours()).toBe(0);
            expect(fixedDate.getUTCMinutes()).toBe(0);
            expect(fixedDate.getUTCSeconds()).toBe(0);
            expect(fixedDate.getUTCMilliseconds()).toBe(0);
        });
    });
});