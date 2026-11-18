/**
 * Issue #2574: the stable task ID property can be remapped like other fields.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2574
 */

import { describe, expect, it, jest } from "@jest/globals";
import { FieldMapper } from "../../../src/core/FieldMapper";
import { PluginFactory } from "../../helpers/mock-factories";
import { TaskCreationService } from "../../../src/services/task-service/TaskCreationService";
import { applyTaskUpdateFrontmatterChange } from "../../../src/services/task-service/taskUpdatePlanning";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";

jest.mock("../../../src/utils/dateUtils", () => ({
	getCurrentTimestamp: jest.fn(() => "2026-11-18T00:00:00+10:00"),
}));

jest.mock("../../../src/utils/filenameGenerator", () => ({
	generateTaskFilename: jest.fn(() => "remapped-id"),
	generateUniqueFilename: jest.fn(() => "remapped-id"),
}));

jest.mock("../../../src/utils/helpers", () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../src/utils/templateProcessor", () => ({
	mergeTemplateFrontmatter: jest.fn((base: object, template: object) => ({ ...base, ...template })),
}));

const mapping = { ...DEFAULT_FIELD_MAPPING, id: "tasknote_id" };

describe("Issue #2574: remappable task ID", () => {
	it("defaults to id", () => {
		expect(DEFAULT_FIELD_MAPPING.id).toBe("id");
		expect(new FieldMapper(DEFAULT_FIELD_MAPPING).mapFromFrontmatter({ id: "abc" }, "T.md").id).toBe("abc");
	});

	it("reads the ID from the mapped property and leaves a plain id alone", () => {
		const mapper = new FieldMapper(mapping);
		const task = mapper.mapFromFrontmatter({ tasknote_id: "abc", id: "mine" }, "T.md");
		expect(task.id).toBe("abc");
		expect(mapper.mapFromFrontmatter({ id: "mine" }, "T.md").id).toBeUndefined();
	});

	it("updates write the ID to the mapped property and cannot replace it", () => {
		const frontmatter: Record<string, unknown> = { id: "mine" };
		const originalTask: TaskInfo = {
			id: "abc",
			title: "Task",
			status: "open",
			priority: "normal",
			path: "T.md",
			archived: false,
			tags: [],
		};
		applyTaskUpdateFrontmatterChange({
			frontmatter,
			originalTask,
			updates: { customFrontmatter: { tasknote_id: "other", id: "changed" } },
			recurrenceUpdates: {},
			dateModified: "2026-11-18T00:00:00Z",
			fieldMapper: new FieldMapper(mapping),
			taskIdentification: { method: "tag", tag: "task", propertyName: "", propertyValue: "" },
			storeTitleInFilename: false,
			updateCompletedDateInFrontmatter: jest.fn(),
		});
		expect(frontmatter.tasknote_id).toBe("abc");
		expect(frontmatter.id).toBe("changed");
	});

	it("creation writes the new ID to the mapped property", async () => {
		const plugin = PluginFactory.createMockPlugin();
		plugin.fieldMapper = new FieldMapper(mapping);
		const service = new TaskCreationService({
			runtime: plugin,
			applyTaskCreationDefaults: jest.fn(async (taskData) => taskData),
			applyTemplate: jest.fn(async () => ({ frontmatter: { id: "from-template" }, body: "" })),
			processFolderTemplate: jest.fn((folderTemplate) => folderTemplate),
			sanitizeTitleForFilename: jest.fn((input) => input),
			sanitizeTitleForStorage: jest.fn((input) => input),
		} as never);

		const { taskInfo } = await service.createTask({ title: "Remapped" }, { applyDefaults: false });

		const content = (plugin.app.vault.create as jest.Mock).mock.calls[0][1] as string;
		expect(taskInfo.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(content).toContain(`tasknote_id: ${taskInfo.id}`);
		expect(content).toContain("id: from-template");
	});
});
