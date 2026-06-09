import type { TaskInfo } from "../../../src/types";
import { hydrateTaskDetailsFromFile } from "../../../src/utils/taskDetails";
import { MockObsidian } from "../../helpers/obsidian-runtime";

describe("Issue #1858: single-task reads include task body details", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	function createTask(path: string, details?: string): TaskInfo {
		return {
			title: "API task",
			status: "open",
			priority: "normal",
			path,
			archived: false,
			details,
		};
	}

	it("hydrates details from the markdown body after YAML frontmatter", async () => {
		const app = MockObsidian.createMockApp();
		MockObsidian.createTestFile(
			"Tasks/api-task.md",
			"---\ntitle: API task\nstatus: open\ntags:\n  - task\n---\n\nLine one\r\nLine two\n\n"
		);

		const task = createTask("Tasks/api-task.md");
		const result = await hydrateTaskDetailsFromFile(app, task);

		expect(result).toMatchObject({
			...task,
			details: "Line one\nLine two",
		});
	});

	it("returns an empty details string for a frontmatter-only task", async () => {
		const app = MockObsidian.createMockApp();
		MockObsidian.createTestFile(
			"Tasks/frontmatter-only.md",
			"---\ntitle: Frontmatter only\nstatus: open\ntags:\n  - task\n---\n"
		);

		const task = createTask("Tasks/frontmatter-only.md", "stale cached details");
		const result = await hydrateTaskDetailsFromFile(app, task);

		expect(result.details).toBe("");
	});

	it("leaves the cached task unchanged when the file is unavailable", async () => {
		const app = MockObsidian.createMockApp();
		const task = createTask("Tasks/missing.md");

		await expect(hydrateTaskDetailsFromFile(app, task)).resolves.toBe(task);
	});
});
