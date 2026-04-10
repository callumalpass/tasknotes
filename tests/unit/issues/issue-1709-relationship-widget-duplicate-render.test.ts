/**
 * Issue #1709: relationship.base renders multiple times when default view is Reading view
 *
 * When the default view for new tabs is set to Reading view, the relationships
 * widget renders 2-3 duplicate instances. Switching between Reading and Live
 * Preview fixes it by resetting to a single instance.
 *
 * ROOT CAUSE:
 * setupReadingModeHandlers() in RelationshipsDecorations.ts registers multiple
 * event listeners (active-leaf-change, metadata-change, layout-change) plus an
 * initial injection loop. When default view is Reading view, multiple events fire
 * simultaneously during workspace initialization, and the async injectReadingModeWidget()
 * calls overlap - each removing existing widgets and re-adding before the previous
 * async call completes its cleanup.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1709
 */

import { describe, it, expect } from '@jest/globals';

const CSS_RELATIONSHIPS_WIDGET = 'tasknotes-relationships-widget';

/**
 * Simulates the concurrent injection race condition.
 * In the real code, injectReadingModeWidget is async and multiple calls
 * can interleave their cleanup and injection steps.
 */
describe('Issue #1709: Relationship widget duplicate rendering', () => {
	it.skip('reproduces issue #1709 - concurrent injections produce duplicate widgets', () => {
		// Simulate a container element
		const widgets: string[] = [];

		// Simulate the injection logic: remove existing, then add
		function injectWidget(id: string): void {
			// Step 1: Remove existing (simulates querySelectorAll + remove)
			// In the real bug, this step may not see widgets from concurrent calls
			const toRemove = widgets.indexOf(CSS_RELATIONSHIPS_WIDGET);
			if (toRemove !== -1) {
				widgets.splice(toRemove, 1);
			}

			// Step 2: Add new widget (simulates appendChild)
			widgets.push(CSS_RELATIONSHIPS_WIDGET);
		}

		// Simulate the race: 3 concurrent calls (initial load + active-leaf-change + layout-ready)
		// In reality these are async, so cleanup of call 2 may not see call 1's widget yet
		injectWidget('call-1');
		injectWidget('call-2');
		injectWidget('call-3');

		// With the bug, widgets array should have 1 (each call removes before adding)
		// But in the async race condition, cleanup doesn't see concurrent additions
		// This simplified model shows serial behavior; the real bug is async interleaving

		// Expected: exactly 1 widget
		// BUG: In practice, 2-3 widgets appear due to async race
		expect(widgets.length).toBe(1);
	});

	it.skip('reproduces issue #1709 - async race produces duplicates', async () => {
		// More accurate simulation with async delays
		let widgetCount = 0;

		async function injectWidgetAsync(): Promise<void> {
			// Read current count (cleanup step)
			const currentCount = widgetCount;

			// Simulate async gap (DOM operations, widget creation)
			await new Promise(resolve => setTimeout(resolve, 0));

			// Remove existing (but count may have changed since we read it)
			if (currentCount > 0) {
				widgetCount = currentCount - 1;
			}

			// Add new widget
			widgetCount++;
		}

		// Fire 3 concurrent injection calls (as happens during Reading view init)
		await Promise.all([
			injectWidgetAsync(),
			injectWidgetAsync(),
			injectWidgetAsync(),
		]);

		// BUG: widgetCount may be > 1 due to race condition
		// The fix should ensure exactly 1 widget regardless of concurrent calls
		expect(widgetCount).toBe(1);
	});
});
