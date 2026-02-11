import { TaskInfo, TimeEntry } from "../types";

export interface ActiveSessionInfo {
	task: {
		id: string;
		title: string;
		status: string;
		priority: string;
		tags: string[];
		projects: string[];
	};
	session: {
		startTime: string;
		description?: string;
		elapsedMinutes: number;
	};
	elapsedMinutes: number;
}

export interface ActiveSessionsResult {
	activeSessions: ActiveSessionInfo[];
	totalActiveSessions: number;
	totalElapsedMinutes: number;
}

export interface TimeSummaryOptions {
	period: string;
	fromDate: Date | null;
	toDate: Date | null;
	includeTags?: boolean;
}

export interface TimeSummaryResult {
	period: string;
	dateRange: { from: string; to: string };
	summary: {
		totalMinutes: number;
		totalHours: number;
		tasksWithTime: number;
		activeTasks: number;
		completedTasks: number;
	};
	topTasks: Array<{ task: string; title: string; minutes: number }>;
	topProjects: Array<{ project: string; minutes: number }>;
	topTags?: Array<{ tag: string; minutes: number }>;
}

export interface TaskTimeDataResult {
	task: {
		id: string;
		title: string;
		status: string;
		priority: string;
	};
	summary: {
		totalMinutes: number;
		totalHours: number;
		totalSessions: number;
		completedSessions: number;
		activeSessions: number;
		averageSessionMinutes: number;
	};
	activeSession: {
		startTime: string;
		description?: string;
		elapsedMinutes: number;
	} | null;
	timeEntries: Array<{
		startTime: string;
		endTime: string | null;
		description: string | null;
		duration: number;
		isActive: boolean;
	}>;
}

export function calculateTotalTimeSpent(timeEntries: TimeEntry[]): number {
	if (!timeEntries || timeEntries.length === 0) return 0;

	return timeEntries.reduce((total, entry) => {
		if (entry.duration) {
			return total + entry.duration;
		} else if (entry.endTime) {
			const durationMs =
				new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
			return total + Math.floor(durationMs / (1000 * 60));
		} else {
			// Active session
			const elapsedMs = Date.now() - new Date(entry.startTime).getTime();
			return total + Math.floor(elapsedMs / (1000 * 60));
		}
	}, 0);
}

export function computeActiveTimeSessions(
	tasks: TaskInfo[],
	getActiveSession: (task: TaskInfo) => TimeEntry | null
): ActiveSessionsResult {
	const activeSessions: ActiveSessionInfo[] = [];

	for (const task of tasks) {
		const activeEntry = getActiveSession(task);
		if (activeEntry) {
			const startTime = new Date(activeEntry.startTime);
			const elapsedMinutes = Math.floor(
				(Date.now() - startTime.getTime()) / (1000 * 60)
			);

			activeSessions.push({
				task: {
					id: task.path,
					title: task.title,
					status: task.status,
					priority: task.priority,
					tags: task.tags || [],
					projects: task.projects || [],
				},
				session: {
					startTime: activeEntry.startTime,
					description: activeEntry.description,
					elapsedMinutes,
				},
				elapsedMinutes,
			});
		}
	}

	return {
		activeSessions,
		totalActiveSessions: activeSessions.length,
		totalElapsedMinutes: activeSessions.reduce(
			(sum, session) => sum + session.elapsedMinutes,
			0
		),
	};
}

function computeDateRange(options: TimeSummaryOptions): { startDate: Date; endDate: Date } {
	let startDate: Date;
	let endDate: Date = new Date();

	switch (options.period) {
		case "today":
			startDate = new Date();
			startDate.setHours(0, 0, 0, 0);
			break;
		case "week":
			startDate = new Date();
			startDate.setDate(startDate.getDate() - startDate.getDay());
			startDate.setHours(0, 0, 0, 0);
			break;
		case "month":
			startDate = new Date();
			startDate.setDate(1);
			startDate.setHours(0, 0, 0, 0);
			break;
		case "all":
			startDate = new Date(0);
			break;
		default:
			if (options.fromDate) {
				startDate = options.fromDate;
				if (options.toDate) endDate = options.toDate;
			} else {
				startDate = new Date();
				startDate.setHours(0, 0, 0, 0);
			}
	}

	return { startDate, endDate };
}

export function computeTimeSummary(
	tasks: TaskInfo[],
	options: TimeSummaryOptions,
	isCompletedStatus: (status: string) => boolean
): TimeSummaryResult {
	const { startDate, endDate } = computeDateRange(options);

	let totalMinutes = 0;
	let completedTasks = 0;
	let activeTasks = 0;
	const taskStats: Array<{ task: string; title: string; minutes: number }> = [];
	const projectStats = new Map<string, number>();
	const tagStats = options.includeTags ? new Map<string, number>() : null;

	for (const task of tasks) {
		if (!task.timeEntries || task.timeEntries.length === 0) continue;

		let taskMinutes = 0;
		let hasActiveSession = false;

		for (const entry of task.timeEntries) {
			const entryStart = new Date(entry.startTime);

			if (entryStart >= startDate && entryStart <= endDate) {
				if (entry.duration) {
					taskMinutes += entry.duration;
				} else if (!entry.endTime) {
					taskMinutes += Math.floor(
						(Date.now() - entryStart.getTime()) / (1000 * 60)
					);
					hasActiveSession = true;
				} else {
					const entryEnd = new Date(entry.endTime);
					taskMinutes += Math.floor(
						(entryEnd.getTime() - entryStart.getTime()) / (1000 * 60)
					);
				}
			}
		}

		if (taskMinutes > 0) {
			totalMinutes += taskMinutes;
			taskStats.push({
				task: task.path,
				title: task.title,
				minutes: taskMinutes,
			});

			if (hasActiveSession) {
				activeTasks++;
			} else if (isCompletedStatus(task.status)) {
				completedTasks++;
			}

			if (task.projects) {
				for (const project of task.projects) {
					projectStats.set(project, (projectStats.get(project) || 0) + taskMinutes);
				}
			}

			if (tagStats && task.tags) {
				for (const tag of task.tags) {
					tagStats.set(tag, (tagStats.get(tag) || 0) + taskMinutes);
				}
			}
		}
	}

	taskStats.sort((a, b) => b.minutes - a.minutes);

	const topProjects = Array.from(projectStats.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([project, minutes]) => ({ project, minutes }));

	const result: TimeSummaryResult = {
		period: options.period,
		dateRange: {
			from: startDate.toISOString(),
			to: endDate.toISOString(),
		},
		summary: {
			totalMinutes,
			totalHours: Math.round((totalMinutes / 60) * 100) / 100,
			tasksWithTime: taskStats.length,
			activeTasks,
			completedTasks,
		},
		topTasks: taskStats.slice(0, 10),
		topProjects,
	};

	if (tagStats) {
		result.topTags = Array.from(tagStats.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([tag, minutes]) => ({ tag, minutes }));
	}

	return result;
}

export function computeTaskTimeData(
	task: TaskInfo,
	getActiveSession: (task: TaskInfo) => TimeEntry | null
): TaskTimeDataResult {
	const timeEntries = task.timeEntries || [];
	const activeSession = getActiveSession(task);
	const totalMinutes = calculateTotalTimeSpent(timeEntries);

	const completedSessions = timeEntries.filter((entry) => entry.endTime).length;
	const completedEntries = timeEntries.filter((entry) => entry.endTime && entry.duration);
	const averageSessionMinutes =
		completedEntries.length > 0
			? Math.round(
					(completedEntries.reduce(
						(sum, entry) => sum + (entry.duration || 0),
						0
					) /
						completedEntries.length) *
						100
				) / 100
			: 0;

	return {
		task: {
			id: task.path,
			title: task.title,
			status: task.status,
			priority: task.priority,
		},
		summary: {
			totalMinutes,
			totalHours: Math.round((totalMinutes / 60) * 100) / 100,
			totalSessions: timeEntries.length,
			completedSessions,
			activeSessions: activeSession ? 1 : 0,
			averageSessionMinutes,
		},
		activeSession: activeSession
			? {
					startTime: activeSession.startTime,
					description: activeSession.description,
					elapsedMinutes: Math.floor(
						(Date.now() - new Date(activeSession.startTime).getTime()) /
							(1000 * 60)
					),
				}
			: null,
		timeEntries: timeEntries.map((entry) => ({
			startTime: entry.startTime,
			endTime: entry.endTime || null,
			description: entry.description || null,
			duration:
				entry.duration ||
				(entry.endTime
					? Math.floor(
							(new Date(entry.endTime).getTime() -
								new Date(entry.startTime).getTime()) /
								(1000 * 60)
						)
					: Math.floor(
							(Date.now() - new Date(entry.startTime).getTime()) /
								(1000 * 60)
						)),
			isActive: !entry.endTime,
		})),
	};
}
