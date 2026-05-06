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

	it("uses an existing note alias link as the canonical task note target", () => {
		const result = formatTaskTitle({
			rawLine:
				"- [ ] Live technical storytelling with diagrams #skill/interview [[10_journal/TaskNotes/Skills/Live technical storytelling with diagrams|note]] [duration:: 30m]",
			parsedTitle: "Live technical storytelling with diagrams duration",
			sourcePath: "10_journal/TaskForge/Skills.md",
		});

		expect(result.canonicalTitle).toBe("Live technical storytelling with diagrams");
		expect(result.filenameTitle).toBe("Live technical storytelling with diagrams");
		expect(result.noteFolder).toBe("10_journal/TaskNotes/Skills");
		expect(result.fullPath).toBe(
			"10_journal/TaskNotes/Skills/Live technical storytelling with diagrams.md"
		);
	});

	it("does not treat TaskForge inline fields as part of the canonical title", () => {
		const result = formatTaskTitle({
			rawLine:
				"- [ ] Monthly skill review #skill/workflow [duration:: 30m] [scheduled:: 2026-05-08]",
			parsedTitle: "Monthly skill review [duration:: 30m] [scheduled:: 2026-05-08]",
			sourcePath: "10_journal/TaskForge/skills.md",
		});

		expect(result.canonicalTitle).toBe("Monthly skill review");
		expect(result.filenameTitle).toBe("Monthly skill review");
		expect(result.noteFolder).toBe("10_journal/TaskNotes/skills");
		expect(result.fullPath).toBe("10_journal/TaskNotes/skills/Monthly skill review.md");
	});

	it("can create Title Case source folders and lowercase snake_case filenames", () => {
		const result = formatTaskTitle(
			{
				rawLine:
					"- [ ] Inventory possessions into keep, store, sell, donate, trash [duration:: 30m]",
				parsedTitle:
					"Inventory possessions into keep, store, sell, donate, trash [duration:: 30m]",
				sourcePath: "10_journal/TaskForge/minimalism.md",
			},
			{
				enabled: true,
				preset: "taskforge",
				maxLength: 200,
				filenameStyle: "lowercase-snake",
				sourceFolderStyle: "title-case",
				rules: [],
			}
		);

		expect(result.canonicalTitle).toBe("Inventory possessions into keep, store, sell, donate, trash");
		expect(result.filenameTitle).toBe("inventory_possessions_into_keep_store_sell_donate_trash");
		expect(result.noteFolder).toBe("10_journal/TaskNotes/Minimalism");
		expect(result.fullPath).toBe(
			"10_journal/TaskNotes/Minimalism/inventory_possessions_into_keep_store_sell_donate_trash.md"
		);
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
