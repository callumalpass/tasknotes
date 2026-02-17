/**
 * Tests for TaskStatsService.getStats() method
 *
 * This method is used by both HTTP API and MCP Service
 * to provide task statistics.
 */

import { TaskStatsService } from '../../../src/services/TaskStatsService';
import { StatusManager } from '../../../src/services/StatusManager';
import { TaskInfo, StatusConfig } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';

describe('TaskStatsService.getStats', () => {
	let statsService: TaskStatsService;
	let statusManager: StatusManager;

	const defaultStatuses: StatusConfig[] = [
		{ id: 'open', value: 'open', label: 'Open', color: '#888', isCompleted: false, order: 0, autoArchive: false, autoArchiveDelay: 0 },
		{ id: 'in-progress', value: 'in-progress', label: 'In Progress', color: '#3b82f6', isCompleted: false, order: 1, autoArchive: false, autoArchiveDelay: 0 },
		{ id: 'done', value: 'done', label: 'Done', color: '#22c55e', isCompleted: true, order: 2, autoArchive: false, autoArchiveDelay: 0 },
		{ id: 'cancelled', value: 'cancelled', label: 'Cancelled', color: '#ef4444', isCompleted: true, order: 3, autoArchive: false, autoArchiveDelay: 0 },
	];

	beforeEach(() => {
		statusManager = new StatusManager(defaultStatuses, 'open');
		// We pass null for cache since getStats() doesn't use it
		statsService = new TaskStatsService(null as any, statusManager);
	});

	it('should return zero stats for empty task list', () => {
		const stats = statsService.getStats([]);

		expect(stats.total).toBe(0);
		expect(stats.completed).toBe(0);
		expect(stats.active).toBe(0);
		expect(stats.overdue).toBe(0);
		expect(stats.archived).toBe(0);
		expect(stats.withTimeEntries).toBe(0);
		expect(stats.totalTrackedMinutes).toBe(0);
		expect(stats.totalTrackedHours).toBe(0);
	});

	it('should count total tasks', () => {
		const tasks = TaskFactory.createTasks(5);
		const stats = statsService.getStats(tasks);

		expect(stats.total).toBe(5);
	});

	it('should count tasks by status', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({ status: 'open' }),
			TaskFactory.createTask({ status: 'open' }),
			TaskFactory.createTask({ status: 'in-progress' }),
			TaskFactory.createTask({ status: 'done' }),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.statusCounts['open']).toBe(2);
		expect(stats.statusCounts['in-progress']).toBe(1);
		expect(stats.statusCounts['done']).toBe(1);
	});

	it('should count tasks by priority', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({ priority: 'low' }),
			TaskFactory.createTask({ priority: 'normal' }),
			TaskFactory.createTask({ priority: 'normal' }),
			TaskFactory.createTask({ priority: 'high' }),
			TaskFactory.createTask({ priority: 'urgent' }),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.priorityCounts['low']).toBe(1);
		expect(stats.priorityCounts['normal']).toBe(2);
		expect(stats.priorityCounts['high']).toBe(1);
		expect(stats.priorityCounts['urgent']).toBe(1);
	});

	it('should count completed tasks using StatusManager', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({ status: 'done' }),
			TaskFactory.createTask({ status: 'cancelled' }),
			TaskFactory.createTask({ status: 'open' }),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.completed).toBe(2); // done + cancelled
	});

	it('should count active tasks (not completed and not archived)', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({ status: 'open', archived: false }),
			TaskFactory.createTask({ status: 'in-progress', archived: false }),
			TaskFactory.createTask({ status: 'done', archived: false }),
			TaskFactory.createTask({ status: 'open', archived: true }),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.active).toBe(2); // open + in-progress (not archived)
	});

	it('should count archived tasks', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({ archived: true }),
			TaskFactory.createTask({ archived: true }),
			TaskFactory.createTask({ archived: false }),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.archived).toBe(2);
	});

	it('should count overdue tasks', () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().split('T')[0];

		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = tomorrow.toISOString().split('T')[0];

		const tasks: TaskInfo[] = [
			TaskFactory.createTask({ due: yesterdayStr, status: 'open', archived: false }),
			TaskFactory.createTask({ due: yesterdayStr, status: 'done', archived: false }), // completed, not overdue
			TaskFactory.createTask({ due: yesterdayStr, status: 'open', archived: true }), // archived, not overdue
			TaskFactory.createTask({ due: tomorrowStr, status: 'open', archived: false }), // future, not overdue
		];

		const stats = statsService.getStats(tasks);

		expect(stats.overdue).toBe(1);
	});

	it('should count tasks with time entries', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({
				timeEntries: [
					{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z', duration: 30 },
				],
			}),
			TaskFactory.createTask({
				timeEntries: [],
			}),
			TaskFactory.createTask({
				// no timeEntries property
			}),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.withTimeEntries).toBe(1);
	});

	it('should sum total tracked time from totalTrackedTime property', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({
				timeEntries: [{ startTime: '2025-01-01T10:00:00Z' }],
				totalTrackedTime: 60,
			}),
			TaskFactory.createTask({
				timeEntries: [{ startTime: '2025-01-01T11:00:00Z' }],
				totalTrackedTime: 30,
			}),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.totalTrackedMinutes).toBe(90);
		expect(stats.totalTrackedHours).toBe(1.5);
	});

	it('should handle tasks without totalTrackedTime property', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({
				timeEntries: [{ startTime: '2025-01-01T10:00:00Z' }],
				// no totalTrackedTime
			}),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.withTimeEntries).toBe(1);
		expect(stats.totalTrackedMinutes).toBe(0);
	});

	it('should round totalTrackedHours to 2 decimal places', () => {
		const tasks: TaskInfo[] = [
			TaskFactory.createTask({
				timeEntries: [{ startTime: '2025-01-01T10:00:00Z' }],
				totalTrackedTime: 100, // 100 minutes = 1.666... hours
			}),
		];

		const stats = statsService.getStats(tasks);

		expect(stats.totalTrackedHours).toBe(1.67);
	});
});
