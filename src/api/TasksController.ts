import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { BaseController } from './BaseController';
import { TaskInfo, TaskCreationData, FilterQuery, IWebhookNotifier } from '../types';
import { TaskService } from '../services/TaskService';
import { FilterService } from '../services/FilterService';
import { MinimalNativeCache } from '../utils/MinimalNativeCache';
import { StatusManager } from '../services/StatusManager';
import TaskNotesPlugin from '../main';

interface TaskQueryParams {
	status?: string;
	priority?: string;
	project?: string;
	tag?: string;
	due_before?: string;
	due_after?: string;
	scheduled_before?: string;
	scheduled_after?: string;
	overdue?: string;
	completed?: string;
	archived?: string;
	sort?: string;
	limit?: string;
	offset?: string;
}

export class TasksController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private taskService: TaskService,
		private filterService: FilterService,
		private cacheManager: MinimalNativeCache,
		private statusManager: StatusManager,
		private webhookNotifier: IWebhookNotifier
	) {
		super();
	}

	async getTasks(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const parsedUrl = parse(req.url || '', true);
			const params = parsedUrl.query as TaskQueryParams;
			const allTasks = await this.cacheManager.getAllTasks();
			
			let filteredTasks = allTasks;

			// Apply basic filters
			if (params.status) {
				filteredTasks = filteredTasks.filter(task => task.status === params.status);
			}
			if (params.priority) {
				filteredTasks = filteredTasks.filter(task => task.priority === params.priority);
			}
			if (params.project) {
				filteredTasks = filteredTasks.filter(task => 
					task.projects?.some(p => p.toLowerCase().includes(params.project!.toLowerCase()))
				);
			}
			if (params.tag) {
				filteredTasks = filteredTasks.filter(task => 
					task.tags?.some(t => t.toLowerCase().includes(params.tag!.toLowerCase()))
				);
			}
			if (params.overdue === 'true') {
				const today = new Date();
				filteredTasks = filteredTasks.filter(task => 
					task.due && new Date(task.due) < today && !this.statusManager.isCompletedStatus(task.status)
				);
			}
			if (params.completed === 'true') {
				filteredTasks = filteredTasks.filter(task => this.statusManager.isCompletedStatus(task.status));
			} else if (params.completed === 'false') {
				filteredTasks = filteredTasks.filter(task => !this.statusManager.isCompletedStatus(task.status));
			}
			if (params.archived === 'true') {
				filteredTasks = filteredTasks.filter(task => task.archived === true);
			} else if (params.archived === 'false') {
				filteredTasks = filteredTasks.filter(task => task.archived !== true);
			}

			// Apply date filters
			if (params.due_before) {
				const beforeDate = new Date(params.due_before);
				filteredTasks = filteredTasks.filter(task => 
					task.due && new Date(task.due) < beforeDate
				);
			}
			if (params.due_after) {
				const afterDate = new Date(params.due_after);
				filteredTasks = filteredTasks.filter(task => 
					task.due && new Date(task.due) > afterDate
				);
			}

			// Sorting
			if (params.sort) {
				const [field, direction = 'asc'] = params.sort.split(':');
				filteredTasks.sort((a, b) => {
					const aVal = (a as any)[field];
					const bVal = (b as any)[field];
					const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
					return direction === 'desc' ? -comparison : comparison;
				});
			}

			// Calculate filtered count before pagination
			const filteredCount = filteredTasks.length;

			// Pagination
			const limit = params.limit ? parseInt(params.limit) : undefined;
			const offset = params.offset ? parseInt(params.offset) : 0;
			if (limit) {
				filteredTasks = filteredTasks.slice(offset, offset + limit);
			}

			// Get vault information
			const adapter = this.plugin.app.vault.adapter as any;
			let vaultPath = null;
			try {
				if ('basePath' in adapter && typeof adapter.basePath === 'string') {
					vaultPath = adapter.basePath;
				} else if ('path' in adapter && typeof adapter.path === 'string') {
					vaultPath = adapter.path;
				}
			} catch (error) {
				// Silently fail if vault path isn't accessible
			}

			this.sendResponse(res, 200, this.successResponse({
				tasks: filteredTasks,
				total: allTasks.length,
				filtered: filteredCount,
				vault: {
					name: this.plugin.app.vault.getName(),
					path: vaultPath
				}
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	async createTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const taskData: TaskCreationData = await this.parseRequestBody(req);
			
			if (!taskData.title || !taskData.title.trim()) {
				this.sendResponse(res, 400, this.errorResponse('Title is required'));
				return;
			}

			const result = await this.taskService.createTask(taskData);
			
			// Trigger webhook for task creation
			await this.webhookNotifier.triggerWebhook('task.created', { task: result.taskInfo });
			
			this.sendResponse(res, 201, this.successResponse(result.taskInfo));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async getTask(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
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

			this.sendResponse(res, 200, this.successResponse(task));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	async updateTask(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse('Task ID is required'));
				return;
			}

			const updates = await this.parseRequestBody(req);
			
			const originalTask = await this.cacheManager.getTaskInfo(taskId);
			if (!originalTask) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.updateTask(originalTask, updates);
			
			// Trigger webhook for task update
			await this.webhookNotifier.triggerWebhook('task.updated', { 
				task: updatedTask,
				previous: originalTask 
			});
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async deleteTask(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
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

			await this.taskService.deleteTask(task);
			
			// Trigger webhook for task deletion
			await this.webhookNotifier.triggerWebhook('task.deleted', { task });
			
			this.sendResponse(res, 200, this.successResponse({ message: 'Task deleted successfully' }));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	async toggleStatus(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
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

			const updatedTask = await this.taskService.toggleStatus(task);
			
			// Trigger webhook for status change (might be completion)
			const wasCompleted = this.statusManager.isCompletedStatus(task.status);
			const isCompleted = this.statusManager.isCompletedStatus(updatedTask.status);
			
			if (!wasCompleted && isCompleted) {
				await this.webhookNotifier.triggerWebhook('task.completed', { task: updatedTask });
			} else {
				await this.webhookNotifier.triggerWebhook('task.updated', { 
					task: updatedTask,
					previous: task
				});
			}
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async toggleArchive(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
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

			const updatedTask = await this.taskService.toggleArchive(task);
			
			// Trigger webhook for archive/unarchive
			if (updatedTask.archived) {
				await this.webhookNotifier.triggerWebhook('task.archived', { task: updatedTask });
			} else {
				await this.webhookNotifier.triggerWebhook('task.unarchived', { task: updatedTask });
			}
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async completeRecurringInstance(req: IncomingMessage, res: ServerResponse, params?: Record<string, string>): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse('Task ID is required'));
				return;
			}

			const { date } = await this.parseRequestBody(req);
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const instanceDate = date ? new Date(date) : undefined;
			const updatedTask = await this.taskService.toggleRecurringTaskComplete(task, instanceDate);
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async queryTasks(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const query = await this.parseRequestBody(req) as FilterQuery;
			const filteredTasksMap = await this.filterService.getGroupedTasks(query);
			
			// Flatten grouped results into a single array
			const filteredTasks: TaskInfo[] = [];
			for (const taskGroup of filteredTasksMap.values()) {
				filteredTasks.push(...taskGroup);
			}
			
			const allTasks = await this.cacheManager.getAllTasks();
			// Get vault information
			const adapter = this.plugin.app.vault.adapter as any;
			let vaultPath = null;
			try {
				if ('basePath' in adapter && typeof adapter.basePath === 'string') {
					vaultPath = adapter.basePath;
				} else if ('path' in adapter && typeof adapter.path === 'string') {
					vaultPath = adapter.path;
				}
			} catch (error) {
				// Silently fail if vault path isn't accessible
			}

			this.sendResponse(res, 200, this.successResponse({
				tasks: filteredTasks,
				total: allTasks.length,
				filtered: filteredTasks.length,
				vault: {
					name: this.plugin.app.vault.getName(),
					path: vaultPath
				}
			}));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	async getFilterOptions(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const filterOptions = await this.filterService.getFilterOptions();
			this.sendResponse(res, 200, this.successResponse(filterOptions));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	async getStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const allTasks = await this.cacheManager.getAllTasks();
			const stats = {
				total: allTasks.length,
				completed: allTasks.filter(t => this.statusManager.isCompletedStatus(t.status)).length,
				active: allTasks.filter(t => !this.statusManager.isCompletedStatus(t.status) && !t.archived).length,
				overdue: allTasks.filter(t => {
					if (this.statusManager.isCompletedStatus(t.status) || t.archived) return false;
					return t.due && new Date(t.due) < new Date();
				}).length,
				archived: allTasks.filter(t => t.archived === true).length,
				withTimeTracking: allTasks.filter(t => t.timeEntries && t.timeEntries.length > 0).length
			};
			
			this.sendResponse(res, 200, this.successResponse(stats));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}
}