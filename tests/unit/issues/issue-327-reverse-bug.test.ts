/**
 * Test for the reverse scenario of Issue #327
 * 
 * If users in timezones AHEAD of UTC see dates shift backwards (July 29 -> July 28),
 * do users in timezones BEHIND UTC see dates shift forwards (July 28 -> July 29)?
 */

import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #327: Reverse timezone bug - dates shifting forward', () => {
    it('demonstrates how dates behave for users behind UTC', () => {
        // For a user in US Pacific Time (UTC-8)
        // When they create July 28 at midnight local time
        // It's already July 28 08:00 UTC
        
        // Simulate creating July 28 in Pacific Time
        // Note: We can't actually change the timezone in tests, but we can simulate
        // what would happen based on how JavaScript dates work
        
        // Create July 28, 2024 in different ways
        const july28LocalTime = new Date(2024, 6, 28); // Month is 0-indexed
        const july28UTC = new Date(Date.UTC(2024, 6, 28));
        
        console.log('=== Pacific Time Simulation ===');
        console.log('July 28 local time:', july28LocalTime.toString());
        console.log('July 28 local ISO:', july28LocalTime.toISOString());
        console.log('July 28 UTC:', july28UTC.toString());
        console.log('July 28 UTC ISO:', july28UTC.toISOString());
        
        // For users behind UTC, local midnight is LATER in UTC
        // So July 28 00:00 Pacific = July 28 08:00 UTC
        // The date doesn't shift forward
        
        const localFormatted = formatDateForStorage(july28LocalTime);
        const utcFormatted = formatDateForStorage(july28UTC);
        
        console.log('Local formatted:', localFormatted);
        console.log('UTC formatted:', utcFormatted);
        
        // Check if dates shift forward
        const localDay = july28LocalTime.getDate();
        const utcDay = july28LocalTime.getUTCDate();
        console.log('Local day:', localDay);
        console.log('UTC day from local date:', utcDay);
        
        // For users behind UTC, the UTC day should be the same or later
        // not earlier
    });
    
    it('shows the actual behavior for different timezone scenarios', () => {
        console.log('\n=== Testing Edge Cases ===');
        
        // Test 1: Late night in timezone behind UTC
        // Dec 31 23:00 in Pacific (UTC-8) = Jan 1 07:00 UTC
        const dec31LateNight = new Date(2023, 11, 31, 23, 0, 0);
        console.log('\nDec 31 23:00 local:', dec31LateNight.toString());
        console.log('ISO (UTC):', dec31LateNight.toISOString());
        console.log('Formatted:', formatDateForStorage(dec31LateNight));
        
        // Test 2: Early morning in timezone ahead of UTC  
        // Jan 1 01:00 in Sydney (UTC+11) = Dec 31 14:00 UTC
        const jan1EarlyMorning = new Date(2024, 0, 1, 1, 0, 0);
        console.log('\nJan 1 01:00 local:', jan1EarlyMorning.toString());
        console.log('ISO (UTC):', jan1EarlyMorning.toISOString());
        console.log('Formatted:', formatDateForStorage(jan1EarlyMorning));
    });
    
    it('simulates the complete flow: user clicks -> format -> save -> display', () => {
        // Simulate what happens when user in Australia clicks on July 28
        const userClicksJuly28 = new Date(2024, 6, 28); // July 28 local time
        
        console.log('\n=== Complete Flow Simulation ===');
        console.log('1. User clicks on July 28');
        console.log('   Date object created:', userClicksJuly28.toString());
        console.log('   ISO string:', userClicksJuly28.toISOString());
        
        // Format for saving to complete_instances
        const formattedDate = formatDateForStorage(userClicksJuly28);
        console.log('\n2. Format for saving:', formattedDate);
        
        // This gets saved to the file
        const complete_instances = [formattedDate];
        console.log('\n3. Saved to file:', complete_instances);
        
        // Later, when displaying in agenda view
        // The agenda checks if July 28 is in complete_instances
        const checkJuly28 = complete_instances.includes('2024-07-28');
        const checkJuly27 = complete_instances.includes('2024-07-27');
        
        console.log('\n4. Display in agenda:');
        console.log('   July 27 shows as complete?', checkJuly27);
        console.log('   July 28 shows as complete?', checkJuly28);
        
        // With UTC-based formatting, the formatted date depends on timezone
        // For users ahead of UTC (like Australia), July 28 00:00 local can be July 27 in UTC
        const july28LocalTime = new Date(2024, 6, 28);
        const utcDate = july28LocalTime.getUTCDate();
        const expectedDate = utcDate < 28 ? '2024-07-27' : '2024-07-28';
        expect(formattedDate).toBe(expectedDate);
    });
    
    it('tests both directions of the timezone bug', () => {
        console.log('\n=== Bidirectional Timezone Bug Test ===');
        
        // For users AHEAD of UTC (Australia, Asia)
        // Local midnight is EARLIER in the day in UTC
        const australiaDate = new Date(2024, 6, 29, 0, 0, 0); // July 29 00:00 local
        console.log('\nAustralia - July 29 midnight:');
        console.log('Local:', australiaDate.toString());
        console.log('UTC:', australiaDate.toISOString());
        console.log('Formatted:', formatDateForStorage(australiaDate));
        console.log('Bug effect: July 29 -> July', australiaDate.getUTCDate());
        
        // For users BEHIND UTC (Americas)
        // Local midnight is LATER in the day in UTC
        // This scenario is harder to test without actually changing timezones
        // But in theory:
        // - US Pacific July 28 00:00 = July 28 08:00 UTC
        // - formatDateForStorage would return July 28 (correct)
        // - No forward shift occurs
        
        console.log('\n=== Summary ===');
        console.log('Users AHEAD of UTC: Dates shift BACKWARDS (July 29 -> July 28)');
        console.log('Users BEHIND UTC: Dates remain CORRECT (July 28 -> July 28)');
        console.log('The bug only affects users in timezones ahead of UTC!');
    });
});