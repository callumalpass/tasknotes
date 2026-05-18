import { DEFAULT_TASK_CREATION_DEFAULTS } from "../../../src/settings/defaults";
import {
	applyTaskCreationDefaults,
	type TaskCreationDefaultAdapters,
	type TaskCreationDefaultsContext,
} from "../../../src/services/task-service/taskCreationDefaults";
import type { Reminder, TaskCreationData } from "../../../src/types";
import type {
	DefaultReminder,
	TaskCreationDefaults,
	UserMappedField,
} from "../../../src/types/settings";

function createContext(
	overrides: Partial<TaskCreationDefaults>,
	userFields: UserMappedField[] = []
): TaskCreationDefaultsContext {
	return {
		taskCreationDefaults: {
			...DEFAULT_TASK_CREATION_DEFAULTS,
			...overrides,
		},
		userFields,
	};
}

describe("task creation defaults", () => {
	it("applies configured creation defaults through one typed boundary", () => {
		const defaultReminder: DefaultReminder = {
			id: "default-reminder",
			type: "relative",
			relatedTo: "due",
			offset: 1,
			unit: "hours",
			direction: "before",
		};
		const reminder: Reminder = {
			id: "reminder",
			type: "relative",
			relatedTo: "due",
			offset: "-PT1H",
		};
		const adapters: TaskCreationDefaultAdapters = {
			calculateDefaultDateTime: jest.fn((date, time) => `${date}:${time}`),
			convertDefaultRemindersToReminders: jest.fn(() => [reminder]),
		};

		const result = applyTaskCreationDefaults(
			{ title: "Draft release notes" },
			createContext({
				defaultDueDate: "tomorrow",
				defaultDueTime: "09:30",
				defaultScheduledDate: "today",
				defaultScheduledTime: "none",
				defaultContexts: "work, writing",
				defaultProjects: "[[Release]], docs",
				defaultTags: "task, release",
				defaultTimeEstimate: 45,
				defaultRecurrence: "weekly",
				defaultReminders: [defaultReminder],
			}),
			adapters
		);

		expect(result).toMatchObject({
			title: "Draft release notes",
			due: "tomorrow:09:30",
			scheduled: "today:none",
			contexts: ["work", "writing"],
			projects: ["[[Release]]", "docs"],
			tags: ["task", "release"],
			timeEstimate: 45,
			recurrence: "FREQ=WEEKLY",
			reminders: [reminder],
		});
		expect(adapters.convertDefaultRemindersToReminders).toHaveBeenCalledWith([
			defaultReminder,
		]);
	});

	it("does not replace explicit null dates with configured date defaults", () => {
		const calculateDefaultDateTime = jest.fn(() => "2026-05-19T09:00");
		const taskData = {
			title: "API clears dates",
			due: null,
			scheduled: null,
		} as unknown as TaskCreationData;

		const result = applyTaskCreationDefaults(
			taskData,
			createContext({
				defaultDueDate: "tomorrow",
				defaultDueTime: "09:00",
				defaultScheduledDate: "today",
				defaultScheduledTime: "10:00",
			}),
			{ calculateDefaultDateTime }
		);

		expect(result.due).toBeNull();
		expect(result.scheduled).toBeNull();
		expect(calculateDefaultDateTime).not.toHaveBeenCalled();
	});

	it("applies user field defaults without overwriting explicit custom frontmatter", () => {
		const input: TaskCreationData = {
			title: "Review defaults",
			customFrontmatter: {
				reviewed: true,
				topic: "manual",
			},
		};
		const userFields: UserMappedField[] = [
			{
				id: "reviewed",
				key: "reviewed",
				displayName: "Reviewed",
				type: "boolean",
			},
			{
				id: "topic",
				key: "topic",
				displayName: "Topic",
				type: "text",
				defaultValue: "default",
			},
			{
				id: "reviewOn",
				key: "review_on",
				displayName: "Review on",
				type: "date",
				defaultValue: "tomorrow",
			},
			{
				id: "needsReply",
				key: "needs_reply",
				displayName: "Needs reply",
				type: "boolean",
			},
		];

		const result = applyTaskCreationDefaults(input, createContext({}, userFields), {
			calculateDefaultDate: jest.fn(() => "2026-05-19"),
		});

		expect(result.customFrontmatter).toEqual({
			reviewed: true,
			topic: "manual",
			review_on: "2026-05-19",
			needs_reply: false,
		});
		expect(input.customFrontmatter).toEqual({
			reviewed: true,
			topic: "manual",
		});
	});
});
