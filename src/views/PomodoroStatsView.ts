import { formatUIDate, uiNumber, uiPercent, uiDuration } from "../i18n/formatters";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { ItemView, Menu, Notice, WorkspaceLeaf, Setting, setIcon, setTooltip } from "obsidian";
import { startOfWeek, endOfWeek } from "date-fns";
import type { Day } from "date-fns";
import TaskNotesPlugin from "../main";
import { POMODORO_STATS_VIEW_TYPE, PomodoroHistoryStats, PomodoroSessionHistory } from "../types";
import { showConfirmationModal } from "../modals/ConfirmationModal";
import { getTodayLocal, createUTCDateFromLocalCalendarDate } from "../utils/dateUtils";
import { getSessionDuration } from "../utils/pomodoroUtils";
import { calculatePomodoroStats } from "../utils/pomodoroStats";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Views/PomodoroStatsView" });

function isDay(value: number): value is Day {
	return Number.isInteger(value) && value >= 0 && value <= 6;
}

export class PomodoroStatsView extends ItemView {
	plugin: TaskNotesPlugin;

	// UI elements
	private overviewStatsEl: HTMLElement | null = null;
	private todayStatsEl: HTMLElement | null = null;
	private weekStatsEl: HTMLElement | null = null;
	private recentSessionsEl: HTMLElement | null = null;
	private overallStatsEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TaskNotesPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return POMODORO_STATS_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.plugin.i18n.translate(msg({ message: "Pomodoro stats", context: "views.pomodoroStats.title" }));
	}

	getIcon(): string {
		return "bar-chart";
	}

	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, params);
	}

	async onOpen() {
		await this.plugin.onReady();
		await this.waitForPomodoroService();
		await this.render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	async render() {
		this.contentEl.empty();
		const container = this.contentEl.createDiv({
			cls: "tasknotes-plugin tasknotes-container pomodoro-stats-container pomodoro-stats-view",
		});

		// Header
		const header = container.createDiv({
			cls: "pomodoro-stats-header pomodoro-stats-view__header",
		});
		new Setting(header).setName(this.t(msg({ message: "Pomodoro statistics", context: "views.pomodoroStats.heading" }))).setHeading();

		const headerActions = header.createDiv({
			cls: "pomodoro-stats-view__header-actions",
		});
		this.renderBasesMigrationHelp(headerActions);

		// Refresh button
		const refreshButton = headerActions.createEl("button", {
			cls: "pomodoro-stats-refresh-button pomodoro-stats-view__refresh-button",
			text: this.t(msg({ message: "Refresh", context: "views.pomodoroStats.refresh" })),
		});
		this.registerDomEvent(refreshButton, "click", () => {
			void this.refreshStats();
		});

		// Overview section (like TickTick)
		const overviewSection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(overviewSection)
			.setName(this.t(msg({ message: "Overview", context: "views.pomodoroStats.sections.overview" })))
			.setHeading();
		this.overviewStatsEl = overviewSection.createDiv({
			cls: "pomodoro-overview-grid pomodoro-stats-view__overview-grid",
		});

		// Today's stats
		const todaySection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(todaySection)
			.setName(this.t(msg({ message: "Today", context: "views.pomodoroStats.sections.today" })))
			.setHeading();
		this.todayStatsEl = todaySection.createDiv({
			cls: "pomodoro-stats-grid pomodoro-stats-view__stats-grid",
		});

		// This week's stats
		const weekSection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(weekSection).setName(this.t(msg({ message: "This week", context: "views.pomodoroStats.sections.week" }))).setHeading();
		this.weekStatsEl = weekSection.createDiv({
			cls: "pomodoro-stats-grid pomodoro-stats-view__stats-grid",
		});

		// Overall stats
		const overallSection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(overallSection)
			.setName(this.t(msg({ message: "All time", context: "views.pomodoroStats.sections.allTime" })))
			.setHeading();
		this.overallStatsEl = overallSection.createDiv({
			cls: "pomodoro-stats-grid pomodoro-stats-view__stats-grid",
		});

		// Recent sessions
		const recentSection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(recentSection)
			.setName(this.t(msg({ message: "Recent sessions", context: "views.pomodoroStats.sections.recent" })))
			.setHeading();
		this.recentSessionsEl = recentSection.createDiv({
			cls: "pomodoro-recent-sessions pomodoro-stats-view__recent-sessions",
		});

		// Initial load
		await this.refreshStats();
	}

	private renderBasesMigrationHelp(container: HTMLElement): void {
		if (this.plugin.settings.pomodoroStorageLocation === "daily-notes") {
			return;
		}

		const helpButton = container.createEl("button", {
			cls: "pomodoro-stats-view__bases-help",
		});
		const title = this.t(msg({ message: "Want a base view?", context: "views.pomodoroStats.basesMigration.title" }));
		const description = this.t(msg({ message: "Pomodoro base views use daily notes frontmatter; to see this history in the generated Pomodoro statistics base, migrate Pomodoro data in settings, then set storage to daily notes.", context: "views.pomodoroStats.basesMigration.description" }));
		setIcon(helpButton, "help-circle");
		helpButton.setAttr("aria-label", `${title}: ${description}`);
		setTooltip(helpButton, description, {
			placement: "bottom",
		});
	}

	private async waitForPomodoroService(): Promise<void> {
		const startedAt = Date.now();
		while (!this.plugin.pomodoroService && Date.now() - startedAt < 5000) {
			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}
	}

	private async refreshStats() {
		try {
			if (!this.plugin.pomodoroService) {
				return;
			}

			const todayLocal = getTodayLocal();
			const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);
			const yesterdayLocal = new Date(todayLocal);
			yesterdayLocal.setDate(yesterdayLocal.getDate() - 1);
			const yesterdayUTCAnchor = createUTCDateFromLocalCalendarDate(yesterdayLocal);
			const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
			const weekStartsOn = isDay(firstDaySetting) ? firstDaySetting : 0;
			const weekStartOptions: { weekStartsOn: Day } = {
				weekStartsOn,
			};
			const weekStart = startOfWeek(todayUTCAnchor, weekStartOptions);
			const weekEnd = endOfWeek(todayUTCAnchor, weekStartOptions);

			const [todayStats, yesterdayStats, weekStats, history] = await Promise.all([
				this.plugin.pomodoroService.getTodayStats(),
				this.plugin.pomodoroService.getStatsForDate(yesterdayUTCAnchor),
				this.plugin.pomodoroService.getStatsForDateRange(weekStart, weekEnd),
				this.plugin.pomodoroService.getSessionHistory(),
			]);
			const overallStats = calculatePomodoroStats(history);

			if (this.overviewStatsEl) {
				this.renderOverviewStats(
					this.overviewStatsEl,
					todayStats,
					overallStats,
					yesterdayStats
				);
			}

			if (this.todayStatsEl) {
				this.renderStatsGrid(this.todayStatsEl, todayStats);
			}

			if (this.weekStatsEl) {
				this.renderStatsGrid(this.weekStatsEl, weekStats);
			}

			if (this.overallStatsEl) {
				this.renderStatsGrid(this.overallStatsEl, overallStats);
			}

			if (this.recentSessionsEl) {
				this.renderRecentSessions(this.recentSessionsEl, history);
			}
		} catch (error) {
			tasknotesLogger.error("Failed to refresh stats:", {
				category: "stale-data",
				operation: "refresh-stats",
				error: error,
			});
		}
	}

	private renderRecentSessions(container: HTMLElement, history: PomodoroSessionHistory[]) {
		const recentSessions = history
			.filter((session: PomodoroSessionHistory) => session.type === "work")
			.slice(-10)
			.reverse();

		container.empty();

		if (recentSessions.length === 0) {
			container.createDiv({
				cls: "pomodoro-no-sessions pomodoro-stats-view__no-sessions",
				text: this.t(msg({ message: "No sessions recorded yet", context: "views.pomodoroStats.recents.empty" })),
			});
			return;
		}

		for (const session of recentSessions) {
			const sessionEl = container.createDiv({
				cls: "pomodoro-session-item pomodoro-stats-view__session-item",
			});
			this.registerDomEvent(sessionEl, "contextmenu", (event: MouseEvent) => {
				event.preventDefault();
				this.showSessionContextMenu(event, session);
			});

			const dateEl = sessionEl.createSpan({
				cls: "session-date pomodoro-stats-view__session-date",
			});
			const timeFormat = this.plugin.settings.calendarViewSettings.timeFormat;
			dateEl.textContent = formatUIDate(
				new Date(session.startTime),
				timeFormat === "12" ? "MMM d, h:mm a" : "MMM d, HH:mm"
			);

			const durationEl = sessionEl.createSpan({
				cls: "session-duration pomodoro-stats-view__session-duration",
			});
			const actualDuration = getSessionDuration(session);
			durationEl.textContent = this.t(msg({ message: "{minutes} min", context: "views.pomodoroStats.recents.duration" }), {
				minutes: actualDuration,
			});

			const statusEl = sessionEl.createSpan({
				cls: "session-status pomodoro-stats-view__session-status",
			});
			statusEl.textContent = this.t(
				session.completed
					? msg({ message: "Completed", context: "views.pomodoroStats.recents.status.completed" })
					: msg({ message: "Interrupted", context: "views.pomodoroStats.recents.status.interrupted" })
			);
			statusEl.addClass(session.completed ? "status-completed" : "status-interrupted");
			statusEl.addClass(
				session.completed
					? "pomodoro-stats-view__session-status--completed"
					: "pomodoro-stats-view__session-status--interrupted"
			);

			if (session.taskPath) {
				const taskEl = sessionEl.createSpan({
					cls: "session-task pomodoro-stats-view__session-task",
				});
				const taskName = session.taskPath.split("/").pop()?.replace(".md", "") || "";
				taskEl.textContent = taskName;
			}

			const deleteButton = sessionEl.createEl("button", {
				cls: "pomodoro-stats-view__session-delete-button",
				attr: {
					type: "button",
					"aria-label": this.t(msg({ message: "Delete Pomodoro session", context: "views.pomodoroStats.recents.deleteAria" })),
				},
			});
			setIcon(deleteButton, "trash-2");
			setTooltip(deleteButton, this.t(msg({ message: "Delete session", context: "views.pomodoroStats.recents.delete" })), {
				placement: "top",
			});
			this.registerDomEvent(deleteButton, "click", (event: MouseEvent) => {
				event.preventDefault();
				event.stopPropagation();
				void this.confirmDeleteSession(session);
			});
		}
	}

	private showSessionContextMenu(event: MouseEvent, session: PomodoroSessionHistory): void {
		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Delete session", context: "views.pomodoroStats.recents.delete" })));
			item.setIcon("trash");
			item.onClick(() => {
				void this.confirmDeleteSession(session);
			});
		});
		menu.showAtMouseEvent(event);
	}

	private async confirmDeleteSession(session: PomodoroSessionHistory): Promise<void> {
		const confirmed = await showConfirmationModal(this.plugin.app, {
			title: this.t(msg({ message: "Delete Pomodoro session?", context: "views.pomodoroStats.recents.deleteConfirmTitle" })),
			message: this.t(msg({ message: "This removes the session from Pomodoro history. Existing task time entries are not changed.", context: "views.pomodoroStats.recents.deleteConfirmMessage" })),
			confirmText: this.t(msg({ message: "Delete", context: "views.pomodoroStats.recents.deleteConfirmButton" })),
			cancelText: this.t(msg({ message: "Cancel", context: "common.cancel" })),
			isDestructive: true,
		});

		if (!confirmed || !this.plugin.pomodoroService) {
			return;
		}

		const deleted = await this.plugin.pomodoroService.deleteSessionFromHistory(session);
		new Notice(
			this.t(
				deleted
					? msg({ message: "Pomodoro session deleted", context: "views.pomodoroStats.recents.deleteSuccess" })
					: msg({ message: "Pomodoro session was not found", context: "views.pomodoroStats.recents.deleteNotFound" })
			)
		);

		if (deleted) {
			await this.refreshStats();
		}
	}

	private renderOverviewStats(
		container: HTMLElement,
		todayStats: PomodoroHistoryStats,
		overallStats: PomodoroHistoryStats,
		yesterdayStats: PomodoroHistoryStats
	) {
		container.empty();

		// Format time duration in hours and minutes
		const formatTime = (minutes: number): string => uiDuration(minutes);

		// Calculate changes from yesterday
		const pomodoroChange = todayStats.pomodorosCompleted - yesterdayStats.pomodorosCompleted;
		const timeChange = todayStats.totalMinutes - yesterdayStats.totalMinutes;

		// Today's Pomos
		const todayPomosCard = container.createDiv({
			cls: "pomodoro-overview-card pomodoro-stats-view__overview-card",
		});
		const todayPomosValue = todayPomosCard.createDiv({
			cls: "overview-value pomodoro-stats-view__overview-value",
		});
		todayPomosValue.textContent = uiNumber(todayStats.pomodorosCompleted);
		todayPomosCard.createDiv({
			cls: "overview-label pomodoro-stats-view__overview-label",
			text: this.t(msg({ message: "Today''s pomos", context: "views.pomodoroStats.overviewCards.todayPomos.label" })),
		});
		if (pomodoroChange !== 0) {
			const changeEl = todayPomosCard.createDiv({
				cls: "overview-change pomodoro-stats-view__overview-change",
			});
			changeEl.textContent =
				pomodoroChange > 0
					? this.t(msg({ message: "{count} more than yesterday", context: "views.pomodoroStats.overviewCards.todayPomos.change.more" }), {
							count: pomodoroChange,
						})
					: this.t(msg({ message: "{count} fewer than yesterday", context: "views.pomodoroStats.overviewCards.todayPomos.change.less" }), {
							count: Math.abs(pomodoroChange),
						});
			changeEl.addClass(pomodoroChange > 0 ? "positive" : "negative");
		}

		// Total Pomos
		const totalPomosCard = container.createDiv({
			cls: "pomodoro-overview-card pomodoro-stats-view__overview-card",
		});
		const totalPomosValue = totalPomosCard.createDiv({
			cls: "overview-value pomodoro-stats-view__overview-value",
		});
		totalPomosValue.textContent = uiNumber(overallStats.pomodorosCompleted);
		totalPomosCard.createDiv({
			cls: "overview-label pomodoro-stats-view__overview-label",
			text: this.t(msg({ message: "Total pomos", context: "views.pomodoroStats.overviewCards.totalPomos.label" })),
		});

		// Today's Focus
		const todayFocusCard = container.createDiv({
			cls: "pomodoro-overview-card pomodoro-stats-view__overview-card",
		});
		const todayFocusValue = todayFocusCard.createDiv({
			cls: "overview-value pomodoro-stats-view__overview-value",
		});
		todayFocusValue.textContent = formatTime(todayStats.totalMinutes);
		todayFocusCard.createDiv({
			cls: "overview-label pomodoro-stats-view__overview-label",
			text: this.t(msg({ message: "Today''s focus", context: "views.pomodoroStats.overviewCards.todayFocus.label" })),
		});
		if (timeChange !== 0) {
			const changeEl = todayFocusCard.createDiv({
				cls: "overview-change pomodoro-stats-view__overview-change",
			});
			changeEl.textContent =
				timeChange > 0
					? this.t(msg({ message: "{duration} more than yesterday", context: "views.pomodoroStats.overviewCards.todayFocus.change.more" }), {
							duration: formatTime(Math.abs(timeChange)),
						})
					: this.t(msg({ message: "{duration} less than yesterday", context: "views.pomodoroStats.overviewCards.todayFocus.change.less" }), {
							duration: formatTime(Math.abs(timeChange)),
						});
			changeEl.addClass(timeChange > 0 ? "positive" : "negative");
		}

		// Total Focus Duration
		const totalFocusCard = container.createDiv({
			cls: "pomodoro-overview-card pomodoro-stats-view__overview-card",
		});
		const totalFocusValue = totalFocusCard.createDiv({
			cls: "overview-value pomodoro-stats-view__overview-value",
		});
		totalFocusValue.textContent = formatTime(overallStats.totalMinutes);
		totalFocusCard.createDiv({
			cls: "overview-label pomodoro-stats-view__overview-label",
			text: this.t(msg({ message: "Total focus duration", context: "views.pomodoroStats.overviewCards.totalFocus.label" })),
		});
	}

	private renderStatsGrid(container: HTMLElement, stats: PomodoroHistoryStats) {
		container.empty();

		// Completed pomodoros
		const pomodorosCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		pomodorosCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: uiNumber(stats.pomodorosCompleted),
		});
		pomodorosCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t(msg({ message: "Pomodoros", context: "views.pomodoroStats.stats.pomodoros" })),
		});

		// Current streak
		const streakCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		streakCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: uiNumber(stats.currentStreak),
		});
		streakCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t(msg({ message: "Streak", context: "views.pomodoroStats.stats.streak" })),
		});

		// Total minutes
		const minutesCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		minutesCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: uiNumber(stats.totalMinutes),
		});
		minutesCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t(msg({ message: "Minutes", context: "views.pomodoroStats.stats.minutes" })),
		});

		// Average session length
		const avgCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		avgCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: uiNumber(stats.averageSessionLength),
		});
		avgCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t(msg({ message: "Avg length", context: "views.pomodoroStats.stats.average" })),
		});

		// Completion rate
		const rateCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		rateCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: uiPercent(stats.completionRate),
		});
		rateCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t(msg({ message: "Completion", context: "views.pomodoroStats.stats.completion" })),
		});
	}
}
