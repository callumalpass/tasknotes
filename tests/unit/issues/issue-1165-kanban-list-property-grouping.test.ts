/**
 * Regression coverage for Issue #1165: Kanban GroupBy property type 'list'
 * should treat multiple entries individually, not as a single combined entry.
 *
 * When grouping by a list property (like contexts, tags, projects), a task with
 * multiple values should appear in each column, not a single "combined" column.
 *
 * Example: A task with contexts ["work", "call", "bus"] should appear in:
 * - The "work" column
 * - The "call" column
 * - The "bus" column
 *
 * NOT in a single "work, call, bus" column.
 */

import { describe, it, expect } from '@jest/globals';

interface MockTaskInfo {
	path: string;
	title: string;
	contexts?: string[];
	tags?: string[];
	projects?: string[];
	status?: string;
}

/**
 * Simulates the list property explosion logic in KanbanView.groupTasks()
 */
function groupTasksWithExplosion(
	tasks: MockTaskInfo[],
	groupByProperty: string,
	explodeListColumns: boolean
): Map<string, MockTaskInfo[]> {
	const groups = new Map<string, MockTaskInfo[]>();

	// Simplified list property detection
	const listProperties = new Set(['contexts', 'tags', 'projects', 'aliases']);
	const isListProperty = listProperties.has(groupByProperty);
	const shouldExplode = explodeListColumns && isListProperty;

	if (shouldExplode) {
		for (const task of tasks) {
			const value = (task as any)[groupByProperty];

			if (Array.isArray(value) && value.length > 0) {
				// Add task to each individual value's column
				for (const item of value) {
					const columnKey = String(item) || "None";
					if (!groups.has(columnKey)) {
						groups.set(columnKey, []);
					}
					groups.get(columnKey)!.push(task);
				}
			} else {
				// No values, empty array, or not an array - put in "None" column
				if (!groups.has("None")) {
					groups.set("None", []);
				}
				groups.get("None")!.push(task);
			}
		}
	} else {
		// Old behavior: join array values into a single key
		for (const task of tasks) {
			const value = (task as any)[groupByProperty];
			let columnKey: string;

			if (Array.isArray(value) && value.length > 0) {
				columnKey = value.join(", ");
			} else {
				columnKey = value ? String(value) : "None";
			}

			if (!groups.has(columnKey)) {
				groups.set(columnKey, []);
			}
			groups.get(columnKey)!.push(task);
		}
	}

	return groups;
}

/**
 * Simulates the list property update logic when dragging between columns
 */
function updateListPropertyOnDrop(
	currentValues: string[],
	sourceColumn: string,
	targetColumn: string
): string[] {
	// If dropping on the same column, do nothing
	if (sourceColumn === targetColumn) return currentValues;

	// Remove source value, add target value (if not already present and not "None")
	const newValue = currentValues.filter(v => v !== sourceColumn);
	if (!newValue.includes(targetColumn) && targetColumn !== "None") {
		newValue.push(targetColumn);
	}

	return newValue;
}

describe('Issue #1165: Kanban list property grouping', () => {
	const taskWithMultipleContexts: MockTaskInfo = {
		path: 'tasks/call-boss.md',
		title: 'Call boss',
		contexts: ['call', 'work', 'bus'],
		status: 'todo'
	};

	const taskWithSingleContext: MockTaskInfo = {
		path: 'tasks/write-report.md',
		title: 'Write report',
		contexts: ['work'],
		status: 'todo'
	};

	const taskWithNoContext: MockTaskInfo = {
		path: 'tasks/random-thought.md',
		title: 'Random thought',
		contexts: [],
		status: 'todo'
	};

	describe('When explodeListColumns is true (default)', () => {
		it('should place task with multiple contexts in each context column', () => {
			const groups = groupTasksWithExplosion(
				[taskWithMultipleContexts],
				'contexts',
				true
			);

			// Should have 3 separate columns
			expect(groups.size).toBe(3);
			expect(groups.has('call')).toBe(true);
			expect(groups.has('work')).toBe(true);
			expect(groups.has('bus')).toBe(true);

			// Task should be in each column
			expect(groups.get('call')).toContain(taskWithMultipleContexts);
			expect(groups.get('work')).toContain(taskWithMultipleContexts);
			expect(groups.get('bus')).toContain(taskWithMultipleContexts);
		});

		it('should NOT create combined column like "call, work, bus"', () => {
			const groups = groupTasksWithExplosion(
				[taskWithMultipleContexts],
				'contexts',
				true
			);

			expect(groups.has('call, work, bus')).toBe(false);
		});

		it('should correctly group tasks with different contexts', () => {
			const groups = groupTasksWithExplosion(
				[taskWithMultipleContexts, taskWithSingleContext],
				'contexts',
				true
			);

			// Should have: call, work, bus (4 columns total, but work is shared)
			expect(groups.size).toBe(3);

			// "work" column should have both tasks
			expect(groups.get('work')?.length).toBe(2);
			expect(groups.get('work')).toContain(taskWithMultipleContexts);
			expect(groups.get('work')).toContain(taskWithSingleContext);

			// "call" and "bus" should only have the multi-context task
			expect(groups.get('call')?.length).toBe(1);
			expect(groups.get('bus')?.length).toBe(1);
		});

		it('should place task with no contexts in "None" column', () => {
			const groups = groupTasksWithExplosion(
				[taskWithNoContext],
				'contexts',
				true
			);

			expect(groups.size).toBe(1);
			expect(groups.has('None')).toBe(true);
			expect(groups.get('None')).toContain(taskWithNoContext);
		});

		it('should work with tags property', () => {
			const taskWithTags: MockTaskInfo = {
				path: 'tasks/tagged.md',
				title: 'Tagged task',
				tags: ['urgent', 'review', 'follow-up']
			};

			const groups = groupTasksWithExplosion([taskWithTags], 'tags', true);

			expect(groups.size).toBe(3);
			expect(groups.has('urgent')).toBe(true);
			expect(groups.has('review')).toBe(true);
			expect(groups.has('follow-up')).toBe(true);
		});

		it('should work with projects property', () => {
			const taskWithProjects: MockTaskInfo = {
				path: 'tasks/multi-project.md',
				title: 'Multi-project task',
				projects: ['[[Project A]]', '[[Project B]]']
			};

			const groups = groupTasksWithExplosion([taskWithProjects], 'projects', true);

			expect(groups.size).toBe(2);
			expect(groups.has('[[Project A]]')).toBe(true);
			expect(groups.has('[[Project B]]')).toBe(true);
		});

		it('should NOT explode non-list properties like status', () => {
			const groups = groupTasksWithExplosion(
				[taskWithMultipleContexts, taskWithSingleContext],
				'status',
				true
			);

			// Status is not a list property, so no explosion
			expect(groups.size).toBe(1);
			expect(groups.has('todo')).toBe(true);
			expect(groups.get('todo')?.length).toBe(2);
		});
	});

	describe('When explodeListColumns is false', () => {
		it('should create combined column like "call, work, bus" (legacy behavior)', () => {
			const groups = groupTasksWithExplosion(
				[taskWithMultipleContexts],
				'contexts',
				false
			);

			// Should have 1 combined column
			expect(groups.size).toBe(1);
			expect(groups.has('call, work, bus')).toBe(true);
			expect(groups.has('call')).toBe(false);
			expect(groups.has('work')).toBe(false);
			expect(groups.has('bus')).toBe(false);
		});

		it('should create separate combined columns for different combinations', () => {
			const groups = groupTasksWithExplosion(
				[taskWithMultipleContexts, taskWithSingleContext],
				'contexts',
				false
			);

			// Should have 2 columns: "call, work, bus" and "work"
			expect(groups.size).toBe(2);
			expect(groups.has('call, work, bus')).toBe(true);
			expect(groups.has('work')).toBe(true);
		});
	});

	describe('Drag and drop behavior for list properties', () => {
		it('should remove source value and add target value when dragging between columns', () => {
			// Task starts with contexts: ["call", "work", "bus"]
			// User drags from "work" column to "home" column
			const result = updateListPropertyOnDrop(
				['call', 'work', 'bus'],
				'work',
				'home'
			);

			// Should have: ["call", "bus", "home"]
			expect(result).toContain('call');
			expect(result).toContain('bus');
			expect(result).toContain('home');
			expect(result).not.toContain('work');
			expect(result.length).toBe(3);
		});

		it('should not duplicate value if target already exists in list', () => {
			// Task has contexts: ["call", "work", "bus"]
			// User drags from "call" column to "work" column (work already exists)
			const result = updateListPropertyOnDrop(
				['call', 'work', 'bus'],
				'call',
				'work'
			);

			// Should have: ["work", "bus"] - work not duplicated
			expect(result).toContain('work');
			expect(result).toContain('bus');
			expect(result).not.toContain('call');
			expect(result.length).toBe(2);
		});

		it('should do nothing when dropping on same column', () => {
			const result = updateListPropertyOnDrop(
				['call', 'work', 'bus'],
				'work',
				'work'
			);

			// Should be unchanged
			expect(result).toEqual(['call', 'work', 'bus']);
		});

		it('should handle dropping to "None" column (removes value without adding)', () => {
			// User drags from "work" column to "None" column
			const result = updateListPropertyOnDrop(
				['call', 'work', 'bus'],
				'work',
				'None'
			);

			// Should have: ["call", "bus"] - work removed, "None" not added
			expect(result).toContain('call');
			expect(result).toContain('bus');
			expect(result).not.toContain('work');
			expect(result).not.toContain('None');
			expect(result.length).toBe(2);
		});

		it('should handle single value becoming empty when dragged to None', () => {
			const result = updateListPropertyOnDrop(
				['work'],
				'work',
				'None'
			);

			// Should be empty array
			expect(result).toEqual([]);
		});

		it('should handle dragging from None column to a real column', () => {
			// Task has no contexts, user drags from "None" to "work"
			// Note: In practice, the source would be "None" string
			const result = updateListPropertyOnDrop(
				[],
				'None',
				'work'
			);

			// Should have: ["work"]
			expect(result).toEqual(['work']);
		});
	});
});
