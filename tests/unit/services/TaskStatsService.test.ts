import { TaskStatsService } from '../../../src/services/TaskStatsService';
import { MinimalNativeCache } from '../../../src/utils/MinimalNativeCache';
import { TaskInfo } from '../../../src/types';

// Mock the MinimalNativeCache
const mockCache = {
    getAllTimeEstimates: jest.fn(),
    getTaskInfo: jest.fn(),
} as unknown as MinimalNativeCache;

describe('TaskStatsService', () => {
    let taskStatsService: TaskStatsService;

    beforeEach(() => {
        jest.clearAllMocks();
        taskStatsService = new TaskStatsService(mockCache);
    });

    describe('getAggregatedTimeEstimate', () => {
        it('should return 0 if the cache is empty', async () => {
            (mockCache.getAllTimeEstimates as jest.Mock).mockReturnValue(new Map());
            const result = await taskStatsService.getAggregatedTimeEstimate('daily');
            expect(result).toBe(0);
        });

        it('should calculate the total for a daily range', async () => {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            const tasks = new Map<string, number>([
                ['task1.md', 30],
                ['task2.md', 60],
                ['task3.md', 15] // This one is for tomorrow
            ]);

            (mockCache.getAllTimeEstimates as jest.Mock).mockReturnValue(tasks);
            (mockCache.getTaskInfo as jest.Mock).mockImplementation(async (path: string) => {
                if (path === 'task1.md') return { due: todayStr } as TaskInfo;
                if (path === 'task2.md') return { scheduled: todayStr } as TaskInfo;
                if (path === 'task3.md') {
                    const tomorrow = new Date(today);
                    tomorrow.setDate(today.getDate() + 1);
                    return { due: tomorrow.toISOString().split('T')[0] } as TaskInfo;
                }
                return null;
            });

            const result = await taskStatsService.getAggregatedTimeEstimate('daily');
            expect(result).toBe(90); // 30 + 60
        });

        it('should calculate the total for a custom range', async () => {
            const startDate = new Date('2025-01-10');
            const endDate = new Date('2025-01-20');

            const tasks = new Map<string, number>([
                ['task1.md', 45], // in range
                ['task2.md', 25], // out of range (before)
                ['task3.md', 50], // in range
                ['task4.md', 30]  // out of range (after)
            ]);

            (mockCache.getAllTimeEstimates as jest.Mock).mockReturnValue(tasks);
            (mockCache.getTaskInfo as jest.Mock).mockImplementation(async (path: string) => {
                if (path === 'task1.md') return { due: '2025-01-15' } as TaskInfo;
                if (path === 'task2.md') return { due: '2025-01-05' } as TaskInfo;
                if (path === 'task3.md') return { scheduled: '2025-01-18' } as TaskInfo;
                if (path === 'task4.md') return { due: '2025-01-25' } as TaskInfo;
                return null;
            });

            const result = await taskStatsService.getAggregatedTimeEstimate({ start: startDate, end: endDate });
            expect(result).toBe(95); // 45 + 50
        });

        it('should return 0 for tasks in range but without timeEstimate (though getAllTimeEstimates should prevent this)', async () => {
            const todayStr = new Date().toISOString().split('T')[0];
            // getAllTimeEstimates only returns paths with estimates, so this map should be empty for this scenario
            const tasks = new Map<string, number>();

            (mockCache.getAllTimeEstimates as jest.Mock).mockReturnValue(tasks);
            
            const result = await taskStatsService.getAggregatedTimeEstimate('daily');
            expect(result).toBe(0);
        });

        it('should correctly sum a mix of tasks with and without estimates in a range', async () => {
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            // Only tasks with estimates will be in this map
            const tasksWithEstimates = new Map<string, number>([
                ['task1.md', 60],
                ['task3.md', 20]
            ]);

            (mockCache.getAllTimeEstimates as jest.Mock).mockReturnValue(tasksWithEstimates);
            (mockCache.getTaskInfo as jest.Mock).mockImplementation(async (path: string) => {
                // Task 2 has no estimate, so it won't be in the initial map, but we include it here to simulate its existence
                if (path === 'task1.md') return { due: todayStr, timeEstimate: 60 } as TaskInfo;
                if (path === 'task2.md') return { due: todayStr } as TaskInfo; // No timeEstimate
                if (path === 'task3.md') return { scheduled: todayStr, timeEstimate: 20 } as TaskInfo;
                return null;
            });

            const result = await taskStatsService.getAggregatedTimeEstimate('daily');
            expect(result).toBe(80); // 60 + 20
        });
    });
});
