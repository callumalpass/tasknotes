/**
 * Test for issue #692: Automatically change task priority to NONE when task is COMPLETED
 *
 * Feature Request Summary:
 * When a task is marked as completed, its priority should automatically be changed
 * to the lowest priority (NONE/lowest weight). This ensures completed tasks don't
 * appear as high priority when sorted by priority.
 *
 * User Story:
 * "When task is done it should have no priority. Therefore will not appear as
 * of any level of 'importance' when sorted by priority."
 *
 * Expected Behavior:
 * 1. When a task with any priority (high, medium, etc.) is marked as completed,
 *    its priority should automatically change to the lowest priority value
 * 2. This should happen automatically without user intervention
 * 3. When sorting completed tasks by priority, they should all appear at the
 *    bottom of the list (since they have lowest priority)
 *
 * Implementation Notes:
 * - The logic should be added in TaskService.updateProperty() around where
 *   completedDate is handled (lines 686-693)
 * - PriorityManager.getLowestPriority() can be used to get the lowest priority value
 * - This behavior may need to be configurable via settings (optional)
 */

import { PriorityManager } from '../../../src/services/PriorityManager';
import { PriorityConfig, TaskInfo, StatusConfig } from '../../../src/types';

describe('Issue #692: Priority reset on task completion', () => {
    let priorityManager: PriorityManager;
    let mockPriorities: PriorityConfig[];
    let mockStatuses: StatusConfig[];

    beforeEach(() => {
        mockPriorities = [
            { id: 'none', value: 'none', label: 'None', color: '#808080', weight: 0 },
            { id: 'low', value: 'low', label: 'Low', color: '#4CAF50', weight: 1 },
            { id: 'medium', value: 'medium', label: 'Medium', color: '#FF9800', weight: 2 },
            { id: 'high', value: 'high', label: 'High', color: '#F44336', weight: 3 },
            { id: 'critical', value: 'critical', label: 'Critical', color: '#9C27B0', weight: 4 },
        ];

        mockStatuses = [
            { id: 'open', value: 'open', label: 'Open', color: '#2196F3', isCompleted: false, order: 1 },
            { id: 'in-progress', value: 'in-progress', label: 'In Progress', color: '#FF9800', isCompleted: false, order: 2 },
            { id: 'done', value: 'done', label: 'Done', color: '#4CAF50', isCompleted: true, order: 3 },
            { id: 'cancelled', value: 'cancelled', label: 'Cancelled', color: '#9E9E9E', isCompleted: true, order: 4 },
        ];

        priorityManager = new PriorityManager(mockPriorities);
    });

    describe('Priority should be automatically reset when task is completed', () => {
        it.skip('should change priority to lowest when task status changes to completed - reproduces issue #692', async () => {
            // This test documents the expected behavior for issue #692
            // Currently, when a task is marked complete, its priority remains unchanged
            // After implementing this feature, completing a task should automatically
            // set its priority to the lowest value (e.g., "none" with weight 0)

            const highPriorityTask: Partial<TaskInfo> = {
                path: 'test/task.md',
                title: 'High priority task',
                status: 'open',
                priority: 'high', // weight: 3
            };

            // When the task is marked as done, the priority should automatically
            // change to the lowest priority value
            // Expected: task.priority === 'none' after completion
            const lowestPriority = priorityManager.getLowestPriority();
            expect(lowestPriority).toBe('none');

            // The updateProperty method in TaskService should automatically
            // update priority when status changes to a completed status
            // This assertion documents what SHOULD happen after the fix
            // expect(completedTask.priority).toBe('none');
        });

        it.skip('should reset priority for any completed status, not just "done" - reproduces issue #692', async () => {
            // The priority reset should happen for all completed statuses
            // (e.g., "done", "cancelled", "archived", etc.)

            const taskWithMediumPriority: Partial<TaskInfo> = {
                path: 'test/task.md',
                title: 'Medium priority task',
                status: 'open',
                priority: 'medium',
            };

            // When status changes to "cancelled" (which is also a completed status),
            // the priority should also be reset
            // Expected: task.priority === 'none' after cancellation
        });

        it.skip('should NOT reset priority when reopening a completed task - reproduces issue #692', async () => {
            // When a completed task is reopened (status changed from completed to open),
            // the priority should NOT be automatically changed
            // The user may want to restore a previous priority or set a new one manually

            const completedTask: Partial<TaskInfo> = {
                path: 'test/task.md',
                title: 'Completed task being reopened',
                status: 'done',
                priority: 'none', // Already at lowest after previous completion
            };

            // Reopening the task should leave priority unchanged
            // The user can manually adjust priority if needed
        });
    });

    describe('Completed tasks should sort to bottom when sorted by priority', () => {
        it.skip('should sort completed tasks after open tasks when sorted by priority - reproduces issue #692', () => {
            // After implementing issue #692, all completed tasks will have the
            // lowest priority, so they should naturally sort to the bottom

            const tasks: Partial<TaskInfo>[] = [
                { title: 'Completed high priority task', status: 'done', priority: 'none' }, // After fix, was 'high'
                { title: 'Open low priority task', status: 'open', priority: 'low' },
                { title: 'Open high priority task', status: 'open', priority: 'high' },
                { title: 'Completed critical task', status: 'done', priority: 'none' }, // After fix, was 'critical'
            ];

            // After sorting by priority (highest first), expected order:
            // 1. Open high priority task (weight: 3)
            // 2. Open low priority task (weight: 1)
            // 3. Completed high priority task (weight: 0 after fix)
            // 4. Completed critical task (weight: 0 after fix)

            // The key insight is that completed tasks, having their priority
            // automatically set to 'none' (weight: 0), will naturally sort
            // after all open tasks that have any priority
        });

        it.skip('should maintain original priority in task history/metadata for reference - reproduces issue #692', async () => {
            // Optional enhancement: store the original priority somewhere
            // so it can be referenced later (e.g., for analytics or undo)
            // This could be stored in a separate field like 'originalPriority'
            // or in a task history log

            // This is not strictly required for issue #692 but could be
            // a useful enhancement
        });
    });

    describe('PriorityManager helper methods', () => {
        it('should correctly identify the lowest priority value', () => {
            // PriorityManager.getLowestPriority() returns the priority with lowest weight
            const lowestPriority = priorityManager.getLowestPriority();
            expect(lowestPriority).toBe('none');
            expect(priorityManager.getPriorityWeight(lowestPriority!)).toBe(0);
        });

        it('should correctly identify the highest priority value', () => {
            const highestPriority = priorityManager.getHighestPriority();
            expect(highestPriority).toBe('critical');
            expect(priorityManager.getPriorityWeight(highestPriority!)).toBe(4);
        });

        it('should sort priorities correctly by weight', () => {
            const sortedAsc = priorityManager.getPrioritiesByWeightAsc();
            expect(sortedAsc.map(p => p.value)).toEqual(['none', 'low', 'medium', 'high', 'critical']);

            const sortedDesc = priorityManager.getPrioritiesByWeight();
            expect(sortedDesc.map(p => p.value)).toEqual(['critical', 'high', 'medium', 'low', 'none']);
        });
    });

    describe('Edge cases', () => {
        it.skip('should handle task with no priority set - reproduces issue #692', async () => {
            // If a task has no priority (undefined), completing it should
            // still set the priority to the lowest value

            const taskWithNoPriority: Partial<TaskInfo> = {
                path: 'test/task.md',
                title: 'Task with no priority',
                status: 'open',
                priority: undefined,
            };

            // After completion: task.priority should be 'none'
        });

        it.skip('should handle task that already has lowest priority - reproduces issue #692', async () => {
            // If a task already has the lowest priority, completing it
            // should not cause any issues (priority stays at 'none')

            const taskWithLowestPriority: Partial<TaskInfo> = {
                path: 'test/task.md',
                title: 'Task with lowest priority',
                status: 'open',
                priority: 'none',
            };

            // After completion: task.priority should still be 'none'
        });

        it.skip('should handle recurring tasks appropriately - reproduces issue #692', async () => {
            // Recurring tasks are a special case. When a recurring task is
            // "completed", it actually creates a new instance for the next
            // occurrence. The priority behavior here needs consideration:
            // - Should the original recurring task keep its priority?
            // - Should completed instances have their priority reset?
            // This may need special handling or be configurable

            const recurringTask: Partial<TaskInfo> = {
                path: 'test/recurring-task.md',
                title: 'Weekly review',
                status: 'open',
                priority: 'high',
                recurrence: 'FREQ=WEEKLY;BYDAY=FR',
            };

            // Expected behavior TBD - may need discussion
        });
    });

    describe('Configuration options (potential enhancement)', () => {
        it.skip('should respect setting to disable automatic priority reset - reproduces issue #692', async () => {
            // Optional: Add a setting to enable/disable this behavior
            // Some users may want to keep the original priority for
            // record-keeping purposes

            // settings.resetPriorityOnCompletion: boolean (default: true)
        });

        it.skip('should allow configuring which priority to use on completion - reproduces issue #692', async () => {
            // Optional: Allow users to configure which priority value
            // should be used when a task is completed
            // Default would be the lowest priority, but could be customizable

            // settings.completedTaskPriority: string (default: getLowestPriority())
        });
    });
});
