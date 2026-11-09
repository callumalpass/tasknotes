import { observeTranslation as mockObserveTranslation } from "../../helpers/real-i18n";
const mockOpenChoices = jest.fn();

const mockRecurrenceShow = jest.fn();
let mockRecurrenceOptions: any;
const mockRecurrenceContextMenu = jest.fn().mockImplementation((options) => {
	mockRecurrenceOptions = options;
	return { show: mockRecurrenceShow };
});

const mockReminderShow = jest.fn();
let mockReminderArgs: any[];
const mockReminderContextMenu = jest.fn().mockImplementation((...args) => {
	mockReminderArgs = args;
	return { show: mockReminderShow };
});

jest.mock("../../../src/ui/taskPropertyPickers", () => ({
	openTaskPropertyChoices: mockOpenChoices,
}));

jest.mock("../../../src/components/RecurrenceContextMenu", () => ({
	RecurrenceContextMenu: mockRecurrenceContextMenu,
}));

jest.mock("../../../src/components/ReminderContextMenu", () => ({
	ReminderContextMenu: mockReminderContextMenu,
}));

import type { Reminder, TaskInfo } from "../../../src/types";
import {
	createTaskModalReminderDraft,
	showTaskModalPropertyPicker,
	showTaskModalRecurrenceContextMenu,
	showTaskModalReminderContextMenu,
	type TaskModalActionMenuContext,
	type TaskModalActionMenuState,
} from "../../../src/modals/taskModalActionMenus";

function createHarness(overrides: Partial<TaskModalActionMenuState> = {}): {
	context: TaskModalActionMenuContext;
	getState: () => TaskModalActionMenuState;
	onChange: jest.Mock;
	plugin: any;
} {
	let state: TaskModalActionMenuState = {
		title: "Menu task",
		status: "open",
		priority: "normal",
		dueDate: "",
		scheduledDate: "",
		recurrenceRule: "",
		recurrenceAnchor: "scheduled",
		reminders: [],
		...overrides,
	};
	const onChange = jest.fn();
	const plugin = { settings: {} };
	const context: TaskModalActionMenuContext = {
		app: {} as TaskModalActionMenuContext["app"],
		plugin,
		translate: mockObserveTranslation(),
		getState: () => state,
		setDate: (type, value) => {
			state = {
				...state,
				[type === "due" ? "dueDate" : "scheduledDate"]: value,
			};
		},
		setStatus: (value) => {
			state = { ...state, status: value };
		},
		setPriority: (value) => {
			state = { ...state, priority: value };
		},
		setRecurrence: (value, anchor) => {
			state = {
				...state,
				recurrenceRule: value,
				recurrenceAnchor: anchor ?? state.recurrenceAnchor,
			};
		},
		setReminders: (reminders) => {
			state = { ...state, reminders };
		},
		onChange,
	};

	return { context, getState: () => state, onChange, plugin };
}

describe("taskModalActionMenus", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRecurrenceOptions = undefined;
		mockReminderArgs = [];
	});

	it.each(["due", "scheduled"] as const)("applies timed %s choices and clear to the draft", (property) => {
		const { context, getState, onChange, plugin } = createHarness({
			dueDate: "2026-05-20T09:30", scheduledDate: "2026-05-20T09:30",
		});
		const anchor = document.createElement("button");
		showTaskModalPropertyPicker(context, property, anchor);
		expect(mockOpenChoices).toHaveBeenCalledWith(plugin, property,
			[expect.objectContaining({ [property]: "2026-05-20T09:30" })], anchor, expect.any(Function));
		const apply = mockOpenChoices.mock.calls[0][4];
		apply("2026-05-21T10:15");
		const field = property === "due" ? "dueDate" : "scheduledDate";
		expect(getState()[field]).toBe("2026-05-21T10:15");
		apply((draft: TaskInfo) => draft[property] + ":00");
		expect(getState()[field]).toBe("2026-05-21T10:15:00");
		apply(undefined);
		expect(getState()[field]).toBe("");
		expect(onChange).toHaveBeenCalledTimes(3);
	});

	it.each(["status", "priority"] as const)("applies arbitrary %s picker values to the draft", (property) => {
		const { context, getState, onChange } = createHarness();
		showTaskModalPropertyPicker(context, property, document.createElement("button"));
		mockOpenChoices.mock.calls[0][4]("custom-long-workflow-value");
		expect(getState()[property]).toBe("custom-long-workflow-value");
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("updates recurrence values and preserves the anchor when no new anchor is supplied", () => {
		const event = new MouseEvent("click");
		const { context, getState, onChange, plugin } = createHarness({
			recurrenceRule: "FREQ=DAILY",
			recurrenceAnchor: "scheduled",
			scheduledDate: "2026-05-19",
		});

		showTaskModalRecurrenceContextMenu(context, event);

		expect(mockRecurrenceContextMenu).toHaveBeenCalledWith({
			currentValue: "FREQ=DAILY",
			currentAnchor: "scheduled",
			scheduledDate: "2026-05-19",
			onSelect: expect.any(Function),
			app: context.app,
			plugin,
		});
		expect(mockRecurrenceShow).toHaveBeenCalledWith(event);

		mockRecurrenceOptions.onSelect(null);
		expect(getState()).toEqual(
			expect.objectContaining({ recurrenceRule: "", recurrenceAnchor: "scheduled" })
		);

		mockRecurrenceOptions.onSelect("FREQ=WEEKLY", "completion");
		expect(getState()).toEqual(
			expect.objectContaining({ recurrenceRule: "FREQ=WEEKLY", recurrenceAnchor: "completion" })
		);
		expect(onChange).toHaveBeenCalledTimes(2);
	});

	it("builds reminder menu draft tasks from modal state and keeps edit task identity", () => {
		const trigger = document.createElement("button");
		const event = new MouseEvent("click");
		Object.defineProperty(event, "target", { value: trigger });
		const reminder: Reminder = { id: "r1", type: "absolute", date: "2026-05-19" };
		const { context, getState, onChange, plugin } = createHarness({
			title: "Updated title",
			status: "done",
			priority: "high",
			dueDate: "2026-05-20",
			scheduledDate: "2026-05-19",
			reminders: [reminder],
		});
		const taskBase = {
			title: "Old title",
			status: "open",
			priority: "normal",
			path: "TaskNotes/existing.md",
			archived: true,
			reminders: [],
		} as TaskInfo;

		showTaskModalReminderContextMenu(context, event, taskBase);

		expect(mockReminderContextMenu).toHaveBeenCalledTimes(1);
		expect(mockReminderArgs[0]).toBe(plugin);
		expect(mockReminderArgs[1]).toEqual({
			...taskBase,
			title: "Updated title",
			status: "done",
			priority: "high",
			due: "2026-05-20",
			scheduled: "2026-05-19",
			reminders: [reminder],
		});
		expect(mockReminderArgs[2]).toBe(trigger);
		expect(mockReminderShow).toHaveBeenCalledWith(event);

		const updatedReminder: Reminder = { id: "r2", type: "relative", offset: "-PT5M" };
		mockReminderArgs[3]({ ...taskBase, reminders: [updatedReminder] });

		expect(getState().reminders).toEqual([updatedReminder]);
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("creates new-task reminder drafts without a persisted path", () => {
		const reminder: Reminder = { id: "r1", type: "absolute", date: "2026-05-19" };

		expect(
			createTaskModalReminderDraft({
				title: "New task",
				status: "open",
				priority: "normal",
				dueDate: "",
				scheduledDate: "2026-05-19",
				recurrenceRule: "",
				recurrenceAnchor: "scheduled",
				reminders: [reminder],
			})
		).toEqual({
			title: "New task",
			status: "open",
			priority: "normal",
			due: "",
			scheduled: "2026-05-19",
			path: "",
			archived: false,
			reminders: [reminder],
		});
	});

});
