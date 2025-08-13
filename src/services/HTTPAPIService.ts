import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { parse } from 'url';
import { parse as parseQuery } from 'querystring';
import { TaskInfo, TaskCreationData, FilterQuery, WebhookConfig, WebhookEvent, WebhookPayload, WebhookDelivery, IWebhookNotifier } from '../types';
import { TaskService } from './TaskService';
import { FilterService } from './FilterService';
import { MinimalNativeCache } from '../utils/MinimalNativeCache';
import { calculateDefaultDate } from '../utils/helpers';
import { NaturalLanguageParser, ParsedTaskData } from './NaturalLanguageParser';
import { StatusManager } from './StatusManager';
import TaskNotesPlugin from '../main';
import { createHash, createHmac } from 'crypto';

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

export class HTTPAPIService implements IWebhookNotifier {
	private server?: Server;
	private plugin: TaskNotesPlugin;
	private taskService: TaskService;
	private filterService: FilterService;
	private cacheManager: MinimalNativeCache;
	private nlParser: NaturalLanguageParser;
	private statusManager: StatusManager;
	private webhooks: Map<string, WebhookConfig> = new Map();
	private webhookDeliveryQueue: WebhookDelivery[] = [];
	private isProcessingWebhooks = false;

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
		this.nlParser = new NaturalLanguageParser(
			plugin.settings.customStatuses,
			plugin.settings.customPriorities,
			plugin.settings.nlpDefaultToScheduled
		);
		this.statusManager = new StatusManager(plugin.settings.customStatuses);
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
			} else if (req.method === 'POST' && pathname === '/api/nlp/parse') {
				await this.handleNLPParse(req, res);
			} else if (req.method === 'POST' && pathname === '/api/nlp/create') {
				await this.handleNLPCreate(req, res);
			} else if (req.method === 'POST' && pathname === '/api/webhooks') {
				await this.handleRegisterWebhook(req, res);
			} else if (req.method === 'GET' && pathname === '/api/webhooks') {
				await this.handleListWebhooks(req, res);
			} else if (req.method === 'DELETE' && pathname.startsWith('/api/webhooks/')) {
				await this.handleDeleteWebhook(req, res, pathname);
			} else if (req.method === 'GET' && pathname === '/api/webhooks/deliveries') {
				await this.handleGetWebhookDeliveries(req, res);
			} else {
				this.sendResponse(res, 404, this.errorResponse('Not found'));
			}
		} catch (error: any) {
			console.error('API Error:', error);
			this.sendResponse(res, 500, this.errorResponse('Internal server error'));
		}
	}

	private async handleHealthCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const vaultName = this.plugin.app.vault.getName();
		const adapter = this.plugin.app.vault.adapter as any;
		
		// Try to get vault path information
		let vaultPath = null;
		try {
			// Check if adapter has basePath property (some adapters expose this)
			if ('basePath' in adapter && typeof adapter.basePath === 'string') {
				vaultPath = adapter.basePath;
			} else if ('path' in adapter && typeof adapter.path === 'string') {
				vaultPath = adapter.path;
			}
		} catch (error) {
			// Silently fail if vault path isn't accessible
		}
		
		this.sendResponse(res, 200, this.successResponse({ 
			status: 'ok', 
			timestamp: new Date().toISOString(),
			vault: {
				name: vaultName,
				path: vaultPath
			}
		}));
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
			
			// Trigger webhook for task creation
			await this.triggerWebhook('task.created', { task: result.taskInfo });
			
			this.sendResponse(res, 201, this.successResponse(result.taskInfo));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleGetTask(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = decodeURIComponent(pathname.split('/')[3]); // /api/tasks/{id}
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
			const taskId = decodeURIComponent(pathname.split('/')[3]); // /api/tasks/{id}
			const updates = await this.parseRequestBody(req);
			
			const originalTask = await this.cacheManager.getTaskInfo(taskId);
			if (!originalTask) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.updateTask(originalTask, updates);
			
			// Trigger webhook for task update
			await this.triggerWebhook('task.updated', { 
				task: updatedTask,
				previous: originalTask 
			});
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleDeleteTask(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = decodeURIComponent(pathname.split('/')[3]); // /api/tasks/{id}
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			await this.taskService.deleteTask(task);
			
			// Trigger webhook for task deletion
			await this.triggerWebhook('task.deleted', { task });
			
			this.sendResponse(res, 200, this.successResponse({ message: 'Task deleted successfully' }));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	private async handleStartTimeTracking(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = decodeURIComponent(pathname.split('/')[3]); // /api/tasks/{id}/time/start
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.startTimeTracking(task);
			
			// Trigger webhook for time tracking start
			await this.triggerWebhook('time.started', { 
				task: updatedTask,
				session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1]
			});
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleStopTimeTracking(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = decodeURIComponent(pathname.split('/')[3]); // /api/tasks/{id}/time/stop
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.stopTimeTracking(task);
			
			// Trigger webhook for time tracking stop
			await this.triggerWebhook('time.stopped', { 
				task: updatedTask,
				session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1]
			});
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleToggleStatus(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = decodeURIComponent(pathname.split('/')[3]); // /api/tasks/{id}/toggle-status
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
				await this.triggerWebhook('task.completed', { task: updatedTask });
			} else {
				await this.triggerWebhook('task.updated', { 
					task: updatedTask,
					previous: task
				});
			}
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleToggleArchive(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = decodeURIComponent(pathname.split('/')[3]); // /api/tasks/{id}/archive
			const task = await this.cacheManager.getTaskInfo(taskId);
			
			if (!task) {
				this.sendResponse(res, 404, this.errorResponse('Task not found'));
				return;
			}

			const updatedTask = await this.taskService.toggleArchive(task);
			
			// Trigger webhook for archive/unarchive
			if (updatedTask.archived) {
				await this.triggerWebhook('task.archived', { task: updatedTask });
			} else {
				await this.triggerWebhook('task.unarchived', { task: updatedTask });
			}
			
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	private async handleCompleteRecurringInstance(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const taskId = decodeURIComponent(pathname.split('/')[3]); // /api/tasks/{id}/complete-instance
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

	async start(): Promise<void> {
		// Load saved webhooks
		this.loadWebhooks();
		
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

	/**
	 * Handle NLP parse request - parses natural language input and returns structured data
	 */
	private async handleNLPParse(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const body = await this.parseRequestBody(req);
			
			if (!body.text || typeof body.text !== 'string') {
				this.sendResponse(res, 400, this.errorResponse('Text field is required and must be a string'));
				return;
			}

			// Parse the natural language input
			const parsedData = this.nlParser.parseInput(body.text);
			
			// Convert ParsedTaskData to TaskCreationData format
			const taskData: TaskCreationData = {
				title: parsedData.title,
				details: parsedData.details,
				priority: parsedData.priority,
				status: parsedData.status || 'todo',
				tags: parsedData.tags,
				contexts: parsedData.contexts,
				projects: parsedData.projects,
				recurrence: parsedData.recurrence,
				timeEstimate: parsedData.estimate
			};

			// Handle dates
			if (parsedData.dueDate) {
				taskData.due = parsedData.dueDate;
				if (parsedData.dueTime) {
					taskData.due = `${parsedData.dueDate} ${parsedData.dueTime}`;
				}
			}
			if (parsedData.scheduledDate) {
				taskData.scheduled = parsedData.scheduledDate;
				if (parsedData.scheduledTime) {
					taskData.scheduled = `${parsedData.scheduledDate} ${parsedData.scheduledTime}`;
				}
			}

			this.sendResponse(res, 200, this.successResponse({
				parsed: parsedData,
				taskData: taskData
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	/**
	 * Handle NLP create request - parses natural language input and creates a task
	 */
	private async handleNLPCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const body = await this.parseRequestBody(req);
			
			if (!body.text || typeof body.text !== 'string') {
				this.sendResponse(res, 400, this.errorResponse('Text field is required and must be a string'));
				return;
			}

			// Parse the natural language input
			const parsedData = this.nlParser.parseInput(body.text);
			
			// Convert ParsedTaskData to TaskCreationData format
			const taskData: TaskCreationData = {
				title: parsedData.title,
				details: parsedData.details,
				priority: parsedData.priority,
				status: parsedData.status || 'todo',
				tags: parsedData.tags,
				contexts: parsedData.contexts,
				projects: parsedData.projects,
				recurrence: parsedData.recurrence,
				timeEstimate: parsedData.estimate,
				creationContext: 'api'
			};

			// Handle dates
			if (parsedData.dueDate) {
				taskData.due = parsedData.dueDate;
				if (parsedData.dueTime) {
					taskData.due = `${parsedData.dueDate} ${parsedData.dueTime}`;
				}
			}
			if (parsedData.scheduledDate) {
				taskData.scheduled = parsedData.scheduledDate;
				if (parsedData.scheduledTime) {
					taskData.scheduled = `${parsedData.scheduledDate} ${parsedData.scheduledTime}`;
				}
			}

			// Apply task creation defaults
			this.applyTaskCreationDefaults(taskData);

			// Create the task
			const result = await this.taskService.createTask(taskData);
			
			// Trigger webhook for task creation via NLP
			await this.triggerWebhook('task.created', { 
				task: result.taskInfo,
				source: 'nlp',
				originalText: body.text
			});
			
			this.sendResponse(res, 201, this.successResponse({
				task: result.taskInfo,
				parsed: parsedData
			}));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	/**
	 * Register a new webhook
	 */
	private async handleRegisterWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const body = await this.parseRequestBody(req);
			
			if (!body.url || typeof body.url !== 'string') {
				this.sendResponse(res, 400, this.errorResponse('URL is required and must be a string'));
				return;
			}
			
			if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
				this.sendResponse(res, 400, this.errorResponse('Events array is required and must not be empty'));
				return;
			}
			
			// Generate webhook ID and secret if not provided
			const id = body.id || this.generateWebhookId();
			const secret = body.secret || this.generateWebhookSecret();
			
			const webhook: WebhookConfig = {
				id,
				url: body.url,
				events: body.events,
				secret,
				active: body.active !== false,
				createdAt: new Date().toISOString(),
				failureCount: 0,
				successCount: 0,
				transformFile: body.transformFile || undefined,
				corsHeaders: body.corsHeaders !== false // Default to true unless explicitly set to false
			};
			
			this.webhooks.set(id, webhook);
			await this.saveWebhooks();
			
			this.sendResponse(res, 201, this.successResponse({
				webhook,
				message: 'Webhook registered successfully. Save the secret for signature validation.'
			}));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	/**
	 * List all registered webhooks
	 */
	private async handleListWebhooks(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const webhooks = Array.from(this.webhooks.values()).map(webhook => ({
				...webhook,
				secret: undefined // Don't expose secrets in list
			}));
			
			this.sendResponse(res, 200, this.successResponse({
				webhooks,
				total: webhooks.length
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	/**
	 * Delete a webhook
	 */
	private async handleDeleteWebhook(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
		try {
			const webhookId = decodeURIComponent(pathname.split('/')[3]);
			
			if (!this.webhooks.has(webhookId)) {
				this.sendResponse(res, 404, this.errorResponse('Webhook not found'));
				return;
			}
			
			this.webhooks.delete(webhookId);
			await this.saveWebhooks();
			
			this.sendResponse(res, 200, this.successResponse({
				message: 'Webhook deleted successfully'
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	/**
	 * Get webhook delivery history
	 */
	private async handleGetWebhookDeliveries(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			// Return recent deliveries from queue
			const deliveries = this.webhookDeliveryQueue.slice(-100); // Last 100 deliveries
			
			this.sendResponse(res, 200, this.successResponse({
				deliveries,
				total: deliveries.length
			}));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	/**
	 * Trigger webhooks for an event
	 */
	async triggerWebhook(event: WebhookEvent, data: any): Promise<void> {
		// Fire and forget - don't block the main operation
		setImmediate(() => {
			this.processWebhookTrigger(event, data).catch(error => {
				console.error('Webhook processing error:', error);
			});
		});
	}

	/**
	 * Process webhook triggers asynchronously
	 */
	private async processWebhookTrigger(event: WebhookEvent, data: any): Promise<void> {
		const relevantWebhooks = Array.from(this.webhooks.values())
			.filter(webhook => webhook.active && webhook.events.includes(event));
		
		if (relevantWebhooks.length === 0) {
			return;
		}
		
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
		
		const basePayload: WebhookPayload = {
			event,
			timestamp: new Date().toISOString(),
			vault: {
				name: this.plugin.app.vault.getName(),
				path: vaultPath
			},
			data
		};
		
		for (const webhook of relevantWebhooks) {
			// Apply transformation if specified
			let payload = basePayload;
			if (webhook.transformFile) {
				try {
					payload = await this.applyTransformation(webhook.transformFile, basePayload);
				} catch (error) {
					console.error(`Transform error for ${webhook.transformFile}:`, error);
					// Continue with original payload on error
				}
			}
			
			const delivery: WebhookDelivery = {
				id: this.generateDeliveryId(),
				webhookId: webhook.id,
				event,
				payload,
				status: 'pending',
				attempts: 0
			};
			
			this.webhookDeliveryQueue.push(delivery);
			
			// Process delivery
			this.deliverWebhook(webhook, delivery);
		}
		
		// Clean up old deliveries (keep last 100)
		if (this.webhookDeliveryQueue.length > 100) {
			this.webhookDeliveryQueue = this.webhookDeliveryQueue.slice(-100);
		}
	}

	/**
	 * Deliver a webhook with retry logic
	 */
	private async deliverWebhook(webhook: WebhookConfig, delivery: WebhookDelivery, retryCount = 0): Promise<void> {
		const maxRetries = 3;
		
		try {
			delivery.attempts++;
			delivery.lastAttempt = new Date().toISOString();
			
			const signature = this.generateSignature(delivery.payload, webhook.secret);
			
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			
			// Only add custom headers if corsHeaders is enabled (default true)
			if (webhook.corsHeaders !== false) {
				headers['X-TaskNotes-Event'] = delivery.event;
				headers['X-TaskNotes-Signature'] = signature;
				headers['X-TaskNotes-Delivery-ID'] = delivery.id;
			}
			
			const response = await fetch(webhook.url, {
				method: 'POST',
				headers,
				body: JSON.stringify(delivery.payload),
				// 10 second timeout - AbortSignal.timeout not available in all environments
			});
			
			delivery.responseStatus = response.status;
			
			if (response.ok) {
				delivery.status = 'success';
				webhook.successCount++;
				webhook.lastTriggered = new Date().toISOString();
			} else {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
		} catch (error: any) {
			delivery.error = error.message;
			webhook.failureCount++;
			
			if (retryCount < maxRetries) {
				// Exponential backoff: 1s, 2s, 4s
				const delay = Math.pow(2, retryCount) * 1000;
				setTimeout(() => {
					this.deliverWebhook(webhook, delivery, retryCount + 1);
				}, delay);
			} else {
				delivery.status = 'failed';
				
				// Disable webhook after too many failures
				if (webhook.failureCount > 10) {
					webhook.active = false;
					console.warn(`Webhook ${webhook.id} disabled after ${webhook.failureCount} failures`);
				}
			}
		}
		
		// Save webhook state
		await this.saveWebhooks();
	}

	/**
	 * Generate HMAC signature for webhook payload
	 */
	private generateSignature(payload: any, secret: string): string {
		const hmac = createHmac('sha256', secret);
		hmac.update(JSON.stringify(payload));
		return hmac.digest('hex');
	}

	/**
	 * Generate unique webhook ID
	 */
	private generateWebhookId(): string {
		return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	/**
	 * Generate secure webhook secret
	 */
	private generateWebhookSecret(): string {
		return createHash('sha256')
			.update(Date.now().toString() + Math.random().toString())
			.digest('hex');
	}

	/**
	 * Generate unique delivery ID
	 */
	private generateDeliveryId(): string {
		return `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	/**
	 * Save webhooks to plugin settings
	 */
	private async saveWebhooks(): Promise<void> {
		// Convert Map to array for storage
		const webhooksArray = Array.from(this.webhooks.values());
		this.plugin.settings.webhooks = webhooksArray;
		await this.plugin.saveSettings();
	}

	/**
	 * Load webhooks from plugin settings
	 */
	private loadWebhooks(): void {
		if (this.plugin.settings.webhooks) {
			this.webhooks.clear();
			for (const webhook of this.plugin.settings.webhooks) {
				this.webhooks.set(webhook.id, webhook);
			}
		}
	}

	/**
	 * Apply transformation from file to webhook payload
	 */
	private async applyTransformation(transformFile: string, payload: WebhookPayload): Promise<any> {
		try {
			if (transformFile.endsWith('.js')) {
				return await this.applyJSTransformation(transformFile, payload);
			} else if (transformFile.endsWith('.json')) {
				return await this.applyJSONTransformation(transformFile, payload);
			}
			
			// Unknown file type, return original payload
			return payload;
		} catch (error) {
			console.error(`Transformation failed for ${transformFile}:`, error);
			throw error;
		}
	}

	/**
	 * Apply JavaScript transformation
	 */
	private async applyJSTransformation(transformFile: string, payload: WebhookPayload): Promise<any> {
		try {
			// Read transformation file from vault
			const transformCode = await this.plugin.app.vault.adapter.read(transformFile);
			
			// Create a safe execution context
			const transform = new Function('payload', `
				${transformCode}
				if (typeof transform === 'function') {
					return transform(payload);
				} else {
					throw new Error('Transform file must export a transform function');
				}
			`);
			
			return transform(payload);
		} catch (error) {
			console.error(`JS transformation error:`, error);
			throw error;
		}
	}

	/**
	 * Apply JSON template transformation
	 */
	private async applyJSONTransformation(transformFile: string, payload: WebhookPayload): Promise<any> {
		try {
			// Read template file from vault
			const templateContent = await this.plugin.app.vault.adapter.read(transformFile);
			const templates = JSON.parse(templateContent);
			
			// Get template for this event or use default
			const template = templates[payload.event] || templates.default;
			if (!template) {
				throw new Error(`No template found for event ${payload.event} and no default template`);
			}
			
			// Apply template variable substitution
			return this.interpolateTemplate(template, payload);
		} catch (error) {
			console.error(`JSON transformation error:`, error);
			throw error;
		}
	}

	/**
	 * Interpolate template variables
	 */
	private interpolateTemplate(template: any, payload: any): any {
		if (typeof template === 'string') {
			return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
				return this.getNestedValue(payload, path) || match;
			});
		} else if (Array.isArray(template)) {
			return template.map(item => this.interpolateTemplate(item, payload));
		} else if (template && typeof template === 'object') {
			const result: any = {};
			for (const [key, value] of Object.entries(template)) {
				result[key] = this.interpolateTemplate(value, payload);
			}
			return result;
		} else {
			return template;
		}
	}

	/**
	 * Get nested value from object using dot notation
	 */
	private getNestedValue(obj: any, path: string): any {
		return path.split('.').reduce((current, key) => {
			return current && current[key] !== undefined ? current[key] : undefined;
		}, obj);
	}

}