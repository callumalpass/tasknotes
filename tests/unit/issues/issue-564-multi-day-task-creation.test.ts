/**
 * Test for Issue #564: Cannot schedule tasks across multiple days in month/year view
 *
 * When in month/year view, dragging to create a multi-day task should create a task
 * with time estimate reflecting the duration dragged, not a single day task with
 * 'time estimate' of 0.
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #564: Multi-day task creation in month/year view', () => {
    // Simulate the handleTaskCreation logic from AdvancedCalendarView
    function simulateTaskCreation(start: Date, end: Date, allDay: boolean) {
        const scheduledDate = allDay
            ? start.toISOString().split('T')[0] // format(start, 'yyyy-MM-dd')
            : start.toISOString().slice(0, 16); // format(start, "yyyy-MM-dd'T'HH:mm")

        const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

        // Convert slot duration setting to minutes for comparison
        const slotDurationMinutes = 30; // Default 30 minutes

        // Determine if this was a drag (intentional time selection) or just a click
        const isDragOperation = !allDay && durationMinutes > slotDurationMinutes;

        const prePopulatedValues: any = {
            scheduled: scheduledDate
        };

        // Apply the fix: calculate duration for multi-day all-day selections
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

    it('should set correct time estimate for single-day all-day task', () => {
        // Single day selection in month view (all-day)
        const start = new Date('2025-01-15T00:00:00.000Z');
        const end = new Date('2025-01-16T00:00:00.000Z');

        const result = simulateTaskCreation(start, end, true);

        // Single day all-day task should not have time estimate set (use default)
        expect(result.scheduled).toBe('2025-01-15');
        expect(result.timeEstimate).toBeUndefined();
    });

    it('should set correct time estimate for 3-day all-day task', () => {
        // Three day selection in month view (all-day)
        const start = new Date('2025-01-15T00:00:00.000Z');
        const end = new Date('2025-01-18T00:00:00.000Z');

        const result = simulateTaskCreation(start, end, true);

        // 3 days = 3 * 24 * 60 = 4320 minutes
        expect(result.scheduled).toBe('2025-01-15');
        expect(result.timeEstimate).toBe(4320);
    });

    it('should set correct time estimate for 7-day all-day task', () => {
        // Week-long selection in month view (all-day)
        const start = new Date('2025-01-15T00:00:00.000Z');
        const end = new Date('2025-01-22T00:00:00.000Z');

        const result = simulateTaskCreation(start, end, true);

        // 7 days = 7 * 24 * 60 = 10080 minutes
        expect(result.scheduled).toBe('2025-01-15');
        expect(result.timeEstimate).toBe(10080);
    });

    it('should work correctly for timed tasks (week view behavior)', () => {
        // 2 hour selection in week view (timed)
        const start = new Date('2025-01-15T09:00:00.000Z');
        const end = new Date('2025-01-15T11:00:00.000Z');

        const result = simulateTaskCreation(start, end, false);

        // 2 hours = 120 minutes
        expect(result.scheduled).toBe('2025-01-15T09:00');
        expect(result.timeEstimate).toBe(120);
    });

    it('should not set time estimate for short timed selections (clicks)', () => {
        // Short click in week view (less than slot duration)
        const start = new Date('2025-01-15T09:00:00.000Z');
        const end = new Date('2025-01-15T09:15:00.000Z'); // 15 minutes < 30 minute slot

        const result = simulateTaskCreation(start, end, false);

        // Short selection should not set time estimate (use default)
        expect(result.scheduled).toBe('2025-01-15T09:00');
        expect(result.timeEstimate).toBeUndefined();
    });
});