/**
 * Calendar and View Synchronization Integration Tests
 * 
 * Tests complete calendar and view synchronization workflows including:
 * - Calendar view updates and refresh
 * - Cross-view data synchronization
 * - Date-based task filtering and display
 * - Recurring task instance management in calendar
 * - Time-block integration
 * - External calendar integration
 * - Performance with large datasets
 * - Real-time updates and live sync
 */

import { TestEnvironment, WorkflowTester } from '../helpers/integration-helpers';
import { TaskFactory } from '../helpers/mock-factories';
import { TaskInfo, TimeBlock } from '../../src/types';
import { MockObsidian, TFile } from '../__mocks__/obsidian';

// Mock external dependencies
jest.mock('obsidian');
jest.mock('date-fns', () => ({
  format: jest.fn((date: Date, formatStr: string) => {
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0];
    }
    return date.toISOString();
  }),
  startOfDay: jest.fn((date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }),
  endOfDay: jest.fn((date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  })
}));

jest.mock('../../src/utils/dateUtils', () => ({
  getCurrentDateString: jest.fn(() => '2025-01-15'),
  parseDate: jest.fn((dateStr) => new Date(dateStr)),
  isTodayTimeAware: jest.fn((date) => date?.includes('2025-01-15')),
  isOverdueTimeAware: jest.fn((date) => date?.includes('2020-01-01')),
  formatDateForDisplay: jest.fn((date) => date?.split('T')[0] || date)
}));

jest.mock('../../src/utils/helpers', () => ({
  shouldShowRecurringTaskOnDate: jest.fn((task, date) => {
    if (!task.recurrence) return true;
    // Simple mock: show daily tasks every day, weekly on same day of week
    if (task.recurrence.includes('DAILY')) return true;
    if (task.recurrence.includes('WEEKLY')) return date.getDay() === 1; // Monday
    return false;
  }),
  getEffectiveTaskStatus: jest.fn((task, date) => {
    if (task.recurrence && task.complete_instances?.includes(date.toISOString().split('T')[0])) {
      return 'done';
    }
    return task.status || 'open';
  }),
  timeblockToCalendarEvent: jest.fn((timeblock, date) => ({
    id: `timeblock-${timeblock.id}`,
    title: timeblock.title,
    start: `${date}T${timeblock.startTime}:00`,
    end: `${date}T${timeblock.endTime}:00`,
    allDay: false,
    eventType: 'timeblock'
  }))
}));

describe('Calendar and View Synchronization Integration', () => {
  let testEnv: TestEnvironment;
  let workflowTester: WorkflowTester;

  beforeEach(async () => {
    jest.clearAllMocks();
    MockObsidian.reset();
    
    testEnv = new TestEnvironment();
    await testEnv.setup();
    
    workflowTester = new WorkflowTester(testEnv);
    
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(async () => {
    await testEnv.cleanup();
    jest.restoreAllMocks();
  });

  describe('Calendar View Updates', () => {
    it('should refresh calendar when tasks are created with dates', async () => {
      const taskData = {
        title: 'Calendar task',
        scheduled: '2025-01-20',
        due: '2025-01-22T14:00'
      };

      // Mock calendar view being open
      const mockCalendarView = {
        refresh: jest.fn(),
        getCalendarApi: jest.fn().mockReturnValue({
          refetchEvents: jest.fn(),
          addEvent: jest.fn(),
          removeEvent: jest.fn()
        })
      };

      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      const result = await workflowTester.testCalendarTaskCreation({
        taskData,
        expectCalendarRefresh: true,
        expectEventCreation: true
      });

      expect(result.success).toBe(true);
      expect(result.calendarRefreshed).toBe(true);
      expect(result.eventCreated).toBe(true);
      expect(mockCalendarView.refresh).toHaveBeenCalled();
    });

    it('should update calendar when task dates are modified', async () => {
      const originalTask = TaskFactory.createTask({
        title: 'Calendar update task',
        scheduled: '2025-01-15',
        due: '2025-01-17'
      });

      const mockCalendarView = {
        refresh: jest.fn(),
        getCalendarApi: jest.fn().mockReturnValue({
          getEventById: jest.fn().mockReturnValue({
            remove: jest.fn(),
            setProp: jest.fn(),
            setStart: jest.fn(),
            setEnd: jest.fn()
          }),
          addEvent: jest.fn()
        })
      };

      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      const dateUpdates = {
        scheduled: '2025-01-18',
        due: '2025-01-20T16:00'
      };

      const result = await workflowTester.testCalendarTaskUpdate({
        originalTask,
        dateUpdates,
        expectEventUpdate: true,
        expectCalendarRefresh: true
      });

      expect(result.success).toBe(true);
      expect(result.eventUpdated).toBe(true);
      expect(result.calendarRefreshed).toBe(true);
    });

    it('should remove calendar events when task dates are cleared', async () => {
      const taskWithDates = TaskFactory.createTask({
        title: 'Task with dates to clear',
        scheduled: '2025-01-15',
        due: '2025-01-17'
      });

      const mockCalendarEvent = {
        remove: jest.fn()
      };

      const mockCalendarView = {
        refresh: jest.fn(),
        getCalendarApi: jest.fn().mockReturnValue({
          getEventById: jest.fn().mockReturnValue(mockCalendarEvent),
          removeEvent: jest.fn()
        })
      };

      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      const clearUpdates = {
        scheduled: undefined,
        due: undefined
      };

      const result = await workflowTester.testCalendarTaskUpdate({
        originalTask: taskWithDates,
        dateUpdates: clearUpdates,
        expectEventRemoval: true
      });

      expect(result.success).toBe(true);
      expect(result.eventRemoved).toBe(true);
      expect(mockCalendarEvent.remove).toHaveBeenCalled();
    });
  });

  describe('Recurring Task Calendar Management', () => {
    it('should display recurring task instances correctly', async () => {
      const recurringTask = TaskFactory.createRecurringTask('FREQ=DAILY', {
        title: 'Daily standup',
        scheduled: '2025-01-15T09:00',
        complete_instances: ['2025-01-14'] // Yesterday completed
      });

      const dateRange = {
        start: new Date('2025-01-13'),
        end: new Date('2025-01-20')
      };

      const result = await workflowTester.testRecurringTaskCalendarDisplay({
        recurringTask,
        dateRange,
        expectMultipleInstances: true,
        expectCompletionStates: true
      });

      expect(result.success).toBe(true);
      expect(result.instancesGenerated).toBeGreaterThan(1);
      expect(result.completionStatesCorrect).toBe(true);
    });

    it('should handle recurring task completion in calendar', async () => {
      const recurringTask = TaskFactory.createRecurringTask('FREQ=WEEKLY;BYDAY=MO', {
        title: 'Weekly team meeting',
        complete_instances: []
      });

      const targetDate = new Date('2025-01-20'); // Monday

      const mockCalendarView = {
        refresh: jest.fn(),
        getCalendarApi: jest.fn().mockReturnValue({
          getEventById: jest.fn().mockReturnValue({
            setProp: jest.fn(),
            setClassNames: jest.fn()
          })
        })
      };

      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      const result = await workflowTester.testRecurringTaskCalendarCompletion({
        recurringTask,
        targetDate,
        expectInstanceUpdate: true,
        expectVisualUpdate: true
      });

      expect(result.success).toBe(true);
      expect(result.instanceUpdated).toBe(true);
      expect(result.visualUpdated).toBe(true);
      expect(testEnv.mockPlugin.toggleRecurringTaskComplete).toHaveBeenCalledWith(
        recurringTask,
        targetDate
      );
    });

    it('should handle recurring task pattern changes in calendar', async () => {
      const recurringTask = TaskFactory.createRecurringTask('FREQ=WEEKLY;BYDAY=MO', {
        title: 'Meeting to reschedule'
      });

      const newRecurrence = 'FREQ=WEEKLY;BYDAY=TU,TH'; // Change to Tue/Thu

      const mockCalendarView = {
        refresh: jest.fn(),
        getCalendarApi: jest.fn().mockReturnValue({
          removeEvent: jest.fn(),
          addEvent: jest.fn(),
          refetchEvents: jest.fn()
        })
      };

      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      const result = await workflowTester.testRecurringTaskPatternChange({
        recurringTask,
        newRecurrence,
        expectOldInstancesRemoval: true,
        expectNewInstancesCreation: true,
        expectCalendarRefresh: true
      });

      expect(result.success).toBe(true);
      expect(result.oldInstancesRemoved).toBe(true);
      expect(result.newInstancesCreated).toBe(true);
      expect(result.calendarRefreshed).toBe(true);
    });
  });

  describe('TimeBlock Integration', () => {
    it('should display timeblocks in calendar', async () => {
      const timeBlocks: TimeBlock[] = [
        {
          id: 'tb-1',
          title: 'Morning focus block',
          startTime: '09:00',
          endTime: '11:00',
          color: '#4CAF50'
        },
        {
          id: 'tb-2',
          title: 'Afternoon meetings',
          startTime: '14:00',
          endTime: '16:00',
          color: '#FF9800'
        }
      ];

      const targetDate = '2025-01-15';

      const mockCalendarView = {
        getCalendarApi: jest.fn().mockReturnValue({
          addEvent: jest.fn(),
          getEvents: jest.fn().mockReturnValue([])
        })
      };

      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      const result = await workflowTester.testTimeBlockCalendarDisplay({
        timeBlocks,
        targetDate,
        expectEventCreation: true,
        expectColorCoding: true
      });

      expect(result.success).toBe(true);
      expect(result.eventsCreated).toBe(2);
      expect(result.colorCoded).toBe(true);
    });

    it('should handle timeblock updates in calendar', async () => {
      const timeBlock: TimeBlock = {
        id: 'tb-update',
        title: 'Block to update',
        startTime: '10:00',
        endTime: '12:00'
      };

      const updates = {
        startTime: '11:00',
        endTime: '13:00',
        title: 'Updated block'
      };

      const mockCalendarEvent = {
        setProp: jest.fn(),
        setStart: jest.fn(),
        setEnd: jest.fn()
      };

      const mockCalendarView = {
        getCalendarApi: jest.fn().mockReturnValue({
          getEventById: jest.fn().mockReturnValue(mockCalendarEvent)
        })
      };

      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      const result = await workflowTester.testTimeBlockCalendarUpdate({
        timeBlock,
        updates,
        expectEventUpdate: true
      });

      expect(result.success).toBe(true);
      expect(result.eventUpdated).toBe(true);
      expect(mockCalendarEvent.setProp).toHaveBeenCalledWith('title', 'Updated block');
    });

    it('should handle timeblock drag and drop in calendar', async () => {
      const timeBlock: TimeBlock = {
        id: 'tb-drag',
        title: 'Draggable block',
        startTime: '09:00',
        endTime: '10:00'
      };

      const dragDropData = {
        newStartTime: '14:00',
        newEndTime: '15:00',
        newDate: '2025-01-16'
      };

      const result = await workflowTester.testTimeBlockDragDrop({
        timeBlock,
        originalDate: '2025-01-15',
        dragDropData,
        expectTimeUpdate: true,
        expectDateUpdate: true
      });

      expect(result.success).toBe(true);
      expect(result.timeUpdated).toBe(true);
      expect(result.dateUpdated).toBe(true);
      expect(testEnv.mockPlugin.updateTimeblockInDailyNote).toHaveBeenCalledWith(
        expect.anything(),
        'tb-drag',
        '2025-01-15',
        '2025-01-16',
        '14:00',
        '15:00'
      );
    });
  });

  describe('Cross-View Synchronization', () => {
    it('should synchronize data across multiple view types', async () => {
      const task = TaskFactory.createTask({
        title: 'Multi-view sync task',
        scheduled: '2025-01-15',
        priority: 'high'
      });

      // Mock multiple view types being open
      const mockViews = [
        { viewType: 'task-list', refresh: jest.fn(), updateTask: jest.fn() },
        { viewType: 'calendar', refresh: jest.fn(), updateEvent: jest.fn() },
        { viewType: 'kanban', refresh: jest.fn(), moveCard: jest.fn() },
        { viewType: 'timeline', refresh: jest.fn(), updateTimeline: jest.fn() }
      ];

      testEnv.mockApp.workspace.iterateAllLeaves.mockImplementation((callback) => {
        mockViews.forEach(view => {
          callback({ view });
        });
      });

      const updates = {
        title: 'Updated multi-view task',
        priority: 'urgent',
        status: 'in-progress'
      };

      const result = await workflowTester.testCrossViewSynchronization({
        task,
        updates,
        expectedViewTypes: ['task-list', 'calendar', 'kanban', 'timeline'],
        expectAllViewsUpdated: true
      });

      expect(result.success).toBe(true);
      expect(result.viewsUpdated).toBe(4);
      mockViews.forEach(view => {
        expect(view.refresh).toHaveBeenCalled();
      });
    });

    it('should handle view-specific optimizations', async () => {
      const task = TaskFactory.createTask({
        title: 'Optimization test task',
        scheduled: '2025-01-15'
      });

      const mockListView = { 
        viewType: 'task-list', 
        refresh: jest.fn(), 
        supportsPartialUpdate: true,
        updateTaskInPlace: jest.fn() 
      };
      
      const mockCalendarView = { 
        viewType: 'calendar', 
        refresh: jest.fn(),
        getCalendarApi: jest.fn().mockReturnValue({
          getEventById: jest.fn(),
          refetchEvents: jest.fn()
        })
      };

      testEnv.mockApp.workspace.iterateAllLeaves.mockImplementation((callback) => {
        callback({ view: mockListView });
        callback({ view: mockCalendarView });
      });

      const minorUpdates = {
        title: 'Minor title update' // Non-date change
      };

      const result = await workflowTester.testViewSpecificOptimization({
        task,
        updates: minorUpdates,
        expectPartialUpdates: true,
        expectCalendarSkip: false // Still needs refresh for title
      });

      expect(result.success).toBe(true);
      expect(result.partialUpdatesUsed).toBe(true);
      expect(mockListView.updateTaskInPlace).toHaveBeenCalled();
    });

    it('should handle view synchronization errors gracefully', async () => {
      const task = TaskFactory.createTask({
        title: 'Error resilience task'
      });

      const mockWorkingView = { 
        viewType: 'task-list', 
        refresh: jest.fn() 
      };
      
      const mockFailingView = { 
        viewType: 'calendar', 
        refresh: jest.fn().mockRejectedValue(new Error('Calendar refresh failed'))
      };

      testEnv.mockApp.workspace.iterateAllLeaves.mockImplementation((callback) => {
        callback({ view: mockWorkingView });
        callback({ view: mockFailingView });
      });

      const updates = {
        status: 'done'
      };

      const result = await workflowTester.testViewSyncErrorHandling({
        task,
        updates,
        expectPartialSuccess: true,
        expectErrorLogging: true
      });

      expect(result.success).toBe(true);
      expect(result.partialSuccess).toBe(true);
      expect(result.errorLogged).toBe(true);
      expect(mockWorkingView.refresh).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Date-Based Filtering and Display', () => {
    it('should filter tasks correctly by date range', async () => {
      const tasks = [
        TaskFactory.createTask({ title: 'Past task', due: '2025-01-10' }),
        TaskFactory.createTask({ title: 'Today task', due: '2025-01-15' }),
        TaskFactory.createTask({ title: 'Future task', due: '2025-01-20' }),
        TaskFactory.createTask({ title: 'No date task' })
      ];

      const dateRange = {
        start: new Date('2025-01-14'),
        end: new Date('2025-01-16')
      };

      const result = await workflowTester.testDateRangeFiltering({
        tasks,
        dateRange,
        expectedFilteredCount: 1, // Only "Today task"
        expectCorrectFiltering: true
      });

      expect(result.success).toBe(true);
      expect(result.filteredCount).toBe(1);
      expect(result.correctFiltering).toBe(true);
    });

    it('should handle timezone considerations in date filtering', async () => {
      const tasksWithTimezones = [
        TaskFactory.createTask({ 
          title: 'UTC task', 
          due: '2025-01-15T23:00:00Z' 
        }),
        TaskFactory.createTask({ 
          title: 'Local timezone task', 
          due: '2025-01-15T14:00:00-08:00' 
        })
      ];

      const result = await workflowTester.testTimezoneFiltering({
        tasks: tasksWithTimezones,
        userTimezone: 'America/Los_Angeles',
        targetDate: '2025-01-15',
        expectCorrectTimezoneHandling: true
      });

      expect(result.success).toBe(true);
      expect(result.timezoneHandledCorrectly).toBe(true);
    });

    it('should display overdue tasks correctly', async () => {
      const overdueTasks = [
        TaskFactory.createTask({ 
          title: 'Overdue task 1', 
          due: '2025-01-10',
          status: 'open'
        }),
        TaskFactory.createTask({ 
          title: 'Overdue task 2', 
          due: '2025-01-12T14:00',
          status: 'in-progress'
        }),
        TaskFactory.createTask({ 
          title: 'Completed overdue', 
          due: '2025-01-11',
          status: 'done'
        })
      ];

      const result = await workflowTester.testOverdueTaskDisplay({
        tasks: overdueTasks,
        expectOverdueHighlighting: true,
        expectCompletedExclusion: true,
        expectedOverdueCount: 2
      });

      expect(result.success).toBe(true);
      expect(result.overdueHighlighted).toBe(true);
      expect(result.completedExcluded).toBe(true);
      expect(result.overdueCount).toBe(2);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large datasets efficiently in calendar view', async () => {
      const largeDateRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-12-31')
      };

      const manyTasks = Array.from({ length: 1000 }, (_, i) => {
        const date = new Date('2025-01-01');
        date.setDate(date.getDate() + (i % 365));
        
        return TaskFactory.createTask({
          title: `Task ${i + 1}`,
          scheduled: date.toISOString().split('T')[0],
          due: date.toISOString().split('T')[0]
        });
      });

      const startTime = Date.now();
      
      const result = await workflowTester.testLargeDatasetCalendarPerformance({
        tasks: manyTasks,
        dateRange: largeDateRange,
        expectEfficientFiltering: true,
        expectReasonableLoadTime: true
      });

      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.efficientFiltering).toBe(true);
      expect(endTime - startTime).toBeLessThan(3000); // Should load in under 3 seconds
    });

    it('should optimize recurring task instance generation', async () => {
      const dailyRecurringTask = TaskFactory.createRecurringTask('FREQ=DAILY', {
        title: 'Daily task'
      });

      const yearLongRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-12-31')
      };

      const startTime = Date.now();
      
      const result = await workflowTester.testRecurringTaskPerformance({
        recurringTask: dailyRecurringTask,
        dateRange: yearLongRange,
        expectOptimizedGeneration: true,
        expectMemoryEfficiency: true
      });

      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.optimizedGeneration).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast even for year-long range
    });

    it('should handle real-time updates efficiently', async () => {
      const mockCalendarView = {
        refresh: jest.fn(),
        getCalendarApi: jest.fn().mockReturnValue({
          addEvent: jest.fn(),
          removeEvent: jest.fn(),
          refetchEvents: jest.fn()
        })
      };

      testEnv.mockApp.workspace.getLeavesOfType.mockReturnValue([
        { view: mockCalendarView }
      ]);

      // Simulate rapid consecutive updates
      const rapidUpdates = Array.from({ length: 20 }, (_, i) => ({
        title: `Rapid update ${i + 1}`,
        scheduled: '2025-01-15'
      }));

      const startTime = Date.now();
      
      const results = await Promise.all(
        rapidUpdates.map(update => 
          workflowTester.testRealTimeCalendarUpdate(update)
        )
      );

      const endTime = Date.now();

      expect(results.every(r => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(2000); // Should handle rapid updates efficiently
      
      // Should use debouncing/batching to reduce refresh calls
      expect(mockCalendarView.refresh.mock.calls.length).toBeLessThan(20);
    });
  });

  describe('External Calendar Integration', () => {
    it('should sync with external calendar sources', async () => {
      const externalEvents = [
        {
          id: 'ext-1',
          title: 'External meeting',
          start: '2025-01-15T10:00:00',
          end: '2025-01-15T11:00:00',
          source: 'google-calendar'
        },
        {
          id: 'ext-2',
          title: 'Another external event',
          start: '2025-01-15T14:00:00',
          end: '2025-01-15T15:30:00',
          source: 'outlook'
        }
      ];

      const result = await workflowTester.testExternalCalendarSync({
        externalEvents,
        expectEventImport: true,
        expectConflictDetection: true,
        expectTwoWaySync: false // Usually read-only for external events
      });

      expect(result.success).toBe(true);
      expect(result.eventsImported).toBe(2);
      expect(result.conflictsDetected).toBeDefined();
    });

    it('should handle ICS calendar subscription updates', async () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-event-1
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
SUMMARY:ICS Test Event
END:VEVENT
END:VCALENDAR`;

      const result = await workflowTester.testIcsCalendarSync({
        icsData,
        expectParsing: true,
        expectEventCreation: true,
        expectSubscriptionUpdate: true
      });

      expect(result.success).toBe(true);
      expect(result.parsed).toBe(true);
      expect(result.eventsCreated).toBeGreaterThan(0);
      expect(result.subscriptionUpdated).toBe(true);
    });
  });
});