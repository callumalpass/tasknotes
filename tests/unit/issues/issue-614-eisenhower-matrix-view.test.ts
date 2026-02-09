/**
 * Issue #614: [FR] Add Eisenhower Matrix View
 *
 * @see https://github.com/callumalpass/tasknotes/issues/614
 *
 * Feature Request:
 * Add a dedicated Eisenhower Matrix view that categorizes tasks into four quadrants
 * based on "Importance" and "Urgency" properties:
 *   Q1: Important & Urgent (Do)
 *   Q2: Important & Not Urgent (Schedule)
 *   Q3: Not Important & Urgent (Delegate)
 *   Q4: Not Important & Not Urgent (Delete)
 *
 * Current Behavior:
 * - There is no Eisenhower Matrix view type registered in registration.ts.
 * - The TaskInfo interface has no native "importance" or "urgency" fields.
 *   These would need to be user-defined custom fields (via UserMappedField)
 *   or derived from existing properties (priority, due date proximity) via formulas.
 * - The existing urgencyScore formula in defaultBasesFiles.ts (line ~381) computes
 *   a numerical urgency based on priorityWeight + days until due/scheduled, but this
 *   is a single combined score, not separate importance/urgency axes.
 * - Kanban swimlanes can approximate a 2D grid, but there is no dedicated
 *   four-quadrant layout or Eisenhower-specific labeling/semantics.
 *
 * Expected Behavior:
 * - A new Bases view type (e.g., "tasknotesEisenhower") should be registered
 *   alongside the existing Task List, Kanban, Calendar, and MiniCalendar views.
 * - The view should render tasks in a 2x2 quadrant grid.
 * - Users should be able to configure which properties map to the "importance"
 *   and "urgency" axes (via view options, similar to Kanban's swimLane property).
 * - Tasks should be automatically placed in the correct quadrant based on their
 *   property values.
 *
 * Related Files:
 * - src/bases/registration.ts: View registration (currently: TaskList, Kanban, Calendar, MiniCalendar)
 * - src/bases/BasesViewBase.ts: Abstract base class for all Bases views
 * - src/bases/KanbanView.ts: Closest existing view (has swimlane 2D grouping)
 * - src/templates/defaultBasesFiles.ts: Default .base files and formulas (urgencyScore at line ~381)
 * - src/types.ts: TaskInfo interface (no importance/urgency fields; customProperties at line 461)
 * - src/types/settings.ts: UserMappedField for custom properties
 */

import { describe, it, expect } from '@jest/globals';
import type { TaskInfo } from '../../../src/types';

/**
 * Helper to create a task with custom importance/urgency properties
 */
function createTaskWithPriorityAxes(
	title: string,
	importance: 'high' | 'low',
	urgency: 'high' | 'low',
	overrides?: Partial<TaskInfo>
): TaskInfo {
	return {
		title,
		status: ' ',
		priority: '',
		path: `tasks/${title.toLowerCase().replace(/\s+/g, '-')}.md`,
		archived: false,
		customProperties: {
			importance,
			urgency,
		},
		...overrides,
	};
}

type Quadrant = 'do' | 'schedule' | 'delegate' | 'delete';

/**
 * Categorize a task into an Eisenhower quadrant based on its importance/urgency.
 * This represents the core logic that an Eisenhower view would implement.
 */
function categorizeTask(task: TaskInfo, importanceKey = 'importance', urgencyKey = 'urgency'): Quadrant | null {
	const importance = task.customProperties?.[importanceKey];
	const urgency = task.customProperties?.[urgencyKey];

	if (!importance || !urgency) return null;

	const isImportant = String(importance).toLowerCase() === 'high';
	const isUrgent = String(urgency).toLowerCase() === 'high';

	if (isImportant && isUrgent) return 'do';
	if (isImportant && !isUrgent) return 'schedule';
	if (!isImportant && isUrgent) return 'delegate';
	return 'delete';
}

describe('Issue #614: Eisenhower Matrix View', () => {

	describe('quadrant categorization logic', () => {
		it.skip('reproduces issue #614 - tasks with high importance and high urgency should be in "Do" quadrant', () => {
			const task = createTaskWithPriorityAxes('Critical deadline', 'high', 'high');
			expect(categorizeTask(task)).toBe('do');
		});

		it.skip('reproduces issue #614 - tasks with high importance and low urgency should be in "Schedule" quadrant', () => {
			const task = createTaskWithPriorityAxes('Strategic planning', 'high', 'low');
			expect(categorizeTask(task)).toBe('schedule');
		});

		it.skip('reproduces issue #614 - tasks with low importance and high urgency should be in "Delegate" quadrant', () => {
			const task = createTaskWithPriorityAxes('Reply to email', 'low', 'high');
			expect(categorizeTask(task)).toBe('delegate');
		});

		it.skip('reproduces issue #614 - tasks with low importance and low urgency should be in "Delete" quadrant', () => {
			const task = createTaskWithPriorityAxes('Browse social media', 'low', 'low');
			expect(categorizeTask(task)).toBe('delete');
		});

		it.skip('reproduces issue #614 - tasks without importance/urgency properties should be uncategorized', () => {
			const task: TaskInfo = {
				title: 'Uncategorized task',
				status: ' ',
				priority: '',
				path: 'tasks/uncategorized.md',
				archived: false,
			};
			expect(categorizeTask(task)).toBeNull();
		});
	});

	describe('view registration', () => {
		it.skip('reproduces issue #614 - no Eisenhower view type is currently registered', () => {
			// The registered Bases view types are:
			//   - tasknotesTaskList
			//   - tasknotesKanban
			//   - tasknotesCalendar
			//   - tasknotesCalendarMini
			//
			// There is no "tasknotesEisenhower" view registered in registration.ts.
			// After the feature is implemented, the view should be registered with
			// options for selecting importance and urgency property mappings.
			const registeredViewTypes = [
				'tasknotesTaskList',
				'tasknotesKanban',
				'tasknotesCalendar',
				'tasknotesCalendarMini',
			];

			expect(registeredViewTypes).not.toContain('tasknotesEisenhower');

			// After implementation, this should pass:
			// expect(registeredViewTypes).toContain('tasknotesEisenhower');
		});
	});

	describe('property mapping', () => {
		it.skip('reproduces issue #614 - should support configurable property keys for importance and urgency', () => {
			// Users may use different frontmatter keys for importance/urgency.
			// The view should allow configuring which properties to use, similar
			// to how KanbanView lets users select a swimLane property.
			const taskWithCustomKeys = createTaskWithPriorityAxes('Custom task', 'high', 'low');
			// Override with different property names
			taskWithCustomKeys.customProperties = {
				impact: 'high',
				timepress: 'low',
			};

			// Using default keys should fail
			expect(categorizeTask(taskWithCustomKeys)).toBeNull();

			// Using custom keys should work
			expect(categorizeTask(taskWithCustomKeys, 'impact', 'timepress')).toBe('schedule');
		});

		it.skip('reproduces issue #614 - should handle numeric importance/urgency values', () => {
			// Users might use numeric scales (1-5) instead of high/low.
			// The view should support threshold-based categorization.
			const task: TaskInfo = {
				title: 'Numeric priority task',
				status: ' ',
				priority: '',
				path: 'tasks/numeric.md',
				archived: false,
				customProperties: {
					importance: 4, // Numeric scale 1-5
					urgency: 2,
				},
			};

			// The current string-based categorization won't handle numeric values.
			// A proper implementation should support configurable thresholds
			// (e.g., >= 3 = "high", < 3 = "low").
			expect(categorizeTask(task)).toBeNull(); // Fails with numeric values
		});
	});

	describe('task distribution across quadrants', () => {
		it.skip('reproduces issue #614 - all tasks should be distributed across exactly four quadrants', () => {
			const tasks = [
				createTaskWithPriorityAxes('Fix production bug', 'high', 'high'),
				createTaskWithPriorityAxes('Plan Q3 roadmap', 'high', 'low'),
				createTaskWithPriorityAxes('Answer support ticket', 'low', 'high'),
				createTaskWithPriorityAxes('Organize bookmarks', 'low', 'low'),
				createTaskWithPriorityAxes('Deploy hotfix', 'high', 'high'),
				createTaskWithPriorityAxes('Learn new framework', 'high', 'low'),
			];

			const quadrants = new Map<Quadrant, TaskInfo[]>();
			for (const task of tasks) {
				const q = categorizeTask(task);
				if (q) {
					if (!quadrants.has(q)) quadrants.set(q, []);
					quadrants.get(q)!.push(task);
				}
			}

			// All four quadrants should be represented
			expect(quadrants.get('do')).toHaveLength(2);
			expect(quadrants.get('schedule')).toHaveLength(2);
			expect(quadrants.get('delegate')).toHaveLength(1);
			expect(quadrants.get('delete')).toHaveLength(1);
		});

		it.skip('reproduces issue #614 - tasks missing one axis property should not appear in any quadrant', () => {
			const taskMissingUrgency: TaskInfo = {
				title: 'Only importance set',
				status: ' ',
				priority: '',
				path: 'tasks/partial.md',
				archived: false,
				customProperties: { importance: 'high' },
			};

			const taskMissingImportance: TaskInfo = {
				title: 'Only urgency set',
				status: ' ',
				priority: '',
				path: 'tasks/partial2.md',
				archived: false,
				customProperties: { urgency: 'low' },
			};

			expect(categorizeTask(taskMissingUrgency)).toBeNull();
			expect(categorizeTask(taskMissingImportance)).toBeNull();
		});
	});

	describe('formula-based derivation', () => {
		it.skip('reproduces issue #614 - existing urgencyScore formula only provides single axis, not two', () => {
			// The existing urgencyScore formula in defaultBasesFiles.ts:
			//   if(!due && !scheduled, formula.priorityWeight,
			//     formula.priorityWeight + max(0, 10 - formula.daysUntilNext))
			//
			// This combines priority (importance) and date proximity (urgency)
			// into a single score. The Eisenhower Matrix requires TWO separate
			// axes. An implementation could:
			//   1. Use priority as "importance" axis
			//   2. Derive "urgency" from date proximity (daysUntilNext)
			//   3. Or let users explicitly set both via custom fields
			//
			// This test documents that the current formula system does not
			// natively provide the two-axis separation needed.
			const urgencyScoreFormula = 'if(!due && !scheduled, formula.priorityWeight, formula.priorityWeight + max(0, 10 - formula.daysUntilNext))';

			// The formula produces a single number, not two separate axes
			expect(urgencyScoreFormula).toContain('priorityWeight');
			expect(urgencyScoreFormula).toContain('daysUntilNext');

			// For Eisenhower Matrix, we'd need separate formulas like:
			// importance: if(priority == "high" || priority == "urgent", "high", "low")
			// urgency: if(formula.daysUntilNext <= 3 && formula.daysUntilNext >= 0, "high", "low")
		});
	});
});
