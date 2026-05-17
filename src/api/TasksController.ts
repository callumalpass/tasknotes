import { parseRequestUrl, type HTTPRequestLike, type HTTPResponseLike } from "./httpTypes";
import { BaseController } from "./BaseController";
import { TaskInfo, TaskCreationData, FilterQuery } from "../types";
import { TaskService } from "../services/TaskService";
import { FilterService } from "../services/FilterService";
import { TaskManager } from "../utils/TaskManager";
import { TaskStatsService } from "../services/TaskStatsService";
import TaskNotesPlugin from "../main";
import { hydrateTaskDetailsFromFile } from "../utils/taskDetails";

import { Get, Post, Put, Delete, OpenAPI } from "../utils/OpenAPIDecorators";

type VaultAdapterWithPath = {
	basePath?: string;
	path?: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Decorator metadata keeps route parameters aligned with controller signatures.
interface TaskQueryParams {
	status?: string;
	priority?: string;
	project?: string;
	context?: string;
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
		private cacheManager: TaskManager,
		private taskStatsService: TaskStatsService
	) {
		super();
	}

	@Get("/api/tasks")
	async getTasks(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const params = parseRequestUrl(req).searchParams;

			// Check if user is trying to use filtering parameters
			const filterParams = [
				"status",
				"priority",
				"project",
				"context",
				"tag",
				"overdue",
				"completed",
				"archived",
				"due_before",
				"due_after",
				"sort",
			];
			const hasFilters = filterParams.some((param) => params.has(param));

			if (hasFilters) {
				// Recommend using the more powerful query endpoint
				this.sendResponse(
					res,
					400,
					this.errorResponse(
						"For filtering tasks, please use POST /api/tasks/query which supports advanced filtering capabilities. " +
							"GET /api/tasks is for basic listing only. See API documentation for details."
					)
				);
				return;
			}

			const allTasks = await this.cacheManager.getAllTasks();

			// Basic pagination only
			let offset = 0;
			let limit = 50; // Reduced default for basic listing

			const offsetParam = params.get("offset");
			if (offsetParam) {
				offset = parseInt(offsetParam, 10);
				if (isNaN(offset) || offset < 0) {
					offset = 0;
				}
			}

			const limitParam = params.get("limit");
			if (limitParam) {
				limit = parseInt(limitParam, 10);
				if (isNaN(limit) || limit < 1) {
					limit = 50;
				}
				// Cap the limit
				if (limit > 200) {
					limit = 200;
				}
			}

			const paginatedTasks = allTasks.slice(offset, offset + limit);

			// Get vault information
			const adapter = this.plugin.app.vault.adapter as VaultAdapterWithPath;
			let vaultPath = null;
			try {
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
					tasks: paginatedTasks,
					pagination: {
						total: allTasks.length,
						offset,
						limit,
						hasMore: offset + limit < allTasks.length,
					},
					vault: {
						name: this.plugin.app.vault.getName(),
						path: vaultPath,
					},
					note: "For filtering and advanced queries, use POST /api/tasks/query",
				})
			);
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/tasks")
	async createTask(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const taskData = await this.parseRequestBody<TaskCreationData>(req);

			if (!taskData.title || !taskData.title.trim()) {
				this.sendResponse(res, 400, this.errorResponse("Title is required"));
				return;
			}

			// TaskService.createTask() applies defaults automatically
			const result = await this.taskService.createTask(taskData);

			this.sendResponse(res, 201, this.successResponse(result.taskInfo));
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/tasks/:id")
	async getTask(
		req: HTTPRequestLike,
		res: HTTPResponseLike,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse("Task ID is required"));
				return;
			}

			const task = await this.cacheManager.getTaskInfo(taskId);

			if (!task) {
				this.sendResponse(res, 404, this.errorResponse("Task not found"));
				return;
			}

			const taskWithDetails = await hydrateTaskDetailsFromFile(this.plugin.app, task);

			this.sendResponse(res, 200, this.successResponse(taskWithDetails));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Put("/api/tasks/:id")
	async updateTask(
		req: HTTPRequestLike,
		res: HTTPResponseLike,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse("Task ID is required"));
				return;
			}

			const updates = await this.parseRequestBody<Partial<TaskInfo> & { details?: string }>(
				req
			);

			const originalTask = await this.cacheManager.getTaskInfo(taskId);
			if (!originalTask) {
				this.sendResponse(res, 404, this.errorResponse("Task not found"));
				return;
			}

			const updatedTask = await this.taskService.updateTask(originalTask, updates);

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Delete("/api/tasks/:id")
	async deleteTask(
		req: HTTPRequestLike,
		res: HTTPResponseLike,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse("Task ID is required"));
				return;
			}

			const task = await this.cacheManager.getTaskInfo(taskId);

			if (!task) {
				this.sendResponse(res, 404, this.errorResponse("Task not found"));
				return;
			}

			await this.taskService.deleteTask(task);

			this.sendResponse(
				res,
				200,
				this.successResponse({ message: "Task deleted successfully" })
			);
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/tasks/:id/toggle-status")
	async toggleStatus(
		req: HTTPRequestLike,
		res: HTTPResponseLike,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse("Task ID is required"));
				return;
			}

			const task = await this.cacheManager.getTaskInfo(taskId);

			if (!task) {
				this.sendResponse(res, 404, this.errorResponse("Task not found"));
				return;
			}

			const updatedTask = await this.taskService.toggleStatus(task);

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/tasks/:id/archive")
	async toggleArchive(
		req: HTTPRequestLike,
		res: HTTPResponseLike,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse("Task ID is required"));
				return;
			}

			const task = await this.cacheManager.getTaskInfo(taskId);

			if (!task) {
				this.sendResponse(res, 404, this.errorResponse("Task not found"));
				return;
			}

			const updatedTask = await this.taskService.toggleArchive(task);

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/tasks/:id/complete-instance")
	async completeRecurringInstance(
		req: HTTPRequestLike,
		res: HTTPResponseLike,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse("Task ID is required"));
				return;
			}

			const { date } = await this.parseRequestBody<{ date?: string }>(req);
			const task = await this.cacheManager.getTaskInfo(taskId);

			if (!task) {
				this.sendResponse(res, 404, this.errorResponse("Task not found"));
				return;
			}

			const instanceDate = date ? new Date(date) : undefined;
			const updatedTask = await this.taskService.toggleRecurringTaskComplete(
				task,
				instanceDate
			);
			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@OpenAPI({
		summary: "Query tasks",
		description: "Filter, sort, and group tasks with a TaskNotes FilterQuery payload.",
		operationId: "queryTasks",
		tags: ["Tasks"],
		requestBody: {
			required: true,
			content: {
				"application/json": {
					schema: {
						$ref: "#/components/schemas/FilterQuery",
					},
					example: {
						type: "group",
						id: "root",
						conjunction: "and",
						children: [
							{
								type: "condition",
								id: "context",
								property: "contexts",
								operator: "contains",
								value: "@office",
							},
						],
						sortKey: "due",
						sortDirection: "asc",
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Tasks matching the query",
				content: {
					"application/json": {
						schema: {
							$ref: "#/components/schemas/APIResponse",
						},
					},
				},
			},
			"400": {
				description: "Invalid query payload",
				content: {
					"application/json": {
						schema: {
							$ref: "#/components/schemas/Error",
						},
					},
				},
			},
		},
	})
	@Post("/api/tasks/query")
	async queryTasks(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const query = await this.parseRequestBody<FilterQuery>(req);
			const filteredTasksMap = await this.filterService.getGroupedTasks(query);

			// Flatten grouped results into a single array
			const filteredTasks: TaskInfo[] = [];
			for (const taskGroup of filteredTasksMap.values()) {
				filteredTasks.push(...taskGroup);
			}

			const allTasks = await this.cacheManager.getAllTasks();
			// Get vault information
			const adapter = this.plugin.app.vault.adapter as VaultAdapterWithPath;
			let vaultPath = null;
			try {
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
					tasks: filteredTasks,
					total: allTasks.length,
					filtered: filteredTasks.length,
					vault: {
						name: this.plugin.app.vault.getName(),
						path: vaultPath,
					},
				})
			);
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/filter-options")
	async getFilterOptions(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const filterOptions = await this.filterService.getFilterOptions();
			this.sendResponse(res, 200, this.successResponse(filterOptions));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/stats")
	async getStats(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const allTasks = await this.cacheManager.getAllTasks();
			const fullStats = this.taskStatsService.getStats(allTasks);

			const stats = {
				total: fullStats.total,
				completed: fullStats.completed,
				active: fullStats.active,
				overdue: fullStats.overdue,
				archived: fullStats.archived,
				withTimeTracking: fullStats.withTimeEntries,
			};

			this.sendResponse(res, 200, this.successResponse(stats));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}
}
