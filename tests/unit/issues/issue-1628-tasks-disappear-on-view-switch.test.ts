/**
 * Reproduction test for Issue #1628: Tasks disappear after switching custom agenda views
 *
 * Bug Description:
 * When the user has two custom agenda/filter views and switches between them
 * (default → custom-A → custom-B), non-recurring tasks disappear from all views.
 * Recurring tasks remain visible. Only closing and reopening the pane restores them.
 *
 * Root Cause Hypothesis:
 * The filter operation on the shared task list may be mutating the source array
 * in-place (e.g., using Array.splice or filtering destructively) rather than
 * producing a new filtered copy. After the second view applies its filter to
 * an already-filtered array, the intersection becomes empty for non-recurring tasks.
 * Recurring tasks may escape this because they are handled via a separate code path.
 *
 * Key locations:
 * - src/services/FilterService.ts (filter application, ~lines 199, 246)
 * - src/services/filter-service/FilterQueryPlanner.ts
 */

jest.mock('obsidian');

describe('Issue #1628: Tasks disappear on sequential view switches', () => {
  it.skip('reproduces issue #1628: applying two successive filters to the same task list should preserve the original list', () => {
    // Simulate having a task list (mix of recurring and non-recurring tasks)
    const allTasks = [
      { id: '1', title: 'Task A', due: '2026-04-01', recurrence: null },
      { id: '2', title: 'Task B', scheduled: '2026-04-01', recurrence: null },
      { id: '3', title: 'Task C - recurring', due: '2026-04-01', recurrence: 'FREQ=WEEKLY' },
      { id: '4', title: 'Task D', due: '2026-04-02', recurrence: null },
    ];

    // Filter preset A: show only "due" tasks
    const filterByDue = (tasks: typeof allTasks) =>
      tasks.filter(t => t.due !== undefined);

    // Filter preset B: show only "scheduled" tasks
    const filterByScheduled = (tasks: typeof allTasks) =>
      tasks.filter(t => t.scheduled !== undefined);

    // Apply filter A (simulating switching to custom-view-A)
    const viewAResult = filterByDue(allTasks);

    // Apply filter B to the SAME source list (simulating switching to custom-view-B)
    // If a bug causes filterByScheduled to receive viewAResult instead of allTasks:
    const buggyViewBResult = filterByScheduled(viewAResult); // applies to already-filtered list

    // Bug: buggyViewBResult is empty (no tasks have both due AND scheduled)
    // Expected: allTasks should still be intact and viewB should get non-empty results
    const correctViewBResult = filterByScheduled(allTasks);

    // This assertion demonstrates the bug: the "buggy" path yields 0 tasks
    // because viewAResult has no scheduled tasks (they all have due dates)
    expect(buggyViewBResult.length).toBe(correctViewBResult.length);
    // ^ Fails: buggyViewBResult.length === 0, correctViewBResult.length === 1
  });

  it.skip('reproduces issue #1628: recurring tasks should remain visible after view switches', () => {
    const allTasks = [
      { id: '1', title: 'Non-recurring', due: '2026-04-01', recurrence: null },
      { id: '2', title: 'Recurring', due: '2026-04-01', recurrence: 'FREQ=WEEKLY' },
    ];

    // Simulate destructive filtering (bug scenario)
    function destructiveFilterNonRecurring(tasks: typeof allTasks) {
      // Simulates an in-place splice-based filter — the kind of mutation that would cause the bug
      for (let i = tasks.length - 1; i >= 0; i--) {
        if (tasks[i].recurrence === null) {
          tasks.splice(i, 1); // mutates original array
        }
      }
      return tasks;
    }

    destructiveFilterNonRecurring(allTasks);

    // After destructive filter, allTasks has been mutated and non-recurring tasks are gone
    // A subsequent filter on allTasks will not find non-recurring tasks even in a "show all" view
    const tasksAfterReset = allTasks.filter(() => true); // no-op filter simulating "show all"

    expect(tasksAfterReset.some(t => t.recurrence === null)).toBe(true);
    // ^ Fails: non-recurring tasks were spliced out of the shared array
  });
});
