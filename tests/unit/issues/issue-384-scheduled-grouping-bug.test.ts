/**
 * Regression test for Issue #384: tasks scheduled for today should not appear in "Past scheduled".
 * Confirms the UTC anchor fix keeps today's scheduled tasks grouped under "Today" even for UTC-8 users.
 */

import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { FilterQuery, TaskInfo } from '../../../src/types';
import { isOverdueTimeAware } from '../../../src/utils/dateUtils';
import * as dateFns from 'date-fns';

describe('Issue #384: Scheduled grouping misclassifies today as past', () => {
    let filterService: FilterService;
    let mockCacheManager: jest.Mocked<MinimalNativeCache>;
    let mockStatusManager: jest.Mocked<StatusManager>;
    let mockPriorityManager: jest.Mocked<PriorityManager>;
    let startOfDaySpy: jest.SpyInstance;

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        // Simulate a user in UTC-8 (Pacific) so local midnight occurs at 08:00 UTC
        startOfDaySpy = jest.spyOn(dateFns, 'startOfDay').mockImplementation((inputDate: Date) => {
            const result = new Date(Date.UTC(
                inputDate.getUTCFullYear(),
                inputDate.getUTCMonth(),
                inputDate.getUTCDate(),
                8, 0, 0, 0
            ));
            return result;
        });

        const scheduledTask: TaskInfo = {
            title: 'Task scheduled for today',
            status: 'todo',
            priority: 'normal',
            scheduled: '2025-01-15',
            path: '/tasks/today.md',
            archived: false
        };

        mockCacheManager = {
            getAllTaskPaths: jest.fn().mockReturnValue(new Set([scheduledTask.path])),
            getCachedTaskInfo: jest.fn().mockImplementation(async (path: string) => {
                return path === scheduledTask.path ? scheduledTask : null;
            })
        } as any;

        mockStatusManager = {
            isCompletedStatus: jest.fn().mockReturnValue(false)
        } as any;

        mockPriorityManager = {
            getPriorityWeight: jest.fn().mockReturnValue(1)
        } as any;

        const plugin = { settings: { hideCompletedFromOverdue: true } };

        filterService = new FilterService(
            mockCacheManager,
            mockStatusManager,
            mockPriorityManager,
            plugin
        );
    });

    afterEach(() => {
        startOfDaySpy?.mockRestore();
    });

    it('keeps a task scheduled for today in the "Today" group', async () => {
        // Sanity check: helper should respect UTC anchor and not mark today as overdue
        expect(isOverdueTimeAware('2025-01-15', false, true)).toBe(false);

        const query: FilterQuery = {
            type: 'group',
            id: 'root',
            conjunction: 'and',
            children: [],
            sortKey: 'scheduled',
            sortDirection: 'asc',
            groupKey: 'scheduled'
        };

        const groups = await filterService.getGroupedTasks(query);

        const todayGroup = groups.get('Today');
        expect(todayGroup).toBeDefined();
        expect(todayGroup).toHaveLength(1);
        expect(todayGroup?.[0].title).toBe('Task scheduled for today');

        const pastScheduledGroup = groups.get('Past scheduled');
        expect(pastScheduledGroup).toBeUndefined();
    });
});
