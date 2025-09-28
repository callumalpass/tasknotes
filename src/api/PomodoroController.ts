import { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { BaseController } from "./BaseController";
import { MinimalNativeCache } from "../utils/MinimalNativeCache";
import TaskNotesPlugin from "../main";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Get, Post } from "../utils/OpenAPIDecorators";

export class PomodoroController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private cacheManager: MinimalNativeCache
	) {
		super();
	}

	@Post("/api/pomodoro/start")
	async startPomodoro(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const body = await this.parseRequestBody(req);
			let task;

			// Get task if taskId provided
			if (body.taskId) {
				const foundTask = await this.cacheManager.getTaskInfo(body.taskId);
				if (!foundTask) {
					this.sendResponse(res, 404, this.errorResponse("Task not found"));
					return;
				}
				task = foundTask;
			}

			// Check if session is already running
			const currentState = this.plugin.pomodoroService.getState();
			if (currentState.isRunning) {
				this.sendResponse(
					res,
					400,
					this.errorResponse(
						"Pomodoro session is already running. Stop or pause the current session first."
					)
				);
				return;
			}

			// Start pomodoro with optional duration
			const duration = body.duration ? parseInt(body.duration) : undefined;
			await this.plugin.pomodoroService.startPomodoro(task, duration);

			// Get updated state
			const newState = this.plugin.pomodoroService.getState();

			this.sendResponse(
				res,
				200,
				this.successResponse({
					session: newState.currentSession,
					task: task || null,
					message: "Pomodoro session started",
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Post("/api/pomodoro/stop")
	async stopPomodoro(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const currentState = this.plugin.pomodoroService.getState();
			if (!currentState.currentSession) {
				this.sendResponse(
					res,
					400,
					this.errorResponse("No active pomodoro session to stop")
				);
				return;
			}

			await this.plugin.pomodoroService.stopPomodoro();

			this.sendResponse(
				res,
				200,
				this.successResponse({
					message: "Pomodoro session stopped and reset",
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Post("/api/pomodoro/pause")
	async pausePomodoro(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const currentState = this.plugin.pomodoroService.getState();
			if (!currentState.isRunning || !currentState.currentSession) {
				this.sendResponse(
					res,
					400,
					this.errorResponse("No running pomodoro session to pause")
				);
				return;
			}

			await this.plugin.pomodoroService.pausePomodoro();

			const newState = this.plugin.pomodoroService.getState();

			this.sendResponse(
				res,
				200,
				this.successResponse({
					timeRemaining: newState.timeRemaining,
					message: "Pomodoro session paused",
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Post("/api/pomodoro/resume")
	async resumePomodoro(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const currentState = this.plugin.pomodoroService.getState();
			if (currentState.isRunning) {
				this.sendResponse(
					res,
					400,
					this.errorResponse("Pomodoro session is already running")
				);
				return;
			}

			if (!currentState.currentSession) {
				this.sendResponse(res, 400, this.errorResponse("No paused session to resume"));
				return;
			}

			await this.plugin.pomodoroService.resumePomodoro();

			const newState = this.plugin.pomodoroService.getState();

			this.sendResponse(
				res,
				200,
				this.successResponse({
					timeRemaining: newState.timeRemaining,
					message: "Pomodoro session resumed",
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 400, this.errorResponse(error.message));
		}
	}

	@Get("/api/pomodoro/status")
	async getPomodoroStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const state = this.plugin.pomodoroService.getState();

			// Add additional computed fields
			const enhancedState = {
				...state,
				totalPomodoros: await this.plugin.pomodoroService.getPomodorosCompleted(),
				currentStreak: await this.plugin.pomodoroService.getCurrentStreak(),
				totalMinutesToday: await this.plugin.pomodoroService.getTotalMinutesToday(),
			};

			this.sendResponse(res, 200, this.successResponse(enhancedState));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/pomodoro/sessions")
	async getPomodoroSessions(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const parsedUrl = parse(req.url || "", true);
			const query = parsedUrl.query;

			let sessions = await this.plugin.pomodoroService.getSessionHistory();

			// Filter by date if specified
			if (query.date && typeof query.date === "string") {
				const targetDate = query.date;
				sessions = sessions.filter((session) => {
					const sessionDate = new Date(session.startTime).toISOString().split("T")[0];
					return sessionDate === targetDate;
				});
			}

			// Apply limit
			const total = sessions.length;
			if (query.limit && typeof query.limit === "string") {
				const limit = parseInt(query.limit);
				if (limit > 0) {
					sessions = sessions.slice(-limit); // Get most recent sessions
				}
			}

			this.sendResponse(
				res,
				200,
				this.successResponse({
					sessions,
					total,
				})
			);
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}

	@Get("/api/pomodoro/stats")
	async getPomodoroStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
		try {
			const parsedUrl = parse(req.url || "", true);
			const query = parsedUrl.query;

			let stats;
			if (query.date && typeof query.date === "string") {
				const targetDate = new Date(query.date);
				stats = await this.plugin.pomodoroService.getStatsForDate(targetDate);
			} else {
				stats = await this.plugin.pomodoroService.getTodayStats();
			}

			this.sendResponse(res, 200, this.successResponse(stats));
		} catch (error: any) {
			this.sendResponse(res, 500, this.errorResponse(error.message));
		}
	}
}
