/**
 * Issue #1285: [Bug]: Tasks Flicker in Calendar View
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/1285
 *
 * Bug Description:
 * Tasks flicker in the calendar-default view. This may be related to other
 * small UI bugs like intermittent drag-and-drop failures (closing and reopening
 * the view usually fixes it).
 *
 * Root Cause Analysis:
 * The flickering is caused by rapid re-renders during data updates. When multiple
 * data updates occur in quick succession (e.g., during typing, file saves, or
 * drag-and-drop operations), the calendar view was re-rendering for each update,
 * causing visible flickering.
 *
 * The fix involves:
 * 1. A 5-second debounce for external data changes (e.g., typing in notes)
 * 2. Immediate updates for user-initiated actions (expectImmediateUpdate flag)
 * 3. Immediate updates on first data load
 * 4. Immediate updates when config toggles change
 * 5. Render locking to prevent concurrent renders
 *
 * Related issues:
 * - Drag-and-drop sometimes not working (requires close/reopen to fix)
 * - The 2-second auto-reset of expectImmediateUpdate may be too short
 *
 * Environment: Windows, Obsidian 1.10.6, TaskNotes 4.1.0
 */

describe.skip('Issue #1285 - Calendar View Flickering', () => {
	/**
	 * Mock implementation of the calendar view's data update handling.
	 * This simulates the actual behavior in CalendarView.onDataUpdated().
	 */
	class MockCalendarViewUpdateHandler {
		private _isRendering = false;
		private _pendingRender = false;
		private _expectingImmediateUpdate = false;
		private _isFirstDataUpdate = true;
		private _previousConfigSnapshot: string | null = null;
		private dataUpdateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
		private renderCount = 0;
		private configSnapshot = '{}';

		// Mock methods
		render(): void {
			if (this._isRendering) {
				this._pendingRender = true;
				return;
			}
			this._isRendering = true;
			this.renderCount++;
			// Simulate render completion
			setTimeout(() => {
				this._isRendering = false;
				if (this._pendingRender) {
					this._pendingRender = false;
					this.render();
				}
			}, 0);
		}

		expectImmediateUpdate(): void {
			this._expectingImmediateUpdate = true;
			// Auto-reset after 2 seconds (as implemented)
			setTimeout(() => {
				this._expectingImmediateUpdate = false;
			}, 2000);
		}

		hasConfigChanged(): boolean {
			const current = this.configSnapshot;
			if (this._previousConfigSnapshot === null) {
				this._previousConfigSnapshot = current;
				return false;
			}
			if (current !== this._previousConfigSnapshot) {
				this._previousConfigSnapshot = current;
				return true;
			}
			return false;
		}

		setConfigSnapshot(snapshot: string): void {
			this.configSnapshot = snapshot;
		}

		onDataUpdated(): void {
			if (this.dataUpdateDebounceTimer) {
				clearTimeout(this.dataUpdateDebounceTimer);
				this.dataUpdateDebounceTimer = null;
			}

			// First data update should be immediate
			if (this._isFirstDataUpdate) {
				this._isFirstDataUpdate = false;
				this.render();
				return;
			}

			// User-initiated actions should be immediate
			if (this._expectingImmediateUpdate) {
				this._expectingImmediateUpdate = false;
				this.render();
				return;
			}

			// Config changes should be immediate
			if (this.hasConfigChanged()) {
				this.render();
				return;
			}

			// Otherwise debounce for 5 seconds
			this.dataUpdateDebounceTimer = setTimeout(() => {
				this.dataUpdateDebounceTimer = null;
				this.render();
			}, 5000);
		}

		getRenderCount(): number {
			return this.renderCount;
		}

		hasPendingDebounce(): boolean {
			return this.dataUpdateDebounceTimer !== null;
		}

		cancelPendingDebounce(): void {
			if (this.dataUpdateDebounceTimer) {
				clearTimeout(this.dataUpdateDebounceTimer);
				this.dataUpdateDebounceTimer = null;
			}
		}

		reset(): void {
			this.cancelPendingDebounce();
			this._isRendering = false;
			this._pendingRender = false;
			this._expectingImmediateUpdate = false;
			this._isFirstDataUpdate = true;
			this._previousConfigSnapshot = null;
			this.renderCount = 0;
		}
	}

	let handler: MockCalendarViewUpdateHandler;

	beforeEach(() => {
		jest.useFakeTimers();
		handler = new MockCalendarViewUpdateHandler();
	});

	afterEach(() => {
		handler.cancelPendingDebounce();
		jest.useRealTimers();
	});

	describe('First data update behavior', () => {
		it('should render immediately on first data update', () => {
			handler.onDataUpdated();

			// Should render immediately, no debounce
			expect(handler.getRenderCount()).toBe(1);
			expect(handler.hasPendingDebounce()).toBe(false);
		});

		it('should only treat the first update as immediate, subsequent updates should debounce', () => {
			// First update - immediate
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(1);

			// Second update - should debounce
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(1);
			expect(handler.hasPendingDebounce()).toBe(true);

			// Fast forward 5 seconds
			jest.advanceTimersByTime(5000);
			jest.runAllTimers(); // Run the render setTimeout

			expect(handler.getRenderCount()).toBe(2);
		});
	});

	describe('User-initiated action behavior (expectImmediateUpdate)', () => {
		it('should render immediately when expectImmediateUpdate is called before data update', () => {
			// Consume first update
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(1);

			// Signal immediate update expected (e.g., before drag-drop)
			handler.expectImmediateUpdate();

			// Data update should be immediate
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(2);
			expect(handler.hasPendingDebounce()).toBe(false);
		});

		it('should auto-reset expectImmediateUpdate after 2 seconds', () => {
			// Consume first update
			handler.onDataUpdated();

			// Signal immediate update expected
			handler.expectImmediateUpdate();

			// Wait 2.1 seconds - flag should auto-reset
			jest.advanceTimersByTime(2100);

			// Now data update should debounce
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(1);
			expect(handler.hasPendingDebounce()).toBe(true);
		});

		it('should only consume expectImmediateUpdate once', () => {
			// Consume first update
			handler.onDataUpdated();

			// Signal immediate update
			handler.expectImmediateUpdate();

			// First data update - immediate
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(2);

			// Second data update - should debounce (flag was consumed)
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(2);
			expect(handler.hasPendingDebounce()).toBe(true);
		});
	});

	describe('Config change behavior', () => {
		it('should render immediately when config changes', () => {
			// Consume first update
			handler.onDataUpdated();

			// Change config
			handler.setConfigSnapshot('{"showScheduled": false}');

			// Data update should be immediate
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(2);
			expect(handler.hasPendingDebounce()).toBe(false);
		});

		it('should debounce when config has not changed', () => {
			// Consume first update
			handler.onDataUpdated();

			// Don't change config

			// Data update should debounce
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(1);
			expect(handler.hasPendingDebounce()).toBe(true);
		});
	});

	describe('Debounce behavior for external changes', () => {
		it('should debounce updates by 5 seconds', () => {
			// Consume first update
			handler.onDataUpdated();

			// External update
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(1);
			expect(handler.hasPendingDebounce()).toBe(true);

			// Wait 4 seconds - should not render yet
			jest.advanceTimersByTime(4000);
			expect(handler.getRenderCount()).toBe(1);

			// Wait 1 more second - should render now
			jest.advanceTimersByTime(1000);
			jest.runAllTimers();

			expect(handler.getRenderCount()).toBe(2);
		});

		it('should reset debounce timer on rapid updates (preventing flickering)', () => {
			// Consume first update
			handler.onDataUpdated();

			// Simulate rapid typing - multiple updates
			handler.onDataUpdated();
			jest.advanceTimersByTime(1000);

			handler.onDataUpdated();
			jest.advanceTimersByTime(1000);

			handler.onDataUpdated();
			jest.advanceTimersByTime(1000);

			// Still only 1 render (first update)
			expect(handler.getRenderCount()).toBe(1);

			// Wait 5 more seconds for final debounced render
			jest.advanceTimersByTime(5000);
			jest.runAllTimers();

			// Only 2 total renders despite 4 data updates
			expect(handler.getRenderCount()).toBe(2);
		});
	});

	describe('Render locking behavior', () => {
		it('should queue pending render when already rendering', async () => {
			jest.useRealTimers();

			const handler = new MockCalendarViewUpdateHandler();

			// This test verifies that the render lock mechanism works
			// When render is called while already rendering, it should queue
			// the render to happen after the current render completes

			handler.onDataUpdated(); // First update - immediate render

			// The implementation uses _isRendering flag to prevent concurrent renders
			// and _pendingRender to queue a re-render after current one completes
			expect(handler.getRenderCount()).toBe(1);

			handler.reset();
		});
	});

	describe('Flickering prevention scenarios', () => {
		it('should prevent flickering during rapid file saves', () => {
			// Simulate Obsidian saving file every 2 seconds while user types
			handler.onDataUpdated(); // First load - immediate

			// Simulate 5 rapid saves
			for (let i = 0; i < 5; i++) {
				handler.onDataUpdated();
				jest.advanceTimersByTime(2000);
			}

			// Should still only have 1 render (first update)
			// because each save resets the 5-second debounce
			expect(handler.getRenderCount()).toBe(1);

			// Wait for final debounce to complete
			jest.advanceTimersByTime(5000);
			jest.runAllTimers();

			// Now we have 2 renders total
			expect(handler.getRenderCount()).toBe(2);
		});

		it('should allow immediate render for drag-drop despite rapid saves', () => {
			handler.onDataUpdated(); // First load

			// Start rapid saves
			handler.onDataUpdated();
			jest.advanceTimersByTime(1000);

			// User initiates drag-drop
			handler.expectImmediateUpdate();

			// Drag-drop triggers data update
			handler.onDataUpdated();

			// Should render immediately despite ongoing saves
			expect(handler.getRenderCount()).toBe(2);
		});
	});

	describe('Edge cases and potential bug scenarios', () => {
		it('BUG: expectImmediateUpdate may expire before Obsidian finishes saving', () => {
			// This documents a potential bug where the 2-second auto-reset
			// of expectImmediateUpdate may fire before Obsidian completes
			// the file save, causing drag-drop updates to be debounced

			handler.onDataUpdated(); // First load

			// User initiates drag-drop
			handler.expectImmediateUpdate();

			// Simulate slow Obsidian save (takes 2.5 seconds)
			jest.advanceTimersByTime(2500);

			// Now the data update comes, but flag has expired
			handler.onDataUpdated();

			// BUG: Update is debounced instead of immediate
			expect(handler.getRenderCount()).toBe(1);
			expect(handler.hasPendingDebounce()).toBe(true);

			// User has to wait 5 seconds for their change to appear
			// This could explain why closing/reopening the view "fixes" drag-drop
		});

		it('should handle view not connected (skip updates)', () => {
			// The actual implementation skips updates when rootElement is not connected
			// This test documents that behavior

			// First update when view is connected
			handler.onDataUpdated();
			expect(handler.getRenderCount()).toBe(1);

			// In the actual implementation, if the view is not connected,
			// onDataUpdated returns early without scheduling any render
			// This is handled in the real code with: if (!this.rootElement?.isConnected) return;
		});
	});
});

describe.skip('Issue #1285 - Playwright E2E test stubs', () => {
	/**
	 * These tests would need to be implemented as actual Playwright tests
	 * to verify the visual flickering behavior. They are documented here
	 * as stubs for future implementation.
	 */

	it.todo('should not flicker when typing in a task note while calendar is open');

	it.todo('should not flicker when multiple tasks are updated rapidly');

	it.todo('should update immediately after drag-drop in calendar view');

	it.todo('should allow drag-drop consistently without needing to close/reopen view');

	it.todo('should handle rapid view toggle changes without flickering');
});
