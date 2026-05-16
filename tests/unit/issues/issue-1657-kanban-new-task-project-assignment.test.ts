/**
 * Regression test for issue #1657.
 *
 * Reported behavior:
 * - Clicking the "+ New" button on a Kanban view filtered to a specific project
 *   opened TaskNotes' creation modal, but the new task did not inherit the
 *   project defaults supplied by Bases.
 *
 * The TaskNotes toolbar button should delegate to the native Bases new button
 * when it is present. Bases owns the frontmatterProcessor for view/filter/group
 * defaults, so bypassing that native button drops those defaults.
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
		// No-op for this focused toolbar behavior test.
	}

	renderError(): void {
		// No-op for this focused toolbar behavior test.
	}

	protected async handleTaskUpdate(_task: TaskInfo): Promise<void> {
		// No-op for this focused toolbar behavior test.
	}
}

function createMockPlugin() {
	return {
		app: {},
		fieldMapper: {
			toUserField: (field: string) => field,
		},
		i18n: {
			translate: (key: string) => (key === "common.new" ? "New" : key),
		},
		settings: {
			userFields: [],
		},
	} as any;
}

describe("Issue #1657: Kanban + New button should assign project", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("delegates the TaskNotes toolbar button to the native Bases new button", async () => {
		const wrapper = document.createElement("div");
		const toolbar = document.createElement("div");
		toolbar.className = "bases-toolbar";
		const nativeNewButton = document.createElement("button");
		nativeNewButton.className = "bases-toolbar-new-item-menu";
		toolbar.appendChild(nativeNewButton);

		const basesViewEl = document.createElement("div");
		basesViewEl.className = "bases-view";
		const container = document.createElement("div");
		basesViewEl.appendChild(container);

		wrapper.appendChild(toolbar);
		wrapper.appendChild(basesViewEl);
		document.body.appendChild(wrapper);

		const view = new TestBasesView({}, container, createMockPlugin());
		const creationCalls: Promise<void>[] = [];
		nativeNewButton.addEventListener("click", () => {
			creationCalls.push(
				view.createFileForView("New Task", (frontmatter) => {
					frontmatter.status = "To Do";
					frontmatter.projects = ["[[Project Alpha]]"];
				})
			);
		});

		(view as any).injectNewTaskButton();
		const taskNotesButton = toolbar.querySelector<HTMLElement>(".tn-bases-new-task-btn");

		expect(taskNotesButton).not.toBeNull();
		taskNotesButton?.click();

		expect(creationCalls).toHaveLength(1);
		await creationCalls[0];

		expect(TaskCreationModal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				prePopulatedValues: expect.objectContaining({
					status: "To Do",
					projects: ["[[Project Alpha]]"],
				}),
			})
		);
	});
});
