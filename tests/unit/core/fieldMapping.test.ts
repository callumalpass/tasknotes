import {
	mapTaskFromFrontmatter,
	mapTaskToFrontmatter,
	validateFieldMapping,
} from "../../../src/core/fieldMapping";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

describe("core/fieldMapping", () => {
	it("maps frontmatter into task fields without a FieldMapper instance", () => {
		const mapped = mapTaskFromFrontmatter(
			DEFAULT_FIELD_MAPPING,
			{
				title: "Mapped title",
				status: true,
				contexts: "work",
				projects: ["alpha"],
				recurrence_anchor: "completion",
				complete_instances: ["2026-03-01", 123, "2026-03-02"],
				tags: ["task", "archived"],
			},
			"Tasks/Mapped title.md",
			true
		);

		expect(mapped).toMatchObject({
			title: "Mapped title",
			status: "true",
			contexts: ["work"],
			projects: ["alpha"],
			recurrence_anchor: "completion",
			complete_instances: ["2026-03-01", "2026-03-02"],
			tags: ["task", "archived"],
			archived: true,
			path: "Tasks/Mapped title.md",
		});
	});

	it("maps task fields back to frontmatter with serialized dependency data", () => {
		const frontmatter = mapTaskToFrontmatter(
			DEFAULT_FIELD_MAPPING,
			{
				title: "Task",
				status: "open",
				blockedBy: [{ uid: "[[Other Task]]", reltype: "FINISHTOSTART" }],
				recurrence_anchor: "scheduled",
				tags: ["alpha"],
				archived: true,
			},
			"task"
		);

		expect(frontmatter.title).toBe("Task");
		expect(frontmatter.status).toBe("open");
		expect(frontmatter.recurrence_anchor).toBe("scheduled");
		expect(frontmatter.blockedBy).toEqual([{ uid: "[[Other Task]]", reltype: "FINISHTOSTART" }]);
		expect(frontmatter.tags).toEqual(expect.arrayContaining(["alpha", "task", "archived"]));
	});

	it("validates duplicate mapping values as invalid", () => {
		const duplicateMapping = {
			...DEFAULT_FIELD_MAPPING,
			status: "title",
		};

		const result = validateFieldMapping(duplicateMapping);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Field mappings must have unique property names");
	});
});
