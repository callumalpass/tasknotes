import { createTaskInfoFromBasesData } from "../../../src/bases/helpers";
import type TaskNotesPlugin from "../../../src/main";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

function createPlugin(sortOrderField = "sort_order") {
	const fieldMapper = new FieldMapper({
		...DEFAULT_FIELD_MAPPING,
		sortOrder: sortOrderField,
	});

	return {
		fieldMapper,
		settings: {
			defaultTaskStatus: "open",
			storeTitleInFilename: false,
		},
		dependencyCache: undefined,
	};
}

describe("Bases TaskInfo assembly", () => {
	it("preserves mapped manual-order values on TaskInfo", () => {
		const task = createTaskInfoFromBasesData(
			{
				path: "Tasks/Manual.md",
				name: "Manual",
				properties: {
					title: "Manual",
					status: "open",
					sort_order: "0|hzzzzz:",
				},
			},
			createPlugin() as unknown as TaskNotesPlugin
		);

		expect(task?.sortOrder).toBe("0|hzzzzz:");
		expect(task?.customProperties?.sortOrder).toBeUndefined();
	});
});
