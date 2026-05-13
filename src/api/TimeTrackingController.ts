import { parseRequestUrl, type HTTPRequestLike, type HTTPResponseLike } from "./httpTypes";
import { BaseController } from "./BaseController";
import { TaskService } from "../services/TaskService";
import { TaskManager } from "../utils/TaskManager";
import { StatusManager } from "../services/StatusManager";
import TaskNotesPlugin from "../main";
 
import { Get, Post } from "../utils/OpenAPIDecorators";
import {
	computeActiveTimeSessions,
	computeTimeSummary,
	computeTaskTimeData,
} from "../utils/timeTrackingUtils";

export class TimeTrackingController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private taskService: TaskService,
		private cacheManager: TaskManager,
		private statusManager: StatusManager
	) {
		super();
	}

	@Post("/api/tasks/:id/time/start")
	async startTimeTracking(
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

			const updatedTask = await this.taskService.startTimeTracking(task);

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/tasks/:id/time/stop")
	async stopTimeTracking(
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

			const updatedTask = await this.taskService.stopTimeTracking(task);

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/tasks/:id/time/start-with-description")
	async startTimeTrackingWithDescription(
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

			const body = await this.parseRequestBody<{ description?: string }>(req);
			const description = body.description ?? "";

			// Start time tracking using the existing service method
			let updatedTask = await this.taskService.startTimeTracking(task);

			// If description was provided, update the latest time entry
			if (description && updatedTask.timeEntries && updatedTask.timeEntries.length > 0) {
				const latestEntry = updatedTask.timeEntries[updatedTask.timeEntries.length - 1];
				if (latestEntry && !latestEntry.endTime) {
					latestEntry.description = description;
					// Save the updated task
					updatedTask = await this.taskService.updateTask(updatedTask, {
						timeEntries: updatedTask.timeEntries,
					});
				}
			}

			this.sendResponse(
				res,
				200,
				this.successResponse({
					task: updatedTask,
					message: description
						? `Time tracking started with description: ${description}`
						: "Time tracking started",
				})
			);
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/time/active")
	async getActiveTimeSessions(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const allTasks = await this.cacheManager.getAllTasks();
			const result = computeActiveTimeSessions(
				allTasks,
				(task) => this.plugin.getActiveTimeSession(task)
			);
			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/time/summary")
	async getTimeSummary(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const query = parseRequestUrl(req).searchParams;

			const allTasks = await this.cacheManager.getAllTasks();
			const period = query.get("period") || "today";
			const from = query.get("from");
			const to = query.get("to");
			const fromDate = from ? new Date(from) : null;
			const toDate = to ? new Date(to) : null;

			const result = computeTimeSummary(
				allTasks,
				{ period, fromDate, toDate, includeTags: true },
				(status) => this.statusManager.isCompletedStatus(status)
			);

			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/tasks/:id/time")
	async getTaskTimeData(
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

			const result = computeTaskTimeData(
				task,
				(t) => this.plugin.getActiveTimeSession(t)
			);
			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}
}
