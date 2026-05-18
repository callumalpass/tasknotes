/**
 * Issue #323: task modal action order should match the right-click task menu.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/323
 */

import type { App } from "obsidian";
import { TaskModal } from "../../../src/modals/TaskModal";
import { MockObsidian } from "../../__mocks__/obsidian";

jest.mock("obsidian");

class TaskModalHarness extends TaskModal {
	async initializeFormData(): Promise<void> {}
	async handleSave(): Promise<void> {}
	getModalTitle(): string {
		return "Harness";
	}

	renderActionTypes(): string[] {
		this.createActionBar(this.contentEl);
		return Array.from(this.contentEl.querySelectorAll<HTMLElement>("[data-type]")).map(
			(icon) => icon.dataset.type || ""
		);
	}
}

function createPlugin() {
	return {
		i18n: {
			translate: (key: string) => key,
		},
		settings: {
			customStatuses: [
				{ id: "open", value: "open", label: "Open", color: "", order: 0 },
			],
			customPriorities: [
				{ id: "normal", value: "normal", label: "Normal", color: "", weight: 0 },
			],
			defaultTaskStatus: "open",
			defaultTaskPriority: "normal",
		},
	} as never;
}

describe("Issue #323: task modal action order", () => {
	let app: App;

	beforeEach(() => {
		MockObsidian.reset();
		app = MockObsidian.createMockApp() as unknown as App;
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("matches the right-click menu order for core task actions", () => {
		const modal = new TaskModalHarness(app, createPlugin());
		const actionTypes = modal.renderActionTypes();

		expect(actionTypes).toEqual([
			"status",
			"priority",
			"due-date",
			"scheduled-date",
			"recurrence",
			"reminders",
		]);
	});
});
