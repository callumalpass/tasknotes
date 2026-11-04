import { renderEmptyState } from "../../ui/kit/emptyState";
import type TaskNotesPlugin from "../../main";
import { msg } from "@lingui/core/macro";
import { uiText } from "../../i18n/runtime";
import { uiPercent, uiDuration, formatUIDate } from "../../i18n/formatters";
import type { TrendDataPoint, TimeByDay } from "./model";

export function renderCompletion(
	container: HTMLElement,
	percentage: number,
	completed: number,
	total: number
) {
	container.createDiv({ cls: "stats-view__completion-value", text: uiPercent(Math.round(percentage)) });

	const label = container.createDiv({ cls: "stats-view__progress-label" });
	label.textContent = uiText(msg({ message: "{total, plural, one {{completed, number}/{total, number} task} other {{completed, number}/{total, number} tasks}}", context: "views/StatsView: StatsView.renderProgressCircle display" }), { completed: completed, total: total });
}


export function renderSparkline(container: HTMLElement, data: TrendDataPoint[]) {
	container.empty();

	if (data.length === 0) {
		return;
	}

	const width = 100;
	const height = 20;
	const maxValue = Math.max(...data.map((d) => d.value));

	if (maxValue === 0) {
		return;
	}

	const svg = activeWindow.createSvg("svg");
	svg.setAttribute("width", width.toString());
	svg.setAttribute("height", height.toString());
	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	svg.classList.add("stats-view__sparkline-svg");

	// Create path
	const path = activeWindow.createSvg("path");

	let pathD = "";
	data.forEach((point, index) => {
		const x = (index / (data.length - 1)) * width;
		const y = height - (point.value / maxValue) * height;

		if (index === 0) {
			pathD += `M ${x} ${y}`;
		} else {
			pathD += ` L ${x} ${y}`;
		}
	});

	path.setAttribute("d", pathD);
	path.setAttribute("fill", "none");
	path.setAttribute("stroke", "currentColor");
	path.setAttribute("stroke-width", "1.5");
	path.setAttribute("opacity", "0.7");

	svg.appendChild(path);
	container.appendChild(svg);
}


export function renderActivityChart(plugin: TaskNotesPlugin, container: HTMLElement, timeByDay: TimeByDay[]) {
	container.empty();

	if (timeByDay.length === 0) return;

	const maxTime = Math.max(...timeByDay.map((d) => d.timeSpent));
	if (maxTime === 0) {
		renderEmptyState(container, { message: plugin.i18n.translate(msg({ message: "No time tracking data", context: "views.stats.project.noTracking" })) });
		return;
	}

	const chartContainer = container.createDiv({ cls: "stats-view__bar-chart" });

	for (const day of timeByDay) {
		const barContainer = chartContainer.createDiv({ cls: "stats-view__bar-container" });

		const bar = barContainer.createDiv({ cls: "stats-view__bar" });
		const height = (day.timeSpent / maxTime) * 40; // Max 40px height
		bar.style.height = `${height}px`;

		// Tooltip
		const tooltip = uiText(msg({ message: "{date}: {duration}", context: "statistics daily time tooltip" }), { date: formatUIDate(new Date(day.date), "MMM d"), duration: uiDuration(Math.round(day.timeSpent)) });
		bar.setAttribute("title", tooltip);
	}
}
