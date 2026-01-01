/**
 * Issue #1289: [FR]: Allowing setting "Priority" property's type to Number
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/1289
 *
 * Feature Request: The user wants priority values like 1, 2, 3 to be stored as
 * actual numbers in YAML frontmatter rather than strings, to ensure better
 * compatibility with Obsidian formulas and calculations.
 *
 * Current behavior: Priority values are always written as strings ("1", "2", etc.)
 * Expected behavior: When configured, numeric priority values should be written as numbers
 */

import { FieldMapper } from '../../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import { TaskInfo } from '../../../src/types';

describe.skip('Issue #1289: Priority number type support', () => {
	describe('mapToFrontmatter - writing numeric priority values', () => {
		it('should write numeric priority values as numbers when priorityType is "number"', () => {
			// Configure FieldMapper with priorityType set to 'number'
			const fieldMapper = new FieldMapper({
				...DEFAULT_FIELD_MAPPING,
				priorityType: 'number',
			});

			const taskData: Partial<TaskInfo> = {
				title: 'Test Task',
				priority: '1', // User configured priority value as "1"
			};

			const frontmatter = fieldMapper.mapToFrontmatter(taskData);

			// Priority should be written as a number, not a string
			expect(typeof frontmatter.priority).toBe('number');
			expect(frontmatter.priority).toBe(1);
		});

		it('should write priority as string when priorityType is "string" (default)', () => {
			const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);

			const taskData: Partial<TaskInfo> = {
				title: 'Test Task',
				priority: '1',
			};

			const frontmatter = fieldMapper.mapToFrontmatter(taskData);

			// Priority should remain as string by default
			expect(typeof frontmatter.priority).toBe('string');
			expect(frontmatter.priority).toBe('1');
		});

		it('should handle non-numeric priority values gracefully when priorityType is "number"', () => {
			const fieldMapper = new FieldMapper({
				...DEFAULT_FIELD_MAPPING,
				priorityType: 'number',
			});

			const taskData: Partial<TaskInfo> = {
				title: 'Test Task',
				priority: 'high', // Non-numeric value
			};

			const frontmatter = fieldMapper.mapToFrontmatter(taskData);

			// Non-numeric values should remain as strings even when priorityType is 'number'
			expect(typeof frontmatter.priority).toBe('string');
			expect(frontmatter.priority).toBe('high');
		});

		it('should handle decimal priority values when priorityType is "number"', () => {
			const fieldMapper = new FieldMapper({
				...DEFAULT_FIELD_MAPPING,
				priorityType: 'number',
			});

			const taskData: Partial<TaskInfo> = {
				title: 'Test Task',
				priority: '1.5',
			};

			const frontmatter = fieldMapper.mapToFrontmatter(taskData);

			expect(typeof frontmatter.priority).toBe('number');
			expect(frontmatter.priority).toBe(1.5);
		});

		it('should handle negative priority values when priorityType is "number"', () => {
			const fieldMapper = new FieldMapper({
				...DEFAULT_FIELD_MAPPING,
				priorityType: 'number',
			});

			const taskData: Partial<TaskInfo> = {
				title: 'Test Task',
				priority: '-1',
			};

			const frontmatter = fieldMapper.mapToFrontmatter(taskData);

			expect(typeof frontmatter.priority).toBe('number');
			expect(frontmatter.priority).toBe(-1);
		});
	});

	describe('mapFromFrontmatter - reading numeric priority values', () => {
		it('should convert number priority from frontmatter to string for internal use', () => {
			const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);

			const frontmatter = {
				title: 'Test Task',
				priority: 1, // Number in frontmatter
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');

			// Internal representation should always be string
			expect(typeof taskInfo.priority).toBe('string');
			expect(taskInfo.priority).toBe('1');
		});

		it('should handle decimal numbers from frontmatter', () => {
			const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);

			const frontmatter = {
				title: 'Test Task',
				priority: 1.5,
			};

			const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');

			expect(typeof taskInfo.priority).toBe('string');
			expect(taskInfo.priority).toBe('1.5');
		});
	});

	describe('round-trip conversion', () => {
		it('should maintain consistency when converting numeric priority through full cycle', () => {
			const fieldMapper = new FieldMapper({
				...DEFAULT_FIELD_MAPPING,
				priorityType: 'number',
			});

			const originalTaskData: Partial<TaskInfo> = {
				title: 'Test Task',
				priority: '3',
			};

			// Convert to frontmatter (should become number)
			const frontmatter = fieldMapper.mapToFrontmatter(originalTaskData);
			expect(typeof frontmatter.priority).toBe('number');
			expect(frontmatter.priority).toBe(3);

			// Convert back to task data (should become string "3")
			const convertedTaskData = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');
			expect(typeof convertedTaskData.priority).toBe('string');
			expect(convertedTaskData.priority).toBe('3');
		});
	});
});
