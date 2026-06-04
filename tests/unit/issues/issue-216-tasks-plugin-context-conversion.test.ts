import { TasksPluginParser } from "../../../src/utils/TasksPluginParser";

describe("Issue #216: Tasks plugin syntax compatibility", () => {
	it("preserves tags, contexts, due date, and done date from Tasks-style checkbox tasks", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] task #tag @context 📅 2024-06-07 ✅ 2025-05-09"
		);

		expect(result.isTaskLine).toBe(true);
		expect(result.error).toBeUndefined();
		expect(result.parsedData).toMatchObject({
			title: "task",
			tags: ["tag"],
			contexts: ["context"],
			dueDate: "2024-06-07",
			doneDate: "2025-05-09",
			status: "done",
			isCompleted: false,
		});
	});

	it("deduplicates nested contexts and removes them from the title", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] Prepare meeting @work/client @work/client @office #meeting"
		);

		expect(result.parsedData).toMatchObject({
			title: "Prepare meeting",
			tags: ["meeting"],
			contexts: ["work/client", "office"],
		});
	});

	it.each([
		["🔺", "highest"],
		["⏫", "high"],
		["🔼", "medium"],
		["🔽", "low"],
		["⏬", "lowest"],
	])("parses Tasks priority marker %s", (marker, priority) => {
		const result = TasksPluginParser.parseTaskLine(`- [ ] Prioritized task ${marker}`);

		expect(result.error).toBeUndefined();
		expect(result.parsedData).toMatchObject({
			title: "Prioritized task",
			priority,
		});
	});

	it("supports Tasks date aliases", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] Alias dates 🛫 2026-03-01 📆 2026-03-02 ⌛ 2026-03-03"
		);

		expect(result.error).toBeUndefined();
		expect(result.parsedData).toMatchObject({
			title: "Alias dates",
			startDate: "2026-03-01",
			dueDate: "2026-03-02",
			scheduledDate: "2026-03-03",
		});
	});

	it("converts Tasks recurrence text to TaskNotes RRULE strings", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] Water plants 🔁 every Sunday and Wednesday"
		);

		expect(result.error).toBeUndefined();
		expect(result.parsedData).toMatchObject({
			title: "Water plants",
			recurrence: "FREQ=WEEKLY;BYDAY=SU,WE",
			recurrenceData: {
				frequency: "weekly",
				days_of_week: ["SU", "WE"],
			},
		});
	});

	it("preserves Tasks 'when done' recurrence as a completion anchor", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] Review inbox 🔁 every day when done"
		);

		expect(result.error).toBeUndefined();
		expect(result.parsedData).toMatchObject({
			title: "Review inbox",
			recurrence: "FREQ=DAILY",
			recurrenceAnchor: "completion",
		});
	});

	it("parses Tasks Dataview task format fields", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] Do the Christmas shopping [due:: 2025-12-24] (priority:: highest) (repeat:: every week on Monday) (id:: dcf64c) (dependsOn:: abc123, xyz789) (summary:: Scrat wants an acorn) (size:: XL)"
		);

		expect(result.error).toBeUndefined();
		expect(result.parsedData).toMatchObject({
			title: "Do the Christmas shopping",
			dueDate: "2025-12-24",
			priority: "highest",
			recurrence: "FREQ=WEEKLY;BYDAY=MO",
			taskPluginId: "dcf64c",
			dependsOn: ["abc123", "xyz789"],
			details: "Scrat wants an acorn",
			customFrontmatter: {
				size: "XL",
			},
		});
	});

	it("removes trailing block links while preserving tags before parsed fields", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] Task #later 📅 2025-01-01 #work ^abc123"
		);

		expect(result.error).toBeUndefined();
		expect(result.parsedData).toMatchObject({
			title: "Task",
			dueDate: "2025-01-01",
			tags: ["later", "work"],
			blockLink: "^abc123",
		});
	});

	it("only consumes Tasks fields when they are ordered as trailing metadata", () => {
		const result = TasksPluginParser.parseTaskLine(
			"- [ ] Task mentions 📅 2025-01-01 in the title"
		);

		expect(result.error).toBeUndefined();
		expect(result.parsedData).toMatchObject({
			title: "Task mentions 📅 2025-01-01 in the title",
		});
		expect(result.parsedData?.dueDate).toBeUndefined();
	});
});
