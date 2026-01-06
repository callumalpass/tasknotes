/**
 * Issue #1316: Default calendar view cannot be changed
 *
 * Bug Description:
 * User changed the setting for a calendar view in a tab to 3 days. Now it defaults
 * to 3 days every time, even if they change the default view in the settings.
 *
 * Root cause:
 * The ephemeral state restoration (`setEphemeralState`) unconditionally overrides
 * the configured default view from the .base file. When a user switches to a
 * different view (e.g., "3 days"/timeGridCustom), that view type is saved in
 * ephemeral state. On view reload, `setEphemeralState` restores this view type,
 * effectively making the ephemeral state the permanent default - ignoring both
 * the .base file's calendarView setting and the global default view setting.
 *
 * The settings hierarchy should be:
 * 1. Global plugin settings (lowest priority)
 * 2. Per-.base file config (calendarView option)
 * 3. Ephemeral state for temporary session navigation (should NOT override configured defaults)
 *
 * Expected behavior:
 * - Ephemeral state should preserve the user's current navigation position
 * - But opening a fresh view (new tab, reload) should respect the configured default
 * - There should be a way to "reset" a view to its configured default
 */

describe.skip('Issue #1316 - Default calendar view cannot be changed', () => {
	/**
	 * Simulates the settings hierarchy and ephemeral state behavior
	 */
	class MockCalendarViewOptions {
		calendarView: string;
		customDayCount: number;

		constructor(globalSettings: { defaultView: string; customDayCount: number }) {
			this.calendarView = globalSettings.defaultView;
			this.customDayCount = globalSettings.customDayCount;
		}
	}

	// Simulates reading from .base file config
	function readViewOptions(
		viewOptions: MockCalendarViewOptions,
		config: Map<string, unknown>
	): void {
		viewOptions.calendarView = (config.get('calendarView') as string) ?? viewOptions.calendarView;
		viewOptions.customDayCount = (config.get('customDayCount') as number) ?? viewOptions.customDayCount;
	}

	// Current buggy implementation of setEphemeralState
	function setEphemeralStateBuggy(
		viewOptions: MockCalendarViewOptions,
		state: { calendarView?: string } | null,
		changeView: (view: string) => void
	): void {
		if (!state) return;

		// BUG: Unconditionally changes view to ephemeral state, ignoring configured defaults
		if (state.calendarView) {
			changeView(state.calendarView);
		}
	}

	// Fixed implementation that respects configured defaults
	function setEphemeralStateFixed(
		viewOptions: MockCalendarViewOptions,
		state: { calendarView?: string; isSessionNavigation?: boolean } | null,
		changeView: (view: string) => void,
		configuredDefault: string | null
	): void {
		if (!state) return;

		// Only restore ephemeral view if:
		// 1. There's a saved view in state
		// 2. It's marked as active session navigation (user manually switched views)
		// 3. AND there's no explicitly configured default in the .base file
		if (state.calendarView && state.isSessionNavigation && !configuredDefault) {
			changeView(state.calendarView);
		}
		// If there's a configured default, always use it (don't let ephemeral state override)
	}

	describe('Bug reproduction', () => {
		test('ephemeral state overrides configured default view from .base file', () => {
			// Setup: Global settings have week view as default
			const globalSettings = { defaultView: 'timeGridWeek', customDayCount: 3 };
			const viewOptions = new MockCalendarViewOptions(globalSettings);

			// User's .base file explicitly configures week view
			const baseFileConfig = new Map<string, unknown>();
			baseFileConfig.set('calendarView', 'timeGridWeek');

			// Read config from .base file (this should set the default)
			readViewOptions(viewOptions, baseFileConfig);

			// At this point, viewOptions.calendarView should be 'timeGridWeek'
			expect(viewOptions.calendarView).toBe('timeGridWeek');

			// Simulate: User previously switched to 3-day view, and that was saved in ephemeral state
			const savedEphemeralState = { calendarView: 'timeGridCustom' };

			let currentViewInCalendar = viewOptions.calendarView;
			const changeView = (view: string) => {
				currentViewInCalendar = view;
			};

			// BUG: setEphemeralState unconditionally overrides the configured default
			setEphemeralStateBuggy(viewOptions, savedEphemeralState, changeView);

			// This demonstrates the bug: ephemeral state overrides the .base file config
			// The view is now 'timeGridCustom' even though .base file says 'timeGridWeek'
			expect(currentViewInCalendar).toBe('timeGridCustom'); // Bug: This passes (wrong behavior)

			// What should happen: The configured default from .base file should be respected
			// This assertion represents the EXPECTED behavior (currently fails due to bug)
			expect(currentViewInCalendar).toBe('timeGridWeek'); // FAILS - this is the bug!
		});

		test('changing global default view setting has no effect due to ephemeral state', () => {
			// User wants to change their default view from 3-days to week view

			// Step 1: User changes global settings to week view
			const globalSettings = { defaultView: 'timeGridWeek', customDayCount: 3 };
			const viewOptions = new MockCalendarViewOptions(globalSettings);

			// No explicit .base file config (using global defaults)
			const baseFileConfig = new Map<string, unknown>();
			readViewOptions(viewOptions, baseFileConfig);

			expect(viewOptions.calendarView).toBe('timeGridWeek');

			// But ephemeral state still has the old 3-day view saved
			const savedEphemeralState = { calendarView: 'timeGridCustom' };

			let currentViewInCalendar = viewOptions.calendarView;
			const changeView = (view: string) => {
				currentViewInCalendar = view;
			};

			// Ephemeral state overrides the new global default
			setEphemeralStateBuggy(viewOptions, savedEphemeralState, changeView);

			// Bug: Despite changing settings, the view is still 3-day
			expect(currentViewInCalendar).toBe('timeGridCustom'); // Bug: passes

			// Expected: New global default should be respected
			expect(currentViewInCalendar).toBe('timeGridWeek'); // FAILS - the bug!
		});
	});

	describe('Expected behavior (for when fix is implemented)', () => {
		test('configured default in .base file should take precedence over ephemeral state', () => {
			const globalSettings = { defaultView: 'dayGridMonth', customDayCount: 3 };
			const viewOptions = new MockCalendarViewOptions(globalSettings);

			// .base file explicitly configures week view as default
			const baseFileConfig = new Map<string, unknown>();
			baseFileConfig.set('calendarView', 'timeGridWeek');
			const configuredDefault = 'timeGridWeek';

			readViewOptions(viewOptions, baseFileConfig);

			// Old ephemeral state has 3-day view
			const savedEphemeralState = { calendarView: 'timeGridCustom', isSessionNavigation: true };

			let currentViewInCalendar = viewOptions.calendarView;
			const changeView = (view: string) => {
				currentViewInCalendar = view;
			};

			// Fixed behavior: configured default takes precedence
			setEphemeralStateFixed(viewOptions, savedEphemeralState, changeView, configuredDefault);

			// With fix: configured default from .base file should be used
			expect(currentViewInCalendar).toBe('timeGridWeek');
		});

		test('ephemeral state should only restore view when there is no configured default', () => {
			const globalSettings = { defaultView: 'timeGridWeek', customDayCount: 3 };
			const viewOptions = new MockCalendarViewOptions(globalSettings);

			// No explicit .base file config
			const baseFileConfig = new Map<string, unknown>();
			const configuredDefault = null; // No explicit default in .base file

			readViewOptions(viewOptions, baseFileConfig);

			// User had navigated to 3-day view in session
			const savedEphemeralState = { calendarView: 'timeGridCustom', isSessionNavigation: true };

			let currentViewInCalendar = viewOptions.calendarView;
			const changeView = (view: string) => {
				currentViewInCalendar = view;
			};

			// When there's no configured default, ephemeral state can be used for session continuity
			setEphemeralStateFixed(viewOptions, savedEphemeralState, changeView, configuredDefault);

			// Without a configured default, ephemeral state provides session continuity
			expect(currentViewInCalendar).toBe('timeGridCustom');
		});

		test('fresh view load (no ephemeral state) should use configured default', () => {
			const globalSettings = { defaultView: 'dayGridMonth', customDayCount: 3 };
			const viewOptions = new MockCalendarViewOptions(globalSettings);

			// .base file configures week view
			const baseFileConfig = new Map<string, unknown>();
			baseFileConfig.set('calendarView', 'timeGridWeek');
			const configuredDefault = 'timeGridWeek';

			readViewOptions(viewOptions, baseFileConfig);

			// No ephemeral state (fresh load)
			const savedEphemeralState = null;

			let currentViewInCalendar = viewOptions.calendarView;
			const changeView = (view: string) => {
				currentViewInCalendar = view;
			};

			setEphemeralStateFixed(viewOptions, savedEphemeralState, changeView, configuredDefault);

			// Fresh load uses configured default
			expect(currentViewInCalendar).toBe('timeGridWeek');
		});
	});

	describe('Settings hierarchy', () => {
		test('priority order: .base config > global settings > ephemeral state for defaults', () => {
			// This test documents the expected settings hierarchy

			// Lowest priority: Global plugin settings
			const globalSettings = { defaultView: 'dayGridMonth', customDayCount: 3 };

			// Medium priority: Per-.base file configuration
			const baseFileConfig = new Map<string, unknown>();
			baseFileConfig.set('calendarView', 'timeGridWeek');

			// Should NOT override configured defaults: Ephemeral state
			const ephemeralState = { calendarView: 'timeGridCustom' };

			const viewOptions = new MockCalendarViewOptions(globalSettings);

			// After reading .base config, should be week view (overrides global month view)
			readViewOptions(viewOptions, baseFileConfig);
			expect(viewOptions.calendarView).toBe('timeGridWeek');

			// After ephemeral state, should STILL be week view (ephemeral shouldn't override config)
			// BUG: Currently ephemeral state incorrectly overrides this
			const configuredDefault = baseFileConfig.get('calendarView') as string;

			let currentView = viewOptions.calendarView;
			setEphemeralStateFixed(viewOptions, ephemeralState, (v) => { currentView = v; }, configuredDefault);

			expect(currentView).toBe('timeGridWeek'); // Configured default takes precedence
		});
	});
});
