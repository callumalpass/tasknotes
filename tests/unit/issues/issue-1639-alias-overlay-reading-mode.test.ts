/**
 * Reproduction tests for Issue #1639: Task link overlay doesn't respect
 * "disable overlay for aliased tasks" setting in reading mode.
 *
 * Bug: When "Task link overlay" and "Disable overlay for aliased links" are
 * both enabled, aliased task links still show the overlay in reading mode.
 * Live preview mode correctly hides the overlay for aliased links.
 *
 * Root cause:
 * - `src/editor/ReadingModeTaskLinkProcessor.ts` lines 167-175 check for aliases
 *   by comparing `linkEl.textContent` against `originalLinkPath` and `taskInfo.title`.
 * - In reading mode, Obsidian renders `[[task|My Alias]]` as:
 *   `<a class="internal-link" href="task">My Alias</a>`
 * - The `originalLinkPath` is derived from `href` (e.g., "task") and the
 *   `textContent` is "My Alias".
 * - The check `currentText !== originalLinkPath && currentText !== taskInfo.title`
 *   can fail when the task title matches the alias text, or when path resolution
 *   alters the link path format.
 *
 * Related files:
 * - src/editor/ReadingModeTaskLinkProcessor.ts (alias detection logic, lines 167-175)
 * - src/editor/TaskLinkOverlay.ts (live preview mode, works correctly)
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1639: Task link overlay ignores alias setting in reading mode', () => {
	it.skip('reproduces issue #1639 - aliased link still shows overlay in reading mode', () => {
		// Simulate the alias detection logic from ReadingModeTaskLinkProcessor
		const disableOverlayOnAlias = true;

		// Simulated rendered link: [[My Task|Custom Name]]
		const linkEl = {
			textContent: 'Custom Name',  // The alias
			getAttribute: (attr: string) => {
				if (attr === 'href') return 'My Task';
				return null;
			},
		};

		const originalLinkPath = 'My Task'; // From href
		const taskInfo = { title: 'My Task', path: 'Tasks/My Task.md' };

		// Current alias detection logic (lines 167-175):
		const currentText = linkEl.textContent || '';

		// Check: if text doesn't match path AND doesn't match task title, it's an alias
		const isAlias = currentText !== originalLinkPath && currentText !== taskInfo.title;

		// "Custom Name" !== "My Task" (true) AND "Custom Name" !== "My Task" (true)
		// So isAlias = true => should skip overlay
		expect(isAlias).toBe(true); // This case works

		// BUT: What if the task title IS the alias text?
		const taskInfo2 = { title: 'Custom Name', path: 'Tasks/My Task.md' };
		const isAlias2 = currentText !== originalLinkPath && currentText !== taskInfo2.title;

		// "Custom Name" !== "My Task" (true) AND "Custom Name" !== "Custom Name" (false)
		// So isAlias2 = false => overlay shows even though it IS an alias
		expect(isAlias2).toBe(false); // BUG: alias not detected when title matches alias text
	});

	it.skip('reproduces issue #1639 - path with .md extension breaks alias detection', () => {
		const disableOverlayOnAlias = true;

		// In reading mode, href might include .md extension or be a full path
		const linkEl = {
			textContent: 'My Task',  // Same as the file basename (not an alias)
			getAttribute: (attr: string) => {
				if (attr === 'href') return 'Tasks/My Task.md';
				return null;
			},
		};

		const originalLinkPath = 'Tasks/My Task.md'; // Full path from href
		const taskInfo = { title: 'My Task', path: 'Tasks/My Task.md' };

		const currentText = linkEl.textContent || '';

		// Check alias: "My Task" !== "Tasks/My Task.md" (true) AND "My Task" !== "My Task" (false)
		// isAlias = false (correct, not an alias)
		const isAlias = currentText !== originalLinkPath && currentText !== taskInfo.title;
		expect(isAlias).toBe(false);

		// Now with a real alias:
		const aliasLinkEl = {
			textContent: 'See this task',
			getAttribute: (attr: string) => {
				if (attr === 'href') return 'Tasks/My Task.md';
				return null;
			},
		};

		const aliasText = aliasLinkEl.textContent || '';
		const isAliasReal = aliasText !== originalLinkPath && aliasText !== taskInfo.title;
		// "See this task" !== "Tasks/My Task.md" (true) AND "See this task" !== "My Task" (true)
		expect(isAliasReal).toBe(true); // This case works
	});
});
