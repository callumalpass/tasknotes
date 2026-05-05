import { formatTaskTitle } from "../../../src/utils/taskTitleFormatter";

describe("taskTitleFormatter", () => {
	it("normalizes noisy TaskForge lines into canonical task titles", () => {
		const result = formatTaskTitle({
			rawLine:
				"- [ ] 🔺 Eb2 visa (self-petition) ⏰ 8:30AM 🎯 8:00AM #apple-priority-inbox %%[apple_reminder_id:: ABC]%% [scheduled:: 2026-05-06]",
			parsedTitle:
				"🔺 Eb2 visa (self-petition) ⏰ 8:30AM 🎯 8:00AM #apple-priority-inbox %%[apple_reminder_id:: ABC]%% [scheduled:: 2026-05-06]",
			sourcePath: "Projects/TaskForge/legal.md",
		});

		expect(result.canonicalTitle).toBe("Eb2 visa (self-petition)");
		expect(result.handles.taskForgeList).toBe("legal");
		expect(result.noteFolder).toBe("Projects/TaskNotes/legal");
		expect(result.fullPath).toBe("Projects/TaskNotes/legal/Eb2 visa (self-petition).md");
	});

	it("allows custom regex rules to populate handles", () => {
		const result = formatTaskTitle(
			{
				rawLine: "- [ ] Legal: File EB2 petition #visa",
				parsedTitle: "Legal: File EB2 petition #visa",
				sourcePath: "Projects/TaskForge/inbox.md",
			},
			{
				enabled: true,
				preset: "taskforge",
				maxLength: 200,
				rules: [
					{
						handle: "canonicalTitle",
						op: "match",
						pattern: "^(?<area>[^:]+):\\s*(?<clean>.+)$",
					},
					{ handle: "canonicalTitle", op: "from", value: "{{clean}}" },
					{ handle: "noteFolder", op: "from", value: "Projects/TaskNotes/{{area}}" },
				],
			}
		);

		expect(result.canonicalTitle).toBe("File EB2 petition");
		expect(result.handles.area).toBe("Legal");
		expect(result.noteFolder).toBe("Projects/TaskNotes/Legal");
	});

	it("can build filename and full path from handle templates", () => {
		const result = formatTaskTitle(
			{
				rawLine: "- [ ] Write A/B test: variant #growth",
				parsedTitle: "Write A/B test: variant #growth",
				sourcePath: "Projects/TaskForge/growth.md",
			},
			{
				enabled: true,
				preset: "taskforge",
				maxLength: 200,
				rules: [
					{ handle: "filenameTitle", op: "from", value: "{{canonicalTitle | sanitizeFilename}}" },
					{ handle: "fullPath", op: "from", value: "{{noteFolder}}/{{filenameTitle}}.md" },
				],
			}
		);

		expect(result.filenameTitle).toBe("Write AB test variant");
		expect(result.fullPath).toBe("Projects/TaskNotes/growth/Write AB test variant.md");
	});
});
