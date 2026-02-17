/**
 * Test for Issue #1586: Task identification should support multitext list properties
 *
 * Bug Description:
 * When using a property-based task identification method with a multitext/list property
 * (as defined in Obsidian's types.json or the user's categorization system),
 * TaskNotes doesn't handle the property correctly in two ways:
 *
 * 1. Filter generation: The generated Bases filters use `==` operator which doesn't
 *    work for list properties. For example:
 *    - Generated: `note.categories == "[[Task]]"`
 *    - Should be: `categories.contains("[[Task]]")` (for list properties)
 *
 * 2. Task creation: When creating tasks, the identification property is set as a
 *    single string value instead of a list item:
 *    - Generated: `categories: "[[Task]]"`
 *    - Should be: `categories: ["[[Task]]"]`
 *
 * User's setup:
 * - Uses property "categories" with value "[[Task]]" for task identification
 * - The "categories" property is defined as "multitext" in Obsidian's types.json
 * - User may have multiple categories per note (e.g., ["[[Task]]", "[[Habit]]"])
 *
 * Proposed solutions:
 * 1. Read property type from Obsidian's .obsidian/types.json
 * 2. Add a checkbox/setting to specify that the identification property is a list type
 *
 * Related issue: #1051 (Saving task modal removes additional list items)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1586
 */

import { generateBasesFileTemplate } from '../../../src/templates/defaultBasesFiles';

// Mock plugin for testing
const createMockPlugin = (settings: any) => ({
	settings: {
		taskTag: 'task',
		taskIdentificationMethod: 'property',
		taskPropertyName: 'categories',
		taskPropertyValue: '[[Task]]',
		customPriorities: [
			{ value: 'high', label: 'High', weight: 0 },
			{ value: 'normal', label: 'Normal', weight: 1 },
			{ value: 'low', label: 'Low', weight: 2 },
		],
		customStatuses: [
			{ value: 'open', label: 'Open', isCompleted: false },
			{ value: 'done', label: 'Done', isCompleted: true },
		],
		defaultVisibleProperties: ['status', 'priority', 'due'],
		userFields: [],
		...settings,
	},
	fieldMapper: {
		toUserField: jest.fn((key: string) => key),
		getMapping: jest.fn(() => ({
			status: 'status',
			priority: 'priority',
			due: 'due',
			scheduled: 'scheduled',
			recurrence: 'recurrence',
			completeInstances: 'complete_instances',
			blockedBy: 'blockedBy',
			projects: 'projects',
			contexts: 'contexts',
			timeEstimate: 'timeEstimate',
			timeEntries: 'timeEntries',
		})),
	},
});

describe('Issue #1586: Multitext Task Identification', () => {
	describe('Filter generation for list properties', () => {
		test.skip('reproduces issue #1586 - filter should use contains() for list properties', () => {
			/**
			 * Current behavior (bug):
			 * The filter is generated as: `note.categories == "[[Task]]"`
			 * This doesn't match when categories is a list like ["[[Task]]", "[[Habit]]"]
			 *
			 * Expected behavior:
			 * The filter should use `.contains()` for list properties to check
			 * if the identification value exists within the list.
			 *
			 * TODO: Implement taskPropertyIsListType setting or auto-detect from types.json
			 */
			const mockPlugin = createMockPlugin({
				taskPropertyIsListType: true, // New setting needed
			});

			const template = generateBasesFileTemplate('open-tasks-view', mockPlugin as any);

			// Current (buggy) filter uses ==
			expect(template).not.toContain('note.categories == "[[Task]]"');

			// Expected: should use .contains() for list properties
			expect(template).toContain('categories.contains("[[Task]]")');
		});

		test.skip('reproduces issue #1586 - current filter uses equality check which fails for lists', () => {
			/**
			 * This test documents the current buggy behavior where equality check
			 * is used for all property types, which doesn't work for multitext/list properties.
			 */
			const mockPlugin = createMockPlugin({});

			const template = generateBasesFileTemplate('open-tasks-view', mockPlugin as any);

			// Current behavior: uses == which doesn't work for lists
			// This is the bug - tasks with categories: ["[[Task]]", "[[Habit]]"]
			// won't match the filter because the array != the string
			expect(template).toContain('note.categories == "[[Task]]"');
		});
	});

	describe('Task creation with list property type', () => {
		test.skip('reproduces issue #1586 - task creation should set list property as array', () => {
			/**
			 * Current behavior (bug):
			 * Task is created with: `categories: "[[Task]]"` (string)
			 *
			 * Expected behavior:
			 * Task should be created with: `categories: ["[[Task]]"]` (array)
			 *
			 * This preserves the property type as defined in Obsidian's types.json
			 * and allows users to add additional categories without type conflicts.
			 *
			 * The fix would be in TaskService.ts around lines 381-389 where
			 * the task identification property is set. When taskPropertyIsListType
			 * is true, it should wrap the value in an array.
			 */

			// This test would require mocking TaskService.createTask
			// For now, documenting the expected behavior

			// Current (buggy): frontmatter[propName] = coercedValue
			// Expected: frontmatter[propName] = [coercedValue] when list type

			expect(true).toBe(true); // Placeholder - actual implementation needed
		});

		test.skip('reproduces issue #1586 - list values should be preserved when saving', () => {
			/**
			 * Related to issue #1051 but specific to the list property type context.
			 *
			 * Scenario:
			 * - Task has: categories: ["[[Task]]", "[[Habit]]", "[[Daily]]"]
			 * - User opens the task in TaskNotes modal
			 * - User makes some change (or no change) and saves
			 *
			 * Current behavior (bug):
			 * - Only identification value kept: categories: "[[Task]]"
			 * - All other values are lost
			 *
			 * Expected behavior:
			 * - All values preserved: categories: ["[[Task]]", "[[Habit]]", "[[Daily]]"]
			 *
			 * The fix would be in TaskService.ts around lines 1406-1416 where
			 * during updates, instead of setting:
			 *   frontmatter[propName] = coercedValue
			 * It should:
			 * 1. Check if property is a list type
			 * 2. Ensure the identification value is in the list
			 * 3. Preserve other values in the list
			 */

			expect(true).toBe(true); // Placeholder - actual implementation needed
		});
	});

	describe('Settings for property type configuration', () => {
		test.skip('reproduces issue #1586 - should support specifying property type in settings', () => {
			/**
			 * This test documents the user's feature request for a way to specify
			 * that the task identification property is a list/multitext type.
			 *
			 * Proposed solutions:
			 * 1. Add a setting: taskPropertyIsListType: boolean
			 *    - Default: false (backward compatible)
			 *    - When true, use .contains() in filters and array format in YAML
			 *
			 * 2. Auto-detect from Obsidian's .obsidian/types.json
			 *    - Read the types.json file on plugin load
			 *    - Check if the configured property is "multitext" type
			 *    - Automatically use appropriate handling
			 *
			 * The types.json file format:
			 * ```json
			 * {
			 *   "types": {
			 *     "categories": "multitext"
			 *   }
			 * }
			 * ```
			 */

			// Check that current settings interface doesn't have the needed property
			const mockPlugin = createMockPlugin({});
			expect(mockPlugin.settings.taskPropertyIsListType).toBeUndefined();

			// Expected: settings should include taskPropertyIsListType
			// This would require changes to:
			// - src/types/settings.ts: Add taskPropertyIsListType: boolean
			// - src/settings/defaults.ts: Add default value (false)
			// - Settings UI: Add checkbox in task identification section
		});
	});

	describe('Formula handling with mixed property types', () => {
		test.skip('reproduces issue #1586 - users need workaround for mixed property types', () => {
			/**
			 * Documents the current workaround users must use in custom formulas.
			 *
			 * When TaskNotes creates tasks with string properties but users also
			 * create tasks manually with list properties, formulas need to handle both:
			 *
			 * Current workaround:
			 * ```
			 * this.categories.contains("[[Task]]") || this.categories == "[[Task]]"
			 * ```
			 *
			 * This is needed because:
			 * - Tasks created by TaskNotes: categories: "[[Task]]" (string)
			 * - Tasks created manually/by template: categories: ["[[Task]]"] (list)
			 *
			 * Expected behavior after fix:
			 * If TaskNotes consistently creates list values when taskPropertyIsListType
			 * is true, users only need:
			 * ```
			 * this.categories.contains("[[Task]]")
			 * ```
			 */

			// Document the current inconsistency
			const taskNotesCreatedProperty = '[[Task]]'; // string
			const manuallyCreatedProperty = ['[[Task]]']; // array

			expect(typeof taskNotesCreatedProperty).toBe('string');
			expect(Array.isArray(manuallyCreatedProperty)).toBe(true);

			// Both should be arrays after the fix
		});
	});
});
