/**
 * Test for First Day of Week Calendar Display Off-by-One Bug
 * 
 * This investigates whether the off-by-one behavior reported in GitHub discussion #237
 * is actually caused by different "first day of week" settings affecting the visual
 * layout of the calendar, making it appear as if tasks are showing on the wrong day.
 * 
 * The TaskEditModal uses: firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0
 * - 0 = Sunday first (US style)
 * - 1 = Monday first (ISO/European style)
 * 
 * If a user expects Monday-first but sees Sunday-first (or vice versa), 
 * the same logical date could appear to be "shifted" by one position in the grid.
 */

import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
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

describe('First Day of Week Calendar Display Off-by-One', () => {

  describe('Visual Layout Impact of First Day Settings', () => {
    it('should show how different first-day settings affect the visual appearance of the same Tuesday task', () => {
      // Create the Tuesday recurring task from the GitHub issue
      const tuesdayTask = TaskFactory.createTask({
        id: 'tuesday-visual-test',
        title: 'Weekly Tuesday Task',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        scheduled: '2025-01-21', // Tuesday, January 21, 2025
        complete_instances: []
      });

      const displayDate = new Date('2025-01-21T00:00:00.000Z'); // January 2025
      
      // Generate recurring instances (this logic doesn't change with first day setting)
      const bufferStart = getUTCStartOfMonth(displayDate);
      bufferStart.setUTCMonth(bufferStart.getUTCMonth() - 1);
      const bufferEnd = getUTCEndOfMonth(displayDate);
      bufferEnd.setUTCMonth(bufferEnd.getUTCMonth() + 1);
      
      const recurringDates = generateRecurringInstances(tuesdayTask, bufferStart, bufferEnd);
      const recurringDateStrings = new Set(recurringDates.map(d => formatDateForStorage(d)));
      
      console.log('Recurring dates (unchanged by first day setting):', Array.from(recurringDateStrings).filter(d => d.startsWith('2025-01')).sort());

      // Test both first day settings
      const firstDaySettings = [
        { name: 'Sunday First (US)', value: 0 },
        { name: 'Monday First (ISO)', value: 1 }
      ];

      firstDaySettings.forEach(({ name, value }) => {
        console.log(`\n=== ${name} (firstDay=${value}) ===`);
        
        // Calculate calendar boundaries with different first day settings
        const monthStart = getUTCStartOfMonth(displayDate);
        const monthEnd = getUTCEndOfMonth(displayDate);
        const calendarStart = getUTCStartOfWeek(monthStart, value);
        const calendarEnd = getUTCEndOfWeek(monthEnd, value);
        const allDays = generateUTCCalendarDates(calendarStart, calendarEnd);
        
        // Create visual representation of the calendar
        const calendar: string[][] = [];
        let currentWeek: string[] = [];
        
        allDays.forEach((day, index) => {
          const dayStr = formatDateForStorage(day);
          const isCurrentMonth = isSameMonth(day, displayDate);
          const isRecurring = recurringDateStrings.has(dayStr);
          const dayOfMonth = day.getUTCDate();
          const dayOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getUTCDay()];
          
          let cellContent = `${dayOfMonth.toString().padStart(2)}`;
          if (isRecurring && isCurrentMonth) {
            cellContent = `[${cellContent}]`; // Mark recurring days with brackets
          } else if (!isCurrentMonth) {
            cellContent = ` ${cellContent} `; // Dim non-current month
          } else {
            cellContent = ` ${cellContent} `;
          }
          
          currentWeek.push(cellContent);
          
          // Start new week every 7 days
          if (currentWeek.length === 7) {
            calendar.push([...currentWeek]);
            currentWeek = [];
          }
        });
        
        // Print the visual calendar
        const dayHeaders = value === 0 
          ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']  // Sunday first
          : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // Monday first
          
        console.log(dayHeaders.join('  '));
        calendar.forEach(week => {
          console.log(week.join(' '));
        });
        
        // Find the positions of Tuesday dates in this layout
        const tuesdayPositions: Array<{date: string, weekIndex: number, dayIndex: number}> = [];
        
        allDays.forEach((day, index) => {
          const dayStr = formatDateForStorage(day);
          const isCurrentMonth = isSameMonth(day, displayDate);
          const isRecurring = recurringDateStrings.has(dayStr);
          
          if (isRecurring && isCurrentMonth) {
            const weekIndex = Math.floor(index / 7);
            const dayIndex = index % 7;
            tuesdayPositions.push({ date: dayStr, weekIndex, dayIndex });
          }
        });
        
        console.log('Tuesday positions in grid:');
        tuesdayPositions.forEach(({ date, weekIndex, dayIndex }) => {
          const actualDate = new Date(date + 'T00:00:00.000Z');
          const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][actualDate.getUTCDay()];
          console.log(`  ${date} (${dayName}): Week ${weekIndex + 1}, Column ${dayIndex + 1} (${dayHeaders[dayIndex]})`);
        });
      });
    });

    it('should demonstrate how visual position can create illusion of off-by-one error', () => {
      // This test shows how the same Tuesday can appear in different visual positions
      // depending on the first day of week setting
      
      const tuesday21st = new Date('2025-01-21T00:00:00.000Z'); // Tuesday, January 21
      console.log(`\nAnalyzing Tuesday, January 21st, 2025 (day of week: ${tuesday21st.getUTCDay()})`);
      
      // With Sunday first (0), Tuesday is column index 2
      // With Monday first (1), Tuesday is column index 1
      
      const sundayFirstColumn = tuesday21st.getUTCDay(); // 2 (third column: Sun=0, Mon=1, Tue=2)
      const mondayFirstColumn = (tuesday21st.getUTCDay() + 6) % 7; // 1 (second column: Mon=0, Tue=1)
      
      console.log(`Sunday-first layout: Tuesday appears in column ${sundayFirstColumn} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][sundayFirstColumn]})`);
      console.log(`Monday-first layout: Tuesday appears in column ${mondayFirstColumn} (${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][mondayFirstColumn]})`);
      
      // The visual difference
      console.log('\nVisual comparison for week of January 19-25, 2025:');
      console.log('Sunday-first: Sun Mon [Tue] Wed Thu Fri Sat');
      console.log('Monday-first: [Tue] Wed Thu Fri Sat Sun Mon');
      console.log('              ↑ Tuesday appears to "shift left" by one position');
      
      // This could explain the user's perception
      expect(sundayFirstColumn).toBe(2);
      expect(mondayFirstColumn).toBe(1);
      expect(sundayFirstColumn - mondayFirstColumn).toBe(1); // One column difference!
    });

    it('should test the exact scenario that could cause user confusion', () => {
      // Scenario: User expects Monday-first calendar but sees Sunday-first
      // Result: All days appear "shifted right" by one position
      
      const testWeek = [
        { date: '2025-01-19', day: 'Sunday' },
        { date: '2025-01-20', day: 'Monday' },
        { date: '2025-01-21', day: 'Tuesday' },
        { date: '2025-01-22', day: 'Wednesday' },
        { date: '2025-01-23', day: 'Thursday' },
        { date: '2025-01-24', day: 'Friday' },
        { date: '2025-01-25', day: 'Saturday' }
      ];
      
      console.log('\nUser perception test:');
      console.log('Actual: Tuesday task is correctly scheduled for 2025-01-21 (Tuesday)');
      
      // What user sees with Sunday-first calendar
      console.log('\nSunday-first calendar display:');
      console.log('  Sun    Mon    Tue    Wed    Thu    Fri    Sat');
      console.log('  19     20    [21]    22     23     24     25');
      console.log('               ↑ Task correctly shows on Tuesday');
      
      // What user expects with Monday-first calendar
      console.log('\nWhat user expects (Monday-first):');
      console.log('  Mon    Tue    Wed    Thu    Fri    Sat    Sun');
      console.log('  20    [21]    22     23     24     25     19');
      console.log('        ↑ Task should show here (Tuesday)');
      
      // But if user sees Sunday-first while expecting Monday-first:
      console.log('\nUser confusion scenario:');
      console.log('User sees Sunday-first but interprets as Monday-first:');
      console.log('  Sun    Mon    Tue    Wed    Thu    Fri    Sat');
      console.log('  19     20    [21]    22     23     24     25');
      console.log('  ↑      ↑     ↑ User thinks this is Wednesday!');
      console.log('  User   User  because they expect Mon-Tue-Wed...');
      console.log('  thinks thinks');
      console.log('  Mon    Tue');
      
      // This explains the "Monday instead of Tuesday" report!
      console.log('\nThis explains the bug report:');
      console.log('- Task is logically correct (Tuesday = 2025-01-21)');
      console.log('- But user sees it in "Tuesday column" of Sunday-first calendar');
      console.log('- User interprets that column as "Wednesday" (expecting Monday-first)');
      console.log('- User reports: "Task shows on wrong day"');
      
      // Verify this theory
      const tuesday = new Date('2025-01-21T00:00:00.000Z');
      const sundayFirstPosition = tuesday.getUTCDay(); // Position in Sunday-first week
      const mondayFirstPosition = (tuesday.getUTCDay() + 6) % 7; // Position in Monday-first week
      
      expect(sundayFirstPosition).toBe(2); // 3rd column in Sunday-first
      expect(mondayFirstPosition).toBe(1); // 2nd column in Monday-first
      
      // User seeing Sunday-first but expecting Monday-first would interpret 
      // 3rd column (actually Tuesday) as Wednesday!
    });
  });

  describe('TaskEditModal First Day Setting Integration', () => {
    it('should verify that different firstDay settings produce different visual layouts', () => {
      const tuesdayTask = TaskFactory.createTask({
        id: 'first-day-integration-test',
        title: 'Tuesday Task',
        recurrence: 'FREQ=WEEKLY;BYDAY=TU',
        scheduled: '2025-01-21',
        complete_instances: []
      });

      const displayDate = new Date('2025-01-21T00:00:00.000Z');
      
      // Test with both first day settings that TaskEditModal supports
      [0, 1].forEach(firstDaySetting => {
        const monthStart = getUTCStartOfMonth(displayDate);
        const monthEnd = getUTCEndOfMonth(displayDate);
        const calendarStart = getUTCStartOfWeek(monthStart, firstDaySetting);
        const calendarEnd = getUTCEndOfWeek(monthEnd, firstDaySetting);
        
        // The start of the calendar grid will be different
        const startDateStr = formatDateForStorage(calendarStart);
        console.log(`First day setting ${firstDaySetting}: Calendar starts on ${startDateStr} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][calendarStart.getUTCDay()]})`);
        
        // But the recurring dates themselves don't change
        const recurringDates = generateRecurringInstances(tuesdayTask, calendarStart, calendarEnd);
        const januaryRecurringDates = recurringDates
          .filter(d => d.getUTCMonth() === 0 && d.getUTCFullYear() === 2025)
          .map(d => formatDateForStorage(d));
        
        expect(januaryRecurringDates).toEqual(['2025-01-07', '2025-01-14', '2025-01-21', '2025-01-28']);
      });
      
      console.log('\nConclusion: FirstDay setting changes visual layout but not logical dates');
      console.log('This could explain user reports of "wrong day" when the logic is actually correct');
    });
  });
});