/**
 * NaturalLanguageParser API Exposure Tests - Issue #1052
 *
 * Tests for the feature request to expose the chrono natural language parser
 * via a JavaScript API accessible from external scripts (Templater, QuickAdd, MetaBind).
 *
 * Feature Request: https://github.com/obsidian-tasks-group/tasknotes/issues/1052
 *
 * The user wants to create tasks programmatically using their own scripts while
 * leveraging TaskNotes' natural language parsing capabilities (chrono-node).
 * Currently they would need to either:
 * 1. Use the HTTP API (requires server to be running, authentication)
 * 2. Bundle their own chrono-node (duplication, maintenance burden)
 * 3. Keep Tasks plugin installed just for its API
 *
 * Expected solution: Expose a public API on the plugin instance that scripts
 * can access via app.plugins.plugins['tasknotes'].api
 */

import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';
import { ChronoTestUtils } from '../../__mocks__/chrono-node';
import { RRuleTestUtils } from '../../__mocks__/rrule';

// Mock date-fns to ensure consistent test results
jest.mock('date-fns', () => ({
	format: jest.fn((date: Date, formatStr: string) => {
		if (formatStr === 'yyyy-MM-dd') {
			return date.toISOString().split('T')[0];
		} else if (formatStr === 'HH:mm') {
			return date.toISOString().split('T')[1].substring(0, 5);
		}
		return date.toISOString();
	}),
	parse: jest.fn(),
	addDays: jest.fn(),
	addWeeks: jest.fn(),
	addMonths: jest.fn(),
	addYears: jest.fn(),
	startOfDay: jest.fn(),
	isValid: jest.fn(() => true),
}));

describe('NaturalLanguageParser API Exposure - Issue #1052', () => {
	let parser: NaturalLanguageParser;
	let mockStatusConfigs: StatusConfig[];
	let mockPriorityConfigs: PriorityConfig[];

	beforeEach(() => {
		jest.clearAllMocks();
		ChronoTestUtils.reset();
		RRuleTestUtils.reset();

		mockStatusConfigs = [
			{ id: 'open', value: 'open', label: 'Open', color: '#blue', isCompleted: false, order: 1 },
			{
				id: 'in-progress',
				value: 'in-progress',
				label: 'In Progress',
				color: '#orange',
				isCompleted: false,
				order: 2,
			},
			{ id: 'done', value: 'done', label: 'Done', color: '#green', isCompleted: true, order: 3 },
		];

		mockPriorityConfigs = [
			{ id: 'low', value: 'low', label: 'Low', color: '#gray', weight: 1 },
			{ id: 'normal', value: 'normal', label: 'Normal', color: '#blue', weight: 5 },
			{ id: 'high', value: 'high', label: 'High', color: '#orange', weight: 8 },
			{ id: 'urgent', value: 'urgent', label: 'Urgent', color: '#red', weight: 10 },
		];

		parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true);
	});

	describe('Public API for External Scripts', () => {
		/**
		 * Test that the plugin exposes a public API object accessible via:
		 * app.plugins.plugins['tasknotes'].api
		 *
		 * This API should allow external scripts (Templater, QuickAdd, MetaBind)
		 * to access the NLP parser without making HTTP requests.
		 */
		it.skip('should expose a public API object on the plugin instance (reproduces issue #1052)', () => {
			// This test verifies the plugin exposes an API object
			// Expected usage in Templater/QuickAdd:
			// const api = app.plugins.plugins['tasknotes'].api;
			// const parsed = api.parseNaturalLanguage('Buy milk tomorrow #groceries');

			// Mock plugin instance structure (would be from main.ts)
			const mockPlugin = {
				api: {
					parseNaturalLanguage: (text: string) => parser.parseInput(text),
				},
			};

			expect(mockPlugin.api).toBeDefined();
			expect(typeof mockPlugin.api.parseNaturalLanguage).toBe('function');
		});

		/**
		 * Test that the API provides date parsing capabilities via chrono-node
		 */
		it.skip('should parse natural language dates via the API (reproduces issue #1052)', () => {
			// External scripts should be able to parse dates like:
			// "tomorrow", "next friday", "in 2 weeks", "march 15th"

			// Set up chrono mock for this test
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			ChronoTestUtils.setMockParseResult([
				{
					start: {
						date: () => tomorrow,
						get: (component: string) => {
							if (component === 'hour') return undefined;
							if (component === 'minute') return undefined;
							return tomorrow.getDate();
						},
						isCertain: () => false,
					},
					index: 5,
					text: 'tomorrow',
				},
			]);

			const result = parser.parseInput('Task tomorrow');

			// The API should return parsed date information
			expect(result.dueDate).toBeDefined();
			// Date should be tomorrow's date in YYYY-MM-DD format
			expect(result.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		/**
		 * Test that the API handles recurrence patterns
		 */
		it.skip('should parse recurrence patterns via the API (reproduces issue #1052)', () => {
			// External scripts should be able to parse recurrence like:
			// "every day", "every monday", "every 2 weeks"

			RRuleTestUtils.setMockRRule('FREQ=DAILY;INTERVAL=1');

			const result = parser.parseInput('Review inbox every day');

			expect(result.recurrence).toBeDefined();
			expect(result.recurrence).toContain('FREQ=DAILY');
		});

		/**
		 * Test that the API parses priorities
		 */
		it.skip('should parse priority via the API (reproduces issue #1052)', () => {
			// External scripts should be able to parse priority indicators
			const result = parser.parseInput('Fix critical bug high priority');

			expect(result.priority).toBe('high');
		});

		/**
		 * Test that the API parses tags and contexts
		 */
		it.skip('should parse tags and contexts via the API (reproduces issue #1052)', () => {
			// External scripts should be able to extract tags (#) and contexts (@)
			const result = parser.parseInput('Review PR #code @work +ProjectX');

			expect(result.tags).toContain('code');
			expect(result.contexts).toContain('work');
			expect(result.projects).toContain('ProjectX');
		});

		/**
		 * Test that the API provides time estimate parsing
		 */
		it.skip('should parse time estimates via the API (reproduces issue #1052)', () => {
			// External scripts should be able to parse time estimates
			const result = parser.parseInput('Complete report 2h');

			expect(result.estimate).toBe(120); // 2 hours in minutes
		});

		/**
		 * Test example: Templater script usage
		 */
		it.skip('should work with typical Templater script patterns (reproduces issue #1052)', () => {
			// Simulates how a user would use this in Templater:
			// ```
			// <%*
			// const api = app.plugins.plugins['tasknotes'].api;
			// const userInput = await tp.system.prompt("Enter task:");
			// const parsed = api.parseNaturalLanguage(userInput);
			//
			// // Now create task note with parsed data
			// const content = `---
			// title: ${parsed.title}
			// due: ${parsed.dueDate}
			// priority: ${parsed.priority}
			// tags: ${parsed.tags.join(', ')}
			// ---`;
			// %>
			// ```

			const userInput = 'Submit expense report by friday #finance @office high priority';
			const parsed = parser.parseInput(userInput);

			// Verify all components that a Templater script would need
			expect(parsed.title).toBeDefined();
			expect(typeof parsed.title).toBe('string');

			// These fields may or may not be populated depending on input
			expect(Array.isArray(parsed.tags)).toBe(true);
			expect(Array.isArray(parsed.contexts)).toBe(true);
		});

		/**
		 * Test example: QuickAdd macro usage
		 */
		it.skip('should work with typical QuickAdd macro patterns (reproduces issue #1052)', () => {
			// Simulates how a user would use this in QuickAdd:
			// - Capture text input
			// - Parse with TaskNotes API
			// - Create note with frontmatter

			const quickAddInput = 'Call dentist tomorrow at 2pm @health';

			// Set up chrono mock
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(14, 0, 0, 0);
			ChronoTestUtils.setMockParseResult([
				{
					start: {
						date: () => tomorrow,
						get: (component: string) => {
							if (component === 'hour') return 14;
							if (component === 'minute') return 0;
							return tomorrow.getDate();
						},
						isCertain: (component: string) => component === 'hour',
					},
					index: 12,
					text: 'tomorrow at 2pm',
				},
			]);

			const parsed = parser.parseInput(quickAddInput);

			expect(parsed.title).toBe('Call dentist');
			expect(parsed.dueDate).toBeDefined();
			expect(parsed.dueTime).toBe('14:00');
			expect(parsed.contexts).toContain('health');
		});

		/**
		 * Test that API returns consistent structure
		 */
		it.skip('should return a consistent ParsedTaskData structure (reproduces issue #1052)', () => {
			// The API should always return the same structure for predictable scripting
			const result = parser.parseInput('Simple task');

			// Verify structure exists (even if values are empty/null)
			expect(result).toHaveProperty('title');
			expect(result).toHaveProperty('details');
			expect(result).toHaveProperty('dueDate');
			expect(result).toHaveProperty('scheduledDate');
			expect(result).toHaveProperty('dueTime');
			expect(result).toHaveProperty('scheduledTime');
			expect(result).toHaveProperty('priority');
			expect(result).toHaveProperty('status');
			expect(result).toHaveProperty('tags');
			expect(result).toHaveProperty('contexts');
			expect(result).toHaveProperty('projects');
			expect(result).toHaveProperty('recurrence');
			expect(result).toHaveProperty('estimate');
		});
	});

	describe('API Documentation Requirements', () => {
		/**
		 * Test that documents expected API methods
		 */
		it.skip('should document the parseNaturalLanguage method (reproduces issue #1052)', () => {
			// The API should be well-documented for external script authors
			// Expected documentation:
			// - Method signature: parseNaturalLanguage(text: string): ParsedTaskData
			// - Input: natural language task description
			// - Output: structured object with parsed components
			// - Examples of supported syntax

			// This test serves as living documentation
			const exampleInputs = [
				'Buy groceries tomorrow',
				'Meeting with John next Monday at 10am #work @office',
				'Review code every friday high priority',
				'Complete report 2h 30m due friday',
			];

			for (const input of exampleInputs) {
				const result = parser.parseInput(input);
				expect(result).toBeDefined();
				expect(result.title).toBeDefined();
			}
		});
	});
});
