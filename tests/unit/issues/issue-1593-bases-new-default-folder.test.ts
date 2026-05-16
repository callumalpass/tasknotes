/**
 * Regression test for issue #1593.
 *
 * TaskNotes Bases views inject their own New button so task creation can use the
 * TaskNotes creation modal and TaskCreationService. The native Bases New menu
 * creates a plain note first, which bypasses the configured default tasks folder.
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

describe("Issue #1593: Bases New button should use TaskNotes task creation", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("opens the TaskNotes creation modal instead of the native Bases new-item menu", async () => {
		const wrapper = document.createElement("div");
		const toolbar = document.createElement("div");
		toolbar.className = "bases-toolbar";
		const staleTaskNotesButton = document.createElement("div");
		staleTaskNotesButton.className = "bases-toolbar-item tn-bases-new-task-btn";
		const staleButtonClick = jest.fn();
		staleTaskNotesButton.addEventListener("click", staleButtonClick);
		toolbar.appendChild(staleTaskNotesButton);
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
		const nativeNewClick = jest.fn();
		nativeNewButton.addEventListener("click", nativeNewClick);

		(view as any).injectNewTaskButton();
		const taskNotesButton = toolbar.querySelector<HTMLElement>(".tn-bases-new-task-btn");

		expect(taskNotesButton).not.toBeNull();
		expect(toolbar.querySelectorAll(".tn-bases-new-task-btn")).toHaveLength(1);
		taskNotesButton?.click();

		await Promise.resolve();
		await Promise.resolve();

		expect(staleButtonClick).not.toHaveBeenCalled();
		expect(nativeNewClick).not.toHaveBeenCalled();
		expect(TaskCreationModal).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.objectContaining({
				prePopulatedValues: {},
			})
		);
	});
});
