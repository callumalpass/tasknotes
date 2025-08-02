/**
 * Test for TaskEditModal Calendar Off-by-One Bug (GitHub discussion #237)
 * 
 * This test specifically targets the calendar widget in the TaskEditModal that shows
 * recurring task instances and completion status. The reported bug is:
 * - "A weekly recurring task set to occur on Tuesdays actually highlights dates on Mondays"
 * - "Dates 21st and 28th (Mondays) are highlighted instead of the expected Tuesdays"
 * 
 * This test simulates the exact calendar rendering logic used in TaskEditModal
 * to reproduce the calendar display bug.
 */

import { TaskEditModal } from '../../../src/modals/TaskEditModal';
import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';
import { 
  generateRecurringInstances, 
} from '../../../src/utils/helpers';
import { 
  formatDateForStorage, 
  generateUTCCalendarDates, 
  getUTCStartOfWeek, 
  getUTCEndOfWeek, 
  getUTCStartOfMonth, 
  getUTCEndOfMonth 
} from '../../../src/utils/dateUtils';
// Simple implementation of isSameMonth to avoid mocking issues
function isSameMonth(date1: Date, date2: Date): boolean {
  return date1.getUTCFullYear() === date2.getUTCFullYear() && 
         date1.getUTCMonth() === date2.getUTCMonth();
}

describe('TaskEditModal Calendar Off-by-One Bug', () => {
  let mockPlugin: any;

  beforeEach(() => {
    jest.clearAllMocks();
    MockObsidian.reset();

    mockPlugin = {
      app: MockObsidian.app,
      settings: {
        calendarViewSettings: {
          firstDay: 1 // Monday = 1 (typical week start)
        }
      }
    };
  });

  describe('Calendar Rendering Logic', () => {
    it('should reproduce the exact calendar rendering logic from TaskEditModal', () => {
      // Create the same Tuesday recurring task mentioned in the GitHub issue
      const tuesdayTask = TaskFactory.createTask({
        id: 'tuesday-recurring-task',
        title: 'Weekly Tuesday Meeting',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        scheduled: '2025-01-21', // Tuesday, January 21, 2025
        complete_instances: []
      });

      // Simulate the calendar rendering for January 2025 (the month containing the example dates)
      const displayDate = new Date('2025-01-21T00:00:00.000Z'); // January 2025
      
      // This replicates the exact logic from TaskEditModal.renderCalendarMonth()
      
      // Step 1: Calculate month boundaries (UTC)
      const monthStart = getUTCStartOfMonth(displayDate);
      const monthEnd = getUTCEndOfMonth(displayDate);
      
      // Step 2: Calculate calendar display range (including padding days)
      const firstDaySetting = mockPlugin.settings.calendarViewSettings.firstDay || 0;
      const calendarStart = getUTCStartOfWeek(monthStart, firstDaySetting);
      const calendarEnd = getUTCEndOfWeek(monthEnd, firstDaySetting);
      const allDays = generateUTCCalendarDates(calendarStart, calendarEnd);
      
      // Step 3: Generate recurring instances with buffer (exact TaskEditModal logic)
      const bufferStart = getUTCStartOfMonth(displayDate);
      bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
      const bufferEnd = getUTCEndOfMonth(displayDate);
      bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
      
      const recurringDates = generateRecurringInstances(tuesdayTask, bufferStart, bufferEnd);
      const recurringDateStrings = new Set(recurringDates.map(d => formatDateForStorage(d)));
      
      console.log('Calendar month:', displayDate.toISOString().split('T')[0]);
      console.log('Recurring date strings:', Array.from(recurringDateStrings).sort());
      
      // Step 4: Simulate calendar day rendering (check specific dates from the issue)
      const calendarDays: Array<{
        date: string,
        dayOfMonth: number,
        isCurrentMonth: boolean,
        isRecurring: boolean,
        dayName: string
      }> = [];
      
      allDays.forEach(day => {
        const dayStr = formatDateForStorage(day);
        const isCurrentMonth = isSameMonth(day, displayDate);
        const isRecurring = recurringDateStrings.has(dayStr);
        
        // Only track January dates for this test
        if (isCurrentMonth) {
          calendarDays.push({
            date: dayStr,
            dayOfMonth: day.getUTCDate(),
            isCurrentMonth,
            isRecurring,
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getUTCDay()]
          });
        }
      });
      
      // Sort by date for easier verification
      calendarDays.sort((a, b) => a.date.localeCompare(b.date));
      
      // Log the calendar state for debugging
      const recurringDays = calendarDays.filter(d => d.isRecurring);
      console.log('Days marked as recurring in calendar:');
      recurringDays.forEach(day => {
        console.log(`  ${day.date} (${day.dayName}, ${day.dayOfMonth}${getOrdinalSuffix(day.dayOfMonth)})`);
      });
      
      // Verify the expected behavior based on the GitHub issue report
      
      // Expected: Tuesdays should be highlighted (7th, 14th, 21st, 28th)
      const expectedTuesdays = [
        { date: '2025-01-07', dayOfMonth: 7 },
        { date: '2025-01-14', dayOfMonth: 14 },
        { date: '2025-01-21', dayOfMonth: 21 },
        { date: '2025-01-28', dayOfMonth: 28 }
      ];
      
      expectedTuesdays.forEach(({ date, dayOfMonth }) => {
        const calendarDay = calendarDays.find(d => d.date === date);
        expect(calendarDay).toBeDefined();
        expect(calendarDay!.isRecurring).toBe(true);
        expect(calendarDay!.dayName).toBe('Tue');
        console.log(`✓ ${date} (Tuesday, ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}) correctly marked as recurring`);
      });
      
      // Bug check: Mondays should NOT be highlighted (6th, 13th, 20th, 27th)
      const mondaysBefore = [
        { date: '2025-01-06', dayOfMonth: 6 },
        { date: '2025-01-13', dayOfMonth: 13 },
        { date: '2025-01-20', dayOfMonth: 20 },
        { date: '2025-01-27', dayOfMonth: 27 }
      ];
      
      mondaysBefore.forEach(({ date, dayOfMonth }) => {
        const calendarDay = calendarDays.find(d => d.date === date);
        expect(calendarDay).toBeDefined();
        expect(calendarDay!.isRecurring).toBe(false);
        expect(calendarDay!.dayName).toBe('Mon');
        console.log(`✓ ${date} (Monday, ${dayOfMonth}${getOrdinalSuffix(dayOfMonth)}) correctly NOT marked as recurring`);
      });
      
      // Verify specific dates mentioned in the GitHub issue
      // "Dates 21st and 28th (Mondays) are highlighted instead of the expected Tuesdays"
      // Note: The issue description has the day-of-week wrong, but let's verify the actual behavior
      
      const day21st = calendarDays.find(d => d.dayOfMonth === 21);
      const day28th = calendarDays.find(d => d.dayOfMonth === 28);
      
      expect(day21st?.dayName).toBe('Tue'); // 21st is actually Tuesday
      expect(day28th?.dayName).toBe('Tue'); // 28th is actually Tuesday
      expect(day21st?.isRecurring).toBe(true); // Should be highlighted (correct)
      expect(day28th?.isRecurring).toBe(true); // Should be highlighted (correct)
      
      // The issue might be that these dates were showing as Monday in the user's display
      // This could indicate a timezone or day-of-week calculation issue
      // If this test passes, it suggests the TaskEditModal calendar logic is working correctly
    });

    it('should test calendar behavior across timezone boundaries', () => {
      // Test with a task scheduled at the boundary between days
      const boundaryTask = TaskFactory.createTask({
        id: 'boundary-task', 
        title: 'Boundary Test Task',
        recurrence: 'FREQ=WEEKLY;BYDAY=SU', // Sunday
        scheduled: '2025-01-05', // Sunday, January 5, 2025
        complete_instances: []
      });

      // Test calendar rendering
      const displayDate = new Date('2025-01-05T00:00:00.000Z');
      const monthStart = getUTCStartOfMonth(displayDate);
      const monthEnd = getUTCEndOfMonth(displayDate);
      
      const bufferStart = getUTCStartOfMonth(displayDate);
      bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
      const bufferEnd = getUTCEndOfMonth(displayDate);
      bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
      
      const recurringDates = generateRecurringInstances(boundaryTask, bufferStart, bufferEnd);
      const recurringDateStrings = new Set(recurringDates.map(d => formatDateForStorage(d)));
      
      // Verify Sunday dates are included
      const januarySundays = ['2025-01-05', '2025-01-12', '2025-01-19', '2025-01-26'];
      januarySundays.forEach(sunday => {
        expect(recurringDateStrings.has(sunday)).toBe(true);
      });
      
      // Verify adjacent days are not included (off-by-one check)
      const adjacentSaturdays = ['2025-01-04', '2025-01-11', '2025-01-18', '2025-01-25'];
      const adjacentMondays = ['2025-01-06', '2025-01-13', '2025-01-20', '2025-01-27'];
      
      adjacentSaturdays.forEach(saturday => {
        expect(recurringDateStrings.has(saturday)).toBe(false);
      });
      adjacentMondays.forEach(monday => {
        expect(recurringDateStrings.has(monday)).toBe(false);
      });
    });

    it('should simulate the exact user scenario from GitHub discussion #237', () => {
      // Create a task exactly as described in the issue
      const taskFromIssue = TaskFactory.createTask({
        id: 'github-issue-task',
        title: 'Task from GitHub Issue #237',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU', // Weekly on Tuesday
        scheduled: '2025-01-21', // Start with Tuesday, January 21
        complete_instances: []
      });

      // Test the calendar for the specific month mentioned
      const januaryDisplayDate = new Date('2025-01-21T00:00:00.000Z');
      
      // Generate the recurring instances as the TaskEditModal would
      const bufferStart = getUTCStartOfMonth(januaryDisplayDate);
      bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
      const bufferEnd = getUTCEndOfMonth(januaryDisplayDate);
      bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
      
      const recurringDates = generateRecurringInstances(taskFromIssue, bufferStart, bufferEnd);
      const recurringDateStrings = new Set(recurringDates.map(d => formatDateForStorage(d)));
      
      console.log('User scenario - recurring dates in calendar:', Array.from(recurringDateStrings).sort());
      
      // Check what the user would see in their calendar
      const allDays = generateUTCCalendarDates(
        getUTCStartOfWeek(getUTCStartOfMonth(januaryDisplayDate), 1),
        getUTCEndOfWeek(getUTCEndOfMonth(januaryDisplayDate), 1)
      );
      
      // Focus on the dates mentioned in the issue: 21st and 28th
      const day21 = allDays.find(d => d.getUTCDate() === 21 && isSameMonth(d, januaryDisplayDate));
      const day28 = allDays.find(d => d.getUTCDate() === 28 && isSameMonth(d, januaryDisplayDate));
      
      expect(day21).toBeDefined();
      expect(day28).toBeDefined();
      
      const day21Str = formatDateForStorage(day21!);
      const day28Str = formatDateForStorage(day28!);
      
      // What the user should see vs what they reported
      const day21IsHighlighted = recurringDateStrings.has(day21Str);
      const day28IsHighlighted = recurringDateStrings.has(day28Str);
      
      console.log(`21st (${day21!.getUTCDay() === 2 ? 'Tuesday' : 'Other'}) highlighted: ${day21IsHighlighted}`);
      console.log(`28th (${day28!.getUTCDay() === 2 ? 'Tuesday' : 'Other'}) highlighted: ${day28IsHighlighted}`);
      
      // Verify correct behavior: both 21st and 28th should be highlighted since they're Tuesdays
      expect(day21IsHighlighted).toBe(true);
      expect(day28IsHighlighted).toBe(true);
      expect(day21!.getUTCDay()).toBe(2); // Tuesday = 2
      expect(day28!.getUTCDay()).toBe(2); // Tuesday = 2
      
      // If this test passes, the TaskEditModal calendar logic is working correctly
      // The reported issue might be elsewhere (e.g., CSS display, different calendar, or fixed)
    });
  });
});

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd'; 
    case 3: return 'rd';
    default: return 'th';
  }
}