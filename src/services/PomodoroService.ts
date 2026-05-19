/* eslint-disable @typescript-eslint/no-non-null-assertion -- Pomodoro state transitions guard active sessions before dereferencing. */
import { Notice, TFile, moment as obsidianMoment } from "obsidian";
import TaskNotesPlugin from "../main";
import {
	createDailyNote,
	getDailyNote,
	getAllDailyNotes,
	appHasDailyNotesPluginLoaded,
} from "obsidian-daily-notes-interface";
import {
	PomodoroSession,
	PomodoroState,
	PomodoroSessionHistory,
	PomodoroHistoryStats,
	EVENT_POMODORO_START,
	EVENT_POMODORO_COMPLETE,
	EVENT_POMODORO_INTERRUPT,
	EVENT_POMODORO_TICK,
	TaskInfo,
	IWebhookNotifier,
} from "../types";
import type { InterpolationValues, TranslationKey } from "../i18n";
import {
	getCurrentTimestamp,
	formatDateForStorage,
	getTodayLocal,
	parseDateToLocal,
	createUTCDateFromLocalCalendarDate,
} from "../utils/dateUtils";
import {
	calculatePomodoroStats,
	filterPomodoroSessionsByDateKey,
	filterPomodoroSessionsByDateRange,
	getPomodoroDateKeysInRange,
	getPomodoroSessionDateKey,
	sortPomodoroSessions,
} from "../utils/pomodoroStats";
import { shouldPersistLastSelectedTask, shouldPersistPomodoroState } from "./pomodoroPersistence";
import { PomodoroTicker } from "./PomodoroTicker";
import {
	clampPomodoroDurationSeconds,
	formatLocalTimestamp,
	getActiveElapsedSeconds,
	getSessionCompletionTimeMs,
	getSessionRemainingSeconds,
} from "../utils/pomodoroTime";
import { isTaskInstanceCompleted } from "../utils/taskInstanceStatus";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/PomodoroService" });

type DailyNoteMoment = Parameters<typeof getDailyNote>[0];

function getDailyNoteMoment(date: Date): DailyNoteMoment {
	return (obsidianMoment as unknown as (input: Date) => DailyNoteMoment)(date);
}

function isPomodoroSessionHistory(value: unknown): value is PomodoroSessionHistory {
	return (
		value !== null &&
		typeof value === "object" &&
		typeof (value as { id?: unknown }).id === "string"
	);
}

export class PomodoroService {
	private plugin: TaskNotesPlugin;
	private ticker: PomodoroTicker | null = null;
	private state: PomodoroState;
	private activeAudioContexts: Set<AudioContext> = new Set();
	private cleanupTimeouts: Set<number> = new Set();
	private webhookNotifier?: IWebhookNotifier;
	private lastSelectedTaskPath?: string;
	private lastSelectedTaskPathLoaded = false;
	private lastWorkSessionTaskPath?: string;
	private completionInProgress = false;
	private taskFileRenameUnsubscribe?: () => void;

	private translate(key: TranslationKey, variables?: InterpolationValues): string {
		return this.plugin.i18n.translate(key, variables);
	}

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
		this.state = {
			isRunning: false,
			timeRemaining: plugin.settings.pomodoroWorkDuration * 60, // Default work duration in seconds
		};
	}

	async initialize() {
		await this.loadState();
		this.setupTicker();
		this.subscribeToTaskFileRenames();

		if (this.state.isRunning && this.state.currentSession) {
			this.resumeTimer();
		}
	}

	private subscribeToTaskFileRenames(): void {
		if (this.taskFileRenameUnsubscribe) return;

		this.taskFileRenameUnsubscribe = this.plugin.cacheManager.subscribe(
			"file-renamed",
			(event: unknown) => {
				if (!event || typeof event !== "object") return;
				const { oldPath, newPath } = event as {
					oldPath?: unknown;
					newPath?: unknown;
				};
				if (typeof oldPath !== "string" || typeof newPath !== "string") return;
				void this.handleTaskFileRenamed(oldPath, newPath);
			}
		);
	}

	private async handleTaskFileRenamed(oldPath: string, newPath: string): Promise<void> {
		if (!oldPath || !newPath || oldPath === newPath) return;

		let stateChanged = false;
		let lastSelectedChanged = false;

		if (this.state.currentSession?.taskPath === oldPath) {
			this.state.currentSession.taskPath = newPath;
			stateChanged = true;
		}

		if (this.lastWorkSessionTaskPath === oldPath) {
			this.lastWorkSessionTaskPath = newPath;
		}

		if (this.lastSelectedTaskPath === oldPath) {
			this.lastSelectedTaskPath = newPath;
			this.lastSelectedTaskPathLoaded = true;
			lastSelectedChanged = true;
		}

		try {
			const data = (await this.plugin.loadData()) || {};
			let shouldSaveData = false;

			if (stateChanged) {
				data.pomodoroState = this.state;
				data.lastPomodoroDate = formatDateForStorage(getTodayLocal());
				shouldSaveData = true;
			}

			if (lastSelectedChanged || data.lastSelectedTaskPath === oldPath) {
				this.lastSelectedTaskPath = newPath;
				this.lastSelectedTaskPathLoaded = true;
				data.lastSelectedTaskPath = newPath;
				shouldSaveData = true;
			}

			if (shouldSaveData) {
				await this.plugin.saveData(data);
			}
		} catch (error) {
			tasknotesLogger.error("Failed to persist Pomodoro task path after file rename:", {
				category: "persistence",
				operation: "persist-pomodoro-task-path-file-rename",
				error: error,
			});
		}

		if (stateChanged) {
			this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
				timeRemaining: this.state.timeRemaining,
				session: this.state.currentSession,
			});
		}
	}

	/**
	 * Set webhook notifier for triggering webhook events
	 */
	setWebhookNotifier(notifier: IWebhookNotifier): void {
		this.webhookNotifier = notifier;
	}

	private setupTicker() {
		this.ticker?.destroy();
		this.ticker = new PomodoroTicker(() => this.handleTimerTick());
	}

	private handleTimerTick(): void {
		if (!this.state.isRunning || !this.state.currentSession) {
			return;
		}

		const timeRemaining = this.syncRunningTimeRemaining();
		if (timeRemaining <= 0 && !this.completionInProgress) {
			this.completionInProgress = true;
			void this.completePomodoro().finally(() => {
				this.completionInProgress = false;
			});
		}
	}

	async loadState() {
		try {
			const data = await this.plugin.loadData();

			if (data?.pomodoroState) {
				this.state = data.pomodoroState;

				// Validate loaded state
				this.state.timeRemaining = Math.max(0, this.state.timeRemaining || 0);

				// Clear any stale session from previous day
				const today = formatDateForStorage(getTodayLocal());
				const lastDate = data.lastPomodoroDate;
				if (lastDate !== today) {
					if (this.state.currentSession) {
						this.state.currentSession = undefined;
						this.state.isRunning = false;
						this.state.nextSessionType = undefined;
					}
				}

				// Validate current session
				if (this.state.currentSession) {
					// Check if session is stale (older than 24 hours)
					const sessionStart = new Date(this.state.currentSession.startTime).getTime();
					const now = Date.now();
					const hoursSinceStart = (now - sessionStart) / (1000 * 60 * 60);

					if (hoursSinceStart > 24) {
						// Session is too old, clear it
						this.state.currentSession = undefined;
						this.state.isRunning = false;
						this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
						this.state.nextSessionType = undefined;
					}
				}

				// If no active session, reset timer to default duration
				if (!this.state.currentSession) {
					this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
					this.state.nextSessionType = undefined;
				}
			}
		} catch (error) {
			tasknotesLogger.error("Failed to load pomodoro state:", {
				category: "persistence",
				operation: "load-pomodoro-state",
				error: error,
			});
			// Reset to clean state on error
			this.state = {
				isRunning: false,
				timeRemaining: this.plugin.settings.pomodoroWorkDuration * 60,
			};
		}
	}

	async saveState() {
		try {
			const data = (await this.plugin.loadData()) || {};
			const today = formatDateForStorage(getTodayLocal());
			if (!shouldPersistPomodoroState(data, this.state, today)) {
				return;
			}
			data.pomodoroState = this.state;
			data.lastPomodoroDate = today;
			await this.plugin.saveData(data);
		} catch (error) {
			tasknotesLogger.error("Failed to save pomodoro state:", {
				category: "persistence",
				operation: "save-pomodoro-state",
				error: error,
			});
		}
	}

	async saveLastSelectedTask(taskPath: string | undefined) {
		this.lastSelectedTaskPath = taskPath;
		this.lastSelectedTaskPathLoaded = true;
		try {
			const data = (await this.plugin.loadData()) || {};
			if (!shouldPersistLastSelectedTask(data, taskPath)) {
				return;
			}
			if (taskPath === undefined) {
				delete data.lastSelectedTaskPath;
			} else {
				data.lastSelectedTaskPath = taskPath;
			}
			await this.plugin.saveData(data);
		} catch (error) {
			tasknotesLogger.error("Failed to save last selected task:", {
				category: "persistence",
				operation: "save-last-selected-task",
				error: error,
			});
		}
	}

	async getLastSelectedTaskPath(): Promise<string | undefined> {
		if (this.lastSelectedTaskPathLoaded) {
			return this.lastSelectedTaskPath;
		}
		try {
			const data = await this.plugin.loadData();
			const path = data?.lastSelectedTaskPath;
			if (typeof path === "string" && path.trim().length > 0) {
				this.lastSelectedTaskPath = path;
			} else {
				this.lastSelectedTaskPath = undefined;
			}
			this.lastSelectedTaskPathLoaded = true;
			return this.lastSelectedTaskPath;
		} catch (error) {
			tasknotesLogger.error("Failed to load last selected task:", {
				category: "persistence",
				operation: "load-last-selected-task",
				error: error,
			});
			return undefined;
		}
	}

	async startPomodoro(task?: TaskInfo, durationMinutes?: number) {
		if (this.state.isRunning) {
			new Notice(this.translate("services.pomodoro.notices.alreadyRunning"));
			return;
		}

		// Check if there's a paused session that should be resumed instead
		if (this.state.currentSession && !this.state.isRunning) {
			new Notice(this.translate("services.pomodoro.notices.resumeCurrentSession"));
			return;
		}

		// Use custom duration if provided, otherwise use the prepared work timer.
		// If a break is prepared and the user skips it, start a normal work session.
		const preparedWorkDurationSeconds =
			this.state.nextSessionType === "short-break" ||
			this.state.nextSessionType === "long-break"
				? this.plugin.settings.pomodoroWorkDuration * 60
				: this.state.timeRemaining;
		const customDurationSeconds =
			durationMinutes !== undefined ? durationMinutes * 60 : undefined;
		const durationSeconds = clampPomodoroDurationSeconds(
			customDurationSeconds ?? preparedWorkDurationSeconds
		);

		// Convert to minutes for planned duration
		const plannedDurationMinutes = durationSeconds / 60;

		const sessionStartTime = getCurrentTimestamp();

		const session: PomodoroSession = {
			id: Date.now().toString(),
			taskPath: task?.path,
			startTime: sessionStartTime,
			plannedDuration: plannedDurationMinutes,
			type: "work",
			completed: false,
			activePeriods: [
				{
					startTime: sessionStartTime,
					// endTime will be set when paused or completed
				},
			],
		};

		if (task?.path) {
			this.lastWorkSessionTaskPath = task.path;
			this.lastSelectedTaskPath = task.path;
			this.lastSelectedTaskPathLoaded = true;
		}

		this.state.currentSession = session;
		this.state.isRunning = true;
		this.state.timeRemaining = durationSeconds;

		// Clear next session type since we're starting a session
		this.state.nextSessionType = undefined;

		// Save state before starting the timer
		await this.saveState();

		this.startTimer();

		// Start time tracking on the task if applicable
		if (task) {
			try {
				await this.plugin.taskService.startTimeTracking(task);
			} catch (error) {
				// If time tracking is already active, that's fine for Pomodoro
				if (!error.message?.includes("Time tracking is already active")) {
					tasknotesLogger.error("Failed to start time tracking for Pomodoro:", {
						category: "internal",
						operation: "start-time-tracking-pomodoro",
						error: error,
					});
				}
			}
		}

		// Notify the user and trigger event
		this.plugin.emitter.trigger(EVENT_POMODORO_START, { session, task });

		// Trigger webhook for pomodoro start
		if (this.webhookNotifier) {
			try {
				await this.webhookNotifier.triggerWebhook("pomodoro.started", { session, task });
			} catch (error) {
				tasknotesLogger.warn("Failed to trigger webhook for pomodoro start:", {
					category: "provider",
					operation: "trigger-webhook-pomodoro-start",
					error: error,
				});
			}
		}

		this.showPomodoroNotification(`Pomodoro started${task ? ` for: ${task.title}` : ""}`);
	}

	async startBreak(isLongBreak = false) {
		if (this.state.isRunning) {
			new Notice(this.translate("services.pomodoro.notices.timerAlreadyRunning"));
			return;
		}

		// Check if there's a paused session
		if (this.state.currentSession && !this.state.isRunning) {
			new Notice(this.translate("services.pomodoro.notices.resumeSessionInstead"));
			return;
		}

		// Validate duration settings
		const duration = isLongBreak
			? Math.max(1, Math.min(60, this.plugin.settings.pomodoroLongBreakDuration))
			: Math.max(1, Math.min(30, this.plugin.settings.pomodoroShortBreakDuration));

		const sessionStartTime = getCurrentTimestamp();
		const session: PomodoroSession = {
			id: Date.now().toString(),
			startTime: sessionStartTime,
			plannedDuration: duration,
			type: isLongBreak ? "long-break" : "short-break",
			completed: false,
			activePeriods: [
				{
					startTime: sessionStartTime,
					// endTime will be set when paused or completed
				},
			],
		};

		this.state.currentSession = session;
		this.state.isRunning = true;
		this.state.timeRemaining = session.plannedDuration * 60;
		this.state.nextSessionType = undefined; // Clear next session type since we're starting a session

		await this.saveState();
		this.startTimer();

		new Notice(
			this.translate(
				isLongBreak
					? "services.pomodoro.notices.longBreakStarted"
					: "services.pomodoro.notices.shortBreakStarted"
			)
		);
	}

	async pausePomodoro() {
		if (!this.state.isRunning) {
			return;
		}

		this.syncRunningTimeRemaining();
		this.stopTimer();
		this.state.isRunning = false;
		const pausedAt = getCurrentTimestamp();

		// End the current active period
		if (this.state.currentSession && this.state.currentSession.activePeriods.length > 0) {
			const currentPeriod =
				this.state.currentSession.activePeriods[
					this.state.currentSession.activePeriods.length - 1
				];
			if (!currentPeriod.endTime) {
				currentPeriod.endTime = pausedAt;
			}
		}

		// Stop time tracking on the task if applicable
		if (this.state.currentSession && this.state.currentSession.taskPath) {
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(
					this.state.currentSession.taskPath
				);
				if (task) {
					await this.plugin.taskService.stopTimeTracking(task);
				}
			} catch (error) {
				tasknotesLogger.error("Failed to stop time tracking for Pomodoro pause:", {
					category: "internal",
					operation: "stop-time-tracking-pomodoro-pause",
					error: error,
				});
			}
		}

		await this.saveState();

		// Emit event to update UI
		this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
			timeRemaining: this.state.timeRemaining,
			session: this.state.currentSession,
		});

		new Notice(this.translate("services.pomodoro.notices.paused"));
	}

	async resumePomodoro() {
		if (this.state.isRunning || !this.state.currentSession) {
			return;
		}

		this.state.isRunning = true;

		// Start a new active period
		if (this.state.currentSession) {
			this.state.currentSession.activePeriods.push({
				startTime: getCurrentTimestamp(),
				// endTime will be set when paused or completed
			});
		}

		await this.saveState();
		this.startTimer();

		// Start a new time tracking session on the task if applicable
		if (this.state.currentSession && this.state.currentSession.taskPath) {
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(
					this.state.currentSession.taskPath
				);
				if (task) {
					await this.plugin.taskService.startTimeTracking(task);
				}
			} catch (error) {
				// If time tracking is already active, that's fine for Pomodoro resume
				if (!error.message?.includes("Time tracking is already active")) {
					tasknotesLogger.error("Failed to start time tracking for Pomodoro resume:", {
						category: "internal",
						operation: "start-time-tracking-pomodoro-resume",
						error: error,
					});
				}
			}
		}

		// Emit event to update UI
		this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
			timeRemaining: this.state.timeRemaining,
			session: this.state.currentSession,
		});

		new Notice(this.translate("services.pomodoro.notices.resumed"));
	}

	async stopPomodoro() {
		if (!this.state.currentSession) {
			return;
		}

		const wasRunning = this.state.isRunning;
		if (wasRunning) {
			this.syncRunningTimeRemaining();
		}
		this.stopTimer();
		const stoppedAt = getCurrentTimestamp();

		if (this.state.currentSession) {
			this.state.currentSession.interrupted = true;
			this.state.currentSession.endTime = stoppedAt;

			// End the current active period if it's still running
			if (this.state.currentSession.activePeriods.length > 0) {
				const currentPeriod =
					this.state.currentSession.activePeriods[
						this.state.currentSession.activePeriods.length - 1
					];
				if (!currentPeriod.endTime) {
					currentPeriod.endTime = stoppedAt;
				}
			}

			// Add interrupted session to history
			await this.addSessionToHistory(this.state.currentSession);
		}

		this.plugin.emitter.trigger(EVENT_POMODORO_INTERRUPT, {
			session: this.state.currentSession,
		});

		// Trigger webhook for pomodoro interruption
		if (this.webhookNotifier && this.state.currentSession) {
			try {
				const task = this.state.currentSession.taskPath
					? await this.plugin.cacheManager.getTaskInfo(this.state.currentSession.taskPath)
					: undefined;
				await this.webhookNotifier.triggerWebhook("pomodoro.interrupted", {
					session: this.state.currentSession,
					task,
				});
			} catch (error) {
				tasknotesLogger.warn("Failed to trigger webhook for pomodoro interruption:", {
					category: "provider",
					operation: "trigger-webhook-pomodoro-interruption",
					error: error,
				});
			}
		}

		// Stop time tracking on the task if applicable (only if it was running)
		if (this.state.currentSession && this.state.currentSession.taskPath && wasRunning) {
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(
					this.state.currentSession.taskPath
				);
				if (task) {
					await this.plugin.taskService.stopTimeTracking(task);
				}
			} catch (error) {
				tasknotesLogger.error("Failed to stop time tracking for Pomodoro interrupt:", {
					category: "internal",
					operation: "stop-time-tracking-pomodoro-interrupt",
					error: error,
				});
			}
		}

		this.state.currentSession = undefined;
		this.state.isRunning = false;
		// Reset to default work duration
		this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
		this.state.nextSessionType = undefined;

		await this.saveState();

		// Emit tick event to update UI with reset timer
		this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
			timeRemaining: this.state.timeRemaining,
			session: this.state.currentSession,
		});

		if (wasRunning) {
			new Notice(this.translate("services.pomodoro.notices.stoppedAndReset"));
		}
	}

	async skipBreak(): Promise<void> {
		if (
			this.state.currentSession ||
			(this.state.nextSessionType !== "short-break" &&
				this.state.nextSessionType !== "long-break")
		) {
			return;
		}

		this.stopTimer();
		this.state.isRunning = false;
		this.state.currentSession = undefined;
		this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
		this.state.nextSessionType = undefined;

		await this.saveState();

		this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
			timeRemaining: this.state.timeRemaining,
			session: this.state.currentSession,
		});
	}

	private startTimer() {
		if (!this.ticker) {
			this.setupTicker();
		}

		this.syncRunningTimeRemaining();
		this.ticker?.start();
	}

	private stopTimer() {
		this.ticker?.stop();
	}

	private resumeTimer() {
		if (this.state.currentSession && this.state.currentSession.startTime) {
			const startTime = new Date(this.state.currentSession.startTime).getTime();
			const now = Date.now();

			// Check for invalid start time (future dates)
			if (startTime > now) {
				// Reset session if start time is in the future
				void this.stopPomodoro();
				return;
			}

			if (!this.state.isRunning && this.state.timeRemaining > 0) {
				// Session was paused, use stored time remaining (don't recalculate)
				this.state.timeRemaining = Math.min(
					this.state.timeRemaining,
					clampPomodoroDurationSeconds(this.state.currentSession.plannedDuration * 60)
				);
			} else if (this.state.isRunning) {
				this.state.timeRemaining = getSessionRemainingSeconds(
					this.state.currentSession,
					now
				);
			}

			if (this.state.timeRemaining > 0 && this.state.isRunning) {
				this.startTimer();
			} else if (this.state.timeRemaining <= 0) {
				// Timer would have completed while app was closed
				void this.completePomodoro();
			}
		}
	}

	private syncRunningTimeRemaining(nowMs = Date.now()): number {
		if (!this.state.currentSession) {
			return this.state.timeRemaining;
		}

		if (this.state.isRunning) {
			this.state.timeRemaining = getSessionRemainingSeconds(this.state.currentSession, nowMs);
		}

		this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
			timeRemaining: this.state.timeRemaining,
			session: this.state.currentSession,
		});

		return this.state.timeRemaining;
	}

	private async autoStartWorkSession(): Promise<void> {
		if (this.state.isRunning) {
			return;
		}

		try {
			const task = await this.getAutoStartTask();
			if (task) {
				await this.startPomodoro(task);
			} else {
				await this.startPomodoro();
			}
		} catch (error) {
			tasknotesLogger.error("Failed to auto-start work session:", {
				category: "internal",
				operation: "auto-start-work-session",
				error: error,
			});
		}
	}

	private async getAutoStartTask(): Promise<TaskInfo | undefined> {
		const candidatePaths: string[] = [];

		if (this.lastWorkSessionTaskPath) {
			candidatePaths.push(this.lastWorkSessionTaskPath);
		}

		if (this.state.currentSession?.taskPath) {
			candidatePaths.push(this.state.currentSession.taskPath);
		}

		const persistedPath = await this.getLastSelectedTaskPath();
		if (persistedPath) {
			candidatePaths.push(persistedPath);
		}

		const uniquePaths = Array.from(
			new Set(candidatePaths.filter((path) => typeof path === "string" && path.length > 0))
		);

		for (const path of uniquePaths) {
			try {
				const task = await this.plugin.cacheManager.getTaskInfo(path);
				if (!task) {
					this.clearCachedTaskPath(path);
					continue;
				}
				const completedForToday = isTaskInstanceCompleted(
					task,
					new Date(),
					this.plugin.statusManager,
					this.plugin.settings.defaultTaskStatus
				);
				if (task.archived || completedForToday) {
					this.clearCachedTaskPath(path);
					continue;
				}
				return task;
			} catch (error) {
				tasknotesLogger.warn(`Failed to load task for auto-start (${path}):`, {
					category: "persistence",
					operation: "load-task-auto-start",
					error: error,
				});
			}
		}

		return undefined;
	}

	private clearCachedTaskPath(path: string): void {
		if (this.lastWorkSessionTaskPath === path) {
			this.lastWorkSessionTaskPath = undefined;
		}

		if (this.lastSelectedTaskPath === path) {
			this.lastSelectedTaskPath = undefined;
			this.lastSelectedTaskPathLoaded = true;
		}
	}

	private async completePomodoro() {
		this.stopTimer();

		if (!this.state.currentSession) {
			return;
		}

		const session = this.state.currentSession;
		const completionTimeMs = getSessionCompletionTimeMs(session);
		const completedAt =
			completionTimeMs !== null
				? formatLocalTimestamp(completionTimeMs)
				: getCurrentTimestamp();
		session.completed = true;
		session.endTime = completedAt;

		if (session.type === "work" && session.taskPath) {
			this.lastWorkSessionTaskPath = session.taskPath;
		}

		// End the current active period if it's still running
		if (session.activePeriods.length > 0) {
			const currentPeriod = session.activePeriods[session.activePeriods.length - 1];
			if (!currentPeriod.endTime) {
				currentPeriod.endTime = completedAt;
			}
		}

		// Stop time tracking on task if applicable for work sessions
		// Only stop if timer was running (if paused, time tracking should already be stopped)
		if (session.type === "work" && this.state.isRunning) {
			// Stop time tracking on task if applicable
			if (session.taskPath) {
				try {
					const task = await this.plugin.cacheManager.getTaskInfo(session.taskPath);
					if (task) {
						await this.plugin.taskService.stopTimeTracking(task);
					}
				} catch (error) {
					tasknotesLogger.error("Failed to stop time tracking for Pomodoro completion:", {
						category: "internal",
						operation: "stop-time-tracking-pomodoro-completion",
						error: error,
					});
				}
			}
		}

		// Daily note update is now handled by addSessionToHistory method

		// Determine next session based on session history
		let shouldTakeLongBreak = false;
		if (session.type === "work") {
			try {
				const stats = await this.getTodayStats();
				// Add 1 to account for the current session that will be added to history
				const totalCompleted = stats.pomodorosCompleted + 1;
				shouldTakeLongBreak =
					totalCompleted % this.plugin.settings.pomodoroLongBreakInterval === 0;
			} catch (error) {
				tasknotesLogger.error("Failed to calculate break type:", {
					category: "internal",
					operation: "calculate-break-type",
					error: error,
				});
				shouldTakeLongBreak = false;
			}
		}

		// Add session to history
		await this.addSessionToHistory(session);

		// Emit completion event
		this.plugin.emitter.trigger(EVENT_POMODORO_COMPLETE, {
			session,
			nextType:
				session.type === "work"
					? shouldTakeLongBreak
						? "long-break"
						: "short-break"
					: "work",
		});

		// Trigger webhook for pomodoro completion
		if (this.webhookNotifier) {
			try {
				const task = session.taskPath
					? await this.plugin.cacheManager.getTaskInfo(session.taskPath)
					: undefined;
				await this.webhookNotifier.triggerWebhook("pomodoro.completed", { session, task });
			} catch (error) {
				tasknotesLogger.warn("Failed to trigger webhook for pomodoro completion:", {
					category: "provider",
					operation: "trigger-webhook-pomodoro-completion",
					error: error,
				});
			}
		}

		const message = session.type === "work" ? `🍅 Pomodoro completed!` : "☕ Break completed!";
		const body =
			session.type === "work"
				? `Time for a ${shouldTakeLongBreak ? "long break 💤" : "short break ☕"}`
				: "Ready for the next pomodoro?";
		this.showPomodoroNotification(message, { body });

		// Play sound if enabled
		if (this.plugin.settings.pomodoroSoundEnabled) {
			this.playCompletionSound();
		}

		// Clear current session and set up for next session
		this.state.currentSession = undefined;
		this.state.isRunning = false;

		// Set up appropriate timer for next session
		if (session.type === "work") {
			// After work session, prepare break timer
			const breakDuration = shouldTakeLongBreak
				? this.plugin.settings.pomodoroLongBreakDuration
				: this.plugin.settings.pomodoroShortBreakDuration;
			this.state.timeRemaining = breakDuration * 60;
			this.state.nextSessionType = shouldTakeLongBreak ? "long-break" : "short-break";

			// Auto-start break if configured, otherwise just prepare the timer
			if (this.plugin.settings.pomodoroAutoStartBreaks) {
				const timeout = window.setTimeout(() => {
					void this.startBreak(shouldTakeLongBreak);
				}, 1000);
				this.cleanupTimeouts.add(timeout);
			}
		} else {
			// After break session, prepare work timer
			this.state.timeRemaining = this.plugin.settings.pomodoroWorkDuration * 60;
			this.state.nextSessionType = "work";

			// Auto-start work if configured, otherwise just prepare the timer
			if (this.plugin.settings.pomodoroAutoStartWork) {
				const timeout = window.setTimeout(() => {
					void this.autoStartWorkSession();
				}, 1000);
				this.cleanupTimeouts.add(timeout);
			}
		}

		await this.saveState();

		// Emit tick event to update UI with new timer duration
		this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
			timeRemaining: this.state.timeRemaining,
			session: this.state.currentSession,
		});
	}

	private playCompletionSound() {
		try {
			// Create a simple beep sound
			const audioContext = new (window.AudioContext ||
				(window as Window & { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext)();
			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();

			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);

			const volume = Math.max(0, Math.min(1, this.plugin.settings.pomodoroSoundVolume / 100));
			gainNode.gain.value = volume * 0.3; // Scale down for comfortable listening

			oscillator.frequency.value = 800; // Frequency in Hz
			oscillator.type = "sine";

			oscillator.start();
			oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep

			// Track audio context for cleanup
			this.activeAudioContexts.add(audioContext);

			// Second beep
			const beepTimeout = window.setTimeout(() => {
				try {
					const osc2 = audioContext.createOscillator();
					osc2.connect(gainNode);
					osc2.frequency.value = 1000;
					osc2.type = "sine";
					osc2.start();
					osc2.stop(audioContext.currentTime + 0.1);
				} catch (error) {
					tasknotesLogger.error("Failed to play second beep:", {
						category: "provider",
						operation: "play-second-beep",
						error: error,
					});
				}
			}, 150);
			this.cleanupTimeouts.add(beepTimeout);

			// Clean up audio context after sounds complete
			const cleanupTimeout = window.setTimeout(() => {
				this.activeAudioContexts.delete(audioContext);
				audioContext.close().catch(() => {});
			}, 300);
			this.cleanupTimeouts.add(cleanupTimeout);
		} catch (error) {
			tasknotesLogger.error("Failed to play completion sound:", {
				category: "provider",
				operation: "play-completion-sound",
				error: error,
			});
		}
	}

	private showPomodoroNotification(title: string, options?: NotificationOptions): void {
		if (!this.plugin.settings.pomodoroNotifications) {
			return;
		}

		if (typeof Notification === "undefined" || Notification.permission !== "granted") {
			return;
		}

		try {
			new Notification(title, options);
		} catch (error) {
			tasknotesLogger.warn("Failed to show Pomodoro notification:", {
				category: "provider",
				operation: "show-pomodoro-notification",
				error: error,
			});
		}
	}

	// Public getters
	getState(): PomodoroState {
		return { ...this.state };
	}

	adjustSessionTime(adjustmentSeconds: number): void {
		if (this.state.currentSession) {
			const nextRemainingSeconds = clampPomodoroDurationSeconds(
				this.state.timeRemaining + adjustmentSeconds
			);
			this.setCurrentSessionRemainingTime(nextRemainingSeconds);
		}
	}

	setCurrentSessionRemainingTime(remainingSeconds: number): void {
		if (!this.state.currentSession) {
			return;
		}

		const nowMs = Date.now();
		if (this.state.isRunning) {
			this.state.timeRemaining = getSessionRemainingSeconds(this.state.currentSession, nowMs);
		}

		const nextRemainingSeconds = clampPomodoroDurationSeconds(remainingSeconds);
		const elapsedSeconds = getActiveElapsedSeconds(this.state.currentSession, nowMs);
		this.state.timeRemaining = nextRemainingSeconds;
		this.state.currentSession.plannedDuration = (elapsedSeconds + nextRemainingSeconds) / 60;

		void this.saveState();

		this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
			timeRemaining: this.state.timeRemaining,
			session: this.state.currentSession,
		});
	}

	public adjustPreparedTimer(newTimeInSeconds: number): void {
		// If there's a current session, we should not adjust the prepared timer
		if (!this.state.currentSession) {
			// Stop the timer if it's running
			this.stopTimer();

			this.state.timeRemaining = clampPomodoroDurationSeconds(newTimeInSeconds);
			void this.saveState();

			// Trigger tick event to update UI
			this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
				timeRemaining: this.state.timeRemaining,
				session: this.state.currentSession,
			});
		}
	}

	isRunning(): boolean {
		return this.state.isRunning;
	}

	getCurrentSession(): PomodoroSession | undefined {
		return this.state.currentSession;
	}

	getTimeRemaining(): number {
		return this.state.timeRemaining;
	}

	async getPomodorosCompleted(): Promise<number> {
		const stats = await this.getTodayStats();
		return stats.pomodorosCompleted;
	}

	async getCurrentStreak(): Promise<number> {
		const stats = await this.getTodayStats();
		return stats.currentStreak;
	}

	async getTotalMinutesToday(): Promise<number> {
		const stats = await this.getTodayStats();
		return stats.totalMinutes;
	}

	async assignTaskToCurrentSession(task?: TaskInfo) {
		if (!this.state.currentSession) {
			return;
		}

		const session = this.state.currentSession;
		const previousTaskPath = session.taskPath;
		const nextTaskPath = task?.path;
		const shouldSwitchActiveTracking =
			this.state.isRunning && session.type === "work" && previousTaskPath !== nextTaskPath;

		if (shouldSwitchActiveTracking && previousTaskPath) {
			try {
				const previousTask = await this.plugin.cacheManager.getTaskInfo(previousTaskPath);
				if (previousTask) {
					await this.plugin.taskService.stopTimeTracking(previousTask);
				}
			} catch (error) {
				tasknotesLogger.error("Failed to stop time tracking for previous Pomodoro task:", {
					category: "persistence",
					operation: "stop-time-tracking-previous-pomodoro-task",
					error: error,
				});
			}
		}

		// Update the current session's task
		session.taskPath = nextTaskPath;

		if (nextTaskPath) {
			this.lastWorkSessionTaskPath = nextTaskPath;
			this.lastSelectedTaskPath = nextTaskPath;
			this.lastSelectedTaskPathLoaded = true;
		} else {
			this.lastWorkSessionTaskPath = undefined;
			this.lastSelectedTaskPath = undefined;
			this.lastSelectedTaskPathLoaded = true;
		}

		await this.saveState();

		if (shouldSwitchActiveTracking && task) {
			try {
				await this.plugin.taskService.startTimeTracking(task);
			} catch (error) {
				if (!error.message?.includes("Time tracking is already active")) {
					tasknotesLogger.error("Failed to start time tracking for new Pomodoro task:", {
						category: "persistence",
						operation: "start-time-tracking-new-pomodoro-task",
						error: error,
					});
				}
			}
		}

		// Emit tick event to update UI
		this.plugin.emitter.trigger(EVENT_POMODORO_TICK, {
			timeRemaining: this.state.timeRemaining,
			session,
		});
	}

	// Session History Management
	async getSessionHistory(): Promise<PomodoroSessionHistory[]> {
		try {
			const pluginHistory = await this.loadPluginHistory();
			let history: PomodoroSessionHistory[];

			if (this.plugin.settings.pomodoroStorageLocation === "daily-notes") {
				// Load from daily notes when that's the primary storage
				const dailyNotesHistory = await this.loadHistoryFromDailyNotes();
				history = dailyNotesHistory;

				// Merge with plugin data if there's any (for migration purposes)
				if (pluginHistory.length > 0) {
					const mergedHistory = this.mergeHistories(pluginHistory, dailyNotesHistory);
					history = mergedHistory;
				}
			} else {
				// Default plugin storage
				history = pluginHistory;
			}

			// Sort by start time to maintain chronological order
			return sortPomodoroSessions(history);
		} catch (error) {
			tasknotesLogger.error("Failed to load session history:", {
				category: "persistence",
				operation: "load-session-history",
				error: error,
			});
			return [];
		}
	}

	async getSessionsForDate(date: Date): Promise<PomodoroSessionHistory[]> {
		try {
			const dateKey = formatDateForStorage(date);
			if (!dateKey) {
				return [];
			}

			const pluginHistory = await this.loadPluginHistoryForDateKey(dateKey);
			let history: PomodoroSessionHistory[];

			if (this.plugin.settings.pomodoroStorageLocation === "daily-notes") {
				const dailyNotesHistory = await this.loadHistoryFromDailyNoteForDateKey(dateKey);
				history =
					pluginHistory.length > 0
						? this.mergeHistories(pluginHistory, dailyNotesHistory)
						: dailyNotesHistory;
			} else {
				history = pluginHistory;
			}

			return sortPomodoroSessions(history);
		} catch (error) {
			tasknotesLogger.error("Failed to load session history for date:", {
				category: "validation",
				operation: "load-session-history-date",
				error: error,
			});
			return [];
		}
	}

	async getSessionsForDateRange(
		startDate: Date,
		endDate: Date
	): Promise<PomodoroSessionHistory[]> {
		try {
			const pluginHistory = await this.loadPluginHistoryForDateRange(startDate, endDate);
			let history: PomodoroSessionHistory[];

			if (this.plugin.settings.pomodoroStorageLocation === "daily-notes") {
				const dailyNotesHistory = await this.loadHistoryFromDailyNotesForDateRange(
					startDate,
					endDate
				);
				history =
					pluginHistory.length > 0
						? this.mergeHistories(pluginHistory, dailyNotesHistory)
						: dailyNotesHistory;
			} else {
				history = pluginHistory;
			}

			return sortPomodoroSessions(history);
		} catch (error) {
			tasknotesLogger.error("Failed to load session history for date range:", {
				category: "validation",
				operation: "load-session-history-date-range",
				error: error,
			});
			return [];
		}
	}

	async saveSessionHistory(history: PomodoroSessionHistory[]): Promise<void> {
		try {
			if (this.plugin.settings.pomodoroStorageLocation === "daily-notes") {
				await this.saveHistoryToDailyNotes(history);
			} else {
				// Default plugin storage
				await this.savePluginHistory(history);
			}
		} catch (error) {
			tasknotesLogger.error("Failed to save session history:", {
				category: "persistence",
				operation: "save-session-history",
				error: error,
			});
		}
	}

	async deleteSessionFromHistory(session: PomodoroSessionHistory): Promise<boolean> {
		let deleted = false;

		try {
			const pluginHistory = await this.loadPluginHistory();
			const filteredPluginHistory = pluginHistory.filter((entry) => entry.id !== session.id);

			if (filteredPluginHistory.length !== pluginHistory.length) {
				await this.savePluginHistory(filteredPluginHistory);
				deleted = true;
			}

			if (this.plugin.settings.pomodoroStorageLocation === "daily-notes") {
				deleted = (await this.deleteSessionFromDailyNote(session)) || deleted;
			}
		} catch (error) {
			tasknotesLogger.error("Failed to delete pomodoro session:", {
				category: "persistence",
				operation: "delete-pomodoro-session",
				error: error,
			});
		}

		return deleted;
	}

	async addSessionToHistory(session: PomodoroSession): Promise<void> {
		if (!session.endTime) {
			tasknotesLogger.warn("Cannot add session to history without end time", {
				category: "persistence",
				operation: "add-session-history-without-end-time",
			});
			return;
		}

		const historyEntry: PomodoroSessionHistory = {
			id: session.id,
			startTime: session.startTime,
			endTime: session.endTime,
			plannedDuration: session.plannedDuration,
			type: session.type,
			taskPath: session.taskPath,
			completed: session.completed && !session.interrupted,
			activePeriods: session.activePeriods.slice(), // Copy the active periods array
		};

		try {
			if (this.plugin.settings.pomodoroStorageLocation === "daily-notes") {
				// For daily notes, add only this session to the appropriate daily note
				await this.addSingleSessionToDailyNote(historyEntry);
			} else {
				// For plugin storage, add to the full history
				const history = await this.getSessionHistory();
				history.push(historyEntry);
				await this.saveSessionHistory(history);
			}
		} catch (error) {
			tasknotesLogger.error("Failed to add session to history:", {
				category: "persistence",
				operation: "add-session-history",
				error: error,
			});
		}
	}

	async getStatsForDate(date: Date): Promise<PomodoroHistoryStats> {
		const dayHistory = await this.getSessionsForDate(date);
		return calculatePomodoroStats(dayHistory);
	}

	async getStatsForDateRange(startDate: Date, endDate: Date): Promise<PomodoroHistoryStats> {
		const rangeHistory = await this.getSessionsForDateRange(startDate, endDate);
		return calculatePomodoroStats(rangeHistory);
	}

	async getOverallStats(): Promise<PomodoroHistoryStats> {
		const history = await this.getSessionHistory();
		return calculatePomodoroStats(history);
	}

	async getTodayStats(): Promise<PomodoroHistoryStats> {
		// Use UTC-anchored today for consistent timezone handling
		const todayLocal = getTodayLocal();
		const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);
		return this.getStatsForDate(todayUTCAnchor);
	}

	cleanup() {
		this.stopTimer();
		this.ticker?.destroy();
		this.ticker = null;
		this.taskFileRenameUnsubscribe?.();
		this.taskFileRenameUnsubscribe = undefined;
		for (const timeout of this.cleanupTimeouts) {
			window.clearTimeout(timeout);
		}
		this.cleanupTimeouts.clear();
		for (const audioContext of this.activeAudioContexts) {
			if (audioContext.state !== "closed") {
				audioContext.close().catch(() => {});
			}
		}
		this.activeAudioContexts.clear();
		void this.saveState();
	}

	private async loadPluginHistory(): Promise<PomodoroSessionHistory[]> {
		const data = await this.plugin.loadData();
		const pluginHistory = data?.pomodoroHistory;
		return Array.isArray(pluginHistory) ? pluginHistory : [];
	}

	private async savePluginHistory(history: PomodoroSessionHistory[]): Promise<void> {
		const data = (await this.plugin.loadData()) || {};
		data.pomodoroHistory = history;
		await this.plugin.saveData(data);
	}

	private async loadPluginHistoryForDateKey(dateKey: string): Promise<PomodoroSessionHistory[]> {
		return filterPomodoroSessionsByDateKey(await this.loadPluginHistory(), dateKey);
	}

	private async loadPluginHistoryForDateRange(
		startDate: Date,
		endDate: Date
	): Promise<PomodoroSessionHistory[]> {
		return filterPomodoroSessionsByDateRange(
			await this.loadPluginHistory(),
			startDate,
			endDate
		);
	}

	/**
	 * Save pomodoro history to daily notes frontmatter
	 */
	private async saveHistoryToDailyNotes(history: PomodoroSessionHistory[]): Promise<void> {
		try {
			// Check if Daily Notes plugin is enabled
			if (!appHasDailyNotesPluginLoaded()) {
				throw new Error("Daily Notes core plugin is not enabled");
			}

			// Group sessions by date
			const sessionsByDate = this.groupSessionsByDate(history);

			// Update each daily note with its sessions
			for (const [dateStr, sessions] of sessionsByDate) {
				await this.updateDailyNotePomodoros(dateStr, sessions);
			}
		} catch (error) {
			tasknotesLogger.error("Failed to save history to daily notes:", {
				category: "persistence",
				operation: "save-history-daily-notes",
				error: error,
			});
			throw error;
		}
	}

	private async loadHistoryFromDailyNotesForDateRange(
		startDate: Date,
		endDate: Date
	): Promise<PomodoroSessionHistory[]> {
		try {
			if (!appHasDailyNotesPluginLoaded()) {
				return [];
			}

			const allDailyNotes = getAllDailyNotes();
			const history: PomodoroSessionHistory[] = [];

			for (const dateKey of getPomodoroDateKeysInRange(startDate, endDate)) {
				const sessions = await this.loadHistoryFromDailyNoteForDateKey(
					dateKey,
					allDailyNotes
				);
				history.push(...sessions);
			}

			return history;
		} catch (error) {
			tasknotesLogger.error("Failed to load history from daily notes for date range:", {
				category: "validation",
				operation: "load-history-daily-notes-date-range",
				error: error,
			});
			return [];
		}
	}

	private async loadHistoryFromDailyNoteForDateKey(
		dateKey: string,
		allDailyNotes?: Record<string, TFile>
	): Promise<PomodoroSessionHistory[]> {
		try {
			if (!dateKey || !appHasDailyNotesPluginLoaded()) {
				return [];
			}

			const dailyNotes = allDailyNotes ?? getAllDailyNotes();
			const date = parseDateToLocal(dateKey);
			const dailyNoteMoment = getDailyNoteMoment(date);
			const dailyNote = getDailyNote(dailyNoteMoment, dailyNotes);

			if (!dailyNote) {
				return [];
			}

			return this.readPomodoroSessionsFromDailyNote(dailyNote);
		} catch (error) {
			tasknotesLogger.warn(`Failed to load pomodoro history for daily note ${dateKey}:`, {
				category: "persistence",
				operation: "load-pomodoro-history-daily-note",
				error: error,
			});
			return [];
		}
	}

	/**
	 * Load pomodoro history from daily notes frontmatter
	 */
	private async loadHistoryFromDailyNotes(): Promise<PomodoroSessionHistory[]> {
		try {
			// Check if Daily Notes plugin is enabled
			if (!appHasDailyNotesPluginLoaded()) {
				return [];
			}

			const allHistory: PomodoroSessionHistory[] = [];
			const allDailyNotes = getAllDailyNotes();

			// Read from each daily note
			for (const [, file] of Object.entries(allDailyNotes)) {
				try {
					allHistory.push(...this.readPomodoroSessionsFromDailyNote(file));
				} catch (error) {
					tasknotesLogger.warn(
						`Failed to read pomodoro data from daily note ${file.path}:`,
						{
							category: "persistence",
							operation: "read-pomodoro-data-daily-note",
							error: error,
						}
					);
				}
			}

			return allHistory;
		} catch (error) {
			tasknotesLogger.error("Failed to load history from daily notes:", {
				category: "persistence",
				operation: "load-history-daily-notes",
				error: error,
			});
			return [];
		}
	}

	private readPomodoroSessionsFromDailyNote(file: TFile): PomodoroSessionHistory[] {
		const cache = this.plugin.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		const pomodoroField = this.plugin.fieldMapper.toUserField("pomodoros");
		const sessions = frontmatter?.[pomodoroField];

		return Array.isArray(sessions) ? sessions.filter(isPomodoroSessionHistory) : [];
	}

	/**
	 * Group sessions by date string (YYYY-MM-DD)
	 */
	private groupSessionsByDate(
		history: PomodoroSessionHistory[]
	): Map<string, PomodoroSessionHistory[]> {
		const grouped = new Map<string, PomodoroSessionHistory[]>();

		for (const session of history) {
			const dateStr = getPomodoroSessionDateKey(session);

			if (!dateStr) {
				continue;
			}

			if (!grouped.has(dateStr)) {
				grouped.set(dateStr, []);
			}
			grouped.get(dateStr)!.push(session);
		}

		return grouped;
	}

	/**
	 * Add a single session to the appropriate daily note
	 */
	private async addSingleSessionToDailyNote(session: PomodoroSessionHistory): Promise<void> {
		try {
			const sessionDateKey = getPomodoroSessionDateKey(session);
			if (!sessionDateKey) {
				throw new Error(`Invalid Pomodoro session start time: ${session.startTime}`);
			}

			const sessionDate = parseDateToLocal(sessionDateKey);
			const dailyNoteMoment = getDailyNoteMoment(sessionDate);

			// Get or create daily note
			const allDailyNotes = getAllDailyNotes();
			let dailyNote = getDailyNote(dailyNoteMoment, allDailyNotes);

			if (!dailyNote) {
				dailyNote = await createDailyNote(dailyNoteMoment);

				// Validate that daily note was created successfully
				if (!dailyNote) {
					throw new Error(
						"Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists."
					);
				}
			}

			// Update frontmatter
			const pomodoroField = this.plugin.fieldMapper.toUserField("pomodoros");

			await this.plugin.app.fileManager.processFrontMatter(dailyNote, (frontmatter) => {
				// Get existing sessions
				const existingSessions = Array.isArray(frontmatter[pomodoroField])
					? frontmatter[pomodoroField].filter(isPomodoroSessionHistory)
					: [];
				const existingIds = new Set(existingSessions.map((s) => s.id));

				// Only add session if it doesn't already exist
				if (!existingIds.has(session.id)) {
					frontmatter[pomodoroField] = [...existingSessions, session];
				}
			});
		} catch (error) {
			tasknotesLogger.error(`Failed to add session to daily note:`, {
				category: "persistence",
				operation: "add-session-daily-note",
				error: error,
			});
		}
	}

	private async deleteSessionFromDailyNote(session: PomodoroSessionHistory): Promise<boolean> {
		try {
			if (!appHasDailyNotesPluginLoaded()) {
				return false;
			}

			const sessionDateKey = getPomodoroSessionDateKey(session);
			if (!sessionDateKey) {
				return false;
			}

			const sessionDate = parseDateToLocal(sessionDateKey);
			const dailyNoteMoment = getDailyNoteMoment(sessionDate);
			const dailyNote = getDailyNote(dailyNoteMoment, getAllDailyNotes());

			if (!dailyNote) {
				return false;
			}

			const pomodoroField = this.plugin.fieldMapper.toUserField("pomodoros");
			let deleted = false;

			await this.plugin.app.fileManager.processFrontMatter(dailyNote, (frontmatter) => {
				const existingSessions = Array.isArray(frontmatter[pomodoroField])
					? frontmatter[pomodoroField].filter(isPomodoroSessionHistory)
					: [];
				const filteredSessions = existingSessions.filter(
					(entry) => entry.id !== session.id
				);

				if (filteredSessions.length !== existingSessions.length) {
					frontmatter[pomodoroField] = filteredSessions;
					deleted = true;
				}
			});

			return deleted;
		} catch (error) {
			tasknotesLogger.error(`Failed to delete pomodoro session from daily note:`, {
				category: "persistence",
				operation: "delete-pomodoro-session-daily-note",
				error: error,
			});
			return false;
		}
	}

	/**
	 * Update a specific daily note with pomodoro sessions
	 */
	private async updateDailyNotePomodoros(
		dateStr: string,
		sessions: PomodoroSessionHistory[]
	): Promise<void> {
		try {
			const date = parseDateToLocal(dateStr); // Use local date for daily note creation
			const dailyNoteMoment = getDailyNoteMoment(date);

			// Get or create daily note
			const allDailyNotes = getAllDailyNotes();
			let dailyNote = getDailyNote(dailyNoteMoment, allDailyNotes);

			if (!dailyNote) {
				dailyNote = await createDailyNote(dailyNoteMoment);

				// Validate that daily note was created successfully
				if (!dailyNote) {
					throw new Error(
						"Failed to create daily note. Please check your Daily Notes plugin configuration and ensure the daily notes folder exists."
					);
				}
			}

			// Update frontmatter
			const pomodoroField = this.plugin.fieldMapper.toUserField("pomodoros");

			await this.plugin.app.fileManager.processFrontMatter(dailyNote, (frontmatter) => {
				// Get existing sessions and append new ones
				const existingSessions = Array.isArray(frontmatter[pomodoroField])
					? frontmatter[pomodoroField].filter(isPomodoroSessionHistory)
					: [];
				const existingIds = new Set(existingSessions.map((s) => s.id));

				// Only add sessions that don't already exist
				const newSessions = sessions.filter((session) => !existingIds.has(session.id));

				if (newSessions.length > 0) {
					frontmatter[pomodoroField] = [...existingSessions, ...newSessions];
				}
			});
		} catch (error) {
			tasknotesLogger.error(`Failed to update daily note for ${dateStr}:`, {
				category: "validation",
				operation: "update-daily-note",
				error: error,
			});
		}
	}

	/**
	 * Merge histories from plugin and daily notes, removing duplicates
	 */
	private mergeHistories(
		pluginHistory: PomodoroSessionHistory[],
		dailyNotesHistory: PomodoroSessionHistory[]
	): PomodoroSessionHistory[] {
		const merged = [...dailyNotesHistory];
		const existingIds = new Set(dailyNotesHistory.map((s) => s.id));

		// Add plugin sessions that aren't already in daily notes
		for (const session of pluginHistory) {
			if (!existingIds.has(session.id)) {
				merged.push(session);
			}
		}

		return merged;
	}

	/**
	 * Migrate existing plugin data to daily notes
	 */
	async migrateTodailyNotes(): Promise<void> {
		try {
			// Check if Daily Notes plugin is enabled
			if (!appHasDailyNotesPluginLoaded()) {
				throw new Error("Daily Notes core plugin must be enabled for migration");
			}

			// Load existing plugin data
			const data = await this.plugin.loadData();
			const pluginHistory = data?.pomodoroHistory || [];

			if (pluginHistory.length === 0) {
				return; // Nothing to migrate
			}

			// Save to daily notes
			await this.saveHistoryToDailyNotes(pluginHistory);

			// Clear plugin data after successful migration
			data.pomodoroHistory = [];
			await this.plugin.saveData(data);

			new Notice(
				this.translate("services.pomodoro.notices.migrationSuccess", {
					count: pluginHistory.length,
				})
			);
		} catch (error) {
			tasknotesLogger.error("Failed to migrate pomodoro data to daily notes:", {
				category: "persistence",
				operation: "migrate-pomodoro-data-daily-notes",
				error: error,
			});
			new Notice(this.translate("services.pomodoro.notices.migrationFailure"));
			throw error;
		}
	}
}
