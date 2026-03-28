import { describe, expect, it } from "@jest/globals";

import { TaskInfo } from "../../../src/types";
import {
	formatDateForStorage,
	parseDateToLocal,
} from "../../../src/utils/dateUtils";
import { buildTimeblockPrefillForTask } from "../../../src/utils/timeblockPrefillUtils";

function makeTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		path: "TaskNotes/Tasks/example.md",
		title: "Example task",
		status: "open",
		priority: "normal",
		...overrides,
	};
}

describe("buildTimeblockPrefillForTask", () => {
	it("uses the scheduled date for date-only scheduled tasks", () => {
		const prefill = buildTimeblockPrefillForTask(
			makeTask({
				scheduled: "2026-03-10",
				timeEstimate: 30,
			}),
			new Date(2026, 2, 29, 12, 0, 0, 0)
		);

		expect(prefill).toEqual({
			date: formatDateForStorage(parseDateToLocal("2026-03-10")),
			startTime: "09:00",
			endTime: "09:30",
		});
	});

	it("uses the scheduled datetime for time-aware scheduled tasks", () => {
		const prefill = buildTimeblockPrefillForTask(
			makeTask({
				scheduled: "2026-03-10T14:15",
				timeEstimate: 45,
			}),
			new Date(2026, 2, 29, 12, 0, 0, 0)
		);

		expect(prefill).toEqual({
			date: formatDateForStorage(parseDateToLocal("2026-03-10T14:15")),
			startTime: "14:15",
			endTime: "15:00",
		});
	});

	it("falls back to the target date for unscheduled tasks", () => {
		const prefill = buildTimeblockPrefillForTask(
			makeTask(),
			new Date(2026, 2, 29, 12, 0, 0, 0)
		);
		const expectedFallbackDate = new Date(2026, 2, 29, 12, 0, 0, 0);
		expectedFallbackDate.setHours(9, 0, 0, 0);

		expect(prefill).toEqual({
			date: formatDateForStorage(expectedFallbackDate),
			startTime: "09:00",
			endTime: "10:00",
		});
	});
});
