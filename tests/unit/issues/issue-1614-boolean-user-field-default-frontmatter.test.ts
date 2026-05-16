/**
 * Issue #1614: Boolean custom user field defaults are visible in the modal but
 * omitted from created task frontmatter when the unchecked state was never
 * persisted to settings.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1614
 */

import { TaskService } from "../../../src/services/TaskService";
import type { UserMappedField } from "../../../src/types/settings";
import { PluginFactory } from "../../helpers/mock-factories";

jest.mock("../../../src/utils/dateUtils", () => ({
	getCurrentTimestamp: jest.fn(() => "2026-05-17T00:00:00+10:00"),
	getCurrentDateString: jest.fn(() => "2026-05-17"),
}));

jest.mock("../../../src/utils/filenameGenerator", () => ({
	generateTaskFilename: jest.fn(() => "review-new-task"),
	generateUniqueFilename: jest.fn(() => "review-new-task"),
}));

jest.mock("../../../src/utils/helpers", () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
	calculateDefaultDate: jest.fn(),
}));

jest.mock("../../../src/utils/templateProcessor", () => ({
	processTemplate: jest.fn(async () => ({ frontmatter: {}, body: "" })),
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

const BOOLEAN_FIELD: UserMappedField = {
	id: "reviewed",
	displayName: "Reviewed",
	key: "reviewed",
	type: "boolean",
};

function createTaskServiceWithField(field: UserMappedField): {
	service: TaskService;
	mockPlugin: ReturnType<typeof PluginFactory.createMockPlugin>;
} {
	const mockPlugin = PluginFactory.createMockPlugin();
	mockPlugin.settings.userFields = [field];
	mockPlugin.fieldMapper.updateUserFields(mockPlugin.settings.userFields);

	return {
		service: new TaskService(mockPlugin),
		mockPlugin,
	};
}

describe("Issue #1614: boolean custom user field defaults", () => {
	it("writes false for boolean user fields without a persisted default", async () => {
		const { service, mockPlugin } = createTaskServiceWithField(BOOLEAN_FIELD);

		await service.createTask({ title: "Review new task" });

		const [, content] = mockPlugin.app.vault.create.mock.calls[0] as [string, string];

		expect(content).toContain("reviewed: false");
	});

	it("does not overwrite an explicit boolean custom field value", async () => {
		const { service, mockPlugin } = createTaskServiceWithField(BOOLEAN_FIELD);

		await service.createTask({
			title: "Review new task",
			customFrontmatter: {
				reviewed: true,
			},
		});

		const [, content] = mockPlugin.app.vault.create.mock.calls[0] as [string, string];

		expect(content).toContain("reviewed: true");
		expect(content).not.toContain("reviewed: false");
	});
});
