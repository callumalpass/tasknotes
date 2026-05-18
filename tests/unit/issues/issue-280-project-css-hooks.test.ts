/**
 * Issue #280: expose project-specific CSS hooks for user styling.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/280
 */

import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #280: project-specific view CSS hooks", () => {
	it("adds project-derived classes to task cards", () => {
		const cardSource = readRepoFile("src/ui/TaskCard.ts");
		const stateSource = readRepoFile("src/ui/taskCardState.ts");
		const completionStateSource = readRepoFile("src/ui/taskCardCompletionState.ts");

		expect(stateSource).toContain("function buildTaskCardClassNames");
		expect(stateSource).toContain("task-card--project-${sanitizedProject}");
		expect(stateSource).toContain("task-card--has-projects");
		expect(cardSource).toContain("buildTaskCardRenderState");
		expect(completionStateSource).toContain('removeClassesWithPrefix(card, "task-card--project-")');
	});

	it("adds project-derived classes to calendar task events", () => {
		const source = readRepoFile("src/bases/CalendarView.ts");

		expect(source).toContain("filterEmptyProjects(taskInfo.projects || [])");
		expect(source).toContain("sanitizeForCssClass(project)");
		expect(source).toContain("fc-project-${sanitizedProject}");
	});
});
