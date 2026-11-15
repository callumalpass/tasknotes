import type { TaskInfo } from "../../types";
import { filterEmptyProjects } from "../../utils/helpers";

export interface ProjectStats {
	projectName: string;
	totalTimeSpent: number;
	totalTimeEstimate: number;
	taskCount: number;
	completedTaskCount: number;
	avgTimePerTask: number;
	lastActivity?: string;
}

export interface OverallStats {
	totalTimeSpent: number;

	totalTimeEstimate: number;
	totalTasks: number;
	completedTasks: number;
	activeProjects: number;
	completionRate: number;
	avgTimePerTask: number;
	totalTasksThisWeek?: number;
	completedTasksThisWeek?: number;
	timeSpentThisWeek?: number;
}

export interface TimeRangeStats {
	overall: OverallStats;
	projects: ProjectStats[];
}

export interface StatsFilters {
	dateRange: "all" | "7days" | "30days" | "90days" | "custom";
	customStartDate?: string;
	customEndDate?: string;
	selectedProjects: string[];
	minTimeSpent: number; // in minutes
}

export interface VisibleStatsProjectNamesOptions {
	noProjectLabel: string;
	consolidateProjectName: (projectValue: string) => string | null | undefined;
	isArchivedProjectReference?: (projectValue: string) => boolean;
}

export const STATS_FILTERS_STORAGE_KEY = "tasknotes-stats-view-filters";
const STATS_DATE_RANGES = new Set<StatsFilters["dateRange"]>([
	"all",
	"7days",
	"30days",
	"90days",
	"custom",
]);

export function createDefaultStatsFilters(): StatsFilters {
	return {
		dateRange: "all",
		selectedProjects: [],
		minTimeSpent: 0,
	};
}

function isStatsDateRange(value: unknown): value is StatsFilters["dateRange"] {
	return typeof value === "string" && STATS_DATE_RANGES.has(value as StatsFilters["dateRange"]);
}

function isDateInputValue(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normalizeStatsFilters(value: unknown): StatsFilters {
	if (!value || typeof value !== "object") {
		return createDefaultStatsFilters();
	}

	const record = value as Record<string, unknown>;
	const filters = createDefaultStatsFilters();

	if (isStatsDateRange(record.dateRange)) {
		filters.dateRange = record.dateRange;
	}

	if (isDateInputValue(record.customStartDate)) {
		filters.customStartDate = record.customStartDate;
	}

	if (isDateInputValue(record.customEndDate)) {
		filters.customEndDate = record.customEndDate;
	}

	if (Array.isArray(record.selectedProjects)) {
		filters.selectedProjects = record.selectedProjects.filter(
			(project): project is string => typeof project === "string"
		);
	}

	const minTimeSpent =
		typeof record.minTimeSpent === "number" ? record.minTimeSpent : Number(record.minTimeSpent);
	if (Number.isFinite(minTimeSpent) && minTimeSpent > 0) {
		filters.minTimeSpent = Math.floor(minTimeSpent);
	}

	return filters;
}

export function filterStatsVisibleTasks(tasks: TaskInfo[]): TaskInfo[] {
	return tasks.filter((task) => !task.archived);
}

export function getVisibleStatsProjectNames(
	projects: string[] | undefined,
	options: VisibleStatsProjectNamesOptions
): string[] {
	if (!Array.isArray(projects)) {
		return [options.noProjectLabel];
	}

	const filteredProjects = filterEmptyProjects(projects);
	if (filteredProjects.length === 0) {
		return [options.noProjectLabel];
	}

	return filteredProjects
		.filter((project) => !options.isArchivedProjectReference?.(project))
		.map((project) => options.consolidateProjectName(project))
		.filter((project): project is string => typeof project === "string" && project.length > 0);
}

export interface ProjectDrilldownData {
	projectName: string;
	tasks: TaskInfo[];
	totalTimeSpent: number;
	totalTimeEstimate: number;
	completionRate: number;
	timeByDay: TimeByDay[];
	recentActivity: TaskInfo[];
}

export interface TimeByDay {
	date: string; // YYYY-MM-DD
	timeSpent: number; // minutes
	taskCount: number;
	completedTasks: number;
}

export interface TrendDataPoint {
	date: string;
	value: number;
}
