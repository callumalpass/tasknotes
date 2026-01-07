/**
 * Issue #944: [Bug]: Dragging and dropping cards between custom fields may not match type
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/944
 *
 * Bug Description:
 * When dragging a card from one kanban column to another (grouped by a custom field),
 * the custom field value is updated as a string, regardless of the field's actual type.
 *
 * For example, if a custom "Sprint" field is defined as a Number type (1, 2, 3),
 * dragging a card from Sprint "1" to Sprint "2" will write the value as "2" (string)
 * instead of 2 (number).
 *
 * Root Cause:
 * In KanbanView.ts, the group key is converted to a string via `convertGroupKeyToString()`
 * (BasesDataAdapter.ts:196) for display purposes. This string value is then passed through
 * the drag-and-drop chain (setupColumnDragDrop -> handleTaskDrop -> updateTaskFrontmatterProperty)
 * without being converted back to the original property type.
 *
 * Affected code path:
 * 1. KanbanView.ts:408 - groupKey = convertGroupKeyToString(group.key) - converts to string
 * 2. KanbanView.ts:854 - setupColumnDragDrop(column, cardsContainer, groupKey)
 * 3. KanbanView.ts:1209 - handleTaskDrop(path, groupKey, null) - groupKey is string
 * 4. KanbanView.ts:1731-1735 - updateTaskFrontmatterProperty(path, prop, newGroupValue) - writes string
 *
 * This affects:
 * - Number type custom fields (sprint numbers, priority as numbers, etc.)
 * - Boolean type custom fields (would write "True"/"False" strings instead of true/false)
 * - Any scripts or Dataview queries that expect the correct type
 */

import { describe, it, expect } from '@jest/globals';

describe.skip('Issue #944: Custom field type preservation on kanban drag-and-drop', () => {
	/**
	 * Simulates the current (buggy) behavior where convertGroupKeyToString converts
	 * all values to strings before they're passed to the drop handler.
	 */
	function currentConvertGroupKeyToString(key: any): string {
		if (key === null || key === undefined) {
			return 'None';
		}
		if (typeof key === 'string') {
			return key || 'None';
		}
		if (typeof key === 'number') {
			return String(key); // BUG: Converts number to string
		}
		if (typeof key === 'boolean') {
			return key ? 'True' : 'False'; // BUG: Converts boolean to string
		}
		return String(key);
	}

	/**
	 * Simulates writing a value to frontmatter (current behavior writes as-is)
	 */
	function simulateWriteToFrontmatter(value: any): { writtenValue: any; writtenType: string } {
		// Current behavior: value is passed through as-is (already a string)
		return {
			writtenValue: value,
			writtenType: typeof value,
		};
	}

	describe('Number type custom fields', () => {
		it('should preserve number type when dragging between sprint columns (currently fails)', () => {
			// User has a "Sprint" custom field defined as Number type
			// Original value in frontmatter: sprint: 1 (number)
			const originalValue = 1;
			const targetColumnValue = 2;

			// Step 1: Value is converted to string for column key (current behavior)
			const columnKey = currentConvertGroupKeyToString(targetColumnValue);
			expect(columnKey).toBe('2'); // This is the displayed column name

			// Step 2: When card is dropped, this string is passed to frontmatter update
			const result = simulateWriteToFrontmatter(columnKey);

			// BUG: The value is written as a string "2" instead of number 2
			// Expected: writtenType should be 'number' and writtenValue should be 2
			expect(result.writtenType).toBe('number');
			expect(result.writtenValue).toBe(2);
		});

		it('should preserve negative number values', () => {
			const originalValue = -1;
			const targetColumnValue = -2;

			const columnKey = currentConvertGroupKeyToString(targetColumnValue);
			const result = simulateWriteToFrontmatter(columnKey);

			expect(result.writtenType).toBe('number');
			expect(result.writtenValue).toBe(-2);
		});

		it('should preserve decimal number values', () => {
			const targetColumnValue = 1.5;

			const columnKey = currentConvertGroupKeyToString(targetColumnValue);
			const result = simulateWriteToFrontmatter(columnKey);

			expect(result.writtenType).toBe('number');
			expect(result.writtenValue).toBe(1.5);
		});
	});

	describe('Boolean type custom fields', () => {
		it('should preserve boolean true when dragging to "True" column (currently fails)', () => {
			// User has an "Archived" custom field defined as Checkbox/Boolean type
			const targetColumnValue = true;

			// Current behavior converts to "True" string
			const columnKey = currentConvertGroupKeyToString(targetColumnValue);
			expect(columnKey).toBe('True');

			const result = simulateWriteToFrontmatter(columnKey);

			// BUG: The value is written as string "True" instead of boolean true
			expect(result.writtenType).toBe('boolean');
			expect(result.writtenValue).toBe(true);
		});

		it('should preserve boolean false when dragging to "False" column', () => {
			const targetColumnValue = false;

			const columnKey = currentConvertGroupKeyToString(targetColumnValue);
			expect(columnKey).toBe('False');

			const result = simulateWriteToFrontmatter(columnKey);

			expect(result.writtenType).toBe('boolean');
			expect(result.writtenValue).toBe(false);
		});
	});

	describe('String type custom fields', () => {
		it('should work correctly for string fields (no conversion needed)', () => {
			// String fields should continue to work since they're already strings
			const targetColumnValue = 'In Progress';

			const columnKey = currentConvertGroupKeyToString(targetColumnValue);
			const result = simulateWriteToFrontmatter(columnKey);

			// String fields work correctly with current implementation
			expect(result.writtenType).toBe('string');
			expect(result.writtenValue).toBe('In Progress');
		});
	});

	describe('Type conversion on drop', () => {
		/**
		 * This test documents the expected fix: we need to convert the string
		 * column key back to the original property type before writing.
		 */
		it('should convert string column key back to original type before writing', () => {
			// Mock metadataTypeManager that would provide property type info
			const mockPropertyTypes: Record<string, string> = {
				sprint: 'number',
				archived: 'checkbox',
				priority: 'number',
				status: 'text',
			};

			function convertToPropertyType(value: string, propertyName: string): any {
				const propertyType = mockPropertyTypes[propertyName.toLowerCase()];

				switch (propertyType) {
					case 'number':
						const num = parseFloat(value);
						return isNaN(num) ? value : num;
					case 'checkbox':
						if (value === 'True' || value === 'true') return true;
						if (value === 'False' || value === 'false') return false;
						return value;
					default:
						return value;
				}
			}

			// Test number conversion
			expect(convertToPropertyType('2', 'sprint')).toBe(2);
			expect(typeof convertToPropertyType('2', 'sprint')).toBe('number');

			// Test boolean conversion
			expect(convertToPropertyType('True', 'archived')).toBe(true);
			expect(typeof convertToPropertyType('True', 'archived')).toBe('boolean');

			// Test string passthrough
			expect(convertToPropertyType('In Progress', 'status')).toBe('In Progress');
			expect(typeof convertToPropertyType('In Progress', 'status')).toBe('string');
		});
	});

	describe('Script/webhook trigger consistency', () => {
		/**
		 * The reporter mentioned that their custom script only runs when manually
		 * updating the Sprint field, not when dragging. This may be related to
		 * the type mismatch - the script might be checking for number type values.
		 */
		it('should trigger same behavior as manual field update', () => {
			// This test documents that drag-and-drop should produce identical
			// frontmatter to manual field updates

			// Manual update writes: sprint: 2 (number)
			const manualUpdateValue = 2;
			const manualUpdateType = typeof manualUpdateValue;

			// Drag-and-drop currently writes: sprint: "2" (string)
			const dragDropValue = currentConvertGroupKeyToString(2);
			const dragDropType = typeof dragDropValue;

			// These should be identical but currently aren't
			expect(dragDropType).toBe(manualUpdateType);
			expect(dragDropValue).toBe(manualUpdateValue);
		});
	});
});
