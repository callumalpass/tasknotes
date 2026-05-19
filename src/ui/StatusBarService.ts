import {
	EVENT_POMODORO_COMPLETE,
	EVENT_POMODORO_INTERRUPT,
	EVENT_POMODORO_START,
	EVENT_POMODORO_TICK,
	PomodoroSession,
	PomodoroState,
	TaskInfo,
} from "../types";
import { RequestDeduplicator } from "../utils/RequestDeduplicator";
import { EventRef, setIcon, setTooltip, TFile } from "obsidian";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal";
import { formatPomodoroTime } from "../utils/pomodoroTime";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/StatusBarService" });

export class StatusBarService {
	private plugin: import("../main").default;
	private statusBarElement: HTMLElement | null = null;
	private pomodoroStatusBarElement: HTMLElement | null = null;
	private requestDeduplicator: RequestDeduplicator;
	private updateTimeout: number | null = null;
	private pomodoroUpdateTimeout: number | null = null;
	private elapsedUpdateInterval: number | null = null;
	private currentTrackedTasks: TaskInfo[] = [];
	private pomodoroEventRefs: EventRef[] = [];

	constructor(plugin: import("../main").default) {
		this.plugin = plugin;
		this.requestDeduplicator = new RequestDeduplicator();
	}

	/**
	 * Initialize the status bar service
	 */
	initialize(): void {
		this.ensureTrackedStatusBarElement();
		this.ensurePomodoroStatusBarElement();
		this.registerPomodoroEvents();

		// Initial update
		void this.updateStatusBar();
		this.updatePomodoroStatusBar();
	}

	private ensureTrackedStatusBarElement(): void {
		if (this.statusBarElement || !this.plugin.settings.showTrackedTasksInStatusBar) {
			return;
		}

		this.statusBarElement = this.plugin.addStatusBarItem();
		this.statusBarElement.addClass("tasknotes-status-bar");
		this.statusBarElement.classList.remove(
			"tn-static-cursor-grab-dad79857",
			"tn-static-cursor-pointer-2723efcc"
		);
		this.statusBarElement.classList.add("tn-static-cursor-pointer-3b6a3a65");

		// Add click handler to open tasks view filtered to tracked tasks
		this.statusBarElement.addEventListener("click", () => {
			void this.handleStatusBarClick();
		});
	}

	private ensurePomodoroStatusBarElement(): void {
		if (this.pomodoroStatusBarElement || !this.plugin.settings.showPomodoroInStatusBar) {
			return;
		}

		this.pomodoroStatusBarElement = this.plugin.addStatusBarItem();
		this.pomodoroStatusBarElement.addClass("tasknotes-status-bar");
		this.pomodoroStatusBarElement.addClass("tasknotes-pomodoro-status");
		this.pomodoroStatusBarElement.classList.remove(
			"tn-static-cursor-grab-dad79857",
			"tn-static-cursor-pointer-2723efcc"
		);
		this.pomodoroStatusBarElement.classList.add("tn-static-cursor-pointer-3b6a3a65");
		this.pomodoroStatusBarElement.addEventListener("click", () => {
			void this.plugin.activatePomodoroView();
		});
	}

	private registerPomodoroEvents(): void {
		if (this.pomodoroEventRefs.length > 0) {
			return;
		}

		if (!this.plugin.emitter?.on) {
			return;
		}

		const requestUpdate = () => this.requestPomodoroUpdate();
		this.pomodoroEventRefs = [
			this.plugin.emitter.on(EVENT_POMODORO_START, requestUpdate),
			this.plugin.emitter.on(EVENT_POMODORO_TICK, requestUpdate),
			this.plugin.emitter.on(EVENT_POMODORO_COMPLETE, requestUpdate),
			this.plugin.emitter.on(EVENT_POMODORO_INTERRUPT, requestUpdate),
		];
	}

	/**
	 * Update the status bar display
	 */
	private async updateStatusBar(): Promise<void> {
		if (!this.statusBarElement) {
			this.stopElapsedTicker();
			return;
		}

		if (!this.plugin.settings.showTrackedTasksInStatusBar) {
			this.hide();
			return;
		}

		try {
			// Use request deduplicator to prevent excessive updates
			const trackedTasks = await this.requestDeduplicator.execute("update-status-bar", () =>
				this.getTrackedTasks()
			);

			this.renderStatusBar(trackedTasks);
		} catch (error) {
			tasknotesLogger.error("Error updating status bar:", {
				category: "internal",
				operation: "updating-status-bar",
				error: error,
			});
		}
	}

	private updatePomodoroStatusBar(): void {
		if (!this.plugin.settings.showPomodoroInStatusBar) {
			this.hidePomodoroStatusBar();
			return;
		}

		this.ensurePomodoroStatusBarElement();
		if (!this.pomodoroStatusBarElement || !this.plugin.pomodoroService) {
			return;
		}

		const state = this.plugin.pomodoroService.getState();
		if (!state.currentSession) {
			this.hidePomodoroStatusBar();
			return;
		}

		this.showElement(this.pomodoroStatusBarElement);
		this.renderPomodoroStatusBar(state);
	}

	/**
	 * Get all currently tracked tasks (tasks with active time sessions)
	 */
	private async getTrackedTasks(): Promise<TaskInfo[]> {
		// Force a fresh lookup of all tasks to avoid stale data
		const allTasks = await this.plugin.cacheManager.getAllTasks();

		return allTasks.filter((task) => {
			// Skip archived tasks
			if (task.archived) return false;

			// Check if task has an active time session
			const activeSession = this.plugin.getActiveTimeSession(task);
			return activeSession !== null;
		});
	}

	/**
	 * Render the status bar with tracked tasks information
	 */
	private renderStatusBar(trackedTasks: TaskInfo[]): void {
		if (!this.statusBarElement) return;

		this.currentTrackedTasks = [...trackedTasks];
		const count = trackedTasks.length;

		if (count === 0) {
			this.stopElapsedTicker();
			// Hide status bar when no tasks are being tracked
			this.statusBarElement.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.statusBarElement.classList.add("tn-static-display-none-6b99de8b");
			return;
		}

		// Show status bar
		this.startElapsedTicker();
		this.statusBarElement.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		this.statusBarElement.style.removeProperty("display");

		// Clear previous content
		this.statusBarElement.empty();

		// Create icon
		const iconEl = this.statusBarElement.createEl("span", {
			cls: "tasknotes-status-icon",
		});
		setIcon(iconEl, "timer");

		// Create text content
		const textEl = this.statusBarElement.createEl("span", {
			cls: "tasknotes-status-text",
		});

		if (count === 1) {
			const task = trackedTasks[0];
			const truncatedTitle =
				task.title.length > 30 ? task.title.substring(0, 30) + "..." : task.title;
			const elapsed = this.formatElapsedDuration(this.getActiveElapsedMs(task));
			textEl.setText(`Tracking: ${truncatedTitle} (${elapsed})`);

			// Add tooltip with full title
			setTooltip(
				this.statusBarElement,
				`Currently tracking: ${task.title}\nElapsed: ${elapsed}`,
				{
					placement: "top",
				}
			);
		} else {
			const totalElapsed = this.formatElapsedDuration(
				trackedTasks.reduce((sum, task) => sum + this.getActiveElapsedMs(task), 0)
			);
			textEl.setText(`Tracking ${count} tasks (${totalElapsed} total)`);

			// Add tooltip with task titles
			const taskTitles = trackedTasks
				.slice(0, 5) // Show max 5 in tooltip
				.map(
					(task) =>
						`${task.title} - ${this.formatElapsedDuration(this.getActiveElapsedMs(task))}`
				)
				.join("\n");
			const tooltipText = count > 5 ? `${taskTitles}\n... and ${count - 5} more` : taskTitles;
			setTooltip(this.statusBarElement, `Currently tracking:\n${tooltipText}`, {
				placement: "top",
			});
		}
	}

	private renderPomodoroStatusBar(state: PomodoroState): void {
		if (!this.pomodoroStatusBarElement || !state.currentSession) {
			return;
		}

		this.pomodoroStatusBarElement.empty();

		const iconEl = this.pomodoroStatusBarElement.createEl("span", {
			cls: "tasknotes-status-icon",
		});
		setIcon(iconEl, state.currentSession.type === "work" ? "timer" : "coffee");

		const textEl = this.pomodoroStatusBarElement.createEl("span", {
			cls: "tasknotes-status-text",
		});
		const timeRemaining = formatPomodoroTime(state.timeRemaining);
		const sessionLabel = this.getPomodoroSessionLabel(state.currentSession.type);
		const stateLabel = state.isRunning ? sessionLabel : `${sessionLabel} paused`;
		textEl.setText(`${stateLabel}: ${timeRemaining}`);

		setTooltip(
			this.pomodoroStatusBarElement,
			`${stateLabel}\nRemaining: ${timeRemaining}\nClick to open Pomodoro`,
			{
				placement: "top",
			}
		);
	}

	private getPomodoroSessionLabel(type: PomodoroSession["type"]): string {
		if (type === "work") {
			return "Focus";
		}

		if (type === "short-break") {
			return "Short break";
		}

		return "Long break";
	}

	private showElement(element: HTMLElement): void {
		element.classList.remove(
			"tn-static-display-block-2a1b75c9",
			"tn-static-display-flex-4d51fc62",
			"tn-static-display-flex-75816cae",
			"tn-static-display-flex-8bb39979",
			"tn-static-display-inline-block-60e32dcb",
			"tn-static-display-inline-cccfa456",
			"tn-static-display-inline-flex-f984c520",
			"tn-static-display-none-6b99de8b",
			"tn-static-min-height-800px-997b4c8c"
		);
		element.style.removeProperty("display");
	}

	private getActiveElapsedMs(task: TaskInfo): number {
		const activeSession = this.plugin.getActiveTimeSession(task);
		if (!activeSession?.startTime) {
			return 0;
		}

		const startMs = Date.parse(activeSession.startTime);
		if (!Number.isFinite(startMs)) {
			return 0;
		}

		return Math.max(0, Date.now() - startMs);
	}

	private formatElapsedDuration(durationMs: number): string {
		const totalSeconds = Math.floor(durationMs / 1000);
		const seconds = totalSeconds % 60;
		const totalMinutes = Math.floor(totalSeconds / 60);
		const minutes = totalMinutes % 60;
		const hours = Math.floor(totalMinutes / 60);

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
				.toString()
				.padStart(2, "0")}`;
		}

		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}

	private startElapsedTicker(): void {
		if (this.elapsedUpdateInterval !== null) {
			return;
		}

		this.elapsedUpdateInterval = window.setInterval(() => {
			if (this.currentTrackedTasks.length === 0) {
				this.stopElapsedTicker();
				return;
			}

			this.renderStatusBar(this.currentTrackedTasks);
		}, 1000);
	}

	private stopElapsedTicker(): void {
		if (this.elapsedUpdateInterval !== null) {
			window.clearInterval(this.elapsedUpdateInterval);
			this.elapsedUpdateInterval = null;
		}
		this.currentTrackedTasks = [];
	}

	/**
	 * Handle click on status bar - open task note(s)
	 */
	private async handleStatusBarClick(): Promise<void> {
		try {
			// Get tracked tasks
			const trackedTasks = await this.getTrackedTasks();

			if (trackedTasks.length === 0) {
				return;
			}

			if (trackedTasks.length === 1) {
				// Single tracked task - open its note directly
				const task = trackedTasks[0];
				const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
				if (file instanceof TFile) {
					await this.plugin.app.workspace.getLeaf(false).openFile(file);
				}
			} else {
				// Multiple tracked tasks - show selector modal
				openTaskSelector(this.plugin, trackedTasks, (selectedTask) => {
					void (async () => {
						if (selectedTask) {
							const file = this.plugin.app.vault.getAbstractFileByPath(
								selectedTask.path
							);
							if (file instanceof TFile) {
								await this.plugin.app.workspace.getLeaf(false).openFile(file);
							}
						}
					})();
				});
			}
		} catch (error) {
			tasknotesLogger.error("Error handling status bar click:", {
				category: "internal",
				operation: "handling-status-bar-click",
				error: error,
			});
		}
	}

	/**
	 * Request an update to the status bar (debounced)
	 */
	requestUpdate(): void {
		// Clear existing timeout
		if (this.updateTimeout) {
			window.clearTimeout(this.updateTimeout);
		}

		// Debounce updates to prevent excessive re-renders
		this.updateTimeout = window.setTimeout(() => {
			void this.updateStatusBar();
		}, 100);
	}

	requestPomodoroUpdate(): void {
		if (this.pomodoroUpdateTimeout) {
			window.clearTimeout(this.pomodoroUpdateTimeout);
		}

		this.pomodoroUpdateTimeout = window.setTimeout(() => {
			this.updatePomodoroStatusBar();
		}, 100);
	}

	/**
	 * Show or hide the status bar based on settings
	 */
	updateVisibility(): void {
		if (this.plugin.settings.showTrackedTasksInStatusBar) {
			if (!this.statusBarElement) {
				this.ensureTrackedStatusBarElement();
			} else {
				void this.updateStatusBar();
			}
		} else {
			this.hide();
		}

		if (this.plugin.settings.showPomodoroInStatusBar) {
			this.ensurePomodoroStatusBarElement();
			this.updatePomodoroStatusBar();
		} else {
			this.hidePomodoroStatusBar();
		}
	}

	/**
	 * Hide the status bar
	 */
	private hide(): void {
		this.stopElapsedTicker();
		if (this.statusBarElement) {
			this.statusBarElement.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.statusBarElement.classList.add("tn-static-display-none-6b99de8b");
		}
	}

	private hidePomodoroStatusBar(): void {
		if (this.pomodoroStatusBarElement) {
			this.pomodoroStatusBarElement.classList.remove(
				"tn-static-display-block-2a1b75c9",
				"tn-static-display-flex-4d51fc62",
				"tn-static-display-flex-75816cae",
				"tn-static-display-flex-8bb39979",
				"tn-static-display-inline-block-60e32dcb",
				"tn-static-display-inline-cccfa456",
				"tn-static-display-inline-flex-f984c520",
				"tn-static-min-height-800px-997b4c8c"
			);
			this.pomodoroStatusBarElement.classList.add("tn-static-display-none-6b99de8b");
		}
	}

	/**
	 * Cleanup when service is destroyed
	 */
	destroy(): void {
		if (this.updateTimeout) {
			window.clearTimeout(this.updateTimeout);
			this.updateTimeout = null;
		}
		if (this.pomodoroUpdateTimeout) {
			window.clearTimeout(this.pomodoroUpdateTimeout);
			this.pomodoroUpdateTimeout = null;
		}
		this.stopElapsedTicker();
		if (this.plugin.emitter?.offref) {
			this.pomodoroEventRefs.forEach((ref) => this.plugin.emitter.offref(ref));
		}
		this.pomodoroEventRefs = [];

		if (this.requestDeduplicator) {
			this.requestDeduplicator.cancelAll();
		}

		// Status bar element is automatically cleaned up by Obsidian when plugin unloads
		this.statusBarElement = null;
		this.pomodoroStatusBarElement = null;
	}
}
