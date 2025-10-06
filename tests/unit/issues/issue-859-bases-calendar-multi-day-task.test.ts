/**
 * Test for Issue #859: Multiple days task glitches in calendar view
 *
 * When creating a multi-day task by dragging in the Bases calendar view,
 * the task duration should correctly reflect the number of days selected.
 * Currently, the Bases calendar view (calendar-view.ts) doesn't calculate
 * the time estimate for multi-day all-day tasks, unlike AdvancedCalendarView.
 */

import { describe, it, expect } from '@jest/globals';
import { format } from 'date-fns';

describe('Issue #859: Multi-day task creation in Bases calendar view', () => {
    // Simulate the CURRENT (buggy) handleDateSelect logic from calendar-view.ts
    function simulateBasesCalendarTaskCreation(start: Date, end: Date, allDay: boolean) {
        const scheduledDate = allDay
            ? format(start, "yyyy-MM-dd")
            : format(start, "yyyy-MM-dd'T'HH:mm");

        const prePopulatedValues: any = {
            scheduled: scheduledDate
        };

        // BUG: calendar-view.ts doesn't calculate timeEstimate for multi-day selections
        // It only sets the scheduled date, without considering the duration

        return prePopulatedValues;
    }

    // Simulate the FIXED handleDateSelect logic (matching AdvancedCalendarView)
    function simulateBasesCalendarTaskCreationFixed(start: Date, end: Date, allDay: boolean) {
        const scheduledDate = allDay
            ? format(start, "yyyy-MM-dd")
            : format(start, "yyyy-MM-dd'T'HH:mm");

        const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

        // Convert slot duration setting to minutes for comparison
        const slotDurationMinutes = 30; // Default 30 minutes

        // Determine if this was a drag (intentional time selection) or just a click
        const isDragOperation = !allDay && durationMinutes > slotDurationMinutes;

        const prePopulatedValues: any = {
            scheduled: scheduledDate
        };

        // FIX: Calculate duration for multi-day all-day selections
        if (allDay) {
            // For all-day events, calculate duration in days if multi-day selection
            const dayDurationMillis = 24 * 60 * 60 * 1000; // milliseconds in a day
            const daysDuration = Math.round((end.getTime() - start.getTime()) / dayDurationMillis);

            if (daysDuration > 1) {
                // Multi-day selection: set time estimate based on days
                const minutesPerDay = 60 * 24;
                prePopulatedValues.timeEstimate = daysDuration * minutesPerDay;
            }
            // For single-day all-day events, let TaskCreationModal use the default setting
        } else if (isDragOperation) {
            // User dragged to select a specific duration, use that
            prePopulatedValues.timeEstimate = durationMinutes;
        }

        return prePopulatedValues;
    }

    describe('Current buggy behavior', () => {
        it('should FAIL: does not set time estimate for 2-day task', () => {
            // User drags to create a 2-day task
            const start = new Date('2025-01-15T00:00:00.000Z');
            const end = new Date('2025-01-17T00:00:00.000Z');

            const result = simulateBasesCalendarTaskCreation(start, end, true);

            // BUG: timeEstimate is not set, so it will be undefined
            expect(result.scheduled).toBe('2025-01-15');
            expect(result.timeEstimate).toBeUndefined(); // This demonstrates the bug
            // Should be: expect(result.timeEstimate).toBe(2880); // 2 days = 2880 minutes
        });

        it('should FAIL: does not set time estimate for 7-day task', () => {
            // User drags to create a week-long task
            const start = new Date('2025-01-15T00:00:00.000Z');
            const end = new Date('2025-01-22T00:00:00.000Z');

            const result = simulateBasesCalendarTaskCreation(start, end, true);

            // BUG: timeEstimate is not set
            expect(result.scheduled).toBe('2025-01-15');
            expect(result.timeEstimate).toBeUndefined(); // This demonstrates the bug
            // Should be: expect(result.timeEstimate).toBe(10080); // 7 days = 10080 minutes
        });

        it('should FAIL: does not set time estimate for random multi-day selection', () => {
            // User drags to create a 5-day task
            const start = new Date('2025-03-10T00:00:00.000Z');
            const end = new Date('2025-03-15T00:00:00.000Z');

            const result = simulateBasesCalendarTaskCreation(start, end, true);

            // BUG: timeEstimate is not set, leading to unexpected behavior
            expect(result.scheduled).toBe('2025-03-10');
            expect(result.timeEstimate).toBeUndefined(); // This demonstrates the bug
            // Should be: expect(result.timeEstimate).toBe(7200); // 5 days = 7200 minutes
        });
    });

    describe('Fixed behavior', () => {
        it('should set correct time estimate for 2-day all-day task', () => {
            const start = new Date('2025-01-15T00:00:00.000Z');
            const end = new Date('2025-01-17T00:00:00.000Z');

            const result = simulateBasesCalendarTaskCreationFixed(start, end, true);

            // 2 days = 2 * 24 * 60 = 2880 minutes
            expect(result.scheduled).toBe('2025-01-15');
            expect(result.timeEstimate).toBe(2880);
        });

        it('should set correct time estimate for 7-day all-day task', () => {
            const start = new Date('2025-01-15T00:00:00.000Z');
            const end = new Date('2025-01-22T00:00:00.000Z');

            const result = simulateBasesCalendarTaskCreationFixed(start, end, true);

            // 7 days = 7 * 24 * 60 = 10080 minutes
            expect(result.scheduled).toBe('2025-01-15');
            expect(result.timeEstimate).toBe(10080);
        });

        it('should set correct time estimate for single-day all-day task', () => {
            const start = new Date('2025-01-15T00:00:00.000Z');
            const end = new Date('2025-01-16T00:00:00.000Z');

            const result = simulateBasesCalendarTaskCreationFixed(start, end, true);

            // Single day all-day task should not have time estimate set (use default)
            expect(result.scheduled).toBe('2025-01-15');
            expect(result.timeEstimate).toBeUndefined();
        });

        it('should work correctly for timed tasks (week view behavior)', () => {
            // 2 hour selection in week view (timed)
            // Use local dates instead of UTC to avoid timezone issues
            const start = new Date(2025, 0, 15, 9, 0); // Jan 15, 2025, 9:00 AM local
            const end = new Date(2025, 0, 15, 11, 0); // Jan 15, 2025, 11:00 AM local

            const result = simulateBasesCalendarTaskCreationFixed(start, end, false);

            // 2 hours = 120 minutes
            expect(result.scheduled).toBe('2025-01-15T09:00');
            expect(result.timeEstimate).toBe(120);
        });

        it('should not set time estimate for short timed selections (clicks)', () => {
            // Short click in week view (less than slot duration)
            // Use local dates instead of UTC to avoid timezone issues
            const start = new Date(2025, 0, 15, 9, 0); // Jan 15, 2025, 9:00 AM local
            const end = new Date(2025, 0, 15, 9, 15); // Jan 15, 2025, 9:15 AM local (15 minutes < 30 minute slot)

            const result = simulateBasesCalendarTaskCreationFixed(start, end, false);

            // Short selection should not set time estimate (use default)
            expect(result.scheduled).toBe('2025-01-15T09:00');
            expect(result.timeEstimate).toBeUndefined();
        });
    });
});
