import fs from "fs";
import path from "path";

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Issue #1931: Pomodoro task selector opens from cached task data", () => {
	it("uses synchronous cached task paths instead of scanning every markdown file before opening", () => {
		const source = readRepoFile("src/views/PomodoroView.ts");

		expect(source).toContain("getCachedUnarchivedPomodoroTasks");
		expect(source).toContain("plugin.cacheManager.getAllTaskPaths()");
		expect(source).toContain("plugin.cacheManager.getCachedTaskInfoSync(path)");
		expect(source).not.toContain("const allTasks = await this.plugin.cacheManager.getAllTasks()");
	});

	it("guards against stacked selector modals while the first one is still pending", () => {
		const source = readRepoFile("src/views/PomodoroView.ts");

		expect(source).toContain("private isTaskSelectorOpen = false");
		expect(source).toContain("if (this.isTaskSelectorOpen)");
		expect(source).toContain("this.isTaskSelectorOpen = true");
		expect(source).toContain("this.isTaskSelectorOpen = false");
	});
});
