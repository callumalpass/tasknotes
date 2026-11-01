import { describe, expect, it, jest } from "@jest/globals";
import { PluginFactory } from "../../helpers/mock-factories";
import { TaskCreationService } from "../../../src/services/task-service/TaskCreationService";

jest.mock("../../../src/utils/dateUtils", () => ({
	getCurrentTimestamp: jest.fn(() => "2026-11-01T00:00:00+10:00"),
}));

jest.mock("../../../src/utils/filenameGenerator", () => ({
	generateTaskFilename: jest.fn(() => "with-attachments"),
	generateUniqueFilename: jest.fn(() => "with-attachments"),
}));

jest.mock("../../../src/utils/helpers", () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../src/utils/templateProcessor", () => ({
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

describe("task creation attachments", () => {
	it("writes attachment links chosen in the create modal to the new task's frontmatter", async () => {
		const mockPlugin = PluginFactory.createMockPlugin();
		const service = new TaskCreationService({
			runtime: mockPlugin,
			applyTaskCreationDefaults: jest.fn(async (taskData) => taskData),
			applyTemplate: jest.fn(async () => ({ frontmatter: {}, body: "" })),
			processFolderTemplate: jest.fn((folderTemplate) => folderTemplate),
			sanitizeTitleForFilename: jest.fn((input) => input),
			sanitizeTitleForStorage: jest.fn((input) => input),
		});

		await service.createTask(
			{ title: "With attachments", attachments: ["[[Files/receipt.png]]"] },
			{ applyDefaults: false }
		);

		expect(mockPlugin.app.vault.create).toHaveBeenCalledWith(
			"Tasks/with-attachments.md",
			expect.stringContaining("attachments:\n  - \"[[Files/receipt.png]]\"")
		);
	});
});
