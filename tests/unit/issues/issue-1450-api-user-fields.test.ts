import type { App } from "obsidian";
import { App as MockApp, MockObsidian } from "../../__mocks__/obsidian";
import { mapTaskToFrontmatter } from "../../../src/core/fieldMapping";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";
import type { UserMappedField } from "../../../src/types/settings";
import { TaskManager } from "../../../src/utils/TaskManager";

const USER_FIELDS: UserMappedField[] = [
	{
		id: "impact",
		displayName: "Impact",
		key: "impact",
		type: "number",
	},
	{
		id: "stakeholders",
		displayName: "Stakeholders",
		key: "stakeholders",
		type: "list",
	},
];

const createMockApp = (): App => new MockApp() as unknown as App;

describe("Issue #1450: HTTP API task reads expose user fields", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("includes configured user fields in TaskInfo customProperties", async () => {
		const app = createMockApp();
		const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING, USER_FIELDS);
		const manager = new TaskManager(
			app,
			{
				...DEFAULT_SETTINGS,
				taskIdentificationMethod: "tag",
				taskTag: "task",
				excludedFolders: "",
				storeTitleInFilename: false,
			},
			fieldMapper
		);

		MockObsidian.createTestFile(
			"TaskNotes/Tasks/api-user-fields.md",
			[
				"---",
				"title: API user fields",
				"status: open",
				"priority: normal",
				"tags:",
				"  - task",
				"impact: 7",
				"stakeholders:",
				"  - '[[Alice]]'",
				"  - '[[Bob]]'",
				"---",
				"",
				"Task body",
			].join("\n")
		);
		const metadataCache = app.metadataCache as unknown as {
			setCache(path: string, metadata: unknown): void;
		};
		metadataCache.setCache("TaskNotes/Tasks/api-user-fields.md", {
			frontmatter: {
				title: "API user fields",
				status: "open",
				priority: "normal",
				tags: ["task"],
				impact: 7,
				stakeholders: ["[[Alice]]", "[[Bob]]"],
			},
		});

		const task = await manager.getTaskInfo("TaskNotes/Tasks/api-user-fields.md");

		expect(task).toMatchObject({
			title: "API user fields",
			impact: 7,
			stakeholders: ["[[Alice]]", "[[Bob]]"],
			customProperties: {
				impact: 7,
				stakeholders: ["[[Alice]]", "[[Bob]]"],
			},
		});

		expect(JSON.parse(JSON.stringify(task))).toMatchObject({
			customProperties: {
				impact: 7,
				stakeholders: ["[[Alice]]", "[[Bob]]"],
			},
		});
	});

	it("writes configured user fields from customProperties payloads", () => {
		const frontmatter = mapTaskToFrontmatter(
			DEFAULT_FIELD_MAPPING,
			{
				title: "API user fields",
				status: "open",
				priority: "normal",
				path: "TaskNotes/Tasks/api-user-fields.md",
				archived: false,
				customProperties: {
					impact: 5,
					stakeholders: ["[[Alice]]"],
					unconfigured: "ignored",
				},
			} satisfies Partial<TaskInfo>,
			"task",
			false,
			USER_FIELDS
		);

		expect(frontmatter.impact).toBe(5);
		expect(frontmatter.stakeholders).toEqual(["[[Alice]]"]);
		expect(frontmatter.unconfigured).toBeUndefined();
	});
});
