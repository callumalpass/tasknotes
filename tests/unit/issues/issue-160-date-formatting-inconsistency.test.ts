/**
 * Test for Issue #160: Date formatting inconsistency between calendar and completion logic
 * 
 * The bug occurs because:
 * 1. Completion calendar uses formatDateForStorage() (UTC methods)
 * 2. "Mark as completed" uses format() from date-fns (local timezone)
 * 
 * This causes off-by-one issues when timezone offsets affect date interpretation
 */

import { format } from 'date-fns';
import { formatDateForStorage } from '../../../src/utils/dateUtils';

describe('Issue #160: Date formatting inconsistency', () => {
  it('should show how calendar dates and completion dates can be off by one', () => {
    // Simulate a Friday in January 2024
    const fridayDate = new Date('2024-01-12T00:00:00.000Z'); // Friday UTC
    
    console.log('=== Date Formatting Inconsistency Test ===');
    console.log('Original date:', fridayDate.toISOString());
    console.log('Day of week (UTC):', fridayDate.getUTCDay()); // Should be 5 (Friday)
    
    // Method 1: How completion calendar formats dates (UTC)
    const calendarDateStr = formatDateForStorage(fridayDate);
    console.log('Calendar formatting (UTC):', calendarDateStr);
    
    // Method 2: How "Mark as completed" formats dates (local timezone)
    const completionDateStr = format(fridayDate, 'yyyy-MM-dd');
    console.log('Completion formatting (local):', completionDateStr);
    
    // Check if they're different
    if (calendarDateStr !== completionDateStr) {
      console.log('🐛 BUG FOUND: Date formatting inconsistency!');
      console.log('  Calendar shows:', calendarDateStr);
      console.log('  Completion records:', completionDateStr);
    } else {
      console.log('✅ No inconsistency found');
    }
    
    // Test with a local timezone date (as might come from date-fns)
    console.log('\n=== Testing with local timezone date ===');
    const localDate = new Date(2024, 0, 12, 0, 0, 0); // January 12, 2024 in local timezone
    console.log('Local date:', localDate.toISOString());
    console.log('Local day of week:', localDate.getDay());
    
    const calendarFromLocal = formatDateForStorage(localDate);
    const completionFromLocal = format(localDate, 'yyyy-MM-dd');
    
    console.log('Calendar formatting from local:', calendarFromLocal);
    console.log('Completion formatting from local:', completionFromLocal);
    
    if (calendarFromLocal !== completionFromLocal) {
      console.log('🐛 BUG FOUND: Local date formatting inconsistency!');
    } else {
      console.log('✅ Local dates consistent');
    }
    
    // The test doesn't assert - it just demonstrates the issue
    // In a real scenario, the timezone offset could cause these to be different
  });

  it('should reproduce the specific off-by-one scenario', () => {
    console.log('\n=== Reproducing Off-by-One Scenario ===');
    
    // Simulate what happens in the completion calendar vs mark as completed
    const testDate = new Date('2024-01-12'); // This creates a local timezone date
    
    console.log('Test date:', testDate.toISOString());
    console.log('Local day of week:', testDate.getDay());
    console.log('UTC day of week:', testDate.getUTCDay());
    
    // What the calendar would show (treating as UTC)
    const calendarDay = formatDateForStorage(testDate);
    
    // What "mark as completed" would record (using local timezone)
    const completionDay = format(testDate, 'yyyy-MM-dd');
    
    console.log('Calendar would highlight:', calendarDay);
    console.log('Completion would record:', completionDay);
    
    // In certain timezones, these could be different dates!
    if (calendarDay !== completionDay) {
      console.log('🐛 OFF-BY-ONE BUG: Different dates!');
      console.log('  This explains why Friday tasks appear on Saturday');
      console.log('  The calendar and completion logic use different dates');
    }
  });

  it('should show the timezone offset effect', () => {
    console.log('\n=== Timezone Offset Effect ===');
    
    // Create a date at the boundary where timezone offset matters
    const boundaryDate = new Date('2024-01-12T00:00:00.000Z'); // Midnight UTC
    
    // Simulate different timezone interpretations
    console.log('UTC interpretation:');
    console.log('  Date:', boundaryDate.toISOString());
    console.log('  Day of week:', boundaryDate.getUTCDay());
    console.log('  Formatted (UTC):', formatDateForStorage(boundaryDate));
    
    console.log('Local interpretation:');
    console.log('  Local string:', boundaryDate.toLocaleString());
    console.log('  Local day of week:', boundaryDate.getDay());
    console.log('  Formatted (local):', format(boundaryDate, 'yyyy-MM-dd'));
    
    // Show current timezone offset
    const offset = boundaryDate.getTimezoneOffset();
    console.log('Current timezone offset (minutes):', offset);
    console.log('Hours behind UTC:', offset / 60);
    
    if (offset > 0) {
      console.log('⚠️  Negative timezone offset detected - this can cause off-by-one issues');
    }
  });
});