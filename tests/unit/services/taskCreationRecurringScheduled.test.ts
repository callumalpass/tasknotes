/**
 * Recurring tasks created without a scheduled date should get the first upcoming
 * occurrence as their scheduled date, like tasks whose recurrence is added later.
 * Superseded PR #2202.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { PluginFactory } from "../../helpers/mock-factories";
import { TaskCreationService } from "../../../src/services/task-service/TaskCreationService";
import type { TaskCreationData } from "../../../src/types";

jest.unmock("rrule");
jest.mock("rrule", () => jest.requireActual("../../../node_modules/rrule/dist/es5/rrule.js"));

jest.mock("../../../src/utils/filenameGenerator", () => ({
	...jest.requireActual<object>("../../../src/utils/filenameGenerator"),
	generateTaskFilename: jest.fn(() => "recurring-task"),
	generateUniqueFilename: jest.fn(() => "recurring-task"),
}));

jest.mock("../../../src/utils/helpers", () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../src/utils/templateProcessor", () => ({
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

async function createAndCapture(taskData: TaskCreationData) {
	const mockPlugin = PluginFactory.createMockPlugin();
	const mapToFrontmatterSpy = jest.spyOn(mockPlugin.fieldMapper, "mapToFrontmatter");
	const service = new TaskCreationService({
		runtime: mockPlugin,
		applyTaskCreationDefaults: jest.fn(async (data) => data),
		applyTemplate: jest.fn(async () => ({ frontmatter: {}, body: "" })),
		processFolderTemplate: jest.fn((folderTemplate) => folderTemplate),
		sanitizeTitleForFilename: jest.fn((input) => input),
		sanitizeTitleForStorage: jest.fn((input) => input),
	});

	await service.createTask(taskData, { applyDefaults: false });
	return mapToFrontmatterSpy.mock.calls[0][0] as { scheduled?: string; recurrence?: string };
}

describe("creating a recurring task without a scheduled date", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date(2026, 7, 4, 12, 57, 6));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("schedules the first occurrence of a rule with a start date", async () => {
		const task = await createAndCapture({
			title: "Pay rent",
			recurrence: "DTSTART:20260810;FREQ=MONTHLY;BYMONTHDAY=10",
		});

		expect(task.scheduled).toBe("2026-08-10");
		expect(task.recurrence).toBe("DTSTART:20260810;FREQ=MONTHLY;BYMONTHDAY=10");
	});

	it("keeps the time of a timed start date", async () => {
		const task = await createAndCapture({
			title: "Standup",
			recurrence: "DTSTART:20260804T093000Z;FREQ=WEEKLY;BYDAY=WE",
		});

		expect(task.scheduled).toBe("2026-08-05T09:30");
	});

	it("schedules a rule without a start date and derives a date-only start from it", async () => {
		const task = await createAndCapture({
			title: "Water plants",
			recurrence: "FREQ=WEEKLY;BYDAY=FR",
		});

		expect(task.scheduled).toBe("2026-08-07");
		expect(task.recurrence).toBe("DTSTART:20260807;FREQ=WEEKLY;BYDAY=FR");
	});

	it("schedules the start date of a completion-based rule", async () => {
		const task = await createAndCapture({
			title: "Haircut",
			recurrence: "DTSTART:20260810;FREQ=WEEKLY;BYDAY=MO",
			recurrence_anchor: "completion",
		});

		expect(task.scheduled).toBe("2026-08-10");
	});

	it("schedules a series that starts beyond the look-ahead window", async () => {
		const task = await createAndCapture({
			title: "Renew passport",
			recurrence: "DTSTART:20290101;FREQ=YEARLY",
		});

		expect(task.scheduled).toBe("2029-01-01");
	});

	it("keeps the time of a start date with parameters", async () => {
		const task = await createAndCapture({
			title: "Call",
			recurrence: "DTSTART;TZID=Europe/London:20260805T093000;FREQ=DAILY",
		});

		expect(task.scheduled).toBe("2026-08-05T09:30");
	});

	it("leaves an ended series unscheduled", async () => {
		const task = await createAndCapture({
			title: "Old series",
			recurrence: "DTSTART:20250101;FREQ=DAILY;COUNT=3",
		});

		expect(task.scheduled).toBeUndefined();
	});

	it("keeps an explicit scheduled date", async () => {
		const task = await createAndCapture({
			title: "Explicit",
			scheduled: "2026-09-01",
			recurrence: "DTSTART:20260810;FREQ=MONTHLY;BYMONTHDAY=10",
		});

		expect(task.scheduled).toBe("2026-09-01");
	});
});
