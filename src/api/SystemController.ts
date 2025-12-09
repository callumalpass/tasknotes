import { IncomingMessage, ServerResponse } from "http";
import { BaseController } from "./BaseController";
import { NaturalLanguageParser } from "../services/NaturalLanguageParser";
import { TaskCreationData, IWebhookNotifier } from "../types";
import { TaskService } from "../services/TaskService";
import TaskNotesPlugin from "../main";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { generateOpenAPISpec, Get, Post } from "../utils/OpenAPIDecorators";

export class SystemController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private taskService: TaskService,
		private nlParser: NaturalLanguageParser,
		private webhookNotifier: IWebhookNotifier,
		private httpAPIService?: any
	) {
		super();
	}

	@Get("/api/health")
	async healthCheck(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const vaultName = this.plugin.app.vault.getName();
		const adapter = this.plugin.app.vault.adapter as any;

		// Try to get vault path information
		let vaultPath = null;
		try {
			// Check if adapter has basePath property (some adapters expose this)
			if ("basePath" in adapter && typeof adapter.basePath === "string") {
				vaultPath = adapter.basePath;
			} else if ("path" in adapter && typeof adapter.path === "string") {
				vaultPath = adapter.path;
			}
		} catch (error) {
			// Silently fail if vault path isn't accessible
		}

		this.sendResponse(
			res,
			200,
			this.successResponse({
				status: "ok",
				timestamp: new Date().toISOString(),
				vault: {
					name: vaultName,
					path: vaultPath,
				},
			})
		);
	}

	@Post("/api/nlp/parse")
	async handleNLPParse(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const body = await this.parseRequestBody(req);

			if (!body.text || typeof body.text !== "string") {
				this.sendResponse(
					res,
					400,
					this.errorResponse("Text field is required and must be a string")
				);
				return;
			}

			// Parse the natural language input
			const parsedData = this.nlParser.parseInput(body.text);

			// Convert ParsedTaskData to TaskCreationData format
			const taskData: TaskCreationData = {
				title: parsedData.title,
				details: parsedData.details,
				priority: parsedData.priority,
				status: parsedData.status || this.getDefaultStatus(),
				tags: parsedData.tags,
				contexts: parsedData.contexts,
				projects: parsedData.projects,
				recurrence: parsedData.recurrence,
				timeEstimate: parsedData.estimate,
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

			this.sendResponse(
				res,
				200,
				this.successResponse({
					parsed: parsedData,
					taskData: taskData,
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Post("/api/nlp/create")
	async handleNLPCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const body = await this.parseRequestBody(req);

			if (!body.text || typeof body.text !== "string") {
				this.sendResponse(
					res,
					400,
					this.errorResponse("Text field is required and must be a string")
				);
				return;
			}

			// Parse the natural language input
			const parsedData = this.nlParser.parseInput(body.text);

			// Convert ParsedTaskData to TaskCreationData format
			const taskData: TaskCreationData = {
				title: parsedData.title,
				details: parsedData.details,
				priority: parsedData.priority,
				status: parsedData.status || this.getDefaultStatus(),
				tags: parsedData.tags,
				contexts: parsedData.contexts,
				projects: parsedData.projects,
				recurrence: parsedData.recurrence,
				timeEstimate: parsedData.estimate,
				creationContext: "api",
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

			// Create the task - TaskService.createTask() applies defaults automatically
			const result = await this.taskService.createTask(taskData);

			// Trigger webhook for task creation via NLP
			await this.webhookNotifier.triggerWebhook("task.created", {
				task: result.taskInfo,
				source: "nlp",
				originalText: body.text,
			});

			this.sendResponse(
				res,
				201,
				this.successResponse({
					task: result.taskInfo,
					parsed: parsedData,
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Get("/api/docs")
	async handleOpenAPISpec(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			// Use HTTPAPIService's method to get spec from all controllers
			const spec =
				this.httpAPIService && this.httpAPIService.generateOpenAPISpec
					? this.httpAPIService.generateOpenAPISpec()
					: generateOpenAPISpec(this);

			res.statusCode = 200;
			res.setHeader("Content-Type", "application/json");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.end(JSON.stringify(spec, null, 2));
		} catch (error: any) {
			console.error("OpenAPI spec generation error:", error);
			this.sendResponse(res, 500, this.errorResponse("Failed to generate API specification"));
		}
	}

	@Get("/api/docs/ui")
	async handleSwaggerUI(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const swaggerHTML = this.generateSwaggerUIHTML();

			res.statusCode = 200;
			res.setHeader("Content-Type", "text/html");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.end(swaggerHTML);
		} catch (error: any) {
			console.error("Swagger UI generation error:", error);
			this.sendResponse(res, 500, this.errorResponse("Failed to generate API documentation"));
		}
	}

	private getDefaultStatus(): string {
		// Get the first status (lowest order) as default, same logic as TaskModal
		const statusConfigs = this.plugin.settings.customStatuses;
		if (statusConfigs && statusConfigs.length > 0) {
			const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);
			return sortedStatuses[0].value;
		}
		return "open"; // fallback
	}

	private generateSwaggerUIHTML(): string {
		const port = this.plugin.settings.apiPort;

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>TaskNotes API Documentation</title>
	<link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
	<style>
		body { margin: 0; }
		.swagger-ui .topbar { display: none; }
		.swagger-ui .info .title { color: #663399; }
	</style>
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
	<script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
	<script>
		SwaggerUIBundle({
			url: 'http://localhost:${port}/api/docs',
			dom_id: '#swagger-ui',
			deepLinking: true,
			presets: [
				SwaggerUIBundle.presets.apis,
				SwaggerUIStandalonePreset
			],
			plugins: [
				SwaggerUIBundle.plugins.DownloadUrl
			],
			layout: "StandaloneLayout",
			tryItOutEnabled: true,
			displayRequestDuration: true,
			docExpansion: 'list',
			filter: true,
			validatorUrl: null
		});
	</script>
</body>
</html>`;
	}
}
