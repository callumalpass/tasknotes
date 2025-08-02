/**
 * Test to simulate the timezone issue in Issue #327
 * This test demonstrates how date handling can go wrong when the agenda view
 * creates dates vs when the toggle function formats them
 */

import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #327: Timezone Date Handling Simulation', () => {
    it('demonstrates potential date mismatch between agenda view and toggle function', () => {
        // Simulate what happens in AgendaView.getAgendaDates()
        // Let's say the user is viewing Jan 17, 2024 in their local timezone
        const viewDate = new Date(2024, 0, 17); // Jan 17, 2024 in local time
        
        // AgendaView normalizes dates like this:
        const normalizedDate = new Date(Date.UTC(
            viewDate.getFullYear(),
            viewDate.getMonth(),
            viewDate.getDate()
        ));
        
        console.log('=== Agenda View Date Creation ===');
        console.log('View date (local):', viewDate.toString());
        console.log('View date (ISO):', viewDate.toISOString());
        console.log('Normalized date (ISO):', normalizedDate.toISOString());
        console.log('Normalized date formatted:', formatDateForStorage(normalizedDate));
        
        // Now simulate what might happen if the date is passed differently
        // For example, if the date is serialized and deserialized
        const dateString = normalizedDate.toISOString();
        const reconstructedDate = new Date(dateString);
        
        console.log('\n=== Date Reconstruction ===');
        console.log('Serialized:', dateString);
        console.log('Reconstructed:', reconstructedDate.toString());
        console.log('Reconstructed formatted:', formatDateForStorage(reconstructedDate));
        
        // Test edge case: what if the date is created from a date-only string?
        const dateOnlyString = '2024-01-17';
        const dateFromString = new Date(dateOnlyString);
        
        console.log('\n=== Date from String ===');
        console.log('Date string:', dateOnlyString);
        console.log('Created date:', dateFromString.toString());
        console.log('Created date (ISO):', dateFromString.toISOString());
        console.log('Formatted:', formatDateForStorage(dateFromString));
        
        // The bug might occur if different parts of the code create dates differently
        expect(formatDateForStorage(normalizedDate)).toBe('2024-01-17');
        expect(formatDateForStorage(reconstructedDate)).toBe('2024-01-17');
        expect(formatDateForStorage(dateFromString)).toBe('2024-01-17');
    });
    
    it('shows how timezone differences can cause date shifts', () => {
        // Create a date that's late at night in a timezone behind UTC
        // For example, 11 PM on Jan 16 in US Pacific (UTC-8)
        // This would be 7 AM on Jan 17 in UTC
        
        // Simulate creating a date in Pacific Time
        // When it's Jan 16 23:00 Pacific, it's Jan 17 07:00 UTC
        const pacificDate = new Date('2024-01-16T23:00:00-08:00');
        
        console.log('\n=== Pacific Time Example ===');
        console.log('Pacific date string:', '2024-01-16T23:00:00-08:00');
        console.log('Pacific date (local):', pacificDate.toString());
        console.log('Pacific date (ISO):', pacificDate.toISOString());
        console.log('UTC formatted:', formatDateForStorage(pacificDate));
        
        // The UTC date is Jan 17, but the local date was Jan 16
        expect(formatDateForStorage(pacificDate)).toBe('2024-01-17');
        
        // Now create the same moment using Date.UTC
        const utcDate = new Date(Date.UTC(2024, 0, 17, 7, 0, 0));
        console.log('UTC date (ISO):', utcDate.toISOString());
        console.log('UTC formatted:', formatDateForStorage(utcDate));
        
        expect(pacificDate.getTime()).toBe(utcDate.getTime()); // Same moment in time
        expect(formatDateForStorage(utcDate)).toBe('2024-01-17');
    });
    
    it('simulates the exact bug scenario from issue #327', () => {
        // From the issue: "I have a recurring task in Agenda View... 
        // And when I click on it, it updates for the wrong day"
        
        // The agenda view shows tasks for specific calendar days
        // When user clicks on a task for "Tuesday July 29th"
        // The system might mark "Monday July 28th" as complete instead
        
        // This suggests the date is shifting backwards by one day
        // This typically happens when:
        // 1. The date is created in local time (e.g., July 29 00:00 local)
        // 2. But interpreted as UTC (which might be July 28 if user is behind UTC)
        
        // Simulate July 29, 2024 (a Monday)
        const localJuly29 = new Date(2024, 6, 29); // Month is 0-indexed, so 6 = July
        
        console.log('\n=== July 29 Example (Issue #327) ===');
        console.log('Local July 29:', localJuly29.toString());
        console.log('Local July 29 (ISO):', localJuly29.toISOString());
        
        // If user is in a timezone behind UTC (like US timezones)
        // The ISO string might show July 28
        const localHour = localJuly29.getHours();
        const utcHour = localJuly29.getUTCHours();
        const hourDiff = localHour - utcHour;
        
        console.log('Local hour:', localHour);
        console.log('UTC hour:', utcHour);
        console.log('Hour difference:', hourDiff);
        
        // Check if the date shifted
        const localDay = localJuly29.getDate();
        const utcDay = localJuly29.getUTCDate();
        
        console.log('Local day:', localDay);
        console.log('UTC day:', utcDay);
        console.log('Days match:', localDay === utcDay);
        
        // Format using the calendar formatter
        console.log('Formatted for calendar:', formatDateForStorage(localJuly29));
        
        // The bug occurs when formatDateForStorage returns a different day
        // than what the user clicked on
    });
});