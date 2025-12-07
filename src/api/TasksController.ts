import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { BaseController } from "./BaseController";
import { TaskInfo, TaskCreationData, FilterQuery, IWebhookNotifier } from "../types";
import { TaskService } from "../services/TaskService";
import { FilterService } from "../services/FilterService";
import { TaskManager } from "../utils/TaskManager";
import { StatusManager } from "../services/StatusManager";
import TaskNotesPlugin from "../main";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Get, Post, Put, Delete } from "../utils/OpenAPIDecorators";
import { calculateDefaultDate } from "../utils/helpers";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
		private cacheManager: TaskManager,
		private statusManager: StatusManager,
		private webhookNotifier: IWebhookNotifier
	) {
		super();
	}

	@Get("/api/tasks")
	async getTasks(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const parsedUrl = parse(req.url || "", true);
			const params = parsedUrl.query;

			// Check if user is trying to use filtering parameters
			const filterParams = [
				"status",
				"priority",
				"project",
				"tag",
				"overdue",
				"completed",
				"archived",
				"due_before",
				"due_after",
				"sort",
			];
			const hasFilters = filterParams.some((param) => params[param]);

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

			if (params.offset) {
				offset = parseInt(params.offset as string, 10);
				if (isNaN(offset) || offset < 0) {
					offset = 0;
				}
			}

			if (params.limit) {
				limit = parseInt(params.limit as string, 10);
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
			const adapter = this.plugin.app.vault.adapter as any;
			let vaultPath = null;
			try {
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
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Post("/api/tasks")
	async createTask(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const taskData: TaskCreationData = await this.parseRequestBody(req);

			if (!taskData.title || !taskData.title.trim()) {
				this.sendResponse(res, 400, this.errorResponse("Title is required"));
				return;
			}

			// Apply task creation defaults
			await this.applyTaskCreationDefaults(taskData);

			const result = await this.taskService.createTask(taskData);

			// Trigger webhook for task creation
			await this.webhookNotifier.triggerWebhook("task.created", { task: result.taskInfo });

			this.sendResponse(res, 201, this.successResponse(result.taskInfo));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Get("/api/tasks/:id")
	async getTask(
		req: IncomingMessage,
		res: ServerResponse,
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

			this.sendResponse(res, 200, this.successResponse(task));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Put("/api/tasks/:id")
	async updateTask(
		req: IncomingMessage,
		res: ServerResponse,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse("Task ID is required"));
				return;
			}

			const updates = await this.parseRequestBody(req);

			const originalTask = await this.cacheManager.getTaskInfo(taskId);
			if (!originalTask) {
				this.sendResponse(res, 404, this.errorResponse("Task not found"));
				return;
			}

			const updatedTask = await this.taskService.updateTask(originalTask, updates);

			// Trigger webhook for task update
			await this.webhookNotifier.triggerWebhook("task.updated", {
				task: updatedTask,
				previous: originalTask,
			});

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Delete("/api/tasks/:id")
	async deleteTask(
		req: IncomingMessage,
		res: ServerResponse,
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

			// Trigger webhook for task deletion
			await this.webhookNotifier.triggerWebhook("task.deleted", { task });

			this.sendResponse(
				res,
				200,
				this.successResponse({ message: "Task deleted successfully" })
			);
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Post("/api/tasks/:id/toggle-status")
	async toggleStatus(
		req: IncomingMessage,
		res: ServerResponse,
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

			// Trigger webhook for status change (might be completion)
			const wasCompleted = this.statusManager.isCompletedStatus(task.status);
			const isCompleted = this.statusManager.isCompletedStatus(updatedTask.status);

			if (!wasCompleted && isCompleted) {
				await this.webhookNotifier.triggerWebhook("task.completed", { task: updatedTask });
			} else {
				await this.webhookNotifier.triggerWebhook("task.updated", {
					task: updatedTask,
					previous: task,
				});
			}

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Post("/api/tasks/:id/archive")
	async toggleArchive(
		req: IncomingMessage,
		res: ServerResponse,
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

			// Trigger webhook for archive/unarchive
			if (updatedTask.archived) {
				await this.webhookNotifier.triggerWebhook("task.archived", { task: updatedTask });
			} else {
				await this.webhookNotifier.triggerWebhook("task.unarchived", { task: updatedTask });
			}

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Post("/api/tasks/:id/complete-instance")
	async completeRecurringInstance(
		req: IncomingMessage,
		res: ServerResponse,
		params?: Record<string, string>
	): Promise<void> {
		try {
			const taskId = params?.id;
			if (!taskId) {
				this.sendResponse(res, 400, this.errorResponse("Task ID is required"));
				return;
			}

			const { date } = await this.parseRequestBody(req);
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
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Post("/api/tasks/query")
	async queryTasks(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const query = (await this.parseRequestBody(req)) as FilterQuery;
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
					tasks: filteredTasks,
					total: allTasks.length,
					filtered: filteredTasks.length,
					vault: {
						name: this.plugin.app.vault.getName(),
						path: vaultPath,
					},
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Get("/api/filter-options")
	async getFilterOptions(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const filterOptions = await this.filterService.getFilterOptions();
			this.sendResponse(res, 200, this.successResponse(filterOptions));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/stats")
	async getStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const allTasks = await this.cacheManager.getAllTasks();
			const stats = {
				total: allTasks.length,
				completed: allTasks.filter((t) => this.statusManager.isCompletedStatus(t.status))
					.length,
				active: allTasks.filter(
					(t) => !this.statusManager.isCompletedStatus(t.status) && !t.archived
				).length,
				overdue: allTasks.filter((t) => {
					if (this.statusManager.isCompletedStatus(t.status) || t.archived) return false;
					return t.due && new Date(t.due) < new Date();
				}).length,
				archived: allTasks.filter((t) => t.archived).length,
				withTimeTracking: allTasks.filter((t) => t.timeEntries && t.timeEntries.length > 0)
					.length,
			};

			this.sendResponse(res, 200, this.successResponse(stats));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	private async applyTaskCreationDefaults(taskData: TaskCreationData): Promise<void> {
		const defaults = this.plugin.settings.taskCreationDefaults;

		// Apply default scheduled date if not provided
		if (!taskData.scheduled && defaults.defaultScheduledDate !== "none") {
			taskData.scheduled = calculateDefaultDate(defaults.defaultScheduledDate);
		}

		// Apply default due date if not provided
		if (!taskData.due && defaults.defaultDueDate !== "none") {
			taskData.due = calculateDefaultDate(defaults.defaultDueDate);
		}

		// Apply default contexts if not provided
		if (!taskData.contexts && defaults.defaultContexts) {
			taskData.contexts = defaults.defaultContexts
				.split(",")
				.map((c) => c.trim())
				.filter((c) => c);
		}

		// Apply default projects if not provided
		if (!taskData.projects && defaults.defaultProjects) {
			taskData.projects = defaults.defaultProjects
				.split(",")
				.map((p) => p.trim())
				.filter((p) => p);
		}

		// Apply default time estimate if not provided
		if (!taskData.timeEstimate && defaults.defaultTimeEstimate > 0) {
			taskData.timeEstimate = defaults.defaultTimeEstimate;
		}

		// Apply default tags if not provided
		if (!taskData.tags && defaults.defaultTags) {
			taskData.tags = defaults.defaultTags
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t);
		}

		// Apply default recurrence if not provided
		if (
			!taskData.recurrence &&
			defaults.defaultRecurrence &&
			defaults.defaultRecurrence !== "none"
		) {
			// Convert default recurrence frequency to rrule string
			const freqMap: Record<string, string> = {
				daily: "FREQ=DAILY",
				weekly: "FREQ=WEEKLY",
				monthly: "FREQ=MONTHLY",
				yearly: "FREQ=YEARLY",
			};
			taskData.recurrence = freqMap[defaults.defaultRecurrence] || undefined;
		}

		// Apply default reminders if not provided
		if (
			!taskData.reminders &&
			defaults.defaultReminders &&
			defaults.defaultReminders.length > 0
		) {
			const { convertDefaultRemindersToReminders } = await import("../utils/settingsUtils");
			taskData.reminders = convertDefaultRemindersToReminders(defaults.defaultReminders);
		}

		// Apply default values for user-defined fields
		if (this.plugin.settings.userFields) {
			if (!taskData.customFrontmatter) {
				taskData.customFrontmatter = {};
			}
			for (const field of this.plugin.settings.userFields) {
				// Only apply default if the field isn't already set
				if (field.defaultValue !== undefined && taskData.customFrontmatter[field.key] === undefined) {
					// For date fields, convert preset values (today, tomorrow, next-week) to actual dates
					if (field.type === "date" && typeof field.defaultValue === "string") {
						const calculatedDate = calculateDefaultDate(
							field.defaultValue as "none" | "today" | "tomorrow" | "next-week"
						);
						if (calculatedDate) {
							taskData.customFrontmatter[field.key] = calculatedDate;
						}
					} else {
						taskData.customFrontmatter[field.key] = field.defaultValue;
					}
				}
			}
		}
	}
}
