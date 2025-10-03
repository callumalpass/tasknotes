import { FilterService } from '../../../src/services/FilterService';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { FilterQuery, TaskInfo } from '../../../src/types';
import { createMockCacheManager, createMockTaskInfo } from '../../helpers/mock-factories';
import { addDays, subDays } from 'date-fns';
import { createUTCDateFromLocalCalendarDate, formatDateForStorage, getTodayLocal } from '../../../src/utils/dateUtils';

describe('Issue #810 - Overdue tasks disappear in agenda view when clicking "today"', () => {
    let filterService: FilterService;
    let mockCacheManager: any;
    let statusManager: StatusManager;
    let priorityManager: PriorityManager;
    let mockPlugin: any;

    beforeEach(() => {
        // Setup mock services
        statusManager = new StatusManager();
        priorityManager = new PriorityManager();
        mockCacheManager = createMockCacheManager();

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
        const today = getTodayLocal();
        const yesterday = subDays(today, 1);
        const tomorrow = addDays(today, 1);

        // Create tasks with different dates
        const overdueTask: TaskInfo = createMockTaskInfo({
            path: 'test-overdue.md',
            content: '- [ ] Overdue task',
            due: formatDateForStorage(yesterday),
            status: ' ',
        });

        const todayTask: TaskInfo = createMockTaskInfo({
            path: 'test-today.md',
            content: '- [ ] Today task',
            due: formatDateForStorage(today),
            status: ' ',
        });

        const recurringOverdueTask: TaskInfo = createMockTaskInfo({
            path: 'test-recurring.md',
            content: '- [ ] Recurring task',
            scheduled: formatDateForStorage(yesterday),
            recurrence: 'every day',
            status: ' ',
        });

        // Mock the cache to return our test tasks
        mockCacheManager.getAllTaskPaths.mockReturnValue([
            overdueTask.path,
            todayTask.path,
            recurringOverdueTask.path
        ]);

        mockCacheManager.getTaskInfo.mockImplementation((path: string) => {
            if (path === overdueTask.path) return overdueTask;
            if (path === todayTask.path) return todayTask;
            if (path === recurringOverdueTask.path) return recurringOverdueTask;
            return null;
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
        const today = getTodayLocal();
        const yesterday = subDays(today, 1);

        // Create a task that was overdue but is now updated to today
        const taskUpdatedToToday: TaskInfo = createMockTaskInfo({
            path: 'test-updated.md',
            content: '- [ ] Task updated to today',
            due: formatDateForStorage(today),
            status: ' ',
        });

        // Mock the cache
        mockCacheManager.getAllTaskPaths.mockReturnValue([taskUpdatedToToday.path]);
        mockCacheManager.getTaskInfo.mockReturnValue(taskUpdatedToToday);

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
        const today = getTodayLocal();
        const yesterday = subDays(today, 1);

        // Recurring task with scheduled date as yesterday
        // But the current instance (evaluated for today) should appear on today
        const recurringTask: TaskInfo = createMockTaskInfo({
            path: 'test-recurring-today.md',
            content: '- [ ] Daily recurring task',
            scheduled: formatDateForStorage(today), // Current scheduled instance is today
            recurrence: 'every day',
            status: ' ',
        });

        mockCacheManager.getAllTaskPaths.mockReturnValue([recurringTask.path]);
        mockCacheManager.getTaskInfo.mockReturnValue(recurringTask);

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
