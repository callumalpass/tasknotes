/**
 * Custom assertion helpers for TaskNotes plugin testing
 * These helpers provide domain-specific assertions for testing
 */

import { TaskInfo, TimeEntry, PomodoroSession, FilterQuery } from '../../src/types';

// TaskInfo assertion helpers
export const TaskAssertions = {
  /**
   * Assert that an object is a valid TaskInfo
   */
  toBeValidTaskInfo: (received: any): jest.CustomMatcherResult => {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.title === 'string' &&
      received.title.length > 0 &&
      typeof received.status === 'string' &&
      typeof received.priority === 'string' &&
      typeof received.path === 'string' &&
      typeof received.archived === 'boolean';

    if (pass) {
      return {
        message: () => `Expected ${JSON.stringify(received)} not to be a valid TaskInfo`,
        pass: true,
      };
    } else {
      const missing: string[] = [];
      if (typeof received?.title !== 'string' || received.title.length === 0) missing.push('title');
      if (typeof received?.status !== 'string') missing.push('status');
      if (typeof received?.priority !== 'string') missing.push('priority');
      if (typeof received?.path !== 'string') missing.push('path');
      if (typeof received?.archived !== 'boolean') missing.push('archived');

      return {
        message: () => `Expected ${JSON.stringify(received)} to be a valid TaskInfo. Missing or invalid: ${missing.join(', ')}`,
        pass: false,
      };
    }
  },

  /**
   * Assert that a task has the expected status
   */
  toHaveStatus: (received: TaskInfo, expected: string): jest.CustomMatcherResult => {
    const pass = received.status === expected;
    
    return {
      message: () => pass
        ? `Expected task not to have status "${expected}"`
        : `Expected task to have status "${expected}", but got "${received.status}"`,
      pass,
    };
  },

  /**
   * Assert that a task is overdue
   */
  toBeOverdue: (received: TaskInfo): jest.CustomMatcherResult => {
    const now = new Date();
    const dueDate = received.due ? new Date(received.due) : null;
    const pass = dueDate !== null && dueDate < now && received.status !== 'done';
    
    return {
      message: () => pass
        ? `Expected task not to be overdue`
        : `Expected task to be overdue (due: ${received.due}, status: ${received.status})`,
      pass,
    };
  },

  /**
   * Assert that a task is recurring
   */
  toBeRecurring: (received: TaskInfo): jest.CustomMatcherResult => {
    const pass = received.recurrence !== undefined && received.recurrence !== null;
    
    return {
      message: () => pass
        ? `Expected task not to be recurring`
        : `Expected task to be recurring, but recurrence is ${received.recurrence}`,
      pass,
    };
  },

  /**
   * Assert that a task has time tracking data
   */
  toHaveTimeTracking: (received: TaskInfo): jest.CustomMatcherResult => {
    const hasEntries = received.timeEntries && received.timeEntries.length > 0;
    const hasEstimate = received.timeEstimate !== undefined && received.timeEstimate > 0;
    const pass = hasEntries || hasEstimate;
    
    return {
      message: () => pass
        ? `Expected task not to have time tracking data`
        : `Expected task to have time tracking data (entries: ${received.timeEntries?.length || 0}, estimate: ${received.timeEstimate || 0})`,
      pass,
    };
  },

  /**
   * Assert that a task matches a filter query
   */
  toMatchFilter: (received: TaskInfo, filter: FilterQuery): jest.CustomMatcherResult => {
    let pass = true;
    const reasons: string[] = [];

    // Check status filter
    if (filter.statuses && filter.statuses.length > 0) {
      if (!filter.statuses.includes(received.status)) {
        pass = false;
        reasons.push(`status "${received.status}" not in ${JSON.stringify(filter.statuses)}`);
      }
    }

    // Check priority filter
    if (filter.priorities && filter.priorities.length > 0) {
      if (!filter.priorities.includes(received.priority)) {
        pass = false;
        reasons.push(`priority "${received.priority}" not in ${JSON.stringify(filter.priorities)}`);
      }
    }

    // Check contexts filter
    if (filter.contexts && filter.contexts.length > 0) {
      const taskContexts = received.contexts || [];
      const hasMatchingContext = filter.contexts.some(ctx => taskContexts.includes(ctx));
      if (!hasMatchingContext) {
        pass = false;
        reasons.push(`contexts ${JSON.stringify(taskContexts)} don't match ${JSON.stringify(filter.contexts)}`);
      }
    }

    // Check archived filter
    if (!filter.showArchived && received.archived) {
      pass = false;
      reasons.push('task is archived but filter excludes archived tasks');
    }

    // Check search query
    if (filter.searchQuery && filter.searchQuery.trim()) {
      const query = filter.searchQuery.toLowerCase();
      const titleMatch = received.title.toLowerCase().includes(query);
      const contextMatch = received.contexts?.some(ctx => ctx.toLowerCase().includes(query));
      if (!titleMatch && !contextMatch) {
        pass = false;
        reasons.push(`search query "${filter.searchQuery}" doesn't match title or contexts`);
      }
    }

    return {
      message: () => pass
        ? `Expected task not to match filter`
        : `Expected task to match filter. Failed because: ${reasons.join(', ')}`,
      pass,
    };
  }
};

// TimeEntry assertion helpers
export const TimeEntryAssertions = {
  /**
   * Assert that an object is a valid TimeEntry
   */
  toBeValidTimeEntry: (received: any): jest.CustomMatcherResult => {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.startTime === 'string' &&
      (received.endTime === undefined || typeof received.endTime === 'string');

    return {
      message: () => pass
        ? `Expected ${JSON.stringify(received)} not to be a valid TimeEntry`
        : `Expected ${JSON.stringify(received)} to be a valid TimeEntry`,
      pass,
    };
  },

  /**
   * Assert that a time entry is currently active (no end time)
   */
  toBeActive: (received: TimeEntry): jest.CustomMatcherResult => {
    const pass = received.endTime === undefined;
    
    return {
      message: () => pass
        ? `Expected time entry not to be active`
        : `Expected time entry to be active (endTime should be undefined)`,
      pass,
    };
  },

  /**
   * Assert that a time entry has a specific duration
   */
  toHaveDuration: (received: TimeEntry, expectedMinutes: number): jest.CustomMatcherResult => {
    if (!received.endTime) {
      return {
        message: () => `Expected time entry to have duration, but it's still active`,
        pass: false,
      };
    }

    const start = new Date(received.startTime);
    const end = new Date(received.endTime);
    const actualMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    const pass = actualMinutes === expectedMinutes;
    
    return {
      message: () => pass
        ? `Expected time entry not to have duration ${expectedMinutes} minutes`
        : `Expected time entry to have duration ${expectedMinutes} minutes, but got ${actualMinutes} minutes`,
      pass,
    };
  }
};

// PomodoroSession assertion helpers
export const PomodoroAssertions = {
  /**
   * Assert that an object is a valid PomodoroSession
   */
  toBeValidPomodoroSession: (received: any): jest.CustomMatcherResult => {
    const pass = 
      typeof received === 'object' &&
      received !== null &&
      typeof received.id === 'string' &&
      typeof received.startTime === 'string' &&
      typeof received.plannedDuration === 'number' &&
      ['work', 'short-break', 'long-break'].includes(received.type) &&
      typeof received.completed === 'boolean' &&
      Array.isArray(received.activePeriods);

    return {
      message: () => pass
        ? `Expected ${JSON.stringify(received)} not to be a valid PomodoroSession`
        : `Expected ${JSON.stringify(received)} to be a valid PomodoroSession`,
      pass,
    };
  },

  /**
   * Assert that a pomodoro session is completed
   */
  toBeCompleted: (received: PomodoroSession): jest.CustomMatcherResult => {
    const pass = received.completed === true && received.endTime !== undefined;
    
    return {
      message: () => pass
        ? `Expected pomodoro session not to be completed`
        : `Expected pomodoro session to be completed`,
      pass,
    };
  },

  /**
   * Assert that a pomodoro session is running
   */
  toBeRunning: (received: PomodoroSession): jest.CustomMatcherResult => {
    const pass = !received.completed && received.endTime === undefined;
    
    return {
      message: () => pass
        ? `Expected pomodoro session not to be running`
        : `Expected pomodoro session to be running`,
      pass,
    };
  }
};

// Date assertion helpers
export const DateAssertions = {
  /**
   * Assert that a date string is today
   */
  toBeToday: (received: string): jest.CustomMatcherResult => {
    const today = new Date().toISOString().split('T')[0];
    const receivedDate = new Date(received).toISOString().split('T')[0];
    const pass = receivedDate === today;
    
    return {
      message: () => pass
        ? `Expected date not to be today`
        : `Expected date to be today (${today}), but got ${receivedDate}`,
      pass,
    };
  },

  /**
   * Assert that a date is within a range
   */
  toBeDateWithinRange: (received: string, start: string, end: string): jest.CustomMatcherResult => {
    const receivedDate = new Date(received);
    const startDate = new Date(start);
    const endDate = new Date(end);
    const pass = receivedDate >= startDate && receivedDate <= endDate;
    
    return {
      message: () => pass
        ? `Expected date ${received} not to be within range ${start} to ${end}`
        : `Expected date ${received} to be within range ${start} to ${end}`,
      pass,
    };
  }
};

// Array assertion helpers
export const ArrayAssertions = {
  /**
   * Assert that an array contains only valid TaskInfo objects
   */
  toContainOnlyValidTasks: (received: any[]): jest.CustomMatcherResult => {
    if (!Array.isArray(received)) {
      return {
        message: () => `Expected ${typeof received} to be an array`,
        pass: false,
      };
    }

    const invalidTasks = received.filter(task => {
      const result = TaskAssertions.toBeValidTaskInfo(task);
      return !result.pass;
    });

    const pass = invalidTasks.length === 0;
    
    return {
      message: () => pass
        ? `Expected array not to contain only valid tasks`
        : `Expected array to contain only valid tasks, but found ${invalidTasks.length} invalid tasks`,
      pass,
    };
  },

  /**
   * Assert that an array is sorted by a specific field
   */
  toBeSortedBy: (received: any[], field: string, direction: 'asc' | 'desc' = 'asc'): jest.CustomMatcherResult => {
    if (!Array.isArray(received) || received.length < 2) {
      return {
        message: () => `Array must have at least 2 items to check sorting`,
        pass: true, // Empty or single-item arrays are considered sorted
      };
    }

    let pass = true;
    for (let i = 0; i < received.length - 1; i++) {
      const current = received[i][field];
      const next = received[i + 1][field];
      
      if (direction === 'asc') {
        if (current > next) {
          pass = false;
          break;
        }
      } else {
        if (current < next) {
          pass = false;
          break;
        }
      }
    }
    
    return {
      message: () => pass
        ? `Expected array not to be sorted by ${field} in ${direction} order`
        : `Expected array to be sorted by ${field} in ${direction} order`,
      pass,
    };
  }
};

// Performance assertion helpers
export const PerformanceAssertions = {
  /**
   * Assert that an operation completes within a time limit
   */
  toCompleteWithin: async (received: () => Promise<any>, milliseconds: number): Promise<jest.CustomMatcherResult> => {
    const start = Date.now();
    
    try {
      await received();
      const duration = Date.now() - start;
      const pass = duration <= milliseconds;
      
      return {
        message: () => pass
          ? `Expected operation not to complete within ${milliseconds}ms`
          : `Expected operation to complete within ${milliseconds}ms, but took ${duration}ms`,
        pass,
      };
    } catch (error) {
      return {
        message: () => `Operation failed with error: ${error}`,
        pass: false,
      };
    }
  }
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidTaskInfo(): R;
      toHaveStatus(expected: string): R;
      toBeOverdue(): R;
      toBeRecurring(): R;
      toHaveTimeTracking(): R;
      toMatchFilter(filter: FilterQuery): R;
      toBeValidTimeEntry(): R;
      toBeActive(): R;
      toHaveDuration(expectedMinutes: number): R;
      toBeValidPomodoroSession(): R;
      toBeCompleted(): R;
      toBeRunning(): R;
      toBeToday(): R;
      toBeDateWithinRange(start: string, end: string): R;
      toContainOnlyValidTasks(): R;
      toBeSortedBy(field: string, direction?: 'asc' | 'desc'): R;
      toCompleteWithin(milliseconds: number): Promise<R>;
    }
  }
}

// Export all assertion helpers
export const AssertionHelpers = {
  TaskAssertions,
  TimeEntryAssertions,
  PomodoroAssertions,
  DateAssertions,
  ArrayAssertions,
  PerformanceAssertions
};

export default AssertionHelpers;