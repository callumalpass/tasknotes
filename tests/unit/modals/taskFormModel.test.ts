import { TaskFormModel, type TaskFormValues } from "../../../src/modals/taskFormModel";

function createForm(overrides: Partial<TaskFormValues> = {}): TaskFormModel {
	return new TaskFormModel({
		title: "",
		details: "",
		dueDate: "",
		scheduledDate: "",
		priority: "normal",
		status: "open",
		contexts: "",
		projects: "",
		tags: "",
		timeEstimate: 0,
		recurrenceRule: "",
		recurrenceAnchor: "scheduled",
		reminders: [],
		userFields: {},
		...overrides,
	});
}

describe("TaskFormModel natural language layer", () => {
	it("restores a field once the text that set it is gone", () => {
		const form = createForm({ priority: "low", userFields: { effort: "s" } });

		form.applyNaturalLanguage({ priority: "high", userFields: { effort: "l" } });
		expect(form.values.priority).toBe("high");
		expect(form.values.userFields.effort).toBe("l");

		form.applyNaturalLanguage({ title: "Plan" });
		expect(form.values.priority).toBe("low");
		expect(form.values.userFields.effort).toBe("s");
	});

	it("never overrides a manual edit", () => {
		const form = createForm();

		form.applyNaturalLanguage({ dueDate: "2030-01-01" });
		form.edit("dueDate", "2030-02-02");
		form.applyNaturalLanguage({ dueDate: "2030-03-03" });
		form.applyNaturalLanguage({});

		expect(form.values.dueDate).toBe("2030-02-02");
	});

	it("gives a released field back to the natural language text", () => {
		const form = createForm();

		form.edit("title", "");
		form.applyNaturalLanguage({ title: "Ignored" });
		expect(form.values.title).toBe("");

		form.releaseField("title");
		form.applyNaturalLanguage({ title: "Used" });
		expect(form.values.title).toBe("Used");
	});

	it("reports dirty only when values differ from the clean state", () => {
		const form = createForm({ title: "Prefilled" });
		expect(form.isDirty()).toBe(false);

		form.edit("title", "Changed");
		expect(form.isDirty()).toBe(true);

		form.edit("title", "Prefilled");
		expect(form.isDirty()).toBe(false);
	});
});
