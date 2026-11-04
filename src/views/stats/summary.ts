import type TaskNotesPlugin from "../../main";
import { msg } from "@lingui/core/macro";
import { uiDuration, uiNumber, uiPercent } from "../../i18n/formatters";
import type { OverallStats, TimeRangeStats } from "./model";

export function renderOverviewStats(plugin: TaskNotesPlugin, container: HTMLElement, stats: OverallStats) {
	container.empty();

	// Format time duration in hours and minutes
	const formatTime = (minutes: number): string => uiDuration(Math.round(minutes));

	// Total Time
	const totalTimeCard = container.createDiv({
		cls: "stats-overview-card stats-view__overview-card",
	});
	const totalTimeValue = totalTimeCard.createDiv({
		cls: "overview-value stats-view__overview-value",
	});
	totalTimeValue.textContent = `${formatTime(stats.totalTimeSpent)} / ${formatTime(stats.totalTimeEstimate)}`;
	totalTimeCard.createDiv({
		cls: "overview-label stats-view__overview-label",
		text: plugin.i18n.translate(msg({ message: "Time tracked / estimated", context: "views.stats.cards.timeTrackedEstimated" })),
	});

	// Total Tasks
	const totalTasksCard = container.createDiv({
		cls: "stats-overview-card stats-view__overview-card",
	});
	const totalTasksValue = totalTasksCard.createDiv({
		cls: "overview-value stats-view__overview-value",
	});
	totalTasksValue.textContent = uiNumber(stats.totalTasks);
	totalTasksCard.createDiv({
		cls: "overview-label stats-view__overview-label",
		text: plugin.i18n.translate(msg({ message: "Total tasks", context: "views.stats.cards.totalTasks" })),
	});

	// Completion Rate
	const completionCard = container.createDiv({
		cls: "stats-overview-card stats-view__overview-card",
	});
	const completionValue = completionCard.createDiv({
		cls: "overview-value stats-view__overview-value",
	});
	completionValue.textContent = uiPercent(Math.round(stats.completionRate));
	completionCard.createDiv({
		cls: "overview-label stats-view__overview-label",
		text: plugin.i18n.translate(msg({ message: "Completion rate", context: "views.stats.cards.completionRate" })),
	});

	// Active Projects
	const projectsCard = container.createDiv({
		cls: "stats-overview-card stats-view__overview-card",
	});
	const projectsValue = projectsCard.createDiv({
		cls: "overview-value stats-view__overview-value",
	});
	projectsValue.textContent = uiNumber(stats.activeProjects);
	projectsCard.createDiv({
		cls: "overview-label stats-view__overview-label",
		text: plugin.i18n.translate(msg({ message: "Active projects", context: "views.stats.cards.activeProjects" })),
	});

	// Average Time per Task
	const avgTimeCard = container.createDiv({
		cls: "stats-overview-card stats-view__overview-card",
	});
	const avgTimeValue = avgTimeCard.createDiv({
		cls: "overview-value stats-view__overview-value",
	});
	avgTimeValue.textContent = formatTime(stats.avgTimePerTask);
	avgTimeCard.createDiv({
		cls: "overview-label stats-view__overview-label",
		text: plugin.i18n.translate(msg({ message: "Avg time per task", context: "views.stats.cards.avgTimePerTask" })),
	});
}

export function renderTimeRangeStats(plugin: TaskNotesPlugin, container: HTMLElement, stats: TimeRangeStats) {
	container.empty();
	if (stats.overall.totalTasks === 0 && stats.overall.totalTimeSpent === 0 && stats.overall.totalTimeEstimate === 0) {
		container.createEl("p", {
			cls: "stats-view__period-summary",
			text: plugin.i18n.translate(msg({ message: "No activity in this period.", context: "statistics empty period" })),
		});
		return;
	}

	const formatTime = (minutes: number): string => uiDuration(Math.round(minutes));

	// Time Tracked
	const timeCard = container.createDiv({ cls: "stats-stat-card stats-view__stat-card" });
	timeCard.createDiv({
		cls: "stat-value stats-view__stat-value",
		text: `${formatTime(stats.overall.totalTimeSpent)} / ${formatTime(stats.overall.totalTimeEstimate)}`,
	});
	timeCard.createDiv({
		cls: "stat-label stats-view__stat-label",
		text: plugin.i18n.translate(msg({ message: "Time tracked / estimated", context: "views.stats.cards.timeTrackedEstimated" })),
	});

	// Tasks
	const tasksCard = container.createDiv({ cls: "stats-stat-card stats-view__stat-card" });
	tasksCard.createDiv({
		cls: "stat-value stats-view__stat-value",
		text: uiNumber(stats.overall.totalTasks),
	});
	tasksCard.createDiv({
		cls: "stat-label stats-view__stat-label",
		text: plugin.i18n.translate(msg({ message: "Tasks", context: "views.stats.labels.tasks" })),
	});

	// Completed
	const completedCard = container.createDiv({ cls: "stats-stat-card stats-view__stat-card" });
	completedCard.createDiv({
		cls: "stat-value stats-view__stat-value",
		text: uiNumber(stats.overall.completedTasks),
	});
	completedCard.createDiv({
		cls: "stat-label stats-view__stat-label",
		text: plugin.i18n.translate(msg({ message: "Completed", context: "views.stats.labels.completed" })),
	});

	// Projects
	const projectsCard = container.createDiv({ cls: "stats-stat-card stats-view__stat-card" });
	projectsCard.createDiv({
		cls: "stat-value stats-view__stat-value",
		text: uiNumber(stats.overall.activeProjects),
	});
	projectsCard.createDiv({
		cls: "stat-label stats-view__stat-label",
		text: plugin.i18n.translate(msg({ message: "Projects", context: "views.stats.labels.projects" })),
	});
}
