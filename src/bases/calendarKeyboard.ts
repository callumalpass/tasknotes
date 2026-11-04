import { msg } from "@lingui/core/macro";
import type { Calendar, ItemArg, ItemPointerArg } from "@tasknotes/calendar";
import type TaskNotesPlugin from "../main";
import { uiText } from "../i18n/runtime";
import { installTaskViewKeyboard } from "../ui/taskViewKeyboard";
import { calendarInputToDate, type CalendarEventProps } from "./calendarEngine";
import { isCalendarBatchTarget } from "./calendarBatchMove";

export function installCalendarKeyboard(options: {
	plugin: TaskNotesPlugin;
	root: HTMLElement;
	calendar: () => Calendar<CalendarEventProps> | null;
	create: (date: Date) => void;
	search: () => void;
	open: (arg: ItemPointerArg<CalendarEventProps>) => Promise<void>;
}): { mount: (arg: ItemArg<CalendarEventProps>) => void; destroy: () => void } {
	const mounted = new Map<string, ItemArg<CalendarEventProps>>();
	const visible = () => [...mounted.values()].filter((arg) => arg.el.isConnected && !arg.isMirror && !arg.item.data?.isBatchPreview);
	const paths = () => visible().sort((first, second) => {
		const order = first.el.compareDocumentPosition(second.el);
		return order & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : order & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
	}).flatMap((arg) => arg.el.dataset.keyboardId ?? []);
	const elementForPath = (path: string) => mounted.get(path)?.el;
	const dateFor = (path: string | null) => calendarInputToDate(path ? mounted.get(path)?.item.start : null) ?? options.calendar()?.getDate() ?? new Date();
	const move = (path: string | null, direction: number) => {
		const entries = paths();
		const index = path ? entries.indexOf(path) : -1;
		return entries[index < 0 ? direction > 0 ? 0 : entries.length - 1 : Math.max(0, Math.min(entries.length - 1, index + direction))] ?? null;
	};
	const destroyKeyboard = installTaskViewKeyboard({
		...options,
		paths,
		refreshSelection: () => {},
		elementForPath,
		pathFromElement: (element) => element.dataset.keyboardId ?? null,
		reveal: (path) => elementForPath(path)?.scrollIntoView({ block: "nearest", inline: "nearest" }),
		horizontal: move,
		horizontalLabel: uiText(msg({ message: "Move focus", context: "interaction shortcut" })),
		selectionPath: (path) => {
			const data = mounted.get(path)?.item.data;
			return data && isCalendarBatchTarget(data) ? data.taskInfo.path : undefined;
		},
		taskForPath: async (path) => {
			const task = mounted.get(path)?.item.data?.taskInfo;
			return task ? await options.plugin.cacheManager.getTaskInfo(task.path) ?? task : null;
		},
		open: async (path) => {
			const arg = mounted.get(path);
			if (!arg) return;
			if (arg.item.data?.taskInfo && arg.item.data.eventType !== "timeEntry") {
				await options.plugin.app.workspace.openLinkText(arg.item.data.taskInfo.path, "", false);
			} else await options.open({ ...arg, jsEvent: new KeyboardEvent("keydown", { key: "Enter" }) });
		},
		targetDate: (path) => dateFor(path),
		create: () => options.create(options.calendar()?.getDate() ?? new Date()),
		shortcuts: [
			{ key: "t", label: uiText(msg({ message: "Today", context: "views.basesCalendar.today" })), when: (path) => path === null, run: () => options.calendar()?.goToday() },
			...["[", "p"].map((key) => ({ key, label: uiText(msg({ message: "Previous", context: "views.basesCalendar.hints.prev" })), when: (path: string | null) => key !== "p" || path === null, run: () => options.calendar()?.prev() })),
			...["]", "n"].map((key) => ({ key, label: uiText(msg({ message: "Next", context: "views.basesCalendar.hints.next" })), run: () => options.calendar()?.next() })),
			{ key: "d", label: uiText(msg({ message: "Day", context: "calendar view name" })), when: (path) => path === null, run: () => options.calendar()?.changeView("day") },
			{ key: "w", label: uiText(msg({ message: "Week", context: "calendar view name" })), run: () => options.calendar()?.changeView("week") },
			{ key: "m", label: uiText(msg({ message: "Month", context: "calendar view name" })), run: () => options.calendar()?.changeView("month") },
			{ key: "c", label: uiText(msg({ message: "Create task", context: "interaction shortcut" })), run: (path) => options.create(dateFor(path)) },
		],
	});
	return {
		mount: (arg) => {
			for (const [key, previous] of mounted) if (!previous.el.isConnected) mounted.delete(key);
			const key = `${arg.item.id}:${arg.day}:${arg.variant}`;
			arg.el.dataset.keyboardId = key;
			mounted.set(key, arg);
		},
		destroy: () => { destroyKeyboard(); mounted.clear(); },
	};
}
