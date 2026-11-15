import { observeTranslation as mockObserveTranslation } from "../../helpers/real-i18n";
const mockOpenChoices = jest.fn();

const mockOpenRecurrenceChoices = jest.fn();

const mockOpenListPicker = jest.fn();
const mockReminderModalOpen = jest.fn();
let mockReminderArgs: any[];
const mockReminderModal = jest.fn().mockImplementation((...args) => {
	mockReminderArgs = args;
	return { open: mockReminderModalOpen };
});

jest.mock("../../../src/ui/taskPropertyPickers", () => ({
	openTaskPropertyChoices: mockOpenChoices,
	taskPropertyLabel: (property: string) => (property === "due" ? "Due date" : "Scheduled date"),
}));

jest.mock("../../../src/ui/kit/listPicker", () => ({
	openListPicker: (options: unknown) => mockOpenListPicker(options),
}));

jest.mock("../../../src/ui/taskRecurrencePicker", () => ({
	openRecurrenceChoices: mockOpenRecurrenceChoices,
}));

jest.mock("../../../src/modals/ReminderModal", () => ({
	ReminderModal: mockReminderModal,
}));

import type { Reminder, TaskInfo } from "../../../src/types";
import { createI18nService } from "../../../src/i18n";
import {
	createTaskModalReminderDraft,
	showTaskModalPropertyPicker,
	showTaskModalRecurrencePicker,
	showTaskModalReminderPicker,
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
	const plugin = { settings: {}, i18n: createI18nService() };
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
		const anchor = document.createElement("button");
		const { context, getState, onChange, plugin } = createHarness({
			recurrenceRule: "FREQ=DAILY",
			recurrenceAnchor: "scheduled",
			scheduledDate: "2026-05-19",
		});

		showTaskModalRecurrencePicker(context, anchor);

		expect(mockOpenRecurrenceChoices).toHaveBeenCalledWith(
			plugin,
			context.app,
			{ recurrence: "FREQ=DAILY", anchor: "scheduled", scheduled: "2026-05-19" },
			anchor,
			expect.any(Function)
		);
		const apply = mockOpenRecurrenceChoices.mock.calls[0][4];

		apply(undefined);
		expect(getState()).toEqual(
			expect.objectContaining({ recurrenceRule: "", recurrenceAnchor: "scheduled" })
		);

		apply("FREQ=WEEKLY", "completion");
		expect(getState()).toEqual(
			expect.objectContaining({ recurrenceRule: "FREQ=WEEKLY", recurrenceAnchor: "completion" })
		);
		expect(onChange).toHaveBeenCalledTimes(2);
	});

	it("adds quick reminders for the dates the draft has, and clears them", () => {
		const existing: Reminder = { id: "r1", type: "relative", relatedTo: "due", offset: "-PT15M" };
		const { context, getState, onChange } = createHarness({
			dueDate: "2026-05-20",
			reminders: [existing],
		});

		showTaskModalReminderPicker(context, document.createElement("button"));

		const { items, onChoose } = mockOpenListPicker.mock.calls[0][0];
		// No scheduled date, so only due-date reminders are offered
		expect(items.map((item: { id: string }) => item.id)).toEqual([
			"due:PT0M", "due:-PT5M", "due:-PT15M", "due:-PT1H", "due:-P1D", "manage", "clear",
		]);
		expect(items.find((item: { id: string }) => item.id === "due:-PT15M").selected).toBe(true);

		onChoose(items[3]);
		expect(getState().reminders).toEqual([
			existing,
			expect.objectContaining({ type: "relative", relatedTo: "due", offset: "-PT1H" }),
		]);
		onChoose(items.find((item: { id: string }) => item.id === "clear"));
		expect(getState().reminders).toEqual([]);
		expect(onChange).toHaveBeenCalledTimes(2);
	});

	it("opens the reminder modal on a draft of the edited task, keeping its identity", () => {
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

		showTaskModalReminderPicker(context, document.createElement("button"), taskBase);
		const { items, onChoose } = mockOpenListPicker.mock.calls[0][0];
		onChoose(items.find((item: { id: string }) => item.id === "manage"));

		expect(mockReminderModal).toHaveBeenCalledTimes(1);
		expect(mockReminderArgs[1]).toBe(plugin);
		expect(mockReminderArgs[2]).toEqual({
			...taskBase,
			title: "Updated title",
			status: "done",
			priority: "high",
			due: "2026-05-20",
			scheduled: "2026-05-19",
			reminders: [reminder],
		});
		expect(mockReminderModalOpen).toHaveBeenCalled();

		const updatedReminder: Reminder = { id: "r2", type: "relative", offset: "-PT5M" };
		mockReminderArgs[3]([updatedReminder]);

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
