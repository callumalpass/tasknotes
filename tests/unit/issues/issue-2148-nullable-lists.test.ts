import { parse } from "yaml";
import { FieldMapper } from "../../../src/core/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { buildTaskEditFormState } from "../../../src/modals/taskEditFormState";
import {
	buildTaskEditChanges,
	type TaskEditChangeInput,
} from "../../../src/modals/taskEditChanges";
import { applyTaskUpdateFrontmatterChange } from "../../../src/services/task-service/taskUpdatePlanning";
import { getFrontmatterTags } from "../../../src/utils/taskIdentificationFrontmatter";
import { parseNullableListUserFieldInput } from "../../../src/modals/taskModalUserFields";
import type { TaskInfo } from "../../../src/types";
import type { UserMappedField } from "../../../src/types/settings";

const userFields: UserMappedField[] = [
	{ key: "custom_list", displayName: "Custom list", type: "list" },
];
const mapper = new FieldMapper({ ...DEFAULT_FIELD_MAPPING, status: "task_status" }, userFields);
const path = "Tasks/review.md";

function taskFrom(frontmatter: Record<string, unknown>): TaskInfo {
	return {
		title: "Review",
		status: "open",
		priority: "normal",
		archived: false,
		path,
		...mapper.mapFromFrontmatter(frontmatter, path),
	};
}

function editInput(frontmatter: Record<string, unknown>): TaskEditChangeInput {
	const task = taskFrom(frontmatter);
	const state = buildTaskEditFormState({
		task,
		details: "Body",
		frontmatter,
		settings: { userFields },
		normalizeDetails: (value) => value,
	});
	return {
		...state,
		task,
		projects: state.projectValues.join(", "),
		blockedByItems: (task.blockedBy || []).map((dependency) => ({ dependency })),
		initialBlockedBy: task.blockedBy || [],
		blockingItems: [],
		initialBlockingPaths: [],
		completedInstancesChanges: [],
		skippedInstancesChanges: [],
		frontmatter,
		userFieldConfigs: userFields,
		taskIdentificationMethod: "property",
		taskTag: "task",
		maintainDueDateOffsetInRecurring: false,
		normalizeDetails: (value) => value,
	};
}

function apply(frontmatter: Record<string, unknown>, changes: Partial<TaskInfo>): void {
	applyTaskUpdateFrontmatterChange({
		frontmatter,
		originalTask: taskFrom(frontmatter),
		updates: changes,
		recurrenceUpdates: {},
		dateModified: "2026-10-20T00:00:00Z",
		fieldMapper: mapper,
		taskIdentification: {
			method: "property",
			tag: "task",
			propertyName: "tasknote",
			propertyValue: "true",
		},
		storeTitleInFilename: false,
		updateCompletedDateInFrontmatter: () => {},
	});
}

describe("#2148 nullable lists through the installed model and edit/save adapters", () => {
	it("does not invent entries from the reporter's YAML or serialize them on save", () => {
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
		const task = taskFrom(frontmatter);
		expect(task.contexts).toEqual([]);
		expect(task.projects).toEqual([]);
		expect(task.tags).toEqual(["task"]);
		const input = editInput(frontmatter);
		expect(input.contexts).toBe("");
		expect(input.projects).toBe("");
		expect(buildTaskEditChanges(input).changes).toEqual({});
		expect(JSON.stringify(mapper.mapToFrontmatter(task))).not.toContain('"null"');
	});

	it.each([null, "", "   ", [], [null, undefined, "", "\t", {}]])(
		"normalizes blank string-list slots, without mutating frontmatter (%j)",
		(value) => {
			const frontmatter = {
				contexts: value,
				projects: value,
				[DEFAULT_FIELD_MAPPING.icsEventId]: value,
				[DEFAULT_FIELD_MAPPING.googleCalendarMovedOriginalDates]: value,
			};
			const before = JSON.stringify(frontmatter);
			const task = taskFrom(frontmatter);
			for (const field of [
				"contexts",
				"projects",
				"icsEventId",
				"googleCalendarMovedOriginalDates",
			] as const) {
				expect(task[field]).toEqual([]);
			}
			expect(JSON.stringify(frontmatter)).toBe(before);
		}
	);

	it("retains real values, explicit null strings, links, numbers and booleans", () => {
		const values = ["null", "undefined", "Deep Work 🧠", "[[Project]]", 0, false, 42];
		const task = taskFrom({ contexts: [null, "", " ", {}, ...values], projects: values });
		expect(task.contexts).toEqual(values.map(String));
		expect(task.projects).toEqual(values.map(String));
	});

	it("normalizes nullable tags without changing deduplication or archive detection", () => {
		const tags = [null, undefined, {}, "", " ", "#task", "task", 0, false, "null", "#archived"];
		const expected = ["task", "0", "false", "null", "archived"];
		expect(taskFrom({ tags }).tags).toEqual(expected);
		expect(taskFrom({ tags }).archived).toBe(true);
		expect(getFrontmatterTags(tags)).toEqual(expected);
		expect(mapper.mapToFrontmatter({ tags } as unknown as Partial<TaskInfo>).tags).toEqual(
			expected
		);
	});

	it("uses configured property names, leaving custom list values untouched", () => {
		const renamed = new FieldMapper(
			{ ...DEFAULT_FIELD_MAPPING, contexts: "my_contexts", projects: "my_projects" },
			userFields
		);
		const task = renamed.mapFromFrontmatter(
			{ my_contexts: null, my_projects: [null, "[[Project]]"], custom_list: [null, "null"] },
			path
		);
		expect(task.contexts).toEqual([]);
		expect(task.projects).toEqual(["[[Project]]"]);
		expect(task.customProperties?.custom_list).toEqual([null, "null"]);
	});

	it.each([
		{},
		{ contexts: null, projects: null, tags: null, blockedBy: null, custom_list: null },
		{ contexts: [], projects: [], tags: [], blockedBy: [], custom_list: [] },
	])("preserves missing, null and empty properties on an unrelated edit (%j)", (properties) => {
		const frontmatter = { title: "Review", tasknote: true, ...properties };
		const before = { ...frontmatter };
		const input = editInput(frontmatter);
		expect(buildTaskEditChanges(input).changes).toEqual({});
		apply(frontmatter, { title: "Renamed" });
		for (const field of ["contexts", "projects", "tags", "blockedBy", "custom_list"]) {
			expect(Object.hasOwn(frontmatter, field)).toBe(Object.hasOwn(before, field));
			expect(frontmatter[field as keyof typeof frontmatter]).toEqual(
				before[field as keyof typeof before]
			);
		}
	});

	it("keeps missing mapped properties absent and preserves explicit custom null versus []", () => {
		const mapped = mapper.mapFromFrontmatter({}, path);
		for (const field of ["contexts", "projects", "tags", "blockedBy", "custom_list"])
			expect(mapped).not.toHaveProperty(field);
		for (const value of [null, []]) {
			const task = mapper.mapFromFrontmatter({ custom_list: value }, path);
			expect(task.customProperties?.custom_list).toEqual(value);
			expect(mapper.mapToFrontmatter(task).custom_list).toEqual(value);
		}
	});

	it("clears the last item without persisting fake null entries", () => {
		const frontmatter: Record<string, unknown> = {
			title: "Review",
			tasknote: true,
			contexts: ["work"],
			projects: ["[[Project]]"],
			tags: ["last-tag"],
			blockedBy: [{ uid: "[[Other Task]]", reltype: "FINISHTOSTART" }],
			custom_list: ["last-item"],
		};
		const input = editInput(frontmatter);
		const { changes } = buildTaskEditChanges({
			...input,
			contexts: "",
			projects: "",
			tags: "",
			blockedByItems: [],
			userFields: { custom_list: [] },
		});
		apply(frontmatter, changes);
		for (const field of ["contexts", "projects", "tags", "blockedBy"])
			expect(frontmatter).not.toHaveProperty(field);
		expect(frontmatter.custom_list).toEqual([]);
		expect(buildTaskEditChanges(editInput(frontmatter)).changes).toEqual({});
	});

	it("retains the legacy custom-list control's explicit null removal signal", () => {
		const frontmatter: Record<string, unknown> = { custom_list: ["last-item"] };
		const input = editInput(frontmatter);
		const { changes } = buildTaskEditChanges({
			...input,
			userFields: { custom_list: parseNullableListUserFieldInput("") },
		});
		apply(frontmatter, changes);
		expect(frontmatter).not.toHaveProperty("custom_list");
	});
});
