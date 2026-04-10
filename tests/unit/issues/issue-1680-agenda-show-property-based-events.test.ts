/**
 * Reproduction tests for issue #1680.
 *
 * Reported behavior:
 * - Agenda view (tasknotesCalendar type) shows both TaskNotes events and
 *   property-based events even when showPropertyBasedEvents: false is set
 *   in the view's options configuration.
 */

describe('Issue #1680: showPropertyBasedEvents: false not respected in agenda view', () => {
	it.skip('reproduces issue #1680 - config.get returns undefined for options-nested settings', () => {
		// Simulate how CalendarView.readEventToggles reads the config
		// The default is true (line 186), and config.get returns undefined
		// when the value is nested under options in the YAML.

		const defaultShowPropertyBasedEvents = true;

		// Simulate config.get('showPropertyBasedEvents') when the value
		// is set inside options: { showPropertyBasedEvents: false } in YAML.
		// The Bases config API may not flatten the options sub-object.
		const configValue = undefined; // config.get returns undefined

		// Line 463: nullish coalescing keeps the default
		const result = configValue ?? defaultShowPropertyBasedEvents;

		// BUG: result is true even though user set showPropertyBasedEvents: false
		expect(result).toBe(true);

		// The user expects this to be false
		expect(result).not.toBe(false);
	});

	it.skip('reproduces issue #1680 - property-based events generated for task items', () => {
		// Even if showPropertyBasedEvents worked correctly, the buildPropertyBasedEvents
		// method iterates over ALL entries in data.data (including tasks) and creates
		// property-based events for them if startDateProperty is set.
		// This means tasks appear both as TaskNotes events AND as property-based events.

		const dataEntries = [
			{
				file: { path: 'Tasks/my-task.md', basename: 'my-task' },
				isTask: true,
				scheduled: '2026-03-22',
				'file.ctime': '2026-03-20T10:00:00',
			},
		];

		// Task appears as TaskNotes event from generateCalendarEvents
		const taskEvents = dataEntries
			.filter((e) => e.isTask && e.scheduled)
			.map((e) => ({ id: `task-${e.file.path}`, type: 'task' }));

		// Same task also appears as property-based event (using file.ctime)
		const startDateProperty = 'file.ctime';
		const propertyEvents = dataEntries
			.filter((e) => e.file && (e as any)[startDateProperty])
			.map((e) => ({ id: `property-${e.file.path}`, type: 'property-based' }));

		// BUG: Both event lists contain the same task, causing duplicates
		expect(taskEvents.length).toBe(1);
		expect(propertyEvents.length).toBe(1);
		expect(taskEvents[0].id).not.toBe(propertyEvents[0].id); // Different IDs, same task
	});
});
