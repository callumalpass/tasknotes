/**
 * Regression coverage for Issue #1629: dependencies selected in the Create Task
 * modal must be persisted by the task creation service.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1629
 */

import { describe, expect, it, jest } from "@jest/globals";
import { PluginFactory } from "../../helpers/mock-factories";
import { TaskCreationService } from "../../../src/services/task-service/TaskCreationService";
import type { TaskDependency } from "../../../src/types";

jest.mock("../../../src/utils/dateUtils", () => ({
	getCurrentTimestamp: jest.fn(() => "2026-05-17T00:00:00+10:00"),
}));

jest.mock("../../../src/utils/filenameGenerator", () => ({
	generateTaskFilename: jest.fn(() => "blocked-task"),
	generateUniqueFilename: jest.fn(() => "blocked-task"),
}));

jest.mock("../../../src/utils/helpers", () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../src/utils/templateProcessor", () => ({
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

describe("Issue #1629: blockedBy field not saved on create task", () => {
	it("passes blockedBy dependencies through to frontmatter when creating a task", async () => {
		const mockPlugin = PluginFactory.createMockPlugin();
		const dependency: TaskDependency = {
			uid: "Some Other Task",
			reltype: "FINISHTOSTART",
		};
		const mapToFrontmatterSpy = jest.spyOn(mockPlugin.fieldMapper, "mapToFrontmatter");

		const service = new TaskCreationService({
			plugin: mockPlugin,
			applyTaskCreationDefaults: jest.fn(async (taskData) => taskData),
			applyTemplate: jest.fn(async () => ({ frontmatter: {}, body: "" })),
			processFolderTemplate: jest.fn((folderTemplate) => folderTemplate),
			sanitizeTitleForFilename: jest.fn((input) => input),
			sanitizeTitleForStorage: jest.fn((input) => input),
		});

		await service.createTask(
			{
				title: "Blocked task",
				blockedBy: [dependency],
			},
			{ applyDefaults: false }
		);

		const mappedFrontmatter = mapToFrontmatterSpy.mock.results[0].value as Record<
			string,
			unknown
		>;

		expect(mapToFrontmatterSpy).toHaveBeenCalledWith(
			expect.objectContaining({ blockedBy: [dependency] }),
			"task",
			undefined
		);
		expect(mappedFrontmatter.blockedBy).toEqual([
			{
				uid: "[[Some Other Task]]",
				reltype: "FINISHTOSTART",
			},
		]);
		expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
			"Tasks/blocked-task.md",
			expect.stringContaining("blockedBy:")
		);
		expect(mockPlugin.cacheManager.updateTaskInfoInCache).toHaveBeenCalledWith(
			"Tasks/blocked-task.md",
			expect.objectContaining({ blockedBy: expect.any(Array) })
		);
	});
});
