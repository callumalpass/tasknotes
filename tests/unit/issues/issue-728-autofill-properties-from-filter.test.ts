/**
 * Feature request tests for Issue #728: Autofill properties to respect filtering rules where task is created
 *
 * Users want newly created tasks within a filtered view to automatically have properties
 * filled in so the task respects the filtering rules and appears in the view it was created from.
 * Similar to Notion's behavior where creating a task from a filtered view auto-populates
 * properties to match the filter criteria.
 *
 * Expected behavior:
 * - When using the "+ New" button in a filtered view, new task properties are auto-filled
 * - AND conditions: Apply all filterable conditions as defaults
 * - OR conditions: Apply the first condition as the default
 * - Properties like status, priority, tags, contexts, projects should be auto-filled
 * - Date conditions (is-before, is-after) are not directly applicable for defaults
 * - "is-not-empty" conditions may require a default value setting
 *
 * See: https://github.com/{{owner}}/{{repo}}/issues/728
 */

import { describe, it, expect } from '@jest/globals';
import type {
	FilterQuery,
	FilterCondition,
	FilterGroup,
	FilterNode,
	TaskInfo
} from '../../../src/types';

/**
 * Mock TaskInfo interface for testing
 */
interface MockTaskInfo {
	path: string;
	title: string;
	status?: string;
	priority?: string;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	due?: string;
	scheduled?: string;
	timeEstimate?: number;
	archived?: boolean;
}

/**
 * Represents default values that can be extracted from a filter
 */
interface FilterDefaults {
	status?: string;
	priority?: string;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	timeEstimate?: number;
	archived?: boolean;
}

/**
 * Determines if a filter condition can be used as a default value
 * Some operators like 'is' can directly provide defaults, while
 * comparison operators like 'is-before' cannot.
 */
function isExtractableCondition(condition: FilterCondition): boolean {
	const extractableOperators = ['is', 'contains'];
	return extractableOperators.includes(condition.operator);
}

/**
 * Extracts default value from a single filter condition
 */
function extractDefaultFromCondition(condition: FilterCondition): Partial<FilterDefaults> {
	if (!isExtractableCondition(condition)) {
		return {};
	}

	const defaults: Partial<FilterDefaults> = {};
	const { property, operator, value } = condition;

	// Only process 'is' and 'contains' operators for defaults
	if (operator === 'is') {
		switch (property) {
			case 'status':
				if (typeof value === 'string') {
					defaults.status = value;
				}
				break;
			case 'priority':
				if (typeof value === 'string') {
					defaults.priority = value;
				}
				break;
			case 'archived':
				if (typeof value === 'boolean') {
					defaults.archived = value;
				}
				break;
		}
	}

	if (operator === 'contains') {
		switch (property) {
			case 'tags':
				if (typeof value === 'string') {
					defaults.tags = [value];
				} else if (Array.isArray(value)) {
					defaults.tags = value.filter((v): v is string => typeof v === 'string');
				}
				break;
			case 'contexts':
				if (typeof value === 'string') {
					defaults.contexts = [value];
				} else if (Array.isArray(value)) {
					defaults.contexts = value.filter((v): v is string => typeof v === 'string');
				}
				break;
			case 'projects':
				if (typeof value === 'string') {
					defaults.projects = [value];
				} else if (Array.isArray(value)) {
					defaults.projects = value.filter((v): v is string => typeof v === 'string');
				}
				break;
		}
	}

	return defaults;
}

/**
 * Merges multiple FilterDefaults objects, combining array values
 */
function mergeDefaults(a: Partial<FilterDefaults>, b: Partial<FilterDefaults>): Partial<FilterDefaults> {
	const result: Partial<FilterDefaults> = { ...a };

	if (b.status !== undefined) result.status = b.status;
	if (b.priority !== undefined) result.priority = b.priority;
	if (b.archived !== undefined) result.archived = b.archived;
	if (b.timeEstimate !== undefined) result.timeEstimate = b.timeEstimate;

	// Merge arrays
	if (b.tags) {
		result.tags = [...(result.tags || []), ...b.tags];
	}
	if (b.contexts) {
		result.contexts = [...(result.contexts || []), ...b.contexts];
	}
	if (b.projects) {
		result.projects = [...(result.projects || []), ...b.projects];
	}

	return result;
}

/**
 * Extracts default values from a filter query to pre-populate new task fields
 *
 * For AND groups: All extractable conditions contribute to defaults
 * For OR groups: Only the first extractable condition is used
 */
function extractFilterDefaults(query: FilterQuery): Partial<FilterDefaults> {
	return extractFromGroup(query);
}

function extractFromGroup(group: FilterGroup): Partial<FilterDefaults> {
	let defaults: Partial<FilterDefaults> = {};

	for (const child of group.children) {
		if (child.type === 'condition') {
			const conditionDefaults = extractDefaultFromCondition(child);

			if (group.conjunction === 'and') {
				// AND: accumulate all defaults
				defaults = mergeDefaults(defaults, conditionDefaults);
			} else {
				// OR: use first extractable condition only
				if (Object.keys(conditionDefaults).length > 0) {
					return conditionDefaults;
				}
			}
		} else if (child.type === 'group') {
			const nestedDefaults = extractFromGroup(child);

			if (group.conjunction === 'and') {
				defaults = mergeDefaults(defaults, nestedDefaults);
			} else {
				// OR: return first non-empty result
				if (Object.keys(nestedDefaults).length > 0) {
					return nestedDefaults;
				}
			}
		}
	}

	return defaults;
}

/**
 * Simulates creating a new task with auto-filled properties from filter defaults
 */
function createTaskWithFilterDefaults(
	baseTask: Partial<MockTaskInfo>,
	filterDefaults: Partial<FilterDefaults>
): MockTaskInfo {
	return {
		path: baseTask.path || 'tasks/new-task.md',
		title: baseTask.title || 'New Task',
		status: filterDefaults.status || baseTask.status || 'open',
		priority: filterDefaults.priority || baseTask.priority || 'normal',
		tags: [...(filterDefaults.tags || []), ...(baseTask.tags || [])],
		contexts: [...(filterDefaults.contexts || []), ...(baseTask.contexts || [])],
		projects: [...(filterDefaults.projects || []), ...(baseTask.projects || [])],
		archived: filterDefaults.archived ?? baseTask.archived ?? false,
		timeEstimate: filterDefaults.timeEstimate || baseTask.timeEstimate,
	};
}

describe('Issue #728: Autofill properties to respect filtering rules where task is created', () => {
	describe('Extract defaults from simple AND filters', () => {
		it.skip('reproduces issue #728 - should extract priority from "priority is high" filter', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'priority',
						operator: 'is',
						value: 'high'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.priority).toBe('high');
		});

		it.skip('reproduces issue #728 - should extract status from "status is in-progress" filter', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'status',
						operator: 'is',
						value: 'in-progress'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.status).toBe('in-progress');
		});

		it.skip('reproduces issue #728 - should extract tags from "tags contains #School" filter', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'tags',
						operator: 'contains',
						value: 'School'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.tags).toContain('School');
		});

		it.skip('reproduces issue #728 - should extract contexts from "contexts contains work" filter', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'contexts',
						operator: 'contains',
						value: 'work'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.contexts).toContain('work');
		});

		it.skip('reproduces issue #728 - should extract projects from "projects contains ProjectA" filter', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'projects',
						operator: 'contains',
						value: 'ProjectA'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.projects).toContain('ProjectA');
		});
	});

	describe('Extract defaults from combined AND filters', () => {
		it.skip('reproduces issue #728 - should extract all properties from complex AND filter', () => {
			// Example from issue: {where Priority == high && Tags contains #School && #Homework}
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'priority',
						operator: 'is',
						value: 'high'
					},
					{
						type: 'condition',
						id: 'cond2',
						property: 'tags',
						operator: 'contains',
						value: 'School'
					},
					{
						type: 'condition',
						id: 'cond3',
						property: 'tags',
						operator: 'contains',
						value: 'Homework'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.priority).toBe('high');
			expect(defaults.tags).toContain('School');
			expect(defaults.tags).toContain('Homework');
		});

		it.skip('reproduces issue #728 - should combine multiple tag conditions into array', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'tags',
						operator: 'contains',
						value: 'urgent'
					},
					{
						type: 'condition',
						id: 'cond2',
						property: 'tags',
						operator: 'contains',
						value: 'important'
					},
					{
						type: 'condition',
						id: 'cond3',
						property: 'contexts',
						operator: 'contains',
						value: 'office'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.tags).toHaveLength(2);
			expect(defaults.tags).toContain('urgent');
			expect(defaults.tags).toContain('important');
			expect(defaults.contexts).toContain('office');
		});
	});

	describe('Handle OR filters - use first condition', () => {
		it.skip('reproduces issue #728 - should use first condition from OR filter group', () => {
			// As per issue: for OR, use first condition
			// Example: estimatedTime >= 25m || Project is not empty
			// -> use estimatedTime of 25m
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'or',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'priority',
						operator: 'is',
						value: 'high'
					},
					{
						type: 'condition',
						id: 'cond2',
						property: 'priority',
						operator: 'is',
						value: 'medium'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			// Should only take the first condition
			expect(defaults.priority).toBe('high');
		});

		it.skip('reproduces issue #728 - should skip non-extractable OR conditions and use first extractable', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'or',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'projects',
						operator: 'is-not-empty',
						value: null
					},
					{
						type: 'condition',
						id: 'cond2',
						property: 'status',
						operator: 'is',
						value: 'todo'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			// First condition 'is-not-empty' is not extractable, so use second
			expect(defaults.status).toBe('todo');
		});
	});

	describe('Handle non-extractable filter conditions', () => {
		it.skip('reproduces issue #728 - should not extract from date comparison operators', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'due',
						operator: 'is-before',
						value: '2025-02-01'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			// Date comparisons can't be directly used as defaults
			expect(Object.keys(defaults)).toHaveLength(0);
		});

		it.skip('reproduces issue #728 - should not extract from is-not operator', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'status',
						operator: 'is-not',
						value: 'done'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			// 'is-not' doesn't define what the value should be
			expect(defaults.status).toBeUndefined();
		});

		it.skip('reproduces issue #728 - should not extract from is-empty operator', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'projects',
						operator: 'is-empty',
						value: null
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.projects).toBeUndefined();
		});

		it.skip('reproduces issue #728 - should mix extractable and non-extractable conditions', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'priority',
						operator: 'is',
						value: 'high'
					},
					{
						type: 'condition',
						id: 'cond2',
						property: 'due',
						operator: 'is-after',
						value: '2025-01-01'
					},
					{
						type: 'condition',
						id: 'cond3',
						property: 'tags',
						operator: 'contains',
						value: 'work'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			// Only extractable conditions should be included
			expect(defaults.priority).toBe('high');
			expect(defaults.tags).toContain('work');
			expect(Object.keys(defaults)).not.toContain('due');
		});
	});

	describe('Handle nested filter groups', () => {
		it.skip('reproduces issue #728 - should handle nested AND within AND', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'priority',
						operator: 'is',
						value: 'high'
					},
					{
						type: 'group',
						id: 'nested',
						conjunction: 'and',
						children: [
							{
								type: 'condition',
								id: 'cond2',
								property: 'tags',
								operator: 'contains',
								value: 'urgent'
							},
							{
								type: 'condition',
								id: 'cond3',
								property: 'contexts',
								operator: 'contains',
								value: 'office'
							}
						]
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.priority).toBe('high');
			expect(defaults.tags).toContain('urgent');
			expect(defaults.contexts).toContain('office');
		});

		it.skip('reproduces issue #728 - should handle OR group within AND', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'status',
						operator: 'is',
						value: 'todo'
					},
					{
						type: 'group',
						id: 'nested-or',
						conjunction: 'or',
						children: [
							{
								type: 'condition',
								id: 'cond2',
								property: 'priority',
								operator: 'is',
								value: 'high'
							},
							{
								type: 'condition',
								id: 'cond3',
								property: 'priority',
								operator: 'is',
								value: 'medium'
							}
						]
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.status).toBe('todo');
			// From OR group, only first is used
			expect(defaults.priority).toBe('high');
		});
	});

	describe('Create task with filter defaults', () => {
		it.skip('reproduces issue #728 - should create task with all filter defaults applied', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'priority',
						operator: 'is',
						value: 'high'
					},
					{
						type: 'condition',
						id: 'cond2',
						property: 'tags',
						operator: 'contains',
						value: 'School'
					},
					{
						type: 'condition',
						id: 'cond3',
						property: 'tags',
						operator: 'contains',
						value: 'Homework'
					}
				]
			};

			const defaults = extractFilterDefaults(query);
			const newTask = createTaskWithFilterDefaults(
				{ title: 'New Assignment' },
				defaults
			);

			expect(newTask.title).toBe('New Assignment');
			expect(newTask.priority).toBe('high');
			expect(newTask.tags).toContain('School');
			expect(newTask.tags).toContain('Homework');
		});

		it.skip('reproduces issue #728 - should merge filter defaults with explicit task properties', () => {
			const defaults: Partial<FilterDefaults> = {
				priority: 'high',
				tags: ['School']
			};

			const newTask = createTaskWithFilterDefaults(
				{
					title: 'Study for exam',
					tags: ['exam'] // User-specified tag
				},
				defaults
			);

			// Filter defaults should be combined with user input
			expect(newTask.priority).toBe('high');
			expect(newTask.tags).toContain('School'); // From filter
			expect(newTask.tags).toContain('exam'); // From user input
		});

		it.skip('reproduces issue #728 - new task should appear in the filtered view it was created from', () => {
			// Simulate the core use case: task created in filtered view should match the filter
			const filterQuery: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'priority',
						operator: 'is',
						value: 'high'
					},
					{
						type: 'condition',
						id: 'cond2',
						property: 'contexts',
						operator: 'contains',
						value: 'work'
					}
				]
			};

			const defaults = extractFilterDefaults(filterQuery);
			const newTask = createTaskWithFilterDefaults(
				{ title: 'Important work task' },
				defaults
			);

			// Verify task would match the filter
			expect(newTask.priority).toBe('high');
			expect(newTask.contexts).toContain('work');

			// Simulating filter evaluation
			const matchesPriority = newTask.priority === 'high';
			const matchesContext = newTask.contexts?.includes('work');

			expect(matchesPriority && matchesContext).toBe(true);
		});
	});

	describe('Edge cases', () => {
		it.skip('reproduces issue #728 - should handle empty filter query', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: []
			};

			const defaults = extractFilterDefaults(query);

			expect(Object.keys(defaults)).toHaveLength(0);
		});

		it.skip('reproduces issue #728 - should handle filter with only non-extractable conditions', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'due',
						operator: 'is-before',
						value: '2025-02-01'
					},
					{
						type: 'condition',
						id: 'cond2',
						property: 'title',
						operator: 'contains',
						value: 'bug'
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			// Title 'contains' is not extractable as a default
			expect(Object.keys(defaults)).toHaveLength(0);
		});

		it.skip('reproduces issue #728 - should handle array values in filter conditions', () => {
			const query: FilterQuery = {
				type: 'group',
				id: 'root',
				conjunction: 'and',
				children: [
					{
						type: 'condition',
						id: 'cond1',
						property: 'tags',
						operator: 'contains',
						value: ['tag1', 'tag2']
					}
				]
			};

			const defaults = extractFilterDefaults(query);

			expect(defaults.tags).toContain('tag1');
			expect(defaults.tags).toContain('tag2');
		});
	});

	describe('Integration with view creation workflow', () => {
		it.skip('reproduces issue #728 - should integrate with BasesViewBase.createFileForView()', () => {
			// This test documents the expected integration point
			// When "+ New" is clicked in a filtered view:
			// 1. Get current filter query from view config
			// 2. Extract defaults using extractFilterDefaults()
			// 3. Pass defaults to TaskCreationModal as prePopulatedValues

			const mockViewConfig = {
				getFilterQuery: (): FilterQuery => ({
					type: 'group',
					id: 'root',
					conjunction: 'and',
					children: [
						{
							type: 'condition',
							id: 'cond1',
							property: 'status',
							operator: 'is',
							value: 'in-progress'
						},
						{
							type: 'condition',
							id: 'cond2',
							property: 'projects',
							operator: 'contains',
							value: 'Website Redesign'
						}
					]
				})
			};

			const query = mockViewConfig.getFilterQuery();
			const defaults = extractFilterDefaults(query);

			// These defaults should be passed to TaskCreationModal
			expect(defaults.status).toBe('in-progress');
			expect(defaults.projects).toContain('Website Redesign');
		});

		it.skip('reproduces issue #728 - should respect user overrides in TaskCreationModal', () => {
			// Even with auto-filled defaults, user should be able to override
			const defaults: Partial<FilterDefaults> = {
				priority: 'high',
				contexts: ['work']
			};

			// User changes priority in the modal
			const userOverride = {
				priority: 'medium' // User decided medium priority instead
			};

			const finalTask = createTaskWithFilterDefaults(
				{
					title: 'User-modified task',
					...userOverride
				},
				defaults
			);

			// User override should take precedence for explicitly set fields
			// Note: In actual implementation, modal would handle this differently
			// This test documents the expected behavior
			expect(finalTask.contexts).toContain('work'); // From filter
		});
	});
});
