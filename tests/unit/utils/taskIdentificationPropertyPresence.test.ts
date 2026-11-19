/**
 * Issue #2138 / superseded PR #2139: property identification with an empty value
 * treats every note that has the property as a task. Detection, generated Bases
 * filters, mdbase types and written frontmatter share one rule: the key is present,
 * whatever its value (mdbase `exists: true`, Bases `file.hasProperty()`).
 */

import { isTaskFrontmatter } from "../../../src/utils/taskIdentification";
import { applyPropertyTaskIdentifier } from "../../../src/utils/taskIdentificationFrontmatter";
import { TaskService } from "../../../src/services/TaskService";
import { TFile } from "../../helpers/obsidian-runtime";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

const settings = {
	taskIdentificationMethod: "property" as const,
	taskPropertyName: "status",
	taskPropertyValue: "",
	taskTag: "task",
};

describe("property presence identification (#2138)", () => {
	it.each([["open"], ["done"], [3], [false], [["open"]], [""], [null], [[]]])(
		"identifies a note whose property is %j",
		(value) => {
			expect(isTaskFrontmatter({ status: value }, settings)).toBe(true);
		}
	);

	it("does not identify notes without the property", () => {
		expect(isTaskFrontmatter({ type: "note" }, settings)).toBe(false);
		expect(isTaskFrontmatter({}, settings)).toBe(false);
	});

	it("treats a whitespace-only value as empty", () => {
		expect(isTaskFrontmatter({ status: "open" }, { ...settings, taskPropertyValue: "  " })).toBe(
			true
		);
	});

	it("still requires an exact match when a value is configured", () => {
		const exact = { ...settings, taskPropertyValue: "open" };
		expect(isTaskFrontmatter({ status: "open" }, exact)).toBe(true);
		expect(isTaskFrontmatter({ status: "done" }, exact)).toBe(false);
	});

	it("writes the property when a new task lacks it, without touching an existing value", () => {
		const created: Record<string, unknown> = { title: "New" };
		applyPropertyTaskIdentifier(created, "task", "");
		expect(created).toEqual({ title: "New", task: null });
		expect(isTaskFrontmatter(created, { ...settings, taskPropertyName: "task" })).toBe(true);

		const existing: Record<string, unknown> = { status: "in-progress" };
		applyPropertyTaskIdentifier(existing, "status", "");
		expect(existing).toEqual({ status: "in-progress" });

		const tags: Record<string, unknown> = {};
		applyPropertyTaskIdentifier(tags, "tags", "");
		expect(tags).toEqual({ tags: [] });
	});
});

describe("clearing the identifying property through a single-property update", () => {
	it("keeps the note a task when the identifying property is a cleared date", async () => {
		const plugin = PluginFactory.createMockPlugin({
			settings: { taskIdentificationMethod: "property", taskPropertyName: "due", taskPropertyValue: "" },
		});
		const service = new TaskService(plugin);
		const task = TaskFactory.createTask({ path: "Tasks/dated.md", due: "2026-08-10" });
		const frontmatter: Record<string, unknown> = { title: "Dated", due: "2026-08-10" };

		plugin.app.vault.getAbstractFileByPath.mockReturnValue(new TFile(task.path));
		plugin.cacheManager.getTaskInfo.mockResolvedValue(task);
		plugin.app.fileManager.processFrontMatter.mockImplementation(
			async (_file: TFile, update: (frontmatter: Record<string, unknown>) => void) => {
				update(frontmatter);
			}
		);

		await service.updateProperty(task, "due", undefined);

		expect(frontmatter).toHaveProperty("due", null);
	});
});
