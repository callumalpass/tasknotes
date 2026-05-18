const mockDatePickerOpen = jest.fn();
let mockDatePickerOptions: any;
const mockDateTimePickerModal = jest.fn().mockImplementation((_app, options) => {
	mockDatePickerOptions = options;
	return { open: mockDatePickerOpen };
});

const mockStatusShow = jest.fn();
let mockStatusOptions: any;
const mockStatusContextMenu = jest.fn().mockImplementation((options) => {
	mockStatusOptions = options;
	return { show: mockStatusShow };
});

const mockPriorityShow = jest.fn();
let mockPriorityOptions: any;
const mockPriorityContextMenu = jest.fn().mockImplementation((options) => {
	mockPriorityOptions = options;
	return { show: mockPriorityShow };
});

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

jest.mock("../../../src/modals/DateTimePickerModal", () => ({
	DateTimePickerModal: mockDateTimePickerModal,
}));

jest.mock("../../../src/components/StatusContextMenu", () => ({
	StatusContextMenu: mockStatusContextMenu,
}));

jest.mock("../../../src/components/PriorityContextMenu", () => ({
	PriorityContextMenu: mockPriorityContextMenu,
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
	getSelectedDateValue,
	showTaskModalDateContextMenu,
	showTaskModalPriorityContextMenu,
	showTaskModalRecurrenceContextMenu,
	showTaskModalReminderContextMenu,
	showTaskModalStatusContextMenu,
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
		translate: (key) => `translated:${key}`,
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
		mockDatePickerOptions = undefined;
		mockStatusOptions = undefined;
		mockPriorityOptions = undefined;
		mockRecurrenceOptions = undefined;
		mockReminderArgs = [];
	});

	it("opens the date picker with current date/time and applies combined selections", () => {
		const { context, getState, onChange, plugin } = createHarness({
			dueDate: "2026-05-20T09:30",
		});

		showTaskModalDateContextMenu(context, "due");

		expect(mockDateTimePickerModal).toHaveBeenCalledWith(context.app, {
			currentDate: "2026-05-20",
			currentTime: "09:30",
			title: "translated:modals.task.dateMenu.dueTitle",
			dateRole: "due",
			plugin,
			onSelect: expect.any(Function),
		});
		expect(mockDatePickerOpen).toHaveBeenCalledTimes(1);

		mockDatePickerOptions.onSelect("2026-05-21", "10:15");

		expect(getState().dueDate).toBe("2026-05-21T10:15");
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("clears scheduled dates from the date picker callback", () => {
		const { context, getState, onChange } = createHarness({
			scheduledDate: "2026-05-22",
		});

		showTaskModalDateContextMenu(context, "scheduled");
		mockDatePickerOptions.onSelect(null, null);

		expect(mockDatePickerOptions.title).toBe(
			"translated:modals.task.dateMenu.scheduledTitle"
		);
		expect(getState().scheduledDate).toBe("");
		expect(onChange).toHaveBeenCalledTimes(1);
	});

	it("updates status and priority through context menu callbacks", () => {
		const statusEvent = new MouseEvent("click");
		const priorityEvent = new MouseEvent("contextmenu");
		const { context, getState, onChange, plugin } = createHarness({
			status: "open",
			priority: "normal",
		});

		showTaskModalStatusContextMenu(context, statusEvent);
		showTaskModalPriorityContextMenu(context, priorityEvent);

		expect(mockStatusContextMenu).toHaveBeenCalledWith({
			currentValue: "open",
			onSelect: expect.any(Function),
			plugin,
		});
		expect(mockPriorityContextMenu).toHaveBeenCalledWith({
			currentValue: "normal",
			onSelect: expect.any(Function),
			plugin,
		});
		expect(mockStatusShow).toHaveBeenCalledWith(statusEvent);
		expect(mockPriorityShow).toHaveBeenCalledWith(priorityEvent);

		mockStatusOptions.onSelect("done");
		mockPriorityOptions.onSelect("high");

		expect(getState()).toEqual(expect.objectContaining({ status: "done", priority: "high" }));
		expect(onChange).toHaveBeenCalledTimes(2);
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

	it("normalizes date picker selections", () => {
		expect(getSelectedDateValue("2026-05-19", null)).toBe("2026-05-19");
		expect(getSelectedDateValue("2026-05-19", "09:30")).toBe("2026-05-19T09:30");
		expect(getSelectedDateValue(null, "09:30")).toBe("");
	});
});
