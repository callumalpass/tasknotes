import { ItemView, WorkspaceLeaf, Notice, EventRef, setTooltip } from "obsidian";
import TaskNotesPlugin from "../main";
import {
	POMODORO_VIEW_TYPE,
	EVENT_POMODORO_START,
	EVENT_POMODORO_COMPLETE,
	EVENT_POMODORO_INTERRUPT,
	EVENT_POMODORO_TICK,
	EVENT_TASK_UPDATED,
	PomodoroSession,
	PomodoroState,
	TaskInfo,
} from "../types";
import { openTaskSelector } from "../modals/TaskSelectorWithCreateModal";
import { createTaskCard } from "../ui/TaskCard";
import { convertInternalToUserProperties } from "../utils/propertyMapping";
import { getTaskWithInstanceStatus, isTaskInstanceCompleted } from "../utils/taskInstanceStatus";
import {
	formatPomodoroTime,
	getProjectedPomodoroEndTimeMs,
	getSessionDurationSeconds,
	getSessionRemainingSeconds,
	parsePomodoroDurationInput,
} from "../utils/pomodoroTime";
import { formatTime } from "../utils/dateUtils";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Views/PomodoroView" });

export interface PomodoroLayoutSize {
	width: number;
	height: number;
}

function hasUsablePomodoroLayoutSize(size: PomodoroLayoutSize): boolean {
	return size.width > 0 && size.height > 0;
}

export function getCachedUnarchivedPomodoroTasks(plugin: TaskNotesPlugin): TaskInfo[] {
	const taskPaths = plugin.cacheManager.getAllTaskPaths();
	const tasks: TaskInfo[] = [];

	for (const path of taskPaths) {
		const task = plugin.cacheManager.getCachedTaskInfoSync(path);
		if (task && !task.archived) {
			tasks.push(task);
		}
	}

	return tasks;
}

export function resolvePomodoroLayoutSize(
	viewportSize: PomodoroLayoutSize,
	contentSize: PomodoroLayoutSize
): PomodoroLayoutSize {
	if (hasUsablePomodoroLayoutSize(viewportSize)) {
		return viewportSize;
	}

	return contentSize;
}

export class PomodoroView extends ItemView {
	plugin: TaskNotesPlugin;

	// UI elements
	private timerDisplay: HTMLElement | null = null;
	private timerInput: HTMLInputElement | null = null;
	private statusDisplay: HTMLElement | null = null;
	private sessionMetaDisplay: HTMLElement | null = null;
	private progressCircle: SVGCircleElement | null = null;
	private progressContainer: HTMLElement | null = null;
	private startButton: HTMLButtonElement | null = null;
	private pauseButton: HTMLButtonElement | null = null;
	private stopButton: HTMLButtonElement | null = null;
	private taskDisplay: HTMLElement | null = null;
	private statsDisplay: HTMLElement | null = null;
	private taskSelectButton: HTMLButtonElement | null = null;
	private taskClearButton: HTMLButtonElement | null = null;
	private currentSelectedTask: TaskInfo | null = null;
	private taskCardContainer: HTMLElement | null = null;
	private addTimeButton: HTMLButtonElement | null = null;
	private subtractTimeButton: HTMLButtonElement | null = null;
	private skipBreakButton: HTMLButtonElement | null = null;
	private isEditingTimer = false;
	private isTaskSelectorOpen = false;
	private todaysPomodoros = 0;

	// Cache stat elements to avoid innerHTML
	private statElements: {
		pomodoros: HTMLElement | null;
	} = { pomodoros: null };

	// Resize handling
	private resizeObserver: ResizeObserver | null = null;
	private resizeTimeout: number | null = null;
	private resizeWindow: Window | null = null;
	private functionListeners: (() => void)[] = [];
	private currentCircleSize = 300;
	private currentCircumference = 0;
	private lastLayoutSize: PomodoroLayoutSize | null = null;
	private responsiveClass: string | null = null;
	private workspaceListeners: EventRef[] = [];
	private visibilityObserver: IntersectionObserver | null = null;
	private wasVisible = false;
	private isClosed = false;
	private openGeneration = 0;
	private displayStateKey: string | null = null;
	private taskCardDirty = false;

	// Event listeners
	private listeners: EventRef[] = [];

	private refreshStats(): void {
		this.updateStats().catch((error) => {
			tasknotesLogger.error("Failed to update stats:", {
				category: "validation",
				operation: "update-stats",
				error: error,
			});
		});
	}

	constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
		super(leaf);
		this.plugin = plugin;

		// Register event listeners
		this.registerEvents();
	}

	getViewType(): string {
		return POMODORO_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.plugin.i18n.translate("views.pomodoro.title");
	}

	getIcon(): string {
		return "clock";
	}

	private t(key: string, params?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, params);
	}

	registerEvents(): void {
		// Clean up any existing listeners
		this.listeners.forEach((listener) => this.plugin.emitter.offref(listener));
		this.listeners = [];

		// Listen for pomodoro events
		const startListener = this.plugin.emitter.on(EVENT_POMODORO_START, ({ session, task }) => {
			this.updateDisplay(session, task);
		});
		this.listeners.push(startListener);

		const completeListener = this.plugin.emitter.on(
			EVENT_POMODORO_COMPLETE,
			({ session, nextType }) => {
				this.onPomodoroComplete(session, nextType);
			}
		);
		this.listeners.push(completeListener);

		const interruptListener = this.plugin.emitter.on(EVENT_POMODORO_INTERRUPT, () => {
			this.updateDisplay(undefined, undefined, { refreshStats: true });
		});
		this.listeners.push(interruptListener);

		const tickListener = this.plugin.emitter.on(EVENT_POMODORO_TICK, ({ session }) => {
			this.updateDisplay(session);
		});
		this.listeners.push(tickListener);

		// Listen for task updates to refresh the selected task card
		const taskUpdateListener = this.plugin.emitter.on(
			EVENT_TASK_UPDATED,
			async ({ path, originalTask, updatedTask }) => {
				if (!path || !updatedTask) return;

				// Check if this is the currently selected task in pomodoro view
				// We need to check both the new path and the original path in case of filename changes
				const isCurrentSelectedTask =
					this.currentSelectedTask &&
					(this.currentSelectedTask.path === path ||
						(originalTask && this.currentSelectedTask.path === originalTask.path));

				if (isCurrentSelectedTask) {
					// Update the selected task and refresh the task card
					this.currentSelectedTask = updatedTask;
					this.updateTaskCardDisplay(updatedTask);

					// If there's a current pomodoro session and this task's path changed,
					// update the session's task path to the new path
					const state = this.plugin.pomodoroService.getState();
					if (
						state.currentSession &&
						originalTask &&
						originalTask.path !== updatedTask.path &&
						state.currentSession.taskPath === originalTask.path
					) {
						await this.plugin.pomodoroService.assignTaskToCurrentSession(updatedTask);
					}
				}
			}
		);
		this.listeners.push(taskUpdateListener);
	}

	async onOpen() {
		this.isClosed = false;
		const generation = ++this.openGeneration;
		await this.plugin.onReady();
		if (this.isClosed || generation !== this.openGeneration) return;
		this.registerEvents();
		await this.render();
		if (this.isClosed || generation !== this.openGeneration) return;
		// Observers also handle initially hidden/zero-size panes; no retry timers needed.
		this.setupResizeHandling();
	}

	onResize(): void {
		// Obsidian can move an existing leaf between the main window and a popout.
		if (this.resizeWindow && this.resizeWindow !== this.contentEl.ownerDocument.defaultView) {
			this.setupResizeHandling();
			return;
		}
		this.handleVisibilityChange();
		this.updateResponsiveLayout();
	}

	private isViewVisible(): boolean {
		return (
			!this.isClosed &&
			this.contentEl.ownerDocument.visibilityState !== "hidden" &&
			this.contentEl.isShown()
		);
	}

	private handleVisibilityChange(): void {
		if (this.isClosed) return;
		const visible = this.isViewVisible();
		if (visible === this.wasVisible) return;
		this.wasVisible = visible;
		this.contentEl
			.querySelector(".pomodoro-view")
			?.classList.toggle("pomodoro-view--rendering-paused", !visible);
		if (visible) {
			this.displayStateKey = null;
			this.updateDisplay();
			if (this.taskCardDirty) this.updateTaskCardDisplay(this.currentSelectedTask);
		}
	}

	async onClose() {
		this.isClosed = true;
		this.openGeneration++;
		this.wasVisible = false;
		this.displayStateKey = null;
		this.lastLayoutSize = null;
		this.responsiveClass = null;
		this.currentCircleSize = 300;
		this.currentCircumference = 0;
		this.taskCardDirty = false;
		this.visibilityObserver?.disconnect();
		this.visibilityObserver = null;
		// Clean up resize handling
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		if (this.resizeTimeout !== null) {
			(this.resizeWindow || window).clearTimeout(this.resizeTimeout);
			this.resizeTimeout = null;
		}

		this.resizeWindow = null;

		// Each event reference must be removed from its owning emitter.
		this.listeners.forEach((listener) => this.plugin.emitter.offref(listener));
		this.listeners = [];
		this.workspaceListeners.forEach((listener) => this.plugin.app.workspace.offref(listener));
		this.workspaceListeners = [];
		this.functionListeners.forEach((unsubscribe) => unsubscribe());
		this.functionListeners = [];

		// Clear cached references to prevent memory leaks
		this.timerDisplay = null;
		this.timerInput = null;
		this.statusDisplay = null;
		this.sessionMetaDisplay = null;
		this.progressCircle = null;
		this.progressContainer = null;
		this.startButton = null;
		this.pauseButton = null;
		this.stopButton = null;
		this.taskDisplay = null;
		this.statsDisplay = null;
		this.taskSelectButton = null;
		this.taskClearButton = null;
		this.currentSelectedTask = null;
		this.taskCardContainer = null;
		this.addTimeButton = null;
		this.subtractTimeButton = null;
		this.skipBreakButton = null;
		this.isEditingTimer = false;
		this.statElements = { pomodoros: null };

		this.contentEl.empty();
	}

	async render() {
		const container = this.contentEl.createDiv({ cls: "tasknotes-plugin pomodoro-view" });

		// Timer display with progress circle
		const timerSection = container.createDiv({ cls: "pomodoro-view__timer-section" });

		const timerHeader = timerSection.createDiv({ cls: "pomodoro-view__timer-header" });
		this.statusDisplay = timerHeader.createDiv({
			cls: "pomodoro-view__status",
			text: this.t("views.pomodoro.status.ready"),
		});
		this.sessionMetaDisplay = timerHeader.createDiv({
			cls: "pomodoro-view__session-meta",
		});

		// Create progress circle container
		this.progressContainer = timerSection.createDiv({
			cls: "pomodoro-view__progress-container",
		});

		// Create SVG progress circle
		const svg = activeWindow.createSvg("svg");
		svg.setAttribute("class", "pomodoro-view__progress-svg");
		svg.setAttribute("width", "300");
		svg.setAttribute("height", "300");
		svg.setAttribute("viewBox", "0 0 300 300");
		this.progressContainer.appendChild(svg);

		// Background circle
		const bgCircle = activeWindow.createSvg("circle");
		bgCircle.setAttributeNS(null, "cx", "150");
		bgCircle.setAttributeNS(null, "cy", "150");
		bgCircle.setAttributeNS(null, "r", "140");
		bgCircle.setAttributeNS(null, "fill", "none");
		bgCircle.setAttributeNS(null, "stroke", "var(--tn-border-color)");
		bgCircle.setAttributeNS(null, "stroke-width", "2");
		svg.appendChild(bgCircle);

		// Progress circle
		this.progressCircle = activeWindow.createSvg("circle");
		this.progressCircle.setAttributeNS(null, "cx", "150");
		this.progressCircle.setAttributeNS(null, "cy", "150");
		this.progressCircle.setAttributeNS(null, "r", "140");
		this.progressCircle.setAttributeNS(null, "fill", "none");
		this.progressCircle.setAttributeNS(null, "stroke", "var(--tn-interactive-accent)");
		this.progressCircle.setAttributeNS(null, "stroke-width", "4");
		this.progressCircle.setAttributeNS(null, "stroke-linecap", "round");

		// Calculate circumference: 2 * π * radius
		const radius = 140;
		const circumference = 2 * Math.PI * radius;

		this.progressCircle.setAttributeNS(null, "stroke-dasharray", circumference.toString());
		this.progressCircle.setAttributeNS(null, "stroke-dashoffset", circumference.toString());
		this.progressCircle.addClass("pomodoro-view__progress-circle");
		svg.appendChild(this.progressCircle);

		// Timer display overlay
		const timerOverlay = this.progressContainer.createDiv({
			cls: "pomodoro-view__timer-overlay",
		});

		// Timer display
		const defaultDuration = this.plugin.settings.pomodoroWorkDuration;
		const defaultTime = `${defaultDuration.toString().padStart(2, "0")}:00`;
		this.timerDisplay = timerOverlay.createDiv({
			cls: "pomodoro-view__timer-display",
			text: defaultTime,
		});
		this.timerDisplay.tabIndex = 0;
		this.timerDisplay.setAttribute("role", "button");
		this.timerDisplay.setAttribute("aria-label", this.t("views.pomodoro.timer.editLabel"));

		this.timerInput = timerOverlay.createEl("input", {
			cls: "pomodoro-view__timer-input pomodoro-view__timer-input--hidden",
			attr: {
				type: "text",
				inputmode: "numeric",
				"aria-label": this.t("views.pomodoro.timer.inputLabel"),
			},
		});

		// Time adjustment controls
		const timeControls = timerOverlay.createDiv({ cls: "pomodoro-view__time-controls" });

		this.subtractTimeButton = timeControls.createEl("button", {
			cls: "pomodoro-view__time-adjust-button pomodoro-view__subtract-time",
			text: "-1m",
		});
		this.subtractTimeButton.setAttribute(
			"aria-label",
			this.t("views.pomodoro.buttons.subtractMinute")
		);
		// Don't hide initially since we want them always visible

		this.addTimeButton = timeControls.createEl("button", {
			cls: "pomodoro-view__time-adjust-button pomodoro-view__add-time",
			text: "+1m",
		});
		this.addTimeButton.setAttribute("aria-label", this.t("views.pomodoro.buttons.addMinute"));
		// Don't hide initially since we want them always visible

		// Task display (minimal)
		this.taskDisplay = container.createDiv({ cls: "pomodoro-view__task-display" });

		// Task selector section
		const taskSelectorSection = container.createDiv({ cls: "pomodoro-view__task-selector" });

		// Task selector buttons container
		const taskButtonsContainer = taskSelectorSection.createDiv({
			cls: "pomodoro-view__task-buttons",
		});

		this.taskSelectButton = taskButtonsContainer.createEl("button", {
			cls: "pomodoro-view__task-select-button",
			text: this.t("views.pomodoro.buttons.chooseTask"),
		});

		this.taskClearButton = taskButtonsContainer.createEl("button", {
			cls: "pomodoro-view__task-clear-button pomodoro-view__task-clear-button--hidden",
			text: this.t("views.pomodoro.buttons.clearTask"),
		});

		// Task card container
		this.taskCardContainer = taskSelectorSection.createDiv({
			cls: "pomodoro-view__task-card-container",
		});

		// Main control section - simplified
		const controlSection = container.createDiv({ cls: "pomodoro-view__control-section" });

		// Primary controls (main timer controls)
		const primaryControls = controlSection.createDiv({
			cls: "pomodoro-view__primary-controls",
		});

		this.startButton = primaryControls.createEl("button", {
			text: this.t("views.pomodoro.buttons.startFocus"),
			cls: "pomodoro-view__start-button",
		});

		this.pauseButton = primaryControls.createEl("button", {
			text: this.t("views.pomodoro.buttons.pause"),
			cls: "pomodoro-view__pause-button",
		});
		this.pauseButton.addClass("pomodoro-view__pause-button--hidden");

		this.stopButton = primaryControls.createEl("button", {
			text: this.t("views.pomodoro.buttons.stop"),
			cls: "pomodoro-view__stop-button",
		});
		this.stopButton.addClass("pomodoro-view__stop-button--hidden");

		// Skip break button (only shown after sessions)
		this.skipBreakButton = controlSection.createEl("button", {
			cls: "pomodoro-view__skip-break-button",
			text: this.t("views.pomodoro.buttons.skipBreak"),
		});
		this.skipBreakButton.addClass("pomodoro-view__skip-break-button--hidden");

		// Minimal stats at the bottom
		const statsSection = container.createDiv({ cls: "pomodoro-view__stats-section" });

		this.statsDisplay = statsSection.createDiv({ cls: "pomodoro-view__stats" });

		// Create minimal stat elements
		const pomodoroStat = this.statsDisplay.createDiv({
			cls: "pomodoro-view__stat pomodoro-view__stat--clickable",
		});
		this.statElements.pomodoros = pomodoroStat.createSpan({
			cls: "pomodoro-view__stat-value",
			text: "0",
		});
		pomodoroStat.createSpan({
			cls: "pomodoro-view__stat-label",
			text: this.t("views.pomodoro.statsLabel"),
		});

		// Make the stat clickable to open stats view
		this.registerDomEvent(pomodoroStat, "click", () => {
			void this.plugin.activatePomodoroStatsView();
		});

		// Add event listeners
		this.registerDomEvent(this.startButton, "click", async () => {
			if (this.startButton?.hasClass("is-loading")) return;
			this.startButton?.addClass("pomodoro-view__start-button--loading");

			try {
				const state = this.plugin.pomodoroService.getState();
				if (state.currentSession && !state.isRunning) {
					await this.plugin.pomodoroService.resumePomodoro();
				} else {
					// No active session - start the type indicated by nextSessionType
					if (state.nextSessionType === "short-break") {
						await this.plugin.pomodoroService.startBreak(false);
					} else if (state.nextSessionType === "long-break") {
						await this.plugin.pomodoroService.startBreak(true);
					} else {
						// Default to work session
						await this.plugin.pomodoroService.startPomodoro(
							this.currentSelectedTask || undefined
						);
					}
				}
			} finally {
				this.startButton?.removeClass("pomodoro-view__start-button--loading");
			}
		});

		this.registerDomEvent(this.pauseButton, "click", () => {
			void this.plugin.pomodoroService.pausePomodoro();
		});

		this.registerDomEvent(this.stopButton, "click", () => {
			void this.plugin.pomodoroService.stopPomodoro();
		});

		this.registerDomEvent(this.skipBreakButton, "click", () => {
			const state = this.plugin.pomodoroService.getState();
			if (state.currentSession) {
				// Currently in a break session, stop it
				void this.plugin.pomodoroService.stopPomodoro();
			} else if (
				state.nextSessionType === "short-break" ||
				state.nextSessionType === "long-break"
			) {
				// Break is prepared but user wants to skip, clear the break and prepare work
				void this.plugin.pomodoroService.skipBreak();
			}
		});

		this.registerDomEvent(this.addTimeButton, "click", () => {
			this.adjustSessionTime(60);
		});

		this.registerDomEvent(this.subtractTimeButton, "click", () => {
			this.adjustSessionTime(-60);
		});

		this.registerDomEvent(this.timerDisplay, "click", () => {
			this.beginTimerEdit();
		});

		this.registerDomEvent(this.timerDisplay, "keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				this.beginTimerEdit();
			}
		});

		this.registerDomEvent(this.timerInput, "keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				this.commitTimerEdit();
			} else if (event.key === "Escape") {
				event.preventDefault();
				this.cancelTimerEdit();
			}
		});

		this.registerDomEvent(this.timerInput, "blur", () => {
			this.commitTimerEdit();
		});

		this.registerDomEvent(this.taskSelectButton, "click", async () => {
			await this.openTaskSelector();
		});

		this.registerDomEvent(this.taskClearButton, "click", async () => {
			await this.selectTask(null);
		});

		// Load and restore last selected task
		void this.restoreLastSelectedTask();

		// Initial display update
		this.updateDisplay();
		this.refreshStats();
	}

	private setupResizeHandling(): void {
		if (this.isClosed) return;
		const win = this.contentEl.ownerDocument.defaultView || window;
		this.resizeObserver?.disconnect();
		this.visibilityObserver?.disconnect();
		if (this.resizeTimeout !== null) {
			(this.resizeWindow || win).clearTimeout(this.resizeTimeout);
			this.resizeTimeout = null;
		}
		this.resizeWindow = win;
		this.lastLayoutSize = null;
		this.workspaceListeners.forEach((listener) => this.plugin.app.workspace.offref(listener));
		this.workspaceListeners = [];
		this.functionListeners.forEach((unsubscribe) => unsubscribe());
		this.functionListeners = [];

		const scheduleLayout = () => {
			if (this.isClosed || this.resizeWindow !== win) return;
			this.handleVisibilityChange();
			if (this.resizeTimeout !== null) win.clearTimeout(this.resizeTimeout);
			this.resizeTimeout = win.setTimeout(() => {
				this.resizeTimeout = null;
				this.handleVisibilityChange();
				this.updateResponsiveLayout();
			}, 150);
		};
		if (win.ResizeObserver) {
			this.resizeObserver = new win.ResizeObserver(scheduleLayout);
			this.resizeObserver.observe(this.contentEl);
		}
		if (win.IntersectionObserver) {
			this.visibilityObserver = new win.IntersectionObserver(scheduleLayout);
			this.visibilityObserver.observe(this.contentEl);
		}
		this.workspaceListeners.push(
			this.plugin.app.workspace.on("layout-change", scheduleLayout),
			this.plugin.app.workspace.on("active-leaf-change", scheduleLayout)
		);
		const doc = this.contentEl.ownerDocument;
		doc.addEventListener("visibilitychange", scheduleLayout);
		win.addEventListener("resize", scheduleLayout);
		this.functionListeners.push(
			() => doc.removeEventListener("visibilitychange", scheduleLayout),
			() => win.removeEventListener("resize", scheduleLayout)
		);
		this.handleVisibilityChange();
		this.updateResponsiveLayout();
	}

	private updateResponsiveLayout(): void {
		if (!this.isViewVisible()) return;
		const pomodoroContainer = this.contentEl.querySelector(".pomodoro-view") as HTMLElement;
		if (!pomodoroContainer) return;

		const containerRect = pomodoroContainer.getBoundingClientRect();
		const viewportRect = this.contentEl.getBoundingClientRect();
		const { width: containerWidth, height: containerHeight } = resolvePomodoroLayoutSize(
			{ width: viewportRect.width, height: viewportRect.height },
			{ width: containerRect.width, height: containerRect.height }
		);

		if (containerWidth <= 0 || containerHeight <= 0) return;
		if (
			this.lastLayoutSize?.width === containerWidth &&
			this.lastLayoutSize.height === containerHeight
		)
			return;
		this.lastLayoutSize = { width: containerWidth, height: containerHeight };

		// Calculate a responsive scale factor based on both width and height
		// Use the smaller dimension as the limiting factor, but weight width more heavily
		const widthScale = Math.min(containerWidth / 600, 1); // 600px is our "ideal" width
		const heightScale = Math.min(containerHeight / 800, 1); // 800px is our "ideal" height
		const responsiveScale = Math.min(widthScale * 0.7 + heightScale * 0.3, 1); // Weight width 70%, height 30%

		const breakpoints: [number, string][] = [
			[200, "tiny"],
			[250, "extra-narrow"],
			[300, "very-narrow"],
			[350, "narrow"],
			[400, "small"],
			[500, "medium-small"],
			[600, "medium"],
		];
		const size = breakpoints.find(([width]) => containerWidth <= width)?.[1] ?? "wide";
		const nextClass = `pomodoro-view--${size}`;
		if (nextClass !== this.responsiveClass) {
			if (this.responsiveClass) pomodoroContainer.classList.remove(this.responsiveClass);
			pomodoroContainer.classList.add(nextClass);
			this.responsiveClass = nextClass;
		}
		// CSS owns typography, shared by the timer label and editable input.
		pomodoroContainer.style.setProperty("--pomodoro-scale", responsiveScale.toString());

		// Update progress circle size based on available space
		this.updateProgressCircleSize(containerWidth, containerHeight);
	}

	private updateProgressCircleSize(containerWidth: number, containerHeight: number): void {
		if (!this.progressContainer) return;

		const svg = this.progressContainer.querySelector(
			".pomodoro-view__progress-svg"
		) as SVGElement;
		if (!svg) return;

		// Calculate optimal size based on both container width and height
		// Use the smaller dimension but consider both
		const availableSpace = Math.min(containerWidth * 0.8, containerHeight * 0.4); // Leave margins

		let size: number;
		if (containerWidth <= 200) {
			size = Math.max(120, Math.min(availableSpace, containerWidth - 40)); // Tiny: very small circle
		} else if (containerWidth <= 250) {
			size = Math.max(150, Math.min(availableSpace, containerWidth - 50)); // Extra narrow: small circle
		} else if (containerWidth <= 300) {
			size = Math.max(180, Math.min(availableSpace, containerWidth - 60)); // Very narrow: compact circle
		} else if (containerWidth <= 350) {
			size = Math.max(200, Math.min(availableSpace, containerWidth - 70)); // Narrow: medium-small circle
		} else if (containerWidth <= 400) {
			size = Math.max(230, Math.min(availableSpace, containerWidth - 80)); // Small: medium circle
		} else if (containerWidth <= 500) {
			size = Math.max(250, Math.min(availableSpace, containerWidth - 100)); // Medium-small: larger circle
		} else if (containerWidth <= 600) {
			size = Math.max(280, Math.min(availableSpace, 300)); // Medium: standard size
		} else {
			size = Math.max(300, Math.min(availableSpace, containerWidth * 0.5, 400)); // Wide: up to 400px
		}

		// Only update if size has changed to prevent unnecessary DOM manipulation
		if (size === this.currentCircleSize) {
			return;
		}

		this.currentCircleSize = size;

		// Update SVG and container dimensions
		svg.setAttribute("width", size.toString());
		svg.setAttribute("height", size.toString());
		svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

		this.progressContainer.style.width = `${size}px`;
		this.progressContainer.style.height = `${size}px`;

		// Update circle positions and radius
		const center = size / 2;
		const radius = center - 20; // Leave some margin for stroke

		const circles = svg.querySelectorAll("circle");
		circles.forEach((circle) => {
			circle.setAttribute("cx", center.toString());
			circle.setAttribute("cy", center.toString());
			circle.setAttribute("r", radius.toString());
		});

		// Update stroke-dasharray for progress circle and store the new circumference
		if (this.progressCircle) {
			const circumference = 2 * Math.PI * radius;
			this.currentCircumference = circumference;
			this.progressCircle.setAttribute("stroke-dasharray", circumference.toString());
			// Reset stroke-dashoffset to full circumference (no progress)
			this.progressCircle.setAttribute("stroke-dashoffset", circumference.toString());

			// Re-apply current progress with new circumference
			if (this.plugin.pomodoroService) {
				const state = this.plugin.pomodoroService.getState();
				this.updateProgress(state);
			}
		}
	}

	private async openTaskSelector() {
		if (this.isTaskSelectorOpen) {
			return;
		}

		this.isTaskSelectorOpen = true;

		try {
			const unarchivedTasks = getCachedUnarchivedPomodoroTasks(this.plugin);
			const targetDate = new Date();

			if (unarchivedTasks.length === 0) {
				new Notice(this.t("views.pomodoro.notices.noTasks"));
				this.isTaskSelectorOpen = false;
				return;
			}

			// Open task selector modal
			openTaskSelector(
				this.plugin,
				unarchivedTasks,
				(selectedTask) => {
					this.isTaskSelectorOpen = false;
					void this.selectTask(selectedTask);
				},
				{ targetDate }
			);
		} catch (error) {
			this.isTaskSelectorOpen = false;
			tasknotesLogger.error("Error opening task selector:", {
				category: "persistence",
				operation: "opening-task-selector",
				error: error,
			});
			new Notice(this.t("views.pomodoro.notices.loadFailed"));
		}
	}

	private async selectTask(task: TaskInfo | null) {
		if (this.isClosed) return;
		this.currentSelectedTask = task;
		this.updateTaskCardDisplay(task);
		await this.plugin.pomodoroService.saveLastSelectedTask(task?.path);
		if (this.isClosed) return;
		const state = this.plugin.pomodoroService.getState();
		if (state.currentSession && state.currentSession.type === "work") {
			await this.plugin.pomodoroService.assignTaskToCurrentSession(task || undefined);
		}
	}

	private updateTaskCardDisplay(task: TaskInfo | null) {
		if (!this.isViewVisible()) {
			this.taskCardDirty = true;
			return;
		}
		if (!this.taskCardContainer) return;
		this.taskCardDirty = false;
		// Update button text - keep it simple since we have the task card
		if (this.taskSelectButton) {
			if (task) {
				this.taskSelectButton.textContent = this.t("views.pomodoro.buttons.changeTask");
				setTooltip(
					this.taskSelectButton,
					this.t("views.pomodoro.buttons.selectDifferentTask"),
					{ placement: "top" }
				);
				this.taskSelectButton.removeClass("pomodoro-view__task-select-button--no-task");
			} else {
				this.taskSelectButton.textContent = this.t("views.pomodoro.buttons.chooseTask");
				// Remove tooltip for no-task state
				this.taskSelectButton.removeAttribute("title");
				this.taskSelectButton.addClass("pomodoro-view__task-select-button--no-task");
			}
		}

		// Update clear button visibility
		if (this.taskClearButton) {
			if (task) {
				this.taskClearButton.removeClass("pomodoro-view__task-clear-button--hidden");
			} else {
				this.taskClearButton.addClass("pomodoro-view__task-clear-button--hidden");
			}
		}

		// Clear existing content
		this.taskCardContainer.empty();

		if (task) {
			// Create a task card with appropriate options for pomodoro view
			// Convert internal property names to user-configured frontmatter property names
			const visibleProperties = this.plugin.settings.defaultVisibleProperties
				? convertInternalToUserProperties(
						this.plugin.settings.defaultVisibleProperties,
						this.plugin
					)
				: undefined;
			const targetDate = new Date();
			const displayTask = getTaskWithInstanceStatus(
				task,
				targetDate,
				this.plugin.statusManager,
				this.plugin.settings.defaultTaskStatus
			);
			const taskCard = createTaskCard(displayTask, this.plugin, visibleProperties, {
				targetDate,
			});

			// Add the task card to the container
			this.taskCardContainer.appendChild(taskCard);
			this.taskCardContainer.removeClass("pomodoro-view__task-card-container--empty");
		} else {
			this.taskCardContainer.addClass("pomodoro-view__task-card-container--empty");
		}
	}

	private async restoreLastSelectedTask() {
		const generation = this.openGeneration;
		try {
			// Check if pomodoroService is available
			if (!this.plugin.pomodoroService) {
				return;
			}

			const lastTaskPath = await this.plugin.pomodoroService.getLastSelectedTaskPath();
			if (lastTaskPath && !this.isClosed && generation === this.openGeneration) {
				// Use the optimized getTaskByPath method
				const task = await this.plugin.cacheManager.getTaskByPath(lastTaskPath);

				if (
					!this.isClosed &&
					generation === this.openGeneration &&
					task &&
					!isTaskInstanceCompleted(
						task,
						new Date(),
						this.plugin.statusManager,
						this.plugin.settings.defaultTaskStatus
					) &&
					!task.archived
				) {
					await this.selectTask(task);
				}
			}
		} catch (error) {
			tasknotesLogger.error("Error restoring last selected task:", {
				category: "persistence",
				operation: "restoring-last-selected-task",
				error: error,
			});
			// Don't let this error stop the render process
		}
	}

	private async updateTaskButtonFromPath(taskPath: string) {
		const generation = this.openGeneration;
		try {
			// Use the cache manager as the single source of truth
			const task = await this.plugin.cacheManager.getTaskInfo(taskPath);

			if (
				this.isClosed ||
				generation !== this.openGeneration ||
				this.plugin.pomodoroService.getState().currentSession?.taskPath !== taskPath
			)
				return;
			this.currentSelectedTask = task ?? null;
			this.updateTaskCardDisplay(this.currentSelectedTask);
		} catch (error) {
			tasknotesLogger.error("Error updating task button from path:", {
				category: "persistence",
				operation: "updating-task-button-path",
				error: error,
			});
		}
	}

	private updateDisplay(
		session?: PomodoroSession,
		task?: TaskInfo,
		options: { refreshStats?: boolean } = {}
	) {
		if (this.isClosed) return;
		if (options.refreshStats) this.refreshStats();
		if (!this.isViewVisible()) {
			this.displayStateKey = null;
			return;
		}
		// Check if pomodoroService is available
		if (!this.plugin.pomodoroService) {
			// Set default UI state when service is not available
			if (this.statusDisplay) {
				this.statusDisplay.textContent = this.t("views.pomodoro.status.ready");
				this.statusDisplay.className = "pomodoro-status pomodoro-view__status";
			}
			return;
		}

		const nowMs = Date.now();
		const state = this.plugin.pomodoroService.getState();
		// One timestamp and remaining-time snapshot drives all countdown output,
		// including the first render after a hidden/backgrounded pane is shown.
		if (state.isRunning && state.currentSession) {
			state.timeRemaining = getSessionRemainingSeconds(state.currentSession, nowMs);
		}
		this.updateTimer(state.timeRemaining);
		this.updateProgress(state);
		this.updateSessionMeta(state, nowMs);

		const stateKey = JSON.stringify([
			state.isRunning,
			state.currentSession?.id,
			state.currentSession?.type,
			state.currentSession?.taskPath,
			state.nextSessionType,
		]);
		if (stateKey === this.displayStateKey) return;
		this.displayStateKey = stateKey;
		if (
			this.statElements.pomodoros &&
			this.statElements.pomodoros.textContent !== this.todaysPomodoros.toString()
		) {
			this.statElements.pomodoros.textContent = this.todaysPomodoros.toString();
		}
		this.contentEl
			.querySelector(".pomodoro-view")
			?.classList.toggle("pomodoro-view--rendering-paused", !state.isRunning);

		// Only state transitions touch controls, status and task selection.
		// Update status
		if (this.statusDisplay) {
			if (state.isRunning && state.currentSession) {
				const typeText =
					state.currentSession.type === "work"
						? this.t("views.pomodoro.status.focus")
						: state.currentSession.type === "short-break"
							? this.t("views.pomodoro.status.shortBreak")
							: this.t("views.pomodoro.status.longBreak");
				this.statusDisplay.textContent = typeText;
				this.statusDisplay.className = `pomodoro-status pomodoro-view__status pomodoro-status-${state.currentSession.type} pomodoro-view__status--${state.currentSession.type}`;
			} else if (state.currentSession && !state.isRunning) {
				this.statusDisplay.textContent = this.t("views.pomodoro.status.paused");
				this.statusDisplay.className = `pomodoro-status pomodoro-view__status pomodoro-status-paused pomodoro-view__status--paused`;
			} else {
				this.statusDisplay.textContent = this.t("views.pomodoro.status.ready");
				this.statusDisplay.className = "pomodoro-status pomodoro-view__status";
			}
		}

		// Update task display only if task info changed
		if (this.taskDisplay) {
			const currentTaskPath = state.currentSession?.taskPath;
			const currentDisplayPath = this.taskDisplay.dataset.currentTaskPath;

			if (currentTaskPath !== currentDisplayPath) {
				this.taskDisplay.empty();
				this.taskDisplay.dataset.currentTaskPath = currentTaskPath || "";

				// We now show task info in the task card instead of here
				// Keep this section minimal or remove content entirely since we have the task card
			}
		}

		// Update task selector button to reflect current session
		if (this.taskSelectButton) {
			if (
				state.currentSession?.taskPath &&
				state.currentSession.taskPath !== this.currentSelectedTask?.path
			) {
				// Try to get the task info for display
				void this.updateTaskButtonFromPath(state.currentSession.taskPath);
			}
		}

		// Update button visibility
		if (this.startButton && this.pauseButton && this.stopButton) {
			if (state.isRunning) {
				this.startButton.addClass("pomodoro-view__start-button--hidden");
				this.pauseButton.removeClass("pomodoro-view__pause-button--hidden");
				this.stopButton.removeClass("pomodoro-view__stop-button--hidden");
			} else if (state.currentSession) {
				// Paused
				this.startButton.removeClass("pomodoro-view__start-button--hidden");
				this.startButton.textContent = this.t("views.pomodoro.buttons.resume");
				this.pauseButton.addClass("pomodoro-view__pause-button--hidden");
				this.stopButton.removeClass("pomodoro-view__stop-button--hidden");
			} else {
				// Idle - no active session
				this.startButton.removeClass("pomodoro-view__start-button--hidden");

				// Set button text based on next session type
				if (state.nextSessionType === "short-break") {
					this.startButton.textContent = this.t("views.pomodoro.buttons.startShortBreak");
				} else if (state.nextSessionType === "long-break") {
					this.startButton.textContent = this.t("views.pomodoro.buttons.startLongBreak");
				} else {
					this.startButton.textContent = this.t("views.pomodoro.buttons.startFocus");
				}

				this.pauseButton.addClass("pomodoro-view__pause-button--hidden");
				this.stopButton.addClass("pomodoro-view__stop-button--hidden");
			}
		}

		// Update skip break button visibility
		if (this.skipBreakButton) {
			// Show skip break button when:
			// 1. There's an active break session, OR
			// 2. A break is prepared to start (nextSessionType is a break)
			const isActiveBreak =
				state.currentSession &&
				(state.currentSession.type === "short-break" ||
					state.currentSession.type === "long-break");
			const isBreakPrepared =
				!state.currentSession &&
				(state.nextSessionType === "short-break" || state.nextSessionType === "long-break");

			if (isActiveBreak || isBreakPrepared) {
				this.skipBreakButton.removeClass("pomodoro-view__skip-break-button--hidden");
				this.skipBreakButton.textContent = this.t("views.pomodoro.buttons.skipBreak");
			} else {
				this.skipBreakButton.addClass("pomodoro-view__skip-break-button--hidden");
			}
		}

		// Update time adjustment button visibility - always show them
		if (this.addTimeButton && this.subtractTimeButton) {
			this.addTimeButton.removeClass("pomodoro-view__time-adjust-button--hidden");
			this.subtractTimeButton.removeClass("pomodoro-view__time-adjust-button--hidden");
		}

		if (this.timerDisplay) {
			if (this.canEditTimer()) {
				this.timerDisplay.addClass("pomodoro-view__timer-display--editable");
				this.timerDisplay.setAttribute("aria-disabled", "false");
			} else {
				this.timerDisplay.removeClass("pomodoro-view__timer-display--editable");
				this.timerDisplay.setAttribute("aria-disabled", "true");
			}
		}
	}

	private updateSessionMeta(state: PomodoroState, nowMs = Date.now()): void {
		if (!this.sessionMetaDisplay) {
			return;
		}

		const formattedTime = formatPomodoroTime(state.timeRemaining, { padMinutes: false });
		let text: string;

		if (state.currentSession) {
			const sessionLabel = this.getSessionTypeLabel(state.currentSession.type);
			if (state.isRunning) {
				const projectedEndTime = formatTime(
					new Date(getProjectedPomodoroEndTimeMs(state.timeRemaining, nowMs)),
					this.plugin.settings.calendarViewSettings.timeFormat
				);
				text = this.t("views.pomodoro.meta.running", {
					time: formattedTime,
					endTime: projectedEndTime,
				});
			} else {
				text = this.t("views.pomodoro.meta.paused", {
					type: sessionLabel,
					time: formattedTime,
				});
			}
		} else if (
			state.nextSessionType === "short-break" ||
			state.nextSessionType === "long-break"
		) {
			text = this.t("views.pomodoro.meta.breakReady", {
				type: this.getSessionTypeLabel(state.nextSessionType),
				time: formattedTime,
			});
		} else {
			text = this.t("views.pomodoro.meta.ready", {
				time: formattedTime,
				count: this.todaysPomodoros,
			});
		}

		if (this.sessionMetaDisplay.textContent !== text)
			this.sessionMetaDisplay.textContent = text;
	}

	private getSessionTypeLabel(type: PomodoroSession["type"]): string {
		if (type === "work") {
			return this.t("views.pomodoro.status.focus");
		}

		if (type === "short-break") {
			return this.t("views.pomodoro.status.shortBreak");
		}

		return this.t("views.pomodoro.status.longBreak");
	}

	private canEditTimer(): boolean {
		const state = this.plugin.pomodoroService?.getState();
		return Boolean(state && !state.isRunning);
	}

	private beginTimerEdit(): void {
		if (!this.timerDisplay || !this.timerInput || !this.plugin.pomodoroService) {
			return;
		}

		if (!this.canEditTimer()) {
			return;
		}

		const state = this.plugin.pomodoroService.getState();
		this.isEditingTimer = true;
		this.timerInput.value = formatPomodoroTime(state.timeRemaining, { padMinutes: false });
		this.timerDisplay.addClass("pomodoro-view__timer-display--hidden");
		this.timerInput.removeClass("pomodoro-view__timer-input--hidden");
		this.timerInput.focus();
		this.timerInput.select();
	}

	private commitTimerEdit(): void {
		if (!this.isEditingTimer || !this.timerInput || !this.timerDisplay) {
			return;
		}

		const parsedSeconds = parsePomodoroDurationInput(this.timerInput.value);
		this.isEditingTimer = false;
		this.timerInput.addClass("pomodoro-view__timer-input--hidden");
		this.timerDisplay.removeClass("pomodoro-view__timer-display--hidden");

		if (parsedSeconds === null) {
			new Notice(this.t("views.pomodoro.notices.invalidDuration"));
			const state = this.plugin.pomodoroService?.getState();
			if (state && this.isViewVisible()) {
				this.updateTimer(state.timeRemaining);
			}
			return;
		}

		const state = this.plugin.pomodoroService?.getState();
		if (!state) {
			return;
		}

		if (state.currentSession) {
			this.plugin.pomodoroService.setCurrentSessionRemainingTime(parsedSeconds);
		} else {
			this.plugin.pomodoroService.adjustPreparedTimer(parsedSeconds);
		}

		this.updateDisplay();
	}

	private cancelTimerEdit(): void {
		if (!this.timerInput || !this.timerDisplay) {
			return;
		}

		this.isEditingTimer = false;
		this.timerInput.addClass("pomodoro-view__timer-input--hidden");
		this.timerDisplay.removeClass("pomodoro-view__timer-display--hidden");
		const state = this.plugin.pomodoroService?.getState();
		if (state && this.isViewVisible()) {
			this.updateTimer(state.timeRemaining);
		}
	}

	private updateTimer(seconds: number) {
		if (this.timerDisplay) {
			if (this.isEditingTimer) {
				return;
			}
			// Ensure seconds is valid
			const validSeconds = Math.max(0, Math.floor(seconds));
			const text = formatPomodoroTime(validSeconds);
			if (this.timerDisplay.textContent !== text) this.timerDisplay.textContent = text;

			// Update timer color based on time remaining
			this.timerDisplay.classList.toggle(
				"pomodoro-view__timer-display--warning",
				validSeconds <= 60 && validSeconds > 0
			);
		}
	}

	private updateProgress(state: PomodoroState) {
		if (!this.progressCircle) return;

		// Use current circumference if available, otherwise calculate from current attributes
		let circumference = this.currentCircumference;
		if (circumference === 0) {
			// Fallback: get current radius from the progress circle
			const radiusAttr = this.progressCircle.getAttribute("r");
			const radius = radiusAttr ? parseInt(radiusAttr) : 140;
			circumference = 2 * Math.PI * radius;
			this.currentCircumference = circumference;
		}

		const progress = state.currentSession
			? Math.max(
					0,
					Math.min(
						1,
						1 - state.timeRemaining / getSessionDurationSeconds(state.currentSession)
					)
				)
			: 0;

		// Calculate stroke-dashoffset (progress goes clockwise)
		const offset = circumference - progress * circumference;

		// Update progress circle
		if (this.progressCircle.getAttribute("stroke-dashoffset") !== offset.toString()) {
			this.progressCircle.setAttributeNS(null, "stroke-dashoffset", offset.toString());
		}

		for (const type of ["work", "short-break", "long-break"]) {
			this.progressCircle.classList.toggle(
				`pomodoro-view__progress-circle--${type}`,
				type === state.currentSession?.type
			);
		}

		// Add warning class for last minute
		this.progressCircle.classList.toggle(
			"pomodoro-view__progress-circle--warning",
			Boolean(state.currentSession) && state.timeRemaining <= 60 && state.timeRemaining > 0
		);
	}

	private async updateStats() {
		const generation = this.openGeneration;
		try {
			if (!this.plugin.pomodoroService) {
				// Set default stats when service is not available
				if (this.isViewVisible() && this.statElements.pomodoros) {
					this.statElements.pomodoros.textContent = "0";
				}
				return;
			}

			// Get reliable stats from session history
			const stats = await this.plugin.pomodoroService.getTodayStats();
			if (this.isClosed || generation !== this.openGeneration) return;
			this.todaysPomodoros = stats.pomodorosCompleted;

			// Update only if values changed to avoid unnecessary DOM updates
			if (
				this.isViewVisible() &&
				this.statElements.pomodoros &&
				this.statElements.pomodoros.textContent !== stats.pomodorosCompleted.toString()
			) {
				this.statElements.pomodoros.textContent = stats.pomodorosCompleted.toString();
			}

			this.updateDisplay();
		} catch (error) {
			tasknotesLogger.error("Failed to update stats:", {
				category: "validation",
				operation: "update-stats",
				error: error,
			});
			// Fallback to show zeros if stats loading fails
			if (this.isViewVisible() && this.statElements.pomodoros)
				this.statElements.pomodoros.textContent = "0";
		}
	}

	private adjustSessionTime(seconds: number) {
		if (!this.plugin.pomodoroService) {
			return;
		}

		const state = this.plugin.pomodoroService.getState();

		if (state.currentSession) {
			// Session exists (running or paused), pass the adjustment amount directly
			this.plugin.pomodoroService.adjustSessionTime(seconds);
		} else {
			// No session (ready to start), adjust the prepared timer with absolute value
			const newTime = Math.max(60, state.timeRemaining + seconds); // Minimum 1 minute
			this.plugin.pomodoroService.adjustPreparedTimer(newTime);
		}

		this.updateDisplay();
	}

	private onPomodoroComplete(session: PomodoroSession, nextType: string) {
		this.updateDisplay(undefined, undefined, { refreshStats: true });

		// Show completion message and skip break option
		if (this.statusDisplay) {
			if (session.type === "work") {
				const isLongBreak = nextType === "long-break";
				const lengthLabel = this.t(
					isLongBreak
						? "views.pomodoro.status.breakLength.long"
						: "views.pomodoro.status.breakLength.short"
				);
				this.statusDisplay.textContent = this.t("views.pomodoro.status.breakPrompt", {
					length: lengthLabel,
				});
			} else {
				this.statusDisplay.textContent = this.t("views.pomodoro.status.breakComplete");
			}
		}
	}
}
