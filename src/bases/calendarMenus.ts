import type TaskNotesPlugin from "../main";
import type { ItemPointerArg } from "@tasknotes/calendar";
import { eventApiFromItem, type CalendarEventProps } from "./calendarEngine";
import {
	getOccurrenceDateForEvent,
	getTargetDateForEvent,
	showTimeblockInfoModal,
} from "./calendar-core";
import { handleCalendarTaskClick } from "../utils/clickHandlers";
import { TaskContextMenu } from "../components/TaskContextMenu";
import { ICSEventContextMenu } from "../components/ICSEventContextMenu";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";
import { Menu, TFile } from "obsidian";
import { format } from "date-fns";

export interface CalendarMenuContext {
	plugin: TaskNotesPlugin;
	expectImmediateUpdate(): void;
	refresh(): Promise<void>;
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
		void showTimeblockInfoModal(timeblock, eventStart, originalDate, context.plugin, () =>
			context.expectImmediateUpdate()
		);
		return;
	}

	// Handle time entry click - left click opens time entry modal
	if (eventType === "timeEntry" && taskInfo && jsEvent.button === 0) {
		context.plugin.openTimeEntryEditor(taskInfo, () => context.expectImmediateUpdate());
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
		void handleCalendarTaskClick(taskInfo, context.plugin, jsEvent, event.id, () =>
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
	const { taskInfo, icsEvent, eventType, filePath, subscriptionName } = extendedProps;
	const jsEvent = toMouseEvent(arg.jsEvent, arg.el);
	const event = eventApiFromItem(arg.item);

	if (taskInfo) {
		const contextMenu = new TaskContextMenu({
			task: taskInfo,
			plugin: context.plugin,
			targetDate: getTargetDateForEvent({ event }),
			occurrenceDate: getOccurrenceDateForEvent(taskInfo, { event }),
			promoteOccurrenceControls: Boolean(
				taskInfo.recurrence || (taskInfo.recurrence_parent && taskInfo.occurrence_date)
			),
			onUpdate: () => {
				void context.refresh();
			},
		});
		contextMenu.show(jsEvent);
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
			const menu = new Menu();
			context.plugin.app.workspace.trigger(
				"file-menu",
				menu,
				file,
				"tasknotes-bases-calendar"
			);
			menu.showAtPosition({ x: jsEvent.clientX, y: jsEvent.clientY });
		}
	}
}
