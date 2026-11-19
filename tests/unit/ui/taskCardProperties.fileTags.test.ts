import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { renderPropertyMetadata } from "../../../src/ui/taskCardProperties";

function createPlugin(): TaskNotesPlugin {
	return {
		i18n: createI18nService(),
		settings: {
			taskIdentificationMethod: "tag",
			taskTag: "task",
			hideIdentifyingTagsInCards: false,
		},
		fieldMapper: {
			lookupMappingKey: jest.fn(() => null),
			isPropertyForField: jest.fn(() => false),
		},
		openTagsPane: jest.fn(),
	} as unknown as TaskNotesPlugin;
}

describe("file.tags on task cards", () => {
	it("keeps each tag separate when the Task List shows tags without #", () => {
		const task = { path: "Tasks/a.md", title: "A", status: "open", priority: "normal", archived: false, tags: ["task", "work"] } as TaskInfo;
		const container = document.createElement("div");
		const element = renderPropertyMetadata(container, "file.tags", task, createPlugin(), { plainTags: true });
		expect([...(element?.querySelectorAll(".tag") ?? [])].map((tag) => tag.textContent)).toEqual(["task", "work"]);
	});
});
