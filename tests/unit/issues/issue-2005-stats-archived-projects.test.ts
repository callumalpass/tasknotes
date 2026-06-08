import {
	filterStatsVisibleTasks,
	getVisibleStatsProjectNames,
} from "../../../src/views/StatsView";
import type { TaskInfo } from "../../../src/types";

function task(path: string, archived = false): TaskInfo {
	return {
		path,
		title: path,
		status: "open",
		priority: "normal",
		archived,
	};
}

describe("Issue #2005: archived tasks and projects in stats", () => {
	it("excludes archived task notes from stats inputs", () => {
		const active = task("Tasks/Active.md");
		const archived = task("Tasks/Archived.md", true);

		expect(filterStatsVisibleTasks([active, archived])).toEqual([active]);
	});

	it("keeps the no-project bucket for tasks without project references", () => {
		expect(
			getVisibleStatsProjectNames(undefined, {
				noProjectLabel: "No Project",
				consolidateProjectName: (project) => project,
			})
		).toEqual(["No Project"]);

		expect(
			getVisibleStatsProjectNames(["", "   "], {
				noProjectLabel: "No Project",
				consolidateProjectName: (project) => project,
			})
		).toEqual(["No Project"]);
	});

	it("skips project rows whose project note resolves to an archived task", () => {
		const archivedProjects = new Set(["[[Projects/Archived]]"]);

		const projects = getVisibleStatsProjectNames(
			["[[Projects/Active]]", "[[Projects/Archived]]"],
			{
				noProjectLabel: "No Project",
				consolidateProjectName: (project) =>
					project.replace("[[Projects/", "").replace("]]", ""),
				isArchivedProjectReference: (project) => archivedProjects.has(project),
			}
		);

		expect(projects).toEqual(["Active"]);
	});

	it("does not move tasks linked only to archived projects into No Project", () => {
		const projects = getVisibleStatsProjectNames(["[[Projects/Archived]]"], {
			noProjectLabel: "No Project",
			consolidateProjectName: (project) => project,
			isArchivedProjectReference: () => true,
		});

		expect(projects).toEqual([]);
	});
});
