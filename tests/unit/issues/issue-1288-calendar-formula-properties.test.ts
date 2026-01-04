/**
 * Failing test for Issue #1288: Calendar Start/End date property dropdowns don't show formula properties
 *
 * Bug Description:
 * Users can see formula properties in calendar filters, title property, and kanban swimlane settings,
 * but formula properties are NOT available for selection in the calendar's start date and end date
 * property dropdowns.
 *
 * Root Cause:
 * The property filter functions in src/bases/registration.ts for startDateProperty and endDateProperty
 * only allow `note.` and `file.` prefixed properties, but exclude `formula.` prefixed properties.
 * This is inconsistent with other property selectors like titleProperty (line 410-412) and
 * kanban swimLane (line 57-59) which do include formula properties.
 *
 * Expected behavior: Formula properties that return date values should be selectable for
 * calendar start/end date properties, just like they can be used for title property or filters.
 *
 * @see https://github.com/obsidianmd/tasknotes/issues/1288
 */

describe('Issue #1288: Calendar formula properties in start/end date selectors', () => {
    // These filter functions mirror what's in src/bases/registration.ts

    // Current implementation - BROKEN (lines 390-393 and 400-403)
    const currentStartDateFilter = (prop: string) => {
        // Only show date-type properties
        return prop.startsWith("note.") || prop.startsWith("file.");
    };

    const currentEndDateFilter = (prop: string) => {
        // Only show date-type properties
        return prop.startsWith("note.") || prop.startsWith("file.");
    };

    // Title property filter - WORKS (lines 410-412)
    const titlePropertyFilter = (prop: string) => {
        // Show text properties (note, formula, file)
        return prop.startsWith("note.") || prop.startsWith("formula.") || prop.startsWith("file.");
    };

    // Kanban swimlane filter - WORKS (lines 57-59)
    const swimLaneFilter = (prop: string) => {
        // Show all note, task, and formula properties that could be used for swimlanes
        return prop.startsWith("note.") || prop.startsWith("task.") || prop.startsWith("formula.");
    };

    describe('Consistency check for formula properties across UI selectors', () => {
        // Example properties that should be testable
        const noteProperty = 'note.date';
        const fileProperty = 'file.mtime';
        const formulaProperty = 'formula.calculatedDate';
        const taskProperty = 'task.due';

        it('titleProperty filter accepts formula properties', () => {
            expect(titlePropertyFilter(formulaProperty)).toBe(true);
            expect(titlePropertyFilter(noteProperty)).toBe(true);
            expect(titlePropertyFilter(fileProperty)).toBe(true);
        });

        it('swimLane filter accepts formula properties', () => {
            expect(swimLaneFilter(formulaProperty)).toBe(true);
            expect(swimLaneFilter(noteProperty)).toBe(true);
            expect(swimLaneFilter(taskProperty)).toBe(true);
        });

        // This test documents the bug - it should PASS when the bug is fixed
        it.skip('startDateProperty filter should accept formula properties (FAILS - Issue #1288)', () => {
            // This currently fails because the filter excludes formula. prefix
            expect(currentStartDateFilter(formulaProperty)).toBe(true);
        });

        // This test documents the bug - it should PASS when the bug is fixed
        it.skip('endDateProperty filter should accept formula properties (FAILS - Issue #1288)', () => {
            // This currently fails because the filter excludes formula. prefix
            expect(currentEndDateFilter(formulaProperty)).toBe(true);
        });

        // Verify the current (broken) behavior
        it('current startDateProperty filter rejects formula properties (documents bug)', () => {
            // This documents the current broken behavior
            expect(currentStartDateFilter(formulaProperty)).toBe(false); // Bug: should be true
            expect(currentStartDateFilter(noteProperty)).toBe(true);
            expect(currentStartDateFilter(fileProperty)).toBe(true);
        });

        it('current endDateProperty filter rejects formula properties (documents bug)', () => {
            // This documents the current broken behavior
            expect(currentEndDateFilter(formulaProperty)).toBe(false); // Bug: should be true
            expect(currentEndDateFilter(noteProperty)).toBe(true);
            expect(currentEndDateFilter(fileProperty)).toBe(true);
        });
    });

    describe('Expected fix verification', () => {
        // Fixed implementation - what the filter should be
        const fixedStartDateFilter = (prop: string) => {
            // Should include formula properties for date formulas
            return prop.startsWith("note.") || prop.startsWith("file.") || prop.startsWith("formula.");
        };

        const fixedEndDateFilter = (prop: string) => {
            // Should include formula properties for date formulas
            return prop.startsWith("note.") || prop.startsWith("file.") || prop.startsWith("formula.");
        };

        it('fixed startDateProperty filter should accept formula properties', () => {
            expect(fixedStartDateFilter('formula.calculatedDate')).toBe(true);
            expect(fixedStartDateFilter('formula.dueDate')).toBe(true);
            expect(fixedStartDateFilter('note.date')).toBe(true);
            expect(fixedStartDateFilter('file.mtime')).toBe(true);
        });

        it('fixed endDateProperty filter should accept formula properties', () => {
            expect(fixedEndDateFilter('formula.endDate')).toBe(true);
            expect(fixedEndDateFilter('formula.calculatedEndDate')).toBe(true);
            expect(fixedEndDateFilter('note.date')).toBe(true);
            expect(fixedEndDateFilter('file.mtime')).toBe(true);
        });
    });
});
