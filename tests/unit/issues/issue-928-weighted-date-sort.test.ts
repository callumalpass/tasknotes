/**
 * Issue #928: [FR]: Consider both Due date and Scheduled date together for order
 *
 * @see https://github.com/TaskNotesPlugin/tasknotes/issues/928
 *
 * Feature Request Description:
 * When sorting by either due or scheduled date, tasks that only have one date type
 * are not properly integrated into the sort order. This throws off subcategory
 * ordering (e.g., status grouping).
 *
 * Proposal: Add a "weighted sort" option that considers BOTH due and scheduled
 * dates together, similar to the Tasks plugin's approach. This would use a weight
 * system to determine task ordering based on both date fields.
 *
 * Expected behavior:
 * - A new sort option (e.g., "nextDate" or "weighted") that considers both dates
 * - Tasks should be sorted by whichever date is earliest (due or scheduled)
 * - Tasks with only one date type should still sort correctly relative to others
 * - The weighted approach should produce intuitive, real-world ordering
 *
 * Environment: TaskNotes 3.25.3+
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

describe.skip('Issue #928: Consider both Due date and Scheduled date together for order', () => {
	const priorities: PriorityConfig[] = [
		{ id: 'high', value: 'high', label: 'High', color: '#ff6600', weight: 3 },
		{ id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 },
		{ id: 'low', value: 'low', label: 'Low', color: '#00aa00', weight: 1 },
	];

	beforeEach(() => {
		MockObsidian.reset();
	});

	describe('Weighted/Combined date sorting', () => {
		it('should sort tasks by earliest date (due or scheduled) when using weighted sort', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			// Task 1: Due Jan 15, no scheduled date
			// Task 2: Scheduled Jan 5, no due date
			// Task 3: Due Jan 10, scheduled Jan 20
			// Expected order with weighted sort: Task 2 (Jan 5), Task 3 (Jan 10), Task 1 (Jan 15)

			await createTaskFile(app, 'Tasks/task-due-only.md', {
				isTask: true,
				title: 'Task with Due Only',
				priority: 'normal',
				due: '2025-01-15',
			});
			await createTaskFile(app, 'Tasks/task-scheduled-only.md', {
				isTask: true,
				title: 'Task with Scheduled Only',
				priority: 'normal',
				scheduled: '2025-01-05',
			});
			await createTaskFile(app, 'Tasks/task-both-dates.md', {
				isTask: true,
				title: 'Task with Both Dates',
				priority: 'normal',
				due: '2025-01-10',
				scheduled: '2025-01-20',
			});

			app.metadataCache.setCache('Tasks/task-due-only.md', {
				frontmatter: { isTask: true, title: 'Task with Due Only', priority: 'normal', due: '2025-01-15' },
			});
			app.metadataCache.setCache('Tasks/task-scheduled-only.md', {
				frontmatter: {
					isTask: true,
					title: 'Task with Scheduled Only',
					priority: 'normal',
					scheduled: '2025-01-05',
				},
			});
			app.metadataCache.setCache('Tasks/task-both-dates.md', {
				frontmatter: {
					isTask: true,
					title: 'Task with Both Dates',
					priority: 'normal',
					due: '2025-01-10',
					scheduled: '2025-01-20',
				},
			});

			// Use a weighted/combined date sort (feature to be implemented)
			// This would be a new sort key like "nextDate" or "weightedDate"
			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			// Note: "nextDate" or "weightedDate" would be the new sort key to implement
			(query as any).sortKey = 'nextDate'; // Proposed new sort key
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedTitles = all.map((t) => t.title);

			// Expected: Sort by whichever date is earliest (due or scheduled)
			// Jan 5 (scheduled) < Jan 10 (due) < Jan 15 (due)
			expect(sortedTitles).toEqual([
				'Task with Scheduled Only', // Jan 5
				'Task with Both Dates', // Jan 10
				'Task with Due Only', // Jan 15
			]);
		});

		it('should handle tasks with both dates by using the earliest of due/scheduled', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			// Task 1: Due Jan 15, Scheduled Jan 5 → earliest is Jan 5
			// Task 2: Due Jan 8, Scheduled Jan 20 → earliest is Jan 8
			// Task 3: Due Jan 12, Scheduled Jan 10 → earliest is Jan 10
			// Expected order: Task 1 (Jan 5), Task 2 (Jan 8), Task 3 (Jan 10)

			await createTaskFile(app, 'Tasks/task-1.md', {
				isTask: true,
				title: 'Task 1',
				priority: 'normal',
				due: '2025-01-15',
				scheduled: '2025-01-05',
			});
			await createTaskFile(app, 'Tasks/task-2.md', {
				isTask: true,
				title: 'Task 2',
				priority: 'normal',
				due: '2025-01-08',
				scheduled: '2025-01-20',
			});
			await createTaskFile(app, 'Tasks/task-3.md', {
				isTask: true,
				title: 'Task 3',
				priority: 'normal',
				due: '2025-01-12',
				scheduled: '2025-01-10',
			});

			app.metadataCache.setCache('Tasks/task-1.md', {
				frontmatter: {
					isTask: true,
					title: 'Task 1',
					priority: 'normal',
					due: '2025-01-15',
					scheduled: '2025-01-05',
				},
			});
			app.metadataCache.setCache('Tasks/task-2.md', {
				frontmatter: {
					isTask: true,
					title: 'Task 2',
					priority: 'normal',
					due: '2025-01-08',
					scheduled: '2025-01-20',
				},
			});
			app.metadataCache.setCache('Tasks/task-3.md', {
				frontmatter: {
					isTask: true,
					title: 'Task 3',
					priority: 'normal',
					due: '2025-01-12',
					scheduled: '2025-01-10',
				},
			});

			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'nextDate'; // Proposed new sort key
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedTitles = all.map((t) => t.title);

			// Expected: Sort by earliest date between due and scheduled
			expect(sortedTitles).toEqual(['Task 1', 'Task 2', 'Task 3']);
		});

		it('should sort tasks with no dates last when using weighted date sort', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			await createTaskFile(app, 'Tasks/task-no-dates.md', {
				isTask: true,
				title: 'Task with No Dates',
				priority: 'normal',
			});
			await createTaskFile(app, 'Tasks/task-with-due.md', {
				isTask: true,
				title: 'Task with Due',
				priority: 'normal',
				due: '2025-01-15',
			});
			await createTaskFile(app, 'Tasks/task-with-scheduled.md', {
				isTask: true,
				title: 'Task with Scheduled',
				priority: 'normal',
				scheduled: '2025-01-10',
			});

			app.metadataCache.setCache('Tasks/task-no-dates.md', {
				frontmatter: { isTask: true, title: 'Task with No Dates', priority: 'normal' },
			});
			app.metadataCache.setCache('Tasks/task-with-due.md', {
				frontmatter: { isTask: true, title: 'Task with Due', priority: 'normal', due: '2025-01-15' },
			});
			app.metadataCache.setCache('Tasks/task-with-scheduled.md', {
				frontmatter: {
					isTask: true,
					title: 'Task with Scheduled',
					priority: 'normal',
					scheduled: '2025-01-10',
				},
			});

			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'nextDate';
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedTitles = all.map((t) => t.title);

			// Tasks with no dates should sort last
			expect(sortedTitles).toEqual([
				'Task with Scheduled', // Jan 10
				'Task with Due', // Jan 15
				'Task with No Dates', // No date, sorts last
			]);
		});
	});

	describe('Weighted sort with status grouping (subcategory ordering)', () => {
		it('should maintain correct order within status groups when using weighted date sort', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			// This test addresses the core complaint: tasks with only one date type
			// should still sort correctly when using subcategory ordering (e.g., by status)

			await createTaskFile(app, 'Tasks/todo-due-only.md', {
				isTask: true,
				title: 'Todo Due Only',
				status: 'todo',
				due: '2025-01-20',
			});
			await createTaskFile(app, 'Tasks/todo-scheduled-only.md', {
				isTask: true,
				title: 'Todo Scheduled Only',
				status: 'todo',
				scheduled: '2025-01-10',
			});
			await createTaskFile(app, 'Tasks/inprogress-both.md', {
				isTask: true,
				title: 'In Progress Both',
				status: 'in-progress',
				due: '2025-01-15',
				scheduled: '2025-01-05',
			});
			await createTaskFile(app, 'Tasks/inprogress-due-only.md', {
				isTask: true,
				title: 'In Progress Due Only',
				status: 'in-progress',
				due: '2025-01-08',
			});

			app.metadataCache.setCache('Tasks/todo-due-only.md', {
				frontmatter: { isTask: true, title: 'Todo Due Only', status: 'todo', due: '2025-01-20' },
			});
			app.metadataCache.setCache('Tasks/todo-scheduled-only.md', {
				frontmatter: { isTask: true, title: 'Todo Scheduled Only', status: 'todo', scheduled: '2025-01-10' },
			});
			app.metadataCache.setCache('Tasks/inprogress-both.md', {
				frontmatter: {
					isTask: true,
					title: 'In Progress Both',
					status: 'in-progress',
					due: '2025-01-15',
					scheduled: '2025-01-05',
				},
			});
			app.metadataCache.setCache('Tasks/inprogress-due-only.md', {
				frontmatter: { isTask: true, title: 'In Progress Due Only', status: 'in-progress', due: '2025-01-08' },
			});

			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'status';
			(query as any).sortKey = 'nextDate';
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);

			// Within each status group, tasks should be ordered by weighted date
			const todoGroup = groups.get('todo');
			const inProgressGroup = groups.get('in-progress');

			// Todo group: Scheduled Jan 10 should come before Due Jan 20
			expect(todoGroup?.map((t) => t.title)).toEqual(['Todo Scheduled Only', 'Todo Due Only']);

			// In Progress group: Scheduled Jan 5 should come before Due Jan 8
			expect(inProgressGroup?.map((t) => t.title)).toEqual(['In Progress Both', 'In Progress Due Only']);
		});
	});

	describe('Descending weighted sort order', () => {
		it('should sort by latest date when descending', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			await createTaskFile(app, 'Tasks/task-early.md', {
				isTask: true,
				title: 'Early Task',
				priority: 'normal',
				due: '2025-01-05',
			});
			await createTaskFile(app, 'Tasks/task-mid.md', {
				isTask: true,
				title: 'Mid Task',
				priority: 'normal',
				scheduled: '2025-01-15',
			});
			await createTaskFile(app, 'Tasks/task-late.md', {
				isTask: true,
				title: 'Late Task',
				priority: 'normal',
				due: '2025-01-25',
			});

			app.metadataCache.setCache('Tasks/task-early.md', {
				frontmatter: { isTask: true, title: 'Early Task', priority: 'normal', due: '2025-01-05' },
			});
			app.metadataCache.setCache('Tasks/task-mid.md', {
				frontmatter: { isTask: true, title: 'Mid Task', priority: 'normal', scheduled: '2025-01-15' },
			});
			app.metadataCache.setCache('Tasks/task-late.md', {
				frontmatter: { isTask: true, title: 'Late Task', priority: 'normal', due: '2025-01-25' },
			});

			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'nextDate';
			(query as any).sortDirection = 'desc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedTitles = all.map((t) => t.title);

			// Descending: Latest dates first
			expect(sortedTitles).toEqual(['Late Task', 'Mid Task', 'Early Task']);
		});
	});

	describe('Edge cases for weighted date sorting', () => {
		it('should handle same date in both due and scheduled', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			await createTaskFile(app, 'Tasks/task-same-date.md', {
				isTask: true,
				title: 'Same Date Task',
				priority: 'normal',
				due: '2025-01-10',
				scheduled: '2025-01-10',
			});
			await createTaskFile(app, 'Tasks/task-different.md', {
				isTask: true,
				title: 'Different Task',
				priority: 'normal',
				due: '2025-01-08',
			});

			app.metadataCache.setCache('Tasks/task-same-date.md', {
				frontmatter: {
					isTask: true,
					title: 'Same Date Task',
					priority: 'normal',
					due: '2025-01-10',
					scheduled: '2025-01-10',
				},
			});
			app.metadataCache.setCache('Tasks/task-different.md', {
				frontmatter: { isTask: true, title: 'Different Task', priority: 'normal', due: '2025-01-08' },
			});

			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'nextDate';
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedTitles = all.map((t) => t.title);

			expect(sortedTitles).toEqual(['Different Task', 'Same Date Task']);
		});

		it('should handle datetime values with times', async () => {
			const app = makeApp();
			const cache = makeCache(app);
			const plugin = { settings: { ...DEFAULT_SETTINGS } };
			const fs = makeFilterService(cache, plugin, priorities);

			await createTaskFile(app, 'Tasks/task-morning.md', {
				isTask: true,
				title: 'Morning Task',
				priority: 'normal',
				scheduled: '2025-01-10T09:00',
			});
			await createTaskFile(app, 'Tasks/task-afternoon.md', {
				isTask: true,
				title: 'Afternoon Task',
				priority: 'normal',
				due: '2025-01-10T14:00',
			});
			await createTaskFile(app, 'Tasks/task-evening.md', {
				isTask: true,
				title: 'Evening Task',
				priority: 'normal',
				due: '2025-01-10T18:00',
			});

			app.metadataCache.setCache('Tasks/task-morning.md', {
				frontmatter: {
					isTask: true,
					title: 'Morning Task',
					priority: 'normal',
					scheduled: '2025-01-10T09:00',
				},
			});
			app.metadataCache.setCache('Tasks/task-afternoon.md', {
				frontmatter: { isTask: true, title: 'Afternoon Task', priority: 'normal', due: '2025-01-10T14:00' },
			});
			app.metadataCache.setCache('Tasks/task-evening.md', {
				frontmatter: { isTask: true, title: 'Evening Task', priority: 'normal', due: '2025-01-10T18:00' },
			});

			const query = fs.createDefaultQuery();
			(query as any).groupKey = 'none';
			(query as any).sortKey = 'nextDate';
			(query as any).sortDirection = 'asc';

			const groups = await fs.getGroupedTasks(query);
			const all = groups.get('all')!;
			const sortedTitles = all.map((t) => t.title);

			// Should sort by time when dates are the same
			expect(sortedTitles).toEqual(['Morning Task', 'Afternoon Task', 'Evening Task']);
		});
	});
});
