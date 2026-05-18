import {
	sanitizeTaskTitleForFilename,
	sanitizeTaskTitleForStorage,
} from "../../../src/services/task-service/taskTitleSanitizer";

describe("taskTitleSanitizer", () => {
	it("normalizes whitespace and strips filename-unsafe characters for filenames", () => {
		expect(sanitizeTaskTitleForFilename("  [[Project]]: email / follow-up?  ")).toBe(
			"Project email  follow-up"
		);
		expect(sanitizeTaskTitleForFilename("...report...")).toBe("report");
	});

	it("preserves storage-safe title punctuation while removing control characters", () => {
		expect(sanitizeTaskTitleForStorage("  Why now? \u0000  Because: yes  ")).toBe(
			"Why now?  Because: yes"
		);
	});

	it("falls back to untitled when sanitization removes the whole title", () => {
		expect(sanitizeTaskTitleForFilename("[]")).toBe("untitled");
		expect(sanitizeTaskTitleForStorage("\u0000")).toBe("untitled");
		expect(sanitizeTaskTitleForFilename("")).toBe("untitled");
		expect(sanitizeTaskTitleForStorage("")).toBe("untitled");
	});
});
