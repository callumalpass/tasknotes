/**
 * Issue #2691: Moving the next occurrence of a scheduled-anchored recurring task
 * must not clear other occurrences' completed/skipped history.
 *
 * - Scheduled-anchored tasks with a rule identity (`recurrence_original_date`)
 *   clear nothing on move.
 * - Scheduled-anchored tasks without a rule identity (Google Calendar-synced or
 *   legacy off-pattern notes without a marker) clear only the landing day when
 *   that day is already recorded, still behind confirmation.
 * - Completion-anchored recurring tasks keep the existing ">= new date" rule.
 */

jest.mock("rrule", () => jest.requireActual("rrule/dist/es5/rrule.js"));

import type TaskNotesPlugin from "../../../src/main";
import { TaskService } from "../../../src/services/TaskService";
import type { TaskInfo } from "../../../src/types";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function weeklyTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return TaskFactory.createTask({
		id: "weekly",
		path: "Tasks/Weekly review.md",
		title: "Weekly review",
		scheduled: "2026-11-22",
		recurrence: "DTSTART:20261101;FREQ=WEEKLY",
		complete_instances: ["2026-11-08", "2026-11-15"],
		skipped_instances: ["2026-11-29"],
		...overrides,
	});
}

function createHarness(task: TaskInfo, confirmed = true) {
	const frontmatter: Record<string, unknown> = {
		scheduled: task.scheduled,
		recurrence: task.recurrence,
		complete_instances: [...(task.complete_instances ?? [])],
		skipped_instances: [...(task.skipped_instances ?? [])],
		...(task.recurrence_original_date
			? { recurrence_original_date: task.recurrence_original_date }
			: {}),
	};
	const confirm = jest.fn(async () => confirmed);
	const plugin = PluginFactory.createMockPlugin({
		cacheManager: {
			getTaskInfo: jest.fn(async () => task),
			updateTaskInfoInCache: jest.fn(),
		},
		taskCalendarSyncService: { isEnabled: () => false },
	});
	plugin.app.fileManager.processFrontMatter = jest.fn(
		async (_file: unknown, update: (fm: Record<string, unknown>) => void) => {
			update(frontmatter);
		}
	);
	const taskService = new TaskService(plugin as unknown as TaskNotesPlugin);
	return { task, frontmatter, confirm, plugin, taskService };
}

describe("issue #2691 narrower reschedule-clear rule", () => {
	describe("scheduled-anchored native recurring tasks", () => {
		it("moving 22 Nov to 21 Nov preserves the skip on 29 Nov and does not ask to confirm", async () => {
			const { task, frontmatter, confirm, taskService } = createHarness(weeklyTask());

			const result = await taskService.updateProperty(task, "scheduled", "2026-11-21", {
				confirmClearInstances: confirm,
			});

			expect(confirm).not.toHaveBeenCalled();
			expect(result.scheduled).toBe("2026-11-21");
			expect(result.recurrence_original_date).toBe("2026-11-22");
			expect(result.complete_instances).toEqual(["2026-11-08", "2026-11-15"]);
			expect(result.skipped_instances).toEqual(["2026-11-29"]);
			expect(frontmatter).toMatchObject({
				scheduled: "2026-11-21",
				recurrence_original_date: "2026-11-22",
				complete_instances: ["2026-11-08", "2026-11-15"],
				skipped_instances: ["2026-11-29"],
			});
		});

		it("moving 22 Nov onto completed 15 Nov preserves 15 Nov completion and 29 Nov skip", async () => {
			const { task, frontmatter, confirm, taskService } = createHarness(weeklyTask());

			const result = await taskService.updateProperty(task, "scheduled", "2026-11-15", {
				confirmClearInstances: confirm,
			});

			expect(confirm).not.toHaveBeenCalled();
			expect(result.scheduled).toBe("2026-11-15");
			expect(result.recurrence_original_date).toBe("2026-11-22");
			expect(result.complete_instances).toEqual(["2026-11-08", "2026-11-15"]);
			expect(result.skipped_instances).toEqual(["2026-11-29"]);
			expect(frontmatter.complete_instances).toEqual(["2026-11-08", "2026-11-15"]);
			expect(frontmatter.skipped_instances).toEqual(["2026-11-29"]);
		});

		it("moving 22 Nov onto skipped 29 Nov preserves 29 Nov skip", async () => {
			const { task, confirm, taskService } = createHarness(weeklyTask());

			const result = await taskService.updateProperty(task, "scheduled", "2026-11-29", {
				confirmClearInstances: confirm,
			});

			expect(confirm).not.toHaveBeenCalled();
			expect(result.recurrence_original_date).toBe("2026-11-22");
			expect(result.skipped_instances).toEqual(["2026-11-29"]);
		});

		it("moving an already-moved occurrence preserves history, including when returning to its original date", async () => {
			const moved = weeklyTask({
				scheduled: "2026-11-21",
				recurrence_original_date: "2026-11-22",
			});
			const ontoCompleted = createHarness(moved);
			const result = await ontoCompleted.taskService.updateProperty(
				moved,
				"scheduled",
				"2026-11-15",
				{ confirmClearInstances: ontoCompleted.confirm }
			);
			expect(ontoCompleted.confirm).not.toHaveBeenCalled();
			expect(result.recurrence_original_date).toBe("2026-11-22");
			expect(result.complete_instances).toEqual(["2026-11-08", "2026-11-15"]);
			expect(result.skipped_instances).toEqual(["2026-11-29"]);

			// Exhausted moved occurrence returned home keeps its recorded completion.
			const exhaustedMoved = weeklyTask({
				scheduled: "2026-11-21",
				recurrence: "DTSTART:20261115;FREQ=WEEKLY;COUNT=2",
				recurrence_original_date: "2026-11-22",
				complete_instances: ["2026-11-15", "2026-11-22"],
				skipped_instances: [],
			});
			const returned = createHarness(exhaustedMoved);
			const homeResult = await returned.taskService.updateProperty(
				exhaustedMoved,
				"scheduled",
				"2026-11-22",
				{ confirmClearInstances: returned.confirm }
			);
			expect(returned.confirm).not.toHaveBeenCalled();
			expect(homeResult.recurrence_original_date).toBeUndefined();
			expect(homeResult.complete_instances).toEqual(["2026-11-15", "2026-11-22"]);
		});
	});

	describe("scheduled-anchored tasks without recurrence_original_date", () => {
		it("Google-synced move onto an unrecorded day clears nothing and keeps later skips", async () => {
			const synced = weeklyTask({ googleCalendarEventId: "gcal-1" });
			const { confirm, taskService } = createHarness(synced);

			const result = await taskService.updateProperty(synced, "scheduled", "2026-11-21", {
				confirmClearInstances: confirm,
			});

			expect(confirm).not.toHaveBeenCalled();
			expect(result.recurrence_original_date).toBeUndefined();
			expect(result.complete_instances).toEqual(["2026-11-08", "2026-11-15"]);
			expect(result.skipped_instances).toEqual(["2026-11-29"]);
		});

		it("Google-synced move onto a completed day asks to clear only that day and keeps later skips", async () => {
			const synced = weeklyTask({ googleCalendarEventId: "gcal-1" });
			const { frontmatter, confirm, taskService } = createHarness(synced, true);

			const result = await taskService.updateProperty(
				synced,
				"scheduled",
				"2026-11-15T10:30",
				{ confirmClearInstances: confirm }
			);

			expect(confirm).toHaveBeenCalledWith({ complete: ["2026-11-15"], skipped: [] });
			expect(result.complete_instances).toEqual(["2026-11-08"]);
			expect(result.skipped_instances).toEqual(["2026-11-29"]);
			expect(frontmatter.complete_instances).toEqual(["2026-11-08"]);
			expect(frontmatter.skipped_instances).toEqual(["2026-11-29"]);
		});

		it("Google-synced move onto a recorded day aborts with no write when confirmation is declined", async () => {
			const synced = weeklyTask({ googleCalendarEventId: "gcal-1" });
			const { confirm, plugin, taskService } = createHarness(synced, false);

			const result = await taskService.updateProperty(synced, "scheduled", "2026-11-29", {
				confirmClearInstances: confirm,
			});

			expect(confirm).toHaveBeenCalledWith({ complete: [], skipped: ["2026-11-29"] });
			expect(plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
			expect(result.scheduled).toBe("2026-11-22");
			expect(result.skipped_instances).toEqual(["2026-11-29"]);
		});

		it("legacy off-pattern note without marker clears only a recorded landing day", async () => {
			const legacy = weeklyTask({ scheduled: "2026-11-19" });

			const toUnrecorded = createHarness(legacy);
			const unrecordedResult = await toUnrecorded.taskService.updateProperty(
				legacy,
				"scheduled",
				"2026-11-21",
				{ confirmClearInstances: toUnrecorded.confirm }
			);
			expect(toUnrecorded.confirm).not.toHaveBeenCalled();
			expect(unrecordedResult.complete_instances).toEqual(["2026-11-08", "2026-11-15"]);
			expect(unrecordedResult.skipped_instances).toEqual(["2026-11-29"]);

			const toCompleted = createHarness(legacy, true);
			const completedResult = await toCompleted.taskService.updateProperty(
				legacy,
				"scheduled",
				"2026-11-15",
				{ confirmClearInstances: toCompleted.confirm }
			);
			expect(toCompleted.confirm).toHaveBeenCalledWith({
				complete: ["2026-11-15"],
				skipped: [],
			});
			expect(completedResult.complete_instances).toEqual(["2026-11-08"]);
			expect(completedResult.skipped_instances).toEqual(["2026-11-29"]);

			const declined = createHarness(legacy, false);
			const declinedResult = await declined.taskService.updateProperty(
				legacy,
				"scheduled",
				"2026-11-15",
				{ confirmClearInstances: declined.confirm }
			);
			expect(declined.confirm).toHaveBeenCalledWith({
				complete: ["2026-11-15"],
				skipped: [],
			});
			expect(declined.plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
			expect(declinedResult.scheduled).toBe("2026-11-19");
		});
	});

	describe("completion-anchored recurring tasks (unchanged)", () => {
		it("still clears all recorded instances on or after the new scheduled date", async () => {
			const completionAnchored = weeklyTask({ recurrence_anchor: "completion" });

			const toSat = createHarness(completionAnchored, true);
			const satResult = await toSat.taskService.updateProperty(
				completionAnchored,
				"scheduled",
				"2026-11-21",
				{ confirmClearInstances: toSat.confirm }
			);
			expect(toSat.confirm).toHaveBeenCalledWith({ complete: [], skipped: ["2026-11-29"] });
			expect(satResult.complete_instances).toEqual(["2026-11-08", "2026-11-15"]);
			expect(satResult.skipped_instances).toEqual([]);

			const toEarlier = createHarness(completionAnchored, true);
			const earlierResult = await toEarlier.taskService.updateProperty(
				completionAnchored,
				"scheduled",
				"2026-11-15",
				{ confirmClearInstances: toEarlier.confirm }
			);
			expect(toEarlier.confirm).toHaveBeenCalledWith({
				complete: ["2026-11-15"],
				skipped: ["2026-11-29"],
			});
			expect(earlierResult.complete_instances).toEqual(["2026-11-08"]);
			expect(earlierResult.skipped_instances).toEqual([]);

			const declined = createHarness(completionAnchored, false);
			const declinedResult = await declined.taskService.updateProperty(
				completionAnchored,
				"scheduled",
				"2026-11-15",
				{ confirmClearInstances: declined.confirm }
			);
			expect(declined.plugin.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
			expect(declinedResult.scheduled).toBe("2026-11-22");
		});
	});
});
