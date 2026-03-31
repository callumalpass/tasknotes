/**
 * Reproduction test for Issue #1744: Practical issues with applying filters to nested tasks:
 * The `Expanded relationship` option does not work
 *
 * Bug Description:
 * In TaskNotes 4.5.0, when a Bases filter is active (e.g. `note.projects.isEmpty()`)
 * only top-level tasks pass the filter. Subtasks that have a non-empty `projects` field
 * are excluded by the filter. Setting `Expanded relationship` to `show-all` was expected
 * to bypass the filter for subtasks so they still appear under their parent, but it has
 * no visible effect — subtasks remain hidden.
 *
 * Root Cause Hypothesis:
 * `filterExpandedRelationshipTasks()` in `src/ui/TaskCard.ts` checks
 * `options.expandedRelationshipFilterMode !== "inherit"` and returns all tasks
 * unfiltered when mode is `"show-all"`. However, this function only operates on
 * the tasks already passed to the card for rendering expanded relationships.
 * `currentVisibleTaskPaths` in `TaskListView`/`KanbanView` is built from the
 * Bases query result — which never includes subtasks excluded by the Bases filter.
 * Since the subtasks are not in the dataset at all, `show-all` cannot reinstate them.
 * The option effectively does nothing because the data is filtered upstream at the
 * Bases/query layer, not at the card rendering layer.
 *
 * Key locations:
 * - src/ui/TaskCard.ts (filterExpandedRelationshipTasks ~line 78)
 * - src/bases/TaskListView.ts (currentVisibleTaskPaths ~line 66, expandedRelationshipFilterMode ~line 64)
 * - src/bases/KanbanView.ts (currentVisibleTaskPaths ~line 66, expandedRelationshipFilterMode ~line 51)
 */

jest.mock('obsidian');

describe('Issue #1744: Expanded relationship "show-all" option does not bypass Bases filter for subtasks', () => {
  it.skip('reproduces issue #1744: filterExpandedRelationshipTasks returns empty array when subtasks are absent from the allowed set', () => {
    // Simulate the task data after Bases filtering
    // projectA passes the filter (isEmpty == true), subtasks do NOT (isEmpty == false)
    const basesFilteredTasks = [
      { path: 'tasks/project-a.md', title: 'Project A', projects: [] },
      // A-01 and A-02 are absent — Bases excluded them because their projects is non-empty
    ];

    const allTasksInVault = [
      { path: 'tasks/project-a.md', title: 'Project A', projects: [] },
      { path: 'tasks/a-01.md',      title: 'A-01',      projects: ['[[Project A]]'] },
      { path: 'tasks/a-02.md',      title: 'A-02',      projects: ['[[Project A]]'] },
    ];

    // currentVisibleTaskPaths is built only from Bases-filtered results
    const currentVisibleTaskPaths = new Set(basesFilteredTasks.map(t => t.path));

    // filterExpandedRelationshipTasks as implemented in TaskCard.ts
    function filterExpandedRelationshipTasks(
      tasks: typeof allTasksInVault,
      mode: 'inherit' | 'show-all',
      allowedPaths: Set<string>
    ): typeof allTasksInVault {
      if (mode !== 'inherit') {
        return tasks; // show-all: return everything passed in
      }
      return tasks.filter(t => allowedPaths.has(t.path));
    }

    // The subtasks of Project A that should be shown in show-all mode
    const subtasksOfProjectA = allTasksInVault.filter(t =>
      t.projects.includes('[[Project A]]')
    );

    // BUG: Even with show-all mode, the subtasks are not passed to filterExpandedRelationshipTasks
    // because the view only fetches tasks in currentVisibleTaskPaths.
    // The card renderer only ever receives tasks already in basesFilteredTasks.

    // Simulate what happens when the view tries to render subtasks of Project A:
    // It queries allTasksInVault for subtasks but only using currentVisibleTaskPaths
    const tasksAvailableToCard = allTasksInVault.filter(t =>
      currentVisibleTaskPaths.has(t.path)
    );

    // show-all mode passes through whatever tasksAvailableToCard contains
    const renderedSubtasks = filterExpandedRelationshipTasks(
      tasksAvailableToCard.filter(t => subtasksOfProjectA.includes(t)),
      'show-all',
      currentVisibleTaskPaths
    );

    // BUG: renderedSubtasks is empty because subtasks were never in currentVisibleTaskPaths
    expect(renderedSubtasks).toHaveLength(0); // Demonstrates the bug

    // After fix: the view should fetch subtasks independently of the Bases filter
    // and include them in the dataset when show-all is active
    const expectedSubtaskCount = subtasksOfProjectA.length;
    expect(expectedSubtaskCount).toBe(2); // A-01 and A-02

    // Signal that the fix is not yet implemented
    expect(true).toBe(false); // Fails to indicate bug is present
  });

  it.skip('reproduces issue #1744: show-all mode should fetch subtasks from full task set, not just Bases results', () => {
    // Demonstrates the required fix: when expandedRelationshipFilterMode === "show-all",
    // the view must augment its dataset with subtasks fetched outside the Bases filter.

    const basesResults = [
      { path: 'tasks/project-a.md', title: 'Project A', projects: [] as string[] },
    ];

    const allVaultTasks = [
      { path: 'tasks/project-a.md', title: 'Project A', projects: [] as string[] },
      { path: 'tasks/a-01.md',      title: 'A-01',      projects: ['[[Project A]]'] },
      { path: 'tasks/a-02.md',      title: 'A-02',      projects: ['[[Project A]]'] },
    ];

    function getSubtasksForParent(
      parentPath: string,
      allTasks: typeof allVaultTasks,
      mode: 'inherit' | 'show-all'
    ): typeof allVaultTasks {
      if (mode === 'inherit') {
        // Current (buggy) behaviour: only return tasks visible in Bases results
        return basesResults.filter(t =>
          (t as any).subtasks?.includes(parentPath) ?? false
        );
      }
      // Required fix: fetch from full vault task set
      return allTasks.filter(t =>
        t.projects.some(p => p.includes('Project A'))
      );
    }

    const subtasksInherit = getSubtasksForParent('tasks/project-a.md', allVaultTasks, 'inherit');
    const subtasksShowAll = getSubtasksForParent('tasks/project-a.md', allVaultTasks, 'show-all');

    expect(subtasksInherit).toHaveLength(0); // Bug: inherit mode finds no subtasks in Bases results
    expect(subtasksShowAll).toHaveLength(2); // Fix: show-all mode fetches from full vault

    // Signal that the fix is not yet implemented
    expect(true).toBe(false); // Fails to indicate bug is present
  });
});
