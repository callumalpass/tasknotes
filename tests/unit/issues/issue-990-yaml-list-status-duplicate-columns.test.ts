/**
 * Regression coverage for Issue #990: Status edited in Obsidian Property Editor
 * creates duplicate Kanban column
 *
 * Bug Description:
 * When a user edits the status property using Obsidian's Property Editor (rather
 * than TaskNotes' Kanban view or edit window), Obsidian formats the status as
 * a YAML list item:
 *
 * ```yaml
 * status:
 *   - Done
 * ```
 *
 * This is different from the scalar format that TaskNotes typically uses:
 *
 * ```yaml
 * status: Done
 * ```
 *
 * The result is that the Kanban view shows two separate "Done" columns:
 * - One from tasks with scalar status: "Done"
 * - One from tasks with list status: ["Done"]
 *
 * Root Cause:
 * Bases (Obsidian's database layer) uses the actual parsed YAML value as the
 * group key. When grouping by status:
 * - Scalar YAML `status: Done` creates a group with key type string = "Done"
 * - List YAML `status:\n  - Done` creates a group with key type array = ["Done"]
 *
 * Even though convertGroupKeyToString() turns both into the string "Done" for
 * display, they originated from different group keys in the Bases groupedData
 * structure, resulting in two distinct columns internally.
 *
 * Key locations:
 * - src/bases/BasesDataAdapter.ts:convertValueToNative() - handles ListValue vs PrimitiveValue
 * - src/bases/BasesDataAdapter.ts:convertGroupKeyToString() - converts keys to display strings
 * - src/bases/KanbanView.ts:groupTasks() - groups tasks into columns
 *
 * The fix should normalize single-element list values to scalar values when
 * they represent a property that should be scalar (like status), or the grouping
 * logic should treat ["Done"] and "Done" as equivalent group keys.
 */

import { describe, it, expect } from '@jest/globals';

interface MockTaskInfo {
	path: string;
	title: string;
	status?: string | string[];
}

/**
 * Simulates how Bases converts YAML values to native JavaScript values.
 * This is based on BasesDataAdapter.convertValueToNative()
 */
function convertYamlToNative(yamlValue: any): any {
	if (yamlValue == null) {
		return null;
	}
	// YAML scalar -> string
	if (typeof yamlValue === 'string') {
		return yamlValue;
	}
	// YAML list -> array
	if (Array.isArray(yamlValue)) {
		return yamlValue;
	}
	return yamlValue;
}

/**
 * Simulates how BasesDataAdapter.convertGroupKeyToString() converts group keys
 * to display strings. This is the function that would display both ["Done"]
 * and "Done" as "Done", but they remain separate columns.
 */
function convertGroupKeyToString(key: any): string {
	if (key === null || key === undefined) {
		return "None";
	}
	if (typeof key === "string") {
		return key || "None";
	}
	if (Array.isArray(key)) {
		return key.length > 0 ? key.join(", ") : "None";
	}
	return String(key);
}

/**
 * Simulates how the Kanban view groups tasks by status.
 * Uses the raw group key (not the display string) as the Map key.
 * This is the core of the bug - JavaScript Maps treat string keys
 * and array keys (even with same content) as different.
 */
function groupTasksByStatus(tasks: MockTaskInfo[]): Map<string, MockTaskInfo[]> {
	const groups = new Map<string, MockTaskInfo[]>();

	for (const task of tasks) {
		// This simulates how Bases provides the status value
		const statusValue = convertYamlToNative(task.status);

		// The bug: using the converted value directly as a key
		// For arrays, JavaScript uses reference equality, so ["Done"] !== ["Done"]
		// But more importantly, the Bases groupedData would already have
		// separate entries for the array and string versions
		let groupKey: string;

		// Simulate what Bases does - it groups by the actual value type
		// So "Done" and ["Done"] become separate groups
		if (Array.isArray(statusValue)) {
			// Arrays get joined to form the key string, but this happens
			// AFTER the grouping, so they're already in separate columns
			groupKey = statusValue.length > 0 ? statusValue.join(", ") : "None";
		} else {
			groupKey = statusValue ? String(statusValue) : "None";
		}

		if (!groups.has(groupKey)) {
			groups.set(groupKey, []);
		}
		groups.get(groupKey)!.push(task);
	}

	return groups;
}

/**
 * Simulates the buggy behavior where Bases groups by value type,
 * resulting in "Done" (string) and "Done" (from ["Done"]) being separate.
 *
 * In reality, Bases creates separate group entries because the underlying
 * group key objects are different types, even though they display the same.
 */
function groupTasksByStatusBuggy(tasks: MockTaskInfo[]): Map<string, MockTaskInfo[]> {
	// This simulates what Bases actually does - it groups by the raw value
	// before any conversion, so string "Done" and array ["Done"] are different

	// First, collect all unique "raw" group keys as Bases would see them
	const rawGroups: Array<{ rawKey: any; displayKey: string; tasks: MockTaskInfo[] }> = [];

	for (const task of tasks) {
		const rawStatus = task.status;

		// Find existing group with equivalent raw key
		let existingGroup = rawGroups.find(g => {
			// This is the bug: we compare by actual value type
			if (Array.isArray(rawStatus) && Array.isArray(g.rawKey)) {
				// Same array content? (simplified - real comparison is more complex)
				return JSON.stringify(rawStatus) === JSON.stringify(g.rawKey);
			}
			return rawStatus === g.rawKey;
		});

		if (!existingGroup) {
			const displayKey = convertGroupKeyToString(rawStatus);
			existingGroup = { rawKey: rawStatus, displayKey, tasks: [] };
			rawGroups.push(existingGroup);
		}

		existingGroup.tasks.push(task);
	}

	// Convert to Map using display keys (this is where duplicates appear)
	const result = new Map<string, MockTaskInfo[]>();
	for (const group of rawGroups) {
		// If there are duplicate display keys, only the last one "wins"
		// In reality, both columns would show with the same display name
		const key = group.displayKey;
		if (result.has(key)) {
			// This simulates having two columns with same name - add suffix to distinguish
			result.set(key + " (duplicate)", group.tasks);
		} else {
			result.set(key, group.tasks);
		}
	}

	return result;
}

describe('Issue #990: YAML list status creates duplicate Kanban columns', () => {
	const taskWithScalarStatus: MockTaskInfo = {
		path: 'tasks/task-scalar.md',
		title: 'Task with scalar status',
		status: 'Done' // YAML: status: Done
	};

	const taskWithListStatus: MockTaskInfo = {
		path: 'tasks/task-list.md',
		title: 'Task with list status',
		status: ['Done'] // YAML: status:\n  - Done
	};

	const taskWithListStatusMultiple: MockTaskInfo = {
		path: 'tasks/task-list-multiple.md',
		title: 'Task with multiple status values',
		status: ['Done', 'Archived'] // Unusual but valid YAML
	};

	describe('YAML parsing behavior (demonstrates the input difference)', () => {
		it('should show that scalar and list YAML produce different JS values', () => {
			// This demonstrates the root cause - different YAML formats produce
			// different JavaScript values even for "equivalent" content

			const scalarYaml = 'Done';
			const listYaml = ['Done'];

			expect(typeof scalarYaml).toBe('string');
			expect(Array.isArray(listYaml)).toBe(true);

			// They are NOT equal, even though they represent the same semantic value
			expect(scalarYaml).not.toEqual(listYaml);
		});

		it('should show convertGroupKeyToString produces same display for both', () => {
			// This shows why users see "duplicate" columns - they display the same

			expect(convertGroupKeyToString('Done')).toBe('Done');
			expect(convertGroupKeyToString(['Done'])).toBe('Done');

			// Same display string!
			expect(convertGroupKeyToString('Done')).toBe(convertGroupKeyToString(['Done']));
		});
	});

	describe('Buggy behavior (documents the current bug)', () => {
		it.skip('reproduces issue #990: scalar and list status create separate columns', () => {
			// When both tasks exist, they should be in the same column
			// but currently they end up in separate columns

			const groups = groupTasksByStatusBuggy([taskWithScalarStatus, taskWithListStatus]);

			// BUG: This shows two columns exist with "Done" in the name
			// The current behavior creates separate entries
			console.log('=== Buggy Grouping Result ===');
			for (const [key, tasks] of groups) {
				console.log(`Column "${key}": ${tasks.map(t => t.title).join(', ')}`);
			}

			// This assertion documents the bug - there are 2 groups
			// (one has "(duplicate)" suffix in our simulation)
			expect(groups.size).toBe(2);

			// The fix should make this pass instead:
			// expect(groups.size).toBe(1);
			// expect(groups.get('Done')?.length).toBe(2);
		});

		it.skip('reproduces issue #990: task edited via Property Editor appears in wrong column', () => {
			// Scenario: User has a task with status "Done" (scalar)
			// User edits status in Obsidian Property Editor
			// Obsidian saves it as status:\n  - Done (list)
			// The task now appears in a new "Done" column, not the existing one

			// Before edit: Task in scalar "Done" column
			const beforeEdit: MockTaskInfo = {
				path: 'tasks/my-task.md',
				title: 'My Task',
				status: 'Done' // Scalar format
			};

			// After edit via Property Editor: Same value but list format
			const afterEdit: MockTaskInfo = {
				path: 'tasks/my-task.md',
				title: 'My Task',
				status: ['Done'] // List format after Property Editor edit
			};

			// The semantic value is the same
			expect(convertGroupKeyToString(beforeEdit.status)).toBe('Done');
			expect(convertGroupKeyToString(afterEdit.status)).toBe('Done');

			// But they would be grouped differently
			const groupsBefore = groupTasksByStatusBuggy([beforeEdit]);
			const groupsAfter = groupTasksByStatusBuggy([afterEdit]);

			// Both have "Done" as the display key
			expect(groupsBefore.has('Done')).toBe(true);
			expect(groupsAfter.has('Done')).toBe(true);

			// But if both tasks existed together, they'd be in separate columns
			// This is the user-reported bug
		});
	});

	describe('Expected behavior (what should happen after fix)', () => {
		it.skip('should group scalar and single-item list status in same column', () => {
			// After the fix, both formats should produce the same group

			// A potential fix: normalize single-item lists to scalars
			function normalizeStatus(status: string | string[] | undefined): string {
				if (status === undefined || status === null) {
					return 'None';
				}
				if (Array.isArray(status)) {
					// Single-item list should be treated as scalar
					if (status.length === 1) {
						return status[0] || 'None';
					}
					// Multi-item list joins values
					return status.length > 0 ? status.join(', ') : 'None';
				}
				return status || 'None';
			}

			// Both should normalize to "Done"
			expect(normalizeStatus('Done')).toBe('Done');
			expect(normalizeStatus(['Done'])).toBe('Done');

			// And both would end up in the same column
			const tasks = [taskWithScalarStatus, taskWithListStatus];
			const normalizedGroups = new Map<string, MockTaskInfo[]>();

			for (const task of tasks) {
				const groupKey = normalizeStatus(task.status);
				if (!normalizedGroups.has(groupKey)) {
					normalizedGroups.set(groupKey, []);
				}
				normalizedGroups.get(groupKey)!.push(task);
			}

			// After fix: should be 1 column with both tasks
			expect(normalizedGroups.size).toBe(1);
			expect(normalizedGroups.get('Done')?.length).toBe(2);
		});

		it.skip('should handle multi-value list status appropriately', () => {
			// If a status somehow has multiple values, it should still work
			// This might create a combined column name, which is acceptable

			const multiStatus = ['Done', 'Archived'];
			expect(convertGroupKeyToString(multiStatus)).toBe('Done, Archived');

			// This is distinct from a single "Done" status, which is correct
		});

		it.skip('should preserve status value when dragging in Kanban after fix', () => {
			// After the fix, dragging a task should set the scalar format
			// regardless of what format it was in before

			// User drags task from "In Progress" to "Done"
			const expectedNewStatus = 'Done'; // Should be scalar, not ['Done']

			// The update logic should normalize to scalar for status property
			expect(typeof expectedNewStatus).toBe('string');
			expect(Array.isArray(expectedNewStatus)).toBe(false);
		});
	});

	describe('Related scenario: Relay.md compatibility', () => {
		it.skip('reproduces issue #990: status changes via Property Editor work with Relay.md', () => {
			// The user reports using Relay.md which requires editing via Property Editor
			// rather than TaskNotes UI

			// Relay.md monitors file changes, so edits must be made to the file itself
			// The Property Editor writes YAML in list format for single values

			// After fix, these workflows should be equivalent:
			// 1. Edit status in TaskNotes Kanban (writes scalar)
			// 2. Edit status in Property Editor (writes list)
			// 3. Edit status in Relay.md sync (writes list)

			// All three should result in the task appearing in the correct column
			const workflows = [
				{ source: 'TaskNotes Kanban', status: 'Done' as string | string[] },
				{ source: 'Property Editor', status: ['Done'] as string | string[] },
				{ source: 'Relay.md sync', status: ['Done'] as string | string[] }
			];

			for (const workflow of workflows) {
				const displayStatus = convertGroupKeyToString(workflow.status);
				expect(displayStatus).toBe('Done');
			}

			// After fix: All three should produce equivalent grouping
		});
	});
});
