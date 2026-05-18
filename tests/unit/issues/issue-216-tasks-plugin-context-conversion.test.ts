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
});
