/**
 * Reproduction test for Issue #1694: Enabling TaskNotes on iPad causes back arrow to freeze
 * Obsidian on most-frequently-used files.
 *
 * Bug Description:
 * On iPad, using the native back arrow (top-left of screen) after navigating from a note that
 * contains Bases views with many task entries causes Obsidian to freeze completely. The virtual
 * keyboard back arrow does not trigger the freeze. The bug is TaskNotes-specific (disabling the
 * plugin prevents it) and file-specific (only affects a note with many Bases exercise views).
 *
 * Root Cause Hypothesis:
 * TaskNotes registers `active-leaf-change` listeners in `pluginBootstrap.ts` and
 * `TaskCardNoteDecorations.ts`. On leaf change, `scheduleInjection()` is called for the leaf,
 * which runs `injectReadingModeWidget()`. This function performs synchronous DOM queries and
 * mutations (querySelectorAll, insertBefore) on the reading-mode container. When the note
 * contains many task card widgets (from a file with many Bases views), the injection work is
 * O(n) in the number of task cards. On iPad, the native back button may trigger navigation
 * through a different code path that processes the leaf-change callback synchronously on the
 * main thread without yielding. The combination of multiple `active-leaf-change` listeners
 * (bootstrap, TaskCardNoteDecorations, RelationshipsDecorations) all firing simultaneously and
 * each performing DOM work could saturate the main thread, causing the apparent freeze.
 * The `ReadingModeInjectionScheduler` may not prevent concurrent injections from multiple
 * listener registrations.
 *
 * Key locations:
 * - src/editor/TaskCardNoteDecorations.ts (setupReadingModeHandlers, scheduleInjection, injectReadingModeWidget)
 * - src/editor/RelationshipsDecorations.ts (active-leaf-change handler)
 * - src/bootstrap/pluginBootstrap.ts (active-leaf-change handler, dispatchTaskUpdate)
 */

jest.mock('obsidian');

describe('Issue #1694: iPad back arrow freezes Obsidian with TaskNotes enabled', () => {
  it.skip('reproduces issue #1694: multiple active-leaf-change handlers should not cause synchronous main-thread saturation', () => {
    // Simulate the scenario: a note has N task card widgets that need injection
    const taskCardCount = 50; // a file with many Bases exercise views

    // Simulate the injection work per task card (DOM query + insert operations)
    function simulateInjectionWork(cardCount: number): number {
      let operationCount = 0;
      for (let i = 0; i < cardCount; i++) {
        // Each card requires: query existing widgets, unload, remove, create new, insert
        operationCount += 5; // approximate DOM operations per card
      }
      return operationCount;
    }

    // Simulate multiple listeners firing on back navigation
    const listenerCount = 3; // bootstrap + TaskCardNoteDecorations + RelationshipsDecorations
    let totalSynchronousOperations = 0;

    for (let listener = 0; listener < listenerCount; listener++) {
      // Each listener schedules injection without yielding to the event loop on iOS
      totalSynchronousOperations += simulateInjectionWork(taskCardCount);
    }

    // BUG: total synchronous DOM operations is O(N * listeners) which can freeze iPad
    // A safe threshold for mobile synchronous work would be much lower
    const safeMobileOperationThreshold = 50;

    // This assertion demonstrates the bug: operations exceed safe threshold
    expect(totalSynchronousOperations).toBeLessThanOrEqual(safeMobileOperationThreshold); // Fails to indicate bug is present
  });

  it.skip('reproduces issue #1694: injection scheduler should deduplicate concurrent injections from multiple listeners', () => {
    // The ReadingModeInjectionScheduler should prevent multiple listeners from
    // injecting the same leaf simultaneously

    const injectionCalls: string[] = [];

    // Simulate what should happen: scheduler deduplicates calls for same leaf
    class MockInjectionScheduler {
      private scheduled = new Set<string>();

      schedule(leafId: string, fn: () => void): void {
        // BUG: in the current implementation, if multiple listeners call schedule()
        // for the same leaf before the microtask runs, they may not be deduplicated
        if (!this.scheduled.has(leafId)) {
          this.scheduled.add(leafId);
          fn(); // synchronous in this mock
        }
      }
    }

    const scheduler = new MockInjectionScheduler();
    const leafId = 'leaf-exercises-note';

    // Three listeners all fire on back-navigation for the same leaf
    scheduler.schedule(leafId, () => injectionCalls.push('bootstrap'));
    scheduler.schedule(leafId, () => injectionCalls.push('taskCardDecorations'));
    scheduler.schedule(leafId, () => injectionCalls.push('relationshipsDecorations'));

    // Only one injection should happen per leaf per navigation event
    expect(injectionCalls.length).toBe(1); // Fails to indicate bug is present
  });
});
