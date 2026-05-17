/**
 * Issue #1335: default task dates can include an opt-in time of day.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1335
 */

import { DEFAULT_TASK_CREATION_DEFAULTS } from "../../../src/settings/defaults";
import { TaskService } from "../../../src/services/TaskService";
import { calculateDefaultDateTime } from "../../../src/utils/helpers";
import { PluginFactory } from "../../helpers/mock-factories";

describe("Issue #1335: default scheduled and due times", () => {
	it("preserves date-only defaults when default times are none", () => {
		expect(DEFAULT_TASK_CREATION_DEFAULTS.defaultScheduledTime).toBe("none");
		expect(DEFAULT_TASK_CREATION_DEFAULTS.defaultDueTime).toBe("none");

		const value = calculateDefaultDateTime("today", "none");

		expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(value).not.toContain("T");
	});

	it("combines a default date preset with a valid default time", () => {
		const value = calculateDefaultDateTime("tomorrow", "09:30");

		expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T09:30$/);
	});

	it("applies configured scheduled and due times when creating a task", async () => {
		const plugin = PluginFactory.createMockPlugin();
		plugin.settings.taskCreationDefaults = {
			...DEFAULT_TASK_CREATION_DEFAULTS,
			defaultDueDate: "tomorrow",
			defaultDueTime: "17:30",
			defaultScheduledDate: "today",
			defaultScheduledTime: "09:00",
		};

		const taskService = new TaskService(plugin);
		const { taskInfo } = await taskService.createTask({
			title: "Timed defaults",
		});

		expect(taskInfo.scheduled).toMatch(/^\d{4}-\d{2}-\d{2}T09:00$/);
		expect(taskInfo.due).toMatch(/^\d{4}-\d{2}-\d{2}T17:30$/);
	});
});
