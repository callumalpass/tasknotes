import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { parse } from 'url';
import { IWebhookNotifier } from '../types';
import { TaskService } from './TaskService';
import { FilterService } from './FilterService';
import { MinimalNativeCache } from '../utils/MinimalNativeCache';
import { NaturalLanguageParser } from './NaturalLanguageParser';
import { StatusManager } from './StatusManager';
import TaskNotesPlugin from '../main';
import { OpenAPIController } from '../utils/OpenAPIDecorators';
import { APIRouter } from '../api/APIRouter';
import { TasksController } from '../api/TasksController';
import { TimeTrackingController } from '../api/TimeTrackingController';
import { PomodoroController } from '../api/PomodoroController';
import { SystemController } from '../api/SystemController';
import { WebhookController } from '../api/WebhookController';


@OpenAPIController
export class HTTPAPIService implements IWebhookNotifier {
	private server?: Server;
	private plugin: TaskNotesPlugin;
	private router: APIRouter;
	private tasksController: TasksController;
	private timeTrackingController: TimeTrackingController;
	private pomodoroController: PomodoroController;
	private systemController: SystemController;
	private webhookController: WebhookController;

	constructor(
		plugin: TaskNotesPlugin,
		taskService: TaskService,
		filterService: FilterService,
		cacheManager: MinimalNativeCache
	) {
		this.plugin = plugin;
		
		// Initialize dependencies
		const nlParser = new NaturalLanguageParser(
			plugin.settings.customStatuses,
			plugin.settings.customPriorities,
			plugin.settings.nlpDefaultToScheduled
		);
		const statusManager = new StatusManager(plugin.settings.customStatuses);
		
		// Initialize controllers
		this.webhookController = new WebhookController(plugin);
		this.tasksController = new TasksController(plugin, taskService, filterService, cacheManager, statusManager, this.webhookController);
		this.timeTrackingController = new TimeTrackingController(plugin, taskService, cacheManager, statusManager, this.webhookController);
		this.pomodoroController = new PomodoroController(plugin, cacheManager);
		this.systemController = new SystemController(plugin, taskService, nlParser, this.webhookController, this);
		
		// Initialize router and register routes
		this.router = new APIRouter();
		this.setupRoutes();
	}

	private setupRoutes(): void {
		// Health check
		this.router.get('/api/health', this.systemController.healthCheck.bind(this.systemController));
		
		// Task routes
		this.router.get('/api/tasks', this.tasksController.getTasks.bind(this.tasksController));
		this.router.post('/api/tasks', this.tasksController.createTask.bind(this.tasksController));
		this.router.get('/api/tasks/:id', this.tasksController.getTask.bind(this.tasksController));
		this.router.put('/api/tasks/:id', this.tasksController.updateTask.bind(this.tasksController));
		this.router.delete('/api/tasks/:id', this.tasksController.deleteTask.bind(this.tasksController));
		this.router.post('/api/tasks/:id/toggle-status', this.tasksController.toggleStatus.bind(this.tasksController));
		this.router.post('/api/tasks/:id/archive', this.tasksController.toggleArchive.bind(this.tasksController));
		this.router.post('/api/tasks/:id/complete-instance', this.tasksController.completeRecurringInstance.bind(this.tasksController));
		this.router.post('/api/tasks/query', this.tasksController.queryTasks.bind(this.tasksController));
		
		// Task stats and filter options
		this.router.get('/api/filter-options', this.tasksController.getFilterOptions.bind(this.tasksController));
		this.router.get('/api/stats', this.tasksController.getStats.bind(this.tasksController));
		
		// Time tracking routes
		this.router.post('/api/tasks/:id/time/start', this.timeTrackingController.startTimeTracking.bind(this.timeTrackingController));
		this.router.post('/api/tasks/:id/time/stop', this.timeTrackingController.stopTimeTracking.bind(this.timeTrackingController));
		this.router.post('/api/tasks/:id/time/start-with-description', this.timeTrackingController.startTimeTrackingWithDescription.bind(this.timeTrackingController));
		this.router.get('/api/tasks/:id/time', this.timeTrackingController.getTaskTimeData.bind(this.timeTrackingController));
		this.router.get('/api/time/active', this.timeTrackingController.getActiveTimeSessions.bind(this.timeTrackingController));
		this.router.get('/api/time/summary', this.timeTrackingController.getTimeSummary.bind(this.timeTrackingController));
		
		// Pomodoro routes
		this.router.post('/api/pomodoro/start', this.pomodoroController.startPomodoro.bind(this.pomodoroController));
		this.router.post('/api/pomodoro/stop', this.pomodoroController.stopPomodoro.bind(this.pomodoroController));
		this.router.post('/api/pomodoro/pause', this.pomodoroController.pausePomodoro.bind(this.pomodoroController));
		this.router.post('/api/pomodoro/resume', this.pomodoroController.resumePomodoro.bind(this.pomodoroController));
		this.router.get('/api/pomodoro/status', this.pomodoroController.getPomodoroStatus.bind(this.pomodoroController));
		this.router.get('/api/pomodoro/sessions', this.pomodoroController.getPomodoroSessions.bind(this.pomodoroController));
		this.router.get('/api/pomodoro/stats', this.pomodoroController.getPomodoroStats.bind(this.pomodoroController));
		
		// NLP routes
		this.router.post('/api/nlp/parse', this.systemController.handleNLPParse.bind(this.systemController));
		this.router.post('/api/nlp/create', this.systemController.handleNLPCreate.bind(this.systemController));
		
		// Webhook routes
		this.router.post('/api/webhooks', this.webhookController.registerWebhook.bind(this.webhookController));
		this.router.get('/api/webhooks', this.webhookController.listWebhooks.bind(this.webhookController));
		this.router.delete('/api/webhooks/:id', this.webhookController.deleteWebhook.bind(this.webhookController));
		this.router.get('/api/webhooks/deliveries', this.webhookController.getWebhookDeliveries.bind(this.webhookController));
		
		// Documentation routes
		this.router.get('/api/docs', this.systemController.handleOpenAPISpec.bind(this.systemController));
		this.router.get('/api/docs/ui', this.systemController.handleSwaggerUI.bind(this.systemController));
		
		// Note: CORS preflight is handled in the main handleRequest method
	}

	private async handleCORSPreflight(req: IncomingMessage, res: ServerResponse): Promise<void> {
		res.statusCode = 200;
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.end();
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

	private sendResponse(res: ServerResponse, statusCode: number, data: any): void {
		res.statusCode = statusCode;
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.end(JSON.stringify(data));
	}

	private successResponse<T>(data: T, message?: string): { success: boolean; data: T; message?: string } {
		return { success: true, data, message };
	}

	private errorResponse(error: string): { success: boolean; error: string } {
		return { success: false, error };
	}

	private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			// Handle CORS preflight requests
			if (req.method === 'OPTIONS') {
				await this.handleCORSPreflight(req, res);
				return;
			}

			// Parse URL for authentication check
			const parsedUrl = parse(req.url || '', true);
			const pathname = parsedUrl.pathname || '';

			// Check authentication for API routes
			if (pathname.startsWith('/api/') && !this.authenticate(req)) {
				this.sendResponse(res, 401, this.errorResponse('Authentication required'));
				return;
			}

			// Try to route the request
			const handled = await this.router.route(req, res);
			
			// If no route was found, return 404
			if (!handled) {
				this.sendResponse(res, 404, this.errorResponse('Not found'));
			}
		} catch (error: any) {
			console.error('API Error:', error);
			this.sendResponse(res, 500, this.errorResponse('Internal server error'));
		}
	}

	// Webhook interface implementation - delegate to WebhookController
	async triggerWebhook(event: any, data: any): Promise<void> {
		await this.webhookController.triggerWebhook(event, data);
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

}