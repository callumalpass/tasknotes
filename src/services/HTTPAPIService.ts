import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { parse } from 'url';
import { parse as parseQuery } from 'querystring';
import { TaskInfo, TaskCreationData, FilterQuery } from '../types';
import { TaskService } from './TaskService';
import { FilterService } from './FilterService';
import { MinimalNativeCache } from '../utils/MinimalNativeCache';
import { calculateDefaultDate } from '../utils/helpers';
import TaskNotesPlugin from '../main';

interface APIResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

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

export class HTTPAPIService {
	private server?: Server;
	private plugin: TaskNotesPlugin;
	private taskService: TaskService;
	private filterService: FilterService;
	private cacheManager: MinimalNativeCache;

	constructor(
		plugin: TaskNotesPlugin,
		taskService: TaskService,
		filterService: FilterService,
		cacheManager: MinimalNativeCache
	) {
		this.plugin = plugin;
		this.taskService = taskService;
		this.filterService = filterService;
		this.cacheManager = cacheManager;
	}

	private async parseRequestBody(req: IncomingMessage): Promise<any> {
		return new Promise((resolve, reject) => {
			let body = '';
			req.on('data', chunk => {
				body += chunk.toString();
			});
			req.on('end', () => {
				try {
					resolve(body ? JSON.parse(body) : {});
				} catch (error) {
					reject(new Error('Invalid JSON'));
				}
			});
			req.on('error', reject);
		});
	}

	private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
		res.statusCode = statusCode;
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.end(JSON.stringify(data));
	}

	private successResponse<T>(data: T, message?: string): APIResponse<T> {
		return { success: true, data, message };
	}

	private errorResponse(error: string): APIResponse {
		return { success: false, error };
	}

	private authenticate(req: IncomingMessage): boolean {
		const authToken = this.plugin.settings.apiAuthToken;
		
		// Skip auth if no token is configured
		if (!authToken) {
			return true;
		}

		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return false;
		}

		const token = authHeader.substring(7);
		return token === authToken;
	}

	private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			// Handle CORS preflight
			if (req.method === 'OPTIONS') {
				this.sendResponse(res, 200, {});
				return;
			}

			// Parse URL
			const parsedUrl = parse(req.url || '', true);
			const pathname = parsedUrl.pathname || '';
			const query = parsedUrl.query;

			// Check authentication for API routes
			if (pathname.startsWith('/api/') && !this.authenticate(req)) {
				this.sendResponse(res, 401, this.errorResponse('Authentication required'));
				return;
			}

			// Route handling
			if (req.method === 'GET' && pathname === '/api/health') {
				await this.handleHealthCheck(req, res);
			} else if (req.method === 'GET' && pathname === '/api/tasks') {
				await this.handleGetTasks(req, res, query);
			} else if (req.method === 'POST' && pathname === '/api/tasks') {
				await this.handleCreateTask(req, res);
			} else if (req.method === 'GET' && pathname.startsWith('/api/tasks/') && !pathname.includes('/time') && !pathname.includes('/toggle') && !pathname.includes('/archive') && !pathname.includes('/complete-instance')) {
				await this.handleGetTask(req, res, pathname);
			} else if (req.method === 'PUT' && pathname.startsWith('/api/tasks/') && !pathname.includes('/time')) {
				await this.handleUpdateTask(req, res, pathname);
			} else if (req.method === 'DELETE' && pathname.startsWith('/api/tasks/')) {
				await this.handleDeleteTask(req, res, pathname);
			} else if (req.method === 'POST' && pathname.includes('/time/start')) {
				await this.handleStartTimeTracking(req, res, pathname);
			} else if (req.method === 'POST' && pathname.includes('/time/stop')) {
				await this.handleStopTimeTracking(req, res, pathname);
			} else if (req.method === 'POST' && pathname.includes('/toggle-status')) {
				await this.handleToggleStatus(req, res, pathname);
			} else if (req.method === 'POST' && pathname.includes('/archive')) {
				await this.handleToggleArchive(req, res, pathname);
			} else if (req.method === 'POST' && pathname.includes('/complete-instance')) {
				await this.handleCompleteRecurringInstance(req, res, pathname);
			} else if (req.method === 'POST' && pathname === '/api/tasks/query') {
				await this.handleQueryTasks(req, res);
			} else if (req.method === 'GET' && pathname === '/api/filter-options') {
				await this.handleGetFilterOptions(req, res);
			} else if (req.method === 'GET' && pathname === '/api/stats') {
				await this.handleGetStats(req, res);
			} else {
				this.sendResponse(res, 404, this.errorResponse('Not found'));
			}
		} catch (error: any) {
			console.error('API Error:', error);
			this.sendResponse(res, 500, this.errorResponse('Internal server error'));
		}
	}

	private async handleHealthCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
		this.sendResponse(res, 200, this.successResponse({ status: 'ok', timestamp: new Date().toISOString() }));
	}

	private async handleGetTasks(req: IncomingMessage, res: ServerResponse, query: any): Promise<void> {
		try {
			const params = query as TaskQueryParams;
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
					task.due && new Date(task.due) < today && task.status !== 'completed'
				);
			}
			if (params.completed === 'true') {
				filteredTasks = filteredTasks.filter(task => task.status === 'completed');
			} else if (params.completed === 'false') {
				filteredTasks = filteredTasks.filter(task => task.status !== 'completed');
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

			// Pagination
			const limit = params.limit ? parseInt(params.limit) : undefined;
			const offset = params.offset ? parseInt(params.offset) : 0;
			if (limit) {
				filteredTasks = filteredTasks.slice(offset, offset + limit);
			}

			this.sendResponse(res, 200, this.successResponse({
				tasks: filteredTasks,
				total: allTasks.length,
				filtered: filteredTasks.length
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	private async handleCreateTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const taskData: TaskCreationData = await this.parseRequestBody(req);
			
			if (!taskData.title || !taskData.title.trim()) {
				this.sendResponse(res, 400, this.errorResponse('Title is required'));
				return;
			}

			// Apply task creation defaults for API calls
			this.applyTaskCreationDefaults(taskData);

			const result = await this.taskService.createTask(taskData);
			this.sendResponse(res, 201, this.successResponse(result.taskInfo));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleGetTask(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = pathname.split('/')[3]; // /api/tasks/{id}
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

	private async handleUpdateTask(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = pathname.split('/')[3]; // /api/tasks/{id}
			const updates = await this.parseRequestBody(req);
			
			const originalTask = await this.cacheManager.getTaskInfo(taskId);
			if (!originalTask) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.updateTask(originalTask, updates);
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleDeleteTask(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = pathname.split('/')[3]; // /api/tasks/{id}
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			await this.taskService.deleteTask(task);
			this.sendResponse(res, 200, this.successResponse({ message: 'Task deleted successfully' }));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	private async handleStartTimeTracking(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = pathname.split('/')[3]; // /api/tasks/{id}/time/start
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.startTimeTracking(task);
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleStopTimeTracking(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = pathname.split('/')[3]; // /api/tasks/{id}/time/stop
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.stopTimeTracking(task);
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleToggleStatus(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = pathname.split('/')[3]; // /api/tasks/{id}/toggle-status
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.toggleStatus(task);
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleToggleArchive(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = pathname.split('/')[3]; // /api/tasks/{id}/archive
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.toggleArchive(task);
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleCompleteRecurringInstance(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = pathname.split('/')[3]; // /api/tasks/{id}/complete-instance
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

	private async handleQueryTasks(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const query = await this.parseRequestBody(req) as FilterQuery;
			const filteredTasksMap = await this.filterService.getGroupedTasks(query);
			
			// Flatten grouped results into a single array
			const filteredTasks: TaskInfo[] = [];
			for (const taskGroup of filteredTasksMap.values()) {
				filteredTasks.push(...taskGroup);
			}
			
			const allTasks = await this.cacheManager.getAllTasks();
			this.sendResponse(res, 200, this.successResponse({
				tasks: filteredTasks,
				total: allTasks.length,
				filtered: filteredTasks.length
			}));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleGetFilterOptions(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const filterOptions = await this.filterService.getFilterOptions();
			this.sendResponse(res, 200, this.successResponse(filterOptions));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	private async handleGetStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const allTasks = await this.cacheManager.getAllTasks();
			const stats = {
				total: allTasks.length,
				completed: allTasks.filter(t => t.status === 'completed').length,
				active: allTasks.filter(t => t.status !== 'completed' && !t.archived).length,
				overdue: allTasks.filter(t => {
					if (t.status === 'completed' || t.archived) return false;
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

	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.server = createServer((req, res) => {
					this.handleRequest(req, res).catch(error => {
						console.error('Request handling error:', error);
						this.sendResponse(res, 500, this.errorResponse('Internal server error'));
					});
				});
				
				this.server.listen(this.plugin.settings.apiPort, () => {
					console.log(`TaskNotes API server started on port ${this.plugin.settings.apiPort}`);
					resolve();
				});
				
				this.server.on('error', (err) => {
					console.error('API server error:', err);
					reject(err);
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	async stop(): Promise<void> {
		return new Promise((resolve) => {
			if (this.server) {
				this.server.close(() => {
					console.log('TaskNotes API server stopped');
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	isRunning(): boolean {
		return !!this.server && this.server.listening;
	}

	getPort(): number {
		return this.plugin.settings.apiPort;
	}

	/**
	 * Apply task creation defaults for API calls
	 */
	private applyTaskCreationDefaults(taskData: TaskCreationData): void {
		const defaults = this.plugin.settings.taskCreationDefaults;

		// Apply default scheduled date if not provided
		if (!taskData.scheduled && defaults.defaultScheduledDate !== 'none') {
			taskData.scheduled = calculateDefaultDate(defaults.defaultScheduledDate);
		}

		// Apply default due date if not provided  
		if (!taskData.due && defaults.defaultDueDate !== 'none') {
			taskData.due = calculateDefaultDate(defaults.defaultDueDate);
		}

		// Apply default contexts if not provided
		if (!taskData.contexts && defaults.defaultContexts) {
			taskData.contexts = defaults.defaultContexts.split(',').map(c => c.trim()).filter(c => c);
		}

		// Apply default projects if not provided
		if (!taskData.projects && defaults.defaultProjects) {
			taskData.projects = defaults.defaultProjects.split(',').map(p => p.trim()).filter(p => p);
		}

		// Apply default time estimate if not provided
		if (!taskData.timeEstimate && defaults.defaultTimeEstimate > 0) {
			taskData.timeEstimate = defaults.defaultTimeEstimate;
		}
	}
}