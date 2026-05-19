import type { HTTPRequestLike, HTTPResponseLike } from "./httpTypes";
import { BaseController } from "./BaseController";
import { NaturalLanguageParser } from "../services/NaturalLanguageParser";
import { TaskService } from "../services/TaskService";
import TaskNotesPlugin from "../main";
import { buildTaskCreationDataFromParsed } from "../utils/buildTaskCreationDataFromParsed";

import { generateOpenAPISpec, Get, Post } from "../utils/OpenAPIDecorators";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Api/SystemController" });

type VaultAdapterWithPath = {
	basePath?: string;
	path?: string;
};

type OpenAPISpecProvider = {
	generateOpenAPISpec(): unknown;
};

export class SystemController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private taskService: TaskService,
		private nlParser: NaturalLanguageParser,
		private httpAPIService?: OpenAPISpecProvider
	) {
		super();
	}

	@Get("/api/health")
	async healthCheck(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		const vaultName = this.plugin.app.vault.getName();
		const adapter = this.plugin.app.vault.adapter as VaultAdapterWithPath;

		// Try to get vault path information
		let vaultPath = null;
		try {
			// Check if adapter has basePath property (some adapters expose this)
			if ("basePath" in adapter && typeof adapter.basePath === "string") {
				vaultPath = adapter.basePath;
			} else if ("path" in adapter && typeof adapter.path === "string") {
				vaultPath = adapter.path;
			}
		} catch {
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
	async handleNLPParse(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
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

			const taskData = buildTaskCreationDataFromParsed(this.plugin, parsedData);

			this.sendResponse(
				res,
				200,
				this.successResponse({
					parsed: parsedData,
					taskData: taskData,
				})
			);
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/nlp/create")
	async handleNLPCreate(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
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

			const taskData = buildTaskCreationDataFromParsed(this.plugin, parsedData, {
				creationContext: "api",
			});

			// Create the task - TaskService.createTask() applies defaults automatically
			const result = await this.taskService.createTask(taskData);

			this.sendResponse(
				res,
				201,
				this.successResponse({
					task: result.taskInfo,
					parsed: parsedData,
				})
			);
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/docs")
	async handleOpenAPISpec(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
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
		} catch (error: unknown) {
			tasknotesLogger.error("OpenAPI spec generation error:", {
				category: "provider",
				operation: "openapi-spec-generation",
				error: error,
			});
			this.sendResponse(res, 500, this.errorResponse("Failed to generate API specification"));
		}
	}

	@Get("/api/docs/ui")
	async handleSwaggerUI(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const swaggerHTML = this.generateSwaggerUIHTML();

			res.statusCode = 200;
			res.setHeader("Content-Type", "text/html");
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.end(swaggerHTML);
		} catch (error: unknown) {
			tasknotesLogger.error("Swagger UI generation error:", {
				category: "provider",
				operation: "swagger-ui-generation",
				error: error,
			});
			this.sendResponse(res, 500, this.errorResponse("Failed to generate API documentation"));
		}
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
