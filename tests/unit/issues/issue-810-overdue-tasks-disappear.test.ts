import { FilterService } from '../../../src/services/FilterService';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { FilterQuery, TaskInfo } from '../../../src/types';
import { TaskFactory, PluginFactory } from '../../helpers/mock-factories';
import { createUTCDateFromLocalCalendarDate, formatDateForStorage, getTodayLocal } from '../../../src/utils/dateUtils';

describe('Issue #810 - Overdue tasks disappear in agenda view when clicking "today"', () => {
    let filterService: FilterService;
    let mockCacheManager: any;
    let statusManager: StatusManager;
    let priorityManager: PriorityManager;
    let mockPlugin: any;

    beforeEach(() => {
        // Setup mock services
        statusManager = new StatusManager([
            { id: 'open', value: ' ', label: 'Open', color: '#000000', isCompleted: false, order: 1 },
            { id: 'done', value: 'x', label: 'Done', color: '#00ff00', isCompleted: true, order: 2 }
        ]);
        priorityManager = new PriorityManager([
            { id: 'normal', value: 'normal', label: 'Normal', color: '#000000', weight: 0 }
        ]);
        mockCacheManager = PluginFactory.createMockPlugin().cacheManager;

        mockPlugin = {
            settings: {
                hideCompletedFromOverdue: true,
                userFields: []
            },
            i18n: {
                translate: (key: string) => key,
                getCurrentLocale: () => 'en'
            }
        };

        filterService = new FilterService(
            mockCacheManager,
            statusManager,
            priorityManager,
            mockPlugin
        );
    });

    it('should show overdue tasks when showOverdueSection is enabled', async () => {
        // Use explicit dates for testing (UTC dates to match formatDateForStorage)
        const today = new Date(Date.UTC(2025, 9, 6)); // Oct 6, 2025 UTC
        const yesterday = new Date(Date.UTC(2025, 9, 5)); // Oct 5, 2025 UTC
        const tomorrow = new Date(Date.UTC(2025, 9, 7)); // Oct 7, 2025 UTC

        // Create tasks with different dates
        const overdueTask: TaskInfo = TaskFactory.createTask({
            path: 'test-overdue.md',
            content: '- [ ] Overdue task',
            due: formatDateForStorage(yesterday),
            status: ' ',
        });

        const todayTask: TaskInfo = TaskFactory.createTask({
            path: 'test-today.md',
            content: '- [ ] Today task',
            due: formatDateForStorage(today),
            status: ' ',
        });

        const recurringOverdueTask: TaskInfo = TaskFactory.createTask({
            path: 'test-recurring.md',
            content: '- [ ] Recurring task',
            scheduled: formatDateForStorage(yesterday),
            recurrence: 'RRULE:FREQ=DAILY',
            status: ' ',
        });

        // Mock the cache to return our test tasks
        mockCacheManager.getAllTaskPaths.mockReturnValue([
            overdueTask.path,
            todayTask.path,
            recurringOverdueTask.path
        ]);

        mockCacheManager.getCachedTaskInfo.mockImplementation((path: string) => {
            if (path === overdueTask.path) return Promise.resolve(overdueTask);
            if (path === todayTask.path) return Promise.resolve(todayTask);
            if (path === recurringOverdueTask.path) return Promise.resolve(recurringOverdueTask);
            return Promise.resolve(null);
        });

        // Create a default filter query (no filters, just sorting)
        const query: FilterQuery = {
            type: 'group',
            id: 'root',
            conjunction: 'and',
            children: [],
            sortKey: 'scheduled',
            sortDirection: 'asc',
            groupKey: 'none'
        };

        // Get agenda data for today with overdue section enabled
        const todayUTC = createUTCDateFromLocalCalendarDate(today);
        const { dailyData, overdueTasks } = await filterService.getAgendaDataWithOverdue(
            [todayUTC],
            query,
            true // showOverdueSection = true
        );

        // EXPECTED BEHAVIOR:
        // 1. overdueTasks should contain the overdue non-recurring task
        // 2. dailyData[0] (today) should only contain todayTask
        // 3. Recurring tasks with past scheduled dates should appear in overdueTasks

        console.log('Daily data:', dailyData);
        console.log('Overdue tasks:', overdueTasks);

        // Verify overdue section contains overdue tasks
        expect(overdueTasks.length).toBeGreaterThan(0);
        expect(overdueTasks.some(t => t.path === overdueTask.path)).toBe(true);

        // Verify recurring overdue task appears in overdue section
        expect(overdueTasks.some(t => t.path === recurringOverdueTask.path)).toBe(true);

        // Verify today's tasks don't include overdue tasks
        const todayTasks = dailyData[0].tasks;
        expect(todayTasks.some(t => t.path === todayTask.path)).toBe(true);

        // Overdue tasks should NOT appear in the daily section (only in overdue section)
        expect(todayTasks.some(t => t.path === overdueTask.path)).toBe(false);
    });

    it('should include overdue tasks in overdue section after updating task due date to today', async () => {
        const today = new Date(Date.UTC(2025, 9, 6)); // Oct 6, 2025 UTC
        const yesterday = new Date(Date.UTC(2025, 9, 5)); // Oct 5, 2025 UTC

        // Create a task that was overdue but is now updated to today
        const taskUpdatedToToday: TaskInfo = TaskFactory.createTask({
            path: 'test-updated.md',
            content: '- [ ] Task updated to today',
            due: formatDateForStorage(today),
            status: ' ',
        });

        // Mock the cache
        mockCacheManager.getAllTaskPaths.mockReturnValue([taskUpdatedToToday.path]);
        mockCacheManager.getCachedTaskInfo.mockResolvedValue(taskUpdatedToToday);

        const query: FilterQuery = {
            type: 'group',
            id: 'root',
            conjunction: 'and',
            children: [],
            sortKey: 'scheduled',
            sortDirection: 'asc',
            groupKey: 'none'
        };

        const todayUTC = createUTCDateFromLocalCalendarDate(today);
        const { dailyData, overdueTasks } = await filterService.getAgendaDataWithOverdue(
            [todayUTC],
            query,
            true
        );

        // Task due today should appear in today's section, NOT in overdue
        expect(dailyData[0].tasks.some(t => t.path === taskUpdatedToToday.path)).toBe(true);
        expect(overdueTasks.some(t => t.path === taskUpdatedToToday.path)).toBe(false);
    });

    it('should handle recurring tasks correctly - not show as overdue if current instance is today/future', async () => {
        const today = new Date(Date.UTC(2025, 9, 6)); // Oct 6, 2025 UTC
        const yesterday = new Date(Date.UTC(2025, 9, 5)); // Oct 5, 2025 UTC

        // Recurring task with scheduled date as yesterday
        // But the current instance (evaluated for today) should appear on today
        const recurringTask: TaskInfo = TaskFactory.createTask({
            path: 'test-recurring-today.md',
            content: '- [ ] Daily recurring task',
            scheduled: formatDateForStorage(today), // Current scheduled instance is today
            recurrence: 'RRULE:FREQ=DAILY',
            status: ' ',
        });

        mockCacheManager.getAllTaskPaths.mockReturnValue([recurringTask.path]);
        mockCacheManager.getCachedTaskInfo.mockResolvedValue(recurringTask);

        const query: FilterQuery = {
            type: 'group',
            id: 'root',
            conjunction: 'and',
            children: [],
            sortKey: 'scheduled',
            sortDirection: 'asc',
            groupKey: 'none'
        };

        const todayUTC = createUTCDateFromLocalCalendarDate(today);
        const { dailyData, overdueTasks } = await filterService.getAgendaDataWithOverdue(
            [todayUTC],
            query,
            true
        );

        // Recurring task with today's scheduled date should appear on today, not in overdue
        expect(dailyData[0].tasks.some(t => t.path === recurringTask.path)).toBe(true);
        expect(overdueTasks.some(t => t.path === recurringTask.path)).toBe(false);
    });
});
