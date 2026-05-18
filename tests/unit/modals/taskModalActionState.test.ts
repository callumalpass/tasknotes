import type TaskNotesPlugin from "../../../src/main";
import type { PriorityConfig, Reminder, StatusConfig } from "../../../src/types";
import type { TaskModalActionMenuState } from "../../../src/modals/taskModalActionMenus";
import {
	buildTaskModalActionIconState,
	createTaskModalActionMenuContext,
	createTaskModalActionMenuState,
	type TaskModalActionMenuContextOptions,
	type TaskModalActionStateInput,
} from "../../../src/modals/taskModalActionState";

function status(value: string, order: number, label = value): StatusConfig {
	return {
		id: value,
		value,
		label,
		color: "",
		order,
		isCompleted: false,
		autoArchive: false,
		autoArchiveDelay: 0,
	};
}

function priority(value: string, weight: number, label = value): PriorityConfig {
	return {
		id: value,
		value,
		label,
		color: "",
		weight,
	};
}

function createStateInput(
	overrides: Partial<TaskModalActionStateInput> = {}
): TaskModalActionStateInput {
	return {
		title: "Action state task",
		status: "open",
		priority: "normal",
		dueDate: "",
		scheduledDate: "",
		recurrenceRule: "",
		recurrenceAnchor: "scheduled",
		reminders: [],
		...overrides,
	};
}

function createHarness(overrides: Partial<TaskModalActionStateInput> = {}): {
	context: ReturnType<typeof createTaskModalActionMenuContext>;
	getState: () => TaskModalActionMenuState;
	onChange: jest.Mock;
} {
	let state = createTaskModalActionMenuState(createStateInput(overrides));
	const onChange = jest.fn();

	const context = createTaskModalActionMenuContext({
		app: {} as TaskModalActionMenuContextOptions["app"],
		plugin: { settings: {} } as TaskNotesPlugin,
		translate: (key, params) => `${key}:${params ? JSON.stringify(params) : ""}`,
		getState: () => state,
		setDueDate: (value) => {
			state = { ...state, dueDate: value };
		},
		setScheduledDate: (value) => {
			state = { ...state, scheduledDate: value };
		},
		setStatus: (value) => {
			state = { ...state, status: value };
		},
		setPriority: (value) => {
			state = { ...state, priority: value };
		},
		setRecurrenceRule: (value) => {
			state = { ...state, recurrenceRule: value };
		},
		setRecurrenceAnchor: (value) => {
			state = { ...state, recurrenceAnchor: value };
		},
		setReminders: (reminders) => {
			state = { ...state, reminders };
		},
		onChange,
	});

	return { context, getState: () => state, onChange };
}

describe("taskModalActionState", () => {
	it("builds menu state snapshots and defaults missing reminders to an empty list", () => {
		const state = createTaskModalActionMenuState(
			createStateInput({
				title: "Menu snapshot",
				status: "done",
				priority: "high",
				dueDate: "2026-05-21",
				scheduledDate: "2026-05-20T09:00",
				recurrenceRule: "FREQ=DAILY",
				recurrenceAnchor: "completion",
				reminders: undefined,
			})
		);

		expect(state).toEqual({
			title: "Menu snapshot",
			status: "done",
			priority: "high",
			dueDate: "2026-05-21",
			scheduledDate: "2026-05-20T09:00",
			recurrenceRule: "FREQ=DAILY",
			recurrenceAnchor: "completion",
			reminders: [],
		});
	});

	it("routes menu-context mutations back to the supplied modal setters", () => {
		const reminder: Reminder = { id: "r1", type: "absolute", date: "2026-05-19" };
		const { context, getState, onChange } = createHarness({
			recurrenceAnchor: "scheduled",
		});

		context.setDate("due", "2026-05-21");
		context.setDate("scheduled", "2026-05-20T09:00");
		context.setStatus("done");
		context.setPriority("high");
		context.setRecurrence("FREQ=DAILY");
		context.setReminders([reminder]);
		context.onChange();

		expect(getState()).toEqual(
			expect.objectContaining({
				dueDate: "2026-05-21",
				scheduledDate: "2026-05-20T09:00",
				status: "done",
				priority: "high",
				recurrenceRule: "FREQ=DAILY",
				recurrenceAnchor: "scheduled",
				reminders: [reminder],
			})
		);
		expect(onChange).toHaveBeenCalledTimes(1);

		context.setRecurrence("FREQ=WEEKLY", "completion");

		expect(getState()).toEqual(
			expect.objectContaining({
				recurrenceRule: "FREQ=WEEKLY",
				recurrenceAnchor: "completion",
			})
		);
	});

	it("builds icon state from menu state and configured defaults", () => {
		const statusConfigs = [status("done", 10, "Done"), status("open", 0, "Open")];
		const priorityConfigs = [
			priority("high", 10, "High"),
			priority("normal", 0, "Normal"),
		];
		const reminder: Reminder = { id: "r1", type: "relative", relatedTo: "due", offset: "PT15M" };

		const iconState = buildTaskModalActionIconState(
			createTaskModalActionMenuState(
				createStateInput({
					status: "done",
					priority: "high",
					dueDate: "2026-05-21",
					scheduledDate: "2026-05-20",
					recurrenceRule: "FREQ=WEEKLY;BYDAY=TU",
					reminders: [reminder],
				})
			),
			{ statusConfigs, priorityConfigs }
		);

		expect(iconState).toEqual({
			dueDate: "2026-05-21",
			scheduledDate: "2026-05-20",
			status: "done",
			priority: "high",
			recurrenceRule: "FREQ=WEEKLY;BYDAY=TU",
			recurrenceDisplayText: "Weekly on Tuesday",
			reminderCount: 1,
			defaultStatus: "open",
			defaultPriority: "normal",
			statusConfigs,
			priorityConfigs,
		});
	});

	it("uses fallback icon defaults when no status or priority configs are available", () => {
		const iconState = buildTaskModalActionIconState(
			createTaskModalActionMenuState(createStateInput()),
			{}
		);

		expect(iconState.defaultStatus).toBe("open");
		expect(iconState.defaultPriority).toBe("normal");
		expect(iconState.statusConfigs).toEqual([]);
		expect(iconState.priorityConfigs).toEqual([]);
	});
});
