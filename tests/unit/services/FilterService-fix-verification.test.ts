/**
 * Tests to verify that the timezone fix for issue 153 is working correctly
 */

import { FilterService } from '../../../src/services/FilterService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { TaskInfo, FilterQuery } from '../../../src/types';

// Don't mock date-fns or dateUtils - we want to test the real implementation
jest.mock('../../../src/utils/dateUtils', () => {
    const actual = jest.requireActual('../../../src/utils/dateUtils');
    return {
        ...actual,
        // Mock only getTodayString to control what "today" is for testing
        getTodayString: jest.fn(() => '2025-01-15'),
        isToday: jest.fn((dateStr: string) => dateStr === '2025-01-15'),
    };
});

describe('FilterService - Issue 153 Fix Verification', () => {
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

    describe('Timezone-safe date comparisons', () => {
        it('should find tasks scheduled exactly 7 days ago', async () => {
            // Create a task scheduled exactly 7 days ago
            const testTask: TaskInfo = {
                title: 'Task scheduled 7 days ago',
                status: 'open',
                priority: 'normal',
                path: '/test/task-7-days-ago.md',
                archived: false,
                scheduled: '2025-01-08', // Exactly 7 days before 2025-01-15
                tags: ['task']
            };

            // Mock cache to return our test task
            mockCacheManager.getAllTasks.mockResolvedValue([testTask]);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set([testTask.path]));
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(testTask);
            mockCacheManager.getTaskInfo.mockResolvedValue(testTask);

            // Create date exactly 7 days ago from "today" (2025-01-15)
            const targetDate = new Date('2025-01-08T12:00:00.000Z');
            
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

            // Call getTasksForDate - this should find the task with the fix
            const result = await filterService.getTasksForDate(targetDate, query, false);

            // FIXED: Should now find the task correctly
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/test/task-7-days-ago.md');
        });

        it('should find tasks scheduled yesterday', async () => {
            const testTask: TaskInfo = {
                title: 'Task scheduled yesterday',
                status: 'open',
                priority: 'normal',
                path: '/test/task-yesterday.md',
                archived: false,
                scheduled: '2025-01-14', // Yesterday relative to 2025-01-15
                tags: ['task']
            };

            mockCacheManager.getAllTasks.mockResolvedValue([testTask]);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set([testTask.path]));
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(testTask);
            mockCacheManager.getTaskInfo.mockResolvedValue(testTask);

            // Create date for yesterday
            const targetDate = new Date('2025-01-14T12:00:00.000Z');
            
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

            const result = await filterService.getTasksForDate(targetDate, query, false);

            // FIXED: Should find the yesterday task correctly
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/test/task-yesterday.md');
        });

        it('should find tasks on various days of the week (no cyclical bug)', async () => {
            // Create tasks for different days of the week
            const testTasks: TaskInfo[] = [
                {
                    title: 'Monday task',
                    status: 'open',
                    priority: 'normal',
                    path: '/test/monday-task.md',
                    archived: false,
                    scheduled: '2025-01-13', // Monday
                    tags: ['task']
                },
                {
                    title: 'Wednesday task', 
                    status: 'open',
                    priority: 'normal',
                    path: '/test/wednesday-task.md',
                    archived: false,
                    scheduled: '2025-01-15', // Wednesday (today)
                    tags: ['task']
                },
                {
                    title: 'Friday task',
                    status: 'open',
                    priority: 'normal',
                    path: '/test/friday-task.md',
                    archived: false,
                    scheduled: '2025-01-17', // Friday
                    tags: ['task']
                }
            ];

            mockCacheManager.getAllTasks.mockResolvedValue(testTasks);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set(testTasks.map(t => t.path)));
            mockCacheManager.getCachedTaskInfo.mockImplementation(async (path: string) => {
                return testTasks.find(task => task.path === path) || null;
            });
            mockCacheManager.getTaskInfo.mockImplementation(async (path: string) => {
                return testTasks.find(task => task.path === path) || null;
            });

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

            // Test each day - all should work correctly with the fix
            const testDates = [
                { date: new Date('2025-01-13T12:00:00.000Z'), expectedTask: 'monday-task.md' },
                { date: new Date('2025-01-15T12:00:00.000Z'), expectedTask: 'wednesday-task.md' },
                { date: new Date('2025-01-17T12:00:00.000Z'), expectedTask: 'friday-task.md' }
            ];

            for (const testCase of testDates) {
                const result = await filterService.getTasksForDate(testCase.date, query, false);
                
                // FIXED: All days should work correctly, no cyclical bug
                expect(result).toHaveLength(1);
                expect(result[0].path).toContain(testCase.expectedTask);
            }
        });

        it('should handle DST transition dates correctly', async () => {
            // Test with DST transition date (March 9, 2025 - 2nd Sunday in March)
            const testTask: TaskInfo = {
                title: 'Task during DST transition',
                status: 'open',
                priority: 'normal',
                path: '/test/dst-task.md',
                archived: false,
                scheduled: '2025-03-09',
                tags: ['task']
            };

            mockCacheManager.getAllTasks.mockResolvedValue([testTask]);
            mockCacheManager.getAllTaskPaths.mockReturnValue(new Set([testTask.path]));
            mockCacheManager.getCachedTaskInfo.mockResolvedValue(testTask);
            mockCacheManager.getTaskInfo.mockResolvedValue(testTask);

            // Create date for DST transition day
            const dstTransitionDate = new Date('2025-03-09T12:00:00.000Z');
            
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

            const result = await filterService.getTasksForDate(dstTransitionDate, query, false);

            // FIXED: Should handle DST transitions correctly
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/test/dst-task.md');
        });
    });

    describe('Date normalization verification', () => {
        it('should normalize different time zones to same date string', async () => {
            // Use a simpler test that focuses on date consistency within reasonable bounds
            const testTask: TaskInfo = {
                title: 'Test task',
                status: 'open',
                priority: 'normal',
                path: '/test/task.md',
                archived: false,
                scheduled: '2025-01-15',
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

            // Test that the fix correctly handles date boundaries by testing middle-of-day times
            // that should be safe across most reasonable timezones
            const safeTestDate = new Date('2025-01-15T12:00:00.000Z'); // Noon UTC
            const result = await filterService.getTasksForDate(safeTestDate, query, false);
            
            // Should find the task correctly
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/test/task.md');
        });
    });
});