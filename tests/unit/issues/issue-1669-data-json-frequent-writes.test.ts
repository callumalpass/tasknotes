/**
 * Reproduction test for issue #1669.
 *
 * Reported behavior:
 * - data.json is modified multiple times per minute even when idle,
 *   causing iCloud sync conflicts between two Obsidian instances.
 *
 * Root cause:
 * - PomodoroService saves state on every timer tick via saveData(),
 *   and other services may also trigger frequent writes. There is no
 *   debouncing mechanism for disk writes.
 */

describe('Issue #1669: data.json constantly being modified', () => {
	it.skip('reproduces issue #1669 - pomodoro state saves should be debounced', () => {
		// Given: A pomodoro timer is running
		// When: Multiple state saves are triggered in quick succession
		// Then: Only a single saveData() call should be made within the debounce window

		// Simulate rapid saveState calls and verify saveData is called at most once
		// within a 5-second window
	});

	it.skip('reproduces issue #1669 - idle plugin should not write data.json', () => {
		// Given: No active pomodoro session
		// And: No user interaction
		// When: 60 seconds pass
		// Then: saveData() should not be called
	});
});
