import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { BaseController } from "./BaseController";
import { IWebhookNotifier } from "../types";
import { TaskService } from "../services/TaskService";
import { TaskManager } from "../utils/TaskManager";
import { StatusManager } from "../services/StatusManager";
import TaskNotesPlugin from "../main";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
		private statusManager: StatusManager,
		private webhookNotifier: IWebhookNotifier
	) {
		super();
	}

	@Post("/api/tasks/:id/time/start")
	async startTimeTracking(
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

			const updatedTask = await this.taskService.startTimeTracking(task);

			// Trigger webhook for time tracking start
			await this.webhookNotifier.triggerWebhook("time.started", {
				task: updatedTask,
				session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1],
			});

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Post("/api/tasks/:id/time/stop")
	async stopTimeTracking(
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

			const updatedTask = await this.taskService.stopTimeTracking(task);

			// Trigger webhook for time tracking stop
			await this.webhookNotifier.triggerWebhook("time.stopped", {
				task: updatedTask,
				session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1],
			});

			this.sendResponse(res, 200, this.successResponse(updatedTask));
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Post("/api/tasks/:id/time/start-with-description")
	async startTimeTrackingWithDescription(
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

			const body = await this.parseRequestBody(req);
			const description = body.description || "";

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

			// Trigger webhook for time tracking start
			await this.webhookNotifier.triggerWebhook("time.started", {
				task: updatedTask,
				session: updatedTask.timeEntries?.[updatedTask.timeEntries.length - 1],
			});

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
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Get("/api/time/active")
	async getActiveTimeSessions(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const allTasks = await this.cacheManager.getAllTasks();
			const result = computeActiveTimeSessions(
				allTasks,
				(task) => this.plugin.getActiveTimeSession(task)
			);
			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/time/summary")
	async getTimeSummary(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const parsedUrl = parse(req.url || "", true);
			const query = parsedUrl.query;

			const allTasks = await this.cacheManager.getAllTasks();
			const period = (query.period as string) || "today";
			const fromDate = query.from ? new Date(query.from as string) : null;
			const toDate = query.to ? new Date(query.to as string) : null;

			const result = computeTimeSummary(
				allTasks,
				{ period, fromDate, toDate, includeTags: true },
				(status) => this.statusManager.isCompletedStatus(status)
			);

			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/tasks/:id/time")
	async getTaskTimeData(
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

			const result = computeTaskTimeData(
				task,
				(t) => this.plugin.getActiveTimeSession(t)
			);
			this.sendResponse(res, 200, this.successResponse(result));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}
}
