import { TaskNotesAPI } from "../../../src/api/TaskNotesAPI";
import { TaskNotesApiError } from "../../../src/api/runtime-api";
import type TaskNotesPlugin from "../../../src/main";

function createPluginMock(overrides: Record<string, unknown> = {}): TaskNotesPlugin {
	return {
		settings: {
			customStatuses: [
				{
					id: "status-open",
					value: "open",
					label: "Open",
					color: "blue",
					isCompleted: false,
					order: 0,
				},
			],
			customPriorities: [
				{
					id: "priority-high",
					value: "high",
					label: "High",
					color: "red",
					weight: 10,
				},
			],
			nlpDefaultToScheduled: true,
			nlpLanguage: "en",
			nlpTriggers: undefined,
			userFields: [],
			calendarViewSettings: {
				locale: "en-US",
			},
			...overrides,
		},
	} as unknown as TaskNotesPlugin;
}

describe("Issue #1052: public natural-language parser API", () => {
	it("exposes parseNaturalLanguage for in-vault scripts", () => {
		const api = new TaskNotesAPI(createPluginMock());

		expect(typeof api.parseNaturalLanguage).toBe("function");
	});

	it("parses task text using the plugin's TaskNotes NLP settings", () => {
		const api = new TaskNotesAPI(createPluginMock());

		const parsed = api.parseNaturalLanguage("Review notes #research @office +Writing 45m");

		expect(parsed.title).toBe("Review notes");
		expect(parsed.tags).toContain("research");
		expect(parsed.contexts).toContain("office");
		expect(parsed.projects).toContain("Writing");
		expect(parsed.estimate).toBe(45);
	});

	it("uses current settings on each API call", () => {
		const settings = {
			customStatuses: [],
			customPriorities: [],
			nlpDefaultToScheduled: true,
			nlpLanguage: "en",
			nlpTriggers: undefined,
			userFields: [],
			calendarViewSettings: {
				locale: "en-US",
			},
		};
		const api = new TaskNotesAPI(createPluginMock(settings));

		const monthFirst = api.parseNaturalLanguage("11/06/2026");

		expect(monthFirst.scheduledDate).toBe("2026-11-06");

		settings.calendarViewSettings.locale = "en-GB";

		const dayFirst = api.parseNaturalLanguage("11/06/2026");

		expect(dayFirst.scheduledDate).toBe("2026-06-11");
	});

	it("rejects non-string input at runtime for JavaScript callers", () => {
		const api = new TaskNotesAPI(createPluginMock());

		expect(() => api.parseNaturalLanguage(undefined as unknown as string)).toThrow(
			TaskNotesApiError
		);
		expect(() => api.parseNaturalLanguage(undefined as unknown as string)).toThrow(
			"TaskNotes API parseNaturalLanguage expects a string"
		);

		try {
			api.parseNaturalLanguage(undefined as unknown as string);
		} catch (error) {
			expect(error).toBeInstanceOf(TaskNotesApiError);
			expect((error as TaskNotesApiError).code).toBe("invalid_input");
		}
	});
});
