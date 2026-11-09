import { msg } from "@lingui/core/macro";
import { Menu } from "obsidian";
import type { SelectArg } from "@tasknotes/calendar";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import type { TimeblockCreationResult } from "../modals/TimeblockCreationModal";
import { TaskCreationModal } from "../modals/TaskCreationModal";
import { CalendarEventCreationModal } from "../modals/CalendarEventCreationModal";
import { calculateTaskCreationValues, handleTimeblockCreation, handleTimeEntryCreation } from "./calendar-core";
import { toMouseEvent } from "./calendarMenus";

interface CalendarCreationContext {
 plugin: TaskNotesPlugin;
 slotDuration: string;
 anchor: HTMLElement;
 unselect: () => void;
 onTaskCreated: (task: TaskInfo) => Promise<void>;
 onTimeblockCreated: (result: TimeblockCreationResult) => void;
 expectImmediateUpdate: () => void;
}

export function showCalendarCreationMenu(context: CalendarCreationContext, info: SelectArg): void {
		if (context.plugin.taskSelectionService?.isSelectionModeActive()) {
			context.plugin.taskSelectionService.exitSelectionMode(true);
			context.unselect();
			return;
		}
		// Determine what type of event to create based on view
		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle(context.plugin.i18n.translate(msg({ message: "Create task", context: "modals.taskCreation.title" })))
				.setIcon("check-square")
				.onClick(async () => {
					// Parse slot duration to get minutes (default to 30 if not set)
					const slotDurationParts = context.slotDuration.split(":");
					const slotDurationMinutes =
						parseInt(slotDurationParts[0]) * 60 + parseInt(slotDurationParts[1] || "0");

					const values = calculateTaskCreationValues(
						info.start,
						info.end,
						info.allDay,
						slotDurationMinutes
					);

					const modal = new TaskCreationModal(context.plugin.app, context.plugin, {
						prePopulatedValues: values,
						onTaskCreated: (task) => {
							void context.onTaskCreated(task);
						},
					});
					modal.open();
				});
		});

		// Only show timeblock option if timeblocking is enabled
		if (context.plugin.settings.calendarViewSettings.enableTimeblocking) {
			menu.addItem((item) => {
				item.setTitle(context.plugin.i18n.translate(msg({ message: "Create timeblock", context: "modals.timeblockCreation.heading" })))
					.setIcon("clock")
					.onClick(async () => {
						await handleTimeblockCreation(
							info.start,
							info.end,
							info.allDay,
							context.plugin,
							(result) => context.onTimeblockCreated(result)
						);
					});
			});
		}

		menu.addItem((item) => {
			item.setTitle(context.plugin.i18n.translate(msg({ message: "Create time entry", context: "ui.audit.createEntry" })))
				.setIcon("play")
				.onClick(async () => {
					context.expectImmediateUpdate();
					await handleTimeEntryCreation(info.start, info.end, info.allDay, context.plugin);
				});
		});

		// Show "Create calendar event" if any external calendars are connected
		const registry = context.plugin.calendarProviderRegistry;
		if (registry) {
			const hasWritableCalendars = registry
				.getAllProviders()
				.some((p) => p.getAvailableCalendars().length > 0);
			if (hasWritableCalendars) {
				menu.addSeparator();
				menu.addItem((item) => {
					item.setTitle(context.plugin.i18n.translate(msg({ message: "Create external calendar event", context: "ui.audit.createExternal" })))
						.setIcon("calendar-plus")
						.onClick(() => {
							const modal = new CalendarEventCreationModal(
								context.plugin.app,
								context.plugin,
								{
									start: info.start,
									end: info.end,
									allDay: info.allDay,
									onEventCreated: () => {
										context.expectImmediateUpdate();
										// Refresh provider data to show the new event
										void registry.refreshAll();
									},
								}
							);
							modal.open();
						});
				});
			}
		}

		menu.onHide(() => {
			context.unselect();
		});

		const anchor = context.anchor;
		menu.showAtMouseEvent(toMouseEvent(info.jsEvent, anchor));
	}
