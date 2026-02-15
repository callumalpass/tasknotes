/**
 * Skipped tests for Issue #1606: Completed Recurring Tasks from Today not showing in Base Views
 *
 * Bug Description:
 * When a user tries to create a View/Base that includes tasks completed today (both recurring
 * and regular), recurring tasks completed today do not show up even when using the
 * `complete_instances.contains(today().format("yyyy-MM-dd"))` filter.
 *
 * User's filter attempt:
 *   ```
 *   Where recurrence
 *   and complete_instances.contains(today().format("yyyy-MM-dd"))
 *   ```
 *
 * User's task YAML property:
 *   ```yaml
 *   complete_instances:
 *     - 2026-02-01
 *     - 2026-02-09
 *     - 2026-02-15
 *   ```
 *
 * Expected behavior:
 * The task should appear in the view when today's date is in complete_instances.
 *
 * Potential root causes to investigate:
 * 1. Date format mismatch - unquoted YAML dates may be parsed as Date objects,
 *    while today().format() returns a string. The contains() comparison may fail
 *    when comparing Date objects to strings.
 *
 * 2. Format string case sensitivity - The internal code uses "YYYY-MM-DD" (uppercase)
 *    in some places and "yyyy-MM-dd" (lowercase) in others. Bases may not support
 *    lowercase format specifiers.
 *
 * 3. Type coercion issues - The Bases expression evaluator may not properly coerce
 *    Date types to strings before the contains() comparison.
 *
 * Related files:
 * - src/services/BasesFilterConverter.ts (lines 181-187 - complete_instances handling)
 * - src/templates/defaultBasesFiles.ts (lines 519-522 - filter template)
 * - docs/views/default-base-templates.md (filter documentation)
 *
 * The internal BasesFilterConverter uses a different pattern that first maps dates:
 *   note.complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD"))
 *
 * But the templates and documentation use the simpler pattern:
 *   complete_instances.contains(today().format("yyyy-MM-dd"))
 *
 * The discrepancy suggests that:
 * 1. The .map() step may be necessary to convert Date objects to strings
 * 2. The format string case may matter (YYYY vs yyyy)
 */

import { describe, it, expect } from '@jest/globals';
import { formatDateForStorage } from '../../../src/utils/dateUtils';
import { TaskInfo } from '../../../src/types';

describe('Issue #1606: Completed Recurring Tasks from Today not showing in Base Views', () => {
    describe('Core bug demonstration', () => {
        it.skip('reproduces issue #1606 - recurring task completed today should be filterable', () => {
            // Reproduces issue #1606
            // The user wants to filter for recurring tasks that have been completed TODAY
            // using: complete_instances.contains(today().format("yyyy-MM-dd"))

            const today = new Date(Date.UTC(2026, 1, 15)); // Feb 15, 2026
            const todayStr = formatDateForStorage(today); // "2026-02-15"

            const task: TaskInfo = {
                title: 'Daily standup',
                status: 'open',
                path: 'tasks/daily-standup.md',
                scheduled: '2026-01-01',
                recurrence: 'RRULE:FREQ=DAILY',
                // User's YAML: complete_instances: [2026-02-01, 2026-02-09, 2026-02-15]
                // These unquoted dates might be parsed as Date objects by Obsidian
                complete_instances: ['2026-02-01', '2026-02-09', '2026-02-15'],
            };

            // Direct string comparison works in TypeScript
            const containsTodayString = task.complete_instances?.includes(todayStr);
            expect(containsTodayString).toBe(true);

            // But the Bases filter expression:
            // complete_instances.contains(today().format("yyyy-MM-dd"))
            // may fail if complete_instances contains Date objects instead of strings
            //
            // The filter evaluator might be doing:
            // [Date(2026-02-01), Date(2026-02-09), Date(2026-02-15)].contains("2026-02-15")
            // which returns false because Date !== String

            // EXPECTED: Task should appear in "Completed Today" view
            // ACTUAL: Task does not appear (bug)
        });

        it.skip('reproduces issue #1606 - demonstrates quoted vs unquoted YAML date difference', () => {
            // Reproduces issue #1606
            // When YAML has unquoted dates, they may be parsed differently

            // Quoted dates (strings):
            // complete_instances:
            //   - "2026-02-01"
            //   - "2026-02-15"

            // Unquoted dates (may be Date objects):
            // complete_instances:
            //   - 2026-02-01
            //   - 2026-02-15

            const todayStr = '2026-02-15';

            // If parsed as strings, comparison works
            const stringArray = ['2026-02-01', '2026-02-15'];
            expect(stringArray.includes(todayStr)).toBe(true);

            // If parsed as Date objects, comparison might fail
            // Date.toString() returns "Sat Feb 15 2026 00:00:00 GMT+0000"
            // which does NOT equal "2026-02-15"
            const dateArray = [new Date('2026-02-01'), new Date('2026-02-15')];
            const dateArrayAsStrings = dateArray.map(d => d.toISOString().split('T')[0]);
            expect(dateArrayAsStrings.includes(todayStr)).toBe(true);

            // But without explicit conversion, the comparison would fail
            const naiveDateComparison = dateArray.some(d => String(d) === todayStr);
            expect(naiveDateComparison).toBe(false); // This is the bug!
        });

        it.skip('reproduces issue #1606 - BasesFilterConverter uses .map() for type safety', () => {
            // Reproduces issue #1606
            // The BasesFilterConverter at line 184 uses a different pattern:
            //
            // note.complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD"))
            //
            // This pattern:
            // 1. Takes each value in complete_instances
            // 2. Parses it as a date: date(value)
            // 3. Formats it back to string: .format("YYYY-MM-DD")
            // 4. Then checks if the array contains the formatted today string
            //
            // This ensures type consistency regardless of how Obsidian parsed the YAML

            // Simulate the .map(date(value).format("YYYY-MM-DD")) transformation
            const completeInstances = [
                new Date('2026-02-01'),  // Could be Date object
                new Date('2026-02-09'),
                new Date('2026-02-15'),
            ];

            // Transform to strings like Bases would
            const formattedInstances = completeInstances.map(d => {
                // Simulating Bases date().format() which extracts YYYY-MM-DD
                return d.toISOString().split('T')[0];
            });

            expect(formattedInstances).toEqual(['2026-02-01', '2026-02-09', '2026-02-15']);

            // Now the contains check works
            const todayFormatted = '2026-02-15';
            expect(formattedInstances.includes(todayFormatted)).toBe(true);
        });
    });

    describe('Format string case sensitivity', () => {
        it.skip('reproduces issue #1606 - format specifier case may matter', () => {
            // Reproduces issue #1606
            // The templates use lowercase: today().format("yyyy-MM-dd")
            // But BasesFilterConverter uses uppercase: today().format("YYYY-MM-DD")
            //
            // Moment.js and Day.js use different conventions:
            // - Moment.js: YYYY-MM-DD (uppercase Y for year)
            // - Day.js: YYYY-MM-DD (same)
            // - date-fns: yyyy-MM-dd (lowercase y)
            //
            // If Bases uses a library that expects uppercase, lowercase format
            // strings may produce unexpected results or fail silently

            // Example: if "yyyy" is not recognized, it might output literal "yyyy"
            // instead of the year, causing the comparison to fail

            expect(true).toBe(true); // Placeholder
        });
    });

    describe('Suggested workarounds', () => {
        it.skip('reproduces issue #1606 - workaround: use .map() pattern from BasesFilterConverter', () => {
            // Reproduces issue #1606
            // Workaround: Use the same pattern as BasesFilterConverter.ts:184
            //
            // Instead of:
            //   complete_instances.contains(today().format("yyyy-MM-dd"))
            //
            // Use:
            //   complete_instances.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD"))
            //
            // This ensures:
            // 1. Each complete_instances value is explicitly parsed as a date
            // 2. Each date is formatted consistently
            // 3. The comparison is string-to-string

            expect(true).toBe(true); // Placeholder documenting the workaround
        });

        it.skip('reproduces issue #1606 - workaround: quote dates in YAML', () => {
            // Reproduces issue #1606
            // Workaround: Ensure dates in complete_instances are quoted strings
            //
            // Instead of:
            //   complete_instances:
            //     - 2026-02-01
            //     - 2026-02-15
            //
            // Use:
            //   complete_instances:
            //     - "2026-02-01"
            //     - "2026-02-15"
            //
            // This ensures YAML parses them as strings rather than Date objects

            expect(true).toBe(true); // Placeholder documenting the workaround
        });
    });

    describe('Filter expression analysis', () => {
        it.skip('reproduces issue #1606 - simulates the failing Bases filter', () => {
            // Reproduces issue #1606
            // This test simulates what happens when the Bases filter evaluator
            // processes: complete_instances.contains(today().format("yyyy-MM-dd"))

            const task: TaskInfo = {
                title: 'Daily task',
                status: 'open',
                path: 'tasks/daily.md',
                scheduled: '2026-01-01',
                recurrence: 'RRULE:FREQ=DAILY',
                complete_instances: ['2026-02-01', '2026-02-09', '2026-02-15'],
            };

            const todayStr = '2026-02-15';

            // Filter condition 1: Has recurrence (WORKS)
            const hasRecurrence = !!task.recurrence;
            expect(hasRecurrence).toBe(true);

            // Filter condition 2: complete_instances.contains(today) (MAY FAIL)
            // If complete_instances values are Date objects in Bases:
            // - today().format("yyyy-MM-dd") returns string "2026-02-15"
            // - complete_instances might contain [Date, Date, Date]
            // - Date.contains(String) likely returns false

            // With proper string values, it should work:
            const containsToday = task.complete_instances?.includes(todayStr);
            expect(containsToday).toBe(true);

            // Combined filter result
            const wouldAppearInCompletedTodayView = hasRecurrence && containsToday;
            expect(wouldAppearInCompletedTodayView).toBe(true);

            // EXPECTED: Task appears in "Completed Today" view
            // ACTUAL (bug): Task does not appear
        });
    });

    describe('Documentation of root cause', () => {
        it.skip('reproduces issue #1606 - inconsistency between templates and converter', () => {
            // Reproduces issue #1606
            // There is an inconsistency between:
            //
            // 1. defaultBasesFiles.ts (line 522) uses:
            //    "!${completeInstancesProperty}.contains(today().format(\"yyyy-MM-dd\"))"
            //
            // 2. BasesFilterConverter.ts (line 184) uses:
            //    note.${completeInstancesProp}.map(date(value).format("YYYY-MM-DD")).contains(today().format("YYYY-MM-DD"))
            //
            // The converter's approach is more robust because:
            // - It explicitly parses each value as a date
            // - It uses consistent formatting
            // - It handles both Date objects and string values
            //
            // The template's approach may fail when:
            // - Obsidian parses unquoted YAML dates as Date objects
            // - The Bases evaluator doesn't auto-coerce types for contains()
            //
            // Fix options:
            // 1. Update templates to use the .map(date(value).format()) pattern
            // 2. Document that users should quote their date strings in YAML
            // 3. Update the Bases expression evaluator to handle type coercion

            expect(true).toBe(true);
        });
    });
});
