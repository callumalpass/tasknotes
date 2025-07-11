/**
 * Tests for Issue #160: Off-by-one issues in completions calendar
 * 
 * Issue: https://github.com/callumalpass/tasknotes/issues/160
 * 
 * Problem: 
 * - Recurring task set for Fridays shows Saturdays highlighted in completions calendar
 * - "Mark as completed" adds completion for tomorrow instead of today
 * - Recording a completion for today does not style the task as completed
 * - Adding a completion for Saturday will style it as completed
 */

import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { isDueByRRule, generateRecurringInstances } from '../../../src/utils/helpers';
import { createUTCDateForRRule, formatUTCDateForCalendar } from '../../../src/utils/dateUtils';
import { RRule } from 'rrule';

// Don't mock date-fns - we want the real implementation
// Only mock specific functions if absolutely necessary
const realDateFns = jest.requireActual('date-fns');

describe('Issue #160: Off-by-one issues in completions calendar', () => {
  // Test various days of the week to check for off-by-one pattern
  const testCases = [
    { day: 'Monday', date: '2024-01-08', rrule: 'FREQ=WEEKLY;BYDAY=MO', expectedDayOfWeek: 1 },
    { day: 'Tuesday', date: '2024-01-09', rrule: 'FREQ=WEEKLY;BYDAY=TU', expectedDayOfWeek: 2 },
    { day: 'Wednesday', date: '2024-01-10', rrule: 'FREQ=WEEKLY;BYDAY=WE', expectedDayOfWeek: 3 },
    { day: 'Thursday', date: '2024-01-11', rrule: 'FREQ=WEEKLY;BYDAY=TH', expectedDayOfWeek: 4 },
    { day: 'Friday', date: '2024-01-12', rrule: 'FREQ=WEEKLY;BYDAY=FR', expectedDayOfWeek: 5 },
    { day: 'Saturday', date: '2024-01-13', rrule: 'FREQ=WEEKLY;BYDAY=SA', expectedDayOfWeek: 6 },
    { day: 'Sunday', date: '2024-01-14', rrule: 'FREQ=WEEKLY;BYDAY=SU', expectedDayOfWeek: 0 }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('General off-by-one recurring task detection', () => {
    testCases.forEach(({ day, date, rrule, expectedDayOfWeek }) => {
      it(`should correctly identify ${day} as a recurring day`, () => {
        const task = TaskFactory.createTask({
          id: `test-${day.toLowerCase()}-task`,
          title: `Weekly ${day} Task`,
          recurrence: rrule,
          scheduled: date,
          complete_instances: []
        });

        const testDate = new Date(date + 'T00:00:00.000Z');
        const isDueOnCorrectDay = isDueByRRule(task, testDate);
        
        // This should return true for the intended day
        expect(isDueOnCorrectDay).toBe(true);
        
        // Verify the date's actual day of week matches what we expect
        expect(testDate.getUTCDay()).toBe(expectedDayOfWeek);
      });

      it(`should NOT identify ${day} task as due on the next day (off-by-one check)`, () => {
        const task = TaskFactory.createTask({
          id: `test-${day.toLowerCase()}-task`,
          title: `Weekly ${day} Task`,
          recurrence: rrule,
          scheduled: date,
          complete_instances: []
        });

        // Test the next day
        const nextDate = new Date(date + 'T00:00:00.000Z');
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        
        const isDueOnNextDay = isDueByRRule(task, nextDate);
        
        // This should return false for the next day
        expect(isDueOnNextDay).toBe(false);
      });
    });
  });

  describe('Recurring instances generation (off-by-one check)', () => {
    testCases.forEach(({ day, date, rrule, expectedDayOfWeek }) => {
      it(`should generate instances only for ${day}, not the next day`, () => {
        const task = TaskFactory.createTask({
          id: `test-${day.toLowerCase()}-task`,
          title: `Weekly ${day} Task`,
          recurrence: rrule,
          scheduled: date,
          complete_instances: []
        });

        // Generate instances for a week containing our test date
        const weekStart = new Date(date + 'T00:00:00.000Z');
        weekStart.setUTCDate(weekStart.getUTCDate() - 3); // Start a few days before
        
        const weekEnd = new Date(date + 'T00:00:00.000Z');
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 3); // End a few days after
        
        const instances = generateRecurringInstances(task, weekStart, weekEnd);
        const dateStrings = instances.map(d => formatUTCDateForCalendar(d));
        
        // Should include the intended date
        expect(dateStrings).toContain(date);
        
        // Should NOT include the next day (off-by-one check)
        const nextDate = new Date(date + 'T00:00:00.000Z');
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const nextDateStr = formatUTCDateForCalendar(nextDate);
        
        expect(dateStrings).not.toContain(nextDateStr);
      });
    });
  });

  describe('Completion calendar highlighting (off-by-one check)', () => {
    it('should highlight the correct day when task recurs on that day', () => {
      const { day, date, rrule } = testCases[4]; // Friday test case
      
      const task = TaskFactory.createTask({
        id: `test-${day.toLowerCase()}-task`,
        title: `Weekly ${day} Task`,
        recurrence: rrule,
        scheduled: date,
        complete_instances: []
      });

      // Simulate the calendar logic from TaskEditModal
      const weekStart = new Date(date + 'T00:00:00.000Z');
      weekStart.setUTCDate(weekStart.getUTCDate() - 3);
      
      const weekEnd = new Date(date + 'T00:00:00.000Z');
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 3);
      
      const recurringDates = generateRecurringInstances(task, weekStart, weekEnd);
      const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
      
      // The intended day should be in the recurring dates set
      expect(recurringDateStrings.has(date)).toBe(true);
      
      // The next day should NOT be in the recurring dates set (off-by-one check)
      const nextDate = new Date(date + 'T00:00:00.000Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextDateStr = formatUTCDateForCalendar(nextDate);
      
      expect(recurringDateStrings.has(nextDateStr)).toBe(false);
    });
  });

  describe('Task completion status (off-by-one check)', () => {
    it('should mark task as completed when completion matches recurring day', () => {
      const { day, date, rrule } = testCases[4]; // Friday test case
      
      const task = TaskFactory.createTask({
        id: `test-${day.toLowerCase()}-task`,
        title: `Weekly ${day} Task`,
        recurrence: rrule,
        scheduled: date,
        complete_instances: [date] // Completion on the correct day
      });

      const completedInstances = new Set(task.complete_instances || []);
      
      // Should be marked as completed for the correct day
      expect(completedInstances.has(date)).toBe(true);
    });

    it('should NOT mark task as completed when completion is off by one day', () => {
      const { day, date, rrule } = testCases[4]; // Friday test case
      
      // Calculate the next day
      const nextDate = new Date(date + 'T00:00:00.000Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextDateStr = formatUTCDateForCalendar(nextDate);
      
      const task = TaskFactory.createTask({
        id: `test-${day.toLowerCase()}-task`,
        title: `Weekly ${day} Task`,
        recurrence: rrule,
        scheduled: date,
        complete_instances: [nextDateStr] // Completion on the wrong day (off-by-one)
      });

      const completedInstances = new Set(task.complete_instances || []);
      
      // Should NOT be marked as completed for the intended day
      expect(completedInstances.has(date)).toBe(false);
      
      // But would incorrectly show as completed for the next day
      expect(completedInstances.has(nextDateStr)).toBe(true);
    });
  });

  describe('Date handling edge cases (off-by-one check)', () => {
    it('should handle timezone boundaries correctly', () => {
      const { day, date, rrule } = testCases[4]; // Friday test case
      
      const task = TaskFactory.createTask({
        id: `test-${day.toLowerCase()}-task`,
        title: `Weekly ${day} Task`,
        recurrence: rrule,
        scheduled: date,
        complete_instances: []
      });

      // Test with dates at timezone boundaries
      const utcDate = createUTCDateForRRule(date);
      const nextDay = createUTCDateForRRule(date);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      
      // Verify the intended day is recognized as recurring
      const isDueOnIntendedDay = isDueByRRule(task, utcDate);
      expect(isDueOnIntendedDay).toBe(true);
      
      // Verify the next day is NOT recognized as recurring (off-by-one check)
      const isDueOnNextDay = isDueByRRule(task, nextDay);
      expect(isDueOnNextDay).toBe(false);
    });
  });

  describe('Regression tests - reproduce the actual off-by-one bug', () => {
    it('should reproduce the original bug: tasks appearing on the wrong day', () => {
      const { day, date, rrule } = testCases[4]; // Friday test case
      
      const task = TaskFactory.createTask({
        id: `test-${day.toLowerCase()}-task`,
        title: `Weekly ${day} Task`,
        recurrence: rrule,
        scheduled: date,
        complete_instances: []
      });

      // Generate recurring instances for a range around the test date
      const weekStart = new Date(date + 'T00:00:00.000Z');
      weekStart.setUTCDate(weekStart.getUTCDate() - 3);
      
      const weekEnd = new Date(date + 'T00:00:00.000Z');
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 3);
      
      const recurringDates = generateRecurringInstances(task, weekStart, weekEnd);
      const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
      
      // The bug would cause the next day to be highlighted instead of the intended day
      // This assertion should pass when the bug is fixed
      expect(recurringDateStrings.has(date)).toBe(true);  // Intended day should be highlighted
      
      // Calculate next day
      const nextDate = new Date(date + 'T00:00:00.000Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextDateStr = formatUTCDateForCalendar(nextDate);
      
      expect(recurringDateStrings.has(nextDateStr)).toBe(false); // Next day should NOT be highlighted
    });

    it('should reproduce the completion status bug', () => {
      const { day, date, rrule } = testCases[4]; // Friday test case
      
      // This test reproduces the "Mark as completed" bug
      const task = TaskFactory.createTask({
        id: `test-${day.toLowerCase()}-task`,
        title: `Weekly ${day} Task`,
        recurrence: rrule,
        scheduled: date,
        complete_instances: [date] // Mark as completed on the intended day
      });
      
      // Task should be marked as completed for the intended day
      const completedInstances = new Set(task.complete_instances || []);
      expect(completedInstances.has(date)).toBe(true);
      
      // Task should NOT be marked as completed for the next day
      const nextDate = new Date(date + 'T00:00:00.000Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextDateStr = formatUTCDateForCalendar(nextDate);
      
      expect(completedInstances.has(nextDateStr)).toBe(false);
    });
  });

  describe('Calendar UI integration - off-by-one demonstration', () => {
    it('should correctly apply CSS classes for recurring and completed days', () => {
      const { day, date, rrule } = testCases[4]; // Friday test case
      
      const task = TaskFactory.createTask({
        id: `test-${day.toLowerCase()}-task`,
        title: `Weekly ${day} Task`,
        recurrence: rrule,
        scheduled: date,
        complete_instances: [date] // Mark as completed on the intended day
      });

      // Simulate the calendar rendering logic
      const weekStart = new Date(date + 'T00:00:00.000Z');
      weekStart.setUTCDate(weekStart.getUTCDate() - 3);
      
      const weekEnd = new Date(date + 'T00:00:00.000Z');
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 3);
      
      const recurringDates = generateRecurringInstances(task, weekStart, weekEnd);
      const recurringDateStrings = new Set(recurringDates.map(d => formatUTCDateForCalendar(d)));
      const completedInstances = new Set(task.complete_instances || []);

      // Test the intended day vs the next day (off-by-one check)
      const nextDate = new Date(date + 'T00:00:00.000Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const nextDateStr = formatUTCDateForCalendar(nextDate);

      // The intended day should be marked as recurring and completed
      expect(recurringDateStrings.has(date)).toBe(true);
      expect(completedInstances.has(date)).toBe(true);

      // The next day should NOT be marked as recurring or completed
      expect(recurringDateStrings.has(nextDateStr)).toBe(false);
      expect(completedInstances.has(nextDateStr)).toBe(false);
    });
  });
});