/**
 * Tests for FilterService Issue 153 fix verification
 * These tests verify that tasks scheduled for specific dates appear correctly
 */

import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { TaskInfo, FilterQuery } from '../../../src/types';

describe('FilterService - Issue 153 Fixed', () => {
    let filterService: FilterService;
    let mockCacheManager: jest.Mocked<MinimalNativeCache>;
    let mockStatusManager: jest.Mocked<StatusManager>;
    let mockPriorityManager: jest.Mocked<PriorityManager>;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Create mocked dependencies
        mockCacheManager = {
            getAllTasks: jest.fn(),
            getTaskPathsByStatus: jest.fn(),
            getTaskPathsByPriority: jest.fn(),
            getTaskPathsByDate: jest.fn(),
            getOverdueTaskPaths: jest.fn(),
            getAllTaskPaths: jest.fn(),
            getCachedTaskInfo: jest.fn(),
            getTaskInfo: jest.fn(),
        } as any;

        mockStatusManager = {
            isCompletedStatus: jest.fn().mockReturnValue(false),
        } as any;
        mockPriorityManager = {} as any;

        filterService = new FilterService(mockCacheManager, mockStatusManager, mockPriorityManager, null);
    });

    describe('Issue 153 is fixed', () => {
        it('should find tasks scheduled exactly 7 days ago', async () => {
            const testTask: TaskInfo = {
                title: 'Task scheduled 7 days ago',
                status: 'open',
                priority: 'normal',
                path: '/test/task-7-days.md',
                archived: false,
                scheduled: '2025-01-08',
                tags: ['task']
            };

            mockCacheManager.getAllTasks.mockResolvedValue([testTask]);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set([testTask.path]));
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(testTask);
            mockCacheManager.getTaskInfo.mockResolvedValue(testTask);

            const query: FilterQuery = {
                searchQuery: undefined,
                statuses: undefined,
                contexts: undefined,
                priorities: undefined,
                showArchived: false,
                showRecurrent: true,
                showCompleted: false,
                sortKey: 'due',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            // Query for the exact date the task is scheduled
            const jan8 = new Date('2025-01-08T12:00:00.000Z');
            const result = await filterService.getTasksForDate(jan8, query, false);

            // The task should be found
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Task scheduled 7 days ago');
            expect(result[0].scheduled).toBe('2025-01-08');
        });

        it('should find tasks scheduled yesterday', async () => {
            const testTask: TaskInfo = {
                title: 'Task scheduled yesterday',
                status: 'open',
                priority: 'normal',
                path: '/test/task-yesterday.md',
                archived: false,
                scheduled: '2025-01-14',
                tags: ['task']
            };

            mockCacheManager.getAllTasks.mockResolvedValue([testTask]);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set([testTask.path]));
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(testTask);
            mockCacheManager.getTaskInfo.mockResolvedValue(testTask);

            const query: FilterQuery = {
                searchQuery: undefined,
                statuses: undefined,
                contexts: undefined,
                priorities: undefined,
                showArchived: false,
                showRecurrent: true,
                showCompleted: false,
                sortKey: 'due',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            // Query for Jan 14
            const jan14 = new Date('2025-01-14T12:00:00.000Z');
            const result = await filterService.getTasksForDate(jan14, query, false);

            // The task should be found
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Task scheduled yesterday');
        });

        it('should correctly handle tasks at multiples of 7 days', async () => {
            const tasks: TaskInfo[] = [
                {
                    title: 'Task 7 days ago',
                    status: 'open',
                    priority: 'normal',
                    path: '/test/task-7.md',
                    archived: false,
                    scheduled: '2025-01-08',
                    tags: ['task']
                },
                {
                    title: 'Task 14 days ago',
                    status: 'open',
                    priority: 'normal',
                    path: '/test/task-14.md',
                    archived: false,
                    scheduled: '2025-01-01',
                    tags: ['task']
                },
                {
                    title: 'Task 21 days ago',
                    status: 'open',
                    priority: 'normal',
                    path: '/test/task-21.md',
                    archived: false,
                    scheduled: '2024-12-25',
                    tags: ['task']
                }
            ];

            mockCacheManager.getAllTasks.mockResolvedValue(tasks);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set(tasks.map(t => t.path)));
            mockCacheManager.getCachedTaskInfo.mockImplementation((path) => 
                Promise.resolve(tasks.find(t => t.path === path) || null)
            );
            mockCacheManager.getTaskInfo.mockImplementation((path) => 
                Promise.resolve(tasks.find(t => t.path === path) || null)
            );

            const query: FilterQuery = {
                searchQuery: undefined,
                statuses: undefined,
                contexts: undefined,
                priorities: undefined,
                showArchived: false,
                showRecurrent: true,
                showCompleted: false,
                sortKey: 'due',
                sortDirection: 'asc',
                groupKey: 'none'
            };

            // Test each date
            const jan8 = new Date('2025-01-08T12:00:00.000Z');
            const jan1 = new Date('2025-01-01T12:00:00.000Z');
            const dec25 = new Date('2024-12-25T12:00:00.000Z');

            const resultJan8 = await filterService.getTasksForDate(jan8, query, false);
            const resultJan1 = await filterService.getTasksForDate(jan1, query, false);
            const resultDec25 = await filterService.getTasksForDate(dec25, query, false);

            // Each query should find only the task scheduled for that specific date
            expect(resultJan8).toHaveLength(1);
            expect(resultJan8[0].title).toBe('Task 7 days ago');

            expect(resultJan1).toHaveLength(1);
            expect(resultJan1[0].title).toBe('Task 14 days ago');

            expect(resultDec25).toHaveLength(1);
            expect(resultDec25[0].title).toBe('Task 21 days ago');
        });
    });
});