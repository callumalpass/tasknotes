import type TaskNotesPlugin from "../main";
import type { ItemPointerArg } from "@tasknotes/calendar";
import { eventApiFromItem, type CalendarEventProps } from "./calendarEngine";
import {
	getOccurrenceDateForEvent,
	getTargetDateForEvent,
	loadTimeblock,
	showTimeblockInfoModal,
} from "./calendar-core";
import { handleCalendarTaskClick } from "../utils/clickHandlers";
import { openTaskMenu } from "../ui/taskCardContextMenu";
import { isCalendarBatchTarget } from "./calendarBatchMove";
import { ICSEventContextMenu } from "../components/ICSEventContextMenu";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";
import { msg } from "@lingui/core/macro";
import { TFile } from "obsidian";
import { ContextMenu } from "../components/ContextMenu";
import { showCoordinatedMenu } from "../components/ContextMenuCoordinator";
import {
	deleteTimeblockWithUndo,
	resolveTimeblockAttachments,
	TimeblockInfoModal,
} from "../modals/TimeblockInfoModal";
import type { TimeBlock } from "../types";
import { showNoteContextMenu } from "../components/noteFileMenu";
import { format } from "date-fns";

export interface CalendarMenuContext {
	plugin: TaskNotesPlugin;
	expectImmediateUpdate(): void;
	refresh(): Promise<void>;
	showBatchMenu?: (event: MouseEvent) => void;
}
/** Adapt keyboard activation to the pointer-shaped events expected by Obsidian menus. */
export function toMouseEvent(
	ev: MouseEvent | KeyboardEvent | PointerEvent | null,
	anchor: HTMLElement
): MouseEvent {
	if (ev && "button" in ev) return ev;
	const win = anchor.ownerDocument.defaultView ?? window;
	const rect = anchor.getBoundingClientRect();
	return new win.MouseEvent("click", {
		clientX: rect.left + Math.min(rect.width / 2, 24),
		clientY: rect.top + Math.min(rect.height / 2, 12),
		ctrlKey: ev?.ctrlKey,
		metaKey: ev?.metaKey,
		shiftKey: ev?.shiftKey,
		altKey: ev?.altKey,
	});
}

export async function handleCalendarEventClick(
	context: CalendarMenuContext,
	arg: ItemPointerArg<CalendarEventProps>
): Promise<void> {
	const event = eventApiFromItem(arg.item);
	const { taskInfo, timeblock, eventType, filePath, icsEvent, subscriptionName } =
		event.extendedProps;
	const jsEvent = toMouseEvent(arg.jsEvent, arg.el);

	// Handle timeblock click
	if (eventType === "timeblock" && timeblock) {
		const eventStart = event.start;
		if (!eventStart) return;
		const originalDate = format(eventStart, "yyyy-MM-dd");
		await showTimeblockInfoModal(timeblock, eventStart, originalDate, context.plugin, () =>
			context.expectImmediateUpdate()
		);
		return;
	}

	// Handle time entry click - left click opens time entry modal
	if (eventType === "timeEntry" && taskInfo && jsEvent.button === 0) {
		const latest = await context.plugin.cacheManager.getTaskInfo(taskInfo.path);
		if (latest) context.plugin.openTimeEntryEditor(latest, () => context.expectImmediateUpdate());
		return;
	}

	// Handle ICS event click - show info modal
	if (eventType === "ics" && icsEvent) {
		const modal = new ICSEventInfoModal(
			context.plugin.app,
			context.plugin,
			icsEvent,
			subscriptionName
		);
		modal.open();
		return;
	}

	// Handle property-based event click - open file directly
	if (eventType === "property-based" && filePath) {
		const file = context.plugin.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			const isModKey = jsEvent.ctrlKey || jsEvent.metaKey;
			const newLeaf = isModKey || jsEvent.button === 1; // Ctrl/Cmd+click or middle click
			void context.plugin.app.workspace.getLeaf(newLeaf).openFile(file);
		}
		return;
	}

	// Handle task click with single/double click detection based on user settings
	if (taskInfo?.path && jsEvent.button === 0) {
		const latest = await context.plugin.cacheManager.getTaskInfo(taskInfo.path);
		if (!latest) return;
		void handleCalendarTaskClick(latest, context.plugin, jsEvent, event.id, () =>
			context.expectImmediateUpdate()
		);
	}
}

export function handleCalendarEventContextMenu(
	context: CalendarMenuContext,
	arg: ItemPointerArg<CalendarEventProps>
): void {
	const extendedProps = arg.item.data;
	if (!extendedProps) return;
	const { taskInfo, icsEvent, eventType, filePath, subscriptionName, timeblock } = extendedProps;
	const jsEvent = toMouseEvent(arg.jsEvent, arg.el);
	const event = eventApiFromItem(arg.item);

	if (eventType === "timeblock" && timeblock && event.start) {
		jsEvent.preventDefault();
		void showTimeblockContextMenu(context, jsEvent, timeblock, event.start);
		return;
	}

	if (taskInfo) {
		void openTaskMenu(jsEvent, taskInfo.path, context.plugin, getTargetDateForEvent({ event }), {
			occurrenceDate: getOccurrenceDateForEvent(taskInfo, { event }),
			promoteOccurrenceControls: Boolean(
				taskInfo.recurrence || (taskInfo.recurrence_parent && taskInfo.occurrence_date)
			),
			onUpdate: () => {
				void context.refresh();
			},
			// Only plain date markers move as a batch; series, spans and tracked time do not.
			canBatch: isCalendarBatchTarget(extendedProps),
			showBatchMenu: context.showBatchMenu,
		});
		return;
	}

	if (icsEvent && eventType === "ics") {
		const contextMenu = new ICSEventContextMenu({
			icsEvent,
			plugin: context.plugin,
			subscriptionName,
			onUpdate: () => {
				void context.refresh();
			},
		});
		contextMenu.show(jsEvent);
		return;
	}

	if (eventType === "property-based" && filePath) {
		const file = context.plugin.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			showNoteContextMenu(
				{ x: jsEvent.clientX, y: jsEvent.clientY },
				file,
				context.plugin,
				"tasknotes-bases-calendar"
			);
		}
	}
}

/** Edit, open the daily note or a linked file, or delete a timeblock. */
async function showTimeblockContextMenu(
	context: CalendarMenuContext,
	jsEvent: MouseEvent,
	timeblock: TimeBlock,
	eventStart: Date
): Promise<void> {
	const { plugin } = context;
	const loaded = await loadTimeblock(timeblock, eventStart, plugin);
	if (!loaded) return;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const timeblockDate = format(eventStart, "yyyy-MM-dd");
	const onChange = () => context.expectImmediateUpdate();
	const menu = new ContextMenu();
	menu.addItem((item) =>
		item
			.setTitle(t(msg({ message: "Edit timeblock", context: "calendar timeblock menu edit" })))
			.setIcon("pencil")
			.onClick(() =>
				new TimeblockInfoModal(
					plugin.app,
					plugin,
					loaded.timeblock,
					eventStart,
					timeblockDate,
					onChange
				).open()
			)
	);
	menu.addItem((item) =>
		item
			.setTitle(t(msg({ message: "Open daily note", context: "views.miniCalendar.contextMenu.openDailyNote" })))
			.setIcon("calendar")
			.onClick(() => void plugin.app.workspace.getLeaf(false).openFile(loaded.dailyNote))
	);
	for (const { file } of resolveTimeblockAttachments(plugin.app, loaded.timeblock)) {
		if (!(file instanceof TFile)) continue;
		menu.addItem((item) =>
			item
				.setTitle(t(msg({ message: "Open {name}", context: "modals.task.attachments.openAriaLabel" }), { name: file.basename }))
				.setIcon("file-text")
				.onClick(() => void plugin.app.workspace.getLeaf(false).openFile(file))
		);
	}
	menu.addSeparator();
	menu.addItem((item) =>
		item
			.setTitle(t(msg({ message: "Delete timeblock", context: "modals.timeblockInfo.deleteButton" })))
			.setIcon("trash")
			.setWarning(true)
			.onClick(() => void deleteTimeblockWithUndo(plugin, loaded.timeblock, timeblockDate, onChange))
	);
	showCoordinatedMenu(menu, jsEvent);
}
