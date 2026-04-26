import { ItemView, WorkspaceLeaf, Setting } from "obsidian";
import { format, startOfWeek, endOfWeek } from "date-fns";
import TaskNotesPlugin from "../main";
import { POMODORO_STATS_VIEW_TYPE, PomodoroHistoryStats, PomodoroSessionHistory } from "../types";
import {
	getTodayLocal,
	createUTCDateFromLocalCalendarDate,
} from "../utils/dateUtils";
import { getSessionDuration } from "../utils/pomodoroUtils";
import { calculatePomodoroStats } from "../utils/pomodoroStats";

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
		return this.plugin.i18n.translate("views.pomodoroStats.title");
	}

	getIcon(): string {
		return "bar-chart";
	}

	private t(key: string, params?: Record<string, string | number>): string {
		return this.plugin.i18n.translate(key, params);
	}

	async onOpen() {
		await this.plugin.onReady();
		await this.render();
	}

	async onClose() {
		this.contentEl.empty();
	}

	async render() {
		const container = this.contentEl.createDiv({
			cls: "tasknotes-plugin tasknotes-container pomodoro-stats-container pomodoro-stats-view",
		});

		// Header
		const header = container.createDiv({
			cls: "pomodoro-stats-header pomodoro-stats-view__header",
		});
		new Setting(header).setName(this.t("views.pomodoroStats.heading")).setHeading();

		// Refresh button
		const refreshButton = header.createEl("button", {
			cls: "pomodoro-stats-refresh-button pomodoro-stats-view__refresh-button",
			text: this.t("views.pomodoroStats.refresh"),
		});
		this.registerDomEvent(refreshButton, "click", () => {
			this.refreshStats();
		});

		// Overview section (like TickTick)
		const overviewSection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(overviewSection)
			.setName(this.t("views.pomodoroStats.sections.overview"))
			.setHeading();
		this.overviewStatsEl = overviewSection.createDiv({
			cls: "pomodoro-overview-grid pomodoro-stats-view__overview-grid",
		});

		// Today's stats
		const todaySection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(todaySection)
			.setName(this.t("views.pomodoroStats.sections.today"))
			.setHeading();
		this.todayStatsEl = todaySection.createDiv({
			cls: "pomodoro-stats-grid pomodoro-stats-view__stats-grid",
		});

		// This week's stats
		const weekSection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(weekSection).setName(this.t("views.pomodoroStats.sections.week")).setHeading();
		this.weekStatsEl = weekSection.createDiv({
			cls: "pomodoro-stats-grid pomodoro-stats-view__stats-grid",
		});

		// Overall stats
		const overallSection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(overallSection)
			.setName(this.t("views.pomodoroStats.sections.allTime"))
			.setHeading();
		this.overallStatsEl = overallSection.createDiv({
			cls: "pomodoro-stats-grid pomodoro-stats-view__stats-grid",
		});

		// Recent sessions
		const recentSection = container.createDiv({
			cls: "pomodoro-stats-section pomodoro-stats-view__section",
		});
		new Setting(recentSection)
			.setName(this.t("views.pomodoroStats.sections.recent"))
			.setHeading();
		this.recentSessionsEl = recentSection.createDiv({
			cls: "pomodoro-recent-sessions pomodoro-stats-view__recent-sessions",
		});

		// Initial load
		await this.refreshStats();
	}

	private async refreshStats() {
		try {
			const todayLocal = getTodayLocal();
			const todayUTCAnchor = createUTCDateFromLocalCalendarDate(todayLocal);
			const yesterdayLocal = new Date(todayLocal);
			yesterdayLocal.setDate(yesterdayLocal.getDate() - 1);
			const yesterdayUTCAnchor = createUTCDateFromLocalCalendarDate(yesterdayLocal);
			const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
			const weekStartOptions = {
				weekStartsOn: firstDaySetting as 0 | 1 | 2 | 3 | 4 | 5 | 6,
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
			console.error("Failed to refresh stats:", error);
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
				text: this.t("views.pomodoroStats.recents.empty"),
			});
			return;
		}

		for (const session of recentSessions) {
			const sessionEl = container.createDiv({
				cls: "pomodoro-session-item pomodoro-stats-view__session-item",
			});

			const dateEl = sessionEl.createSpan({
				cls: "session-date pomodoro-stats-view__session-date",
			});
			const timeFormat = this.plugin.settings.calendarViewSettings.timeFormat;
			dateEl.textContent = format(
				new Date(session.startTime),
				timeFormat === "12" ? "MMM d, h:mm a" : "MMM d, HH:mm"
			);

			const durationEl = sessionEl.createSpan({
				cls: "session-duration pomodoro-stats-view__session-duration",
			});
			const actualDuration = getSessionDuration(session);
			durationEl.textContent = this.t("views.pomodoroStats.recents.duration", {
				minutes: actualDuration,
			});

			const statusEl = sessionEl.createSpan({
				cls: "session-status pomodoro-stats-view__session-status",
			});
			statusEl.textContent = this.t(
				session.completed
					? "views.pomodoroStats.recents.status.completed"
					: "views.pomodoroStats.recents.status.interrupted"
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
		const formatTime = (minutes: number): string => {
			if (minutes < 60) return `${minutes}m`;
			const hours = Math.floor(minutes / 60);
			const mins = minutes % 60;
			return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
		};

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
		todayPomosValue.textContent = todayStats.pomodorosCompleted.toString();
		todayPomosCard.createDiv({
			cls: "overview-label pomodoro-stats-view__overview-label",
			text: this.t("views.pomodoroStats.overviewCards.todayPomos.label"),
		});
		if (pomodoroChange !== 0) {
			const changeEl = todayPomosCard.createDiv({
				cls: "overview-change pomodoro-stats-view__overview-change",
			});
			changeEl.textContent =
				pomodoroChange > 0
					? this.t("views.pomodoroStats.overviewCards.todayPomos.change.more", {
							count: pomodoroChange,
						})
					: this.t("views.pomodoroStats.overviewCards.todayPomos.change.less", {
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
		totalPomosValue.textContent = overallStats.pomodorosCompleted.toString();
		totalPomosCard.createDiv({
			cls: "overview-label pomodoro-stats-view__overview-label",
			text: this.t("views.pomodoroStats.overviewCards.totalPomos.label"),
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
			text: this.t("views.pomodoroStats.overviewCards.todayFocus.label"),
		});
		if (timeChange !== 0) {
			const changeEl = todayFocusCard.createDiv({
				cls: "overview-change pomodoro-stats-view__overview-change",
			});
			changeEl.textContent =
				timeChange > 0
					? this.t("views.pomodoroStats.overviewCards.todayFocus.change.more", {
							duration: formatTime(Math.abs(timeChange)),
						})
					: this.t("views.pomodoroStats.overviewCards.todayFocus.change.less", {
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
			text: this.t("views.pomodoroStats.overviewCards.totalFocus.label"),
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
			text: stats.pomodorosCompleted.toString(),
		});
		pomodorosCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t("views.pomodoroStats.stats.pomodoros"),
		});

		// Current streak
		const streakCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		streakCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: stats.currentStreak.toString(),
		});
		streakCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t("views.pomodoroStats.stats.streak"),
		});

		// Total minutes
		const minutesCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		minutesCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: stats.totalMinutes.toString(),
		});
		minutesCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t("views.pomodoroStats.stats.minutes"),
		});

		// Average session length
		const avgCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		avgCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: stats.averageSessionLength.toString(),
		});
		avgCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t("views.pomodoroStats.stats.average"),
		});

		// Completion rate
		const rateCard = container.createDiv({
			cls: "pomodoro-stat-card pomodoro-stats-view__stat-card",
		});
		rateCard.createDiv({
			cls: "stat-value pomodoro-stats-view__stat-value",
			text: `${stats.completionRate}%`,
		});
		rateCard.createDiv({
			cls: "stat-label pomodoro-stats-view__stat-label",
			text: this.t("views.pomodoroStats.stats.completion"),
		});
	}
}
