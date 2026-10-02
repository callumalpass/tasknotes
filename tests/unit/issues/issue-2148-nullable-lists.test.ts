import { parse } from "yaml";
import { FieldMapper } from "../../../src/core/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { buildTaskEditFormState } from "../../../src/modals/taskEditFormState";
import type { TaskInfo } from "../../../src/types";

describe("review #2148 through the installed model and plugin edit-form adapter", () => {
	const mapper = new FieldMapper({ ...DEFAULT_FIELD_MAPPING, status: "task_status" });
	const frontmatter = parse(`title: review Paul's trainings
priority: P
projects:
category: tasks
tags:
  - task
contexts:
task_status: 10-open
tasknote: true
`) as Record<string, unknown>;

	it("does not invent null list entries from the reported YAML", () => {
		const task = mapper.mapFromFrontmatter(frontmatter, "Tasks/review.md");
		expect(task.contexts).toEqual([]);
		expect(task.projects).toEqual([]);
		expect(task.tags).toEqual(["task"]);
	});

	it("opens the edit form without a fake project/context", () => {
		const task = {
			title: "", status: "", priority: "", archived: false,
			...mapper.mapFromFrontmatter(frontmatter, "Tasks/review.md"),
		} as TaskInfo;
		const state = buildTaskEditFormState({ task, details: "", frontmatter, settings: {}, normalizeDetails: (value) => value });
		expect(state.contexts).toBe("");
		expect(state.projectValues).toEqual([]);
		expect(state.hasValidProjects).toBe(false);
	});

	it("does not serialize an invented null string after mapping the reported YAML", () => {
		const task = mapper.mapFromFrontmatter(frontmatter, "Tasks/review.md");
		const saved = mapper.mapToFrontmatter(task);
		expect(JSON.stringify(saved)).not.toContain('"null"');
	});

	it("drops blank list slots but preserves real values and explicit null strings", () => {
		const task = mapper.mapFromFrontmatter({ contexts: [null, "", " ", "work", "null"], projects: [null, "[[Project]]"], tags: [null, "task"] }, "Tasks/mixed.md");
		expect(task.contexts).toEqual(["work", "null"]);
		expect(task.projects).toEqual(["[[Project]]"]);
		expect(task.tags).toEqual(["task"]);
	});
});
