import { identifyTaskNotesFromBasesData, type BasesDataItem } from "../../../src/bases/helpers";
import type TaskNotesPlugin from "../../../src/main";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { isPathInExcludedFolder, parseExcludedFolders } from "../../../src/utils/pathExclusions";

function createPlugin(excludedFoldersSetting: string): TaskNotesPlugin {
	const excludedFolders = parseExcludedFolders(excludedFoldersSetting);

	return {
		fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
		settings: {
			...DEFAULT_SETTINGS,
			taskIdentificationMethod: "property",
			taskPropertyName: "type",
			taskPropertyValue: "Task note",
			excludedFolders: excludedFoldersSetting,
			storeTitleInFilename: false,
		},
		cacheManager: {
			isValidFile: jest.fn(
				(path: string) => !isPathInExcludedFolder(path, excludedFolders)
			),
		},
		dependencyCache: undefined,
	} as unknown as TaskNotesPlugin;
}

describe("Issue #1970: Bases views respect excluded folders", () => {
	it("does not convert excluded Bases entries into rendered task cards", async () => {
		const dataItems: BasesDataItem[] = [
			{
				path: "8 PKM organization/83 PKM templates/831 Full templates/Template - Task note.md",
				name: "Template - Task note",
				properties: {
					type: "Task note",
					title: "Template - Task note",
				},
			},
			{
				path: "4 Specific content/43 Productivity/432 Tasks/Real Task.md",
				name: "Real Task",
				properties: {
					type: "Task note",
					title: "Real Task",
				},
			},
		];

		const plugin = createPlugin("8 PKM organization/83 PKM templates/831 Full templates");
		const result = await identifyTaskNotesFromBasesData(dataItems, plugin);

		expect(result.map((task) => task.path)).toEqual([
			"4 Specific content/43 Productivity/432 Tasks/Real Task.md",
		]);
		expect(plugin.cacheManager.isValidFile).toHaveBeenCalledWith(
			"8 PKM organization/83 PKM templates/831 Full templates/Template - Task note.md"
		);
	});
});
