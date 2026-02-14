/**
 * Tests for time tracking utility functions
 *
 * These utilities are shared between HTTP controllers and MCPService
 * to avoid code duplication.
 */

import { TaskInfo, TimeEntry } from '../../../src/types';
import { TaskFactory, TimeEntryFactory } from '../../helpers/mock-factories';
import {
	calculateTotalTimeSpent,
	computeActiveTimeSessions,
	computeTimeSummary,
	computeTaskTimeData,
} from '../../../src/utils/timeTrackingUtils';

describe('timeTrackingUtils', () => {
	describe('calculateTotalTimeSpent', () => {
		it('should return 0 for empty array', () => {
			expect(calculateTotalTimeSpent([])).toBe(0);
		});

		it('should return 0 for null/undefined', () => {
			expect(calculateTotalTimeSpent(null as any)).toBe(0);
			expect(calculateTotalTimeSpent(undefined as any)).toBe(0);
		});

		it('should calculate duration from entry.duration field', () => {
			const entries: TimeEntry[] = [
				{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z', duration: 30 },
				{ startTime: '2025-01-01T11:00:00Z', endTime: '2025-01-01T11:45:00Z', duration: 45 },
			];
			expect(calculateTotalTimeSpent(entries)).toBe(75);
		});

		it('should calculate duration from start/end times when duration is missing', () => {
			const entries: TimeEntry[] = [
				{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z' },
			];
			expect(calculateTotalTimeSpent(entries)).toBe(30);
		});

		it('should calculate elapsed time for active sessions (no endTime)', () => {
			const now = Date.now();
			const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000).toISOString();
			const entries: TimeEntry[] = [
				{ startTime: thirtyMinutesAgo },
			];
			// Allow 1 minute tolerance for test execution time
			const result = calculateTotalTimeSpent(entries);
			expect(result).toBeGreaterThanOrEqual(29);
			expect(result).toBeLessThanOrEqual(31);
		});

		it('should handle mixed entries', () => {
			const entries: TimeEntry[] = [
				{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z', duration: 30 },
				{ startTime: '2025-01-01T11:00:00Z', endTime: '2025-01-01T11:20:00Z' }, // 20 min
			];
			expect(calculateTotalTimeSpent(entries)).toBe(50);
		});
	});

	describe('computeActiveTimeSessions', () => {
		it('should return empty results when no active sessions', () => {
			const tasks: TaskInfo[] = [
				TaskFactory.createTask({ title: 'Task 1' }),
				TaskFactory.createTask({ title: 'Task 2' }),
			];

			const result = computeActiveTimeSessions(tasks, () => null);

			expect(result.activeSessions).toHaveLength(0);
			expect(result.totalActiveSessions).toBe(0);
			expect(result.totalElapsedMinutes).toBe(0);
		});

		it('should find active sessions', () => {
			const now = Date.now();
			const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();

			const activeEntry: TimeEntry = {
				startTime: tenMinutesAgo,
				description: 'Working on feature',
			};

			const tasks: TaskInfo[] = [
				TaskFactory.createTask({
					title: 'Active Task',
					path: '/tasks/active.md',
					status: 'in-progress',
					priority: 'high',
					tags: ['dev'],
					projects: ['project-a'],
				}),
			];

			const result = computeActiveTimeSessions(tasks, () => activeEntry);

			expect(result.totalActiveSessions).toBe(1);
			expect(result.activeSessions[0].task.title).toBe('Active Task');
			expect(result.activeSessions[0].task.id).toBe('/tasks/active.md');
			expect(result.activeSessions[0].session.description).toBe('Working on feature');
			expect(result.activeSessions[0].elapsedMinutes).toBeGreaterThanOrEqual(9);
			expect(result.activeSessions[0].elapsedMinutes).toBeLessThanOrEqual(11);
		});

		it('should sum elapsed minutes across multiple active sessions', () => {
			const now = Date.now();
			const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
			const twentyMinutesAgo = new Date(now - 20 * 60 * 1000).toISOString();

			const tasks: TaskInfo[] = [
				TaskFactory.createTask({ title: 'Task 1', path: '/tasks/1.md' }),
				TaskFactory.createTask({ title: 'Task 2', path: '/tasks/2.md' }),
			];

			const getActiveSession = (task: TaskInfo): TimeEntry | null => {
				if (task.path === '/tasks/1.md') {
					return { startTime: tenMinutesAgo };
				}
				if (task.path === '/tasks/2.md') {
					return { startTime: twentyMinutesAgo };
				}
				return null;
			};

			const result = computeActiveTimeSessions(tasks, getActiveSession);

			expect(result.totalActiveSessions).toBe(2);
			// ~10 + ~20 = ~30 minutes
			expect(result.totalElapsedMinutes).toBeGreaterThanOrEqual(28);
			expect(result.totalElapsedMinutes).toBeLessThanOrEqual(32);
		});
	});

	describe('computeTimeSummary', () => {
		const isCompleted = (status: string) => status === 'done';

		it('should handle tasks with no time entries', () => {
			const tasks: TaskInfo[] = [
				TaskFactory.createTask({ title: 'No Time' }),
			];

			const result = computeTimeSummary(
				tasks,
				{ period: 'all', fromDate: null, toDate: null },
				isCompleted
			);

			expect(result.summary.totalMinutes).toBe(0);
			expect(result.summary.tasksWithTime).toBe(0);
		});

		it('should calculate time summary for "all" period', () => {
			const tasks: TaskInfo[] = [
				TaskFactory.createTask({
					title: 'Task 1',
					path: '/tasks/1.md',
					status: 'done',
					timeEntries: [
						{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z', duration: 30 },
					],
				}),
				TaskFactory.createTask({
					title: 'Task 2',
					path: '/tasks/2.md',
					status: 'open',
					timeEntries: [
						{ startTime: '2025-01-01T11:00:00Z', endTime: '2025-01-01T11:45:00Z', duration: 45 },
					],
				}),
			];

			const result = computeTimeSummary(
				tasks,
				{ period: 'all', fromDate: null, toDate: null },
				isCompleted
			);

			expect(result.period).toBe('all');
			expect(result.summary.totalMinutes).toBe(75);
			expect(result.summary.totalHours).toBe(1.25);
			expect(result.summary.tasksWithTime).toBe(2);
			expect(result.summary.completedTasks).toBe(1);
		});

		it('should aggregate by projects', () => {
			const tasks: TaskInfo[] = [
				TaskFactory.createTask({
					title: 'Task 1',
					path: '/tasks/1.md',
					projects: ['project-a'],
					timeEntries: [
						{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z', duration: 30 },
					],
				}),
				TaskFactory.createTask({
					title: 'Task 2',
					path: '/tasks/2.md',
					projects: ['project-a', 'project-b'],
					timeEntries: [
						{ startTime: '2025-01-01T11:00:00Z', endTime: '2025-01-01T11:20:00Z', duration: 20 },
					],
				}),
			];

			const result = computeTimeSummary(
				tasks,
				{ period: 'all', fromDate: null, toDate: null },
				isCompleted
			);

			expect(result.topProjects).toHaveLength(2);
			const projectA = result.topProjects.find(p => p.project === 'project-a');
			const projectB = result.topProjects.find(p => p.project === 'project-b');
			expect(projectA?.minutes).toBe(50); // 30 + 20
			expect(projectB?.minutes).toBe(20);
		});

		it('should include tags when includeTags is true', () => {
			const tasks: TaskInfo[] = [
				TaskFactory.createTask({
					title: 'Task 1',
					path: '/tasks/1.md',
					tags: ['dev', 'urgent'],
					timeEntries: [
						{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z', duration: 30 },
					],
				}),
			];

			const result = computeTimeSummary(
				tasks,
				{ period: 'all', fromDate: null, toDate: null, includeTags: true },
				isCompleted
			);

			expect(result.topTags).toBeDefined();
			expect(result.topTags).toHaveLength(2);
		});

		it('should not include tags when includeTags is false', () => {
			const tasks: TaskInfo[] = [
				TaskFactory.createTask({
					title: 'Task 1',
					tags: ['dev'],
					timeEntries: [
						{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z', duration: 30 },
					],
				}),
			];

			const result = computeTimeSummary(
				tasks,
				{ period: 'all', fromDate: null, toDate: null, includeTags: false },
				isCompleted
			);

			expect(result.topTags).toBeUndefined();
		});

		it('should sort top tasks by minutes descending', () => {
			const tasks: TaskInfo[] = [
				TaskFactory.createTask({
					title: 'Small Task',
					path: '/tasks/small.md',
					timeEntries: [
						{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:10:00Z', duration: 10 },
					],
				}),
				TaskFactory.createTask({
					title: 'Large Task',
					path: '/tasks/large.md',
					timeEntries: [
						{ startTime: '2025-01-01T11:00:00Z', endTime: '2025-01-01T12:00:00Z', duration: 60 },
					],
				}),
			];

			const result = computeTimeSummary(
				tasks,
				{ period: 'all', fromDate: null, toDate: null },
				isCompleted
			);

			expect(result.topTasks[0].title).toBe('Large Task');
			expect(result.topTasks[1].title).toBe('Small Task');
		});
	});

	describe('computeTaskTimeData', () => {
		it('should return empty data for task with no time entries', () => {
			const task = TaskFactory.createTask({ title: 'No Time' });

			const result = computeTaskTimeData(task, () => null);

			expect(result.summary.totalMinutes).toBe(0);
			expect(result.summary.totalSessions).toBe(0);
			expect(result.activeSession).toBeNull();
			expect(result.timeEntries).toHaveLength(0);
		});

		it('should calculate summary for completed sessions', () => {
			const task = TaskFactory.createTask({
				title: 'Task with time',
				path: '/tasks/with-time.md',
				status: 'open',
				priority: 'normal',
				timeEntries: [
					{ startTime: '2025-01-01T10:00:00Z', endTime: '2025-01-01T10:30:00Z', duration: 30 },
					{ startTime: '2025-01-01T11:00:00Z', endTime: '2025-01-01T11:20:00Z', duration: 20 },
				],
			});

			const result = computeTaskTimeData(task, () => null);

			expect(result.task.id).toBe('/tasks/with-time.md');
			expect(result.task.title).toBe('Task with time');
			expect(result.summary.totalMinutes).toBe(50);
			expect(result.summary.totalHours).toBe(0.83); // 50/60 rounded
			expect(result.summary.totalSessions).toBe(2);
			expect(result.summary.completedSessions).toBe(2);
			expect(result.summary.activeSessions).toBe(0);
			expect(result.summary.averageSessionMinutes).toBe(25); // (30+20)/2
		});

		it('should detect active session', () => {
			const now = Date.now();
			const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000).toISOString();

			const activeEntry: TimeEntry = {
				startTime: fifteenMinutesAgo,
				description: 'Currently working',
			};

			const task = TaskFactory.createTask({
				title: 'Active Task',
				timeEntries: [activeEntry],
			});

			const result = computeTaskTimeData(task, () => activeEntry);

			expect(result.summary.activeSessions).toBe(1);
			expect(result.activeSession).not.toBeNull();
			expect(result.activeSession?.description).toBe('Currently working');
			expect(result.activeSession?.elapsedMinutes).toBeGreaterThanOrEqual(14);
			expect(result.activeSession?.elapsedMinutes).toBeLessThanOrEqual(16);
		});

		it('should map time entries correctly', () => {
			const task = TaskFactory.createTask({
				title: 'Task',
				timeEntries: [
					{
						startTime: '2025-01-01T10:00:00Z',
						endTime: '2025-01-01T10:30:00Z',
						duration: 30,
						description: 'First session'
					},
				],
			});

			const result = computeTaskTimeData(task, () => null);

			expect(result.timeEntries).toHaveLength(1);
			expect(result.timeEntries[0].startTime).toBe('2025-01-01T10:00:00Z');
			expect(result.timeEntries[0].endTime).toBe('2025-01-01T10:30:00Z');
			expect(result.timeEntries[0].description).toBe('First session');
			expect(result.timeEntries[0].duration).toBe(30);
			expect(result.timeEntries[0].isActive).toBe(false);
		});

		it('should mark entries without endTime as active', () => {
			const task = TaskFactory.createTask({
				title: 'Task',
				timeEntries: [
					{ startTime: '2025-01-01T10:00:00Z' },
				],
			});

			const result = computeTaskTimeData(task, () => null);

			expect(result.timeEntries[0].isActive).toBe(true);
			expect(result.timeEntries[0].endTime).toBeNull();
		});
	});
});
