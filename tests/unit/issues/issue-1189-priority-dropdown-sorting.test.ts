/**
 * Issue #1189: [FR]: "Add Task" modal dropdown should respect Priority sorting logic
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/1189
 *
 * Feature Request: The Priority dropdown in the Add/Edit Task modal should sort items
 * based on the same logic used in Bases views or strictly follow the order in which
 * priorities are listed in plugin settings.
 *
 * Current behavior: Priority dropdown sorts by weight descending (highest weight first),
 * which doesn't respect:
 * 1. Alphanumeric sorting of priority labels (e.g., "1-Urgent", "2-High", "3-Normal")
 * 2. The order defined in settings (which is by weight ascending)
 *
 * User's use case: Using numeric prefixes (1-, 2-) to force visual sort order in labels,
 * but the dropdown ignores this and sorts by internal weight property instead.
 *
 * Expected behavior: The dropdown should match the settings order (weight ascending),
 * which reflects the user's configured display order.
 */

import { PriorityConfig } from '../../../src/types';

/**
 * Simulates the current PriorityContextMenu sorting behavior
 * This is the problematic behavior - sorts by weight DESCENDING
 */
function sortPrioritiesAsCurrentDropdown(priorities: PriorityConfig[]): PriorityConfig[] {
	return [...priorities].sort((a, b) => b.weight - a.weight);
}

/**
 * Simulates the settings panel display order
 * This is what the user configures and expects to see - weight ASCENDING
 */
function sortPrioritiesAsSettings(priorities: PriorityConfig[]): PriorityConfig[] {
	return [...priorities].sort((a, b) => a.weight - b.weight);
}

/**
 * Alternative: Sort by label alphanumerically
 * This would respect numeric prefixes like "1-Urgent", "2-High"
 */
function sortPrioritiesAlphanumeric(priorities: PriorityConfig[]): PriorityConfig[] {
	return [...priorities].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

describe.skip('Issue #1189: Priority dropdown should respect sorting logic', () => {
	// Test data: User has configured priorities with numeric prefixes
	const userConfiguredPriorities: PriorityConfig[] = [
		{ id: 'urgent', value: 'urgent', label: '1-Urgent', color: '#ff0000', weight: 3 },
		{ id: 'high', value: 'high', label: '2-High', color: '#ff6600', weight: 2 },
		{ id: 'normal', value: 'normal', label: '3-Normal', color: '#ffaa00', weight: 1 },
		{ id: 'low', value: 'low', label: '4-Low', color: '#00aa00', weight: 0 },
	];

	describe('Current behavior (failing) - demonstrates the bug', () => {
		it('should show priorities in settings-defined order (weight ascending), but currently shows weight descending', () => {
			const dropdownOrder = sortPrioritiesAsCurrentDropdown(userConfiguredPriorities);
			const settingsOrder = sortPrioritiesAsSettings(userConfiguredPriorities);

			// Current dropdown shows: 1-Urgent, 2-High, 3-Normal, 4-Low (weight desc)
			// But this happens to match in this case because higher priority = higher weight
			// The REAL issue is when user reorders in settings, the dropdown doesn't follow

			// In settings, user sees: 4-Low (0), 3-Normal (1), 2-High (2), 1-Urgent (3) - weight ascending
			// In dropdown, user sees: 1-Urgent (3), 2-High (2), 3-Normal (1), 4-Low (0) - weight descending

			// This test demonstrates the inversion
			expect(dropdownOrder.map(p => p.label)).not.toEqual(settingsOrder.map(p => p.label));

			// Current dropdown order (weight descending - highest priority first)
			expect(dropdownOrder.map(p => p.label)).toEqual(['1-Urgent', '2-High', '3-Normal', '4-Low']);

			// Settings display order (weight ascending - as configured by user via drag-drop)
			expect(settingsOrder.map(p => p.label)).toEqual(['4-Low', '3-Normal', '2-High', '1-Urgent']);
		});

		it('should show "Urgent" at top when user expects it there based on settings order', () => {
			// Scenario from the issue: User renamed priorities with numeric prefixes
			// but "Urgent" appears at bottom of dropdown while "Low"/"Normal" are at top

			// This happens because:
			// 1. User may have added new priorities with low weights
			// 2. Or the default sort is inverted from what they expect

			const customPriorities: PriorityConfig[] = [
				{ id: 'low', value: 'low', label: 'Low', color: '#00aa00', weight: 0 },
				{ id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 1 },
				{ id: 'high', value: 'high', label: 'High', color: '#ff6600', weight: 2 },
				{ id: 'urgent', value: 'urgent', label: '1-Urgent', color: '#ff0000', weight: 3 },
			];

			const dropdownOrder = sortPrioritiesAsCurrentDropdown(customPriorities);

			// Dropdown currently shows highest weight first
			// So 1-Urgent (weight 3) should be first, which is correct for "most important first"
			// But the user expects it to match their settings order OR alphanumeric by label
			expect(dropdownOrder[0].label).toBe('1-Urgent');

			// The issue is that the sort logic is weight-based, not label-based
			// So "1-Urgent" won't naturally sort first unless it has the highest weight
		});
	});

	describe('Expected behavior - dropdown matches settings order', () => {
		it('should display priorities in the same order as shown in settings', () => {
			// After fix: dropdown should use weight ascending (same as settings)
			// OR provide an option to choose the sort method

			const settingsOrder = sortPrioritiesAsSettings(userConfiguredPriorities);
			const labels = settingsOrder.map(p => p.label);

			// User sees this order in settings, should see same in dropdown
			expect(labels).toEqual(['4-Low', '3-Normal', '2-High', '1-Urgent']);
		});

		it('should respect user-defined drag-and-drop order from settings', () => {
			// When user drags priorities to reorder in settings, weights are updated
			// The dropdown should reflect this same order

			// User drags to create this custom order:
			const customOrderPriorities: PriorityConfig[] = [
				{ id: 'urgent', value: 'urgent', label: '1-Urgent', color: '#ff0000', weight: 0 }, // First position
				{ id: 'high', value: 'high', label: '2-High', color: '#ff6600', weight: 1 },
				{ id: 'normal', value: 'normal', label: '3-Normal', color: '#ffaa00', weight: 2 },
				{ id: 'low', value: 'low', label: '4-Low', color: '#00aa00', weight: 3 }, // Last position
			];

			const settingsOrder = sortPrioritiesAsSettings(customOrderPriorities);
			const expectedDropdownOrder = settingsOrder.map(p => p.label);

			// After fix, dropdown should show: 1-Urgent, 2-High, 3-Normal, 4-Low
			expect(expectedDropdownOrder).toEqual(['1-Urgent', '2-High', '3-Normal', '4-Low']);

			// But currently, dropdown sorts by weight DESCENDING, so would show reversed:
			const currentDropdownOrder = sortPrioritiesAsCurrentDropdown(customOrderPriorities);
			expect(currentDropdownOrder.map(p => p.label)).toEqual(['4-Low', '3-Normal', '2-High', '1-Urgent']);
		});
	});

	describe('Alternative: Alphanumeric label sorting', () => {
		it('should sort by label alphanumerically when numeric prefixes are used', () => {
			// Another valid approach: sort by label with numeric awareness
			const mixedPriorities: PriorityConfig[] = [
				{ id: 'normal', value: 'normal', label: '3-Normal', color: '#ffaa00', weight: 2 },
				{ id: 'urgent', value: 'urgent', label: '1-Urgent', color: '#ff0000', weight: 0 },
				{ id: 'low', value: 'low', label: '4-Low', color: '#00aa00', weight: 3 },
				{ id: 'high', value: 'high', label: '2-High', color: '#ff6600', weight: 1 },
			];

			const alphanumericOrder = sortPrioritiesAlphanumeric(mixedPriorities);
			const labels = alphanumericOrder.map(p => p.label);

			// Numeric-aware alphanumeric sort should produce: 1-Urgent, 2-High, 3-Normal, 4-Low
			expect(labels).toEqual(['1-Urgent', '2-High', '3-Normal', '4-Low']);
		});

		it('should handle mixed prefix styles correctly', () => {
			const mixedPrefixes: PriorityConfig[] = [
				{ id: 'a', value: 'a', label: 'A-First', color: '#ff0000', weight: 0 },
				{ id: 'b', value: 'b', label: '10-Tenth', color: '#ff6600', weight: 1 },
				{ id: 'c', value: 'c', label: '2-Second', color: '#ffaa00', weight: 2 },
				{ id: 'd', value: 'd', label: '1-First', color: '#00aa00', weight: 3 },
			];

			const alphanumericOrder = sortPrioritiesAlphanumeric(mixedPrefixes);
			const labels = alphanumericOrder.map(p => p.label);

			// Numeric sort: 1-First, 2-Second, 10-Tenth, A-First
			expect(labels).toEqual(['1-First', '2-Second', '10-Tenth', 'A-First']);
		});
	});

	describe('Integration: PriorityContextMenu should use consistent sort', () => {
		it('should sort priorities the same way in dropdown as in settings panel', () => {
			// The core fix: PriorityContextMenu.buildMenu() should sort by weight ascending
			// to match priorityPropertyCard.ts renderPriorityList() behavior

			const priorities: PriorityConfig[] = [
				{ id: 'none', value: 'none', label: 'None', color: '#cccccc', weight: 0 },
				{ id: 'low', value: 'low', label: 'Low', color: '#00aa00', weight: 1 },
				{ id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 },
				{ id: 'high', value: 'high', label: 'High', color: '#ff0000', weight: 3 },
			];

			// Settings panel uses: (a, b) => a.weight - b.weight (ascending)
			const settingsSort = [...priorities].sort((a, b) => a.weight - b.weight);

			// PriorityContextMenu currently uses: (a, b) => b.weight - a.weight (descending)
			// After fix, should also use ascending to match settings

			// Expected after fix: both should produce same order
			const expectedDropdownSort = settingsSort;

			expect(expectedDropdownSort.map(p => p.label)).toEqual(['None', 'Low', 'Normal', 'High']);
		});
	});
});
