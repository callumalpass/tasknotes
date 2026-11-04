import type { Component } from "obsidian";
import type TaskNotesPlugin from "../../main";
import type { TaskInfo } from "../../types";
import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";
import { uiDuration, uiNumber, uiPercent } from "../../i18n/formatters";
import { createTaskCard } from "../../ui/TaskCard";
import { convertInternalToUserProperties } from "../../utils/propertyMapping";
import type { ProjectDrilldownData } from "./model";
import { renderActivityChart } from "./charts";

export function renderDrilldownContent(owner: Component, plugin: TaskNotesPlugin, container: HTMLElement, data: ProjectDrilldownData) {
	container.empty();

	const formatTime = (minutes: number): string => uiDuration(Math.round(minutes));

	// Overview stats with enhanced metrics
	const overviewEl = container.createDiv({ cls: "stats-view__drilldown-overview" });

	const statsGrid = overviewEl.createDiv({ cls: "stats-view__drilldown-stats" });

	const totalTimeCard = statsGrid.createDiv({ cls: "stats-view__drilldown-card" });
	totalTimeCard.createDiv({
		cls: "stats-view__drilldown-value",
		text: `${formatTime(data.totalTimeSpent)} / ${formatTime(data.totalTimeEstimate)}`,
	});
	totalTimeCard.createDiv({
		cls: "stats-view__drilldown-label",
		text: plugin.i18n.translate(msg({ message: "Total time", context: "views.stats.project.totalTime" })),
	});

	const tasksCard = statsGrid.createDiv({ cls: "stats-view__drilldown-card" });
	tasksCard.createDiv({
		cls: "stats-view__drilldown-value",
		text: uiNumber(data.tasks.length),
	});
	tasksCard.createDiv({
		cls: "stats-view__drilldown-label",
		text: plugin.i18n.translate(msg({ message: "Total tasks", context: "views.stats.project.totalTasks" })),
	});

	const completionCard = statsGrid.createDiv({ cls: "stats-view__drilldown-card" });
	completionCard.createDiv({
		cls: "stats-view__drilldown-value",
		text: uiPercent(Math.round(data.completionRate)),
	});
	completionCard.createDiv({
		cls: "stats-view__drilldown-label",
		text: plugin.i18n.translate(msg({ message: "Completed: ", context: "views.advancedCalendar.timeEntry.completedPrefix" })),
	});

	// Add average time per task
	const avgTimeCard = statsGrid.createDiv({ cls: "stats-view__drilldown-card" });
	const avgTimeSpent = data.tasks.length > 0 ? data.totalTimeSpent / data.tasks.length : 0;
	const avgTimeEstimate =
		data.tasks.length > 0 ? data.totalTimeEstimate / data.tasks.length : 0;
	avgTimeCard.createDiv({
		cls: "stats-view__drilldown-value",
		text: `${formatTime(avgTimeSpent)} / ${formatTime(avgTimeEstimate)}`,
	});
	avgTimeCard.createDiv({
		cls: "stats-view__drilldown-label",
		text: plugin.i18n.translate(msg({ message: "Avg per task", context: "views.stats.project.average" })),
	});

	// Activity chart
	const chartSection = container.createDiv({ cls: "stats-view__drilldown-section" });
	chartSection.createDiv({
		cls: "stats-view__drilldown-heading",
		text: plugin.i18n.translate(msg({ message: "Activity over time (last 30 days)", context: "views.stats.project.activity" })),
	});
	const chartEl = chartSection.createDiv({ cls: "stats-view__activity-chart" });
	renderActivityChart(plugin, chartEl, data.timeByDay);

	// All project tasks section (improved from just recent activity)
	const tasksSection = container.createDiv({ cls: "stats-view__drilldown-section" });
	const tasksHeaderContainer = tasksSection.createDiv({ cls: "stats-view__section-header" });
	tasksHeaderContainer.createDiv({
		cls: "stats-view__drilldown-heading",
		text: plugin.i18n.translate(msg({ message: "All project tasks", context: "views.stats.project.allTasks" })),
	});

	// Add filter controls for tasks
	const taskFilters = tasksHeaderContainer.createDiv({ cls: "stats-view__task-filters" });
	const statusFilter = taskFilters.createEl("select", { cls: "stats-view__filter-select" });
	statusFilter.createEl("option", {
		value: "all",
		text: plugin.i18n.translate(msg({ message: "All tasks", context: "views.stats.filters.allTasks" })),
	});
	statusFilter.createEl("option", {
		value: "active",
		text: plugin.i18n.translate(msg({ message: "Active only", context: "views.stats.filters.activeOnly" })),
	});
	statusFilter.createEl("option", {
		value: "completed",
		text: plugin.i18n.translate(msg({ message: "Completed only", context: "views.stats.filters.completedOnly" })),
	});

	const taskList = tasksSection.createDiv({ cls: "stats-view__task-list" });

	// Function to render filtered tasks
	const renderTasks = (filterStatus = "all") => {
		taskList.empty();

		let filteredTasks = data.tasks;
		if (filterStatus === "active") {
			filteredTasks = data.tasks.filter(
				(task) => !plugin.statusManager.isCompletedStatus(task.status)
			);
		} else if (filterStatus === "completed") {
			filteredTasks = data.tasks.filter((task) =>
				plugin.statusManager.isCompletedStatus(task.status)
			);
		}

		// Sort tasks: incomplete first, then by last activity
		filteredTasks.sort((a, b) => {
			const aCompleted = plugin.statusManager.isCompletedStatus(a.status);
			const bCompleted = plugin.statusManager.isCompletedStatus(b.status);

			if (aCompleted !== bCompleted) {
				return aCompleted ? 1 : -1; // Incomplete tasks first
			}

			// Sort by last activity (time entries or modification date)
			const getLastActivity = (task: TaskInfo): number => {
				if (task.timeEntries?.length) {
					return Math.max(
						...task.timeEntries.map((e) => new Date(e.startTime).getTime())
					);
				}
				return task.dateModified ? new Date(task.dateModified).getTime() : 0;
			};

			return getLastActivity(b) - getLastActivity(a);
		});

		if (filteredTasks.length === 0) {
			taskList.createDiv({
				cls: "stats-view__no-data",
				text: plugin.i18n.translate(msg({ message: "No tasks found", context: "views.stats.noTasks" })),
			});
			return;
		}

		// Show task count
		const countEl = taskList.createDiv({ cls: "stats-view__task-count" });
		countEl.textContent = uiText(msg({ message: "{length, plural, one {Showing {length, number} task} other {Showing {length, number} tasks}}", context: "views/StatsView: StatsView.renderDrilldownContent.renderTasks display" }), { length: filteredTasks.length });

		for (const task of filteredTasks) {
			// Create TaskCard with checkbox disabled as requested
			const visibleProperties = plugin.settings.defaultVisibleProperties
				? convertInternalToUserProperties(
						plugin.settings.defaultVisibleProperties,
						plugin
					)
				: undefined;
			const taskCard = createTaskCard(task, plugin, visibleProperties);

			taskList.appendChild(taskCard);
		}
	};

	// Initial render
	renderTasks("all");

	// Add filter event listener
	owner.registerDomEvent(statusFilter, "change", () => {
		renderTasks(statusFilter.value);
	});
}
