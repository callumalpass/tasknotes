import { normalizeStatsFilters } from "../../../src/views/StatsView";

describe("Issue #732: Stats view filter persistence", () => {
	it("restores persisted date range and minimum time filters", () => {
		const filters = normalizeStatsFilters({
			dateRange: "30days",
			minTimeSpent: 45,
			selectedProjects: ["Project Alpha", "Project Beta"],
		});

		expect(filters).toEqual({
			dateRange: "30days",
			selectedProjects: ["Project Alpha", "Project Beta"],
			minTimeSpent: 45,
		});
	});

	it("restores custom date range values", () => {
		const filters = normalizeStatsFilters({
			dateRange: "custom",
			customStartDate: "2026-05-01",
			customEndDate: "2026-05-18",
			minTimeSpent: "30",
		});

		expect(filters).toEqual({
			dateRange: "custom",
			customStartDate: "2026-05-01",
			customEndDate: "2026-05-18",
			selectedProjects: [],
			minTimeSpent: 30,
		});
	});

	it("falls back to defaults for malformed persisted state", () => {
		const filters = normalizeStatsFilters({
			dateRange: "tomorrow",
			customStartDate: "18/05/2026",
			customEndDate: false,
			selectedProjects: ["Project Alpha", null],
			minTimeSpent: -10,
		});

		expect(filters).toEqual({
			dateRange: "all",
			selectedProjects: ["Project Alpha"],
			minTimeSpent: 0,
		});
	});
});
