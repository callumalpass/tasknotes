// Shared contract scenarios require the real COUNT/EXDATE/TZID recurrence parser.
jest.mock("rrule", () => jest.requireActual("rrule/dist/es5/rrule.js"));

import { calendarFixtures } from "@tasknotes/model/calendar/fixtures";
import {
	calendarDateToInstant,
	calendarTaskId,
	type CalendarEntry,
} from "@tasknotes/model/calendar";
import type { TaskPatchOperation } from "@tasknotes/model/types";
import { TFile } from "obsidian";
import { DEFAULT_FIELD_MAPPING } from "../../../src/core/defaultFieldMapping";
import {
	CalendarTaskProjection,
	calendarEntryToEvent,
} from "../../../src/bases/calendarModelEvents";
import { toCalendarItems } from "../../../src/bases/calendarEngine";
import { TaskService } from "../../../src/services/TaskService";
import type TaskNotesPlugin from "../../../src/main";
import type { FieldMapping } from "../../../src/types";

const appearance = { getPriorityColor: () => "#3366ff", getThemeTextColor: () => "white" };
const customMapping = Object.fromEntries(
	Object.entries(DEFAULT_FIELD_MAPPING).map(([key, value]) => [key, `tn_${value}`])
) as unknown as FieldMapping;
const mappedFields = new Map(
	Object.entries(DEFAULT_FIELD_MAPPING).map(([key, value]) => [
		value,
		customMapping[key as keyof FieldMapping],
	])
);

/** Every shared scenario passes through the same index, mapping and persistence used by Bases. */
describe.each(calendarFixtures)("model calendar contract: $name", (fixture) => {
	it("maps entries to renderer items without losing dates, permissions or occurrence identity", () => {
		const invalid = jest.fn();
		const projection = new CalendarTaskProjection(fixture.input, invalid);
		projection.setTasks(fixture.input.tasks);
		const entries = projection.entriesInRange(fixture.input.range);
		const tasks = new Map(fixture.input.tasks.map((task) => [calendarTaskId(task), task]));
		const items = toCalendarItems(
			entries.map((entry) =>
				calendarEntryToEvent(entry, tasks.get(entry.taskId)!, appearance)
			)
		);
		expect(invalid).not.toHaveBeenCalled();
		expect(items.map((item) => item.data!.modelEntry)).toEqual(fixture.expectedEntries);
		expect(
			items.map((item) => ({
				id: item.id,
				title: item.title,
				start: item.start,
				end: item.end,
				allDay: item.allDay,
				kind: item.kind,
				editable: item.editable,
				startEditable: item.startEditable,
				durationEditable: item.durationEditable,
				completed: item.completed,
				lane: item.lane,
				instanceDate: item.data!.instanceDate,
				pattern: item.data!.isPatternInstance,
				next: item.data!.isNextScheduledOccurrence,
				recorded: item.data!.isRecurringInstance,
				skipped: item.data!.isSkipped,
				materialized: item.data!.isMaterializedOccurrence,
				parent: item.data!.occurrenceParent,
				overdue: item.data!.isOverdueOnToday,
				timeEntryIndex: item.data!.timeEntryIndex,
			}))
		).toEqual(
			fixture.expectedEntries.map((entry) => ({
				id: entry.id,
				title: entry.title,
				start: entry.start,
				end: entry.end ?? null,
				allDay: entry.allDay,
				kind: entry.type,
				editable: entry.startEditable,
				startEditable: entry.startEditable,
				durationEditable: entry.durationEditable,
				completed: entry.isCompleted,
				lane: entry.type === "timeEntry" ? "actual" : undefined,
				instanceDate: entry.instanceDate,
				pattern: entry.recurringKind === "pattern",
				next: entry.recurringKind === "next-scheduled",
				recorded: entry.recurringKind === "recorded",
				skipped: entry.isSkipped,
				materialized: entry.isMaterializedOccurrence,
				parent: entry.occurrenceParent,
				overdue: entry.isOverdueOnToday,
				timeEntryIndex: entry.timeEntryIndex,
			}))
		);
		for (const [i, item] of items.entries()) {
			expect(calendarDateToInstant(String(item.start), fixture.input.timezone)).toBe(
				calendarDateToInstant(fixture.expectedEntries[i].start, fixture.input.timezone)
			);
		}
		projection.clear();
	});

	for (const edit of fixture.edits)
		it(`persists ${edit.entryId} ${edit.change.kind} as one exact mapped patch`, async () => {
			const projection = new CalendarTaskProjection(fixture.input, (_task, error) => {
				throw error;
			});
			projection.setTasks(fixture.input.tasks);
			const entry = projection
				.entriesInRange(fixture.input.range)
				.find((e) => e.id === edit.entryId) as CalendarEntry;
			const freshTask = fixture.input.tasks.find(
				(task) => calendarTaskId(task) === entry.taskId
			)!;
			const file = new TFile();
			file.path = freshTask.path;
			const patch: TaskPatchOperation[] = [];
			const frontmatter = new Proxy<Record<string, unknown>>(
				{},
				{
					set(target, field: string, value) {
						patch.push({ op: "set", field, value });
						target[field] = value;
						return true;
					},
					deleteProperty(target, field: string) {
						patch.push({ op: "delete", field });
						delete target[field];
						return true;
					},
				}
			);
			const write = jest.fn(async (_file, update: (fm: Record<string, unknown>) => void) => {
				update(frontmatter);
			});
			const updateCache = jest.fn();
			const emit = jest.fn();
			const sync = jest.fn().mockResolvedValue(undefined);
			const plugin = {
				app: {
					vault: { getAbstractFileByPath: () => file },
					fileManager: { processFrontMatter: write },
				},
				fieldMapper: { getMapping: () => customMapping },
				cacheManager: {
					getTaskInfo: jest.fn().mockResolvedValue(freshTask),
					updateTaskInfoInCache: updateCache,
				},
				emitter: { trigger: emit },
				statusManager: {},
				taskCalendarSyncService: { isEnabled: () => true, updateTaskInCalendar: sync },
			} as unknown as TaskNotesPlugin;
			const service = new TaskService(plugin);
			const confirm = jest.fn().mockResolvedValue(true);
			if (
				edit.expectedClearedInstances.complete.length ||
				edit.expectedClearedInstances.skipped.length
			) {
				confirm.mockResolvedValueOnce(false);
				expect(
					await service.applyCalendarEdit(
						freshTask,
						entry,
						edit.change,
						fixture.input.timezone,
						{ now: fixture.input.now, confirmClearInstances: confirm }
					)
				).toBeNull();
				expect(write).not.toHaveBeenCalled();
				expect(updateCache).not.toHaveBeenCalled();
				expect(emit).not.toHaveBeenCalled();
				expect(sync).not.toHaveBeenCalled();
			}
			// Deliberately stale renderer task: persistence must read the complete fresh task.
			const result = await service.applyCalendarEdit(
				{ ...freshTask, scheduled: "1999-01-01" },
				entry,
				edit.change,
				fixture.input.timezone,
				{ now: fixture.input.now, confirmClearInstances: confirm }
			);
			expect(patch).toEqual(
				edit.expectedFrontmatterPatch.map((op) => ({
					...op,
					field: mappedFields.get(op.field) ?? op.field,
				}))
			);
			expect(write).toHaveBeenCalledTimes(1);
			expect(updateCache).toHaveBeenCalledWith(freshTask.path, result);
			expect(emit).toHaveBeenCalledTimes(1);
			expect(sync).toHaveBeenCalledWith(result, freshTask);
			if (
				edit.expectedClearedInstances.complete.length ||
				edit.expectedClearedInstances.skipped.length
			) {
				expect(confirm).toHaveBeenCalledWith(edit.expectedClearedInstances);
			} else expect(confirm).not.toHaveBeenCalled();
		});
});
