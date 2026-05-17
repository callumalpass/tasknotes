/**
 * Issue #1426 follow-up: TaskNotes custom Bases views should implement the
 * native result-count menu hooks, not only custom getViewActions entries.
 */

import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";

class TestBasesView extends BasesViewBase {
	type = "test-tasknotes-bases";

	render(): void {}

	renderError(): void {}

	protected async handleTaskUpdate(_task: TaskInfo): Promise<void> {}
}

function createView(): TestBasesView {
	const plugin = {
		fieldMapper: {
			isRecognizedProperty: jest.fn().mockReturnValue(false),
		},
	} as unknown as TaskNotesPlugin;

	const view = new TestBasesView({}, document.createElement("div"), plugin);
	view.config = {
		getOrder: () => ["note.status", "note.priority"],
		getDisplayName: (propertyId: string) =>
			propertyId === "note.status" ? "Status" : "Priority",
		getSort: () => [],
		get: (key: string) => (key === "name" ? "Current tasks" : undefined),
	} as never;
	view.data = {
		data: [
			{
				file: { path: "Tasks/A.md" },
				getValue: (propertyId: string) =>
					String(propertyId).includes("status") ? { data: "open" } : { data: "high" },
			},
		],
		groupedData: [],
	} as never;
	return view;
}

describe("Issue #1426: native Bases result-count menu actions", () => {
	beforeEach(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: {
				writeText: jest.fn().mockResolvedValue(undefined),
			},
			configurable: true,
		});
	});

	it("exposes native copy and export hooks expected by the Bases result-count menu", () => {
		const view = createView();

		expect(typeof view.copyToClipboard).toBe("function");
		expect(typeof view.exportTable).toBe("function");
	});

	it("copies the current Bases rows as a tab-separated table", async () => {
		const view = createView();

		await (view as unknown as { copyBasesTableToClipboard(): Promise<void> })
			.copyBasesTableToClipboard();

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			"File\tStatus\tPriority\nTasks/A.md\topen\thigh"
		);
	});
});
