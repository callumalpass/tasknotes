import { CalendarView } from "../../../src/bases/CalendarView";
import {
	CalendarTaskProjection,
	calendarMaterializedOccurrences,
} from "../../../src/bases/calendarModelEvents";
import { TaskFactory } from "../../helpers/mock-factories";
import type { TaskInfo } from "../../../src/types";
import type { CalendarEventItem } from "../../../src/bases/calendarEngine";

const context = {
	timezone: "UTC",
	now: "2026-05-19T12:00:00Z",
	settings: { showRecurring: false },
};
const range = { start: new Date("2026-05-19T00:00:00Z"), end: new Date("2026-05-21T00:00:00Z") };
const first = TaskFactory.createTask({
	id: "stable",
	path: "Tasks/First.md",
	scheduled: "2026-05-19T09:00",
});
const second = TaskFactory.createTask({ path: "Tasks/Second.md", scheduled: "2026-05-19T11:00" });

function harness() {
	const projection = new CalendarTaskProjection(context, (_task, error) => {
		throw error;
	});
	projection.setTasks([first, second]);
	const setItems = jest.fn<void, [CalendarEventItem[]]>();
	const refetchEvents = jest.fn();
	const readTask = jest.fn();
	const view = Object.assign(Object.create(CalendarView.prototype), {
		currentTasks: [first, second],
		identityTasks: [first, second],
		nonTaskEvents: [],
		taskProjection: projection,
		calendarTimezone: "UTC",
		refetchSeq: 0,
		basesSortIndexByPath: new Map(),
		_expectingImmediateUpdate: true,
		updateDebounceTimer: null,
		dataUpdateDebounceTimer: null,
		calendar: { getView: () => ({ range, type: "week" }), setItems },
		refetchEvents,
		plugin: {
			cacheManager: { getCachedTaskInfoSync: readTask },
			priorityManager: { getPriorityConfig: () => ({ color: "#3366ff" }) },
		},
	}) as {
		currentTasks: TaskInfo[];
		handleTaskUpdate(task: TaskInfo, source?: string): Promise<void>;
		refreshAfterDirectCalendarTaskWrite(task: TaskInfo): Promise<void>;
		_expectingImmediateUpdate: boolean;
	};
	return { view, projection, setItems, refetchEvents, readTask };
}

describe("incremental calendar updates", () => {
	it.each(["tasknotes-service", "metadata-cache"])(
		"updates only the changed row after %s, without a range refetch",
		async (source) => {
			const { view, projection, setItems, refetchEvents, readTask } = harness();
			const upsert = jest.spyOn(projection, "upsert");
			const changed = {
				...first,
				scheduled: "2026-05-20T10:00",
				dateModified: "2026-05-19T12:01:00Z",
			};
			await view.handleTaskUpdate(changed, source);
			expect(view._expectingImmediateUpdate).toBe(false);
			expect(view.currentTasks[1]).toBe(second);
			expect(upsert).toHaveBeenCalledTimes(1);
			expect(upsert).toHaveBeenCalledWith(
				expect.objectContaining({ scheduled: changed.scheduled })
			);
			expect(readTask).not.toHaveBeenCalled();
			expect(refetchEvents).not.toHaveBeenCalled();
			expect(setItems).toHaveBeenCalledTimes(1);
			expect(setItems.mock.calls[0][0].map((item) => [item.id, item.start])).toEqual([
				["scheduled-stable", changed.scheduled],
				[`scheduled-${second.path}`, second.scheduled],
			]);
		}
	);

	it("removes archived tasks and never inserts an excluded task before Bases admits it", async () => {
		const { view, projection, setItems } = harness();
		view._expectingImmediateUpdate = false;
		await view.refreshAfterDirectCalendarTaskWrite({ ...first, archived: true });
		await view.handleTaskUpdate(
			TaskFactory.createTask({ path: "Tasks/Excluded.md", scheduled: "2026-05-19" })
		);
		expect(view.currentTasks).toEqual([second]);
		expect(
			projection.entriesInRange({
				start: range.start.toISOString(),
				end: range.end.toISOString(),
			})
		).toHaveLength(1);
		expect(setItems.mock.calls.at(-1)![0]).toHaveLength(1);
	});

	it("resolves materialized children outside the query to their parent's stable id", () => {
		const child = TaskFactory.createTask({
			path: "Elsewhere/Child.md",
			recurrence_parent: "[[First]]",
			occurrence_date: "2026-05-19",
		});
		const resolve = jest.fn(() => first.path);
		expect(calendarMaterializedOccurrences([first, child], resolve)).toEqual({
			stable: ["2026-05-19"],
		});
		expect(resolve).toHaveBeenCalledWith("First", child.path);
	});

	it("rejects malformed dates without hiding valid rows", () => {
		const invalid = jest.fn();
		const projection = new CalendarTaskProjection(context, invalid);
		projection.setTasks([first, { ...second, scheduled: "not-a-date" }]);
		expect(
			projection.entriesInRange({
				start: range.start.toISOString(),
				end: range.end.toISOString(),
			})
		).toHaveLength(1);
		expect(invalid).toHaveBeenCalledTimes(1);
	});
});
