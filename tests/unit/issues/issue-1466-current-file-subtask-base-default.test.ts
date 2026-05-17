/**
 * Regression test for issue #1466.
 *
 * Relationships/Subtasks Bases use filters like:
 *   list(note.projects).contains(this.file.asLink())
 *
 * When users create a new task from that embedded Base, TaskNotes should prefill
 * the project with the current note link so the new task is a subtask of that note.
 */

jest.mock("../../../src/modals/TaskCreationModal", () => ({
	TaskCreationModal: jest.fn().mockImplementation(
		(_app: unknown, _plugin: unknown, options: unknown) => ({
			open: jest.fn(),
			options,
		})
	),
}));

import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import { TaskCreationModal } from "../../../src/modals/TaskCreationModal";
import type { TaskInfo } from "../../../src/types";

class TestBasesView extends BasesViewBase {
	type = "tasknotesTest";

	render(): void {
		// No-op for this focused creation-defaults test.
	}

	renderError(): void {
		// No-op for this focused creation-defaults test.
	}

	protected async handleTaskUpdate(_task: TaskInfo): Promise<void> {
		// No-op for this focused creation-defaults test.
	}
}

function createMockPlugin(activeFile: { path: string; basename: string; extension: string } | null) {
	return {
		app: {
			workspace: {
				getActiveFile: () => activeFile,
			},
			fileManager: {
				generateMarkdownLink: (file: { basename: string }) => `[[${file.basename}]]`,
			},
		},
		fieldMapper: {
			toUserField: (field: string) => field,
		},
		i18n: {
			translate: (key: string) => (key === "common.new" ? "New" : key),
		},
		settings: {
			taskTag: "task",
			userFields: [],
		},
	} as any;
}

describe("Issue #1466: current-file subtask Base creation defaults", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("prefills the project from this.file.asLink() filters", async () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		const view = new TestBasesView(
			{},
			container,
			createMockPlugin({
				path: "Projects/Alpha.md",
				basename: "Alpha",
				extension: "md",
			})
		);
		(view as any).config = {
			filters: {
				conjunction: "and",
				filters: [
					{ rule: { text: 'file.hasTag("task")' } },
					{ rule: { text: "list(note.projects).contains(this.file.asLink())" } },
				],
			},
		};

		await view.createFileForView("New Task");

		expect(TaskCreationModal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				prePopulatedValues: expect.objectContaining({
					projects: ["[[Alpha]]"],
				}),
			})
		);
	});

	it("does not use the open .base file itself as a project default", async () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		const view = new TestBasesView(
			{},
			container,
			createMockPlugin({
				path: "TaskNotes/Views/relationships.base",
				basename: "relationships",
				extension: "base",
			})
		);
		(view as any).config = {
			filters: {
				conjunction: "and",
				filters: [
					{ rule: { text: 'file.hasTag("task")' } },
					{ rule: { text: "list(note.projects).contains(this.file.asLink())" } },
				],
			},
		};

		await view.createFileForView("New Task");

		expect(TaskCreationModal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				prePopulatedValues: {},
			})
		);
	});
});
