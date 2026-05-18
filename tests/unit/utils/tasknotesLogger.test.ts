import {
	createTaskNotesLogger,
	getUserSafeErrorMessage,
	type TaskNotesLogCategory,
} from "../../../src/utils/tasknotesLogger";

function createSink() {
	return {
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	};
}

describe("tasknotesLogger", () => {
	it("gates debug logs behind the configured debug flag", () => {
		const sink = createSink();
		let enabled = false;
		const logger = createTaskNotesLogger({
			tag: "Bases/API",
			isDebugEnabled: () => enabled,
			sink,
		});

		logger.debug("Hidden diagnostic", { category: "configuration", operation: "get-api" });
		expect(sink.debug).not.toHaveBeenCalled();

		enabled = true;
		logger.debug("Visible diagnostic", { category: "configuration", operation: "get-api" });

		expect(sink.debug).toHaveBeenCalledWith(
			"[TaskNotes][Bases/API][configuration][get-api] Visible diagnostic"
		);
	});

	it("emits structured context and preserves details and errors", () => {
		const sink = createSink();
		const logger = createTaskNotesLogger({ tag: "Bases/View", sink });
		const error = new Error("Clipboard unavailable");

		logger.error("Failed to copy view rows", {
			category: "provider",
			operation: "copy-table",
			details: { rows: 12 },
			error,
		});

		expect(sink.error).toHaveBeenCalledWith(
			"[TaskNotes][Bases/View][provider][copy-table] Failed to copy view rows",
			{ rows: 12 },
			error
		);
	});

	it("composes child logger tags lazily", () => {
		const sink = createSink();
		let viewType = "tasknotesKanban";
		const parent = createTaskNotesLogger({ tag: () => `Bases/${viewType}`, sink });
		const child = parent.child("DataAdapter");

		viewType = "tasknotesCalendar";
		child.warn("Failed to read property", {
			category: "provider",
			operation: "get-property-value",
		});

		expect(sink.warn).toHaveBeenCalledWith(
			"[TaskNotes][Bases/tasknotesCalendar/DataAdapter][provider][get-property-value] Failed to read property"
		);
	});

	it.each([
		["validation", "TaskNotes could not use the provided data."],
		["persistence", "TaskNotes could not save the change."],
		["provider", "TaskNotes could not reach the external provider."],
		["configuration", "TaskNotes needs a settings update before it can continue."],
		["stale-data", "TaskNotes needs fresh task data before it can continue."],
		["internal", "TaskNotes ran into an unexpected internal error."],
	] as Array<[TaskNotesLogCategory, string]>)(
		"formats a user-safe %s error message",
		(category, expected) => {
			expect(getUserSafeErrorMessage(category)).toBe(expected);
			expect(getUserSafeErrorMessage(category, "Could not refresh Bases views")).toBe(
				`Could not refresh Bases views. ${expected}`
			);
		}
	);
});
