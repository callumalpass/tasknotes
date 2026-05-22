import { IWebhookNotifier, WebhookEvent } from "../types";
import { TaskService } from "./TaskService";
import { FilterService } from "./FilterService";
import { TaskManager } from "../utils/TaskManager";
import { NaturalLanguageParser } from "./NaturalLanguageParser";
import { StatusManager } from "./StatusManager";
import { TaskStatsService } from "./TaskStatsService";
import TaskNotesPlugin from "../main";

import { generateOpenAPISpec, OpenAPIController } from "../utils/OpenAPIDecorators";
import type { OpenAPISpec } from "../utils/OpenAPIDecorators";
import { APIRouter } from "../api/APIRouter";
import { TasksController } from "../api/TasksController";
import { TimeTrackingController } from "../api/TimeTrackingController";
import { PomodoroController } from "../api/PomodoroController";
import { SystemController } from "../api/SystemController";
import { WebhookController } from "../api/WebhookController";
import { CalendarsController } from "../api/CalendarsController";
import { MCPService } from "./MCPService";
import {
	parseJSONBody,
	resolveLocalCORSOrigin,
	sendJSONResponse,
	setCORSHeaders,
} from "../api/httpUtils";
import type { HTTPRequestLike, HTTPResponseLike, HTTPServerLike } from "../api/httpTypes";
import { parseRequestUrl } from "../api/httpTypes";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/HTTPAPIService" });
export const API_BIND_HOST = "127.0.0.1";

type HttpModuleLike = {
	createServer(handler: (req: HTTPRequestLike, res: HTTPResponseLike) => void): HTTPServerLike;
};

@OpenAPIController
export class HTTPAPIService implements IWebhookNotifier {
	private server?: HTTPServerLike;
	private plugin: TaskNotesPlugin;
	private router: APIRouter;
	private tasksController: TasksController;
	private timeTrackingController: TimeTrackingController;
	private pomodoroController: PomodoroController;
	private systemController: SystemController;
	private webhookController: WebhookController;
	private calendarsController: CalendarsController;
	private mcpService?: MCPService;

	constructor(
		plugin: TaskNotesPlugin,
		taskService: TaskService,
		filterService: FilterService,
		cacheManager: TaskManager
	) {
		this.plugin = plugin;

		// Initialize dependencies
		const nlParser = NaturalLanguageParser.fromPlugin(plugin);
		const statusManager = new StatusManager(
			plugin.settings.customStatuses,
			plugin.settings.defaultTaskStatus
		);
		const taskStatsService = new TaskStatsService(cacheManager, statusManager);

		// Initialize controllers
		this.webhookController = new WebhookController(plugin);
		this.tasksController = new TasksController(
			plugin,
			taskService,
			filterService,
			cacheManager,
			taskStatsService
		);
		this.timeTrackingController = new TimeTrackingController(
			plugin,
			taskService,
			cacheManager,
			statusManager
		);
		this.pomodoroController = new PomodoroController(plugin, cacheManager);
		this.systemController = new SystemController(plugin, taskService, nlParser, this);
		this.calendarsController = new CalendarsController(
			plugin,
			plugin.oauthService,
			plugin.icsSubscriptionService,
			plugin.calendarProviderRegistry
		);

		// Initialize MCP service if enabled
		if (plugin.settings.enableMCP) {
			this.mcpService = new MCPService(
				plugin,
				taskService,
				filterService,
				cacheManager,
				statusManager,
				nlParser,
				taskStatsService
			);
		}

		// Initialize router and register routes
		this.router = new APIRouter();
		this.setupRoutes();
	}

	private setupRoutes(): void {
		// Register all controllers using decorators
		this.router.registerController(this.tasksController);
		this.router.registerController(this.timeTrackingController);
		this.router.registerController(this.pomodoroController);
		this.router.registerController(this.systemController);
		this.router.registerController(this.webhookController);
		this.router.registerController(this.calendarsController);
	}

	/**
	 * Generate OpenAPI spec from all registered controllers
	 */
	generateOpenAPISpec(): OpenAPISpec {
		// Get base spec structure
		const spec = generateOpenAPISpec(this.systemController);

		// Collect endpoints from all controllers
		const allControllers = [
			this.tasksController,
			this.timeTrackingController,
			this.pomodoroController,
			this.systemController,
			this.webhookController,
			this.calendarsController,
		];

		// Merge paths from all controllers
		spec.paths = {};
		for (const controller of allControllers) {
			const controllerSpec = generateOpenAPISpec(controller);
			if (controllerSpec.paths) {
				spec.paths = { ...spec.paths, ...controllerSpec.paths };
			}
		}

		// Update server URL
		spec.servers = [
			{
				url: `http://localhost:${this.plugin.settings.apiPort}`,
				description: "TaskNotes API Server",
			},
		];

		return spec;
	}

	private async handleCORSPreflight(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		res.statusCode = 200;
		setCORSHeaders(res);
		res.end();
	}

	private getFallbackCORSOrigin(): string {
		return `http://${API_BIND_HOST}:${this.plugin.settings.apiPort}`;
	}

	private getRequestOrigin(req: HTTPRequestLike): string | undefined {
		const originHeader = req.headers.origin;
		return Array.isArray(originHeader) ? originHeader[0] : originHeader;
	}

	private applyCORSPolicy(req: HTTPRequestLike, res: HTTPResponseLike): boolean {
		const requestOrigin = this.getRequestOrigin(req);
		const allowOrigin = resolveLocalCORSOrigin(requestOrigin, this.getFallbackCORSOrigin());

		if (!allowOrigin) {
			return false;
		}

		setCORSHeaders(res, { allowOrigin });
		return true;
	}

	private authenticate(req: HTTPRequestLike): boolean {
		const authToken = this.plugin.settings.apiAuthToken;

		// Skip auth if no token is configured
		if (!authToken) {
			return true;
		}

		const authHeader = req.headers.authorization;
		const bearerToken = Array.isArray(authHeader) ? authHeader[0] : authHeader;
		if (!bearerToken || !bearerToken.startsWith("Bearer ")) {
			return false;
		}

		const token = bearerToken.substring(7);
		return token === authToken;
	}

	private sendResponse(res: HTTPResponseLike, statusCode: number, data: unknown): void {
		sendJSONResponse(res, statusCode, data);
	}

	private successResponse<T>(
		data: T,
		message?: string
	): { success: boolean; data: T; message?: string } {
		return { success: true, data, message };
	}

	private errorResponse(error: string): { success: boolean; error: string } {
		return { success: false, error };
	}

	private async handleRequest(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			if (!this.applyCORSPolicy(req, res)) {
				res.statusCode = 403;
				res.setHeader("Content-Type", "application/json");
				res.end(JSON.stringify(this.errorResponse("CORS origin is not allowed")));
				return;
			}

			// Handle CORS preflight requests
			if (req.method === "OPTIONS") {
				await this.handleCORSPreflight(req, res);
				return;
			}

			// Parse URL for authentication check
			const pathname = parseRequestUrl(req).pathname;

			// Handle MCP endpoint
			if (pathname === "/mcp") {
				if (!this.mcpService) {
					this.sendResponse(res, 404, this.errorResponse("MCP server is not enabled"));
					return;
				}
				if (!this.authenticate(req)) {
					this.sendResponse(res, 401, this.errorResponse("Authentication required"));
					return;
				}
				const body = await this.parseBody(req);
				await this.mcpService.handleRequest(req, res, body);
				return;
			}

			// Check authentication for API routes
			if (pathname.startsWith("/api/") && !this.authenticate(req)) {
				this.sendResponse(res, 401, this.errorResponse("Authentication required"));
				return;
			}

			// Try to route the request
			const handled = await this.router.route(req, res);

			// If no route was found, return 404
			if (!handled) {
				this.sendResponse(res, 404, this.errorResponse("Not found"));
			}
		} catch (error: unknown) {
			tasknotesLogger.error("API Error:", {
				category: "provider",
				operation: "api",
				error: error,
			});
			this.sendResponse(res, 500, this.errorResponse("Internal server error"));
		}
	}

	// Webhook interface implementation - delegate to WebhookController
	async triggerWebhook(event: WebhookEvent, data: unknown): Promise<void> {
		await this.webhookController.triggerWebhook(event, data);
	}

	/**
	 * Reload webhook configuration from plugin settings.
	 * Called after settings edits so runtime delivery state stays in sync.
	 */
	syncWebhookSettings(): void {
		this.webhookController.syncFromSettings();
	}

	private parseBody(req: HTTPRequestLike): Promise<Record<string, unknown>> {
		return parseJSONBody(req);
	}

	async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				// eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-nodejs-modules -- HTTP API is desktop-only and lazy-loads Node http at server start.
				const http = require("http") as HttpModuleLike;
				this.server = http.createServer((req, res) => {
					this.handleRequest(req, res).catch((error) => {
						tasknotesLogger.error("Request handling error:", {
							category: "provider",
							operation: "request-handling",
							error: error,
						});
						this.sendResponse(res, 500, this.errorResponse("Internal server error"));
					});
				});

				this.server.listen(this.plugin.settings.apiPort, API_BIND_HOST, () => {
					resolve();
				});

				this.server.on("error", (err) => {
					tasknotesLogger.error("API server error:", {
						category: "provider",
						operation: "api-server",
						error: err,
					});
					reject(err);
				});
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	async stop(): Promise<void> {
		return new Promise((resolve) => {
			if (this.server) {
				this.server.close(() => {
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	isRunning(): boolean {
		return this.server?.listening === true;
	}

	getPort(): number {
		return this.plugin.settings.apiPort;
	}
}
