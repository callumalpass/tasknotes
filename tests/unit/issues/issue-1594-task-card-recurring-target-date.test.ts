import { createTaskCard } from "../../../src/ui/TaskCard";
import { TaskFactory } from "../../helpers/mock-factories";

jest.mock("../../../src/utils/helpers", () => ({
	calculateTotalTimeSpent: jest.fn(() => 0),
	filterEmptyProjects: jest.fn((projects?: string[]) => projects?.filter(Boolean) ?? []),
	getEffectiveTaskStatus: jest.fn((task, date) =>
		task.complete_instances?.includes(date.toISOString().slice(0, 10))
			? "done"
			: task.status || "open"
	),
	getRecurrenceDisplayText: jest.fn(() => "Daily"),
	getRecurringTaskCompletionText: jest.fn(() => "Not completed for this date"),
	sanitizeForCssClass: jest.fn((value: string) =>
		String(value)
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "-")
	),
	shouldUseRecurringTaskUI: jest.fn((task) => !!task.recurrence),
}));

jest.mock("../../../src/utils/dateUtils", () => ({
	formatDateForStorage: jest.fn((value: Date | string) =>
		value instanceof Date ? value.toISOString().slice(0, 10) : String(value).split("T")[0]
	),
	formatDateTimeForDisplay: jest.fn((date: string) => date),
	getDatePart: jest.fn((date: string) => date.split("T")[0]),
	getTimePart: jest.fn(() => null),
	isOverdueTimeAware: jest.fn(() => false),
	isTodayTimeAware: jest.fn(() => false),
}));

function createMockPlugin() {
	return {
		app: {
			metadataCache: {
				getFirstLinkpathDest: jest.fn(),
			},
			workspace: {
				openLinkText: jest.fn(),
			},
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
		},
		expandedProjectsService: {
			isExpanded: jest.fn(() => false),
			toggle: jest.fn(() => false),
		},
		fieldMapper: {
			getMapping: jest.fn(() => ({
				status: "status",
				priority: "priority",
			})),
			isPropertyForField: jest.fn((propertyId: string, field: string) => propertyId === field),
			toUserField: jest.fn((field: string) => field),
		},
		getActiveTimeSession: jest.fn(() => null),
		i18n: {
			translate: jest.fn((key: string) => key),
		},
		openTaskEditModal: jest.fn(),
		priorityManager: {
			getPriorityConfig: jest.fn(() => null),
		},
		projectSubtasksService: {
			isTaskUsedAsProjectSync: jest.fn(() => false),
		},
		settings: {
			doubleClickAction: "none",
			showExpandableSubtasks: true,
			singleClickAction: "edit",
		},
		statusManager: {
			getCompletedStatuses: jest.fn(() => ["done"]),
			getNextStatus: jest.fn(() => "done"),
			getStatusConfig: jest.fn((status: string) => ({
				value: status,
				label: status,
				color: "#777777",
			})),
			isCompletedStatus: jest.fn((status: string) => status === "done"),
		},
		toggleRecurringTaskComplete: jest.fn(async (task) => task),
		updateTaskProperty: jest.fn(),
	};
}

async function flushAsyncClick(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}

describe("Issue #1594: task note recurring completion target date", () => {
	it("uses the task's scheduled recurrence date when no view target date is supplied", async () => {
		const task = TaskFactory.createTask({
			path: "tasks/overdue-recurring.md",
			title: "Overdue recurring task",
			status: "open",
			recurrence: "DTSTART:20260404;FREQ=DAILY",
			recurrence_anchor: "scheduled",
			scheduled: "2026-04-04",
			complete_instances: [],
		});
		const plugin = createMockPlugin();
		plugin.toggleRecurringTaskComplete.mockResolvedValue({
			...task,
			complete_instances: ["2026-04-04"],
		});

		const card = createTaskCard(task, plugin as any, ["status"]);
		card
			.querySelector<HTMLElement>(".task-card__status-dot")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await flushAsyncClick();

		expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledTimes(1);
		const [, targetDate] = plugin.toggleRecurringTaskComplete.mock.calls[0];
		expect(targetDate.toISOString()).toBe("2026-04-04T00:00:00.000Z");
	});

	it("keeps explicit view target dates for calendar and task-list contexts", async () => {
		const task = TaskFactory.createTask({
			path: "tasks/calendar-recurring.md",
			title: "Calendar recurring task",
			status: "open",
			recurrence: "DTSTART:20260404;FREQ=DAILY",
			recurrence_anchor: "scheduled",
			scheduled: "2026-04-04",
			complete_instances: [],
		});
		const explicitTargetDate = new Date("2026-04-06T00:00:00.000Z");
		const plugin = createMockPlugin();

		const card = createTaskCard(task, plugin as any, ["status"], {
			targetDate: explicitTargetDate,
		});
		card
			.querySelector<HTMLElement>(".task-card__status-dot")
			?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await flushAsyncClick();

		expect(plugin.toggleRecurringTaskComplete).toHaveBeenCalledTimes(1);
		const [, targetDate] = plugin.toggleRecurringTaskComplete.mock.calls[0];
		expect(targetDate).toBe(explicitTargetDate);
	});
});
