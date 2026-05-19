import {
	buildBasesTaskCreationDataForView,
	getBasesCurrentFileLinkDefault,
} from "../../../src/bases/basesCreateFileForView";
import type { TaskCreationFieldMapper } from "../../../src/bases/basesTaskCreation";
import type { FieldMappingKey } from "../../../src/types";

const fieldMapper: TaskCreationFieldMapper = {
	toUserField: (field: FieldMappingKey) =>
		({
			priority: "priority_test",
			archiveTag: "archived",
		})[field] ?? field,
};

describe("Bases create-file view helpers", () => {
	it("builds task creation data from Base filters and processor defaults", () => {
		const data = buildBasesTaskCreationDataForView({
			config: {
				filters: {
					conjunction: "and",
					filters: [
						{ rule: { text: 'status == "open"' } },
						{ rule: { text: 'file.hasTag("phase-live")' } },
						{ rule: { text: "projects.contains(this.file.asLink())" } },
						{ rule: { text: 'client == "Acme"' } },
					],
				},
			},
			fieldMapper,
			taskTag: "task",
			userFields: [{ key: "client" }],
			currentFileLink: () => "[[Projects/Launch]]",
			frontmatterProcessor: (frontmatter) => {
				frontmatter.priority_test = "high";
				frontmatter.extra = "kept";
			},
		});

		expect(data).toEqual({
			status: "open",
			priority: "high",
			projects: ["[[Projects/Launch]]"],
			tags: ["phase-live"],
			archived: false,
			customFrontmatter: {
				client: "Acme",
				extra: "kept",
			},
		});
	});

	it("does not default a current-file link when the active file is a Base", () => {
		const app = {
			workspace: {
				getActiveFile: () => ({ extension: "base", path: "Views/tasks.base" }),
			},
			fileManager: {
				generateMarkdownLink: jest.fn(),
			},
		};

		expect(getBasesCurrentFileLinkDefault(app as never)).toBeNull();
		expect(app.fileManager.generateMarkdownLink).not.toHaveBeenCalled();
	});

	it("uses Obsidian markdown link generation for the active markdown file", () => {
		const activeFile = { extension: "md", path: "Projects/Launch.md" };
		const app = {
			workspace: {
				getActiveFile: () => activeFile,
			},
			fileManager: {
				generateMarkdownLink: jest.fn(() => "[[Projects/Launch]]"),
			},
		};

		expect(getBasesCurrentFileLinkDefault(app as never)).toBe("[[Projects/Launch]]");
		expect(app.fileManager.generateMarkdownLink).toHaveBeenCalledWith(
			activeFile,
			activeFile.path
		);
	});
});
