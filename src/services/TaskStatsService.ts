import { MinimalNativeCache } from '../utils/MinimalNativeCache';
import { TaskInfo } from '../types';

export class TaskStatsService {
    constructor(private cache: MinimalNativeCache) {}

    /**
     * Aggregates the time estimate of tasks within a given date range.
     * @param range - The date range to aggregate tasks for. Can be a predefined string
     *                or a custom range with start and end dates.
     * @returns The total time estimate in minutes.
     */
    public async getAggregatedTimeEstimate(range: 'daily' | 'weekly' | 'monthly' | 'yearly' | { start: Date, end: Date }): Promise<number> {
        const allTimeEstimates = this.cache.getAllTimeEstimates();
        if (allTimeEstimates.size === 0) {
            return 0;
        }

        const { start, end } = this.getDateRange(range);

        let totalMinutes = 0;
        for (const [path, timeEstimate] of allTimeEstimates.entries()) {
            const task = await this.cache.getTaskInfo(path);
            if (task && this.isTaskInRange(task, start, end)) {
                totalMinutes += timeEstimate;
            }
        }

        return totalMinutes;
    }

    private isTaskInRange(task: TaskInfo, start: Date, end: Date): boolean {
        const taskDate = task.due || task.scheduled;
        if (!taskDate) {
            return false;
        }

        const date = new Date(taskDate);
        return date >= start && date <= end;
    }

    private getDateRange(range: 'daily' | 'weekly' | 'monthly' | 'yearly' | { start: Date, end: Date }): { start: Date, end: Date } {
        if (typeof range !== 'string') {
            return range;
        }

        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        switch (range) {
            case 'daily':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'weekly':
                const dayOfWeek = now.getDay();
                const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when week starts on Sunday
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            case 'monthly':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(start.getMonth() + 1);
                end.setDate(0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'yearly':
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                end.setFullYear(start.getFullYear() + 1);
                end.setDate(0);
                end.setHours(23, 59, 59, 999);
                break;
        }

        return { start, end };
    }
}
