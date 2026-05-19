import {
	applyTaskPropertyFrontmatterChange,
	buildTaskPropertyUpdatePlan,
	normalizeBlockedByValue,
	updateCompletedDateFrontmatter,
} from "../../../src/services/task-service/taskPropertyUpdate";
import type { TaskInfo } from "../../../src/types";

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "TaskNotes/Task.md",
		archived: false,
		...overrides,
	} as TaskInfo;
}

describe("taskPropertyUpdate", () => {
	it("builds an updated non-recurring task and completion date for completed statuses", () => {
		const plan = buildTaskPropertyUpdatePlan({
			freshTask: createTask({ status: "open" }),
			property: "status",
			value: true,
			currentTimestamp: "2026-05-19T06:40:00+10:00",
			currentDateString: "2026-05-19",
			normalizeStatusValue: (value) => (value === true ? "done" : String(value)),
			isCompletedStatus: (status) => status === "done",
		});

		expect(plan.normalizedValue).toBe("done");
		expect(plan.dateModified).toBe("2026-05-19T06:40:00+10:00");
		expect(plan.updatedTask).toEqual(
			expect.objectContaining({
				status: "done",
				completedDate: "2026-05-19",
				dateModified: "2026-05-19T06:40:00+10:00",
			})
		);
	});

	it("does not derive completedDate for recurring status updates", () => {
		const plan = buildTaskPropertyUpdatePlan({
			freshTask: createTask({ recurrence: "FREQ=DAILY" }),
			property: "status",
			value: "done",
			currentTimestamp: "2026-05-19T06:40:00+10:00",
			currentDateString: "2026-05-19",
			normalizeStatusValue: String,
			isCompletedStatus: (status) => status === "done",
		});

		expect(plan.updatedTask.status).toBe("done");
		expect(plan.updatedTask.completedDate).toBeUndefined();
	});

	it("serializes blockedBy values as dependency wikilinks in frontmatter", () => {
		const frontmatter: Record<string, unknown> = {};

		applyTaskPropertyFrontmatterChange({
			frontmatter,
			property: "blockedBy",
			fieldName: "blockedBy",
			rawValue: [{ uid: "Project/Existing Task.md", reltype: "FINISHTOSTART" }],
			normalizedValue: normalizeBlockedByValue([
				{ uid: "Project/Existing Task.md", reltype: "FINISHTOSTART" },
			]),
			dateModified: "2026-05-19T06:40:00+10:00",
			dateModifiedField: "dateModified",
			completedDateField: "completedDate",
			isRecurring: false,
			normalizeStatusValue: String,
			isCompletedStatus: () => false,
			currentDateString: "2026-05-19",
		});

		expect(frontmatter.blockedBy).toEqual([
			{ uid: "[[Project/Existing Task.md]]", reltype: "FINISHTOSTART" },
		]);
		expect(frontmatter.dateModified).toBe("2026-05-19T06:40:00+10:00");
	});

	it("removes empty dates and empty dependency lists from frontmatter", () => {
		const frontmatter: Record<string, unknown> = {
			due: "2026-05-20",
			blockedBy: [{ uid: "[[Old]]", reltype: "FINISHTOSTART" }],
		};

		applyTaskPropertyFrontmatterChange({
			frontmatter,
			property: "due",
			fieldName: "due",
			rawValue: undefined,
			normalizedValue: undefined,
			dateModified: "2026-05-19T06:40:00+10:00",
			dateModifiedField: "dateModified",
			completedDateField: "completedDate",
			isRecurring: false,
			normalizeStatusValue: String,
			isCompletedStatus: () => false,
			currentDateString: "2026-05-19",
		});

		applyTaskPropertyFrontmatterChange({
			frontmatter,
			property: "blockedBy",
			fieldName: "blockedBy",
			rawValue: undefined,
			normalizedValue: undefined,
			dateModified: "2026-05-19T06:41:00+10:00",
			dateModifiedField: "dateModified",
			completedDateField: "completedDate",
			isRecurring: false,
			normalizeStatusValue: String,
			isCompletedStatus: () => false,
			currentDateString: "2026-05-19",
		});

		expect(frontmatter).not.toHaveProperty("due");
		expect(frontmatter).not.toHaveProperty("blockedBy");
		expect(frontmatter.dateModified).toBe("2026-05-19T06:41:00+10:00");
	});

	it("coerces boolean-like statuses and updates completedDate frontmatter", () => {
		const frontmatter: Record<string, unknown> = {};

		applyTaskPropertyFrontmatterChange({
			frontmatter,
			property: "status",
			fieldName: "status",
			rawValue: true,
			normalizedValue: "true",
			dateModified: "2026-05-19T06:40:00+10:00",
			dateModifiedField: "dateModified",
			completedDateField: "completedDate",
			isRecurring: false,
			normalizeStatusValue: String,
			isCompletedStatus: (status) => status === "true",
			currentDateString: "2026-05-19",
		});

		expect(frontmatter.status).toBe(true);
		expect(frontmatter.completedDate).toBe("2026-05-19");
		expect(frontmatter.dateModified).toBe("2026-05-19T06:40:00+10:00");
	});

	it("refuses to write invalid frontmatter field names", () => {
		const frontmatter: Record<string, unknown> = {};

		expect(() =>
			applyTaskPropertyFrontmatterChange({
				frontmatter,
				property: "priority",
				fieldName: "",
				rawValue: "high",
				normalizedValue: "high",
				dateModified: "2026-05-19T06:40:00+10:00",
				dateModifiedField: "dateModified",
				completedDateField: "completedDate",
				isRecurring: false,
				normalizeStatusValue: String,
				isCompletedStatus: () => false,
				currentDateString: "2026-05-19",
			})
		).toThrow(/invalid frontmatter field name/);

		expect(frontmatter).toEqual({});
	});

	it("removes completedDate when status becomes incomplete", () => {
		const frontmatter: Record<string, unknown> = {
			completedDate: "2026-05-18",
		};

		updateCompletedDateFrontmatter(
			frontmatter,
			"open",
			false,
			"completedDate",
			(status) => status === "done",
			"2026-05-19"
		);

		expect(frontmatter).not.toHaveProperty("completedDate");
	});
});
