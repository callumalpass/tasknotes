import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { BaseController } from './BaseController';
import { IWebhookNotifier } from '../types';
import { TaskService } from '../services/TaskService';
import { MinimalNativeCache } from '../utils/MinimalNativeCache';
import { StatusManager } from '../services/StatusManager';
import TaskNotesPlugin from '../main';

export class TimeTrackingController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private taskService: TaskService,
		private cacheManager: MinimalNativeCache,
		private statusManager: StatusManager,
		private webhookNotifier: IWebhookNotifier
	) {
		super();
	}

	async startTimeTracking(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse('Task ID is required'));
				return;
			}

			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.startTimeTracking(task);
			
			// Trigger webhook for time tracking start
			await this.webhookNotifier.triggerWebhook('time.started', { 
				task: updatedTask,
				session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1]
			});
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async stopTimeTracking(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse('Task ID is required'));
				return;
			}

			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.stopTimeTracking(task);
			
			// Trigger webhook for time tracking stop
			await this.webhookNotifier.triggerWebhook('time.stopped', { 
				task: updatedTask,
				session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1]
			});
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async startTimeTrackingWithDescription(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse('Task ID is required'));
				return;
			}

			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const body = await this.parseRequestBody(req);
			const description = body.description || '';

			// Start time tracking using the existing service method
			const updatedTask = await this.taskService.startTimeTracking(task);
			
			// If description was provided, update the latest time entry
			if (description && updatedTask.timeEntries && updatedTask.timeEntries.length > 0) {
				const latestEntry = updatedTask.timeEntries[updatedTask.timeEntries.length - 1];
				if (latestEntry && !latestEntry.endTime) {
					latestEntry.description = description;
					// Save the updated task
					await this.taskService.updateTask(updatedTask, { timeEntries: updatedTask.timeEntries });
				}
			}

			// Trigger webhook for time tracking start
			await this.webhookNotifier.triggerWebhook('time.started', { 
				task: updatedTask,
				session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1]
			});
			
			this.sendResponse(res, 200, this.successResponse({
				task: updatedTask,
				message: description ? `Time tracking started with description: ${description}` : 'Time tracking started'
			}));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async getActiveTimeSessions(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const allTasks = await this.cacheManager.getAllTasks();
			const activeSessions: Array<{
				task: any;
				session: any;
				elapsedMinutes: number;
			}> = [];
			
			for (const task of allTasks) {
				const activeEntry = this.plugin.getActiveTimeSession(task);
				if (activeEntry) {
					const startTime = new Date(activeEntry.startTime);
					const elapsedMinutes = Math.floor((Date.now() - startTime.getTime()) / (1000 * 60));
					
					activeSessions.push({
						task: {
							id: task.path,
							title: task.title,
							status: task.status,
							priority: task.priority,
							tags: task.tags || [],
							projects: task.projects || []
						},
						session: {
							startTime: activeEntry.startTime,
							description: activeEntry.description,
							elapsedMinutes
						},
						elapsedMinutes
					});
				}
			}
			
			this.sendResponse(res, 200, this.successResponse({
				activeSessions,
				totalActiveSessions: activeSessions.length,
				totalElapsedMinutes: activeSessions.reduce((sum, session) => sum + session.elapsedMinutes, 0)
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	async getTimeSummary(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const parsedUrl = parse(req.url || '', true);
			const query = parsedUrl.query;
			
			const allTasks = await this.cacheManager.getAllTasks();
			const period = query.period || 'today'; // today, week, month, all
			const fromDate = query.from ? new Date(query.from as string) : null;
			const toDate = query.to ? new Date(query.to as string) : null;
			
			// Calculate date range based on period
			let startDate: Date;
			let endDate: Date = new Date();
			
			switch (period) {
				case 'today':
					startDate = new Date();
					startDate.setHours(0, 0, 0, 0);
					break;
				case 'week':
					startDate = new Date();
					startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week
					startDate.setHours(0, 0, 0, 0);
					break;
				case 'month':
					startDate = new Date();
					startDate.setDate(1); // Start of month
					startDate.setHours(0, 0, 0, 0);
					break;
				case 'all':
					startDate = new Date(0); // Beginning of time
					break;
				default:
					if (fromDate) {
						startDate = fromDate;
						if (toDate) endDate = toDate;
					} else {
						startDate = new Date();
						startDate.setHours(0, 0, 0, 0);
					}
			}
			
			let totalMinutes = 0;
			let completedTasks = 0;
			let activeTasks = 0;
			const taskStats: Array<{task: string, title: string, minutes: number}> = [];
			const projectStats = new Map<string, number>();
			const tagStats = new Map<string, number>();
			
			for (const task of allTasks) {
				if (!task.timeEntries || task.timeEntries.length === 0) continue;
				
				let taskMinutes = 0;
				let hasActiveSession = false;
				
				for (const entry of task.timeEntries) {
					const entryStart = new Date(entry.startTime);
					const entryEnd = entry.endTime ? new Date(entry.endTime) : new Date();
					
					// Check if entry is in date range
					if (entryStart >= startDate && entryStart <= endDate) {
						if (entry.duration) {
							taskMinutes += entry.duration;
						} else if (!entry.endTime) {
							// Active session
							const elapsedMinutes = Math.floor((Date.now() - entryStart.getTime()) / (1000 * 60));
							taskMinutes += elapsedMinutes;
							hasActiveSession = true;
						} else {
							// Calculate duration from start/end times
							const durationMs = entryEnd.getTime() - entryStart.getTime();
							taskMinutes += Math.floor(durationMs / (1000 * 60));
						}
					}
				}
				
				if (taskMinutes > 0) {
					totalMinutes += taskMinutes;
					taskStats.push({
						task: task.path,
						title: task.title,
						minutes: taskMinutes
					});
					
					if (hasActiveSession) {
						activeTasks++;
					} else if (this.statusManager.isCompletedStatus(task.status)) {
						completedTasks++;
					}
					
					// Aggregate by projects
					if (task.projects) {
						for (const project of task.projects) {
							const current = projectStats.get(project) || 0;
							projectStats.set(project, current + taskMinutes);
						}
					}
					
					// Aggregate by tags
					if (task.tags) {
						for (const tag of task.tags) {
							const current = tagStats.get(tag) || 0;
							tagStats.set(tag, current + taskMinutes);
						}
					}
				}
			}
			
			// Sort and limit results
			taskStats.sort((a, b) => b.minutes - a.minutes);
			const topTasks = taskStats.slice(0, 10);
			
			const topProjects = Array.from(projectStats.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([project, minutes]) => ({ project, minutes }));
				
			const topTags = Array.from(tagStats.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10)
				.map(([tag, minutes]) => ({ tag, minutes }));
			
			this.sendResponse(res, 200, this.successResponse({
				period,
				dateRange: {
					from: startDate.toISOString(),
					to: endDate.toISOString()
				},
				summary: {
					totalMinutes,
					totalHours: Math.round((totalMinutes / 60) * 100) / 100,
					tasksWithTime: taskStats.length,
					activeTasks,
					completedTasks
				},
				topTasks,
				topProjects,
				topTags
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	async getTaskTimeData(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse('Task ID is required'));
				return;
			}

			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}
			
			const timeEntries = task.timeEntries || [];
			const activeSession = this.plugin.getActiveTimeSession(task);
			const totalMinutes = this.calculateTotalTimeSpent(timeEntries);
			
			// Calculate session statistics
			const completedSessions = timeEntries.filter(entry => entry.endTime).length;
			const activeSessions = activeSession ? 1 : 0;
			
			// Calculate average session length (completed sessions only)
			const completedEntries = timeEntries.filter(entry => entry.endTime && entry.duration);
			const averageSessionMinutes = completedEntries.length > 0 
				? Math.round((completedEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0) / completedEntries.length) * 100) / 100
				: 0;
			
			this.sendResponse(res, 200, this.successResponse({
				task: {
					id: task.path,
					title: task.title,
					status: task.status,
					priority: task.priority
				},
				summary: {
					totalMinutes,
					totalHours: Math.round((totalMinutes / 60) * 100) / 100,
					totalSessions: timeEntries.length,
					completedSessions,
					activeSessions,
					averageSessionMinutes
				},
				activeSession: activeSession ? {
					startTime: activeSession.startTime,
					description: activeSession.description,
					elapsedMinutes: Math.floor((Date.now() - new Date(activeSession.startTime).getTime()) / (1000 * 60))
				} : null,
				timeEntries: timeEntries.map(entry => ({
					startTime: entry.startTime,
					endTime: entry.endTime || null,
					description: entry.description || null,
					duration: entry.duration || (entry.endTime ? 
						Math.floor((new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime()) / (1000 * 60)) : 
						Math.floor((Date.now() - new Date(entry.startTime).getTime()) / (1000 * 60))
					),
					isActive: !entry.endTime
				}))
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	private calculateTotalTimeSpent(timeEntries: any[]): number {
		if (!timeEntries || timeEntries.length === 0) return 0;
		
		return timeEntries.reduce((total, entry) => {
			if (entry.duration) {
				return total + entry.duration;
			} else if (entry.endTime) {
				const durationMs = new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime();
				return total + Math.floor(durationMs / (1000 * 60));
			} else {
				// Active session
				const elapsedMs = Date.now() - new Date(entry.startTime).getTime();
				return total + Math.floor(elapsedMs / (1000 * 60));
			}
		}, 0);
	}
}