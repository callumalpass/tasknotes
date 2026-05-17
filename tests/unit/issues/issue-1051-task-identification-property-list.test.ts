import { applyPropertyTaskIdentifier } from "../../../src/utils/taskIdentificationFrontmatter";

describe("Issue #1051: property task identifiers preserve list values", () => {
	it("keeps additional values on a list-valued task identification property", () => {
		const frontmatter: Record<string, unknown> = {
			class: ["task", "habit", "chore"],
		};

		applyPropertyTaskIdentifier(frontmatter, "class", "task");

		expect(frontmatter.class).toEqual(["task", "habit", "chore"]);
	});

	it("adds the task identifier to a list-valued property without removing existing values", () => {
		const frontmatter: Record<string, unknown> = {
			class: ["habit", "chore"],
		};

		applyPropertyTaskIdentifier(frontmatter, "class", "task");

		expect(frontmatter.class).toEqual(["habit", "chore", "task"]);
	});

	it("preserves a scalar value by converting it to a list with the identifier", () => {
		const frontmatter: Record<string, unknown> = {
			class: "habit",
		};

		applyPropertyTaskIdentifier(frontmatter, "class", "task");

		expect(frontmatter.class).toEqual(["habit", "task"]);
	});

	it("keeps boolean task identifiers idempotent", () => {
		const frontmatter: Record<string, unknown> = {
			isTask: [true, "habit"],
		};

		applyPropertyTaskIdentifier(frontmatter, "isTask", "true");

		expect(frontmatter.isTask).toEqual([true, "habit"]);
	});
});
