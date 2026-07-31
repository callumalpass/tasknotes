import type { TaskCreationData, TaskInfo } from "../../../src/types";
import type { JiraIssue } from "../../../src/integrations/jira/JiraIssueAdapter";
import {
	JiraImportError,
	JiraImportService,
} from "../../../src/services/JiraImportService";
import {
	createDefaultJiraMappingSettings,
	mapJiraIssueWithSettings,
} from "../../../src/integrations/jira/JiraFieldMapping";
import { applyParentNoteProjectDefault } from "../../../src/utils/taskCreationPrepopulation";

const issue: JiraIssue = {
	key: "WIZ-42",
	fields: {
		summary: "Teach the build dragon to whisper",
		description: {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "The CI flames are too loud." }],
				},
			],
		},
		status: { name: "In Progress" },
		priority: { name: "HIGH" },
		created: "2026-07-30T12:00:00.000Z",
		duedate: "2026-08-04",
		timeestimate: 2700,
		labels: ["demo", 12, "dragon"],
	},
};

describe("default Jira field mapping", () => {
	it("maps the baseline Jira fields without involving core frontmatter mapping", () => {
		expect(
			mapJiraIssueWithSettings(issue, createDefaultJiraMappingSettings(), [])
		).toEqual(
			expect.objectContaining({
			id: "WIZ-42",
			title: "WIZ-42 Teach the build dragon to whisper",
			details: "JIRA:WIZ-42\n\nThe CI flames are too loud.",
			status: "In Progress",
			priority: "high",
			dateCreated: "2026-07-30T12:00:00.000Z",
			due: "2026-08-04",
			timeEstimate: 45,
			tags: ["demo", "12", "dragon"],
			creationContext: "import",
			})
		);
	});
});

describe("JiraImportService", () => {
	it("fetches once and creates exactly one task through current creation defaults", async () => {
		const adapter = { getIssue: jest.fn().mockResolvedValue(issue) };
		const taskInfo = {
			path: "Tasks/WIZ-42 Teach the build dragon to whisper.md",
			title: "WIZ-42 Teach the build dragon to whisper",
		} as TaskInfo;
		const taskCreator = {
			createTask: jest.fn().mockResolvedValue({ taskInfo }),
		};
		const service = new JiraImportService(
			adapter as never,
			taskCreator,
			createDefaultJiraMappingSettings(),
			[]
		);

		await expect(service.importIssue("WIZ-42")).resolves.toBe(taskInfo);
		expect(adapter.getIssue).toHaveBeenCalledTimes(1);
		expect(taskCreator.createTask).toHaveBeenCalledTimes(1);
		expect(taskCreator.createTask).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "WIZ-42 Teach the build dragon to whisper",
				creationContext: "import",
			}),
			{ applyDefaults: true, applyTemplate: true }
		);
	});

	it("uses the current-note project default only when Jira did not map projects", async () => {
		const adapter = { getIssue: jest.fn().mockResolvedValue(issue) };
		const taskCreator = {
			createTask: jest.fn().mockResolvedValue({
				taskInfo: { path: "Tasks/WIZ-42.md", title: "Imported" } as TaskInfo,
			}),
		};
		const applyCurrentNoteProject = (taskData: TaskCreationData): TaskCreationData =>
			(applyParentNoteProjectDefault(
				taskData,
				"[[Wizard laboratory]]"
			) as TaskCreationData | undefined) ?? taskData;
		const defaults = createDefaultJiraMappingSettings();
		const service = new JiraImportService(
			adapter as never,
			taskCreator,
			defaults,
			[],
			applyCurrentNoteProject
		);

		await service.importIssue("WIZ-42");
		expect(taskCreator.createTask).toHaveBeenLastCalledWith(
			expect.objectContaining({ projects: ["[[Wizard laboratory]]"] }),
			expect.anything()
		);

		defaults.fields.projects = [
			{ mode: "fixed", value: "[[Explicit Jira project]]" },
		];
		await service.importIssue("WIZ-42");
		expect(taskCreator.createTask).toHaveBeenLastCalledWith(
			expect.objectContaining({ projects: ["[[Explicit Jira project]]"] }),
			expect.anything()
		);
	});

	it("does not attempt creation after a fetch failure", async () => {
		const adapter = {
			getIssue: jest
				.fn()
				.mockRejectedValue(
					new JiraImportError("fetch-failed", "Jira is unavailable")
				),
		};
		const taskCreator = { createTask: jest.fn() };
		const service = new JiraImportService(
			adapter as never,
			taskCreator as never,
			createDefaultJiraMappingSettings(),
			[]
		);

		await expect(service.importIssue("WIZ-42")).rejects.toMatchObject({
			code: "fetch-failed",
		});
		expect(taskCreator.createTask).not.toHaveBeenCalled();
	});

	it("distinguishes task creation failures from fetch failures", async () => {
		const adapter = { getIssue: jest.fn().mockResolvedValue(issue) };
		const taskCreator = {
			createTask: jest.fn().mockRejectedValue(new Error("vault is read-only")),
		};
		const service = new JiraImportService(
			adapter as never,
			taskCreator,
			createDefaultJiraMappingSettings(),
			[]
		);

		await expect(service.importIssue("WIZ-42")).rejects.toMatchObject({
			code: "creation-failed",
		});
	});
});
