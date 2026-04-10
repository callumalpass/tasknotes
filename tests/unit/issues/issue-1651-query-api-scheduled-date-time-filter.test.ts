/**
 * Reproduction tests for issue #1651.
 *
 * Reported behavior:
 * - Query condition `scheduled is 2026-02-27` should match tasks with
 *   `scheduled: 2026-02-27T09:00`, but returns no results.
 * - Query condition using `is_not_empty` also returns zero results in the
 *   reported API payload.
 */

import { FilterService } from '../../../src/services/FilterService';
import { TaskManager } from '../../../src/utils/TaskManager';
import { StatusManager } from '../../../src/services/StatusManager';
import { PriorityManager } from '../../../src/services/PriorityManager';
import { FieldMapper } from '../../../src/services/FieldMapper';
import {
	DEFAULT_FIELD_MAPPING,
	DEFAULT_PRIORITIES,
	DEFAULT_SETTINGS,
	DEFAULT_STATUSES,
} from '../../../src/settings/defaults';
import { FilterQuery, TaskInfo } from '../../../src/types';
import { MockObsidian } from '../../__mocks__/obsidian';

function makeFilterService() {
	const app = MockObsidian.createMockApp();
	const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
	const settings = {
		...DEFAULT_SETTINGS,
		taskIdentificationMethod: 'property',
		taskPropertyName: 'isTask',
		taskPropertyValue: 'true',
	} as any;

	const cache = new TaskManager(app as any, settings, mapper);
	cache.initialize();

	const statusManager = new StatusManager(DEFAULT_STATUSES);
	const priorityManager = new PriorityManager(DEFAULT_PRIORITIES);
	const plugin = { settings: { ...DEFAULT_SETTINGS, userFields: [] } } as any;

	return {
		app,
		filterService: new FilterService(cache, statusManager, priorityManager, plugin),
	};
}

async function createTaskWithTimedScheduledDate(app: any, path: string): Promise<void> {
	await app.vault.create(
		path,
		'---\n' +
			'isTask: true\n' +
			'title: Timed scheduled task\n' +
			'status: open\n' +
			'priority: normal\n' +
			'scheduled: 2026-02-27T09:00\n' +
			'---\n'
	);

	// Keep explicit string values in metadata for deterministic comparisons.
	app.metadataCache.setCache(path, {
		frontmatter: {
			isTask: true,
			title: 'Timed scheduled task',
			status: 'open',
			priority: 'normal',
			scheduled: '2026-02-27T09:00',
		},
	});
}

async function createTaskWithTimedDueDate(app: any, path: string): Promise<void> {
	await app.vault.create(
		path,
		'---\n' +
			'isTask: true\n' +
			'title: Timed due task\n' +
			'status: open\n' +
			'priority: normal\n' +
			'due: 2026-02-27T17:30\n' +
			'---\n'
	);

	app.metadataCache.setCache(path, {
		frontmatter: {
			isTask: true,
			title: 'Timed due task',
			status: 'open',
			priority: 'normal',
			due: '2026-02-27T17:30',
		},
	});
}

function flattenGroups(grouped: Map<string, TaskInfo[]>): TaskInfo[] {
	return Array.from(grouped.values()).flat();
}

describe('Issue #1651: Query API scheduled date matching with time components', () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it('matches `scheduled is YYYY-MM-DD` against `scheduled: YYYY-MM-DDTHH:mm`', async () => {
		const { app, filterService } = makeFilterService();
		const taskPath = 'Tasks/issue-1651-timed-scheduled.md';
		await createTaskWithTimedScheduledDate(app, taskPath);

		const query: FilterQuery = {
			type: 'group',
			id: 'root',
			conjunction: 'and',
			children: [
				{
					type: 'condition',
					id: 'c1',
					property: 'scheduled',
					operator: 'is',
					value: '2026-02-27',
				},
			],
			sortKey: 'due',
			sortDirection: 'asc',
			groupKey: 'none',
		};

		const grouped = await filterService.getGroupedTasks(query);
		const matchedTasks = flattenGroups(grouped);

		expect(matchedTasks.map((task) => task.path)).toContain(taskPath);
	});

	it('matches `due is YYYY-MM-DD` against `due: YYYY-MM-DDTHH:mm`', async () => {
		const { app, filterService } = makeFilterService();
		const taskPath = 'Tasks/issue-1651-timed-due.md';
		await createTaskWithTimedDueDate(app, taskPath);

		const query: FilterQuery = {
			type: 'group',
			id: 'root',
			conjunction: 'and',
			children: [
				{
					type: 'condition',
					id: 'c1',
					property: 'due',
					operator: 'is',
					value: '2026-02-27',
				},
			],
			sortKey: 'due',
			sortDirection: 'asc',
			groupKey: 'none',
		};

		const grouped = await filterService.getGroupedTasks(query);
		const matchedTasks = flattenGroups(grouped);

		expect(matchedTasks.map((task) => task.path)).toContain(taskPath);
	});

	it.skip('reproduces issue #1651 - API payload using `is_not_empty` should return tasks with scheduled values', async () => {
		const { app, filterService } = makeFilterService();
		const taskPath = 'Tasks/issue-1651-is-not-empty.md';
		await createTaskWithTimedScheduledDate(app, taskPath);

		const query = {
			type: 'group',
			id: 'root',
			conjunction: 'and',
			children: [
				{
					type: 'condition',
					id: 'c1',
					property: 'scheduled',
					operator: 'is_not_empty',
					value: null,
				},
			],
			sortKey: 'due',
			sortDirection: 'asc',
			groupKey: 'none',
		} as any;

		const grouped = await filterService.getGroupedTasks(query);
		const matchedTasks = flattenGroups(grouped);

		expect(matchedTasks.map((task) => task.path)).toContain(taskPath);
	});
});
