import { parseRequestUrl, type HTTPRequestLike, type HTTPResponseLike } from "./httpTypes";
import { BaseController } from "./BaseController";
import { TaskManager } from "../utils/TaskManager";
import TaskNotesPlugin from "../main";
import { PomodoroSessionHistory } from "../types";
 
import { Get, Post } from "../utils/OpenAPIDecorators";

type StartPomodoroRequestBody = {
	taskId?: string;
	duration?: string | number;
};

export class PomodoroController extends BaseController {
	constructor(
		private plugin: TaskNotesPlugin,
		private cacheManager: TaskManager
	) {
		super();
	}

	@Post("/api/pomodoro/start")
	async startPomodoro(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const body = await this.parseRequestBody<StartPomodoroRequestBody>(req);
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
			const duration =
				body.duration !== undefined ? parseInt(String(body.duration), 10) : undefined;
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
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/pomodoro/stop")
	async stopPomodoro(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
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
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/pomodoro/pause")
	async pausePomodoro(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
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
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Post("/api/pomodoro/resume")
	async resumePomodoro(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
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
		} catch (error: unknown) {
			this.sendResponse(res, 400, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/pomodoro/status")
	async getPomodoroStatus(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
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
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/pomodoro/sessions")
	async getPomodoroSessions(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const query = parseRequestUrl(req).searchParams;

			let sessions = await this.plugin.pomodoroService.getSessionHistory();

			// Filter by date if specified
			const dateParam = query.get("date");
			if (dateParam) {
				const targetDate = dateParam;
				sessions = sessions.filter((session: PomodoroSessionHistory) => {
					const sessionDate = new Date(session.startTime).toISOString().split("T")[0];
					return sessionDate === targetDate;
				});
			}

			// Apply limit
			const total = sessions.length;
			const limitParam = query.get("limit");
			if (limitParam) {
				const limit = parseInt(limitParam, 10);
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
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}

	@Get("/api/pomodoro/stats")
	async getPomodoroStats(req: HTTPRequestLike, res: HTTPResponseLike): Promise<void> {
		try {
			const query = parseRequestUrl(req).searchParams;

			let stats;
			const dateParam = query.get("date");
			if (dateParam) {
				const targetDate = new Date(dateParam);
				stats = await this.plugin.pomodoroService.getStatsForDate(targetDate);
			} else {
				stats = await this.plugin.pomodoroService.getTodayStats();
			}

			this.sendResponse(res, 200, this.successResponse(stats));
		} catch (error: unknown) {
			this.sendResponse(res, 500, this.errorResponse(this.getErrorMessage(error)));
		}
	}
}
