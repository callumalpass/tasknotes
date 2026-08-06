import { buildTaskCreationData } from "../../../src/modals/taskCreationData";

describe("Issue #2100: modal-created tag order", () => {
	it("keeps the identifying task tag before tags entered in the creation modal", () => {
		const taskData = buildTaskCreationData({
			title: "Grouped by tag",
			dueDate: "",
			scheduledDate: "",
			priority: "normal",
			status: "open",
			contexts: "",
			projects: "",
			tags: "extra-tag",
			timeEstimate: 0,
			recurrenceRule: "",
			recurrenceAnchor: "scheduled",
			reminders: [],
			blockedByItems: [],
			details: "",
			userFields: {},
			taskIdentificationMethod: "tag",
			taskTag: "task",
			normalizeDetails: (value) => value,
		});

		expect(taskData.tags).toEqual(["task", "extra-tag"]);
	});
});
