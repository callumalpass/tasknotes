import { TaskSelectorWithCreateModal } from "../../../src/modals/TaskSelectorWithCreateModal";
import { processFolderTemplate } from "../../../src/utils/folderTemplateProcessor";
import type { TaskCreationData } from "../../../src/types";
import type { ParsedTaskData } from "../../../src/services/NaturalLanguageParser";

function buildData(defaults?: Partial<TaskCreationData>, parsed = { title: "Child" }): TaskCreationData {
	const prototype = TaskSelectorWithCreateModal.prototype as unknown as {
		buildTaskDataFromParsed: (parsed: ParsedTaskData) => TaskCreationData;
	};
	return prototype.buildTaskDataFromParsed.call({
		plugin: { settings: { defaultTaskStatus: "open", defaultTaskPriority: "normal" } },
		options: { creationDefaults: defaults },
	}, parsed as ParsedTaskData);
}

describe("Issue #2347: selector-created subtasks have parent context before folder resolution", () => {
	it("includes the parent project in creation data", () => {
		const data = buildData({ projects: ["Projects/Parent"] });
		expect(data.projects).toEqual(["Projects/Parent"]);
		expect(processFolderTemplate("{{projectFolder}}/{{project}}", {
			taskData: data,
			extractProjectBasename: () => "Parent",
			extractProjectFilePath: () => "Projects/Parent.md",
		})).toBe("Projects/Parent");
	});

	it("preserves inherited defaults and combines explicitly entered projects without losing the parent", () => {
		const data = buildData({
			projects: ["Parent"], tags: ["inherited"], contexts: ["home"], priority: "high",
		}, { title: "Child", projects: ["Other", "Parent"], tags: ["explicit"], priority: "low" } as ParsedTaskData);
		expect(data.projects).toEqual(["Parent", "Other"]);
		expect(data.tags).toEqual(["inherited", "explicit"]);
		expect(data.contexts).toEqual(["home"]);
		expect(data.priority).toBe("low");
		expect(buildData({ priority: "high" }).priority).toBe("high");
	});

	it("leaves generic selector creation unchanged", () => {
		const data = buildData();
		expect(data.projects).toBeUndefined();
		expect(data.priority).toBe("normal");
	});
});
