import { vaultDate } from "../utils/vaultTime";
import { addDays, format, startOfDay } from "date-fns";
import type { CalendarEventItem } from "./calendarEngine";
import { eventApiFromItem } from "./calendarEngine";
import { taskLinksToTaskInSet, type TaskProjectLinkResolver } from "./topLevelSubtasks";

const MAX_SPAN_DAYS = 366;

/** Local civil days an item covers in a list, end exclusive for all-day items. */
function itemDays(item: CalendarEventItem): string[] {
	const event = eventApiFromItem(item);
	if (!event.start) return [];
	const first = startOfDay(event.start);
	let last = first;
	if (event.end && event.end > event.start) {
		last = startOfDay(event.allDay ? addDays(event.end, -1) : vaultDate(event.end.getTime() - 1));
	}
	const days: string[] = [];
	for (let day = first; day <= last && days.length < MAX_SPAN_DAYS; day = addDays(day, 1)) {
		days.push(format(day, "yyyy-MM-dd"));
	}
	return days;
}

/**
 * "Hide top-level subtasks" for list rows (the agenda and the month day panel).
 * A subtask's row is dropped only when its parent task has a row on every day the
 * subtask's row would show, so the subtask can still be found under that parent.
 * A subtask whose parent isn't listed that day keeps its own row.
 */
export function filterListTopLevelSubtasks(
	items: readonly CalendarEventItem[],
	resolveProjectLink: TaskProjectLinkResolver
): CalendarEventItem[] {
	const tasksByDay = new Map<string, Set<string>>();
	const daysByItem = new Map<CalendarEventItem, string[]>();
	for (const item of items) {
		const path = item.data?.taskInfo?.path;
		if (!path) continue;
		const days = itemDays(item);
		daysByItem.set(item, days);
		for (const day of days) {
			let paths = tasksByDay.get(day);
			if (!paths) tasksByDay.set(day, (paths = new Set()));
			paths.add(path);
		}
	}

	return items.filter((item) => {
		const task = item.data?.taskInfo;
		// Tracked time is the row's own content; nested subtasks don't show it.
		if (!task || item.data?.eventType === "timeEntry") return true;
		const days = daysByItem.get(item) ?? [];
		if (days.length === 0) return true;
		return !days.every((day) => {
			const paths = tasksByDay.get(day);
			return paths ? taskLinksToTaskInSet(task, paths, resolveProjectLink) : false;
		});
	});
}
