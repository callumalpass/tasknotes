/**
 * Issue #1756: Custom fields are not delivered via HTTP API
 *
 * Users who define custom fields (via Settings → User Fields) store arbitrary
 * frontmatter properties in their task notes. Prior to this fix, those fields
 * were never extracted into the TaskInfo object, so they were absent from every
 * HTTP API response (GET /api/tasks, GET /api/tasks/:id, POST /api/tasks/query).
 *
 * Fix: mapTaskFromFrontmatter now accepts an optional UserMappedField[] argument.
 * Each user field whose frontmatter key is present in the raw YAML is written
 * directly onto the returned TaskInfo object under its own frontmatter key —
 * the same flat structure as core fields like `due` or `status`.
 * mapTaskToFrontmatter performs the reverse so writes round-trip correctly.
 * FieldMapper holds the user fields and threads them through both directions.
 *
 * Secondary fix: TaskCreationService was building completeTaskData from a
 * hardcoded list of core fields, silently dropping any user field values
 * present in the POST /api/tasks request body. User field values from
 * taskData are now copied into completeTaskData before mapToFrontmatter
 * is called, so POST /api/tasks correctly persists custom fields.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1756
 */

import { mapTaskFromFrontmatter, mapTaskToFrontmatter } from "../../../src/core/fieldMapping";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import type { UserMappedField } from "../../../src/types/settings";

const USER_FIELDS: UserMappedField[] = [
	{ id: "start", key: "start_date", type: "date", displayName: "Start Date" },
	{ id: "effort", key: "effort_level", type: "number", displayName: "Effort" },
	{ id: "assignee", key: "assigned_to", type: "text", displayName: "Assignee" },
	{ id: "flagged", key: "is_flagged", type: "boolean", displayName: "Flagged" },
	{ id: "labels", key: "custom_labels", type: "list", displayName: "Labels" },
];

describe("Issue #1756: Custom fields flow through the HTTP API", () => {
	describe("mapTaskFromFrontmatter — extracting user fields as top-level properties", () => {
		it("writes user field values directly onto the task object using their frontmatter key", () => {
			const result = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				{
					title: "Test task",
					status: "open",
					start_date: "2025-01-15",
					effort_level: 3,
				},
				"tasks/test.md",
				false,
				USER_FIELDS
			) as Record<string, any>;

			expect(result.start_date).toBe("2025-01-15");
			expect(result.effort_level).toBe(3);
		});

		it("only includes user fields that are actually present in frontmatter", () => {
			const result = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				{
					title: "Sparse task",
					status: "open",
					start_date: "2026-04-01",
				},
				"tasks/sparse.md",
				false,
				USER_FIELDS
			) as Record<string, any>;

			expect(result.start_date).toBe("2026-04-01");
			expect(result.effort_level).toBeUndefined();
			expect(result.assigned_to).toBeUndefined();
		});

		it("does not add user field keys when they are absent from frontmatter", () => {
			const result = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				{ title: "No custom fields", status: "open" },
				"tasks/no-custom.md",
				false,
				USER_FIELDS
			) as Record<string, any>;

			expect(result.start_date).toBeUndefined();
			expect(result.effort_level).toBeUndefined();
		});

		it("handles all supported field types correctly", () => {
			const result = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				{
					title: "All types",
					status: "open",
					start_date: "2025-06-01",
					effort_level: 5,
					assigned_to: "Alice",
					is_flagged: true,
					custom_labels: ["urgent", "review"],
				},
				"tasks/all-types.md",
				false,
				USER_FIELDS
			) as Record<string, any>;

			expect(result.start_date).toBe("2025-06-01");
			expect(result.effort_level).toBe(5);
			expect(result.assigned_to).toBe("Alice");
			expect(result.is_flagged).toBe(true);
			expect(result.custom_labels).toEqual(["urgent", "review"]);
		});

		it("is backward compatible: returns identical output when no user fields are configured", () => {
			const withoutUserFields = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				{ title: "Task", status: "open", due: "2025-03-01" },
				"tasks/compat.md"
			);

			const withEmptyUserFields = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				{ title: "Task", status: "open", due: "2025-03-01" },
				"tasks/compat.md",
				false,
				[]
			);

			expect(withoutUserFields).toEqual(withEmptyUserFields);
		});

		it("does not include undefined frontmatter values", () => {
			const result = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				{
					title: "Task",
					status: "open",
					start_date: undefined,
					effort_level: 2,
				},
				"tasks/undef.md",
				false,
				USER_FIELDS
			) as Record<string, any>;

			expect(result.effort_level).toBe(2);
			expect(result.start_date).toBeUndefined();
		});

		it("does not nest values under customProperties", () => {
			const result = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				{ title: "Task", status: "open", start_date: "2025-01-15" },
				"tasks/flat.md",
				false,
				USER_FIELDS
			);

			expect(result.customProperties).toBeUndefined();
		});
	});

	describe("mapTaskToFrontmatter — writing user fields back", () => {
		it("writes top-level user field properties to their frontmatter keys", () => {
			const frontmatter = mapTaskToFrontmatter(
				DEFAULT_FIELD_MAPPING,
				Object.assign(
					{ title: "Write test", status: "open" },
					{ start_date: "2025-01-15", effort_level: 3 }
				),
				"task",
				false,
				USER_FIELDS
			);

			expect(frontmatter.start_date).toBe("2025-01-15");
			expect(frontmatter.effort_level).toBe(3);
		});

		it("does not write keys for user fields absent from the task object", () => {
			const frontmatter = mapTaskToFrontmatter(
				DEFAULT_FIELD_MAPPING,
				Object.assign({ title: "Partial", status: "open" }, { start_date: "2025-02-01" }),
				"task",
				false,
				USER_FIELDS
			);

			expect(frontmatter.start_date).toBe("2025-02-01");
			expect(frontmatter).not.toHaveProperty("effort_level");
			expect(frontmatter).not.toHaveProperty("assigned_to");
		});

		it("round-trips: a value read via mapTaskFromFrontmatter is written back identically", () => {
			const originalFrontmatter = {
				title: "Round-trip task",
				status: "open",
				start_date: "2025-05-20",
				effort_level: 4,
				assigned_to: "Bob",
			};

			const taskInfo = mapTaskFromFrontmatter(
				DEFAULT_FIELD_MAPPING,
				originalFrontmatter,
				"tasks/rt.md",
				false,
				USER_FIELDS
			);

			const writtenFrontmatter = mapTaskToFrontmatter(
				DEFAULT_FIELD_MAPPING,
				taskInfo,
				"task",
				false,
				USER_FIELDS
			);

			expect(writtenFrontmatter.start_date).toBe("2025-05-20");
			expect(writtenFrontmatter.effort_level).toBe(4);
			expect(writtenFrontmatter.assigned_to).toBe("Bob");
		});

		it("is backward compatible: output is identical when no user fields are configured", () => {
			const taskData = { title: "Task", status: "open", due: "2025-03-01" };

			const withoutUserFields = mapTaskToFrontmatter(DEFAULT_FIELD_MAPPING, taskData, "task");
			const withEmptyUserFields = mapTaskToFrontmatter(DEFAULT_FIELD_MAPPING, taskData, "task", false, []);

			expect(withoutUserFields).toEqual(withEmptyUserFields);
		});
	});

	describe("FieldMapper — user field awareness", () => {
		it("extracts user field values as top-level properties", () => {
			const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING, USER_FIELDS);

			const result = mapper.mapFromFrontmatter(
				{ title: "Task", status: "open", start_date: "2025-03-10", effort_level: 2 },
				"tasks/mapper-test.md"
			) as Record<string, any>;

			expect(result.start_date).toBe("2025-03-10");
			expect(result.effort_level).toBe(2);
			expect(result.customProperties).toBeUndefined();
		});

		it("writes top-level user field properties back via mapToFrontmatter", () => {
			const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING, USER_FIELDS);

			const frontmatter = mapper.mapToFrontmatter(
				Object.assign({ title: "Task", status: "open" }, { start_date: "2025-03-10", effort_level: 2 })
			);

			expect(frontmatter.start_date).toBe("2025-03-10");
			expect(frontmatter.effort_level).toBe(2);
		});

		it("picks up new user fields after updateUserFields is called", () => {
			const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING, []);

			const before = mapper.mapFromFrontmatter(
				{ title: "Task", status: "open", start_date: "2025-01-01" },
				"tasks/update-test.md"
			) as Record<string, any>;
			expect(before.start_date).toBeUndefined();

			mapper.updateUserFields(USER_FIELDS);

			const after = mapper.mapFromFrontmatter(
				{ title: "Task", status: "open", start_date: "2025-01-01" },
				"tasks/update-test.md"
			) as Record<string, any>;
			expect(after.start_date).toBe("2025-01-01");
		});

		it("produces no user field properties after updateUserFields clears the list", () => {
			const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING, USER_FIELDS);
			mapper.updateUserFields([]);

			const result = mapper.mapFromFrontmatter(
				{ title: "Task", status: "open", start_date: "2025-01-01" },
				"tasks/cleared.md"
			) as Record<string, any>;

			expect(result.start_date).toBeUndefined();
		});

		it("does not affect core field extraction when user fields are present", () => {
			const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING, USER_FIELDS);

			const result = mapper.mapFromFrontmatter(
				{
					title: "Core fields intact",
					status: "open",
					priority: "high",
					due: "2025-06-01",
					start_date: "2025-05-01",
				},
				"tasks/core-intact.md"
			) as Record<string, any>;

			expect(result.title).toBe("Core fields intact");
			expect(result.status).toBe("open");
			expect(result.priority).toBe("high");
			expect(result.due).toBe("2025-06-01");
			expect(result.start_date).toBe("2025-05-01");
		});
	});
});
