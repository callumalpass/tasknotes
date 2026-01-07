/**
 * Issue #856: [Bug]: Filters don't read custom properties with numbers format
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/856
 *
 * Bug Description:
 * In Kanban view, filtering for a custom property doesn't work if the property
 * is set up to be of NUMBER type (as opposed to TEXT).
 *
 * Reproduction Steps:
 * 1. In Task Properties, create a new custom property of any name
 * 2. Set that custom property type to NUMBER
 * 3. Create a new task and set its custom property to 1
 * 4. In Kanban view, set the filter to only show tasks with the custom property of 1
 * 5. No tasks will be shown (BUG)
 * 6. Go back to Task Properties, and set this custom property type to TEXT
 * 7. Return to the Kanban view and test the filter again, the task should now be visible
 *
 * Root Cause:
 * The filter comparison in FilterUtils.isEqual uses strict equality (===).
 * When the task property value is a number (e.g., 1) and the filter condition
 * value is a string (e.g., "1"), the comparison fails because 1 !== "1".
 *
 * Expected behavior:
 * Filters should work with NUMBER type custom properties, comparing values
 * semantically rather than by strict type equality.
 */

import { FilterUtils } from '../../../src/utils/FilterUtils';
import type { FilterOperator, FilterProperty } from '../../../src/types';

describe.skip('Issue #856: Custom property number filter bug', () => {
	describe('FilterUtils.applyOperator - number type handling', () => {
		it('should match when task value is number 1 and condition value is string "1"', () => {
			// This is the core bug: task has numeric value, filter has string value
			const taskValue = 1; // NUMBER type custom property value
			const conditionValue = '1'; // String from filter UI input

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			// Currently fails because 1 !== "1" (strict equality)
			expect(result).toBe(true);
		});

		it('should match when task value is string "1" and condition value is number 1', () => {
			// Reverse case: task has string, filter has number
			const taskValue = '1'; // TEXT type custom property value
			const conditionValue = 1; // Number from filter

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-text-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should handle decimal number comparison', () => {
			const taskValue = 1.5;
			const conditionValue = '1.5';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should handle negative number comparison', () => {
			const taskValue = -5;
			const conditionValue = '-5';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should handle is-not operator with mixed types', () => {
			const taskValue = 1;
			const conditionValue = '2';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is-not' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should correctly identify non-matching values with mixed types', () => {
			const taskValue = 1;
			const conditionValue = '2';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(false);
		});
	});

	describe('Numeric comparison operators with mixed types', () => {
		it('should handle is-greater-than with string condition', () => {
			const taskValue = 10;
			const conditionValue = '5';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is-greater-than' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should handle is-less-than with string condition', () => {
			const taskValue = 3;
			const conditionValue = '5';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is-less-than' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should handle is-greater-than-or-equal with string condition', () => {
			const taskValue = 5;
			const conditionValue = '5';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is-greater-than-or-equal' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should handle is-less-than-or-equal with string condition', () => {
			const taskValue = 5;
			const conditionValue = '5';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is-less-than-or-equal' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});
	});

	describe('Array handling with number values', () => {
		it('should find number in array of string values', () => {
			const taskValue = [1, 2, 3]; // Array of numbers
			const conditionValue = '2'; // String condition

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should find string in array condition when task has number', () => {
			const taskValue = 2; // Number
			const conditionValue = ['1', '2', '3']; // Array of strings

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});
	});

	describe('Edge cases', () => {
		it('should handle zero value correctly', () => {
			const taskValue = 0;
			const conditionValue = '0';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			expect(result).toBe(true);
		});

		it('should not match number with different string representation', () => {
			// 1 should not match "01" or "1.0" without normalization
			const taskValue = 1;
			const conditionValue = '01'; // Leading zero

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			// This could be true or false depending on implementation
			// If we parse both as numbers: 1 === 1, so true
			// If we compare string representations: "1" !== "01", so false
			// The fix should handle this consistently
			expect(result).toBe(true); // Assuming numeric parsing is used
		});

		it('should handle NaN gracefully', () => {
			const taskValue = NaN;
			const conditionValue = 'NaN';

			const result = FilterUtils.applyOperator(
				taskValue,
				'is' as FilterOperator,
				conditionValue,
				'test-node',
				'user:custom-number-field' as FilterProperty
			);

			// NaN !== NaN, so this should probably be false or handle specially
			expect(result).toBe(false);
		});
	});
});
