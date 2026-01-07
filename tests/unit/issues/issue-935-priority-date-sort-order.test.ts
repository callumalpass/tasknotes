/**
 * Issue #935: [Bug]: Sort Order for Priorities, Due and Scheduled
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/935
 *
 * Bug Description:
 * 1. When Sort is set to "Priority" with "Descending" order, the lowest weighted
 *    priority lands on top instead of the highest priority (expected: highest on top).
 *
 * 2. When tasks have the same priority, scheduled dates are ranked higher than due dates
 *    in fallback sorting. So even if Task 1 is due earlier than Task 2, if Task 2 is
 *    scheduled earlier than Task 1 is scheduled, Task 2 will show up on top of Task 1.
 *    Expected: Due dates should take precedence over scheduled dates in fallback sorting.
 *
 * Environment: TaskNotes 3.25.3, Obsidian 1.9.14
 */

import { FilterService } from '../../../src/services/FilterService';
import { TaskManager } from '../../../src/utils/TaskManager';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { MockObsidian, App } from '../../__mocks__/obsidian';
import { DEFAULT_SETTINGS, DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import { FieldMapper } from '../../../src/services/FieldMapper';
import { PriorityConfig } from '../../../src/types';

function makeApp(): App {
	return MockObsidian.createMockApp();
}

function makeCache(app: App) {
	const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
	const settings = {
		...DEFAULT_SETTINGS,
		taskIdentificationMethod: 'property',
		taskPropertyName: 'isTask',
		taskPropertyValue: 'true',
	} as any;
	const cache = new TaskManager(app as any, settings, mapper);
	cache.initialize();
	return cache;
}

function makeFilterService(cache: TaskManager, plugin: any, priorities: PriorityConfig[]) {
	const status = new StatusManager([]);
	const priority = new PriorityManager(priorities);
	return new FilterService(cache, status, priority, plugin);
}

function createTaskFile(app: App, path: string, frontmatter: Record<string, any>) {
	const yamlLines = Object.entries(frontmatter).map(([k, v]) => {
		if (Array.isArray(v)) {
			return `${k}: [${v.map((x) => (typeof x === 'string' ? `'${x.replace(/'/g, "''")}'` : x)).join(', ')}]`;
		}
		return `${k}: ${v}`;
	});
	const content = `---\n${yamlLines.join('\n')}\n---\n`;
	return (app.vault as any).create(path, content);
}

describe.skip('Issue #935: Sort Order for Priorities, Due and Scheduled', () => {
	const priorities: PriorityConfig[] = [
		{ id: 'critical', value: 'critical', label: 'Critical', color: '#ff0000', weight: 4 },
		{ id: 'high', value: 'high', label: 'High', color: '#ff6600', weight: 3 },
		{ id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 },
		{ id: 'low', value: 'low', label: 'Low', color: '#00aa00', weight: 1 },
	];

	beforeEach(() => {
		MockObsidian.reset();
	});

	describe('Bug 1: Priority descending sort order is inverted', () => {
		it('should sort highest priority (highest weight) first when sort order is Descending', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			// Create tasks with different priorities
			await createTaskFile(app, 'Tasks/task-low.md', {
				isTask: true,
				title: 'Low Priority Task',
				priority: 'low',
			});
			await createTaskFile(app, 'Tasks/task-high.md', {
				isTask: true,
				title: 'High Priority Task',
				priority: 'high',
			});
			await createTaskFile(app, 'Tasks/task-critical.md', {
				isTask: true,
				title: 'Critical Priority Task',
				priority: 'critical',
			});
			await createTaskFile(app, 'Tasks/task-normal.md', {
				isTask: true,
				title: 'Normal Priority Task',
				priority: 'normal',
			});

			app.metadataCache.setCache('Tasks/task-low.md', {
				frontmatter: { isTask: true, title: 'Low Priority Task', priority: 'low' },
			});
			app.metadataCache.setCache('Tasks/task-high.md', {
				frontmatter: { isTask: true, title: 'High Priority Task', priority: 'high' },
			});
			app.metadataCache.setCache('Tasks/task-critical.md', {
				frontmatter: { isTask: true, title: 'Critical Priority Task', priority: 'critical' },
			});
			app.metadataCache.setCache('Tasks/task-normal.md', {
				frontmatter: { isTask: true, title: 'Normal Priority Task', priority: 'normal' },
			});

			// Sort by priority DESCENDING - user expects highest priority at top
			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'priority';
			(query as any).sortDirection = 'desc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedPriorities = all.map((t) => t.priority);

			// Expected: Descending should show highest priority (critical) first
			// Bug: Currently shows lowest priority (low) first
			expect(sortedPriorities).toEqual(['critical', 'high', 'normal', 'low']);
		});

		it('should sort lowest priority (lowest weight) first when sort order is Ascending', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			await createTaskFile(app, 'Tasks/task-low.md', {
				isTask: true,
				title: 'Low Priority Task',
				priority: 'low',
			});
			await createTaskFile(app, 'Tasks/task-high.md', {
				isTask: true,
				title: 'High Priority Task',
				priority: 'high',
			});
			await createTaskFile(app, 'Tasks/task-critical.md', {
				isTask: true,
				title: 'Critical Priority Task',
				priority: 'critical',
			});

			app.metadataCache.setCache('Tasks/task-low.md', {
				frontmatter: { isTask: true, title: 'Low Priority Task', priority: 'low' },
			});
			app.metadataCache.setCache('Tasks/task-high.md', {
				frontmatter: { isTask: true, title: 'High Priority Task', priority: 'high' },
			});
			app.metadataCache.setCache('Tasks/task-critical.md', {
				frontmatter: { isTask: true, title: 'Critical Priority Task', priority: 'critical' },
			});

			// Sort by priority ASCENDING - should show lowest priority first
			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'priority';
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedPriorities = all.map((t) => t.priority);

			// Note: Current behavior shows highest priority first in ascending mode
			// which is inverted from what users expect
			// After bug fix, ascending should mean low → high
			expect(sortedPriorities).toEqual(['low', 'normal', 'high', 'critical']);
		});
	});

	describe('Bug 2: Scheduled dates ranked higher than due dates in fallback sorting', () => {
		it('should sort by due date before scheduled date when tasks have same priority', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			// Task 1: Due earlier (Jan 5), scheduled later (Jan 20)
			// Task 2: Due later (Jan 10), scheduled earlier (Jan 1)
			// Both have same priority
			// Expected: Task 1 should appear first because it's due earlier
			// Bug: Task 2 appears first because it's scheduled earlier

			await createTaskFile(app, 'Tasks/task-due-earlier.md', {
				isTask: true,
				title: 'Task Due Earlier',
				priority: 'normal',
				due: '2025-01-05',
				scheduled: '2025-01-20',
			});
			await createTaskFile(app, 'Tasks/task-scheduled-earlier.md', {
				isTask: true,
				title: 'Task Scheduled Earlier',
				priority: 'normal',
				due: '2025-01-10',
				scheduled: '2025-01-01',
			});

			app.metadataCache.setCache('Tasks/task-due-earlier.md', {
				frontmatter: {
					isTask: true,
					title: 'Task Due Earlier',
					priority: 'normal',
					due: '2025-01-05',
					scheduled: '2025-01-20',
				},
			});
			app.metadataCache.setCache('Tasks/task-scheduled-earlier.md', {
				frontmatter: {
					isTask: true,
					title: 'Task Scheduled Earlier',
					priority: 'normal',
					due: '2025-01-10',
					scheduled: '2025-01-01',
				},
			});

			// Sort by priority ascending (both have same priority, so fallback kicks in)
			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'priority';
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedTitles = all.map((t) => t.title);

			// Expected: Task with earlier due date should come first
			// Bug: Task with earlier scheduled date comes first
			expect(sortedTitles).toEqual(['Task Due Earlier', 'Task Scheduled Earlier']);
		});

		it('should respect due date over scheduled date in fallback when sorting by title', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			// Two tasks with same title (alphabetically), different due and scheduled dates
			await createTaskFile(app, 'Tasks/task-a1.md', {
				isTask: true,
				title: 'Alpha Task',
				priority: 'high',
				due: '2025-01-02',
				scheduled: '2025-01-15',
			});
			await createTaskFile(app, 'Tasks/task-a2.md', {
				isTask: true,
				title: 'Alpha Task',
				priority: 'high',
				due: '2025-01-10',
				scheduled: '2025-01-01',
			});

			app.metadataCache.setCache('Tasks/task-a1.md', {
				frontmatter: {
					isTask: true,
					title: 'Alpha Task',
					priority: 'high',
					due: '2025-01-02',
					scheduled: '2025-01-15',
				},
			});
			app.metadataCache.setCache('Tasks/task-a2.md', {
				frontmatter: {
					isTask: true,
					title: 'Alpha Task',
					priority: 'high',
					due: '2025-01-10',
					scheduled: '2025-01-01',
				},
			});

			// Sort by priority - both tasks have same priority, then fallback to dates
			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'priority';
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedPaths = all.map((t) => t.path);

			// Expected: Task with earlier due date (task-a1.md) should come first
			// Bug: Task with earlier scheduled date (task-a2.md) comes first
			expect(sortedPaths).toEqual(['Tasks/task-a1.md', 'Tasks/task-a2.md']);
		});

		it('should use due date fallback for tasks with equal scheduled dates', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			// Tasks with same scheduled date but different due dates
			await createTaskFile(app, 'Tasks/task-due-jan5.md', {
				isTask: true,
				title: 'Task A',
				priority: 'normal',
				due: '2025-01-05',
				scheduled: '2025-01-01',
			});
			await createTaskFile(app, 'Tasks/task-due-jan10.md', {
				isTask: true,
				title: 'Task B',
				priority: 'normal',
				due: '2025-01-10',
				scheduled: '2025-01-01',
			});

			app.metadataCache.setCache('Tasks/task-due-jan5.md', {
				frontmatter: {
					isTask: true,
					title: 'Task A',
					priority: 'normal',
					due: '2025-01-05',
					scheduled: '2025-01-01',
				},
			});
			app.metadataCache.setCache('Tasks/task-due-jan10.md', {
				frontmatter: {
					isTask: true,
					title: 'Task B',
					priority: 'normal',
					due: '2025-01-10',
					scheduled: '2025-01-01',
				},
			});

			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'priority';
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedPaths = all.map((t) => t.path);

			// When scheduled dates are equal, should fall back to due date
			expect(sortedPaths).toEqual(['Tasks/task-due-jan5.md', 'Tasks/task-due-jan10.md']);
		});
	});

	describe('Combined scenarios: Priority sorting with date fallbacks', () => {
		it('should handle priority descending with proper date fallbacks', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			// High priority task, due later
			await createTaskFile(app, 'Tasks/task-high-later.md', {
				isTask: true,
				title: 'High Later',
				priority: 'high',
				due: '2025-01-20',
			});
			// High priority task, due earlier
			await createTaskFile(app, 'Tasks/task-high-earlier.md', {
				isTask: true,
				title: 'High Earlier',
				priority: 'high',
				due: '2025-01-05',
			});
			// Critical priority task
			await createTaskFile(app, 'Tasks/task-critical.md', {
				isTask: true,
				title: 'Critical',
				priority: 'critical',
				due: '2025-01-15',
			});
			// Low priority task
			await createTaskFile(app, 'Tasks/task-low.md', {
				isTask: true,
				title: 'Low',
				priority: 'low',
				due: '2025-01-01',
			});

			app.metadataCache.setCache('Tasks/task-high-later.md', {
				frontmatter: { isTask: true, title: 'High Later', priority: 'high', due: '2025-01-20' },
			});
			app.metadataCache.setCache('Tasks/task-high-earlier.md', {
				frontmatter: { isTask: true, title: 'High Earlier', priority: 'high', due: '2025-01-05' },
			});
			app.metadataCache.setCache('Tasks/task-critical.md', {
				frontmatter: { isTask: true, title: 'Critical', priority: 'critical', due: '2025-01-15' },
			});
			app.metadataCache.setCache('Tasks/task-low.md', {
				frontmatter: { isTask: true, title: 'Low', priority: 'low', due: '2025-01-01' },
			});

			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'priority';
			(query as any).sortDirection = 'desc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedTitles = all.map((t) => t.title);

			// Expected order (descending priority, then by due date for same priority):
			// 1. Critical (highest priority)
			// 2. High Earlier (high priority, due earlier)
			// 3. High Later (high priority, due later)
			// 4. Low (lowest priority)
			expect(sortedTitles).toEqual(['Critical', 'High Earlier', 'High Later', 'Low']);
		});
	});
});
