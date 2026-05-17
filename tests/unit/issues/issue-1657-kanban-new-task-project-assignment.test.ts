/**
 * Regression test for issue #1657.
 *
 * Reported behavior:
 * - Clicking the "+ New" button on a Kanban view filtered to a specific project
 *   opened TaskNotes' creation modal, but the new task did not inherit the
 *   project defaults supplied by Bases.
 *
 * The TaskNotes toolbar button should open TaskNotes' creation modal and carry
 * simple Bases filter defaults into that modal. Delegating to the native Bases
 * button can create a plain note outside TaskNotes' folder handling.
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
			taskTag: "task",
			userFields: [],
		},
	} as any;
}

describe("Issue #1657: Kanban + New button should assign project", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("passes simple Bases filter defaults to the TaskNotes creation modal", async () => {
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
		(view as any).config = {
			filters: {
				conjunction: "and",
				filters: [
					{ rule: { text: 'file.hasTag("task")' } },
					{ rule: { text: 'status == "To Do"' } },
					{ rule: { text: 'projects.contains("[[Project Alpha]]")' } },
				],
			},
		};
		const nativeNewClick = jest.fn();
		nativeNewButton.addEventListener("click", nativeNewClick);

		(view as any).injectNewTaskButton();
		const taskNotesButton = toolbar.querySelector<HTMLElement>(".tn-bases-new-task-btn");

		expect(taskNotesButton).not.toBeNull();
		taskNotesButton?.click();

		await Promise.resolve();
		await Promise.resolve();

		expect(nativeNewClick).not.toHaveBeenCalled();
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

	it("passes native Bases frontmatter processor values to the TaskNotes creation modal", async () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		const view = new TestBasesView({}, container, createMockPlugin());
		(view as any).config = {
			filters: {
				conjunction: "and",
				filters: [
					{ rule: { text: 'file.hasTag("task")' } },
					{ rule: { text: 'contexts.contains("work")' } },
				],
			},
		};

		await view.createFileForView("New Task", (frontmatter) => {
			frontmatter.status = "In Progress";
			frontmatter.reviewed = false;
			frontmatter.customCount = 0;
		});

		expect(TaskCreationModal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				prePopulatedValues: expect.objectContaining({
					status: "In Progress",
					contexts: ["work"],
					customFrontmatter: {
						reviewed: false,
						customCount: 0,
					},
				}),
			})
		);
	});
});
